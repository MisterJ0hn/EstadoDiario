"""Autenticación de la consola de administración.

Administradores de la PLATAFORMA: los que crean clientes. Nada que ver con el
rol `admin` dentro de un estudio, que administra el backend de `backend/`.

Las rutas se conservan tal cual las tenía la API monolítica —`/auth/admin/login`,
`/auth/refresh`, `/auth/me`, `/auth/cambiar-password`— porque la SPA ya las
pide así (ver `admin_app/src/app/core/services/auth.service.ts`). `/auth/me` y
`/auth/refresh` sin `admin` existían porque servían a las dos sesiones; acá solo
queda la de administrador, pero la ruta es la misma para no obligar a tocar la
SPA. `/auth/admin/me` y `/auth/admin/refresh` quedan como alias: son la ruta
obvia para un cliente de la API que no conoce esa historia.
"""

import logging

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra
from app.core.exceptions import BadRequestException, UnauthorizedException
from app.core.security import get_password_hash, verify_password
from app.models.maestra.usuario_admin import UsuarioAdmin
from app.schemas.auth import (
    CambiarPasswordRequest,
    LoginAdminRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserInfo,
)

from admin_api.app.deps import get_admin_actual, payload_valido, security_scheme
from admin_api.app.schemas.cliente import OperacionResponse
from admin_api.app.services.auth_admin_service import (
    AMBITO_ADMIN,
    AuthAdminService,
    perfil_admin,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Autenticación (plataforma)"])


@router.post(
    "/admin/login",
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
    responses={401: {"description": "Refresh token inválido"}},
)
def refresh_token(body: RefreshTokenRequest, db: Session = Depends(get_db_maestra)):
    return AuthAdminService(db).refresh(body.refresh_token)


@router.post(
    "/admin/refresh",
    response_model=TokenResponse,
    summary="Renovar el token de administrador (alias)",
    include_in_schema=False,
)
def refresh_token_admin(body: RefreshTokenRequest, db: Session = Depends(get_db_maestra)):
    return AuthAdminService(db).refresh(body.refresh_token)


@router.get(
    "/me",
    response_model=UserInfo,
    summary="Perfil del administrador autenticado",
)
def me(admin: UsuarioAdmin = Depends(get_admin_actual)):
    # Depende de get_admin_actual y no de require_admin: con la clave
    # provisoria puesta la SPA igual necesita saber quién entró para poder
    # mostrarle la pantalla de cambio de clave.
    return perfil_admin(admin)


@router.get(
    "/admin/me",
    response_model=UserInfo,
    summary="Perfil del administrador autenticado (alias)",
    include_in_schema=False,
)
def me_admin(admin: UsuarioAdmin = Depends(get_admin_actual)):
    return perfil_admin(admin)


@router.post(
    "/cambiar-password",
    response_model=OperacionResponse,
    summary="Cambiar la propia contraseña",
    responses={401: {"description": "La contraseña actual no es correcta"}},
)
def cambiar_password(
    body: CambiarPasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db_maestra),
):
    """Es también la salida del estado "clave provisoria": al cambiarla se
    apaga `debe_cambiar_password` y el resto de la consola vuelve a responder.

    `password_actual` solo se exige cuando la clave ya era definitiva (ver el
    schema): con una provisoria el administrador acaba de escribirla para
    entrar.

    No depende de `get_admin_actual` sino del token crudo porque la validación
    de la clave actual necesita el registro dentro de la misma sesión que hace
    el commit.
    """
    payload = payload_valido(credentials)
    if payload.get("ambito") != AMBITO_ADMIN:
        raise UnauthorizedException("Este recurso es solo para administradores del sistema")

    admin = db.get(UsuarioAdmin, int(payload.get("sub", 0)))
    if not admin or not admin.activo:
        raise UnauthorizedException("Usuario no encontrado o desactivado")

    if not admin.debe_cambiar_password:
        # Cambio voluntario: se exige la clave actual. Sin esto, una sesión
        # olvidada abierta permite quedarse con la cuenta.
        if not body.password_actual:
            raise BadRequestException("Debe indicar su contraseña actual")
        if not verify_password(body.password_actual, admin.password_hash):
            raise UnauthorizedException("La contraseña actual no es correcta")

    if verify_password(body.password_nueva, admin.password_hash):
        raise BadRequestException("La contraseña nueva debe ser distinta de la actual")

    admin.password_hash = get_password_hash(body.password_nueva)
    admin.debe_cambiar_password = False
    db.commit()

    logger.info("El administrador '%s' cambió su contraseña", admin.usuario)
    return OperacionResponse(exito=True, mensaje="Contraseña actualizada")
