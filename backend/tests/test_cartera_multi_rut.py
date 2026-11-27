"""La cartera con un reporte de Causas por abogado.

Caso real: un estudio con dos abogados cargó un Excel por cada uno. Mis Causas
mostraba solo el del último cargado, porque la cartera era "el último archivo".
Ahora es el último archivo de CADA RUT, y la causa que está en los dos cuenta
una sola vez.

Base SQLite en memoria: se prueba la regla, no SQL de PostgreSQL.
"""

from datetime import date

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.database import BaseTenant
from app.models.audiencia import Audiencia
from app.models.causa import Causa
from app.models.causa_corte import CausaCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.repositories.causa_corte_repository import CausaCorteRepository
from app.repositories.causa_repository import CausaRepository, origenes_cartera_ids


@pytest.fixture
def db():
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def _btrim(conexion, _):
        # `btrim` es de PostgreSQL y el listado ya la usa (próxima audiencia).
        conexion.create_function("btrim", 1, lambda v: v.strip() if v is not None else None)

    BaseTenant.metadata.create_all(
        engine,
        tables=[
            EstadoDiarioOrigen.__table__, Causa.__table__,
            CausaCorte.__table__, Audiencia.__table__,
        ],
    )
    sesion = sessionmaker(bind=engine)()
    try:
        yield sesion
    finally:
        sesion.close()


def _origen(db, rut, dia, deducida=False):
    o = EstadoDiarioOrigen(
        tipo=EstadoDiarioOrigen.TIPO_CAUSAS, rut=rut, fecha=date(2026, 11, dia),
        nombre_archivo=f"Causas_{rut}.xlsx", deducida=deducida,
    )
    db.add(o)
    db.flush()
    return o


def _causa(db, origen, rol, tribunal="1° Juzgado Civil de Santiago"):
    db.add(Causa(estado_diario_origen_id=origen.id, rol=rol, tribunal=tribunal,
                 materia="Civil", estado_causa="Tramitación"))


def _corte(db, origen, rol):
    db.add(CausaCorte(estado_diario_origen_id=origen.id, tipo="apelaciones", rol=rol,
                      era="2026", tipo_libro="Civil", corte="C.A. de Santiago",
                      estado_procesal="En Tramitación"))


def test_la_cartera_es_el_ultimo_archivo_de_cada_rut(db):
    viejo_a = _origen(db, "11111111-1", 1)
    a = _origen(db, "11111111-1", 5)
    b = _origen(db, "22222222-2", 3)
    _origen(db, None, 9, deducida=True)  # parcial: no cuenta si hay cargadas

    assert sorted(origenes_cartera_ids(db)) == sorted([a.id, b.id])
    assert viejo_a.id not in origenes_cartera_ids(db)


def test_solo_deducida_es_una_sola(db):
    _origen(db, None, 1, deducida=True)
    ultima = _origen(db, None, 2, deducida=True)
    assert origenes_cartera_ids(db) == [ultima.id]


def test_sin_archivos_no_hay_cartera(db):
    assert origenes_cartera_ids(db) == []
    assert CausaRepository(db).find_filtered()[1] == 0


def test_materia_suma_los_dos_abogados_y_la_compartida_cuenta_una_vez(db):
    a = _origen(db, "11111111-1", 5)
    b = _origen(db, "22222222-2", 3)
    for rol in ("C-1-2020", "C-2-2020", "C-3-2020"):
        _causa(db, a, rol)
    for rol in ("C-3-2020", "C-4-2020"):  # C-3 está en los dos archivos
        _causa(db, b, rol)
    # Misma causa con otro formato de tribunal/mayúsculas: sigue siendo la misma.
    _causa(db, b, "c-1-2020", tribunal="1º JUZGADO CIVIL DE SANTIAGO")
    db.flush()

    repo = CausaRepository(db)
    items, total, _, _ = repo.find_filtered()
    assert total == 4
    assert sorted(c.rol.upper() for c in items) == ["C-1-2020", "C-2-2020", "C-3-2020", "C-4-2020"]
    assert dict(repo.contar_por_materia()) == {"Civil": 4}
    assert repo.contar_activas() == 4


def test_repetidas_dentro_de_un_mismo_archivo_no_se_tocan(db):
    a = _origen(db, "11111111-1", 5)
    _origen(db, "22222222-2", 3)
    _causa(db, a, "C-1-2020")
    _causa(db, a, "C-1-2020")
    db.flush()
    assert CausaRepository(db).find_filtered()[1] == 2


def test_un_origen_explicito_manda_sobre_la_cartera(db):
    a = _origen(db, "11111111-1", 5)
    b = _origen(db, "22222222-2", 3)
    _causa(db, a, "C-1-2020")
    _causa(db, b, "C-2-2020")
    db.flush()
    assert CausaRepository(db).find_filtered(origen_id=b.id)[1] == 1


def test_corte_suma_los_dos_abogados_y_deduplica(db):
    a = _origen(db, "11111111-1", 5)
    b = _origen(db, "22222222-2", 3)
    for rol in ("1", "2"):
        _corte(db, a, rol)
    for rol in ("2", "3"):  # el 2 está en los dos
        _corte(db, b, rol)
    db.flush()

    repo = CausaCorteRepository(db)
    _, total, _, _ = repo.find_filtered()
    assert total == 3
    assert repo.contar_por_tipo_filtrado() == {"apelaciones": 3}
    assert repo.contar_por_tipo() == {"apelaciones": 3}
