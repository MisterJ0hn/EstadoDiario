"""Espejo de api-pjud para sistemas externos (API key).

Un integrador que hoy consulta api-pjud directo cambia solo la URL base y el
header (`X-API-Key` en vez del `Authorization: Bearer` de api-pjud): las rutas, el
cuerpo y el JSON de respuesta son los del proveedor. La diferencia está atrás:
`consultar_*` se sirve de una copia guardada en la base del cliente (`PjudCopia`)
mientras esté vigente, así que leer no gasta una consulta de la suscripción
compartida ni depende de que api-pjud esté arriba.

    POST /pjud/consultar_<competencia>             cabecera de la causa
    POST /pjud/consultar_movimientos_<competencia> historia, litigantes, etc.
    POST /pjud/sincronizar_<competencia>           encola un scrape (responde job_id)
    GET  /pjud/public/<identificador>/<cuaderno>/<archivo>   documentos

Permisos: ver `CONSULTAS_PJUD_POR_POST` y `SINCRONIZAR_PJUD` en `app/core/api_key.py`.
"""

import json
import logging
import time
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.v1.endpoints.causas import (
    _registrar_llamado_pjud,
    requerir_pjud_habilitado,
    responder_documento_pjud,
)
from app.core.config import settings
from app.core.database import get_db_maestra
from app.core.deps import TenantContexto, get_db_tenant, get_tenant_actual, get_usuario_actual
from app.models.usuario import Usuario
from app.repositories.pjud_copia_repository import (
    PREFIJO_MOVIMIENTOS,
    PjudCopiaRepository,
    clave_de,
)
from app.repositories.pjud_sincronizacion_repository import (
    LISTO,
    PREFIJO_RESERVA,
    PjudSincronizacionRepository,
)
from app.core.credenciales_pjud import credenciales_del_dueno
from app.services.pjud_dueno_service import causa_asignada
from app.services.pjud_service import (
    _ESTADOS_SINCRONIZANDO,
    PjudApiError,
    PjudConflicto,
    PjudNoEncontrado,
    PjudService,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/pjud",
    tags=["PJUD (espejo de api-pjud)"],
    dependencies=[Depends(requerir_pjud_habilitado)],
)

# competencia → (materia como la guarda `pjud_sincronizacion`, ¿la cabecera trae
# `cuadernos`?). Sin cuadernos todavía, Civil/Cobranza/Penal siguen sincronizando
# (mismo criterio que `PjudService.obtener_detalle*`).
COMPETENCIAS = {
    "civil": ("Civil", True),
    "familia": ("Familia", False),
    "laboral": ("Laboral", False),
    "cobranza": ("Cobranza", True),
    "penal": ("Penal", True),
    "apelaciones": ("Apelaciones", False),
}

def _servicio() -> PjudService:
    try:
        return PjudService()
    except PjudApiError as e:
        raise HTTPException(status_code=502, detail=str(e))


def _error_http(e: PjudApiError) -> HTTPException:
    if isinstance(e, PjudNoEncontrado):
        # Igual que api-pjud: no tiene la causa. El integrador debe sincronizarla.
        return HTTPException(status_code=404, detail=str(e))
    if isinstance(e, PjudConflicto):
        return HTTPException(status_code=409, detail=str(e))
    return HTTPException(status_code=502, detail=str(e))


def _cabecera(datos: Any) -> dict:
    """La causa dentro de la respuesta de `consultar_<competencia>` (el proveedor la
    manda bajo `causa`; se tolera también en la raíz)."""
    if isinstance(datos, dict):
        interno = datos.get("causa", datos)
        if isinstance(interno, dict):
            return interno
    return {}


def _es_terminal(competencia: str, datos: Any) -> bool:
    """¿Vale la pena guardar esta cabecera? No mientras api-pjud siga sincronizando,
    o (Civil/Cobranza/Penal) mientras no traiga cuadernos: sería guardar una foto a
    medias que taparía el avance real durante todo el TTL."""
    causa = _cabecera(datos)
    estado = (causa.get("estado") or "").strip().lower()
    if estado in _ESTADOS_SINCRONIZANDO:
        return False
    if COMPETENCIAS[competencia][1] and not causa.get("cuadernos"):
        return False
    return True


def _credenciales_del_dueno(db: Session, causa) -> Optional[dict]:
    if causa is None:
        return None
    try:
        return credenciales_del_dueno(db, causa)
    except Exception:
        logger.exception("No se pudieron leer las credenciales del abogado asignado")
        db.rollback()
        return None


def _con_abogado_asignado(
    db: Session, servicio, competencia: str, cuerpo: dict, causa=None
) -> dict:
    """El cuerpo a reenviar: si la causa tiene abogado asignado con su clave del OJV
    cargada, se usan SUS credenciales aunque el integrador mande otras; las del
    integrador solo valen cuando no hay dueño (o no se puede saber cuál es).
    `causa` es la ya resuelta con `causa_asignada` (se resuelve acá si no se pasa)."""
    if causa is None:
        causa = causa_asignada(db, servicio, competencia, cuerpo)
    credenciales = _credenciales_del_dueno(db, causa)
    if credenciales is None:
        return cuerpo
    logger.info("Espejo PJUD %s: se usan las credenciales del abogado asignado", competencia)
    return {**cuerpo, **credenciales}


def _json(texto: str) -> Response:
    return Response(
        content=PjudService.reescribir_documentos(texto), media_type="application/json"
    )


def _completar_si_ya_termino(
    competencia: str, cuerpo: dict, datos: Any, causa, db_maestra, tenant
) -> None:
    """Si el callback ya cerró el último sync de la causa como `listo`, pero api-pjud
    todavía la muestra "Sincronizando" (va rezagado respecto de su propio aviso, o
    sigue con otros jobs de la misma causa), la cabecera se entrega "Completo". La
    integración espera ese valor y, si recibe "Sincronizando", vuelve a sincronizar.
    Un sync más nuevo, en curso o con error, no se toca. Nunca revienta."""
    interno = _cabecera(datos)
    if (interno.get("estado") or "").strip().lower() not in _ESTADOS_SINCRONIZANDO:
        return
    try:
        rol, tribunal = _identidad(competencia, cuerpo)
        ultimo = PjudSincronizacionRepository(db_maestra).ultimo_de(
            cliente_id=tenant.cliente_id, materia=COMPETENCIAS[competencia][0],
            causa_id=getattr(causa, "id", None), rol=rol, tribunal=tribunal,
        )
    except Exception:
        db_maestra.rollback()
        logger.exception("No se pudo leer pjud_sincronizacion")
        return
    if ultimo is not None and ultimo.estado == LISTO:
        interno["estado"] = "Completo"


def _consultar(
    ruta: str, competencia: str, cuerpo: dict, db: Session, db_maestra=None, tenant=None
) -> Response:
    copias = PjudCopiaRepository(db)
    clave = clave_de(cuerpo)
    ttl = settings.PJUD_COPIA_TTL_MIN
    es_movimientos = ruta.startswith(PREFIJO_MOVIMIENTOS)

    copia = copias.vigente(ruta, clave, ttl)
    if copia is not None:
        return _json(copia.respuesta)

    servicio = _servicio()
    try:
        # Los movimientos solo traen `identificador`: no hay de dónde sacar al dueño.
        causa = None if es_movimientos else causa_asignada(db, servicio, competencia, cuerpo)
        envio = cuerpo if es_movimientos else _con_abogado_asignado(db, servicio, competencia, cuerpo, causa)
        datos = servicio.reenviar(ruta, envio)
    except PjudApiError as e:
        raise _error_http(e)

    if not es_movimientos and db_maestra is not None and tenant is not None:
        _completar_si_ya_termino(competencia, cuerpo, datos, causa, db_maestra, tenant)
    texto = json.dumps(datos, ensure_ascii=False)
    if es_movimientos:
        identificador = str(cuerpo.get("identificador") or "") or None
        guardar = identificador is not None and copias.cabecera_vigente(identificador, ttl)
    else:
        identificador = str(_cabecera(datos).get("identificador") or "") or None
        guardar = _es_terminal(competencia, datos)
    if guardar:
        copias.guardar(ruta, clave, identificador, texto)
    return _json(texto)


def _identidad(competencia: str, cuerpo: dict) -> tuple[Optional[str], Optional[str]]:
    """(rol, tribunal) con que se registra el job: completos (`C-1234-2026`,
    `90/276`) para distinguir causas con el mismo número en otro año o tribunal."""
    partes = [str(cuerpo.get(k) or "").strip() for k in ("tipo", "rol", "anio")]
    rol = "-".join(p for p in partes if p)[:50] or None
    tribunal = "/".join(str(cuerpo.get(k) if cuerpo.get(k) is not None else "") for k in ("corte", "tribunal"))
    return rol, tribunal[:255] if tribunal != "/" else None


def _soltar(jobs: PjudSincronizacionRepository, db_maestra: Session, reserva) -> None:
    """Devuelve el cupo reservado cuando el envío no llegó a ser un job. Nunca revienta."""
    if reserva is None:
        return
    try:
        jobs.liberar(reserva)
    except Exception:
        db_maestra.rollback()
        logger.exception("No se pudo soltar la reserva de sync (vence sola)")


def _encolar(
    competencia: str, cuerpo: dict, db: Session, db_maestra: Session, tenant: TenantContexto,
    nota: dict,
) -> dict:
    """Hace el sync y deja en `nota` lo que pasó, para el log de `pjud_llamado`."""
    servicio = _servicio()
    materia = COMPETENCIAS[competencia][0]
    rol, tribunal = _identidad(competencia, cuerpo)
    causa = causa_asignada(db, servicio, competencia, cuerpo)
    causa_id = getattr(causa, "id", None)
    nota["causa_id"] = causa_id
    jobs = PjudSincronizacionRepository(db_maestra)

    # Un sync ya en curso de esta causa (lo pidió el integrador, o la app) no se repite:
    # cada envío es otra sesión en el OJV con la misma clave, y varias a la vez terminan
    # bloqueadas por "múltiples conexiones", además de un callback por cada una.
    # El cupo se reserva ANTES de llamar a api-pjud: si se registrara al volver, una
    # ráfaga de la misma causa pasaría entera el chequeo.
    # Si el último sync de la causa terminó bien hace poco, tampoco se reenvía: la
    # integración que repite `sincronizar_*` cada pocos segundos nunca se entera de que
    # ya terminó (el callback es nuestro, no suyo) y cada repetición abriría otro job
    # y otro callback. Se le responde que la causa está lista y que consulte.
    try:
        ultimo = jobs.ultimo_de(
            cliente_id=tenant.cliente_id, materia=materia, causa_id=causa_id,
            rol=rol, tribunal=tribunal,
        )
    except Exception:
        db_maestra.rollback()
        logger.exception("No se pudo leer pjud_sincronizacion")
        ultimo = None
    if ultimo is not None and jobs.enfriando(ultimo):
        logger.info("Espejo PJUD %s: sync ya terminado (job %s), no se reenvía", competencia, ultimo.job_id)
        nota.update(
            resultado="listo", http_status=200,
            diagnostico=f"ya terminado job_id={ultimo.job_id}; no se reenvió",
        )
        return {
            "job_id": ultimo.job_id,
            "estado": "listo",
            "ya_en_curso": False,
            "ya_sincronizada": True,
            "mensaje": "La sincronización de esta causa ya terminó; no se envió otra. "
            f"Consulta la causa con consultar_{competencia}.",
        }

    reserva = None
    try:
        previo, nueva = jobs.reservar(
            cliente_id=tenant.cliente_id, causa_id=causa_id,
            materia=materia, rol=rol, tribunal=tribunal,
        )
        if nueva:
            reserva, previo = previo, None
    except Exception:
        db_maestra.rollback()
        logger.exception("No se pudo reservar el sync en pjud_sincronizacion")
        previo = None
    if previo is not None:
        logger.info("Espejo PJUD %s: sync ya en curso (job %s), no se reenvía", competencia, previo.job_id)
        nota.update(resultado="ya_en_curso", http_status=200, diagnostico=f"ya en curso job_id={previo.job_id}; no se reenvió")
        # Se le avisa a la integración que ya hay una sincronización en proceso de esta
        # causa y que no se envió otra. Si el primer envío aún no tiene `job_id` real
        # (api-pjud no ha respondido), no se le entrega el provisorio.
        real = not previo.job_id.startswith(PREFIJO_RESERVA)
        return {
            "job_id": previo.job_id if real else None,
            "estado": "sincronizando",
            "ya_en_curso": True,
            "mensaje": "Ya hay una sincronización en proceso de esta causa; no se envió otra. "
            "Espera a que termine para volver a sincronizar.",
        }

    # El callback es siempre el nuestro (cierra el job en `pjud_sincronizacion`):
    # el que mande el sistema externo se ignora.
    envio = {
        **_con_abogado_asignado(db, servicio, competencia, cuerpo, causa),
        "callback_url": servicio.callback_url(),
    }
    nota["con_clave_del_abogado"] = envio.get("rut") != cuerpo.get("rut") or envio.get("clave") != cuerpo.get("clave")
    try:
        respuesta = servicio.reenviar(f"/sincronizar_{competencia}", envio)
    except BaseException as e:
        _soltar(jobs, db_maestra, reserva)
        if not isinstance(e, PjudApiError):
            raise
        nota.update(
            resultado="error", http_status=409 if isinstance(e, PjudConflicto) else 502,
            mensaje=str(e), diagnostico=f"el proveedor respondió: {e}",
        )
        raise _error_http(e)

    # La copia de esta causa ya no sirve: la siguiente consulta trae lo nuevo.
    PjudCopiaRepository(db).borrar_de_causa(f"/consultar_{competencia}", clave_de(cuerpo))

    job_id = str((respuesta or {}).get("job_id") or "").strip() if isinstance(respuesta, dict) else ""
    if job_id:
        try:
            if reserva is not None:
                jobs.confirmar(reserva, job_id)
            else:  # la reserva falló arriba: se registra como antes
                jobs.registrar(
                    job_id=job_id,
                    cliente_id=tenant.cliente_id,
                    causa_id=causa_id,
                    materia=materia,
                    rol=rol,
                    tribunal=tribunal,
                )
        except Exception:
            db_maestra.rollback()
            logger.exception("No se pudo guardar el job %s de api-pjud", job_id)
    else:
        _soltar(jobs, db_maestra, reserva)  # sin job_id no habrá callback que la cierre
    nota.update(
        resultado="sincronizando", http_status=200,
        diagnostico=f"encolado job_id={job_id or '(sin job_id)'}"
        + (" con la clave del abogado asignado" if nota["con_clave_del_abogado"] else " con las credenciales del integrador"),
    )
    return respuesta


def _sincronizar(
    competencia: str, cuerpo: dict, db: Session, db_maestra: Session, tenant: TenantContexto
) -> dict:
    """Cada llamado queda en `pjud_llamado` (la consola lo muestra), también los que
    el dedupe frena y los que el proveedor rechaza."""
    inicio = time.monotonic()
    rol, tribunal = _identidad(competencia, cuerpo)
    nota: dict = {"resultado": "error", "http_status": 500, "mensaje": None, "diagnostico": None, "causa_id": None}
    try:
        return _encolar(competencia, cuerpo, db, db_maestra, tenant, nota)
    finally:
        _registrar_llamado_pjud(
            db_maestra, tenant=tenant, causa_id=nota["causa_id"], rol=rol, tribunal=tribunal,
            materia=COMPETENCIAS[competencia][0], forzar=True, resultado=nota["resultado"],
            http_status=nota["http_status"], mensaje=nota["mensaje"],
            diagnostico="espejo " + (nota["diagnostico"] or "falló antes de llamar al proveedor"),
            duracion_ms=int((time.monotonic() - inicio) * 1000),
        )


def _registrar_rutas() -> None:
    """Una ruta por competencia y operación. Se generan en un bucle para que el
    espejo siga siendo el contrato del proveedor sin copiar doce funciones."""
    for competencia in COMPETENCIAS:
        _agregar_consultas(competencia)


def _agregar_consultas(competencia: str) -> None:
    cabecera = f"/consultar_{competencia}"
    movimientos = f"{PREFIJO_MOVIMIENTOS}{competencia}"

    def consultar(cuerpo: dict[str, Any] = Body(...), db: Session = Depends(get_db_tenant),
                  db_maestra: Session = Depends(get_db_maestra),
                  tenant: TenantContexto = Depends(get_tenant_actual),
                  usuario: Usuario = Depends(get_usuario_actual)):
        return _consultar(cabecera, competencia, cuerpo, db, db_maestra, tenant)

    def consultar_movimientos(cuerpo: dict[str, Any] = Body(...), db: Session = Depends(get_db_tenant),
                              usuario: Usuario = Depends(get_usuario_actual)):
        return _consultar(movimientos, competencia, cuerpo, db)

    def sincronizar(cuerpo: dict[str, Any] = Body(...), db: Session = Depends(get_db_tenant),
                    db_maestra: Session = Depends(get_db_maestra),
                    tenant: TenantContexto = Depends(get_tenant_actual),
                    usuario: Usuario = Depends(get_usuario_actual)):
        return _sincronizar(competencia, cuerpo, db, db_maestra, tenant)

    router.add_api_route(
        cabecera, consultar, methods=["POST"], response_class=Response,
        summary=f"Cabecera de una causa ({competencia}), igual que api-pjud",
    )
    router.add_api_route(
        movimientos, consultar_movimientos, methods=["POST"], response_class=Response,
        summary=f"Movimientos de una causa ({competencia}), igual que api-pjud",
    )
    router.add_api_route(
        f"/sincronizar_{competencia}", sincronizar, methods=["POST"], status_code=200,
        summary=f"Encola la sincronización de una causa ({competencia}), igual que api-pjud",
    )


_registrar_rutas()

# Competencias con catálogo de tribunales en api-pjud. Familia (se consulta con
# `corte: 0, tribunal: 0`) y Apelaciones (`corte` es el nombre) no tienen.
_CON_CATALOGO = ("civil", "laboral", "cobranza", "penal")


@router.get(
    "/catalogo/tribunales",
    summary="Cortes y tribunales (ids para `corte` y `tribunal`), igual que api-pjud",
)
def catalogo_tribunales(
    competencia: str,
    usuario: Usuario = Depends(get_usuario_actual),
):
    if competencia not in _CON_CATALOGO:
        # api-pjud responde 400 "Error en campo [competencia]" en estos casos.
        raise HTTPException(
            status_code=400,
            detail=f"Error en campo [competencia]: use una de {', '.join(_CON_CATALOGO)}",
        )
    try:
        return {"cortes": _servicio().catalogo_tribunales(competencia)}
    except PjudApiError as e:
        raise _error_http(e)


@router.get(
    "/public/{identificador}/{cuaderno}/{archivo:path}",
    summary="Documento de una causa (PDF/DOC), igual que api-pjud",
)
def documento(
    identificador: str,
    cuaderno: str,
    archivo: str,
    usuario: Usuario = Depends(get_usuario_actual),
):
    base = settings.PJUD_API_BASE_URL.rstrip("/")
    return responder_documento_pjud(f"{base}/public/{identificador}/{cuaderno}/{archivo}")
