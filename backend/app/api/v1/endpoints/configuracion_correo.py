import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra
from app.core.deps import (
    TenantContexto,
    get_db_tenant,
    get_tenant_actual,
    get_usuario_actual,
    require_admin_cliente,
)
from app.models.usuario import Usuario
from app.repositories.configuracion_correo_repository import ConfiguracionCorreoRepository
from app.repositories.correo_log_repository import CorreoLogRepository
from app.schemas.configuracion_correo import (
    ConfiguracionCorreoResponse,
    CorreoLogListResponse,
    OperacionResponse,
    RevisarResponse,
)
from app.services.correo_service import CorreoService

logger = logging.getLogger(__name__)

# La casilla es UNA POR CLIENTE (<guid>@temposoft.cl) y su configuración vive
# en la base principal, no en la del cliente. Ningún endpoint de acá recibe un
# id por parámetro: el cliente sale del token, y así no hay forma de leer ni
# escribir la credencial de otro estudio.
#
# **El estudio ya no configura su casilla.** De qué casilla se lee determina en
# qué base termina cada archivo, así que es decisión de la plataforma
# (/api/v1/admin/clientes/{id}/inbox). Al estudio le queda ver cómo va la
# ingesta: la configuración en modo lectura, forzar una revisión y la bitácora.
# Todo eso exige ser administrador DEL ESTUDIO — quién recibe las causas y con
# qué credencial no es información de cualquiera.
router = APIRouter(
    prefix="/configuracion-correo",
    tags=["Configuración de Correo"],
    dependencies=[Depends(require_admin_cliente)],
)


def _a_response(config) -> ConfiguracionCorreoResponse:
    return ConfiguracionCorreoResponse(
        activo=config.activo,
        host=config.host,
        puerto=config.puerto,
        usar_ssl=config.usar_ssl,
        usuario=config.usuario,
        carpeta=config.carpeta,
        tiene_password=bool(config.password_cifrado),
        remitentes_permitidos=config.remitentes_permitidos,
        asunto_contiene=config.asunto_contiene,
        asunto_estado_diario=config.asunto_estado_diario,
        asunto_movimientos=config.asunto_movimientos,
        asunto_audiencias=config.asunto_audiencias,
        rut=config.rut,
        max_tamano_mb=config.max_tamano_mb,
        hora_ejecucion=config.hora_ejecucion,
        marcar_como_leido=config.marcar_como_leido,
        ultima_ejecucion=config.ultima_ejecucion,
        ultimo_resultado=config.ultimo_resultado,
    )


@router.get(
    "",
    response_model=ConfiguracionCorreoResponse,
    summary="Obtener la configuración de la casilla de correo",
)
def obtener_configuracion(
    db_maestra: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
):
    return _a_response(
        ConfiguracionCorreoRepository(db_maestra).get_or_create(tenant.cliente_id)
    )


@router.post(
    "/probar-conexion",
    response_model=OperacionResponse,
    summary="Probar la conexión IMAP sin importar nada",
)
def probar_conexion(
    db: Session = Depends(get_db_tenant),
    db_maestra: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
):
    """Comprueba que la casilla del estudio responda, con la credencial ya
    guardada. No acepta una contraseña por parámetro: el estudio no puede
    guardarla, así que probar otra distinta solo serviría para tantear
    credenciales ajenas contra el servidor de correo."""
    resultado = CorreoService(db, db_maestra).probar_conexion(tenant.cliente_id)
    return OperacionResponse(**resultado)


@router.post(
    "/revisar",
    response_model=RevisarResponse,
    summary="Revisar la casilla ahora e importar los adjuntos válidos",
)
def revisar_ahora(
    db: Session = Depends(get_db_tenant),
    db_maestra: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Revisa la casilla del cliente e importa lo que corresponda en SU base.

    Lo importado queda a nombre del usuario destino configurado; si no hay
    ninguno, del usuario que apretó el botón.
    """
    config = ConfiguracionCorreoRepository(db_maestra).get_or_create(tenant.cliente_id)
    usuario_destino = config.usuario_destino_id or current_user.id
    resultado = CorreoService(db, db_maestra).revisar(
        tenant.cliente_id, usuario_destino, disparo="manual"
    )
    return RevisarResponse(**resultado)


@router.get(
    "/log",
    response_model=CorreoLogListResponse,
    summary="Bitácora de la ingesta por correo",
)
def listar_log(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    resultado: str | None = Query(None, description="importado, descartado, duplicado, error o conexion"),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    # Sin filtro por usuario: la casilla es una sola y del estudio, así que su
    # bitácora también. Solo la ve el administrador (ver el router).
    items, total, total_pages = CorreoLogRepository(db).find_all_paginated(
        None, page, per_page, resultado,
    )
    return CorreoLogListResponse(
        total=total, page=page, total_pages=total_pages, registros=items,
    )
