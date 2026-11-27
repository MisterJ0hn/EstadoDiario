"""Cargar el Excel de Causas de un abogado ACTUALIZA su cartera, no la duplica.

Antes cada carga insertaba todo otra vez y dejaba las filas de la carga anterior
(`causa` y `causa_corte` acumulaban una copia por carga). Ahora las filas del
abogado se reusan por su llave (`rol + tribunal`), las nuevas se insertan y las
que el Excel ya no trae quedan como retiradas, sin borrarse.

El parseo del Excel se reemplaza por filas armadas a mano: acá se prueba la regla
de actualización, no la lectura del archivo (eso está en `test_import_causas`).
"""

from datetime import date

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.database import BaseTenant
from app.models.causa import ORIGEN_DATO_API, Causa
from app.models.causa_corte import CausaCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.repositories.causa_corte_repository import CausaCorteRepository
from app.repositories.causa_repository import CausaRepository
from app.services import causa_import_service
from app.services.causa_import_service import CausaImportService

TRIBUNAL = "1° Juzgado Civil de Santiago"
RUT_A, RUT_B = "11111111-1", "22222222-2"


@pytest.fixture
def db():
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def _btrim(conexion, _):
        conexion.create_function("btrim", 1, lambda v: v.strip() if v is not None else None)

    BaseTenant.metadata.create_all(engine)
    sesion = sessionmaker(bind=engine)()
    try:
        yield sesion
    finally:
        sesion.close()


def _civil(rol, estado="Tramitación", tribunal=TRIBUNAL):
    return {"materia": "Civil", "rol": rol, "tribunal": tribunal, "estado_causa": estado,
            "caratulado": f"CARATULA {rol}"}


def _apelacion(rol):
    return {"tipo": "apelaciones", "rol": rol, "era": "2026", "corte": "C.A. de Santiago",
            "estado_procesal": "En Tramitación"}


def _cargar(db, monkeypatch, rut, dia, filas):
    monkeypatch.setattr(causa_import_service, "parse_causas_file", lambda _ruta: filas)
    return CausaImportService(db).import_file(
        f"/tmp/{rut}-{dia}.xlsx", rut, date(2026, 11, dia), None, f"Causas_{rut}.xlsx"
    )


def _vigentes(db):
    return sorted(c.rol for c in CausaRepository(db).find_filtered()[0])


def test_recargar_no_duplica_y_conserva_el_id(db, monkeypatch):
    _cargar(db, monkeypatch, RUT_A, 1, [_civil("C-1-2020"), _civil("C-2-2020")])
    ids = {c.rol: c.id for c in db.query(Causa).all()}

    _cargar(db, monkeypatch, RUT_A, 8, [_civil("C-1-2020", "Concluida"), _civil("C-2-2020")])

    assert db.query(Causa).count() == 2  # ninguna copia nueva
    assert {c.rol: c.id for c in db.query(Causa).all()} == ids  # mismos ids
    # El estado se actualiza con lo que trae el Excel nuevo.
    assert db.query(Causa).filter_by(rol="C-1-2020").one().estado_causa == "Concluida"
    # Todas cuelgan del archivo nuevo; el viejo queda registrado, sin filas.
    nuevo = db.query(EstadoDiarioOrigen).order_by(EstadoDiarioOrigen.id.desc()).first()
    assert {c.estado_diario_origen_id for c in db.query(Causa).all()} == {nuevo.id}
    assert db.query(EstadoDiarioOrigen).filter_by(tipo="causas").count() == 2


def test_guarda_el_original_para_auditar(db, monkeypatch):
    r = _cargar(db, monkeypatch, RUT_A, 1, [_civil("C-1-2020")])
    origen = db.get(EstadoDiarioOrigen, r["origen_id"])
    assert origen.url == "11111111-1-1.xlsx"
    assert origen.nombre_archivo == "Causas_11111111-1.xlsx"


def test_la_que_sale_del_reporte_queda_retirada_y_no_se_cuenta(db, monkeypatch):
    _cargar(db, monkeypatch, RUT_A, 1, [_civil("C-1-2020"), _civil("C-2-2020")])
    r = _cargar(db, monkeypatch, RUT_A, 8, [_civil("C-1-2020")])

    assert r["causas_retiradas"] == 1
    assert _vigentes(db) == ["C-1-2020"]
    retirada = db.query(Causa).filter_by(rol="C-2-2020").one()
    assert retirada.retirada_en is not None  # no se borra
    assert CausaRepository(db).contar_activas() == 1


def test_si_vuelve_a_aparecer_deja_de_estar_retirada(db, monkeypatch):
    _cargar(db, monkeypatch, RUT_A, 1, [_civil("C-1-2020"), _civil("C-2-2020")])
    _cargar(db, monkeypatch, RUT_A, 8, [_civil("C-1-2020")])
    _cargar(db, monkeypatch, RUT_A, 15, [_civil("C-1-2020"), _civil("C-2-2020")])

    assert _vigentes(db) == ["C-1-2020", "C-2-2020"]
    assert db.query(Causa).count() == 2


def test_cargar_a_un_abogado_no_toca_la_cartera_del_otro(db, monkeypatch):
    _cargar(db, monkeypatch, RUT_A, 1, [_civil("C-1-2020"), _civil("C-2-2020")])
    r = _cargar(db, monkeypatch, RUT_B, 3, [_civil("C-9-2020")])

    assert r["causas_retiradas"] == 0
    assert _vigentes(db) == ["C-1-2020", "C-2-2020", "C-9-2020"]


def test_la_causa_compartida_por_dos_abogados_cuenta_una_vez(db, monkeypatch):
    _cargar(db, monkeypatch, RUT_A, 1, [_civil("C-1-2020"), _civil("C-2-2020")])
    _cargar(db, monkeypatch, RUT_B, 3, [_civil("C-2-2020"), _civil("C-3-2020")])

    assert _vigentes(db) == ["C-1-2020", "C-2-2020", "C-3-2020"]


def test_legado_con_copias_por_carga_se_colapsa_en_la_siguiente_carga(db, monkeypatch):
    """Lo que ya está cargado: la misma causa repetida en cada archivo del RUT."""
    for dia in (1, 8):
        o = EstadoDiarioOrigen(tipo="causas", rut=RUT_A, fecha=date(2026, 11, dia))
        db.add(o)
        db.flush()
        db.add(Causa(estado_diario_origen_id=o.id, rol="C-1-2020", tribunal=TRIBUNAL, materia="Civil"))
    db.flush()

    r = _cargar(db, monkeypatch, RUT_A, 15, [_civil("C-1-2020")])

    assert _vigentes(db) == ["C-1-2020"]
    assert r["causas_retiradas"] == 1  # la copia sobrante


def test_una_causa_de_api_del_archivo_anterior_no_se_retira(db, monkeypatch):
    _cargar(db, monkeypatch, RUT_A, 1, [_civil("C-1-2020")])
    origen = db.query(EstadoDiarioOrigen).one()
    db.add(Causa(estado_diario_origen_id=origen.id, rol="C-77-2021", tribunal=TRIBUNAL,
                 materia="Civil", origen_dato=ORIGEN_DATO_API))
    db.flush()

    r = _cargar(db, monkeypatch, RUT_A, 8, [_civil("C-1-2020")])

    assert r["causas_retiradas"] == 0
    assert _vigentes(db) == ["C-1-2020", "C-77-2021"]


def test_una_causa_de_api_que_el_excel_trae_pasa_a_ser_del_excel(db, monkeypatch):
    _cargar(db, monkeypatch, RUT_A, 1, [_civil("C-1-2020")])
    origen = db.query(EstadoDiarioOrigen).one()
    db.add(Causa(estado_diario_origen_id=origen.id, rol="C-77-2021", tribunal=TRIBUNAL,
                 materia="Civil", origen_dato=ORIGEN_DATO_API, rut_asignado="99999999-9"))
    db.flush()

    _cargar(db, monkeypatch, RUT_A, 8, [_civil("C-1-2020"), _civil("C-77-2021")])

    causa = db.query(Causa).filter_by(rol="C-77-2021").one()
    assert causa.origen_dato == "causas"
    assert causa.rut_asignado is None
    assert db.query(Causa).count() == 2


def test_corte_se_actualiza_y_conserva_la_causa_origen(db, monkeypatch):
    _cargar(db, monkeypatch, RUT_A, 1, [_apelacion("100"), _apelacion("200")])
    c = db.query(CausaCorte).filter_by(rol="100").one()
    c.origen_rol = "C-711-2026"  # lo dejó la consulta al detalle PJUD
    db.flush()

    r = _cargar(db, monkeypatch, RUT_A, 8, [_apelacion("100")])

    assert db.query(CausaCorte).count() == 2
    assert db.query(CausaCorte).filter_by(rol="100").one().origen_rol == "C-711-2026"
    assert r["causas_retiradas"] == 1
    assert CausaCorteRepository(db).find_filtered()[1] == 1
    assert CausaCorteRepository(db).contar_por_tipo() == {"apelaciones": 1}


def test_depuracion_del_legado(db):
    from app.services.cartera_depuracion_service import depurar_versiones_anteriores

    def archivo(rut, dia, roles):
        o = EstadoDiarioOrigen(tipo="causas", rut=rut, fecha=date(2026, 11, dia))
        db.add(o)
        db.flush()
        for rol in roles:
            db.add(Causa(estado_diario_origen_id=o.id, rol=rol, tribunal=TRIBUNAL, materia="Civil"))
        return o

    archivo(RUT_A, 1, ["C-1-2020", "C-2-2020", "C-3-2020"])
    archivo(RUT_A, 8, ["C-1-2020", "C-2-2020"])          # C-3 salió
    archivo(RUT_A, 15, ["C-1-2020", "C-2-2020", "C-4-2020"])
    archivo(RUT_B, 3, ["C-9-2020"])                       # un solo archivo: no se toca
    db.flush()

    r = depurar_versiones_anteriores(db)

    assert r == {"ruts": 1, "borradas": 4, "retiradas": 1, "movidas": 1}
    assert _vigentes(db) == ["C-1-2020", "C-2-2020", "C-4-2020", "C-9-2020"]
    assert db.query(Causa).count() == 5  # + la retirada C-3
    assert depurar_versiones_anteriores(db)["borradas"] == 0  # idempotente
