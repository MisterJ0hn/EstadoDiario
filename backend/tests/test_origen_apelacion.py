"""Causa origen de una apelación: se guarda al consultar el detalle y se filtra
con `roles_origen`, que se SUMA (OR) a `roles`."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.v1.endpoints.causas import _guardar_origen_de_apelacion
from app.core.database import BaseTenant
from app.core.filtro_roles import parse_roles_corte, parse_roles_origen
from app.models.causa_corte import CausaCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.repositories.causa_corte_repository import CausaCorteRepository


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    BaseTenant.metadata.create_all(engine, tables=[EstadoDiarioOrigen.__table__, CausaCorte.__table__])
    s = sessionmaker(bind=engine)()
    s.add(EstadoDiarioOrigen(id=1, tipo="causas"))
    s.flush()
    yield s
    s.close()


def _corte(db, rol, origen_rol=None, origen_tribunal=None):
    c = CausaCorte(estado_diario_origen_id=1, tipo="apelaciones", rol=rol, era="2026",
                   tipo_libro="Civil", corte="C.A. de Santiago",
                   origen_rol=origen_rol, origen_tribunal=origen_tribunal)
    db.add(c)
    db.flush()
    return c


def _buscar(db, roles=None, roles_origen=None):
    q = CausaCorteRepository._aplicar_filtros(
        db.query(CausaCorte), None, None, None, None, None,
        roles=parse_roles_corte(roles), roles_origen=parse_roles_origen(roles_origen),
    )
    return sorted(c.rol for c in q.all())


def test_roles_origen_y_roles_se_suman(db):
    _corte(db, "1", origen_rol="C-711-2026", origen_tribunal="3º JUZGADO CIVIL DE SANTIAGO")
    _corte(db, "2", origen_rol="C-711-2026", origen_tribunal="1º JUZGADO CIVIL DE TEMUCO")
    _corte(db, "3", origen_rol="C-9-2025", origen_tribunal="3º JUZGADO CIVIL DE SANTIAGO")
    _corte(db, "4")  # sin origen conocido

    # Solo origen: con espacios como los escribe el PJUD, con y sin tribunal.
    assert _buscar(db, roles_origen="C - 711 - 2026") == ["1", "2"]
    assert _buscar(db, roles_origen="C-711-2026|3º juzgado civil de santiago") == ["1"]
    # Solo apelación.
    assert _buscar(db, roles="Civil-4-2026") == ["4"]
    # Los dos: OR, no AND.
    assert _buscar(db, roles="Civil-4-2026", roles_origen="C-9-2025") == ["3", "4"]
    # Ninguno: sin filtro.
    assert _buscar(db) == ["1", "2", "3", "4"]
    # Uno que no calza con nada.
    assert _buscar(db, roles="Civil-99-2026", roles_origen="C-0-2000") == []


def test_guarda_el_origen_del_expediente(db):
    c = _corte(db, "1")
    detalle = {"expediente_primera": {"causa_origen": "C - 711 - 2026", "tribunal": " 3º JUZGADO CIVIL DE SANTIAGO "}}
    _guardar_origen_de_apelacion(db, c, detalle, {"id": 55})
    assert (c.origen_rol, c.origen_tribunal, c.origen_causa_id) == (
        "C-711-2026", "3º JUZGADO CIVIL DE SANTIAGO", 55)


def test_sin_expediente_no_toca_nada(db):
    c = _corte(db, "1", origen_rol="C-1-2020")
    _guardar_origen_de_apelacion(db, c, {"expediente_primera": None}, None)
    assert c.origen_rol == "C-1-2020"
