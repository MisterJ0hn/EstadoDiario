import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.crypto import cifrar
from app.core.database import get_db
from app.core.deps import require_admin
from app.models.usuario import Usuario
from app.repositories.configuracion_correo_repository import ConfiguracionCorreoRepository
from app.repositories.correo_log_repository import CorreoLogRepository
from app.schemas.configuracion_correo import (
    ConfiguracionCorreoResponse,
    ConfiguracionCorreoUpdate,
    CorreoLogListResponse,
    OperacionResponse,
    ProbarConexionRequest,
    RevisarResponse,
)
from app.services.correo_service import CorreoService

logger = logging.getLogger(__name__)

# Toda la sección es de administración: configura credenciales de una casilla
# real y dispara importaciones.
router = APIRouter(
    prefix="/configuracion-correo",
    tags=["Configuración de Correo"],
    dependencies=[Depends(require_admin)],
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
def obtener_configuracion(db: Session = Depends(get_db)):
    return _a_response(ConfiguracionCorreoRepository(db).get_or_create())


@router.put(
    "",
    response_model=ConfiguracionCorreoResponse,
    summary="Guardar la configuración de la casilla de correo",
)
def guardar_configuracion(
    datos: ConfiguracionCorreoUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    repo = ConfiguracionCorreoRepository(db)
    config = repo.get_or_create()

    config.activo = datos.activo
    config.host = datos.host
    config.puerto = datos.puerto
    config.usar_ssl = datos.usar_ssl
    config.usuario = datos.usuario
    config.carpeta = datos.carpeta
    config.remitentes_permitidos = datos.remitentes_permitidos
    config.asunto_contiene = datos.asunto_contiene
    config.max_tamano_mb = datos.max_tamano_mb
    config.hora_ejecucion = datos.hora_ejecucion
    config.marcar_como_leido = datos.marcar_como_leido

    # Campo vacío = el admin no quiso cambiar la contraseña existente
    if datos.password:
        config.password_cifrado = cifrar(datos.password)

    repo.save(config)
    logger.info("Configuración de correo actualizada por %s", admin.username)
    return _a_response(config)


@router.post(
    "/probar-conexion",
    response_model=OperacionResponse,
    summary="Probar la conexión IMAP sin importar nada",
)
def probar_conexion(
    datos: ProbarConexionRequest | None = None,
    db: Session = Depends(get_db),
):
    resultado = CorreoService(db).probar_conexion(
        password_override=datos.password if datos else None
    )
    return OperacionResponse(**resultado)


@router.post(
    "/revisar",
    response_model=RevisarResponse,
    summary="Revisar la casilla ahora e importar los adjuntos válidos",
)
def revisar_ahora(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    resultado = CorreoService(db).revisar(disparo="manual", usuario_id=admin.id)
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
    db: Session = Depends(get_db),
):
    items, total, total_pages = CorreoLogRepository(db).find_all_paginated(
        page, per_page, resultado
    )
    return CorreoLogListResponse(
        total=total, page=page, total_pages=total_pages, registros=items,
    )
