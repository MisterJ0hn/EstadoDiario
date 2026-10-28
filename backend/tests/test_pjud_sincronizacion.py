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


class TestSincronizarParaIntegradores:
    """`POST /causas/{id}/pjud/sincronizar` y `GET /causas/{id}/pjud/estado`."""

    def _tenant(self):
        import types
        return types.SimpleNamespace(cliente_id=None)

    def _encolar(self, db, consultar, causa_id=10, materia="Civil"):
        return causas._encolar_sincronizacion(
            db, self._tenant(), causa_id=causa_id, materia=materia,
            rol="C-1-2026", tribunal="1° Juzgado", consultar=consultar,
        )

    @pytest.fixture(autouse=True)
    def _sin_log_ni_proveedor(self, monkeypatch):
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@x.cl")
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "x")
        monkeypatch.setattr(causas, "_registrar_llamado_pjud", lambda *a, **k: None)

    def test_encola_y_devuelve_el_job_y_las_rutas(self, db):
        def consultar(servicio):
            servicio.job_id = "job-9"
            return {"estado": "sincronizando", "mensaje": "x"}

        # Lo que hace `_detalle_pjud` al ver un `job_id` nuevo: guardarlo.
        r = self._encolar(db, consultar)
        assert (r.estado, r.job_id, r.ya_en_curso) == ("sincronizando", "job-9", False)
        assert r.consultar_estado == "/api/v1/causas/10/pjud/estado"
        assert r.consultar_detalle == "/api/v1/causas/10/pjud/movimientos"

    def test_con_un_job_en_curso_no_encola_otro(self, db):
        _registrar(PjudSincronizacionRepository(db), "job-1")

        def no_debe_llamarse(_):
            raise AssertionError("no debía encolar")

        r = self._encolar(db, no_debe_llamarse)
        assert (r.estado, r.job_id, r.ya_en_curso) == ("sincronizando", "job-1", True)

    def test_tras_un_error_si_vuelve_a_encolar(self, db):
        repo = PjudSincronizacionRepository(db)
        _registrar(repo, "job-1")
        repo.cerrar("job-1", exito=False, mensaje_error="boom")

        def consultar(servicio):
            servicio.job_id = "job-2"
            return {"estado": "sincronizando"}

        r = self._encolar(db, consultar)
        assert (r.job_id, r.ya_en_curso) == ("job-2", False)

    def test_apelaciones_usa_las_rutas_de_cortes(self, db):
        def consultar(servicio):
            servicio.job_id = "job-c"
            return {"estado": "sincronizando"}

        r = self._encolar(db, consultar, causa_id=7, materia="Apelaciones")
        assert r.consultar_estado == "/api/v1/causas/cortes/7/pjud/estado"
        assert r.consultar_detalle == "/api/v1/causas/cortes/7/pjud/apelaciones"

    def test_materia_no_sincronizable_da_422(self):
        import types
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as e:
            causas._materia_sincronizable(types.SimpleNamespace(materia="Otra"))
        assert e.value.status_code == 422

    def test_estado_sin_sincronizar(self, db):
        r = causas._estado_sincronizacion(db, self._tenant(), causa_id=10, materia="Civil")
        assert r.estado == "sin_sincronizar" and r.job_id is None

    def test_estado_refleja_el_ultimo_job(self, db):
        repo = PjudSincronizacionRepository(db)
        _registrar(repo, "job-1")
        r = causas._estado_sincronizacion(db, self._tenant(), causa_id=10, materia="Civil")
        assert (r.estado, r.job_id) == ("sincronizando", "job-1")
        repo.cerrar("job-1", exito=False, mensaje_error="No fue posible conectar con pjud")
        r = causas._estado_sincronizacion(db, self._tenant(), causa_id=10, materia="Civil")
        assert (r.estado, r.mensaje_error) == ("error", "No fue posible conectar con pjud")


class TestSyncDescartaLaCopiaDelEspejo:
    """Un sync encolado por la app o por `POST /causas/{id}/pjud/sincronizar` deja sin
    vigencia la copia que el espejo de api-pjud tenía de esa causa."""

    CUERPO = {"corte": 90, "tribunal": 276, "tipo": "C", "rol": 1234, "anio": 2026}

    @pytest.fixture()
    def tenant_db(self):
        from app.models.pjud_copia import PjudCopia
        engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        PjudCopia.metadata.create_all(bind=engine, tables=[PjudCopia.__table__])
        sesion = sessionmaker(bind=engine)()
        yield sesion
        sesion.close()

    @pytest.fixture(autouse=True)
    def _config(self, monkeypatch):
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@x.cl")
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "x")
        monkeypatch.setattr(causas, "_registrar_llamado_pjud", lambda *a, **k: None)

    def _copia(self, tenant_db):
        from app.repositories.pjud_copia_repository import PjudCopiaRepository, clave_de
        PjudCopiaRepository(tenant_db).guardar(
            "/consultar_civil", clave_de(self.CUERPO), "abc", "{}"
        )
        return PjudCopiaRepository(tenant_db), clave_de(self.CUERPO)

    def _detalle(self, db, tenant_db, consultar):
        import types
        return causas._detalle_pjud(
            db, types.SimpleNamespace(cliente_id=None), db=tenant_db, causa_id=10,
            materia="Civil", rol="C-1234-2026", tribunal="1° Juzgado", forzar=True,
            consultar=consultar,
        )

    def test_al_encolar_se_descarta_la_copia(self, db, tenant_db):
        copias, clave = self._copia(tenant_db)

        def consultar(servicio):
            servicio.encolados.append(("civil", self.CUERPO))
            return {"estado": "sincronizando"}

        self._detalle(db, tenant_db, consultar)
        assert copias.vigente("/consultar_civil", clave, 30) is None

    def test_si_no_se_encoló_nada_la_copia_se_queda(self, db, tenant_db):
        copias, clave = self._copia(tenant_db)
        self._detalle(db, tenant_db, lambda servicio: {"estado": "listo"})
        assert copias.vigente("/consultar_civil", clave, 30) is not None

    def test_sincronizar_registra_lo_encolado_en_el_servicio(self, monkeypatch):
        from app.services.pjud_service import PjudService
        servicio = PjudService()
        monkeypatch.setattr(servicio, "_request", lambda *a, **k: {"job_id": "j"})
        servicio._sincronizar(self.CUERPO, None, "civil")
        assert servicio.encolados == [("civil", self.CUERPO)]

    def test_solo_lectura_no_encola_ni_registra(self):
        from app.services.pjud_service import PjudService
        servicio = PjudService()
        servicio.solo_lectura = True
        servicio._sincronizar(self.CUERPO, None, "civil")
        assert servicio.encolados == []
