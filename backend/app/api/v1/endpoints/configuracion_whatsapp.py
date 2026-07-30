import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.crypto import cifrar, descifrar
from app.core.database import get_db
from app.core.deps import require_admin
from app.models.usuario import Usuario
from app.repositories.configuracion_whatsapp_repository import ConfiguracionWhatsappRepository
from app.schemas.configuracion_whatsapp import (
    ConfiguracionWhatsappResponse,
    ConfiguracionWhatsappUpdate,
    OperacionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/configuracion-whatsapp",
    tags=["Configuración de WhatsApp"],
    dependencies=[Depends(require_admin)],
)


def _a_response(config) -> ConfiguracionWhatsappResponse:
    return ConfiguracionWhatsappResponse(
        activo=config.activo,
        twilio_account_sid=config.twilio_account_sid,
        tiene_auth_token=bool(config.twilio_auth_token_cifrado),
        twilio_numero_whatsapp=config.twilio_numero_whatsapp,
        plantilla_content_sid=config.plantilla_content_sid,
        validar_firma_webhook=config.validar_firma_webhook,
        fecha_modificacion=config.fecha_modificacion,
    )


@router.get(
    "",
    response_model=ConfiguracionWhatsappResponse,
    summary="Obtener la configuración de Twilio/WhatsApp",
)
def obtener_configuracion(db: Session = Depends(get_db)):
    return _a_response(ConfiguracionWhatsappRepository(db).get_or_create())


@router.put(
    "",
    response_model=ConfiguracionWhatsappResponse,
    summary="Guardar la configuración de Twilio/WhatsApp",
)
def guardar_configuracion(
    datos: ConfiguracionWhatsappUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    repo = ConfiguracionWhatsappRepository(db)
    config = repo.get_or_create()

    config.activo = datos.activo
    config.twilio_account_sid = datos.twilio_account_sid
    config.twilio_numero_whatsapp = datos.twilio_numero_whatsapp
    config.plantilla_content_sid = datos.plantilla_content_sid
    config.validar_firma_webhook = datos.validar_firma_webhook

    # Campo vacío = el admin no quiso cambiar el auth token existente
    if datos.twilio_auth_token:
        config.twilio_auth_token_cifrado = cifrar(datos.twilio_auth_token)

    repo.save(config)
    logger.info("Configuración de WhatsApp actualizada por %s", admin.username)
    return _a_response(config)


@router.post(
    "/probar-conexion",
    response_model=OperacionResponse,
    summary="Probar las credenciales de Twilio sin enviar nada",
)
def probar_conexion(db: Session = Depends(get_db)):
    from twilio.base.exceptions import TwilioRestException
    from twilio.rest import Client

    config = ConfiguracionWhatsappRepository(db).get_or_create()
    if not config.twilio_account_sid or not config.twilio_auth_token_cifrado:
        return OperacionResponse(exito=False, mensaje="Falta el Account SID o el Auth Token")

    try:
        token = descifrar(config.twilio_auth_token_cifrado)
        client = Client(config.twilio_account_sid, token)
        cuenta = client.api.accounts(config.twilio_account_sid).fetch()
        return OperacionResponse(
            exito=True, mensaje=f"Conexión correcta. Cuenta '{cuenta.friendly_name}' ({cuenta.status})."
        )
    except TwilioRestException as e:
        return OperacionResponse(exito=False, mensaje=f"Error de Twilio: {e.msg}")
    except ValueError as e:
        return OperacionResponse(exito=False, mensaje=str(e))
    except Exception as e:
        return OperacionResponse(exito=False, mensaje=f"No se pudo conectar: {e}")
