"""Autenticación.

`/auth/me`, `/auth/refresh` y `/auth/cambiar-password` sirven a los DOS tipos
de sesión: el usuario de un cliente y el administrador de la plataforma. Es a
propósito y no un atajo: el frontend guarda una sola sesión y no debería tener
que saber contra qué tabla se validó para pedir su propio perfil. Lo que
distingue una de otra es el `ambito` que el token trae firmado.

Lo único que sí está separado es el login, porque las credenciales son
distintas: tres campos acá y dos en `/auth/admin/login`.

`/auth/recuperar-password` y `/auth/restablecer-password` son de este lado
solamente: el administrador de la plataforma no recupera su clave por correo,
se la resetea otro administrador desde la consola.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import crear_sesion_tenant, get_db_maestra
from app.core.deps import TenantContexto, get_db_tenant, get_tenant_actual, get_usuario_actual
from app.core import recaptcha
from app.core.exceptions import UnauthorizedException
from app.core.password_policy import DESCRIPCION as POLITICA_PASSWORD
from app.core.security import decode_token
from app.models.password_historial import PasswordHistorial
from app.models.usuario import Usuario
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.schemas.auth import (
    ActualizarPerfilRequest,
    CambiarPasswordRequest,
    LoginClienteRequest,
    RecaptchaConfigResponse,
    RecuperarPasswordRequest,
    RefreshTokenRequest,
    RestablecerPasswordRequest,
    TokenResponse,
    UserInfo,
)
from app.schemas.comunes import OperacionResponse
from app.services import password_reset_service, password_service
from app.services import auditoria_service as auditoria
from app.services.auth_service import (
    AuthClienteService,
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


@router.get(
    "/recaptcha",
    response_model=RecaptchaConfigResponse,
    summary="Si reCAPTCHA está activo y con qué site key",
)
def config_recaptcha():
    """Público y sin sesión: lo consulta la pantalla de login antes de que
    exista una. Devuelve `activo: false` mientras no haya llaves configuradas,
    y con eso el frontend no carga nada de Google."""
    return RecaptchaConfigResponse(**recaptcha.configuracion_publica())


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Iniciar sesión (usuario de un cliente)",
    dependencies=[Depends(recaptcha.verificado(recaptcha.ACCION_LOGIN))],
    responses={
        400: {"description": "No se pudo verificar el reCAPTCHA"},
        401: {"description": "Credenciales inválidas"},
    },
)
def login(
    body: LoginClienteRequest,
    request: Request,
    db: Session = Depends(get_db_maestra),
):
    """Login de TRES campos: RUT del cliente, usuario y contraseña.

    El RUT se resuelve en la base principal y define a qué base de datos entra
    la sesión; el usuario y la clave se validan dentro de esa base. La sesión
    que recibe este endpoint es la maestra porque al llegar todavía no se sabe
    de qué cliente se trata.
    """
    return AuthClienteService(db).login(
        body.rut, body.username, body.password, ip=auditoria.ip_de(request)
    )


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
    """Perfil del usuario de un estudio, con la ficha de su cliente.

    Los `cliente_*` salen de la base principal porque en la del cliente no
    están.
    """
    payload = _payload_valido(credentials)

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
    summary="Cambiar la propia contraseña",
    description=f"Política de contraseñas: {POLITICA_PASSWORD}",
    responses={
        400: {"description": "La contraseña nueva no cumple la política"},
        401: {"description": "La contraseña actual no es correcta"},
    },
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
    """Valida y aplica el cambio de contraseña.

    La política (formato e historial de las últimas contraseñas) la aplica
    `password_service`, que es el mismo que usan la consola de administración
    y el restablecimiento por correo: la regla no puede depender de por dónde
    entró el cambio.
    """
    password_service.aplicar(
        db,
        registro,
        body.password_nueva,
        PasswordHistorial,
        provisoria=False,
        password_actual=body.password_actual,
        # Con la clave provisoria puesta no se pide la anterior: el usuario
        # acaba de escribirla para entrar.
        exigir_actual=not registro.debe_cambiar_password,
    )


@router.post(
    "/recuperar-password",
    response_model=OperacionResponse,
    summary="Pedir un enlace para restablecer la contraseña",
    # El más expuesto de los cuatro: cada llamada manda un correo de verdad, así
    # que sin captcha sirve para spamear la casilla de un tercero y para quemar
    # la cuota de la cuenta de envío.
    dependencies=[Depends(recaptcha.verificado(recaptcha.ACCION_RECUPERAR))],
    responses={400: {"description": "No se pudo verificar el reCAPTCHA"}},
)
def recuperar_password(
    body: RecuperarPasswordRequest, db: Session = Depends(get_db_maestra)
):
    """Manda al correo del usuario un enlace de un solo uso.

    Responde lo mismo exista o no la cuenta: contestar distinto convertiría
    este endpoint en una forma de averiguar qué correos son usuarios del
    sistema. Ver `app/services/password_reset_service.py`.
    """
    mensaje = password_reset_service.solicitar(db, body.rut, body.email)
    return OperacionResponse(exito=True, mensaje=mensaje)


@router.post(
    "/restablecer-password",
    response_model=OperacionResponse,
    summary="Fijar la contraseña con el enlace recibido por correo",
    description=f"Política de contraseñas: {POLITICA_PASSWORD}",
    dependencies=[Depends(recaptcha.verificado(recaptcha.ACCION_RESTABLECER))],
    responses={
        400: {"description": "Enlace inválido, vencido o ya usado, o reCAPTCHA no verificado"}
    },
)
def restablecer_password(
    body: RestablecerPasswordRequest, db: Session = Depends(get_db_maestra)
):
    """No lleva sesión: la prueba de identidad es haber recibido el correo.

    El token del enlace no sirve como sesión —lleva otro `type`— y vale una
    sola vez: al cambiar la contraseña, todos los enlaces emitidos antes dejan
    de calzar.
    """
    password_reset_service.restablecer(db, body.token, body.password_nueva)
    return OperacionResponse(
        exito=True,
        mensaje="Contraseña actualizada. Ya puede iniciar sesión con la nueva.",
    )
