import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra
from app.models.maestra.usuario_admin import UsuarioAdmin

from admin_api.app.deps import require_admin
from admin_api.app.schemas.api_key import (
    ApiKeyCreadaResponse,
    ApiKeyCreate,
    ApiKeyListResponse,
    ApiKeyResponse,
    ApiKeyUpdate,
)
from admin_api.app.services.api_key_service import ApiKeyService

logger = logging.getLogger(__name__)

# Las API keys son de un cliente, así que cuelgan de su ficha. Solo el
# administrador de la plataforma las emite: el estudio no se las da solo.
router = APIRouter(
    prefix="/admin/clientes/{cliente_id}/api-keys",
    tags=["API keys"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=ApiKeyListResponse, summary="API keys del cliente")
def listar_api_keys(cliente_id: int, db: Session = Depends(get_db_maestra)):
    keys = ApiKeyService(db).listar(cliente_id)
    return ApiKeyListResponse(total=len(keys), api_keys=keys)


@router.post(
    "",
    response_model=ApiKeyCreadaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Emitir una API key para un sistema externo",
)
def crear_api_key(
    cliente_id: int,
    datos: ApiKeyCreate,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    """**La key viene en esta respuesta y no se puede volver a ver**: en la base
    solo queda su hash. Se usa en el header `X-API-Key` de la API de los
    estudios, sin login ni reCAPTCHA."""
    return ApiKeyService(db).crear(cliente_id, datos, creada_por=admin.id)


@router.put("/{key_id}", response_model=ApiKeyResponse, summary="Cambiar nombre o límite")
def actualizar_api_key(
    cliente_id: int,
    key_id: int,
    datos: ApiKeyUpdate,
    db: Session = Depends(get_db_maestra),
):
    return ApiKeyService(db).actualizar(cliente_id, key_id, datos)


@router.post(
    "/{key_id}/revocar",
    response_model=ApiKeyResponse,
    summary="Revocar una API key",
)
def revocar_api_key(cliente_id: int, key_id: int, db: Session = Depends(get_db_maestra)):
    """Efecto inmediato e irreversible: para volver a dar acceso se emite otra."""
    return ApiKeyService(db).revocar(cliente_id, key_id)
