"""API keys de sistemas externos.

La base principal se reemplaza por SQLite en memoria y la bitácora por un mock:
no se toca PostgreSQL ni la base de ningún cliente.

Lo que más vale probar acá es lo que falla **sin ruido**. Una key que lee lo que
no debe, que escribe fuera de causas, que sigue valiendo después de revocada o
que no se frena con el límite funciona exactamente igual que una correcta hasta
el día que importa. Por eso los casos son, casi uno a uno, formas de quedar
abierto.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import api_key
from app.core.database import BaseMaestra
from app.core.deps import get_tenant_actual
from app.core.esquema import COLUMNAS_NUEVAS_TENANT
from app.models.maestra.api_key import ApiKey, ApiKeyUso
from app.models.maestra.cliente import Cliente
from app.models.usuario import Usuario
from app.services import auditoria_service as auditoria


# ── Andamiaje ─────────────────────────────────────────────


@pytest.fixture()
def base():
    """SQLite en memoria con las tres tablas que toca el módulo, y un cliente."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    BaseMaestra.metadata.create_all(
        engine, tables=[Cliente.__table__, ApiKey.__table__, ApiKeyUso.__table__]
    )
    Sesion = sessionmaker(bind=engine, autoflush=False)

    with Sesion() as db:
        cliente = Cliente(
            nombre="Estudio Uno",
            guid="guid-uno",
            base_datos="estado_diario_guid-uno",
            estado_aprovisionamiento=Cliente.APROV_LISTO,
            activo=True,
        )
        cliente.rut = "11.111.111-1"
        db.add(cliente)
        db.commit()
        cliente_id = cliente.cliente_id

    api_key._ultima_auditoria_ip.clear()
    with (
        patch.object(api_key, "engine_maestro", engine),
        patch.object(api_key, "SesionMaestra", Sesion),
        patch.object(auditoria, "registrar_aparte") as bitacora,
    ):
        yield type("Base", (), {"Sesion": Sesion, "cliente_id": cliente_id, "bitacora": bitacora})


def _emitir(base, **campos) -> str:
    """Crea una key y devuelve la key en claro."""
    key, prefijo, key_hash = api_key.generar_key()
    datos = dict(
        cliente_id=base.cliente_id,
        usuario_id=42,
        nombre="Sistema externo",
        prefijo=prefijo,
        key_hash=key_hash,
        permite_escritura=False,
        limite_por_minuto=100,
        activa=True,
    )
    datos.update(campos)
    with base.Sesion() as db:
        db.add(ApiKey(**datos))
        db.commit()
    return key


def _acciones(base) -> list[str]:
    return [c.args[2] for c in base.bitacora.call_args_list]


def _status(exc_info) -> int:
    return exc_info.value.status_code


# ── La key ────────────────────────────────────────────────


def test_la_key_lleva_prefijo_reconocible_y_es_larga():
    key, prefijo, _ = api_key.generar_key()
    assert key.startswith(api_key.PREFIJO_KEY)
    assert key.startswith(prefijo)
    assert len(key) >= 40


def test_dos_keys_nunca_coinciden():
    assert api_key.generar_key()[0] != api_key.generar_key()[0]


def test_el_hash_es_el_de_la_key_y_no_la_key():
    key, _, h = api_key.generar_key()
    assert h == api_key.hash_key(key)
    assert key not in h and len(h) == 64


def test_la_tabla_no_tiene_donde_guardar_la_key_en_claro():
    columnas = set(ApiKey.__table__.columns.keys())
    assert "key_hash" in columnas
    assert not columnas & {"key", "api_key", "secret", "token"}


# ── Permisos: la regla de seguridad del módulo ────────────


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/causas",
        "/api/v1/causas/resumen",
        "/api/v1/estado-diario",
        "/api/v1/movimientos/algo",
        "/api/v1/audiencias",
        "/api/v1/reportes/x",
        "/api/v1/dashboard",
        "/api/v1/jurisdicciones",
    ],
)
def test_lee_los_modulos_operativos(path):
    assert api_key.motivo_de_denegacion("GET", path, permite_escritura=False) is None


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/auth/me",
        "/api/v1/auth/login",
        "/api/v1/pagos/iniciar",
        "/api/v1/facturas",
        "/api/v1/configuracion-correo",
        "/api/v1/google-calendar/conectar",
        "/api/v1/causasfoo",  # el borde del prefijo: no es /causas
        "/otra/cosa",
    ],
)
def test_no_lee_lo_que_no_esta_en_la_lista(path):
    assert api_key.motivo_de_denegacion("GET", path, permite_escritura=True) == "modulo_no_permitido"


def test_una_key_solo_lectura_no_escribe_ni_en_causas():
    assert (
        api_key.motivo_de_denegacion("POST", "/api/v1/causas/upload", permite_escritura=False)
        == "key_solo_lectura"
    )


def test_una_key_con_escritura_escribe_en_causas():
    assert (
        api_key.motivo_de_denegacion("POST", "/api/v1/causas/upload", permite_escritura=True)
        is None
    )


@pytest.mark.parametrize("metodo", ["POST", "PUT", "PATCH", "DELETE"])
@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/estado-diario/algo",
        "/api/v1/movimientos/upload",
        "/api/v1/audiencias/upload",
        "/api/v1/auth/change-password",
        "/api/v1/pagos/iniciar",
        "/api/v1/causasfoo/upload",
    ],
)
def test_escribir_fuera_de_causas_se_deniega_aun_con_permiso(metodo, path):
    assert api_key.motivo_de_denegacion(metodo, path, permite_escritura=True) is not None


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/causas/../auth/me",
        "/api/v1/causas/../../pagos",
        "/api/v1//causas",
    ],
)
def test_rutas_con_dobles_puntos_o_barras_se_cortan(path):
    assert api_key.motivo_de_denegacion("GET", path, True) == "ruta_sospechosa"


def test_los_prefijos_de_escritura_propios_reemplazan_al_defecto():
    propios = ("/api/v1/audiencias",)
    assert api_key.motivo_de_denegacion("POST", "/api/v1/audiencias/u", True, propios) is None
    assert api_key.motivo_de_denegacion("POST", "/api/v1/causas/upload", True, propios) is not None


def test_prefijos_de_escritura_mal_escritos_no_abren_nada():
    # Una lista vacía o de puros espacios cae al defecto, no a "todo".
    fila = ApiKey(prefijos_escritura=" , ")
    assert api_key.prefijos_de_escritura(fila) == api_key.PREFIJOS_ESCRITURA_DEFECTO


# ── Autenticación ─────────────────────────────────────────


def test_key_valida_resuelve_al_tenant_de_la_key(base):
    key = _emitir(base)
    identidad = api_key.autenticar(key, "GET", "/api/v1/causas", ip="1.2.3.4")
    assert identidad.guid == "guid-uno"
    assert identidad.cliente_id == base.cliente_id
    assert identidad.usuario_id == 42


def test_key_desconocida_da_401(base):
    with pytest.raises(HTTPException) as e:
        api_key.autenticar("ed_inventada", "GET", "/api/v1/causas")
    assert _status(e) == 401


def test_key_revocada_da_401_y_es_inmediata(base):
    key = _emitir(base)
    api_key.autenticar(key, "GET", "/api/v1/causas")  # antes de revocar, pasa
    with base.Sesion() as db:
        fila = db.query(ApiKey).one()
        fila.activa = False
        fila.revocada_en = datetime.now(timezone.utc)
        db.commit()
    with pytest.raises(HTTPException) as e:
        api_key.autenticar(key, "GET", "/api/v1/causas")
    assert _status(e) == 401


def test_key_vencida_da_401(base):
    key = _emitir(base, expira_en=datetime.now(timezone.utc) - timedelta(seconds=1))
    with pytest.raises(HTTPException) as e:
        api_key.autenticar(key, "GET", "/api/v1/causas")
    assert _status(e) == 401


def test_key_con_vencimiento_futuro_pasa(base):
    key = _emitir(base, expira_en=datetime.now(timezone.utc) + timedelta(days=1))
    assert api_key.autenticar(key, "GET", "/api/v1/causas").guid == "guid-uno"


def test_cliente_suspendido_no_entra_por_la_key(base):
    key = _emitir(base)
    with base.Sesion() as db:
        db.get(Cliente, base.cliente_id).activo = False
        db.commit()
    with pytest.raises(HTTPException) as e:
        api_key.autenticar(key, "GET", "/api/v1/causas")
    assert _status(e) == 401


def test_cliente_sin_base_lista_no_entra(base):
    key = _emitir(base)
    with base.Sesion() as db:
        db.get(Cliente, base.cliente_id).estado_aprovisionamiento = Cliente.APROV_ERROR
        db.commit()
    with pytest.raises(HTTPException) as e:
        api_key.autenticar(key, "GET", "/api/v1/causas")
    assert _status(e) == 401


def test_todos_los_401_dicen_lo_mismo(base):
    """Distinguir "no existe" de "revocada" le diría a quien prueba cuáles sí existieron."""
    revocada = _emitir(base, activa=False)
    mensajes = set()
    for k in ("ed_inventada", revocada):
        with pytest.raises(HTTPException) as e:
            api_key.autenticar(k, "GET", "/api/v1/causas")
        mensajes.add(e.value.detail)
    assert mensajes == {api_key.MENSAJE_KEY_INVALIDA}


def test_la_key_en_claro_no_llega_al_log(base, caplog):
    key = _emitir(base, activa=False)
    with caplog.at_level("DEBUG"), pytest.raises(HTTPException):
        api_key.autenticar(key, "GET", "/api/v1/causas")
    with pytest.raises(HTTPException), caplog.at_level("DEBUG"):
        api_key.autenticar("ed_secreta_de_prueba_123", "GET", "/api/v1/causas")
    assert key not in caplog.text
    assert "ed_secreta_de_prueba_123" not in caplog.text


# ── Denegaciones y auditoría ──────────────────────────────


def test_escribir_sin_permiso_da_403_y_queda_en_la_bitacora(base):
    key = _emitir(base, permite_escritura=False)
    with pytest.raises(HTTPException) as e:
        api_key.autenticar(key, "POST", "/api/v1/causas/upload", ip="9.9.9.9")
    assert _status(e) == 403
    assert _acciones(base) == [auditoria.ACCION_API_KEY_DENEGADO]
    assert "key_solo_lectura" in base.bitacora.call_args.kwargs["detalle"]


def test_escribir_fuera_de_causas_da_403(base):
    key = _emitir(base, permite_escritura=True)
    with pytest.raises(HTTPException) as e:
        api_key.autenticar(key, "POST", "/api/v1/estado-diario/algo")
    assert _status(e) == 403


def test_escritura_permitida_deja_rastro_con_ip_y_prefijo(base):
    key = _emitir(base, permite_escritura=True)
    api_key.autenticar(key, "POST", "/api/v1/causas/upload", ip="5.6.7.8")
    assert _acciones(base) == [auditoria.ACCION_API_KEY_ESCRITURA]
    kwargs = base.bitacora.call_args.kwargs
    assert kwargs["ip"] == "5.6.7.8"
    assert kwargs["usuario_id"] == 42
    assert key[: api_key.LARGO_PREFIJO_VISIBLE] in kwargs["detalle"]
    assert key not in kwargs["detalle"]


def test_las_lecturas_no_llenan_la_bitacora(base):
    key = _emitir(base)
    for _ in range(5):
        api_key.autenticar(key, "GET", "/api/v1/causas")
    assert base.bitacora.call_count == 0


def test_actualiza_ultimo_uso_y_ip(base):
    key = _emitir(base)
    api_key.autenticar(key, "GET", "/api/v1/causas", ip="7.7.7.7")
    with base.Sesion() as db:
        fila = db.query(ApiKey).one()
        assert fila.ultimo_uso is not None
        assert fila.ultimo_ip == "7.7.7.7"


# ── Límite de velocidad ───────────────────────────────────


def test_el_limite_corta_con_429_y_retry_after(base):
    key = _emitir(base, limite_por_minuto=3)
    for _ in range(3):
        api_key.autenticar(key, "GET", "/api/v1/causas")
    with pytest.raises(HTTPException) as e:
        api_key.autenticar(key, "GET", "/api/v1/causas")
    assert _status(e) == 429
    assert 1 <= int(e.value.headers["Retry-After"]) <= 61


def test_el_exceso_se_registra_una_sola_vez_por_ventana(base):
    key = _emitir(base, limite_por_minuto=1)
    api_key.autenticar(key, "GET", "/api/v1/causas")
    for _ in range(10):
        with pytest.raises(HTTPException):
            api_key.autenticar(key, "GET", "/api/v1/causas")
    assert _acciones(base).count(auditoria.ACCION_API_KEY_LIMITE) == 1


def test_el_limite_es_por_key(base):
    a = _emitir(base, limite_por_minuto=1)
    b = _emitir(base, limite_por_minuto=1)
    api_key.autenticar(a, "GET", "/api/v1/causas")
    with pytest.raises(HTTPException):
        api_key.autenticar(a, "GET", "/api/v1/causas")
    # La otra no se entera.
    assert api_key.autenticar(b, "GET", "/api/v1/causas").guid == "guid-uno"


def test_la_ventana_siguiente_parte_de_cero(base):
    key = _emitir(base, limite_por_minuto=1)
    with base.Sesion() as db:
        api_key_id = db.query(ApiKey).one().id
    t0 = datetime(2026, 1, 1, 12, 0, 30, tzinfo=timezone.utc)
    assert api_key.consumir_cupo(api_key_id, 1, t0)[0] is True
    assert api_key.consumir_cupo(api_key_id, 1, t0)[0] is False
    # Un minuto después: ventana nueva.
    assert api_key.consumir_cupo(api_key_id, 1, t0 + timedelta(minutes=1))[0] is True


def test_una_peticion_prohibida_tambien_cuenta_para_el_limite(base):
    key = _emitir(base, limite_por_minuto=2, permite_escritura=False)
    for _ in range(2):
        with pytest.raises(HTTPException) as e:
            api_key.autenticar(key, "POST", "/api/v1/causas/upload")
        assert _status(e) == 403
    with pytest.raises(HTTPException) as e:
        api_key.autenticar(key, "POST", "/api/v1/causas/upload")
    assert _status(e) == 429


def test_si_el_contador_falla_se_deja_pasar(base):
    with patch.object(api_key, "_incrementar", side_effect=RuntimeError("base caída")):
        dentro, _, _ = api_key.consumir_cupo(1, 1)
    assert dentro is True


# ── Integración con get_tenant_actual ─────────────────────


class _Req:
    """Lo mínimo que lee `get_tenant_actual` de la request."""

    def __init__(self, metodo="GET", path="/api/v1/causas", ip="1.1.1.1"):
        self.method = metodo
        self.url = type("U", (), {"path": path})()
        self.headers = {"x-forwarded-for": ip}
        self.client = None


def _tenant(base, key, guid_header=None, credenciales=None, **req):
    return get_tenant_actual(
        credenciales,
        x_cliente_guid=guid_header,
        x_api_key=key,
        request=_Req(**req),
    )


def test_get_tenant_actual_con_key_entrega_el_tenant_de_la_key(base):
    key = _emitir(base)
    contexto = _tenant(base, key)
    assert contexto.guid == "guid-uno"
    assert contexto.cliente_id == base.cliente_id
    assert contexto.usuario_id == 42


def test_el_header_de_cliente_no_puede_cambiar_el_tenant_de_una_key(base):
    key = _emitir(base)
    with pytest.raises(HTTPException) as e:
        _tenant(base, key, guid_header="guid-de-otro")
    assert _status(e) == 403


def test_key_y_bearer_juntos_se_rechazan(base):
    from fastapi.security import HTTPAuthorizationCredentials

    key = _emitir(base)
    cred = HTTPAuthorizationCredentials(scheme="Bearer", credentials="x")
    with pytest.raises(HTTPException) as e:
        _tenant(base, key, credenciales=cred)
    assert _status(e) == 400


def test_sin_ninguna_credencial_sigue_dando_403(base):
    with pytest.raises(HTTPException) as e:
        _tenant(base, None)
    assert _status(e) == 403


# ── Esquema ───────────────────────────────────────────────


def test_es_integracion_esta_en_el_modelo_y_en_la_migracion():
    # Sin la entrada de esquema, funciona en una base nueva y revienta en
    # producción con UndefinedColumn (ver app/core/esquema.py).
    assert "es_integracion" in Usuario.__table__.columns
    assert ("usuario", "es_integracion", "BOOLEAN DEFAULT FALSE") in COLUMNAS_NUEVAS_TENANT


# ── De punta a punta por HTTP ─────────────────────────────
#
# Los tests de arriba llaman a `get_tenant_actual` como función. Este pasa por
# FastAPI de verdad, que es quien inyecta la `Request` y lee `X-API-Key`: si esa
# declaración estuviera mal, todo lo anterior seguiría en verde.


@pytest.fixture()
def cliente_http(base):
    from fastapi import Depends, FastAPI
    from fastapi.testclient import TestClient

    from app.core.deps import TenantContexto

    app = FastAPI()

    @app.get("/api/v1/causas")
    def leer(t: TenantContexto = Depends(get_tenant_actual)):
        return {"guid": t.guid, "usuario_id": t.usuario_id}

    @app.post("/api/v1/causas/upload")
    def escribir(t: TenantContexto = Depends(get_tenant_actual)):
        return {"ok": True}

    @app.get("/api/v1/auth/me")
    def prohibido(t: TenantContexto = Depends(get_tenant_actual)):
        return {"ok": True}

    return TestClient(app)


def test_http_key_valida_lee(base, cliente_http):
    key = _emitir(base)
    r = cliente_http.get("/api/v1/causas", headers={"X-API-Key": key})
    assert r.status_code == 200
    assert r.json() == {"guid": "guid-uno", "usuario_id": 42}


def test_http_sin_credenciales_da_403(base, cliente_http):
    assert cliente_http.get("/api/v1/causas").status_code == 403


def test_http_key_mala_da_401(base, cliente_http):
    r = cliente_http.get("/api/v1/causas", headers={"X-API-Key": "ed_mala"})
    assert r.status_code == 401
    assert r.json()["detail"] == api_key.MENSAJE_KEY_INVALIDA


def test_http_escritura_segun_permiso(base, cliente_http):
    solo_lee = _emitir(base)
    escribe = _emitir(base, permite_escritura=True)
    assert cliente_http.post("/api/v1/causas/upload", headers={"X-API-Key": solo_lee}).status_code == 403
    assert cliente_http.post("/api/v1/causas/upload", headers={"X-API-Key": escribe}).status_code == 200


def test_http_no_entra_a_auth_ni_con_escritura(base, cliente_http):
    key = _emitir(base, permite_escritura=True)
    assert cliente_http.get("/api/v1/auth/me", headers={"X-API-Key": key}).status_code == 403


def test_http_429_trae_retry_after(base, cliente_http):
    key = _emitir(base, limite_por_minuto=1)
    h = {"X-API-Key": key}
    assert cliente_http.get("/api/v1/causas", headers=h).status_code == 200
    r = cliente_http.get("/api/v1/causas", headers=h)
    assert r.status_code == 429
    assert "retry-after" in r.headers


def test_http_la_ip_es_la_que_agrego_el_proxy_no_la_primera(base, cliente_http):
    key = _emitir(base, permite_escritura=True)
    # Nginx agrega la IP real al final: "<lo que mandó el cliente>, <IP real>".
    cliente_http.post(
        "/api/v1/causas/upload", headers={"X-API-Key": key, "X-Forwarded-For": "8.8.8.8, 10.0.0.1"}
    )
    assert base.bitacora.call_args.kwargs["ip"] == "10.0.0.1"


# ── IPs permitidas ────────────────────────────────────────


def test_normalizar_ips_deja_la_forma_canonica_y_quita_repetidas():
    assert api_key.normalizar_ips(
        [" 200.1.2.3 ", "200.1.2.3", "200.1.2.3/24", "", "2001:DB8::1"]
    ) == ["200.1.2.3", "200.1.2.0/24", "2001:db8::1"]


@pytest.mark.parametrize("malo", ["999.1.1.1", "abc", "200.1.2.3/40", "200.1.2", "1.2.3.4-1.2.3.9"])
def test_normalizar_ips_rechaza_lo_que_no_es_una_ip(malo):
    with pytest.raises(ValueError):
        api_key.normalizar_ips(["200.1.2.3", malo])


def _redes(texto):
    return api_key.ips_de(ApiKey(id=1, ips_permitidas=texto))


def test_una_ip_calza_con_ip_suelta_y_con_rango():
    redes = _redes("200.1.2.3,10.0.0.0/8,2001:db8::/32")
    assert api_key.ip_en_redes("200.1.2.3", redes)
    assert api_key.ip_en_redes("10.9.9.9", redes)
    assert api_key.ip_en_redes("2001:db8::55", redes)
    assert not api_key.ip_en_redes("200.1.2.4", redes)
    assert not api_key.ip_en_redes("11.0.0.1", redes)


def test_una_ipv4_mapeada_en_ipv6_es_la_misma_maquina():
    assert api_key.ip_en_redes("::ffff:200.1.2.3", _redes("200.1.2.3"))


@pytest.mark.parametrize("ip", [None, "", "no-es-una-ip", "200.1.2"])
def test_una_ip_ilegible_nunca_calza(ip):
    assert not api_key.ip_en_redes(ip, _redes("200.1.2.3"))


def test_sin_restriccion_la_lista_esta_vacia():
    assert _redes(None) == [] and _redes("") == []


def test_una_lista_corrupta_en_la_base_cierra_la_key_en_vez_de_abrirla():
    redes = _redes("esto-no-es-una-ip")
    assert redes  # sigue "con restricción"
    assert not api_key.ip_en_redes("200.1.2.3", redes)


class _Peticion:
    def __init__(self, xff=None, host=None):
        from types import SimpleNamespace

        self.headers = {"x-forwarded-for": xff} if xff is not None else {}
        self.client = SimpleNamespace(host=host) if host else None


def test_la_ip_es_la_que_agrego_el_proxy_y_no_la_que_mando_el_cliente():
    """El ataque: mandar `X-Forwarded-For` con una IP permitida. Nginx agrega la
    real al final, así que la primera es del atacante y la última es de fiar."""
    req = _Peticion(xff="200.1.2.3, 9.9.9.9")
    assert api_key.ip_confiable(req) == "9.9.9.9"


def test_con_dos_proxies_se_toma_la_entrada_que_dejan_a_la_derecha():
    req = _Peticion(xff="200.1.2.3, 9.9.9.9, 172.18.0.2")
    with patch.object(api_key.settings, "API_KEY_PROXIES_CONFIABLES", 2):
        assert api_key.ip_confiable(req) == "9.9.9.9"


def test_con_menos_entradas_que_proxies_se_usa_la_ip_del_socket():
    # Llegó sin pasar por todos los proxies: no se le cree al encabezado.
    req = _Peticion(xff="200.1.2.3", host="172.18.0.2")
    with patch.object(api_key.settings, "API_KEY_PROXIES_CONFIABLES", 2):
        assert api_key.ip_confiable(req) == "172.18.0.2"


def test_sin_encabezado_se_usa_la_ip_del_socket():
    assert api_key.ip_confiable(_Peticion(host="9.9.9.9")) == "9.9.9.9"
    assert api_key.ip_confiable(_Peticion()) is None


def test_desde_una_ip_permitida_entra(base):
    key = _emitir(base, ips_permitidas="200.1.2.3,10.0.0.0/8")
    assert api_key.autenticar(key, "GET", "/api/v1/causas", ip="200.1.2.3").guid == "guid-uno"
    assert api_key.autenticar(key, "GET", "/api/v1/causas", ip="10.5.5.5").guid == "guid-uno"


def test_desde_otra_ip_da_el_mismo_401_que_una_key_invalida(base):
    key = _emitir(base, ips_permitidas="200.1.2.3")
    with pytest.raises(HTTPException) as e:
        api_key.autenticar(key, "GET", "/api/v1/causas", ip="6.6.6.6")
    assert _status(e) == 401
    # No dice "IP no permitida": le confirmaría a quien robó la key que sirve.
    assert e.value.detail == api_key.MENSAJE_KEY_INVALIDA


def test_sin_ip_conocida_con_restriccion_no_entra(base):
    key = _emitir(base, ips_permitidas="200.1.2.3")
    with pytest.raises(HTTPException) as e:
        api_key.autenticar(key, "GET", "/api/v1/causas", ip=None)
    assert _status(e) == 401


def test_sin_restriccion_entra_desde_cualquier_ip(base):
    key = _emitir(base)
    assert api_key.autenticar(key, "GET", "/api/v1/causas", ip="6.6.6.6").guid == "guid-uno"


def test_una_ip_rechazada_no_gasta_el_limite_de_la_key(base):
    """Si gastara cupo, quien robó la key dejaría sin servicio al sistema legítimo."""
    key = _emitir(base, limite_por_minuto=1, ips_permitidas="200.1.2.3")
    for _ in range(5):
        with pytest.raises(HTTPException) as e:
            api_key.autenticar(key, "GET", "/api/v1/causas", ip="6.6.6.6")
        assert _status(e) == 401
    # El sistema legítimo sigue teniendo su cupo entero.
    assert api_key.autenticar(key, "GET", "/api/v1/causas", ip="200.1.2.3").guid == "guid-uno"


def test_el_rechazo_por_ip_se_registra_una_vez_por_minuto_no_por_intento(base):
    key = _emitir(base, ips_permitidas="200.1.2.3")
    for _ in range(10):
        with pytest.raises(HTTPException):
            api_key.autenticar(key, "GET", "/api/v1/causas", ip="6.6.6.6")
    assert _acciones(base) == [auditoria.ACCION_API_KEY_DENEGADO]
    detalle = base.bitacora.call_args.kwargs["detalle"]
    assert "ip_no_permitida" in detalle and "6.6.6.6" in detalle


def test_la_restriccion_de_ip_se_aplica_por_key(base):
    cerrada = _emitir(base, ips_permitidas="200.1.2.3")
    abierta = _emitir(base)
    with pytest.raises(HTTPException):
        api_key.autenticar(cerrada, "GET", "/api/v1/causas", ip="6.6.6.6")
    assert api_key.autenticar(abierta, "GET", "/api/v1/causas", ip="6.6.6.6").guid == "guid-uno"


def test_http_no_se_puede_falsear_la_ip_con_x_forwarded_for(base, cliente_http):
    key = _emitir(base, ips_permitidas="8.8.8.8")
    # El cliente se declara 8.8.8.8, pero el proxy agregó su IP real al final.
    falsa = cliente_http.get(
        "/api/v1/causas", headers={"X-API-Key": key, "X-Forwarded-For": "8.8.8.8, 6.6.6.6"}
    )
    assert falsa.status_code == 401
    # Y cuando de verdad viene de esa IP (lo último que agregó el proxy), pasa.
    real = cliente_http.get(
        "/api/v1/causas", headers={"X-API-Key": key, "X-Forwarded-For": "1.1.1.1, 8.8.8.8"}
    )
    assert real.status_code == 200
