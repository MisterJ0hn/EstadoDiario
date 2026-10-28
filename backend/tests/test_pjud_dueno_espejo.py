"""Credenciales del abogado asignado en el espejo de api-pjud.

El integrador manda el cuerpo de api-pjud (`corte`, `tribunal`, `tipo`, `rol`,
`anio`), no un id de causa nuestro: se busca la causa en la cartera vigente y se usa
la clave de SU abogado. Solo credenciales ficticias.
"""

from datetime import date, datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.v1.endpoints import pjud_espejo
from app.core.database import BaseTenant
from app.models.causa import Causa
from app.models.causa_corte import CausaCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.usuario import Usuario
from app.models.usuario_rut import UsuarioRut
from app.services.pjud_dueno_service import credenciales_del_abogado_asignado

ABOGADO = {"rut": "11", "clave": "121212", "metodo_login": 2}
DEL_INTEGRADOR = {"rut": "99", "clave": "ajena", "metodo_login": 1}
CATALOGO = [{"id": 90, "nombre": "C.A. de Santiago", "tribunales": [
    {"id": 276, "nombre": "1° Juzgado Civil de Santiago"},
    {"id": 277, "nombre": "2º Juzgado Civil de Santiago"},
]}]


class ServicioFalso:
    def catalogo_tribunales(self, competencia):
        return CATALOGO


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    BaseTenant.metadata.create_all(
        engine,
        tables=[
            EstadoDiarioOrigen.__table__, Causa.__table__, CausaCorte.__table__,
            Usuario.__table__, UsuarioRut.__table__,
        ],
    )
    sesion = sessionmaker(bind=engine)()
    try:
        yield sesion
    finally:
        sesion.close()


def _abogado(db, nombre, rut, *, con_clave=True):
    u = Usuario(password_hash="x", nombre=nombre, activo=True, es_integracion=False)
    u.usuario = f"{nombre.lower()}@estudio.cl"
    if con_clave:
        u.pjud_rut, u.pjud_clave, u.pjud_metodo_login = "11", "121212", 2
    db.add(u)
    db.flush()
    r = UsuarioRut(usuario_id=u.id)
    r.rut = rut
    db.add(r)
    db.flush()
    return u


def _origen(db, rut):
    origen = EstadoDiarioOrigen(
        tipo=EstadoDiarioOrigen.TIPO_CAUSAS, rut=rut, fecha=date(2026, 10, 1),
        fecha_carga=datetime.now(timezone.utc),
    )
    db.add(origen)
    db.flush()
    return origen


def _causa(db, origen, materia="Civil", rol="C-1234-2026",
           tribunal="1° Juzgado Civil de Santiago"):
    causa = Causa(estado_diario_origen_id=origen.id, materia=materia, rol=rol, tribunal=tribunal)
    db.add(causa)
    db.flush()
    return causa


def _resolver(db, competencia="civil", **cuerpo):
    base = {"corte": 90, "tribunal": 276, "tipo": "C", "rol": 1234, "anio": 2026}
    return credenciales_del_abogado_asignado(
        db, ServicioFalso(), competencia, {**base, **cuerpo}
    )


class TestCausas:
    def test_civil_resuelve_el_abogado_por_rol_y_tribunal(self, db):
        _abogado(db, "Ana", "16952077-1")
        _causa(db, _origen(db, "16952077-1"))
        assert _resolver(db) == ABOGADO

    def test_el_tribunal_se_compara_sin_acentos_ni_grados(self, db):
        _abogado(db, "Ana", "16952077-1")
        _causa(db, _origen(db, "16952077-1"), tribunal="2º JUZGADO CIVIL DE SANTIAGO")
        assert _resolver(db, tribunal=277) == ABOGADO

    def test_otro_tribunal_no_calza(self, db):
        _abogado(db, "Ana", "16952077-1")
        _causa(db, _origen(db, "16952077-1"))
        assert _resolver(db, tribunal=277) is None

    def test_causa_que_no_esta_en_la_cartera(self, db):
        _abogado(db, "Ana", "16952077-1")
        _causa(db, _origen(db, "16952077-1"))
        assert _resolver(db, rol=9999) is None

    def test_abogado_sin_clave_cargada_no_es_dueno(self, db):
        _abogado(db, "Ana", "16952077-1", con_clave=False)
        _causa(db, _origen(db, "16952077-1"))
        assert _resolver(db) is None

    def test_solo_cuenta_la_cartera_vigente(self, db):
        _abogado(db, "Ana", "16952077-1")
        _causa(db, _origen(db, "16952077-1"))
        # Un archivo más nuevo, sin esa causa: la cartera de hoy ya no la tiene.
        nuevo = _origen(db, "16952077-1")
        nuevo.fecha = date(2026, 10, 15)
        db.flush()
        assert _resolver(db) is None

    def test_familia_sin_tribunal_resuelve_si_el_dueno_es_unico(self, db):
        _abogado(db, "Ana", "16952077-1")
        _causa(db, _origen(db, "16952077-1"), materia="Familia", rol="C-1234-2026")
        assert _resolver(db, "familia", corte=0, tribunal=0) == ABOGADO

    def test_familia_con_dos_duenos_distintos_no_elige_a_ninguno(self, db):
        _abogado(db, "Ana", "16952077-1")
        _abogado(db, "Beto", "11111111-1")
        origen = _origen(db, "16952077-1")
        _causa(db, origen, materia="Familia", rol="C-1234-2026", tribunal="Juzgado A")
        otra = _causa(db, origen, materia="Familia", rol="C-1234-2026", tribunal="Juzgado B")
        otra.rut_asignado = "11111111-1"
        db.flush()
        assert _resolver(db, "familia", corte=0, tribunal=0) is None

    def test_penal_con_rol_sin_letra(self, db):
        _abogado(db, "Ana", "16952077-1")
        _causa(db, _origen(db, "16952077-1"), materia="Penal", rol="1653-2023",
               tribunal="1° Juzgado Civil de Santiago")
        assert _resolver(db, "penal", tipo="O", rol=1653, anio=2023) == ABOGADO

    def test_cuerpo_incompleto_no_revienta(self, db):
        assert credenciales_del_abogado_asignado(db, ServicioFalso(), "civil", {"rol": "x"}) is None


class TestApelaciones:
    def _corte(self, db, origen, **campos):
        datos = dict(
            estado_diario_origen_id=origen.id, tipo="apelaciones", rol="Civil-1620-2026",
            era="2026", corte="C.A. de Santiago",
        )
        fila = CausaCorte(**{**datos, **campos})
        db.add(fila)
        db.flush()
        return fila

    def test_resuelve_el_dueno_del_archivo_de_origen(self, db):
        _abogado(db, "Ana", "16952077-1")
        self._corte(db, _origen(db, "16952077-1"))
        assert _resolver(db, "apelaciones", corte="C.A. DE SANTIAGO", rol=1620, anio=2026) == ABOGADO

    def test_otra_corte_no_calza(self, db):
        _abogado(db, "Ana", "16952077-1")
        self._corte(db, _origen(db, "16952077-1"))
        assert _resolver(db, "apelaciones", corte="C.A. de Valparaíso", rol=1620, anio=2026) is None


class TestPrioridadEnElEspejo:
    """Gana el abogado asignado; las del integrador solo valen sin dueño."""

    def test_el_abogado_asignado_pisa_las_credenciales_del_integrador(self, db):
        _abogado(db, "Ana", "16952077-1")
        _causa(db, _origen(db, "16952077-1"))
        cuerpo = {"corte": 90, "tribunal": 276, "tipo": "C", "rol": 1234, "anio": 2026,
                  **DEL_INTEGRADOR}
        envio = pjud_espejo._con_abogado_asignado(db, ServicioFalso(), "civil", cuerpo)
        assert {k: envio[k] for k in ABOGADO} == ABOGADO
        assert envio["rol"] == 1234

    def test_sin_dueno_se_dejan_las_del_integrador(self, db):
        cuerpo = {"corte": 90, "tribunal": 276, "tipo": "C", "rol": 1234, "anio": 2026,
                  **DEL_INTEGRADOR}
        envio = pjud_espejo._con_abogado_asignado(db, ServicioFalso(), "civil", cuerpo)
        assert envio == cuerpo

    def test_sin_dueno_ni_credenciales_del_integrador_va_sin_ellas(self, db):
        cuerpo = {"corte": 90, "tribunal": 276, "tipo": "C", "rol": 1234, "anio": 2026}
        assert pjud_espejo._con_abogado_asignado(db, ServicioFalso(), "civil", cuerpo) == cuerpo
