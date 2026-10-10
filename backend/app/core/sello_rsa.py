"""Sello criptográfico para entregar un secreto a un sistema externo.

Puro: sin base de datos ni FastAPI, para que lo use también la consola de
administración al validar la llave que se carga (ver `credenciales_pjud.py` para
el porqué y el modelo de seguridad completo).
"""

import base64
import hashlib
import json
import os

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

TAMANO_MINIMO_RSA = 2048
VERSION_SELLO = "v1"
# Amarra el sello a este uso: un sello robado no sirve para otro contexto.
_AAD = b"estado-diario/credenciales-pjud/v1"


def _b64(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).decode().rstrip("=")


def cargar_llave_publica(pem: str) -> rsa.RSAPublicKey:
    """La llave pública RSA del PEM, o `ValueError` si no sirve.

    Se exige un tamaño mínimo: una llave de 512 bits "sella" igual, pero se
    factoriza en horas, y nadie lo notaría mirando la respuesta.
    """
    try:
        llave = serialization.load_pem_public_key((pem or "").strip().encode())
    except Exception as e:  # noqa: BLE001 — cualquier PEM roto es el mismo error para quien lo carga
        raise ValueError("La llave pública no es un PEM válido") from e
    if not isinstance(llave, rsa.RSAPublicKey):
        raise ValueError("La llave pública debe ser RSA")
    if llave.key_size < TAMANO_MINIMO_RSA:
        raise ValueError(f"La llave RSA debe ser de al menos {TAMANO_MINIMO_RSA} bits")
    return llave


def huella(pem: str) -> str:
    """SHA-256 de la llave (formato SPKI/DER), para reconocerla sin mostrarla."""
    der = cargar_llave_publica(pem).public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return hashlib.sha256(der).hexdigest()


def sellar(pem: str, contenido: dict) -> str:
    """`v1.<llave AES cifrada con RSA-OAEP-SHA256>.<nonce>.<texto cifrado AES-GCM>`,
    todo en base64 URL-safe sin relleno. Una llave AES nueva por sello."""
    llave = cargar_llave_publica(pem)
    dek = AESGCM.generate_key(bit_length=256)
    nonce = os.urandom(12)
    cifrado = AESGCM(dek).encrypt(nonce, json.dumps(contenido).encode(), _AAD)
    envuelta = llave.encrypt(
        dek,
        padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None),
    )
    return ".".join((VERSION_SELLO, _b64(envuelta), _b64(nonce), _b64(cifrado)))
