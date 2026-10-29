"""Credenciales del abogado DUEÑO de la causa hacia api-pjud.

Van en `consultar_*`, `consultar_movimientos_*` y `sincronizar_*`. Si el dueño no
las tiene —o la causa no tiene dueño— esos tres campos se OMITEN y se llama
igual: api-pjud sincroniza y consulta sin login.

Solo credenciales ficticias.
"""

import types
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.credenciales_pjud import credenciales_del_dueno
from app.core.database import BaseTenant
from app.models.causa import ORIGEN_DATO_API, ORIGEN_DATO_CAUSAS, Causa
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.usuario import Usuario
from app.models.usuario_rut import UsuarioRut
from app.services.pjud_service import PjudNoEncontrado, PjudService

CREDS = {"rut": "11", "clave": "121212", "metodo_login": 1}
CAMPOS_CREDENCIALES = {"rut", "clave", "metodo_login"}


# ── Quién es el dueño ─────────────────────────────────────


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    BaseTenant.metadata.create_all(
        engine,
        tables=[
            EstadoDiarioOrigen.__table__, Causa.__table__,
            Usuario.__table__, UsuarioRut.__table__,
        ],
    )
    sesion = sessionmaker(bind=engine)()
    try:
        yield sesion
    finally:
        sesion.close()


def _abogado(db, nombre, rut, *, con_clave=True, activo=True):
    u = Usuario(password_hash="x", nombre=nombre, activo=activo, es_integracion=False)
    u.usuario = f"{nombre.lower()}@estudio.cl"
    if con_clave:
        u.pjud_rut = "11"
        u.pjud_clave = "121212"
        u.pjud_metodo_login = 2
    db.add(u)
    db.flush()
    r = UsuarioRut(usuario_id=u.id)
    r.rut = rut
    db.add(r)
    db.flush()
    return u


def _causa(db, rut_archivo, origen_dato=ORIGEN_DATO_CAUSAS, rut_asignado=None) -> Causa:
    origen = EstadoDiarioOrigen(
        tipo=EstadoDiarioOrigen.TIPO_CAUSAS, rut=rut_archivo, fecha=date(2026, 10, 1),
        fecha_carga=datetime.now(timezone.utc),
    )
    db.add(origen)
    db.flush()
    causa = Causa(
        estado_diario_origen_id=origen.id, materia="Civil", rol="C-1-2026",
        tribunal="1° Juzgado Civil", origen_dato=origen_dato, rut_asignado=rut_asignado,
    )
    db.add(causa)
    db.flush()
    return causa


def test_devuelve_las_credenciales_del_abogado_dueno(db):
    _abogado(db, "Ana", "16952077-1")
    assert credenciales_del_dueno(db, _causa(db, "16952077-1")) == {
        "rut": "11", "clave": "121212", "metodo_login": 2,
    }


def test_archivo_sin_digito_verificador_calza_por_el_cuerpo(db):
    _abogado(db, "Ana", "16952077-1")
    assert credenciales_del_dueno(db, _causa(db, "16952077")) is not None


def test_dueno_sin_credenciales_cargadas_devuelve_none(db):
    _abogado(db, "Ana", "16952077-1", con_clave=False)
    assert credenciales_del_dueno(db, _causa(db, "16952077-1")) is None


def test_rut_que_no_calza_con_nadie_devuelve_none(db):
    _abogado(db, "Ana", "16952077-1")
    assert credenciales_del_dueno(db, _causa(db, "55555555-5")) is None


def test_rut_que_calza_con_dos_usuarios_devuelve_none(db):
    _abogado(db, "Ana", "16952077-1")
    _abogado(db, "Beto", "16952077-1")
    assert credenciales_del_dueno(db, _causa(db, "16952077-1")) is None


def test_usuario_desactivado_devuelve_none(db):
    _abogado(db, "Ana", "16952077-1", activo=False)
    assert credenciales_del_dueno(db, _causa(db, "16952077-1")) is None


def test_archivo_sin_rut_devuelve_none(db):
    _abogado(db, "Ana", "16952077-1")
    assert credenciales_del_dueno(db, _causa(db, None)) is None


def test_causa_de_api_sin_abogado_no_usa_el_rut_del_archivo(db):
    """Vive en el archivo de Ana pero no es de Ana: va sin credenciales."""
    _abogado(db, "Ana", "16952077-1")
    causa = _causa(db, "16952077-1", origen_dato=ORIGEN_DATO_API)
    assert credenciales_del_dueno(db, causa) is None


def test_causa_de_api_ya_asignada_usa_al_abogado_asignado(db):
    _abogado(db, "Ana", "16952077-1")
    _abogado(db, "Beto", "12345678-5")
    causa = _causa(db, "16952077-1", origen_dato=ORIGEN_DATO_API, rut_asignado="12345678-5")
    assert credenciales_del_dueno(db, causa) == {"rut": "11", "clave": "121212", "metodo_login": 2}


# ── Qué viaja a api-pjud, por materia ─────────────────────

_CATALOGO = [{"id": 91, "nombre": "C.A. de San Miguel", "tribunales": [
    {"id": 364, "nombre": "1° Juzgado Test"},
]}]

# materia → (método, rol, tipo_causa, clave del cuaderno en movimientos)
_MATERIAS = {
    "civil": ("obtener_detalle", "C-100-2026", None, "cuadeno"),
    "familia": ("obtener_detalle_familia", "C-100-2026", None, "cuadeno"),
    "laboral": ("obtener_detalle_laboral", "O-100-2026", None, "cuadeno"),
    "cobranza": ("obtener_detalle_cobranza", "C-100-2026", None, "cuadeno"),
    "penal": ("obtener_detalle_penal", "100-2026", "Ordinaria", "cuaderno"),
}


class _Espia:
    """Doble de `_request` que anota ruta y cuerpo de cada llamada."""

    def __init__(self, materia):
        self.materia = materia
        self.cuerpos: dict[str, dict] = {}

    def __call__(self, metodo, ruta, **kwargs):
        self.cuerpos[ruta] = kwargs.get("json")
        if ruta == f"/consultar_{self.materia}":
            return {"causa": {
                "identificador": "abc", "estado": "Completo",
                "cuadernos": [{"id": 1, "nombre": "1 - principal"}],
            }}
        if ruta == f"/sincronizar_{self.materia}":
            return {"exito": True}
        return {"historia": [], "movimientos": []}


def _correr(monkeypatch, materia, credenciales, *, existe=True):
    metodo, rol, tipo_causa, _ = _MATERIAS[materia]
    monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@x.cl")
    monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "x")
    servicio = PjudService()
    monkeypatch.setattr(servicio, "_obtener_catalogo", lambda competencia="civil": _CATALOGO)
    espia = _Espia(materia)
    if not existe:
        original = espia

        def sin_causa(m, ruta, **kw):
            if ruta == f"/consultar_{materia}":
                original.cuerpos[ruta] = kw.get("json")
                raise PjudNoEncontrado("no está")
            return original(m, ruta, **kw)

        monkeypatch.setattr(servicio, "_request", sin_causa)
    else:
        monkeypatch.setattr(servicio, "_request", espia)
    causa = types.SimpleNamespace(
        id=1, materia=materia.capitalize(), rol=rol, tribunal="1° Juzgado Test",
        tipo_causa=tipo_causa,
    )
    getattr(servicio, metodo)(causa, credenciales_dueno=credenciales)
    return espia


@pytest.mark.parametrize("materia", list(_MATERIAS))
def test_con_credenciales_del_dueno_consultar_y_movimientos_las_llevan(monkeypatch, materia):
    espia = _correr(monkeypatch, materia, CREDS)

    assert CREDS.items() <= espia.cuerpos[f"/consultar_{materia}"].items()
    mov = espia.cuerpos[f"/consultar_movimientos_{materia}"]
    assert CREDS.items() <= mov.items()
    assert mov["identificador"] == "abc"
    assert _MATERIAS[materia][3] in mov


@pytest.mark.parametrize("materia", list(_MATERIAS))
def test_sin_credenciales_los_tres_campos_se_omiten_pero_se_llama(monkeypatch, materia):
    espia = _correr(monkeypatch, materia, None)

    for ruta in (f"/consultar_{materia}", f"/consultar_movimientos_{materia}"):
        assert ruta in espia.cuerpos
        assert not CAMPOS_CREDENCIALES & espia.cuerpos[ruta].keys()


@pytest.mark.parametrize("materia", list(_MATERIAS))
def test_sincronizar_lleva_las_del_dueno(monkeypatch, materia):
    espia = _correr(monkeypatch, materia, CREDS, existe=False)

    assert CREDS.items() <= espia.cuerpos[f"/sincronizar_{materia}"].items()


@pytest.mark.parametrize("materia", list(_MATERIAS))
def test_sincronizar_sin_credenciales_va_sin_los_campos(monkeypatch, materia):
    espia = _correr(monkeypatch, materia, None, existe=False)

    cuerpo = espia.cuerpos[f"/sincronizar_{materia}"]
    assert cuerpo is not None  # se sincronizó igual
    assert not CAMPOS_CREDENCIALES & cuerpo.keys()


@pytest.mark.parametrize("incompletas", [{}, {"rut": "11"}, {"clave": "121212"},
                                         {"rut": "", "clave": "121212", "metodo_login": 1}])
def test_credenciales_incompletas_se_tratan_como_ausentes(incompletas):
    cuerpo = {"identificador": "abc"}
    assert PjudService._con_credenciales(cuerpo, incompletas) == cuerpo


def test_el_metodo_de_login_por_defecto_es_1():
    assert PjudService._con_credenciales({"a": 1}, {"rut": "11", "clave": "121212"}) == {
        "a": 1, "rut": "11", "clave": "121212", "metodo_login": 1,
    }


def test_la_clave_no_queda_en_el_diagnostico(monkeypatch):
    monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@x.cl")
    monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "x")
    servicio = PjudService()
    monkeypatch.setattr(servicio, "_obtener_catalogo", lambda competencia="civil": _CATALOGO)

    def sin_causa(m, ruta, **kw):
        if ruta == "/consultar_civil":
            raise PjudNoEncontrado("no está")
        return {"exito": True}

    monkeypatch.setattr(servicio, "_request", sin_causa)
    causa = types.SimpleNamespace(id=1, materia="Civil", rol="C-1-2026", tribunal="1° Juzgado Test")
    r = servicio.obtener_detalle(causa, credenciales_dueno=CREDS)
    assert "121212" not in r["diagnostico"]


# ── Credencial de la integración en una causa de API sin abogado ──

from app.core.credenciales_pjud import recordar_credencial_integrador  # noqa: E402

CUERPO_INTEGRADOR = {"rut": "99999999-9", "clave": "claveCliente", "metodo_login": 2}


def test_causa_de_api_sin_abogado_guarda_la_credencial_del_integrador(db):
    causa = _causa(db, None, origen_dato=ORIGEN_DATO_API)
    recordar_credencial_integrador(db, causa, CUERPO_INTEGRADOR)
    assert causa.pjud_clave_cifrada != "claveCliente"  # va cifrada
    assert credenciales_del_dueno(db, causa) == {
        "rut": "99999999-9", "clave": "claveCliente", "metodo_login": 2,
    }


def test_la_ultima_credencial_pisa_a_la_anterior(db):
    causa = _causa(db, None, origen_dato=ORIGEN_DATO_API)
    recordar_credencial_integrador(db, causa, CUERPO_INTEGRADOR)
    recordar_credencial_integrador(db, causa, {**CUERPO_INTEGRADOR, "clave": "nueva"})
    assert credenciales_del_dueno(db, causa)["clave"] == "nueva"


def test_causa_con_abogado_no_guarda_la_credencial_del_integrador(db):
    _abogado(db, "Ana", "16952077-1")
    causa = _causa(db, "16952077-1", origen_dato=ORIGEN_DATO_API, rut_asignado="16952077-1")
    recordar_credencial_integrador(db, causa, CUERPO_INTEGRADOR)
    assert causa.pjud_clave_cifrada is None
    assert credenciales_del_dueno(db, causa)["clave"] == "121212"  # la de Ana


def test_causa_del_excel_no_guarda_la_credencial_del_integrador(db):
    causa = _causa(db, None)  # origen "causas", sin RUT en el archivo
    recordar_credencial_integrador(db, causa, CUERPO_INTEGRADOR)
    assert causa.pjud_clave_cifrada is None


def test_sin_rut_o_sin_clave_en_el_cuerpo_no_guarda_nada(db):
    causa = _causa(db, None, origen_dato=ORIGEN_DATO_API)
    recordar_credencial_integrador(db, causa, {"rut": "99999999-9"})
    recordar_credencial_integrador(db, causa, {"clave": "x"})
    assert credenciales_del_dueno(db, causa) is None


def test_causa_sin_id_resuelto_no_guarda_nada(db):
    ns = types.SimpleNamespace(id=None, rut_efectivo=None)
    recordar_credencial_integrador(db, ns, CUERPO_INTEGRADOR)
    assert getattr(ns, "pjud_clave_cifrada", None) is None


def test_el_namespace_del_espejo_ve_la_credencial_recien_guardada(db):
    causa = _causa(db, None, origen_dato=ORIGEN_DATO_API)
    ns = types.SimpleNamespace(
        id=causa.id, rut_efectivo=None, pjud_rut=None, pjud_clave_cifrada=None,
        pjud_metodo_login=None,
    )
    recordar_credencial_integrador(db, ns, CUERPO_INTEGRADOR)
    assert credenciales_del_dueno(db, ns)["rut"] == "99999999-9"


def test_copiar_causa_de_api_conserva_la_credencial(db):
    from app.services.causa_api_service import copiar_causa_de_api

    causa = _causa(db, None, origen_dato=ORIGEN_DATO_API)
    recordar_credencial_integrador(db, causa, CUERPO_INTEGRADOR)
    nueva = copiar_causa_de_api(db, causa, causa.estado_diario_origen_id)
    assert credenciales_del_dueno(db, nueva)["clave"] == "claveCliente"


def test_al_asignarse_abogado_su_clave_manda_sobre_la_guardada(db):
    """La causa ya guardó la clave del integrador; cuando un estado diario le pone
    abogado, se usa la del abogado."""
    _abogado(db, "Ana", "16952077-1")
    causa = _causa(db, None, origen_dato=ORIGEN_DATO_API)
    recordar_credencial_integrador(db, causa, CUERPO_INTEGRADOR)
    assert credenciales_del_dueno(db, causa)["clave"] == "claveCliente"
    causa.rut_asignado = "16952077-1"
    assert credenciales_del_dueno(db, causa) == {"rut": "11", "clave": "121212", "metodo_login": 2}


def test_abogado_asignado_sin_clave_no_cae_a_la_guardada(db):
    """Con abogado pero sin clave del OJV cargada no se usa la del integrador desde
    nuestro lado: va sin credencial (en el espejo sigue la que mande el integrador)."""
    _abogado(db, "Ana", "16952077-1", con_clave=False)
    causa = _causa(db, None, origen_dato=ORIGEN_DATO_API)
    recordar_credencial_integrador(db, causa, CUERPO_INTEGRADOR)
    causa.rut_asignado = "16952077-1"
    assert credenciales_del_dueno(db, causa) is None
