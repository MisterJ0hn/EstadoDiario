import pytest

from app.services.cartera_sync_service import tipo_libro_de


@pytest.mark.parametrize("rol,esperado", [
    ("Civil-1620-2026", "Civil"),
    ("Civil - 1620 - 2026", "Civil"),
    (" Protección-12-2026 ", "Protección"),
    ("1620", None),
    ("", None),
    (None, None),
])
def test_tipo_libro_de(rol, esperado):
    assert tipo_libro_de(rol) == esperado


# ── Job de recuperación ───────────────────────────────────

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import BaseTenant
from app.jobs.recuperar_tipo_libro import recuperar
from app.models.causa_corte import CausaCorte
from app.models.estado_diario_corte import EstadoDiarioCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.movimiento_corte import MovimientoCorte


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    BaseTenant.metadata.create_all(engine, tables=[
        EstadoDiarioOrigen.__table__, EstadoDiarioCorte.__table__,
        MovimientoCorte.__table__, CausaCorte.__table__,
    ])
    s = sessionmaker(bind=engine)()
    s.add(EstadoDiarioOrigen(id=1, tipo="estado_diario"))
    s.flush()
    yield s
    s.close()


def test_recuperar_deriva_y_cruza(db):
    db.add(EstadoDiarioCorte(estado_diario_origen_id=1, tipo="apelaciones",
                             numero_ingreso="Civil-1620-2026", corte="C.A. de Santiago"))
    # Movimientos y Causas traen solo el número: heredan del estado diario.
    db.add(MovimientoCorte(estado_diario_origen_id=1, tipo="apelaciones", rol="1620",
                           era="2026", corte="C.A. de Santiago"))
    db.add(CausaCorte(estado_diario_origen_id=1, tipo="apelaciones", rol="1620",
                      era="2026", corte="c.a. de santiago "))
    # Con prefijo propio, no necesita el cruce.
    db.add(CausaCorte(estado_diario_origen_id=1, tipo="apelaciones", rol="Laboral-5-2025",
                      era="2025", corte="C.A. de Temuco"))
    # Sin ninguna fuente.
    db.add(CausaCorte(estado_diario_origen_id=1, tipo="apelaciones", rol="99",
                      era="2026", corte="C.A. de Temuco"))
    db.flush()

    res = recuperar(db)

    assert db.query(EstadoDiarioCorte).one().tipo_libro == "Civil"
    assert db.query(MovimientoCorte).one().tipo_libro == "Civil"
    libros = {c.rol: c.tipo_libro for c in db.query(CausaCorte).all()}
    assert libros == {"1620": "Civil", "Laboral-5-2025": "Laboral", "99": None}
    assert res["sin_dato"] == 1

    # Idempotente: la segunda vez no cambia nada.
    assert recuperar(db)["causa_corte"] == 0


# ── Filtro `roles` del listado de cortes ──────────────────

from fastapi import HTTPException

from app.repositories.causa_corte_repository import CausaCorteRepository
from app.core.filtro_roles import parse_roles_corte


def test_parse_roles_corte():
    assert parse_roles_corte("Civil-1620-2026|C.A. de Santiago, 55 - 2025") == [
        ("Civil", "1620", "2026", "C.A. de Santiago"),
        (None, "55", "2025", None),
    ]
    assert parse_roles_corte("") is None
    with pytest.raises(HTTPException):
        parse_roles_corte("Civil-1620")


def test_filtro_roles_en_cortes(db):
    for rol, era, libro, corte in [
        ("1620", "2026", "Civil", "C.A. de Santiago"),
        ("Civil-1620", "2026", "Civil", "C.A. de Temuco"),
        ("1620", "2026", "Laboral", "C.A. de Santiago"),
        ("16200", "2026", "Civil", "C.A. de Santiago"),
        ("1620", "2025", "Civil", "C.A. de Santiago"),
    ]:
        db.add(CausaCorte(estado_diario_origen_id=1, tipo="apelaciones", rol=rol,
                          era=era, tipo_libro=libro, corte=corte))
    db.flush()
    repo = CausaCorteRepository(db)

    def buscar(roles):
        q = repo._aplicar_filtros(
            db.query(CausaCorte), None, None, None, None, None, roles=parse_roles_corte(roles)
        )
        return sorted((c.tipo_libro, c.corte) for c in q.all())

    # Libro + rol + era, en cualquier corte; el rol no calza por prefijo (16200).
    assert buscar("Civil-1620-2026") == [("Civil", "C.A. de Santiago"), ("Civil", "C.A. de Temuco")]
    assert buscar("civil-1620-2026|c.a. de temuco") == [("Civil", "C.A. de Temuco")]
    assert buscar("Laboral-1620-2026") == [("Laboral", "C.A. de Santiago")]
    assert len(buscar("1620-2026")) == 3  # sin libro: cualquiera
