"""Autenticación.

`/auth/me`, `/auth/refresh` y `/auth/cambiar-password` sirven a los DOS tipos
de sesión: el usuario de un cliente y el administrador de la plataforma. Es a
propósito y no un atajo: el frontend guarda una sola sesión y no debería tener
que saber contra qué tabla se validó para pedir su propio perfil. Lo que
distingue una de otra es el `ambito` que el token trae firmado.

Lo único que sí está separado es el login, porque las credenciales son
distintas: tres campos acá y dos en `/auth/admin/login`.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import crear_sesion_tenant, get_db_maestra
from app.core.deps import TenantContexto, get_db_tenant, get_tenant_actual, get_usuario_actual
from app.core.exceptions import BadRequestException, UnauthorizedException
from app.core.security import decode_token, get_password_hash, verify_password
from app.models.maestra.usuario_admin import UsuarioAdmin
from app.models.usuario import Usuario
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.schemas.auth import (
    ActualizarPerfilRequest,
    CambiarPasswordRequest,
    LoginClienteRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserInfo,
)
from app.schemas.cliente import OperacionResponse
from app.services.auth_service import (
    AMBITO_ADMIN,
    AuthClienteService,
    perfil_admin,
    perfil_cliente,
    refrescar,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Autenticación"])

security_scheme = HTTPBearer()


def _payload_valido(credentials: HTTPAuthorizationCredentials) -> dict:
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )
    return payload


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Iniciar sesión (usuario de un cliente)",
    responses={401: {"description": "Credenciales inválidas"}},
)
def login(body: LoginClienteRequest, db: Session = Depends(get_db_maestra)):
    """Login de TRES campos: RUT del cliente, usuario y contraseña.

    El RUT se resuelve en la base principal y define a qué base de datos entra
    la sesión; el usuario y la clave se validan dentro de esa base. La sesión
    que recibe este endpoint es la maestra porque al llegar todavía no se sabe
    de qué cliente se trata.
    """
    return AuthClienteService(db).login(body.rut, body.username, body.password)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Renovar token (cualquiera de las dos sesiones)",
    responses={401: {"description": "Refresh token inválido"}},
)
def refresh_token(body: RefreshTokenRequest, db: Session = Depends(get_db_maestra)):
    return refrescar(db, body.refresh_token)


@router.get(
    "/me",
    response_model=UserInfo,
    summary="Perfil de la sesión actual",
)
def me(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db_maestra: Session = Depends(get_db_maestra),
):
    """Perfil del usuario de cliente **o** del administrador de la plataforma.

    En el primer caso incluye la ficha del cliente (`cliente_*`), que sale de
    la base principal porque en la del cliente no está; en el segundo esos
    campos van nulos.
    """
    payload = _payload_valido(credentials)

    if payload.get("ambito") == AMBITO_ADMIN:
        admin = db_maestra.get(UsuarioAdmin, int(payload.get("sub", 0)))
        if not admin or not admin.activo:
            raise UnauthorizedException("Usuario no encontrado o desactivado")
        return perfil_admin(admin)

    guid = payload.get("guid")
    if not guid:
        raise UnauthorizedException("Token sin cliente asociado; vuelva a iniciar sesión")

    cliente = ClienteRepository(db_maestra).find_by_guid(guid)
    db = crear_sesion_tenant(guid)
    try:
        usuario = UsuarioRepository(db).find_by_id(int(payload.get("sub", 0)))
        if not usuario or not usuario.activo:
            raise UnauthorizedException("Usuario no encontrado o desactivado")
        # El perfil se arma DENTRO de la sesión: los campos salen de
        # propiedades que descifran y necesitan el objeto vivo.
        return perfil_cliente(usuario, cliente)
    finally:
        db.close()


@router.put(
    "/me",
    response_model=UserInfo,
    summary="Actualizar el propio perfil (solo teléfono)",
)
def actualizar_perfil(
    body: ActualizarPerfilRequest,
    db: Session = Depends(get_db_tenant),
    db_maestra: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
    usuario: Usuario = Depends(get_usuario_actual),
):
    """Autoservicio: cualquier usuario de cliente edita su propio teléfono
    (número por defecto para recordatorios de WhatsApp). No toca correo, rol
    ni contraseña — eso sigue siendo exclusivo de Administración → Usuarios.

    El administrador de la plataforma no pasa por acá: no tiene teléfono ni
    recordatorios, así que su token queda fuera en `get_tenant_actual`.
    """
    # El setter cifra el valor antes de guardarlo.
    usuario.telefono = body.telefono
    db.commit()
    db.refresh(usuario)
    cliente = ClienteRepository(db_maestra).find_by_id(tenant.cliente_id)
    return perfil_cliente(usuario, cliente)


@router.post(
    "/cambiar-password",
    response_model=OperacionResponse,
    summary="Cambiar la propia contraseña (cualquiera de las dos sesiones)",
    responses={401: {"description": "La contraseña actual no es correcta"}},
)
def cambiar_password(
    body: CambiarPasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db_maestra: Session = Depends(get_db_maestra),
):
    """Es también la salida del estado "clave provisoria": al cambiarla se
    apaga `debe_cambiar_password` y el resto del sistema vuelve a responder.

    `password_actual` solo se exige cuando la clave ya era definitiva (ver el
    schema): con una provisoria el usuario acaba de escribirla para entrar.
    """
    payload = _payload_valido(credentials)

    if payload.get("ambito") == AMBITO_ADMIN:
        admin = db_maestra.get(UsuarioAdmin, int(payload.get("sub", 0)))
        if not admin or not admin.activo:
            raise UnauthorizedException("Usuario no encontrado o desactivado")
        _cambiar(admin, body, db_maestra)
        logger.info("El administrador '%s' cambió su contraseña", admin.usuario)
        return OperacionResponse(exito=True, mensaje="Contraseña actualizada")

    guid = payload.get("guid")
    if not guid:
        raise UnauthorizedException("Token sin cliente asociado; vuelva a iniciar sesión")

    db = crear_sesion_tenant(guid)
    try:
        usuario = UsuarioRepository(db).find_by_id(int(payload.get("sub", 0)))
        if not usuario or not usuario.activo:
            raise UnauthorizedException("Usuario no encontrado o desactivado")
        _cambiar(usuario, body, db)
        logger.info("El usuario %s del cliente %s cambió su contraseña", usuario.id, guid)
        return OperacionResponse(exito=True, mensaje="Contraseña actualizada")
    finally:
        db.close()


def _cambiar(registro, body: CambiarPasswordRequest, db: Session) -> None:
    """Valida y aplica el cambio. Sirve para las dos tablas de usuario porque
    ambas tienen `password_hash` y `debe_cambiar_password`."""
    if not registro.debe_cambiar_password:
        # Cambio voluntario: se exige la clave actual. Sin esto, una sesión
        # olvidada abierta permite quedarse con la cuenta.
        if not body.password_actual:
            raise BadRequestException("Debe indicar su contraseña actual")
        if not verify_password(body.password_actual, registro.password_hash):
            raise UnauthorizedException("La contraseña actual no es correcta")

    if verify_password(body.password_nueva, registro.password_hash):
        raise BadRequestException("La contraseña nueva debe ser distinta de la actual")

    registro.password_hash = get_password_hash(body.password_nueva)
    registro.debe_cambiar_password = False
    db.commit()
