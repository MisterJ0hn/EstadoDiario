"""Entrega de credenciales del OJV a sistemas externos.

Lo que más vale probar es lo que falla sin ruido: una clave que sale en claro,
que sale a una key sin permiso, o que se le entrega a quien no es su dueño
funciona exactamente igual que una correcta hasta el día que importa.
"""

import base64
import json
from unittest.mock import MagicMock, patch

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import api_key, credenciales_pjud, sello_rsa
from app.core.database import BaseMaestra, BaseTenant
from app.core.deps import TenantContexto
from app.models.maestra.api_key import ApiKey
from app.models.maestra.cliente import Cliente
from app.models.usuario import Usuario
from app.models.usuario_rut import UsuarioRut
from app.services import auditoria_service as auditoria

CLAVE_SECRETA = "ClaveSuperSecreta-123"


# ── Llaves ────────────────────────────────────────────────


def _par(bits=2048):
    privada = rsa.generate_private_key(public_exponent=65537, key_size=bits)
    pem = privada.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()
    return privada, pem


def _abrir(privada, sello: str) -> dict:
    """Lo que haría el sistema externo con su llave privada."""
    version, envuelta, nonce, cifrado = sello.split(".")
    assert version == "v1"

    def d(t):
        return base64.urlsafe_b64decode(t + "=" * (-len(t) % 4))

    dek = privada.decrypt(
        d(envuelta),
        padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None),
    )
    return json.loads(AESGCM(dek).decrypt(d(nonce), d(cifrado), sello_rsa._AAD))


@pytest.fixture(scope="module")
def par():
    return _par()


# ── Sello ─────────────────────────────────────────────────


def test_el_sello_lo_abre_solo_la_llave_privada(par):
    privada, pem = par
    sello = sello_rsa.sellar(pem, {"rut": "1-9", "clave": CLAVE_SECRETA, "metodo_login": 1})
    assert CLAVE_SECRETA not in sello
    assert _abrir(privada, sello)["clave"] == CLAVE_SECRETA
    otra, _ = _par()
    with pytest.raises(Exception):
        _abrir(otra, sello)


def test_dos_sellos_del_mismo_contenido_son_distintos(par):
    _, pem = par
    assert sello_rsa.sellar(pem, {"a": 1}) != sello_rsa.sellar(pem, {"a": 1})


def test_una_llave_debil_se_rechaza():
    _, pem = _par(1024)
    with pytest.raises(ValueError, match="2048"):
        sello_rsa.cargar_llave_publica(pem)


@pytest.mark.parametrize("basura", ["", "no soy un pem", "-----BEGIN PUBLIC KEY-----\nxx\n-----END PUBLIC KEY-----"])
def test_una_llave_ilegible_se_rechaza(basura):
    with pytest.raises(ValueError):
        sello_rsa.cargar_llave_publica(basura)


def test_la_huella_no_revela_la_llave(par):
    _, pem = par
    h = sello_rsa.huella(pem)
    assert len(h) == 64 and h not in pem


# ── Andamiaje de bases ────────────────────────────────────


@pytest.fixture()
def bases(par):
    _, pem = par
    maestra = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    BaseMaestra.metadata.create_all(maestra, tables=[Cliente.__table__, ApiKey.__table__])
    SesionM = sessionmaker(bind=maestra, autoflush=False)

    tenant = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    BaseTenant.metadata.create_all(tenant, tables=[Usuario.__table__, UsuarioRut.__table__])
    SesionT = sessionmaker(bind=tenant, autoflush=False)

    with SesionM() as db:
        cliente = Cliente(
            nombre="Estudio", guid="guid-uno", base_datos="estado_diario_guid-uno",
            estado_aprovisionamiento=Cliente.APROV_LISTO, activo=True,
        )
        cliente.rut = "11.111.111-1"
        db.add(cliente)
        db.commit()
        cliente_id = cliente.cliente_id

    with (
        patch.object(credenciales_pjud, "SesionMaestra", SesionM),
        patch.object(auditoria, "registrar_aparte") as bitacora,
    ):
        yield type("B", (), {
            "SesionM": SesionM, "SesionT": SesionT, "cliente_id": cliente_id,
            "bitacora": bitacora, "pem": pem,
        })


def _key(bases, **campos) -> str:
    key, prefijo, key_hash = api_key.generar_key()
    datos = dict(
        cliente_id=bases.cliente_id, usuario_id=42, nombre="ERP", prefijo=prefijo,
        key_hash=key_hash, permite_escritura=False, limite_por_minuto=100, activa=True,
        expone_credenciales_pjud=True, ips_permitidas="200.1.2.3", llave_publica_pem=bases.pem,
    )
    datos.update(campos)
    with bases.SesionM() as db:
        db.add(ApiKey(**datos))
        db.commit()
    return key


def _abogado(db, nombre, rut_archivo, *, pjud_rut="12.345.678-5", clave=CLAVE_SECRETA, activo=True):
    u = Usuario(password_hash="x", nombre=nombre, activo=activo, es_integracion=False)
    u.usuario = f"{nombre.lower()}@estudio.cl"
    u.pjud_rut = pjud_rut
    u.pjud_clave = clave
    u.pjud_metodo_login = 2
    db.add(u)
    db.flush()
    r = UsuarioRut(usuario_id=u.id)
    r.rut = rut_archivo
    db.add(r)
    db.commit()
    return u


def _request(ip="200.1.2.3"):
    req = MagicMock()
    req.url.path = "/api/v1/causas"
    req.headers = {}
    req.client.host = ip
    return req


def _tenant():
    return TenantContexto(guid="guid-uno", cliente_id=1, usuario_id=42)


def _dependencia(bases, key, incluir=True):
    return credenciales_pjud.sellador_solicitado(
        request=_request(), response=MagicMock(headers={}), incluir_credenciales=incluir,
        x_api_key=key, tenant=_tenant(),
    )


# ── Quién puede pedirlas ──────────────────────────────────


def test_sin_pedirlas_no_hay_sellador_aunque_la_key_pueda(bases):
    assert _dependencia(bases, _key(bases), incluir=False) is None


def test_key_autorizada_recibe_sellador_y_cache_no_store(bases):
    resp = MagicMock(headers={})
    s = credenciales_pjud.sellador_solicitado(
        request=_request(), response=resp, incluir_credenciales=True,
        x_api_key=_key(bases), tenant=_tenant(),
    )
    assert s is not None and s.llave_publica_pem == bases.pem
    assert resp.headers["Cache-Control"] == "no-store"


@pytest.mark.parametrize(
    "campos",
    [
        {"expone_credenciales_pjud": False},
        {"ips_permitidas": None},
        {"ips_permitidas": ""},
        {"llave_publica_pem": None},
    ],
)
def test_key_sin_permiso_o_sin_proteccion_recibe_403_y_queda_registrado(bases, campos):
    with pytest.raises(HTTPException) as e:
        _dependencia(bases, _key(bases, **campos))
    assert e.value.status_code == 403
    assert auditoria.ACCION_API_KEY_DENEGADO in [c.args[2] for c in bases.bitacora.call_args_list]


def test_una_sesion_de_persona_nunca_recibe_credenciales(bases):
    with pytest.raises(HTTPException) as e:
        _dependencia(bases, None)
    assert e.value.status_code == 403


# ── A quién pertenecen ────────────────────────────────────


def _sellador(bases):
    return credenciales_pjud.Sellador(
        api_key_id=1, prefijo="ed_abc", guid="guid-uno", usuario_id=42,
        ip="200.1.2.3", ruta="/api/v1/causas", llave_publica_pem=bases.pem,
    )


def test_entrega_la_credencial_del_abogado_dueno_y_nadie_mas(bases, par):
    privada, _ = par
    with bases.SesionT() as db:
        _abogado(db, "Ana", "16952077-1")
        _abogado(db, "Beto", "99999999-9", pjud_rut="9.999.999-9", clave="otra-clave")
        e = _sellador(bases).entregar(db, ["16952077-1", "16.952.077-1", None, "55555555-5"])

    assert e.refs == ["c1", "c1", None, None]
    assert list(e.credenciales_pjud) == ["c1"]
    contenido = _abrir(privada, e.credenciales_pjud["c1"])
    assert contenido == {"rut": "12.345.678-5", "clave": CLAVE_SECRETA, "metodo_login": 2}


def test_archivo_sin_digito_verificador_calza_por_el_cuerpo(bases):
    with bases.SesionT() as db:
        _abogado(db, "Ana", "16952077-1")
        e = _sellador(bases).entregar(db, ["16952077"])
    assert e.refs == ["c1"]


def test_rut_que_calza_con_dos_usuarios_no_entrega_a_ninguno(bases):
    with bases.SesionT() as db:
        _abogado(db, "Ana", "16952077-1")
        _abogado(db, "Beto", "16952077-1")
        e = _sellador(bases).entregar(db, ["16952077-1"])
    assert e.refs == [None] and e.credenciales_pjud == {}


def test_usuario_desactivado_no_entrega(bases):
    with bases.SesionT() as db:
        _abogado(db, "Ana", "16952077-1", activo=False)
        assert _sellador(bases).entregar(db, ["16952077-1"]).refs == [None]


def test_abogado_sin_credenciales_cargadas_no_entrega(bases):
    with bases.SesionT() as db:
        _abogado(db, "Ana", "16952077-1", pjud_rut=None, clave="")
        assert _sellador(bases).entregar(db, ["16952077-1"]).refs == [None]


# ── Rastro ────────────────────────────────────────────────


def test_cada_entrega_se_audita_sin_el_contenido(bases):
    with bases.SesionT() as db:
        u = _abogado(db, "Ana", "16952077-1")
        _sellador(bases).entregar(db, ["16952077-1"])

    llamada = bases.bitacora.call_args
    assert llamada.args[2] == auditoria.ACCION_API_KEY_CREDENCIALES
    detalle = llamada.kwargs["detalle"]
    assert f"usuarios={u.id}" in detalle and "entregadas=1" in detalle
    assert CLAVE_SECRETA not in detalle and "12.345.678-5" not in detalle
    assert llamada.kwargs["ip"] == "200.1.2.3"


@pytest.fixture()
def sin_plataforma():
    """La plataforma sin api-pjud configurada, sea cual sea el .env de quien corre."""
    with (
        patch.object(credenciales_pjud.settings, "PJUD_API_EMAIL", ""),
        patch.object(credenciales_pjud.settings, "PJUD_API_PASSWORD", ""),
    ):
        yield


def test_sin_nadie_que_entregar_no_se_audita(bases, sin_plataforma):
    with bases.SesionT() as db:
        _sellador(bases).entregar(db, ["16952077-1", None])
    bases.bitacora.assert_not_called()


# ── Conexión de la plataforma a api-pjud ──────────────────

CLAVE_PLATAFORMA = "clave-de-la-plataforma-xyz"


@pytest.fixture()
def plataforma():
    with (
        patch.object(credenciales_pjud.settings, "PJUD_API_BASE_URL", "http://api-pjud.test"),
        patch.object(credenciales_pjud.settings, "PJUD_API_EMAIL", "plataforma@temposoft.cl"),
        patch.object(credenciales_pjud.settings, "PJUD_API_PASSWORD", CLAVE_PLATAFORMA),
        patch.object(credenciales_pjud.settings, "PJUD_API_CLIENT_KEY", "ck-123"),
    ):
        yield


def _habilitar_pjud(bases, valor: bool):
    with bases.SesionM() as db:
        db.get(Cliente, bases.cliente_id).pjud_habilitado = valor
        db.commit()


def test_con_pjud_habilitado_entrega_la_conexion_a_api_pjud_sellada(bases, par, plataforma):
    privada, _ = par
    entrega = _sellador(bases).entregar(MagicMock(), [])
    assert entrega.pjud_habilitado is True
    assert _abrir(privada, entrega.api_pjud) == {
        "base_url": "http://api-pjud.test", "email": "plataforma@temposoft.cl",
        "password": CLAVE_PLATAFORMA, "client_key": "ck-123",
    }
    assert CLAVE_PLATAFORMA not in entrega.api_pjud
    # Se audita que se entregó, sin el contenido.
    llamada = bases.bitacora.call_args
    assert "api_pjud=si" in llamada.kwargs["detalle"]
    assert CLAVE_PLATAFORMA not in llamada.kwargs["detalle"]


def test_sin_api_pjud_configurada_no_hay_conexion_que_entregar(bases, sin_plataforma):
    entrega = _sellador(bases).entregar(MagicMock(), [])
    assert entrega.api_pjud is None and entrega.pjud_habilitado is True


def test_con_pjud_deshabilitado_no_se_entrega_ninguna_credencial(bases, plataforma):
    with bases.SesionT() as db:
        _abogado(db, "Ana", "16952077-1")
        s = credenciales_pjud.Sellador(
            api_key_id=1, prefijo="ed_abc", guid="guid-uno", usuario_id=42,
            ip="200.1.2.3", ruta="/api/v1/causas", llave_publica_pem=bases.pem,
            pjud_habilitado=False,
        )
        entrega = s.entregar(db, ["16952077-1", None])
    assert entrega.refs == [None, None]
    assert entrega.credenciales_pjud == {} and entrega.api_pjud is None
    assert entrega.pjud_habilitado is False
    bases.bitacora.assert_not_called()


def test_el_sellador_toma_pjud_habilitado_del_cliente(bases):
    _habilitar_pjud(bases, False)
    assert _dependencia(bases, _key(bases)).pjud_habilitado is False
    # No es un 403: queda registrado que se pidió y no se dio.
    assert auditoria.ACCION_API_KEY_DENEGADO in [c.args[2] for c in bases.bitacora.call_args_list]

    bases.bitacora.reset_mock()
    _habilitar_pjud(bases, True)
    assert _dependencia(bases, _key(bases)).pjud_habilitado is True
    bases.bitacora.assert_not_called()
