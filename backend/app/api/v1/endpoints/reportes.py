"""Módulo **Reportes**: el usuario arma su reporte eligiendo campos, lo guarda
para reutilizarlo y lo recibe por correo en Excel. La tabla que los guarda
sigue llamándose `reporte_plantilla`.

La cuenta de correo de SALIDA no se configura acá: es única del sistema y la
administra `admin_api`. Este módulo solo la usa para despachar.
"""

import json
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.crypto import cifrar
from app.core.database import get_db_maestra
from app.core.deps import (
    TenantContexto,
    get_db_tenant,
    get_tenant_actual,
    get_usuario_actual,
)
from app.core.exceptions import NotFoundException
from app.models.reporte_plantilla import ReportePlantilla
from app.models.usuario import Usuario
from app.repositories.reporte_repository import ReporteRepository
from app.schemas.reporte import (
    CamposDisponiblesResponse,
    GenerarReporteResponse,
    OperacionResponse,
    ReportePlantillaListResponse,
    ReportePlantillaRequest,
    ReportePlantillaResponse,
)
from app.services.estado_diario_service import EstadoDiarioService
from app.services.reporte_service import ReporteService
from app.services.smtp_service import XLSX_MIME, SmtpService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reportes", tags=["Reportes"])


def _dueno_plantillas(current_user: Usuario):
    """Dueño de las PLANTILLAS de informe: cada quien ve las suyas.

    Esto **no** es un permiso sobre las causas —esas las ven todos los del
    estudio—. Una plantilla es un artefacto personal: el informe que alguien
    armó y programó, que a otro no le sirve. Por eso sigue acotada al dueño
    aunque ya no existan roles.
    """
    return current_user.id


# ── Catálogo de campos ────────────────────────────────────

@router.get(
    "/campos",
    response_model=CamposDisponiblesResponse,
    summary="Campos disponibles para armar un informe",
)
def campos_disponibles(_: Usuario = Depends(get_usuario_actual)):
    return CamposDisponiblesResponse(fuentes=ReporteService.campos_disponibles())


# ── Plantillas guardadas ──────────────────────────────────

@router.get(
    "",
    response_model=ReportePlantillaListResponse,
    summary="Listar los informes guardados del usuario",
)
def listar(
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    plantillas = ReporteRepository(db).find_by_usuario(_dueno_plantillas(current_user))
    return ReportePlantillaListResponse(
        total=len(plantillas),
        plantillas=[ReportePlantillaResponse.from_model(p) for p in plantillas],
    )


@router.post(
    "",
    response_model=ReportePlantillaResponse,
    summary="Guardar un informe para reutilizarlo",
)
def crear(
    datos: ReportePlantillaRequest,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    campos = ReporteService.validar(datos.fuente, datos.campos)
    plantilla = ReportePlantilla(
        usuario_id=current_user.id,
        nombre=datos.nombre.strip(),
        descripcion=datos.descripcion,
        fuente=datos.fuente,
        campos=json.dumps(campos),
        filtros=json.dumps(datos.filtros or {}),
    )
    return ReportePlantillaResponse.from_model(ReporteRepository(db).save(plantilla))


@router.get(
    "/{plantilla_id}",
    response_model=ReportePlantillaResponse,
    summary="Obtener un informe guardado",
)
def obtener(
    plantilla_id: int,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Va declarado DESPUÉS de /campos a propósito: FastAPI resuelve por orden
    de declaración y `/{plantilla_id}` capturaría esa ruta literal si fuera
    primero (devolviendo 422 al intentar leer "campos" como entero)."""
    plantilla = ReporteRepository(db).find_by_id(plantilla_id, _dueno_plantillas(current_user))
    if plantilla is None:
        raise NotFoundException("Informe no encontrado")
    return ReportePlantillaResponse.from_model(plantilla)


@router.put(
    "/{plantilla_id}",
    response_model=ReportePlantillaResponse,
    summary="Modificar un informe guardado",
)
def actualizar(
    plantilla_id: int,
    datos: ReportePlantillaRequest,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    repo = ReporteRepository(db)
    plantilla = repo.find_by_id(plantilla_id, _dueno_plantillas(current_user))
    if plantilla is None:
        raise NotFoundException("Informe no encontrado")

    campos = ReporteService.validar(datos.fuente, datos.campos)
    plantilla.nombre = datos.nombre.strip()
    plantilla.descripcion = datos.descripcion
    plantilla.fuente = datos.fuente
    plantilla.campos = json.dumps(campos)
    plantilla.filtros = json.dumps(datos.filtros or {})
    return ReportePlantillaResponse.from_model(repo.save(plantilla))


@router.delete("/{plantilla_id}", summary="Eliminar un informe guardado")
def eliminar(
    plantilla_id: int,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    repo = ReporteRepository(db)
    plantilla = repo.find_by_id(plantilla_id, _dueno_plantillas(current_user))
    if plantilla is None:
        raise NotFoundException("Informe no encontrado")
    repo.delete(plantilla)
    return {"exito": True}


# ── Generación ────────────────────────────────────────────

@router.post(
    "/{plantilla_id}/enviar",
    response_model=GenerarReporteResponse,
    summary="Generar el informe y enviarlo por correo al usuario",
)
def enviar(
    plantilla_id: int,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
    tenant: TenantContexto = Depends(get_tenant_actual),
):
    """Genera el Excel y lo despacha al correo del usuario autenticado.

    El destinatario NO se recibe por parámetro: siempre es el correo del
    usuario de la sesión. Aceptarlo del cliente convertiría el sistema en un
    relay para mandar datos de causas a cualquier dirección.
    """
    return GenerarReporteResponse(
        **ReporteService(db).generar_y_enviar(
            plantilla_id, current_user, tenant.cliente_id
        )
    )


@router.get(
    "/{plantilla_id}/descargar",
    summary="Descargar el informe directamente, sin pasar por correo",
)
def descargar(
    plantilla_id: int,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Alternativa al envío por correo, útil para revisar el informe antes de
    mandarlo y como salida cuando el SMTP no está configurado."""
    import io

    servicio = ReporteService(db)
    plantilla = ReporteRepository(db).find_by_id(
        plantilla_id, _dueno_plantillas(current_user)
    )
    if plantilla is None:
        raise NotFoundException("Informe no encontrado")

    contenido = servicio.generar_excel(plantilla)
    nombre = f"{plantilla.nombre.replace(' ', '_')}.xlsx"
    return StreamingResponse(
        io.BytesIO(contenido),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


# La configuración SMTP se administra en `admin_api`: es la cuenta de salida
# del SISTEMA (fila con `cliente_id` nulo), no de un estudio. Acá estaba
# protegida con `require_admin_cliente`, así que el administrador de cualquier
# estudio podía cambiarle la cuenta de correo a toda la plataforma.
#
# El envío de informes sigue usándola desde `SmtpService`; lo que se fue es
# poder editarla.

