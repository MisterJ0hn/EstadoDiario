"""Marca de asistencia a una audiencia y su efecto en el KPI del dashboard.

Toggle simple (`audiencia.asistio`): la pone el estudio desde el listado de
audiencias, el PJUD no informa asistencia. El KPI "audiencias no asistidas"
cuenta las audiencias **ya ocurridas** sin esa marca.

Base SQLite en memoria: acá se prueba la regla, no SQL de PostgreSQL.
"""

from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import BaseTenant
from app.models.audiencia import Audiencia
from app.repositories.audiencia_repository import AudienciaRepository
from app.repositories.metricas_repository import MetricasRepository

HOY = date(2026, 9, 9)
AYER = HOY - timedelta(days=1)
MANANA = HOY + timedelta(days=1)


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    BaseTenant.metadata.create_all(engine, tables=[Audiencia.__table__])
    sesion = sessionmaker(bind=engine)()
    try:
        yield sesion
    finally:
        sesion.close()


def _audiencia(db, fecha_audiencia, asistio=False, clave="k") -> Audiencia:
    a = Audiencia(
        usuario_id=1,
        fecha_audiencia=fecha_audiencia,
        clave_natural=clave,
        asistio=asistio,
    )
    db.add(a)
    db.flush()
    return a


# ── Marcar / desmarcar ────────────────────────────────────


def test_marcar_asistencia_anota_quien_y_cuando(db):
    a = _audiencia(db, AYER)

    actualizada = AudienciaRepository(db).marcar_asistencia(a.id, True, usuario_id=7)

    assert actualizada is not None
    assert actualizada.asistio is True
    assert actualizada.asistencia_usuario_id == 7
    assert actualizada.asistencia_marcada_en is not None


def test_desmarcar_limpia_la_auditoria(db):
    a = _audiencia(db, AYER)
    repo = AudienciaRepository(db)
    repo.marcar_asistencia(a.id, True, usuario_id=7)

    actualizada = repo.marcar_asistencia(a.id, False, usuario_id=7)

    assert actualizada.asistio is False
    assert actualizada.asistencia_usuario_id is None
    assert actualizada.asistencia_marcada_en is None


def test_marcar_audiencia_inexistente_devuelve_none(db):
    assert AudienciaRepository(db).marcar_asistencia(999, True, usuario_id=7) is None


# ── KPI del dashboard ─────────────────────────────────────


def test_kpi_cuenta_solo_pasadas_sin_marca(db):
    _audiencia(db, AYER, clave="pasada-sin-marca")            # cuenta
    _audiencia(db, AYER, asistio=True, clave="pasada-marcada")  # no cuenta
    _audiencia(db, MANANA, clave="futura")                    # no cuenta (no ocurrió)
    _audiencia(db, HOY, clave="hoy")                          # no cuenta (fecha == hoy)
    db.flush()

    total = MetricasRepository(db).contar_audiencias_no_asistidas(HOY)

    assert total == 1


def test_kpi_baja_al_marcar_asistencia(db):
    a = _audiencia(db, AYER)
    repo = MetricasRepository(db)
    assert repo.contar_audiencias_no_asistidas(HOY) == 1

    AudienciaRepository(db).marcar_asistencia(a.id, True, usuario_id=7)

    assert repo.contar_audiencias_no_asistidas(HOY) == 0
