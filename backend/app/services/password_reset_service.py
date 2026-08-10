"""Recuperación de contraseña por correo, para el usuario de un estudio.

Son dos pasos y dos endpoints:

    POST /auth/recuperar-password    rut + correo  → sale el correo con el enlace
    POST /auth/restablecer-password  token + clave → queda la clave nueva puesta

El RUT se pide igual que en el login y por lo mismo: dice en qué base buscar.
El correo es la credencial de este flujo, así que se busca por `correo_hash`
—la columna está cifrada— y por eso `usuario.correo` es UNIQUE.

**El enlace no crea sesión.** El token lleva `type: reset_password`, que
`_payload_valido` y `get_usuario_actual` rechazan: sirve para una sola cosa.

**Y se usa una sola vez.** No hay tabla de tokens emitidos; en su lugar el
token lleva una huella del hash de la contraseña vigente al momento de
emitirlo. Cambiada la clave, el hash cambia, la huella deja de calzar y todos
los enlaces anteriores mueren juntos —incluido el que se acaba de usar—. Una
tabla de tokens haría lo mismo con una fila que hay que crear, buscar, marcar
y purgar.

Sobre no delatar quién tiene cuenta: el paso 1 responde siempre lo mismo, haya
o no una cuenta con ese RUT y ese correo. La excepción es cuando el correo no
se puede enviar: ahí se devuelve el error. Es cierto que eso confirma que la
cuenta existe, pero solo mientras el servidor de correo esté caído, y la
alternativa es dejar a alguien esperando para siempre un correo que nadie
mandó.
"""

import hashlib
import logging
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import crear_sesion_tenant
from app.core.exceptions import BadRequestException
from app.core.security import create_reset_token, decode_token
from app.models.password_historial import PasswordHistorial
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.services import password_service
from app.services.smtp_service import ErrorEnvio, SmtpService

logger = logging.getLogger(__name__)

TIPO_TOKEN = "reset_password"

# Lo mismo se responda o no se haya encontrado la cuenta.
MENSAJE_SOLICITUD = (
    "Si el RUT y el correo corresponden a una cuenta activa, le enviamos un "
    "enlace para crear una contraseña nueva. Revise su bandeja de entrada y "
    "también la carpeta de correo no deseado."
)

ASUNTO = "Recuperación de contraseña - Estado Diario"


def _huella(password_hash: str) -> str:
    """Marca del hash vigente, para que el enlace valga una sola vez.

    Va la huella y no el hash: el hash bcrypt en un correo es material para
    atacar sin límite de intentos, la huella no permite probar contraseñas.
    """
    return hashlib.sha256(password_hash.encode("utf-8")).hexdigest()[:32]


def _cuerpo(nombre: str, enlace: str) -> str:
    minutos = settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    return (
        f"Hola {nombre}:\n\n"
        "Recibimos una solicitud para restablecer la contraseña de su cuenta "
        "en Estado Diario. Para crear una contraseña nueva, abra este enlace:\n\n"
        f"{enlace}\n\n"
        f"El enlace vence en {minutos} minutos y se puede usar una sola vez.\n\n"
        "Si usted no pidió el cambio, no haga nada: su contraseña actual sigue "
        "funcionando y nadie más puede usar este enlace sin acceso a este correo.\n"
    )


def solicitar(db_maestra: Session, rut: str, correo: str) -> str:
    """Paso 1. Devuelve SIEMPRE el mismo mensaje (ver el docstring del módulo).

    Se registra en el log lo que no se le dice al usuario: sin eso, un soporte
    que recibe "no me llegó nada" no tendría cómo distinguir un correo mal
    escrito de un problema de entrega.
    """
    cliente = ClienteRepository(db_maestra).find_by_rut(rut)
    if not cliente or not cliente.activo:
        logger.warning("Recuperación de clave: RUT sin cliente activo")
        return MENSAJE_SOLICITUD

    db_tenant = crear_sesion_tenant(cliente.guid)
    try:
        usuario = UsuarioRepository(db_tenant).find_by_correo(correo)
        if not usuario or not usuario.activo:
            logger.warning(
                "Recuperación de clave: correo sin usuario activo en el cliente %s",
                cliente.guid,
            )
            return MENSAJE_SOLICITUD

        # Todo lo que se necesita del usuario se lee DENTRO de la sesión: los
        # campos salen de propiedades que descifran y necesitan el objeto vivo.
        destinatario = usuario.correo
        nombre = usuario.nombre_completo
        token = create_reset_token(
            {
                "sub": str(usuario.id),
                "guid": cliente.guid,
                "hp": _huella(usuario.password_hash),
            },
            timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
        )
    finally:
        db_tenant.close()

    enlace = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/restablecer-clave?token={token}"
    try:
        SmtpService(db_maestra).enviar(destinatario, ASUNTO, _cuerpo(nombre, enlace))
    except ErrorEnvio as e:
        logger.error("No se pudo enviar el correo de recuperación: %s", e)
        raise BadRequestException(
            "No pudimos enviar el correo en este momento. Intente más tarde o "
            "comuníquese con el administrador del sistema."
        ) from e

    logger.info("Enlace de recuperación enviado (cliente %s)", cliente.guid)
    return MENSAJE_SOLICITUD


def restablecer(db_maestra: Session, token: str, password_nueva: str) -> None:
    """Paso 2. Valida el enlace y deja la contraseña nueva puesta.

    Un enlace vencido, alterado o ya usado dan el mismo error: quien tiene el
    enlace en la mano no gana nada sabiendo cuál de las tres cosas pasó, y la
    salida es la misma —pedir otro—.
    """
    invalido = BadRequestException(
        "El enlace no es válido, ya venció o ya fue usado. Solicite uno nuevo."
    )

    payload = decode_token(token)
    if not payload or payload.get("type") != TIPO_TOKEN:
        raise invalido

    guid = payload.get("guid")
    huella = payload.get("hp")
    if not guid or not huella:
        raise invalido

    cliente = ClienteRepository(db_maestra).find_by_guid(guid)
    if not cliente or not cliente.activo:
        raise invalido

    db_tenant = crear_sesion_tenant(guid)
    try:
        usuario = UsuarioRepository(db_tenant).find_by_id(int(payload.get("sub", 0)))
        if not usuario or not usuario.activo:
            raise invalido
        if _huella(usuario.password_hash) != huella:
            # La clave cambió desde que se emitió el enlace: ya se usó éste, o
            # se usó uno posterior, o la cambió el propio usuario.
            raise invalido

        # No se pide la contraseña actual: la prueba de identidad fue recibir
        # el correo. Sí se validan formato e historial, como en cualquier otro
        # cambio.
        password_service.aplicar(
            db_tenant, usuario, password_nueva, PasswordHistorial, provisoria=False
        )
        logger.info(
            "Contraseña restablecida por correo: usuario %s del cliente %s",
            usuario.id,
            guid,
        )
    finally:
        db_tenant.close()
