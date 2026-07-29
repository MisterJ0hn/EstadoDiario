"""Cifrado simétrico para credenciales que hay que recuperar en claro.

La contraseña de la casilla de correo no se puede hashear: se necesita el
valor original para el LOGIN de IMAP. Por eso se cifra con Fernet en vez de
usar el hash de passlib que ocupan los usuarios.

La clave sale de MAIL_ENCRYPTION_KEY si está definida; si no, se deriva de
BACKEND_SECRET_KEY. OJO: cambiar cualquiera de las dos deja ilegible la
contraseña ya guardada, y hay que volver a escribirla desde la UI.
"""

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_key() -> bytes:
    if settings.MAIL_ENCRYPTION_KEY:
        return settings.MAIL_ENCRYPTION_KEY.encode()
    # Fernet exige 32 bytes en base64 urlsafe; el SECRET_KEY es texto libre.
    digest = hashlib.sha256(settings.BACKEND_SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet() -> Fernet:
    return Fernet(_build_key())


def cifrar(valor: str) -> str:
    """Cifra un texto plano. Devuelve el token listo para guardar en la BD."""
    if valor is None:
        raise ValueError("No se puede cifrar un valor nulo")
    return _fernet().encrypt(valor.encode()).decode()


def descifrar(token: str) -> str:
    """Descifra un token. Lanza ValueError si la clave cambió o el dato está corrupto."""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise ValueError(
            "No se pudo descifrar la contraseña guardada. "
            "Probablemente cambió MAIL_ENCRYPTION_KEY o BACKEND_SECRET_KEY; "
            "vuelva a guardar la configuración de correo."
        ) from exc
