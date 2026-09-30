"""Acceso de sistemas externos a la API de un cliente, por API key.

Existe porque el login de personas exige reCAPTCHA (ver `app/core/recaptcha.py`)
y un servidor no puede producir ese token: lo acuña un navegador. En vez de
abrirle un hueco al login, el sistema externo entra por otra puerta, con su
propia credencial, y el login de las personas queda exactamente como estaba.

**Cómo entra.** La key viaja en `X-API-Key` en CADA request, sin sesión ni
token intermedio. Se eligió eso sobre "canjear la key por un JWT" porque así la
revocación es inmediata (un JWT de 30 minutos sigue valiendo media hora después
de revocar la key) y el límite de velocidad y la auditoría pueden ser por
request y no por canje.

`autenticar` la resuelve a la misma `(guid, cliente_id, usuario_id)` que hoy
sale de un JWT, y `get_tenant_actual` la devuelve igual: `get_db_tenant` y
`get_usuario_actual` no se enteran, y por eso todos los endpoints existentes
funcionan con key sin tocarlos. El tenant sale siempre de la fila `api_key`, de
la base principal; ningún header ni parámetro lo decide.

**Qué puede hacer una key** (deny por defecto, ver `motivo_de_denegacion`):

- Leer solo los módulos de `PREFIJOS_LECTURA`. Lo que no está ahí —auth,
  pagos, facturas, configuración, Google— queda cerrado aunque un endpoint
  nuevo se agregue mañana: una lista de lo permitido envejece mejor que una de
  lo prohibido.
- Escribir solo si la key tiene `permite_escritura` Y la ruta está en los
  prefijos de escritura (por defecto, `PREFIJOS_ESCRITURA_DEFECTO`: causas).

**Qué queda registrado.** Cada escritura, cada denegación y el primer exceso de
límite de cada minuto dejan una línea en la bitácora del cliente (`auth`,
`api_key_*`) con la IP y el prefijo de la key. Las lecturas no: serían una fila
por request y nadie las miraría; para saber si una key sigue en uso están
`ultimo_uso` y `ultimo_ip`. **La key en claro nunca se escribe en ningún lado.**
"""

import hashlib
import logging
import random
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.core.database import SesionMaestra, engine_maestro
from app.models.maestra.api_key import ApiKey
from app.models.maestra.cliente import Cliente
from app.services import auditoria_service as auditoria

logger = logging.getLogger(__name__)

# Visible al principio de toda key: permite reconocerla (y que un escáner de
# secretos la detecte si alguien la pega en un repositorio).
PREFIJO_KEY = "ed_"
# Cuántos caracteres de la key se guardan en claro para identificarla.
LARGO_PREFIJO_VISIBLE = 10

# Módulos que una key puede LEER. Son los datos operativos del estudio.
PREFIJOS_LECTURA = (
    "/api/v1/causas",
    "/api/v1/estado-diario",
    "/api/v1/movimientos",
    "/api/v1/audiencias",
    "/api/v1/reportes",
    "/api/v1/dashboard",
    "/api/v1/jurisdicciones",
)
# Dónde puede ESCRIBIR una key con `permite_escritura` y sin lista propia.
PREFIJOS_ESCRITURA_DEFECTO = ("/api/v1/causas",)

METODOS_DE_LECTURA = frozenset({"GET", "HEAD", "OPTIONS"})

# Una key con uso reciente no vuelve a escribir `ultimo_uso` hasta que pase esto.
_REFRESCO_ULTIMO_USO = timedelta(seconds=60)
# Probabilidad de purgar contadores viejos en cada ventana nueva: barato y sin
# necesitar un job. Con una key activa, ~1 purga cada 200 minutos.
_PROBABILIDAD_PURGA = 1 / 200
_RETENCION_CONTADORES = timedelta(hours=1)

# Mismo texto para key inexistente, revocada, vencida o de un cliente
# suspendido: distinguirlas le diría a quien prueba cuáles existieron.
MENSAJE_KEY_INVALIDA = "API key inválida"


@dataclass(frozen=True)
class IdentidadApiKey:
    """Lo que la key resuelve: a qué cliente y con qué usuario opera."""

    api_key_id: int
    prefijo: str
    guid: str
    cliente_id: int
    usuario_id: int


# ── Emisión ───────────────────────────────────────────────


def hash_key(key: str) -> str:
    """SHA-256 hexadecimal. Basta porque la key es aleatoria de 256 bits: no
    hay diccionario que atacar, que es para lo que sirven la sal y bcrypt."""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def generar_key() -> tuple[str, str, str]:
    """(key en claro, prefijo visible, hash). La key en claro se muestra UNA vez."""
    key = PREFIJO_KEY + secrets.token_urlsafe(32)
    return key, key[:LARGO_PREFIJO_VISIBLE], hash_key(key)


# ── Permisos ──────────────────────────────────────────────


def _bajo_prefijo(path: str, prefijos) -> bool:
    # Con el `/` de borde: "/api/v1/causas" no debe abrir "/api/v1/causasfoo".
    return any(path == p or path.startswith(p + "/") for p in prefijos)


def prefijos_de_escritura(api_key: ApiKey) -> tuple[str, ...]:
    if api_key.prefijos_escritura:
        lista = tuple(
            p.strip().rstrip("/") for p in api_key.prefijos_escritura.split(",") if p.strip()
        )
        if lista:
            return lista
    return PREFIJOS_ESCRITURA_DEFECTO


def motivo_de_denegacion(
    metodo: str,
    path: str,
    permite_escritura: bool,
    prefijos_escritura: tuple[str, ...] = PREFIJOS_ESCRITURA_DEFECTO,
) -> Optional[str]:
    """Por qué NO se permite la request, o `None` si se permite.

    Pura y sin base de datos a propósito: es la regla de seguridad del módulo y
    tiene que poder probarse caso por caso.
    """
    # Rutas con `..` o `//` no las produce ningún cliente honesto; se cortan
    # antes de comparar prefijos para no depender de cómo las normalice el
    # servidor de más adelante.
    if ".." in path or "//" in path:
        return "ruta_sospechosa"

    if metodo.upper() in METODOS_DE_LECTURA:
        if _bajo_prefijo(path, PREFIJOS_LECTURA):
            return None
        return "modulo_no_permitido"

    if not permite_escritura:
        return "key_solo_lectura"
    if not _bajo_prefijo(path, prefijos_escritura):
        return "escritura_no_permitida_en_la_ruta"
    return None


# ── Límite de velocidad ───────────────────────────────────


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _aware(valor: Optional[datetime]) -> Optional[datetime]:
    """Las fechas que vuelven de la base pueden venir sin zona: son UTC."""
    if valor is not None and valor.tzinfo is None:
        return valor.replace(tzinfo=timezone.utc)
    return valor


def _inicio_de_minuto(momento: datetime) -> datetime:
    return momento.replace(second=0, microsecond=0)


def _incrementar(api_key_id: int, ventana: datetime) -> int:
    """Suma 1 al contador de la ventana y devuelve el valor resultante.

    UPDATE primero, INSERT si no había fila, y vuelta al UPDATE si otro worker
    insertó en medio (`IntegrityError`). No es un `INSERT ... ON CONFLICT`
    porque producción corre PostgreSQL 9.2, que no lo tiene.
    """
    for _ in range(3):
        try:
            with engine_maestro.begin() as conn:
                fila = conn.execute(
                    text(
                        "UPDATE api_key_uso SET contador = contador + 1 "
                        "WHERE api_key_id = :k AND ventana = :v RETURNING contador"
                    ),
                    {"k": api_key_id, "v": ventana},
                ).first()
                if fila is not None:
                    return int(fila[0])
                conn.execute(
                    text(
                        "INSERT INTO api_key_uso (api_key_id, ventana, contador) "
                        "VALUES (:k, :v, 1)"
                    ),
                    {"k": api_key_id, "v": ventana},
                )
                return 1
        except IntegrityError:
            continue
    raise RuntimeError("No se pudo actualizar el contador de la API key")


def _purgar(ahora: datetime) -> None:
    with engine_maestro.begin() as conn:
        conn.execute(
            text("DELETE FROM api_key_uso WHERE ventana < :corte"),
            {"corte": ahora - _RETENCION_CONTADORES},
        )


def consumir_cupo(
    api_key_id: int, limite: int, ahora: Optional[datetime] = None
) -> tuple[bool, int, int]:
    """Cuenta una petición. Devuelve (dentro del límite, contador, segundos
    hasta que se abra la ventana siguiente).

    Ventana fija por minuto: es lo bastante exacto para proteger la API y no
    necesita más que una fila por minuto. El costo conocido es que alguien
    puede hacer `limite` peticiones al final de un minuto y otras `limite` al
    principio del siguiente.

    Si el contador falla (la base principal no responde), se DEJA PASAR y se
    deja ERROR en el log. Resolver la key ya exigió esa misma base, así que un
    fallo acá es casi siempre transitorio, y cerrar la puerta convertiría un
    parpadeo de la base en una caída del sistema externo.
    """
    ahora = ahora or _ahora()
    ventana = _inicio_de_minuto(ahora)
    segundos = max(1, int((ventana + timedelta(minutes=1) - ahora).total_seconds()) + 1)
    try:
        contador = _incrementar(api_key_id, ventana)
        if contador == 1 and random.random() < _PROBABILIDAD_PURGA:
            _purgar(ahora)
    except Exception:  # noqa: BLE001 — deliberado, ver el docstring
        logger.exception(
            "API key %s: no se pudo contar la petición; se DEJA PASAR sin límite", api_key_id
        )
        return True, 0, segundos
    return contador <= limite, contador, segundos


# ── Autenticación ─────────────────────────────────────────


def _registrar_uso(api_key_id: int, ip: Optional[str], ahora: datetime) -> None:
    """Deja `ultimo_uso` y `ultimo_ip`, a lo más una vez por minuto por key."""
    db = SesionMaestra()
    try:
        fila = db.get(ApiKey, api_key_id)
        if fila is None:
            return
        ultimo = _aware(fila.ultimo_uso)
        if ultimo is not None and ahora - ultimo < _REFRESCO_ULTIMO_USO and fila.ultimo_ip == ip:
            return
        fila.ultimo_uso = ahora
        fila.ultimo_ip = ip
        db.commit()
    except Exception as e:  # noqa: BLE001 — un dato informativo no tumba la request
        logger.warning("API key %s: no se pudo registrar el último uso: %s", api_key_id, e)
        db.rollback()
    finally:
        db.close()


def _auditar(identidad: IdentidadApiKey, accion: str, ip: Optional[str], detalle: str) -> None:
    auditoria.registrar_aparte(
        identidad.guid,
        auditoria.MODULO_AUTH,
        accion,
        usuario_id=identidad.usuario_id,
        ip=ip,
        detalle=f"{detalle} key={identidad.prefijo}",
    )


def _rechazar_key(motivo: str, ip: Optional[str], prefijo: Optional[str] = None) -> HTTPException:
    logger.warning(
        "API key rechazada (motivo=%s prefijo=%s ip=%s)", motivo, prefijo or "-", ip
    )
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=MENSAJE_KEY_INVALIDA)


def autenticar(
    key: str, metodo: str, path: str, ip: Optional[str] = None
) -> IdentidadApiKey:
    """Resuelve la key o corta la request con 401, 403 o 429.

    Orden deliberado: primero quién es, luego cuánto ha pedido, y recién
    entonces si tiene permiso para esto. El límite va antes del permiso para
    que una key que insiste con peticiones prohibidas también se frene.
    """
    ahora = _ahora()

    db = SesionMaestra()
    try:
        fila = db.query(ApiKey).filter(ApiKey.key_hash == hash_key(key)).first()
        if fila is None:
            # No se loguea ni un carácter de la key recibida: si fuera una key
            # real con un error de tipeo, sería una credencial en el log.
            raise _rechazar_key("desconocida", ip)

        if not fila.activa or fila.revocada_en is not None:
            raise _rechazar_key("revocada", ip, fila.prefijo)
        expira = _aware(fila.expira_en)
        if expira is not None and expira <= ahora:
            raise _rechazar_key("vencida", ip, fila.prefijo)

        cliente = db.get(Cliente, fila.cliente_id)
        if (
            cliente is None
            or not cliente.activo
            or cliente.estado_aprovisionamiento != Cliente.APROV_LISTO
        ):
            # Un cliente suspendido no entra por la puerta de las personas, ni
            # tampoco por esta.
            raise _rechazar_key("cliente_no_operativo", ip, fila.prefijo)

        identidad = IdentidadApiKey(
            api_key_id=fila.id,
            prefijo=fila.prefijo,
            guid=cliente.guid,
            cliente_id=cliente.cliente_id,
            usuario_id=fila.usuario_id,
        )
        limite = fila.limite_por_minuto
        permite_escritura = fila.permite_escritura
        prefijos = prefijos_de_escritura(fila)
    finally:
        db.close()

    dentro, contador, reintentar_en = consumir_cupo(identidad.api_key_id, limite, ahora)
    if not dentro:
        # Una línea por ventana, no por petición rechazada: de otro modo quien
        # se pasa del límite llenaría la bitácora del cliente.
        if contador == limite + 1:
            _auditar(
                identidad, auditoria.ACCION_API_KEY_LIMITE, ip,
                f"límite de {limite}/min superado",
            )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Límite de peticiones por minuto superado",
            headers={"Retry-After": str(reintentar_en)},
        )

    motivo = motivo_de_denegacion(metodo, path, permite_escritura, prefijos)
    if motivo is not None:
        _auditar(
            identidad, auditoria.ACCION_API_KEY_DENEGADO, ip, f"{metodo} {path} ({motivo})"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta API key no tiene permiso para este recurso",
        )

    if metodo.upper() not in METODOS_DE_LECTURA:
        # Antes del handler y no después: una escritura que falla a la mitad
        # también tiene que dejar rastro de quién la intentó.
        _auditar(identidad, auditoria.ACCION_API_KEY_ESCRITURA, ip, f"{metodo} {path}")

    _registrar_uso(identidad.api_key_id, ip, ahora)
    return identidad
