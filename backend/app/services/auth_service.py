"""Autenticación. Hay DOS flujos y no comparten tabla ni base de datos.

- `AuthAdminService`  → administrador del sistema. Dos campos (usuario,
  password) contra la tabla `usuario` de la base principal.
- `AuthClienteService` → usuario de un cliente. Tres campos (rut, usuario,
  password): el RUT resuelve a qué base entrar, y recién ahí se validan el
  usuario y la clave.

El token de cliente lleva el `guid` del cliente: es lo que usa cada request
para saber a qué base conectarse (ver `get_db_tenant` en app/core/deps.py). Va
firmado, así que nadie puede pedir la base de otro cambiándolo.
"""

import logging

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import crear_sesion_tenant
from app.core.exceptions import UnauthorizedException
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.usuario_admin_repository import UsuarioAdminRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.schemas.auth import TokenResponse, UserInfo

logger = logging.getLogger(__name__)

# Ámbito del token: dice contra qué base vale. Un token de cliente no abre
# nada de administración y viceversa.
AMBITO_ADMIN = "sistema"
AMBITO_CLIENTE = "cliente"

# Rol que lleva el token del administrador de la plataforma. No existe dentro
# de un cliente (ahí los roles son 'admin' y 'usuario'), y es lo que mira el
# frontend para saber si muestra la consola de administración.
ROL_SUPERADMIN = "superadmin"


def perfil_admin(admin) -> UserInfo:
    """Perfil del administrador de la plataforma en la forma común.

    Los `cliente_*` van nulos: esta sesión no opera sobre la base de ningún
    cliente. El frontend usa eso para saber que está en la consola.
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


def perfil_cliente(usuario, cliente=None) -> UserInfo:
    """Perfil del usuario de un cliente, con la ficha de su estudio.

    `username`, `email` y `telefono` salen descifrados de las propiedades del
    modelo: en la base esas columnas se llaman `usuario`, `correo` y `telefono`
    y guardan texto cifrado.
    """
    info = UserInfo(
        id=usuario.id,
        username=usuario.usuario,
        email=usuario.correo,
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        telefono=usuario.telefono,
        rol=usuario.rol,
        activo=usuario.activo,
        debe_cambiar_password=usuario.debe_cambiar_password,
    )
    if cliente is not None:
        info.cliente_id = cliente.cliente_id
        info.cliente_nombre = cliente.nombre
        # Descifrado por la propiedad del modelo.
        info.cliente_rut = cliente.rut
        info.cliente_guid = cliente.guid
    return info


def refrescar(db_maestra: Session, refresh_token: str) -> TokenResponse:
    """Renueva el token sea de la sesión que sea.

    El frontend usa un solo `/auth/refresh` para las dos, así que el despacho
    lo hace el backend mirando el `ambito` que el propio token trae firmado.
    """
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise UnauthorizedException("Refresh token inválido o expirado")

    if payload.get("ambito") == AMBITO_ADMIN:
        return AuthAdminService(db_maestra).refresh(refresh_token)
    return AuthClienteService(db_maestra).refresh(refresh_token)


def _respuesta(token_data: dict, debe_cambiar_password: bool = False) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        expires_in=settings.BACKEND_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        debe_cambiar_password=debe_cambiar_password,
    )


class AuthAdminService:
    """Login de dos campos contra la base principal."""

    def __init__(self, db_maestra: Session):
        self.repo = UsuarioAdminRepository(db_maestra)

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
        return _respuesta(
            {
                "sub": str(admin.id),
                "usuario": admin.usuario,
                "rol": ROL_SUPERADMIN,
                "ambito": AMBITO_ADMIN,
            },
            debe_cambiar_password=admin.debe_cambiar_password,
        )

    def refresh(self, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if (
            not payload
            or payload.get("type") != "refresh"
            or payload.get("ambito") != AMBITO_ADMIN
        ):
            raise UnauthorizedException("Refresh token inválido o expirado")

        admin = self.repo.find_by_id(int(payload["sub"]))
        if not admin or not admin.activo:
            raise UnauthorizedException("Usuario no encontrado o desactivado")

        return _respuesta(
            {
                "sub": str(admin.id),
                "usuario": admin.usuario,
                "rol": ROL_SUPERADMIN,
                "ambito": AMBITO_ADMIN,
            },
            debe_cambiar_password=admin.debe_cambiar_password,
        )


class AuthClienteService:
    """Login de tres campos: rut → cliente → base del cliente → usuario."""

    def __init__(self, db_maestra: Session):
        self.db_maestra = db_maestra
        self.clientes = ClienteRepository(db_maestra)

    def login(self, rut: str, usuario: str, password: str) -> TokenResponse:
        cliente = self.clientes.find_by_rut(rut)
        if not cliente or not cliente.activo:
            # Un cliente suspendido no entra: sus datos siguen intactos en su
            # base, pero nadie de ese estudio inicia sesión hasta reactivarlo.
            # Mismo mensaje que si fallara la clave: distinguirlos diría qué
            # RUT son clientes del sistema y cuáles están suspendidos.
            logger.warning("Login de cliente fallido: RUT no válido o cliente suspendido")
            raise UnauthorizedException("Credenciales inválidas")

        # Recién acá se abre la base del cliente. La sesión se cierra siempre:
        # el token que se devuelve no la necesita, cada request abre la suya.
        db_tenant = crear_sesion_tenant(cliente.guid)
        try:
            registro = UsuarioRepository(db_tenant).find_by_usuario(usuario)
            if not registro or not verify_password(password, registro.password_hash):
                logger.warning(
                    "Login fallido para el usuario %s del cliente %s", usuario, cliente.guid
                )
                raise UnauthorizedException("Credenciales inválidas")

            if not registro.activo:
                raise UnauthorizedException("Usuario desactivado")

            token_data = {
                "sub": str(registro.id),
                "usuario": usuario,
                "rol": registro.rol,
                "ambito": AMBITO_CLIENTE,
                # A qué base va cada request de este token.
                "guid": cliente.guid,
                "cliente_id": cliente.cliente_id,
            }
            # Se lee dentro de la sesión: después queda desligado.
            debe_cambiar = registro.debe_cambiar_password
        finally:
            db_tenant.close()

        logger.info("Login exitoso: %s (cliente %s)", usuario, cliente.guid)
        return _respuesta(token_data, debe_cambiar_password=debe_cambiar)

    def refresh(self, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if (
            not payload
            or payload.get("type") != "refresh"
            or payload.get("ambito") != AMBITO_CLIENTE
        ):
            raise UnauthorizedException("Refresh token inválido o expirado")

        # El cliente se revalida contra la base principal: si lo desactivaron,
        # el refresh deja de renovar aunque el token siga vigente.
        cliente = self.clientes.find_by_guid(payload.get("guid", ""))
        if not cliente or not cliente.activo:
            raise UnauthorizedException("Cliente no encontrado o desactivado")

        db_tenant = crear_sesion_tenant(cliente.guid)
        try:
            registro = UsuarioRepository(db_tenant).find_by_id(int(payload["sub"]))
            if not registro or not registro.activo:
                raise UnauthorizedException("Usuario no encontrado o desactivado")

            token_data = {
                "sub": str(registro.id),
                "usuario": registro.usuario,
                "rol": registro.rol,
                "ambito": AMBITO_CLIENTE,
                "guid": cliente.guid,
                "cliente_id": cliente.cliente_id,
            }
            debe_cambiar = registro.debe_cambiar_password
        finally:
            db_tenant.close()

        return _respuesta(token_data, debe_cambiar_password=debe_cambiar)
