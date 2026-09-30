"""Webhook de importación: avisa a un sistema externo, por cliente, cada vez que
termina de importarse un archivo que llegó por correo.

**Qué se envía.** Un evento por archivo importado, de los tres reportes que
llegan por correo: `estado_diario.importado`, `movimientos.importado` y
`audiencias.importado`. Lleva los datos del archivo y sus filas. La cartera de
causas no se envía: no llega por correo y no estaba pedida.

**Cómo se entrega.** Importar y avisar son dos cosas y la segunda nunca puede
romper a la primera. Por eso hay una cola (`webhook_envio`, en la base del
cliente): al terminar de importar solo se anota qué enviar, y recién después,
con la casilla ya cerrada, se despacha. Lo que falla se reintenta con espera
creciente y lo que agota los intentos queda como `fallido` para que el
administrador lo vea y lo reintente. Es entrega **al menos una vez**: el
receptor tiene que descartar repetidos por `X-Webhook-Id` + lote.

Un archivo grande se reparte en lotes de `WEBHOOK_TAMANO_LOTE` filas, cada uno
una petición con su propio reintento.

**Cómo se firma.** `X-Webhook-Signature: sha256=<hex>` es el HMAC-SHA256, con el
secreto del cliente, de `"<X-Webhook-Timestamp>.<cuerpo exacto>"`. Incluir el
timestamp permite al receptor rechazar una petición vieja reenviada por un
tercero; el secreto nunca viaja.

**Hacia dónde.** Solo https y solo a direcciones públicas, salvo que el
despliegue lo abra (ver `WEBHOOK_PERMITIR_*` en config). No se siguen
redirecciones: una redirección a una dirección interna saltaría la validación.
"""

import hashlib
import hmac
import ipaddress
import json
import logging
import math
import socket
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from urllib.parse import urlsplit

import requests
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.crypto import descifrar
from app.core.database import sesion_tenant
from app.models.audiencia import Audiencia
from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.jurisdiccion import Jurisdiccion
from app.models.maestra.cliente import Cliente
from app.models.maestra.configuracion_webhook import ConfiguracionWebhook
from app.models.movimiento import Movimiento
from app.models.webhook_envio import WebhookEnvio

logger = logging.getLogger(__name__)

EVENTOS = {
    WebhookEnvio.TIPO_ESTADO_DIARIO: "estado_diario.importado",
    WebhookEnvio.TIPO_MOVIMIENTOS: "movimientos.importado",
    WebhookEnvio.TIPO_AUDIENCIAS: "audiencias.importado",
    WebhookEnvio.TIPO_PRUEBA: "webhook.prueba",
}

# De `estado_diario_origen.tipo` al tipo de envío. La cartera de causas no está.
_TIPO_DE_ORIGEN = {
    EstadoDiarioOrigen.TIPO_ESTADO_DIARIO: WebhookEnvio.TIPO_ESTADO_DIARIO,
    EstadoDiarioOrigen.TIPO_MOVIMIENTOS: WebhookEnvio.TIPO_MOVIMIENTOS,
    EstadoDiarioOrigen.TIPO_AUDIENCIAS: WebhookEnvio.TIPO_AUDIENCIAS,
}

# Qué se expone de cada fila. **Es el contrato con el receptor**, por eso es una
# lista explícita y no `__table__.columns`: una columna nueva en el modelo no
# debe aparecer sola en el sistema de un tercero. Tampoco van los campos de
# trabajo interno del estudio (leído, pendiente, asistencia, Google).
_MODELO_Y_CAMPOS = {
    WebhookEnvio.TIPO_ESTADO_DIARIO: (
        EstadoDiario,
        ("rol", "rol_unico", "fecha_ingreso", "caratulado", "tribunal", "estado",
         "tipo_causa", "ubicacion", "fecha_ubicacion", "corte"),
    ),
    WebhookEnvio.TIPO_MOVIMIENTOS: (
        Movimiento,
        ("materia", "rol", "era", "tribunal", "corte", "caratulado", "fecha_ingreso",
         "estado_causa", "institucion", "ubicacion", "fecha_ubicacion"),
    ),
    WebhookEnvio.TIPO_AUDIENCIAS: (
        Audiencia,
        ("materia", "rol", "ruc", "caratulado", "tribunal", "sala", "tipo_audiencia",
         "juez", "estado", "fecha_audiencia", "hora", "clave_natural"),
    ),
}

# Espera antes del reintento N (el primero es inmediato). La última se repite.
# Como el despachador corre con el job de correo (~15 min), las esperas cortas
# valen en la práctica lo que dure esa cadencia.
ESPERAS = (
    timedelta(minutes=1),
    timedelta(minutes=5),
    timedelta(minutes=30),
    timedelta(hours=2),
    timedelta(hours=6),
)
# Mientras se entrega una fila queda "alquilada" por este tiempo: si el proceso
# muere a mitad de camino, pasado el plazo otro despachador la retoma.
_ALQUILER = timedelta(minutes=10)
_MAX_ERROR = 500


class ErrorDestino(Exception):
    """La URL no es un destino permitido."""


class _ArchivoInexistente(Exception):
    """El archivo importado ya no está: no hay nada que enviar, ni reintentar."""


# ── Destino ───────────────────────────────────────────────


def _resolver(host: str) -> list[str]:
    try:
        return sorted({info[4][0] for info in socket.getaddrinfo(host, None)})
    except socket.gaierror as e:
        raise ErrorDestino(f"No se pudo resolver el host '{host}'") from e


def validar_url(url: str) -> str:
    """Devuelve la URL limpia si se puede usar como destino; si no, lanza
    `ErrorDestino` con un mensaje que se le puede mostrar al administrador.

    Se llama al guardar la configuración **y otra vez antes de cada envío**: el
    DNS de un host puede empezar a apuntar a una dirección interna después de
    haberlo aprobado. No elimina del todo la carrera entre esta resolución y la
    de `requests`, pero cierra el caso de un dominio que cambia con los días.
    """
    url = (url or "").strip()
    partes = urlsplit(url)

    if partes.scheme not in ("https", "http"):
        raise ErrorDestino("La URL debe empezar con https://")
    if partes.scheme == "http" and not settings.WEBHOOK_PERMITIR_HTTP:
        raise ErrorDestino("Solo se permiten URLs https://")
    if not partes.hostname:
        raise ErrorDestino("La URL no tiene host")
    if partes.username or partes.password:
        # Credenciales en la URL acaban en logs y en el historial de quien la mire.
        raise ErrorDestino("La URL no puede llevar usuario ni contraseña")

    if not settings.WEBHOOK_PERMITIR_REDES_PRIVADAS:
        for ip in _resolver(partes.hostname):
            if not ipaddress.ip_address(ip).is_global:
                raise ErrorDestino(
                    "La URL apunta a una dirección que no es pública "
                    "(red interna, localhost o reservada)"
                )
    return url


# ── Firma y envío ─────────────────────────────────────────


def firmar(secreto: str, timestamp: int, cuerpo: bytes) -> str:
    mensaje = f"{timestamp}.".encode("utf-8") + cuerpo
    digest = hmac.new(secreto.encode("utf-8"), mensaje, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def generar_secreto() -> str:
    return "whsec_" + uuid.uuid4().hex + uuid.uuid4().hex


def _json(valor):
    if isinstance(valor, (datetime, date, time)):
        return valor.isoformat()
    raise TypeError(f"No serializable: {type(valor)!r}")


def _post(
    url: str,
    secreto: str,
    evento: str,
    evento_id: str,
    lote: int,
    total_lotes: int,
    cuerpo: bytes,
) -> int:
    """Hace la petición y devuelve el status HTTP. Las excepciones de red suben."""
    timestamp = int(datetime.now(timezone.utc).timestamp())
    respuesta = requests.post(
        url,
        data=cuerpo,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "EstadoDiario-Webhook/1",
            "X-Webhook-Evento": evento,
            "X-Webhook-Id": evento_id,
            "X-Webhook-Lote": f"{lote}/{total_lotes}",
            "X-Webhook-Timestamp": str(timestamp),
            "X-Webhook-Signature": firmar(secreto, timestamp, cuerpo),
        },
        timeout=settings.WEBHOOK_TIMEOUT_SEGUNDOS,
        # Ver el docstring del módulo: una redirección saltaría `validar_url`.
        allow_redirects=False,
    )
    return respuesta.status_code


def _host(url: str) -> str:
    """Para el log y los mensajes: la URL completa puede llevar un token en el
    query string."""
    return urlsplit(url).hostname or "?"


# ── Configuración ─────────────────────────────────────────


def obtener_configuracion(db_maestra: Session, cliente_id: int) -> Optional[ConfiguracionWebhook]:
    return (
        db_maestra.query(ConfiguracionWebhook)
        .filter(ConfiguracionWebhook.cliente_id == cliente_id)
        .first()
    )


def _corresponde(config: Optional[ConfiguracionWebhook], tipo: str) -> bool:
    if config is None or not config.activo or not config.url or not config.secreto_cifrado:
        return False
    if tipo == WebhookEnvio.TIPO_ESTADO_DIARIO:
        return config.enviar_estado_diario
    if tipo == WebhookEnvio.TIPO_MOVIMIENTOS:
        return config.enviar_movimientos
    if tipo == WebhookEnvio.TIPO_AUDIENCIAS:
        return config.enviar_audiencias
    return False


# ── Cola ──────────────────────────────────────────────────


def _contar_filas(db: Session, tipo: str, origen_id: int) -> int:
    modelo, _ = _MODELO_Y_CAMPOS[tipo]
    return (
        db.query(func.count(modelo.id))
        .filter(modelo.estado_diario_origen_id == origen_id)
        .scalar()
        or 0
    )


def encolar(
    db_tenant: Session, tipo_origen: str, origen_id: int, tamano_lote: Optional[int] = None
) -> int:
    """Anota las entregas de un archivo ya importado. Devuelve cuántas creó.

    No habla con nadie: solo escribe filas `pendiente`. Un archivo sin filas no
    genera nada (un aviso vacío no le sirve al receptor).
    """
    tipo = _TIPO_DE_ORIGEN.get(tipo_origen)
    if tipo is None or origen_id is None:
        return 0

    total = _contar_filas(db_tenant, tipo, origen_id)
    if total == 0:
        return 0

    tamano = max(1, tamano_lote or settings.WEBHOOK_TAMANO_LOTE)
    lotes = math.ceil(total / tamano)
    evento_id = str(uuid.uuid4())
    ahora = datetime.now(timezone.utc)
    for n in range(1, lotes + 1):
        db_tenant.add(
            WebhookEnvio(
                evento_id=evento_id,
                tipo=tipo,
                origen_id=origen_id,
                lote=n,
                total_lotes=lotes,
                total_registros=total,
                estado=WebhookEnvio.ESTADO_PENDIENTE,
                proximo_intento=ahora,
            )
        )
    db_tenant.commit()
    return lotes


def avisar_importacion(
    db_tenant: Session,
    db_maestra: Session,
    cliente_id: int,
    tipo_origen: str,
    origen_id: Optional[int],
) -> int:
    """Lo que llama la ingesta al terminar de importar un archivo.

    **Nunca lanza.** Si el aviso falla, el archivo ya está importado y eso es lo
    que importa: lo peor que puede pasar acá es que no se anote la entrega, y
    queda el error en el log.
    """
    try:
        tipo = _TIPO_DE_ORIGEN.get(tipo_origen)
        if tipo is None:
            return 0
        if not _corresponde(obtener_configuracion(db_maestra, cliente_id), tipo):
            return 0
        return encolar(db_tenant, tipo_origen, origen_id)
    except Exception:  # noqa: BLE001 — ver el docstring
        db_tenant.rollback()
        logger.exception(
            "Webhook: no se pudo anotar el aviso del archivo %s (cliente %s)",
            origen_id, cliente_id,
        )
        return 0


# ── Contenido ─────────────────────────────────────────────


def _registros(db: Session, tipo: str, origen_id: int, lote: int, tamano: int) -> list[dict]:
    modelo, campos = _MODELO_Y_CAMPOS[tipo]
    filas = (
        db.query(modelo)
        .filter(modelo.estado_diario_origen_id == origen_id)
        .order_by(modelo.id)
        .offset((lote - 1) * tamano)
        .limit(tamano)
        .all()
    )
    jurisdicciones = {j.id: j.nombre for j in db.query(Jurisdiccion).all()}
    return [
        {
            "id": f.id,
            "jurisdiccion": jurisdicciones.get(f.jurisdiccion_id),
            **{c: getattr(f, c) for c in campos},
        }
        for f in filas
    ]


def construir_cuerpo(
    db_tenant: Session, cliente: Cliente, envio: WebhookEnvio, tamano_lote: Optional[int] = None
) -> bytes:
    """El JSON que se envía, armado con lo que hay ahora en la base."""
    origen = db_tenant.get(EstadoDiarioOrigen, envio.origen_id) if envio.origen_id else None
    if origen is None:
        raise _ArchivoInexistente("El archivo importado ya no existe")

    tamano = max(1, tamano_lote or settings.WEBHOOK_TAMANO_LOTE)
    cuerpo = {
        "evento": EVENTOS[envio.tipo],
        "evento_id": envio.evento_id,
        "enviado_en": datetime.now(timezone.utc),
        "cliente": {"guid": cliente.guid, "nombre": cliente.nombre},
        "archivo": {
            "origen_id": origen.id,
            "tipo": origen.tipo,
            "nombre": origen.nombre_archivo,
            "rut": origen.rut,
            "fecha": origen.fecha,
            "fecha_carga": origen.fecha_carga,
        },
        "lote": envio.lote,
        "total_lotes": envio.total_lotes,
        "total_registros": envio.total_registros,
        "registros": _registros(db_tenant, envio.tipo, origen.id, envio.lote, tamano),
    }
    return json.dumps(cuerpo, default=_json, ensure_ascii=False).encode("utf-8")


# ── Despacho ──────────────────────────────────────────────


def _espera(intentos: int) -> timedelta:
    return ESPERAS[min(max(intentos, 1), len(ESPERAS)) - 1]


def _reclamar(db: Session, envio_id: int, ahora: datetime) -> bool:
    """Se queda con la fila o dice que otro ya lo hizo.

    Corre `proximo_intento` hacia adelante con un UPDATE condicionado, que es
    atómico: de dos despachadores simultáneos (el job y el botón "revisar
    ahora") solo uno ve `rowcount == 1`. Sin esto, cada entrega se haría dos
    veces. No hace falta un estado "enviando": el alquiler vence solo.
    """
    resultado = db.execute(
        text(
            "UPDATE webhook_envio SET proximo_intento = :hasta "
            "WHERE id = :id AND estado = :pendiente AND proximo_intento <= :ahora"
        ),
        {
            "hasta": ahora + _ALQUILER,
            "id": envio_id,
            "pendiente": WebhookEnvio.ESTADO_PENDIENTE,
            "ahora": ahora,
        },
    )
    db.commit()
    return resultado.rowcount == 1


def _entregar(
    db_tenant: Session, cliente: Cliente, config: ConfiguracionWebhook, secreto: str,
    envio: WebhookEnvio,
) -> bool:
    """Un intento. Deja la fila en su nuevo estado y devuelve si se entregó."""
    ahora = datetime.now(timezone.utc)
    envio.intentos += 1
    status: Optional[int] = None
    error: Optional[str] = None
    definitivo = False

    try:
        cuerpo = construir_cuerpo(db_tenant, cliente, envio)
        validar_url(config.url)
        status = _post(
            config.url, secreto, EVENTOS[envio.tipo], envio.evento_id,
            envio.lote, envio.total_lotes, cuerpo,
        )
        if not 200 <= status < 300:
            error = f"El receptor respondió HTTP {status}"
    except _ArchivoInexistente as e:
        error, definitivo = str(e), True
    except ErrorDestino as e:
        error = str(e)
    except requests.exceptions.RequestException as e:
        # El texto de la excepción de requests incluye la URL completa, que
        # puede llevar un token: se deja solo la clase y el host.
        error = f"{type(e).__name__} al conectar con {_host(config.url)}"
    except Exception as e:  # noqa: BLE001 — una fila mala no detiene a las demás
        logger.exception("Webhook: fallo inesperado entregando el envío %s", envio.id)
        error = f"Error interno: {type(e).__name__}"

    envio.ultimo_status_http = status
    if error is None:
        envio.estado = WebhookEnvio.ESTADO_ENVIADO
        envio.fecha_envio = ahora
        envio.ultimo_error = None
    else:
        envio.ultimo_error = error[:_MAX_ERROR]
        if definitivo or envio.intentos >= settings.WEBHOOK_MAX_INTENTOS:
            envio.estado = WebhookEnvio.ESTADO_FALLIDO
            logger.warning(
                "Webhook: envío %s del cliente %s agotado (%s)", envio.id, cliente.guid, error
            )
        else:
            envio.proximo_intento = ahora + _espera(envio.intentos)
    db_tenant.commit()
    return error is None


def despachar(
    db_tenant: Session,
    db_maestra: Session,
    cliente: Cliente,
    limite: Optional[int] = None,
) -> dict:
    """Entrega lo pendiente que ya toca, hasta `limite` filas por pasada.

    No lanza por un receptor caído: cada fila registra su propio error. Sí
    devuelve `{"enviados", "con_error", "fallidos"}` para el log del job.
    """
    resumen = {"enviados": 0, "con_error": 0, "fallidos": 0}
    config = obtener_configuracion(db_maestra, cliente.cliente_id)
    if config is None or not config.activo or not config.url or not config.secreto_cifrado:
        return resumen

    try:
        secreto = descifrar(config.secreto_cifrado)
    except ValueError:
        logger.error(
            "Webhook: no se pudo descifrar el secreto del cliente %s; genere uno nuevo",
            cliente.guid,
        )
        return resumen

    ahora = datetime.now(timezone.utc)
    ids = [
        fila[0]
        for fila in db_tenant.query(WebhookEnvio.id)
        .filter(
            WebhookEnvio.estado == WebhookEnvio.ESTADO_PENDIENTE,
            WebhookEnvio.proximo_intento <= ahora,
        )
        .order_by(WebhookEnvio.id)
        .limit(limite or settings.WEBHOOK_MAX_ENVIOS_POR_PASADA)
        .all()
    ]

    ultimo_error: Optional[str] = None
    for envio_id in ids:
        if not _reclamar(db_tenant, envio_id, ahora):
            continue
        envio = db_tenant.get(WebhookEnvio, envio_id)
        db_tenant.refresh(envio)
        if _entregar(db_tenant, cliente, config, secreto, envio):
            resumen["enviados"] += 1
        else:
            resumen["con_error"] += 1
            ultimo_error = envio.ultimo_error

    if ids:
        resumen["fallidos"] = (
            db_tenant.query(func.count(WebhookEnvio.id))
            .filter(WebhookEnvio.estado == WebhookEnvio.ESTADO_FALLIDO)
            .scalar()
            or 0
        )
        config.ultimo_envio = datetime.now(timezone.utc)
        config.ultimo_resultado = (
            f"{resumen['enviados']} enviados, {resumen['con_error']} con error"
            + (f": {ultimo_error}" if ultimo_error else "")
        )[:_MAX_ERROR]
        config.fallidos = resumen["fallidos"]
        db_maestra.commit()
    return resumen


def despachar_todos(db_maestra: Session) -> dict:
    """Una pasada sobre todos los clientes con webhook activo. La usa el job de
    correo para reintentar lo pendiente aunque esa casilla no toque revisarse."""
    total = {"clientes": 0, "enviados": 0, "con_error": 0}
    configs = (
        db_maestra.query(ConfiguracionWebhook)
        .filter(ConfiguracionWebhook.activo.is_(True), ConfiguracionWebhook.url.isnot(None))
        .all()
    )
    for config in configs:
        cliente = db_maestra.get(Cliente, config.cliente_id)
        if (
            cliente is None
            or not cliente.activo
            or cliente.estado_aprovisionamiento != Cliente.APROV_LISTO
        ):
            continue
        # Un cliente con la base caída no puede frenar a los demás.
        try:
            with sesion_tenant(cliente.guid) as db_tenant:
                r = despachar(db_tenant, db_maestra, cliente)
            total["clientes"] += 1
            total["enviados"] += r["enviados"]
            total["con_error"] += r["con_error"]
        except Exception:  # noqa: BLE001
            logger.exception("Webhook: falló el despacho del cliente %s", cliente.guid)
    return total


# ── Operaciones de la consola ─────────────────────────────


def reencolar_fallidos(db_tenant: Session, envio_id: Optional[int] = None) -> int:
    """Devuelve a `pendiente` lo que agotó sus intentos (todo, o solo `envio_id`)."""
    consulta = db_tenant.query(WebhookEnvio).filter(
        WebhookEnvio.estado == WebhookEnvio.ESTADO_FALLIDO
    )
    if envio_id is not None:
        consulta = consulta.filter(WebhookEnvio.id == envio_id)
    filas = consulta.all()
    ahora = datetime.now(timezone.utc)
    for f in filas:
        f.estado = WebhookEnvio.ESTADO_PENDIENTE
        f.intentos = 0
        f.proximo_intento = ahora
        f.ultimo_error = None
    db_tenant.commit()
    return len(filas)


def enviar_prueba(config: ConfiguracionWebhook, cliente: Cliente) -> dict:
    """Manda un evento `webhook.prueba` ya, sin pasar por la cola.

    Sirve para comprobar URL, firma y conectividad antes de depender de ella.
    Devuelve `{"exito", "mensaje", "status_http"}`.
    """
    if not config.url or not config.secreto_cifrado:
        return {"exito": False, "mensaje": "Falta la URL o el secreto", "status_http": None}
    try:
        url = validar_url(config.url)
        evento_id = str(uuid.uuid4())
        cuerpo = json.dumps(
            {
                "evento": EVENTOS[WebhookEnvio.TIPO_PRUEBA],
                "evento_id": evento_id,
                "enviado_en": datetime.now(timezone.utc),
                "cliente": {"guid": cliente.guid, "nombre": cliente.nombre},
                "registros": [],
            },
            default=_json,
            ensure_ascii=False,
        ).encode("utf-8")
        status = _post(
            url, descifrar(config.secreto_cifrado), EVENTOS[WebhookEnvio.TIPO_PRUEBA],
            evento_id, 1, 1, cuerpo,
        )
    except ErrorDestino as e:
        return {"exito": False, "mensaje": str(e), "status_http": None}
    except ValueError:
        return {"exito": False, "mensaje": "No se pudo descifrar el secreto; genere uno nuevo",
                "status_http": None}
    except requests.exceptions.RequestException as e:
        return {
            "exito": False,
            "mensaje": f"{type(e).__name__} al conectar con {_host(config.url)}",
            "status_http": None,
        }
    if 200 <= status < 300:
        return {"exito": True, "mensaje": f"El receptor respondió HTTP {status}", "status_http": status}
    return {"exito": False, "mensaje": f"El receptor respondió HTTP {status}", "status_http": status}
