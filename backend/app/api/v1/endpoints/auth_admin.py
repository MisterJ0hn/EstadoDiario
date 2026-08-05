from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra
from app.core.deps import get_admin_actual
from app.models.maestra.usuario_admin import UsuarioAdmin
from app.schemas.auth import (
    LoginAdminRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserInfo,
)
from app.services.auth_service import AuthAdminService, perfil_admin

# Administradores de la PLATAFORMA: los que crean clientes. Nada que ver con el
# rol "admin" dentro de un cliente, que se administra desde /usuarios.
#
# Acá solo vive el login, que es lo único realmente distinto: el perfil, la
# renovación y el cambio de clave los atiende /auth para las dos sesiones (ver
# auth.py). `/refresh` y `/me` quedan como alias porque son la ruta obvia para
# un cliente de la API que no conoce esa decisión.
router = APIRouter(prefix="/auth/admin", tags=["Autenticación (plataforma)"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Iniciar sesión (administrador de la plataforma)",
    responses={401: {"description": "Credenciales inválidas"}},
)
def login(body: LoginAdminRequest, db: Session = Depends(get_db_maestra)):
    """Login de DOS campos: usuario y contraseña, contra la base principal.

    Si la respuesta trae `debe_cambiar_password` en true, el token sirve
    únicamente para cambiar la clave: el resto de la administración responde
    403 hasta que se cambie.
    """
    return AuthAdminService(db).login(body.username, body.password)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Renovar el token de administrador",
)
def refresh_token(body: RefreshTokenRequest, db: Session = Depends(get_db_maestra)):
    return AuthAdminService(db).refresh(body.refresh_token)


@router.get(
    "/me",
    response_model=UserInfo,
    summary="Perfil del administrador autenticado",
)
def me(admin: UsuarioAdmin = Depends(get_admin_actual)):
    # Depende de get_admin_actual y no de require_admin: con la clave
    # provisoria puesta el frontend igual necesita saber quién entró.
    return perfil_admin(admin)
