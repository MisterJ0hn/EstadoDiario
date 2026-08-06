"""Autenticación del administrador de la plataforma.

Login de dos campos (usuario, contraseña) contra la tabla `usuario` de la base
PRINCIPAL. No tiene nada que ver con el rol `admin` dentro de un estudio: ese
vive en la base del cliente y lo atiende el backend de `backend/`.

Vive acá y no en `app.services.auth_service` porque ese módulo quedó, a
propósito, solo con el flujo de cliente cuando la administración se sacó del
backend. El token que emite lleva `ambito=sistema`; el backend de los estudios
exige `ambito=cliente`, así que un token de acá no abre nada de un estudio y
uno de estudio no abre nada de acá. Esa es toda la separación: un claim firmado.
"""

import logging

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import UnauthorizedException
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.repositories.usuario_admin_repository import UsuarioAdminRepository
from app.schemas.auth import TokenResponse, UserInfo

logger = logging.getLogger(__name__)

# Ámbito del token: dice contra qué base vale.
AMBITO_ADMIN = "sistema"

# Rol que lleva el token del administrador de la plataforma. No existe dentro
# de un cliente (ahí los roles son 'admin' y 'usuario'), y es lo que mira la
# SPA para saber que está en la consola.
ROL_SUPERADMIN = "superadmin"


def perfil_admin(admin) -> UserInfo:
    """Perfil del administrador en la forma común de `/auth/me`.

    Los `cliente_*` van nulos: esta sesión no opera sobre la base de ningún
    cliente. La SPA usa eso para saber que está en la consola.
    """
    return UserInfo(
        id=admin.id,
        username=admin.usuario,
        email=admin.correo,
        nombre=admin.nombre,
        apellido=None,
        telefono=None,
        rol=ROL_SUPERADMIN,
        activo=admin.activo,
        debe_cambiar_password=admin.debe_cambiar_password,
    )


def _respuesta(token_data: dict, debe_cambiar_password: bool = False) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        expires_in=settings.BACKEND_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        debe_cambiar_password=debe_cambiar_password,
    )


class AuthAdminService:
    def __init__(self, db_maestra: Session):
        self.repo = UsuarioAdminRepository(db_maestra)

    def _token(self, admin) -> TokenResponse:
        return _respuesta(
            {
                "sub": str(admin.id),
                "usuario": admin.usuario,
                "rol": ROL_SUPERADMIN,
                "ambito": AMBITO_ADMIN,
            },
            debe_cambiar_password=admin.debe_cambiar_password,
        )

    def login(self, usuario: str, password: str) -> TokenResponse:
        admin = self.repo.find_by_usuario(usuario)
        if not admin or not verify_password(password, admin.password_hash):
            # Sin distinguir "no existe" de "clave mala": eso permitiría
            # enumerar administradores.
            logger.warning("Login de administrador fallido para: %s", usuario)
            raise UnauthorizedException("Credenciales inválidas")

        if not admin.activo:
            raise UnauthorizedException("Usuario desactivado")

        logger.info("Login de administrador exitoso: %s", usuario)
        return self._token(admin)

    def refresh(self, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if (
            not payload
            or payload.get("type") != "refresh"
            or payload.get("ambito") != AMBITO_ADMIN
        ):
            # Cae acá también el refresh token de un usuario de estudio: es
            # válido, pero no para este servicio.
            raise UnauthorizedException("Refresh token inválido o expirado")

        admin = self.repo.find_by_id(int(payload["sub"]))
        if not admin or not admin.activo:
            raise UnauthorizedException("Usuario no encontrado o desactivado")

        return self._token(admin)
