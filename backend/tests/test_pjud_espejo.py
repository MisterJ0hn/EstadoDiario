"""Espejo de api-pjud para sistemas externos (`/pjud/consultar_*`, `sincronizar_*`).

SQLite en memoria; api-pjud se reemplaza por un doble que cuenta los llamados.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints import pjud_espejo
from app.api.v1.endpoints.causas import requerir_pjud_habilitado
from app.core.database import get_db_maestra
from app.core.deps import TenantContexto, get_db_tenant, get_tenant_actual, get_usuario_actual
from app.models.maestra.pjud_sincronizacion import PjudSincronizacion
from app.models.pjud_copia import PjudCopia
from app.repositories.pjud_copia_repository import PjudCopiaRepository
from app.repositories.pjud_sincronizacion_repository import PjudSincronizacionRepository
from app.services.pjud_service import PjudConflicto, PjudNoEncontrado, PjudService

CUERPO = {"corte": 90, "tribunal": 276, "tipo": "C", "rol": 1234, "anio": 2026}
CON_CLAVE = {**CUERPO, "rut": "1-9", "clave": "secreta", "metodo_login": 1}
CABECERA_LISTA = {"causa": {"identificador": "abc", "estado": "Completo", "cuadernos": [{"id": 1}]}}
MOVIMIENTOS = {"historia": [{"folio": 1, "doc": "http://api-pjud.codifica.cl/public/abc/1/a.pdf"}]}


class FalsoPjud:
    """Doble de `PjudService`: responde lo que el test le deja en `respuestas`."""

    respuestas: dict = {}
    llamados: list = []

    def __init__(self):
        pass

    def reenviar(self, ruta, cuerpo):
        FalsoPjud.llamados.append((ruta, dict(cuerpo)))
        valor = FalsoPjud.respuestas.get(ruta)
        if isinstance(valor, Exception):
            raise valor
        return valor

    @staticmethod
    def callback_url():
        return "https://nosotros/callback"

    reescribir_documentos = staticmethod(PjudService.reescribir_documentos)

    def catalogo_tribunales(self, competencia):
        FalsoPjud.llamados.append(("catalogo", competencia))
        return [{"id": 90, "nombre": "C.A. de Santiago", "tribunales": [{"id": 276, "nombre": "1° Juzgado Civil"}]}]


@pytest.fixture()
def bases():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    PjudCopia.metadata.create_all(bind=engine, tables=[PjudCopia.__table__])
    PjudSincronizacion.metadata.create_all(bind=engine, tables=[PjudSincronizacion.__table__])
    from app.models.maestra.pjud_llamado import PjudLlamado
    PjudLlamado.__table__.create(bind=engine, checkfirst=True)
    sesion = sessionmaker(bind=engine)
    tenant, maestra = sesion(), sesion()
    yield tenant, maestra
    tenant.close()
    maestra.close()


@pytest.fixture()
def http(bases, monkeypatch):
    tenant_db, maestra_db = bases
    FalsoPjud.respuestas = {}
    FalsoPjud.llamados = []
    monkeypatch.setattr(pjud_espejo, "PjudService", FalsoPjud)
    app = FastAPI()
    app.include_router(pjud_espejo.router)
    app.dependency_overrides[get_db_tenant] = lambda: tenant_db
    app.dependency_overrides[get_db_maestra] = lambda: maestra_db
    app.dependency_overrides[get_tenant_actual] = lambda: TenantContexto(
        guid="g", cliente_id=1, usuario_id=1
    )
    app.dependency_overrides[get_usuario_actual] = lambda: None
    app.dependency_overrides[requerir_pjud_habilitado] = lambda: None
    return TestClient(app)


def _llamadas(ruta):
    return [c for c in FalsoPjud.llamados if c[0] == ruta]


class TestConsultar:
    def test_primera_vez_consulta_y_la_segunda_sale_de_la_copia(self, http):
        FalsoPjud.respuestas["/consultar_civil"] = CABECERA_LISTA
        for _ in range(2):
            r = http.post("/pjud/consultar_civil", json=CUERPO)
            assert r.status_code == 200 and r.json() == CABECERA_LISTA
        assert len(_llamadas("/consultar_civil")) == 1

    def test_las_credenciales_se_reenvian_pero_no_se_guardan_ni_cambian_la_clave(self, http, bases):
        FalsoPjud.respuestas["/consultar_civil"] = CABECERA_LISTA
        http.post("/pjud/consultar_civil", json=CON_CLAVE)
        assert _llamadas("/consultar_civil")[0][1]["clave"] == "secreta"  # viaja al proveedor
        fila = bases[0].query(PjudCopia).one()
        assert "secreta" not in fila.clave and "secreta" not in fila.respuesta
        # Otro sistema, sin credenciales, comparte la misma copia.
        http.post("/pjud/consultar_civil", json=CUERPO)
        assert len(_llamadas("/consultar_civil")) == 1

    def test_copia_vencida_vuelve_a_consultar(self, http, bases):
        FalsoPjud.respuestas["/consultar_civil"] = CABECERA_LISTA
        http.post("/pjud/consultar_civil", json=CUERPO)
        fila = bases[0].query(PjudCopia).one()
        fila.capturado_en = datetime.now(timezone.utc) - timedelta(hours=2)
        bases[0].commit()
        http.post("/pjud/consultar_civil", json=CUERPO)
        assert len(_llamadas("/consultar_civil")) == 2

    @pytest.mark.parametrize("cabecera", [
        {"causa": {"identificador": "abc", "estado": "Sincronizando", "cuadernos": [{"id": 1}]}},
        {"causa": {"identificador": "abc", "estado": "Completo", "cuadernos": []}},  # Civil sin cuadernos
    ])
    def test_sincronizando_no_se_guarda(self, http, bases, cabecera):
        FalsoPjud.respuestas["/consultar_civil"] = cabecera
        for _ in range(2):
            assert http.post("/pjud/consultar_civil", json=CUERPO).json() == cabecera
        assert len(_llamadas("/consultar_civil")) == 2
        assert bases[0].query(PjudCopia).count() == 0

    def test_familia_sin_cuadernos_si_se_guarda(self, http):
        familia = {"causa": {"identificador": "f1", "estado": "Completo"}}
        FalsoPjud.respuestas["/consultar_familia"] = familia
        for _ in range(2):
            http.post("/pjud/consultar_familia", json=CUERPO)
        assert len(_llamadas("/consultar_familia")) == 1

    def test_movimientos_solo_se_guardan_con_la_cabecera_vigente(self, http):
        FalsoPjud.respuestas["/consultar_movimientos_civil"] = MOVIMIENTOS
        cuerpo = {"identificador": "abc", "cuadeno": 1}
        for _ in range(2):
            http.post("/pjud/consultar_movimientos_civil", json=cuerpo)
        assert len(_llamadas("/consultar_movimientos_civil")) == 2  # aún sin cabecera

        FalsoPjud.respuestas["/consultar_civil"] = CABECERA_LISTA
        http.post("/pjud/consultar_civil", json=CUERPO)
        for _ in range(2):
            http.post("/pjud/consultar_movimientos_civil", json=cuerpo)
        assert len(_llamadas("/consultar_movimientos_civil")) == 3  # una más, y ahora sí queda

    def test_las_urls_de_documentos_pasan_por_nuestro_espejo(self, http):
        FalsoPjud.respuestas["/consultar_movimientos_civil"] = MOVIMIENTOS
        texto = http.post(
            "/pjud/consultar_movimientos_civil", json={"identificador": "abc", "cuadeno": 1}
        ).text
        assert "api-pjud.codifica.cl" not in texto
        assert "/api/v1/pjud/public/abc/1/a.pdf" in texto

    def test_404_y_409_del_proveedor(self, http):
        FalsoPjud.respuestas["/consultar_civil"] = PjudNoEncontrado("no está")
        assert http.post("/pjud/consultar_civil", json=CUERPO).status_code == 404
        FalsoPjud.respuestas["/consultar_civil"] = PjudConflicto("ocupado")
        assert http.post("/pjud/consultar_civil", json=CUERPO).status_code == 409

    def test_cuerpo_que_no_es_un_objeto_da_422(self, http):
        assert http.post("/pjud/consultar_civil", json=[1, 2]).status_code == 422


class TestSincronizar:
    def test_reenvia_con_nuestro_callback_y_responde_lo_del_proveedor(self, http, bases):
        FalsoPjud.respuestas["/sincronizar_civil"] = {"job_id": "job-7"}
        r = http.post("/pjud/sincronizar_civil", json={**CON_CLAVE, "callback_url": "https://otro/x"})
        assert r.status_code == 200 and r.json() == {"job_id": "job-7"}
        enviado = _llamadas("/sincronizar_civil")[0][1]
        assert enviado["callback_url"] == "https://nosotros/callback"
        assert enviado["clave"] == "secreta"
        fila = PjudSincronizacionRepository(bases[1]).por_job_id("job-7")
        assert (fila.cliente_id, fila.materia, fila.estado) == (1, "Civil", "sincronizando")

    def test_descarta_la_copia_de_esa_causa(self, http, bases):
        FalsoPjud.respuestas["/consultar_civil"] = CABECERA_LISTA
        FalsoPjud.respuestas["/consultar_movimientos_civil"] = MOVIMIENTOS
        FalsoPjud.respuestas["/sincronizar_civil"] = {"job_id": "job-8"}
        http.post("/pjud/consultar_civil", json=CUERPO)
        http.post("/pjud/consultar_movimientos_civil", json={"identificador": "abc", "cuadeno": 1})
        assert bases[0].query(PjudCopia).count() == 2

        http.post("/pjud/sincronizar_civil", json=CUERPO)
        assert bases[0].query(PjudCopia).count() == 0
        http.post("/pjud/consultar_civil", json=CUERPO)
        assert len(_llamadas("/consultar_civil")) == 2

    def test_no_reenvia_si_ya_hay_un_sync_en_curso_de_la_misma_causa(self, http, bases):
        FalsoPjud.respuestas["/sincronizar_civil"] = {"job_id": "job-1"}
        primero = http.post("/pjud/sincronizar_civil", json=CUERPO)
        segundo = http.post("/pjud/sincronizar_civil", json={**CUERPO, "rut": "1-9", "clave": "x"})
        assert primero.json() == {"job_id": "job-1"}
        assert segundo.status_code == 200
        assert segundo.json()["job_id"] == "job-1"
        assert segundo.json()["ya_en_curso"] is True and segundo.json()["estado"] == "sincronizando"
        assert "en proceso" in segundo.json()["mensaje"]
        assert len(_llamadas("/sincronizar_civil")) == 1

    def test_si_el_ultimo_sync_termino_bien_hace_poco_avisa_lista_y_no_reenvia(self, http, bases):
        """Integración que repite sincronizar cada pocos segundos: tras el callback
        `listo` no se abre otro job, se le dice que la causa ya está lista."""
        FalsoPjud.respuestas["/sincronizar_civil"] = {"job_id": "job-1"}
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        PjudSincronizacionRepository(bases[1]).cerrar("job-1", exito=True)
        r = http.post("/pjud/sincronizar_civil", json=CUERPO)
        assert r.status_code == 200
        assert r.json()["estado"] == "listo" and r.json()["ya_sincronizada"] is True
        assert r.json()["job_id"] == "job-1"
        assert len(_llamadas("/sincronizar_civil")) == 1

    def test_pasado_el_enfriamiento_se_puede_sincronizar_de_nuevo(self, http, bases):
        FalsoPjud.respuestas["/sincronizar_civil"] = {"job_id": "job-1"}
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        fila = PjudSincronizacionRepository(bases[1]).cerrar("job-1", exito=True)
        fila.actualizado_en = datetime.now(timezone.utc) - timedelta(hours=1)
        bases[1].commit()
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        assert len(_llamadas("/sincronizar_civil")) == 2

    def test_otra_causa_o_otro_anio_si_se_encola(self, http):
        FalsoPjud.respuestas["/sincronizar_civil"] = {"job_id": "job-1"}
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        http.post("/pjud/sincronizar_civil", json={**CUERPO, "anio": 2025})
        assert len(_llamadas("/sincronizar_civil")) == 2

    def test_terminado_el_job_se_puede_volver_a_sincronizar(self, http, bases):
        FalsoPjud.respuestas["/sincronizar_civil"] = {"job_id": "job-1"}
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        fila = PjudSincronizacionRepository(bases[1]).cerrar("job-1", exito=True)
        fila.actualizado_en = datetime.now(timezone.utc) - timedelta(hours=1)
        bases[1].commit()
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        assert len(_llamadas("/sincronizar_civil")) == 2

    def test_tras_un_error_se_puede_reintentar_enseguida(self, http, bases):
        FalsoPjud.respuestas["/sincronizar_civil"] = {"job_id": "job-1"}
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        PjudSincronizacionRepository(bases[1]).cerrar("job-1", exito=False, mensaje_error="boom")
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        assert len(_llamadas("/sincronizar_civil")) == 2

    def test_cada_llamado_queda_en_pjud_llamado(self, http, bases):
        from app.models.maestra.pjud_llamado import PjudLlamado
        FalsoPjud.respuestas["/sincronizar_civil"] = {"job_id": "job-1"}
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        filas = bases[1].query(PjudLlamado).order_by(PjudLlamado.id).all()
        assert [f.resultado for f in filas] == ["sincronizando", "ya_en_curso"]
        assert filas[0].rol == "C-1234-2026" and "job-1" in filas[0].diagnostico
        assert "clave" not in (filas[0].diagnostico or "").replace("clave del abogado", "")

    def test_409_se_propaga(self, http):
        FalsoPjud.respuestas["/sincronizar_civil"] = PjudConflicto("ya en curso")
        assert http.post("/pjud/sincronizar_civil", json=CUERPO).status_code == 409

    def test_un_envio_aun_sin_job_id_ya_ocupa_el_cupo_de_la_causa(self, http, bases):
        """Ráfaga: el primero está en vuelo (api-pjud no respondió) y el segundo llega."""
        PjudSincronizacionRepository(bases[1]).reservar(
            cliente_id=1, causa_id=None, materia="Civil", rol="C-1234-2026", tribunal="90/276"
        )
        FalsoPjud.respuestas["/sincronizar_civil"] = {"job_id": "job-2"}
        r = http.post("/pjud/sincronizar_civil", json=CUERPO)
        assert r.status_code == 200
        assert r.json()["job_id"] is None  # el provisorio no se entrega
        assert r.json()["estado"] == "sincronizando" and r.json()["ya_en_curso"] is True
        assert _llamadas("/sincronizar_civil") == []

    def test_la_reserva_se_suelta_si_el_proveedor_rechaza(self, http, bases):
        FalsoPjud.respuestas["/sincronizar_civil"] = PjudConflicto("ocupado")
        assert http.post("/pjud/sincronizar_civil", json=CUERPO).status_code == 409
        assert bases[1].query(PjudSincronizacion).count() == 0
        FalsoPjud.respuestas["/sincronizar_civil"] = {"job_id": "job-3"}
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        assert len(_llamadas("/sincronizar_civil")) == 2

    def test_la_reserva_se_suelta_si_no_hay_job_id(self, http, bases):
        FalsoPjud.respuestas["/sincronizar_civil"] = {}
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        assert bases[1].query(PjudSincronizacion).count() == 0

    def test_la_reserva_queda_con_el_job_id_real(self, http, bases):
        FalsoPjud.respuestas["/sincronizar_civil"] = {"job_id": "job-5"}
        http.post("/pjud/sincronizar_civil", json=CUERPO)
        filas = bases[1].query(PjudSincronizacion).all()
        assert [(f.job_id, f.estado) for f in filas] == [("job-5", "sincronizando")]


class TestCatalogo:
    @pytest.mark.parametrize("competencia", ["civil", "laboral", "cobranza", "penal"])
    def test_entrega_los_ids_con_la_forma_de_api_pjud(self, http, competencia):
        r = http.get("/pjud/catalogo/tribunales", params={"competencia": competencia})
        assert r.status_code == 200
        assert r.json()["cortes"][0]["tribunales"][0] == {"id": 276, "nombre": "1° Juzgado Civil"}

    @pytest.mark.parametrize("competencia", ["familia", "apelaciones", "otra"])
    def test_sin_catalogo_da_400_como_api_pjud(self, http, competencia):
        r = http.get("/pjud/catalogo/tribunales", params={"competencia": competencia})
        assert r.status_code == 400

    def test_competencia_es_obligatoria(self, http):
        assert http.get("/pjud/catalogo/tribunales").status_code == 422


class TestRepositorio:
    def test_guardar_una_cabecera_descarta_sus_movimientos(self, bases):
        repo = PjudCopiaRepository(bases[0])
        repo.guardar("/consultar_movimientos_civil", "m", "abc", "{}")
        repo.guardar("/consultar_civil", "c", "abc", "{}")
        assert [f.ruta for f in bases[0].query(PjudCopia).all()] == ["/consultar_civil"]

    def test_clave_de_ignora_credenciales_y_orden(self):
        a = pjud_espejo.clave_de({"rol": 1, "anio": 2, "rut": "x", "clave": "y"})
        b = pjud_espejo.clave_de({"anio": 2, "rol": 1})
        assert a == b and "rut" not in a
