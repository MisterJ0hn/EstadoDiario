"""Autenticación de los usuarios de un estudio.

`AuthClienteService` → tres campos (rut, usuario, password): el RUT resuelve a
qué base entrar, y recién ahí se validan el usuario y la clave.

El administrador de la plataforma se autentica en `admin_app/`, que es otra
aplicación: por eso el `ambito` del token sigue existiendo, para que un token
de aquella consola no abra nada de acá.

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
from app.repositories.usuario_repository import UsuarioRepository
from app.schemas.auth import TokenResponse, UserInfo

logger = logging.getLogger(__name__)

# Ámbito del token: dice contra qué aplicación vale. La consola de
# administración (`admin_app/`) emite tokens con ámbito "sistema", firmados con
# el mismo secreto; sin este chequeo, uno de aquellos abriría la base de un
# estudio.
AMBITO_CLIENTE = "cliente"


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
        activo=usuario.activo,
        # Los RUT con los que recibe archivos del PJUD. Van en el perfil para
        # que la advertencia al importar se pueda mostrar sin otra petición.
        ruts=[r.rut for r in usuario.ruts],
        debe_cambiar_password=usuario.debe_cambiar_password,
    )
    if cliente is not None:
        info.cliente_id = cliente.cliente_id
        info.cliente_nombre = cliente.nombre
        # Descifrado por la propiedad del modelo.
        info.cliente_rut = cliente.rut
        info.cliente_guid = cliente.guid
        info.cliente_logo = cliente.logo_data_uri
    return info


def refrescar(db_maestra: Session, refresh_token: str) -> TokenResponse:
    """Renueva el token de un usuario de estudio.

    Un token de la consola de administración no se renueva acá: lleva otro
    `ambito` y `AuthClienteService.refresh` lo rechaza.
    """
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise UnauthorizedException("Refresh token inválido o expirado")
    return AuthClienteService(db_maestra).refresh(refresh_token)


def _respuesta(token_data: dict, debe_cambiar_password: bool = False) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        expires_in=settings.BACKEND_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        debe_cambiar_password=debe_cambiar_password,
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
                "ambito": AMBITO_CLIENTE,
                "guid": cliente.guid,
                "cliente_id": cliente.cliente_id,
            }
            debe_cambiar = registro.debe_cambiar_password
        finally:
            db_tenant.close()

        return _respuesta(token_data, debe_cambiar_password=debe_cambiar)
