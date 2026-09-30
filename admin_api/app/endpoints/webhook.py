import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra

from admin_api.app.deps import require_admin
from admin_api.app.schemas.webhook import (
    WebhookConfigGuardadaResponse,
    WebhookConfigResponse,
    WebhookConfigUpdate,
    WebhookEnvioListResponse,
    WebhookPruebaResponse,
    WebhookReintentoResponse,
    WebhookSecretoResponse,
)
from admin_api.app.services.webhook_admin_service import WebhookAdminService

logger = logging.getLogger(__name__)

# El webhook es de un cliente y cuelga de su ficha. Lo configura el
# administrador de la plataforma: el destino de los datos de un estudio no lo
# cambia nadie desde dentro del estudio.
router = APIRouter(
    prefix="/admin/clientes/{cliente_id}/webhook",
    tags=["Webhook"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=WebhookConfigResponse, summary="Webhook del cliente")
def obtener_webhook(cliente_id: int, db: Session = Depends(get_db_maestra)):
    return WebhookAdminService(db).obtener(cliente_id)


@router.put(
    "",
    response_model=WebhookConfigGuardadaResponse,
    summary="Configurar el webhook del cliente",
)
def guardar_webhook(
    cliente_id: int, datos: WebhookConfigUpdate, db: Session = Depends(get_db_maestra)
):
    """La primera vez que se guarda se genera el **secreto de firma** y viene en
    esta respuesta; no se puede volver a ver. Después solo se puede rotar."""
    return WebhookAdminService(db).guardar(cliente_id, datos)


@router.post(
    "/rotar-secreto",
    response_model=WebhookSecretoResponse,
    summary="Generar un secreto de firma nuevo",
)
def rotar_secreto(cliente_id: int, db: Session = Depends(get_db_maestra)):
    return WebhookAdminService(db).rotar_secreto(cliente_id)


@router.post(
    "/probar", response_model=WebhookPruebaResponse, summary="Enviar un evento de prueba"
)
def probar_webhook(cliente_id: int, db: Session = Depends(get_db_maestra)):
    """Manda `webhook.prueba` ya, firmado igual que los reales, sin pasar por la cola."""
    return WebhookAdminService(db).probar(cliente_id)


@router.get(
    "/envios", response_model=WebhookEnvioListResponse, summary="Entregas del webhook"
)
def listar_envios(
    cliente_id: int,
    estado: str | None = Query(default=None, pattern="^(pendiente|enviado|fallido)$"),
    limite: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db_maestra),
):
    return WebhookAdminService(db).listar_envios(cliente_id, estado, limite)


@router.post(
    "/envios/reintentar",
    response_model=WebhookReintentoResponse,
    summary="Reintentar todas las entregas fallidas",
)
def reintentar_fallidos(cliente_id: int, db: Session = Depends(get_db_maestra)):
    return WebhookReintentoResponse(reencolados=WebhookAdminService(db).reintentar(cliente_id))


@router.post(
    "/envios/{envio_id}/reintentar",
    response_model=WebhookReintentoResponse,
    summary="Reintentar una entrega fallida",
)
def reintentar_envio(cliente_id: int, envio_id: int, db: Session = Depends(get_db_maestra)):
    return WebhookReintentoResponse(
        reencolados=WebhookAdminService(db).reintentar(cliente_id, envio_id)
    )
