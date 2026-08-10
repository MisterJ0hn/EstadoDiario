"""El token del enlace de recuperación de contraseña.

Lo que se prueba acá son las dos propiedades de las que depende que el enlace
sea seguro, y que no fallan de forma visible si se rompen: que no sirva como
sesión, y que valga una sola vez. Un enlace que además abriera la aplicación, o
que se pudiera reusar, funcionaría igual de bien para el usuario.

El envío del correo y la búsqueda en la base del cliente necesitan SMTP y
PostgreSQL; eso no se prueba acá.
"""

from datetime import timedelta

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api.v1.endpoints.auth import _payload_valido
from app.core.security import create_reset_token, decode_token, get_password_hash
from app.services.password_reset_service import TIPO_TOKEN, _huella


@pytest.fixture
def token():
    return create_reset_token(
        {"sub": "7", "guid": "abc-123", "hp": _huella("hash-vigente")},
        timedelta(minutes=30),
    )


def test_el_token_del_enlace_no_abre_sesion(token):
    """Lleva otro `type`: si `_payload_valido` lo aceptara, el enlace del
    correo sería una sesión completa y no solo un permiso para cambiar la
    clave."""
    with pytest.raises(HTTPException) as e:
        _payload_valido(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
    assert e.value.status_code == 401


def test_el_token_dice_a_que_base_pertenece(token):
    # Sin el guid no habría cómo saber en qué base está el usuario: el correo
    # de recuperación sale antes de que exista sesión.
    payload = decode_token(token)
    assert payload["type"] == TIPO_TOKEN
    assert payload["guid"] == "abc-123"


def test_un_token_vencido_no_se_decodifica():
    vencido = create_reset_token({"sub": "7"}, timedelta(minutes=-1))
    assert decode_token(vencido) is None


def test_la_huella_cambia_al_cambiar_la_contrasena():
    """Es lo que hace que el enlace valga una sola vez: usado el enlace, el
    hash del usuario es otro y la huella del token deja de calzar."""
    antes = get_password_hash("Inicial1")
    despues = get_password_hash("Segunda22")
    assert _huella(antes) != _huella(despues)


def test_la_huella_no_deja_ver_el_hash():
    # El hash bcrypt viajando en un correo es material para atacar sin límite
    # de intentos; la huella no permite probar contraseñas.
    hash_ = get_password_hash("Inicial1")
    assert hash_ not in _huella(hash_)
    assert len(_huella(hash_)) == 32
