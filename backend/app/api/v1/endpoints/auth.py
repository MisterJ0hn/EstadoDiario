from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.usuario import Usuario
from app.schemas.auth import LoginRequest, TokenResponse, RefreshTokenRequest, UserInfo
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Iniciar sesión",
    responses={401: {"description": "Credenciales inválidas"}},
)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Autenticarse con username y password. Retorna access y refresh token."""
    service = AuthService(db)
    return service.login(body.username, body.password)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Renovar token",
    responses={401: {"description": "Refresh token inválido"}},
)
def refresh_token(body: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Renovar el access token usando un refresh token válido."""
    service = AuthService(db)
    return service.refresh(body.refresh_token)


@router.get(
    "/me",
    response_model=UserInfo,
    summary="Datos del usuario autenticado",
)
def me(current_user: Usuario = Depends(get_current_user)):
    """Obtener la información del usuario autenticado."""
    return UserInfo.model_validate(current_user)
