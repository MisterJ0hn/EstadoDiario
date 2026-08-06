import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.crypto import cifrar
from app.core.database import get_db_maestra
from app.models.maestra.usuario_admin import UsuarioAdmin

from admin_api.app.deps import require_admin
from app.repositories.configuracion_google_repository import ConfiguracionGoogleRepository
from app.schemas.configuracion_google import (
    ConfiguracionGoogleResponse,
    ConfiguracionGoogleUpdate,
)

logger = logging.getLogger(__name__)

# Client ID/Secret del proyecto de Google Cloud: solo el admin los configura.
# Cada usuario luego conecta SU cuenta desde /google-calendar (ver ese router).
router = APIRouter(
    prefix="/configuracion-google",
    tags=["Configuración de Google Calendar"],
    dependencies=[Depends(require_admin)],
)


def _a_response(config) -> ConfiguracionGoogleResponse:
    return ConfiguracionGoogleResponse(
        activo=config.activo,
        client_id=config.client_id,
        tiene_client_secret=bool(config.client_secret_cifrado),
        fecha_modificacion=config.fecha_modificacion,
    )


@router.get(
    "",
    response_model=ConfiguracionGoogleResponse,
    summary="Obtener la configuración OAuth de Google Calendar",
)
def obtener_configuracion(db: Session = Depends(get_db_maestra)):
    return _a_response(ConfiguracionGoogleRepository(db).get_or_create(None))


@router.put(
    "",
    response_model=ConfiguracionGoogleResponse,
    summary="Guardar la configuración OAuth de Google Calendar",
)
def guardar_configuracion(
    datos: ConfiguracionGoogleUpdate,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    repo = ConfiguracionGoogleRepository(db)
    config = repo.get_or_create(None)

    config.activo = datos.activo
    config.client_id = datos.client_id

    # Campo vacío = el admin no quiso cambiar el secret existente
    if datos.client_secret:
        config.client_secret_cifrado = cifrar(datos.client_secret)

    repo.save(config)
    logger.info("Configuración de Google Calendar actualizada por %s", admin.usuario)
    return _a_response(config)
