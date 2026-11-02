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
from app.repositories.pjud_copia_repository import PjudCopiaRepository, clave_de
from app.models.pjud_copia import PjudCopia
from app.models.usuario import Usuario
from app.models.usuario_rut import UsuarioRut
from app.services.pjud_dueno_service import causa_asignada, credenciales_del_abogado_asignado

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
            Usuario.__table__, UsuarioRut.__table__, PjudCopia.__table__,
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

    def test_causa_sin_abogado_se_identifica_pero_no_tiene_credenciales(self, db):
        """Sus jobs de sync deben poder encontrarse por `causa_id` aunque no haya dueño."""
        origen = _origen(db, None)
        causa = _causa(db, origen)
        asignada = causa_asignada(db, ServicioFalso(), "civil", {
            "corte": 90, "tribunal": 276, "tipo": "C", "rol": 1234, "anio": 2026,
        })
        assert asignada.id == causa.id and asignada.rut_efectivo is None
        assert _resolver(db) is None  # y no se usan credenciales de nadie

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


class TestApelacionesMismaCausaEnDosCarteras:
    """Un archivo de causas por abogado: la misma causa de corte está en las dos
    carteras y solo el caratulado dice de quién es."""

    ANA, BETO = "16952077-1", "17314741-4"

    def _dos(self, db):
        _abogado(db, "Ana", self.ANA)
        beto = _abogado(db, "Beto", self.BETO)
        beto.pjud_rut = "22"
        for rut, caratulado in ((self.ANA, "SEPÚLVEDA/TESORERIA"), (self.BETO, "SEPÚLVEDA KOCH LEOPOLDO/TESORERIA")):
            db.add(CausaCorte(
                estado_diario_origen_id=_origen(db, rut).id, tipo="apelaciones",
                rol="261", era="2026", corte="C.A. de Santiago", caratulado=caratulado,
            ))
        db.flush()

    def test_el_caratulado_elige_al_abogado_aunque_su_archivo_no_sea_el_ultimo(self, db):
        self._dos(db)
        ana = _resolver(db, "apelaciones", corte="C.A. de Santiago", rol=261, anio=2026,
                        caratulado="sepúlveda/tesoreria")
        assert ana == ABOGADO

    def test_el_caratulado_del_ultimo_archivo(self, db):
        self._dos(db)
        beto = _resolver(db, "apelaciones", corte="C.A. de Santiago", rol=261, anio=2026,
                         caratulado="SEPÚLVEDA KOCH LEOPOLDO/TESORERIA")
        assert beto["rut"] == "22"

    def test_sin_caratulado_es_ambiguo_y_no_elige_a_nadie(self, db):
        self._dos(db)
        assert _resolver(db, "apelaciones", corte="C.A. de Santiago", rol=261, anio=2026) is None

    def test_caratulado_que_no_calza_con_ninguna_no_elige_a_nadie(self, db):
        self._dos(db)
        assert _resolver(db, "apelaciones", corte="C.A. de Santiago", rol=261, anio=2026,
                         caratulado="OTRO/CARATULADO") is None


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


class TestPrioridadApelacionesEnElEspejo:
    """sincronizar_apelaciones: manda el abogado de la causa de corte, con o sin
    credenciales del integrador; estas solo valen si no hay dueño."""

    CUERPO = {"corte": "C.A. de Santiago", "rol": 1620, "anio": 2026}

    def _corte(self, db, rut):
        db.add(CausaCorte(
            estado_diario_origen_id=_origen(db, rut).id, tipo="apelaciones",
            rol="Civil-1620-2026", era="2026", corte="C.A. de Santiago",
            caratulado="TESORERÍA/CONTRERAS",
        ))
        db.flush()

    def test_completa_el_caratulado_si_el_integrador_no_lo_manda(self, db):
        self._corte(db, "16952077-1")
        envio = pjud_espejo._con_abogado_asignado(db, ServicioFalso(), "apelaciones", dict(self.CUERPO))
        assert envio["caratulado"] == "TESORERÍA/CONTRERAS"

    def test_el_caratulado_del_integrador_no_se_pisa(self, db):
        self._corte(db, "16952077-1")
        cuerpo = {**self.CUERPO, "caratulado": "OTRO/CARATULADO"}
        envio = pjud_espejo._con_abogado_asignado(db, ServicioFalso(), "apelaciones", cuerpo)
        assert envio["caratulado"] == "OTRO/CARATULADO"

    def test_pisa_las_credenciales_del_integrador(self, db):
        _abogado(db, "Ana", "16952077-1")
        self._corte(db, "16952077-1")
        envio = pjud_espejo._con_abogado_asignado(
            db, ServicioFalso(), "apelaciones", {**self.CUERPO, **DEL_INTEGRADOR}
        )
        assert {k: envio[k] for k in ABOGADO} == ABOGADO
        assert envio["rol"] == 1620

    def test_sin_credenciales_del_integrador_usa_las_del_abogado(self, db):
        _abogado(db, "Ana", "16952077-1")
        self._corte(db, "16952077-1")
        envio = pjud_espejo._con_abogado_asignado(db, ServicioFalso(), "apelaciones", dict(self.CUERPO))
        assert {k: envio[k] for k in ABOGADO} == ABOGADO

    def test_sin_dueno_se_dejan_las_del_integrador(self, db):
        cuerpo = {**self.CUERPO, **DEL_INTEGRADOR}
        assert pjud_espejo._con_abogado_asignado(db, ServicioFalso(), "apelaciones", cuerpo) == cuerpo


class TestMovimientosApelacionesConDueno:
    """consultar_movimientos_* solo trae el `identificador`: el dueño sale de la
    cabecera guardada con ese identificador."""

    CUERPO = {"rol": 261, "anio": 2026, "corte": "C.A. de Santiago",
              "caratulado": "SEPÚLVEDA KOCH/TESORERIA"}

    def _cabecera(self, db, rut="16952077-1"):
        db.add(CausaCorte(
            estado_diario_origen_id=_origen(db, rut).id, tipo="apelaciones", rol="261",
            era="2026", corte="C.A. de Santiago", caratulado="SEPÚLVEDA KOCH/TESORERIA",
        ))
        db.flush()
        PjudCopiaRepository(db).guardar(
            "/consultar_apelaciones", clave_de(self.CUERPO), "ident-1", "{}"
        )

    def _movimientos(self, db, identificador="ident-1"):
        return pjud_espejo._movimientos_con_dueno(
            db, ServicioFalso(), "apelaciones", {"identificador": identificador},
            PjudCopiaRepository(db),
        )

    def test_usa_las_credenciales_del_dueno_de_la_cabecera(self, db):
        _abogado(db, "Ana", "16952077-1")
        self._cabecera(db)
        envio = self._movimientos(db)
        assert envio == {"identificador": "ident-1", **ABOGADO}

    def test_las_credenciales_no_entran_a_la_clave_de_la_copia(self, db):
        _abogado(db, "Ana", "16952077-1")
        self._cabecera(db)
        # Una cabecera pedida CON credenciales del integrador se guarda igual.
        assert clave_de({**self.CUERPO, **DEL_INTEGRADOR}) == clave_de(self.CUERPO)

    def test_identificador_desconocido_va_tal_cual(self, db):
        _abogado(db, "Ana", "16952077-1")
        self._cabecera(db)
        assert self._movimientos(db, "otro") == {"identificador": "otro"}

    def test_sin_dueno_va_tal_cual(self, db):
        self._cabecera(db)
        assert self._movimientos(db) == {"identificador": "ident-1"}
