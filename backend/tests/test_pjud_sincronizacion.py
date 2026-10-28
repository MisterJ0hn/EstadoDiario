"""Jobs de `sincronizar_*` y su callback.

Usa SQLite en memoria: las tablas no dependen de nada específico de Postgres.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints import causas
from app.core.database import get_db_maestra
from app.models.maestra.pjud_sincronizacion import PjudSincronizacion
from app.repositories.pjud_sincronizacion_repository import (
    ERROR,
    LISTO,
    SINCRONIZANDO,
    PjudSincronizacionRepository,
)


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    PjudSincronizacion.metadata.create_all(bind=engine, tables=[PjudSincronizacion.__table__])
    sesion = sessionmaker(bind=engine)()
    yield sesion
    sesion.close()


def _registrar(repo, job_id="job-1", causa_id=10, materia="Civil"):
    return repo.registrar(
        job_id=job_id, cliente_id=None, causa_id=causa_id,
        materia=materia, rol="C-1-2026", tribunal="1° Juzgado",
    )


class TestRepositorio:
    def test_registrar_deja_el_job_sincronizando(self, db):
        fila = _registrar(PjudSincronizacionRepository(db))
        assert fila.estado == SINCRONIZANDO

    def test_cerrar_con_exito(self, db):
        repo = PjudSincronizacionRepository(db)
        _registrar(repo)
        assert repo.cerrar("job-1", exito=True).estado == LISTO

    def test_cerrar_con_error_guarda_el_mensaje(self, db):
        repo = PjudSincronizacionRepository(db)
        _registrar(repo)
        fila = repo.cerrar("job-1", exito=False, mensaje_error="No fue posible conectar con pjud")
        assert (fila.estado, fila.mensaje_error) == (ERROR, "No fue posible conectar con pjud")

    def test_job_desconocido_devuelve_none(self, db):
        assert PjudSincronizacionRepository(db).cerrar("nada", exito=True) is None

    def test_ultimo_por_causa_y_materia(self, db):
        repo = PjudSincronizacionRepository(db)
        _registrar(repo, "a", causa_id=10)
        repo.cerrar("a", exito=True)
        _registrar(repo, "b", causa_id=10)
        _registrar(repo, "c", causa_id=10, materia="Apelaciones")
        civil = repo.ultimos_por_causa(cliente_id=None, causa_ids=[10])
        assert civil[10].job_id == "b"
        corte = repo.ultimos_por_causa(cliente_id=None, causa_ids=[10], apelaciones=True)
        assert corte[10].job_id == "c"

    def test_sincronizando_vencido_no_cuenta(self, db):
        repo = PjudSincronizacionRepository(db)
        fila = _registrar(repo)
        fila.creado_en = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()
        assert repo.ultimos_por_causa(cliente_id=None, causa_ids=[10]) == {}


@pytest.fixture()
def cliente_http(db):
    app = FastAPI()
    app.include_router(causas.router)
    app.dependency_overrides[get_db_maestra] = lambda: db
    return TestClient(app)


class TestCallback:
    def test_exito_deja_la_sincronizacion_lista(self, db, cliente_http):
        _registrar(PjudSincronizacionRepository(db), "xxssw2232")
        r = cliente_http.post("/causas/pjud/callback", json={"éxito": True, "job_id": "xxssw2232"})
        assert r.status_code == 200 and r.json() == {"exito": True}
        assert PjudSincronizacionRepository(db).por_job_id("xxssw2232").estado == LISTO

    def test_acepta_exito_sin_tilde(self, db, cliente_http):
        _registrar(PjudSincronizacionRepository(db), "j")
        r = cliente_http.post("/causas/pjud/callback", json={"exito": True, "job_id": "j"})
        assert r.json() == {"exito": True}

    def test_error_guarda_mensaje_error(self, db, cliente_http):
        _registrar(PjudSincronizacionRepository(db), "343sfdfer")
        r = cliente_http.post("/causas/pjud/callback", json={
            "éxito": False, "mensaje_error": "No fue posible conectar con pjud",
            "job_id": "343sfdfer",
        })
        assert r.status_code == 200
        fila = PjudSincronizacionRepository(db).por_job_id("343sfdfer")
        assert (fila.estado, fila.mensaje_error) == (ERROR, "No fue posible conectar con pjud")

    def test_job_desconocido_responde_200_sin_aplicar(self, cliente_http):
        r = cliente_http.post("/causas/pjud/callback", json={"exito": True, "job_id": "nada"})
        assert r.status_code == 200 and r.json() == {"exito": False}

    def test_repetido_es_idempotente(self, db, cliente_http):
        _registrar(PjudSincronizacionRepository(db), "j")
        for _ in range(2):
            r = cliente_http.post("/causas/pjud/callback", json={"exito": True, "job_id": "j"})
            assert r.json() == {"exito": True}
        assert PjudSincronizacionRepository(db).por_job_id("j").estado == LISTO


class TestDetallePjud:
    """`_detalle_pjud`: con un job en la base no se llama a `consultar_*`."""

    def _tenant(self):
        import types
        return types.SimpleNamespace(cliente_id=None)

    def _llamar(self, db, consultar, forzar=False):
        return causas._detalle_pjud(
            db, self._tenant(), causa_id=10, materia="Civil",
            rol="C-1-2026", tribunal="1° Juzgado", forzar=forzar, consultar=consultar,
        )

    def test_sincronizando_en_bd_no_consulta_al_proveedor(self, db):
        _registrar(PjudSincronizacionRepository(db))

        def no_debe_llamarse(_):
            raise AssertionError("no debía consultar")

        assert self._llamar(db, no_debe_llamarse)["estado"] == "sincronizando"

    def _con_error_en_bd(self, db, monkeypatch):
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@x.cl")
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "x")
        repo = PjudSincronizacionRepository(db)
        _registrar(repo)
        repo.cerrar("job-1", exito=False, mensaje_error="No fue posible conectar con pjud")

    def test_error_en_bd_sin_datos_devuelve_el_mensaje(self, db, monkeypatch):
        self._con_error_en_bd(db, monkeypatch)
        resultado = self._llamar(db, lambda s: {"estado": "sincronizando", "causa": None})
        assert resultado["estado"] == "error"
        assert resultado["ultimo_error"] == "No fue posible conectar con pjud"
        assert not resultado.get("causa")

    def test_error_en_bd_conserva_los_datos_ya_guardados(self, db, monkeypatch):
        self._con_error_en_bd(db, monkeypatch)
        vistos = []

        def consultar(servicio):
            vistos.append(servicio.solo_lectura)
            return {"estado": "listo", "causa": {"rol": "C-1-2026"}, "historia": [{"folio": 1}]}

        resultado = self._llamar(db, consultar)
        assert vistos == [True]  # lee, sin encolar otro sincronizar_*
        assert resultado["estado"] == "error"
        assert resultado["ultimo_error"] == "No fue posible conectar con pjud"
        assert resultado["causa"] == {"rol": "C-1-2026"}
        assert resultado["historia"] == [{"folio": 1}]

    def test_forzar_salta_el_atajo_y_guarda_el_job_nuevo(self, db, monkeypatch):
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@x.cl")
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "x")
        repo = PjudSincronizacionRepository(db)
        _registrar(repo)

        def consultar(servicio):
            servicio.job_id = "job-2"
            return {"estado": "sincronizando"}

        assert self._llamar(db, consultar, forzar=True)["estado"] == "sincronizando"
        assert repo.por_job_id("job-2").estado == SINCRONIZANDO

    def test_listo_en_bd_consulta_para_traer_los_datos(self, db, monkeypatch):
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@x.cl")
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "x")
        repo = PjudSincronizacionRepository(db)
        _registrar(repo)
        repo.cerrar("job-1", exito=True)
        assert self._llamar(db, lambda s: {"estado": "listo"})["estado"] == "listo"
