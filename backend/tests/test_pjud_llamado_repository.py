"""`ultimos_por_causa`: el último `resultado` de cada causa, para pintar el
icono de estado del PJUD en el listado de causas sin golpear al proveedor.

Usa SQLite en memoria: la tabla no depende de nada específico de Postgres.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.maestra.pjud_llamado import PjudLlamado
from app.repositories.pjud_llamado_repository import PjudLlamadoRepository


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    PjudLlamado.metadata.create_all(bind=engine, tables=[PjudLlamado.__table__])
    Sesion = sessionmaker(bind=engine)
    sesion = Sesion()
    yield sesion
    sesion.close()


def _llamado(*, cliente_id, causa_id, resultado, hace_minutos):
    return PjudLlamado(
        cliente_id=cliente_id,
        causa_id=causa_id,
        forzar=False,
        resultado=resultado,
        fecha_hora=datetime.now(timezone.utc) - timedelta(minutes=hace_minutos),
    )


class TestUltimosPorCausa:
    def test_devuelve_el_resultado_mas_reciente_de_cada_causa(self, db):
        db.add_all([
            _llamado(cliente_id=1, causa_id=10, resultado="sincronizando", hace_minutos=30),
            _llamado(cliente_id=1, causa_id=10, resultado="listo", hace_minutos=1),
            _llamado(cliente_id=1, causa_id=11, resultado="error", hace_minutos=5),
        ])
        db.commit()

        resultado = PjudLlamadoRepository(db).ultimos_por_causa(
            cliente_id=1, causa_ids=[10, 11]
        )
        assert resultado == {10: "listo", 11: "error"}

    def test_no_mezcla_causas_de_otro_cliente(self, db):
        db.add_all([
            _llamado(cliente_id=1, causa_id=10, resultado="listo", hace_minutos=1),
            _llamado(cliente_id=2, causa_id=10, resultado="error", hace_minutos=1),
        ])
        db.commit()

        resultado = PjudLlamadoRepository(db).ultimos_por_causa(
            cliente_id=1, causa_ids=[10]
        )
        assert resultado == {10: "listo"}

    def test_causa_nunca_consultada_no_aparece(self, db):
        db.add(_llamado(cliente_id=1, causa_id=10, resultado="listo", hace_minutos=1))
        db.commit()

        resultado = PjudLlamadoRepository(db).ultimos_por_causa(
            cliente_id=1, causa_ids=[10, 99]
        )
        assert 99 not in resultado

    def test_sin_ids_no_consulta_nada(self, db):
        assert PjudLlamadoRepository(db).ultimos_por_causa(cliente_id=1, causa_ids=[]) == {}
