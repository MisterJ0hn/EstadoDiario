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
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.v1.endpoints.causas import requerir_pjud_habilitado, responder_documento_pjud
from app.core.config import settings
from app.core.database import get_db_maestra
from app.core.deps import TenantContexto, get_db_tenant, get_tenant_actual, get_usuario_actual
from app.models.usuario import Usuario
from app.repositories.pjud_copia_repository import PREFIJO_MOVIMIENTOS, PjudCopiaRepository
from app.repositories.pjud_sincronizacion_repository import PjudSincronizacionRepository
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

# Campos del cuerpo que no identifican la causa: las credenciales del OJV y el
# callback (que siempre ponemos nosotros).
_CAMPOS_FUERA_DE_LA_CLAVE = ("rut", "clave", "metodo_login", "callback_url")


def clave_de(cuerpo: dict) -> str:
    """JSON canónico de la consulta sin credenciales: identifica la causa pedida."""
    util = {k: v for k, v in cuerpo.items() if k not in _CAMPOS_FUERA_DE_LA_CLAVE}
    return json.dumps(util, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


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


def _json(texto: str) -> Response:
    return Response(
        content=PjudService.reescribir_documentos(texto), media_type="application/json"
    )


def _consultar(ruta: str, competencia: str, cuerpo: dict, db: Session) -> Response:
    copias = PjudCopiaRepository(db)
    clave = clave_de(cuerpo)
    ttl = settings.PJUD_COPIA_TTL_MIN
    es_movimientos = ruta.startswith(PREFIJO_MOVIMIENTOS)

    copia = copias.vigente(ruta, clave, ttl)
    if copia is not None:
        return _json(copia.respuesta)

    try:
        datos = _servicio().reenviar(ruta, cuerpo)
    except PjudApiError as e:
        raise _error_http(e)

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


def _sincronizar(
    competencia: str, cuerpo: dict, db: Session, db_maestra: Session, tenant: TenantContexto
) -> dict:
    servicio = _servicio()
    # El callback es siempre el nuestro (cierra el job en `pjud_sincronizacion`):
    # el que mande el sistema externo se ignora.
    envio = {**cuerpo, "callback_url": servicio.callback_url()}
    try:
        respuesta = servicio.reenviar(f"/sincronizar_{competencia}", envio)
    except PjudApiError as e:
        raise _error_http(e)

    # La copia de esta causa ya no sirve: la siguiente consulta trae lo nuevo.
    PjudCopiaRepository(db).borrar_de_causa(f"/consultar_{competencia}", clave_de(cuerpo))

    job_id = str((respuesta or {}).get("job_id") or "").strip() if isinstance(respuesta, dict) else ""
    if job_id:
        try:
            PjudSincronizacionRepository(db_maestra).registrar(
                job_id=job_id,
                cliente_id=tenant.cliente_id,
                causa_id=None,
                materia=COMPETENCIAS[competencia][0],
                rol=str(cuerpo.get("rol") or "")[:50] or None,
                tribunal=str(cuerpo.get("tribunal") or "")[:255] or None,
            )
        except Exception:
            db_maestra.rollback()
            logger.exception("No se pudo guardar el job %s de api-pjud", job_id)
    return respuesta


def _registrar_rutas() -> None:
    """Una ruta por competencia y operación. Se generan en un bucle para que el
    espejo siga siendo el contrato del proveedor sin copiar doce funciones."""
    for competencia in COMPETENCIAS:
        _agregar_consultas(competencia)


def _agregar_consultas(competencia: str) -> None:
    cabecera = f"/consultar_{competencia}"
    movimientos = f"{PREFIJO_MOVIMIENTOS}{competencia}"

    def consultar(cuerpo: dict[str, Any] = Body(...), db: Session = Depends(get_db_tenant),
                  usuario: Usuario = Depends(get_usuario_actual)):
        return _consultar(cabecera, competencia, cuerpo, db)

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
