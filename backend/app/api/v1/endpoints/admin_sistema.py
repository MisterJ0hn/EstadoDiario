import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra
from app.core.deps import require_admin
from app.models.maestra.usuario_admin import UsuarioAdmin
from app.schemas.cliente import (
    AdminDashboard,
    ConfiguracionSistemaResponse,
    ConfiguracionSistemaUpdate,
    OperacionResponse,
)
from app.services.admin_dashboard_service import AdminDashboardService
from app.services.configuracion_sistema_service import ConfiguracionSistemaService

logger = logging.getLogger(__name__)

# Consola de administración del sistema: dashboard y parámetros de plataforma.
# Opera solo sobre la base PRINCIPAL (más una consulta de resumen por cliente).
router = APIRouter(
    prefix="/admin",
    tags=["Administración del sistema"],
    dependencies=[Depends(require_admin)],
)


@router.get(
    "/dashboard",
    response_model=AdminDashboard,
    summary="Resumen de la plataforma y estado de cada cliente",
)
def dashboard(
    dias: int = Query(30, ge=1, le=365, description="Ventana en días para los conteos"),
    db: Session = Depends(get_db_maestra),
):
    """KPIs de la plataforma y la tabla de clientes ordenada por **tiempo sin
    recibir archivos**: arriba el que nunca recibió nada, después el que lleva
    más días sin novedades. Es la pantalla para cachar al que se cayó.

    Consulta una vez la base de cada cliente, agregando en SQL. Con muchos
    clientes tarda: es el precio de tener una base por cliente.
    """
    return AdminDashboardService(db).resumen(dias)


@router.get(
    "/configuracion/sistema",
    response_model=ConfiguracionSistemaResponse,
    summary="Configuración global de la plataforma",
)
def obtener_configuracion(db: Session = Depends(get_db_maestra)):
    return ConfiguracionSistemaService(db).obtener()


@router.put(
    "/configuracion/sistema",
    response_model=ConfiguracionSistemaResponse,
    summary="Guardar la configuración global de la plataforma",
)
def guardar_configuracion(
    datos: ConfiguracionSistemaUpdate,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    """`retencion_log_dias` es la política de permanencia de la bitácora de
    actividad para TODOS los clientes. Un cliente puede tener su propio
    override en su ficha; si no lo tiene, manda este valor."""
    respuesta = ConfiguracionSistemaService(db).guardar(datos, admin.id)
    logger.info("Configuración del sistema actualizada por %s", admin.usuario)
    return respuesta


@router.post(
    "/configuracion/sistema/purgar-log",
    response_model=OperacionResponse,
    summary="Purgar ahora la bitácora de actividad de todos los clientes",
)
def purgar_log(
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    """Aplica la política de permanencia de inmediato, sin esperar al job
    nocturno (`python -m app.jobs.purgar_logs`). Recorre los clientes activos y
    borra de cada base lo más viejo que su retención efectiva."""
    resultado = ConfiguracionSistemaService(db).purgar_logs()
    logger.info(
        "Purga manual de bitácoras lanzada por %s: %s", admin.usuario, resultado.mensaje
    )
    return resultado
