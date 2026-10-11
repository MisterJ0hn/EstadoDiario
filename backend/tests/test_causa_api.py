"""Alta individual de causas por API: nacen SIN abogado.

La regla que se protege: una causa dada de alta por un sistema externo no
hereda el RUT del archivo de la cartera (que es de otro abogado, o de ninguno) y
solo recibe abogado cuando llega un estado diario que la trae.

Base SQLite en memoria: se prueba la regla, no el SQL de PostgreSQL.
"""

from datetime import date, datetime, timezone

import openpyxl
import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import BaseTenant
from app.models.audiencia import Audiencia
from app.models.causa import ORIGEN_DATO_API, Causa
from app.models.causa_corte import CausaCorte
from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_corte import EstadoDiarioCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.jurisdiccion import Jurisdiccion
from app.models.log_actividades import LogActividades
from app.models.movimiento import Movimiento
from app.models.movimiento_corte import MovimientoCorte
from app.repositories.causa_repository import ultimo_origen_causas_id
from app.schemas.causa import CausaResponse, CrearCausaRequest
from app.services.causa_api_service import CausaApiService, materia_canonica
from app.services.causa_import_service import CausaImportService
from app.services.cartera_sync_service import CarteraSyncService

ABOGADO = "16952077-1"
OTRO_ABOGADO = "12345678-5"


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    BaseTenant.metadata.create_all(
        engine,
        tables=[
            EstadoDiarioOrigen.__table__,
            EstadoDiario.__table__,
            EstadoDiarioCorte.__table__,
            Movimiento.__table__,
            MovimientoCorte.__table__,
            Causa.__table__,
            CausaCorte.__table__,
            Audiencia.__table__,
            Jurisdiccion.__table__,
            LogActividades.__table__,
        ],
    )
    sesion = sessionmaker(bind=engine)()
    try:
        yield sesion
    finally:
        sesion.close()


def _origen(db, tipo, fecha, rut=None, deducida=False) -> EstadoDiarioOrigen:
    origen = EstadoDiarioOrigen(
        tipo=tipo, fecha=fecha, rut=rut, deducida=deducida,
        fecha_carga=datetime.now(timezone.utc),
    )
    db.add(origen)
    db.flush()
    return origen


def _alta(db, rol="C-100-2026", tribunal="1° Juzgado Civil de Santiago"):
    return CausaApiService(db).crear(
        materia="Civil", rol=rol, tribunal=tribunal, caratulado="Pérez con Soto"
    )


def _estado_diario(db, rut, rol="C-100-2026", tribunal="1° Juzgado Civil de Santiago"):
    origen = _origen(db, EstadoDiarioOrigen.TIPO_ESTADO_DIARIO, date(2026, 10, 9), rut=rut)
    db.add(EstadoDiario(
        estado_diario_origen_id=origen.id, rol=rol, tribunal=tribunal,
        caratulado="Pérez con Soto", corte="Civil",
    ))
    db.flush()


# ── Nace sin abogado ──────────────────────────────────────


def test_sin_cartera_la_causa_nace_sin_abogado(db):
    causa, creada = _alta(db)

    assert creada
    assert causa.origen_dato == ORIGEN_DATO_API
    assert causa.rut_asignado is None
    assert causa.rut_efectivo is None
    assert CausaResponse.from_model(causa).rut is None


def test_en_la_cartera_de_un_abogado_NO_hereda_el_rut_del_archivo(db):
    """El caso que importa: la cartera vigente es del abogado A y la causa nueva
    vive dentro de ese archivo, pero no es de A."""
    cartera = _origen(db, EstadoDiarioOrigen.TIPO_CAUSAS, date(2026, 10, 1), rut=ABOGADO)
    db.add(Causa(estado_diario_origen_id=cartera.id, materia="Civil",
                 rol="C-1-2020", tribunal="2° Juzgado Civil"))
    db.flush()

    causa, creada = _alta(db)

    assert creada
    assert causa.estado_diario_origen_id == cartera.id
    assert causa.estado_diario_origen.rut == ABOGADO  # el archivo SÍ es de A
    assert causa.rut_efectivo is None                  # la causa NO
    assert CausaResponse.from_model(causa).rut is None


def test_una_causa_del_excel_sigue_heredando_el_rut_de_su_archivo(db):
    cartera = _origen(db, EstadoDiarioOrigen.TIPO_CAUSAS, date(2026, 10, 1), rut=ABOGADO)
    causa = Causa(estado_diario_origen_id=cartera.id, materia="Civil",
                  rol="C-1-2020", tribunal="2° Juzgado Civil")
    db.add(causa)
    db.flush()

    assert causa.rut_efectivo == ABOGADO


def test_si_ya_esta_en_mis_causas_se_devuelve_sin_tocar(db):
    cartera = _origen(db, EstadoDiarioOrigen.TIPO_CAUSAS, date(2026, 10, 1), rut=ABOGADO)
    existente = Causa(estado_diario_origen_id=cartera.id, materia="Civil",
                      rol="C-100-2026", tribunal="1° Juzgado Civil de Santiago",
                      caratulado="Original")
    db.add(existente)
    db.flush()

    causa, creada = CausaApiService(db).crear(
        materia="Civil", rol=" c-100-2026 ", tribunal="1° JUZGADO CIVIL DE SANTIAGO",
        caratulado="Distinto",
    )

    assert not creada
    assert causa.id == existente.id
    assert causa.caratulado == "Original"
    assert causa.rut_efectivo == ABOGADO
    assert db.query(Causa).count() == 1


def test_el_alta_no_acepta_rut(db):
    """Mandar un RUT es un 422, no un campo que se ignora en silencio."""
    with pytest.raises(ValidationError):
        CrearCausaRequest(materia="Civil", rol="C-1-2026", tribunal="T", rut=ABOGADO)
    with pytest.raises(ValidationError):
        CrearCausaRequest(materia="Civil", rol="C-1-2026", tribunal="T", rut_asignado=ABOGADO)


def test_materia_canonica():
    assert materia_canonica(" civil ") == "Civil"
    assert materia_canonica("Corte Suprema") is None


# ── Se asigna al llegar el estado diario ──────────────────


def test_el_estado_diario_de_un_abogado_le_asigna_la_causa(db):
    causa, _ = _alta(db)
    assert causa.rut_efectivo is None

    _estado_diario(db, ABOGADO)
    resultado = CarteraSyncService(db).sincronizar()

    assert resultado.ruts_asignados == 1
    assert causa.rut_asignado == ABOGADO
    assert causa.rut_efectivo == ABOGADO


def test_sin_estado_diario_la_causa_sigue_sin_abogado(db):
    causa, _ = _alta(db)

    CarteraSyncService(db).sincronizar()

    assert causa.rut_efectivo is None


def test_un_estado_diario_de_otra_causa_no_la_asigna(db):
    causa, _ = _alta(db)

    _estado_diario(db, ABOGADO, rol="C-999-2026")
    CarteraSyncService(db).sincronizar()

    assert causa.rut_efectivo is None


def test_solo_el_estado_diario_asigna_no_los_movimientos(db):
    causa, _ = _alta(db)
    origen = _origen(db, EstadoDiarioOrigen.TIPO_MOVIMIENTOS, date(2026, 10, 9), rut=ABOGADO)
    db.add(Movimiento(
        estado_diario_origen_id=origen.id, rol="C-100-2026",
        tribunal="1° Juzgado Civil de Santiago", materia="Civil",
    ))
    db.flush()

    CarteraSyncService(db).sincronizar()

    assert causa.rut_efectivo is None


def test_un_estado_diario_sin_rut_no_asigna_nada(db):
    causa, _ = _alta(db)

    _estado_diario(db, None)
    CarteraSyncService(db).sincronizar()

    assert causa.rut_efectivo is None


def test_una_vez_asignada_no_se_reasigna(db):
    causa, _ = _alta(db)
    _estado_diario(db, ABOGADO)
    CarteraSyncService(db).sincronizar()

    _estado_diario(db, OTRO_ABOGADO)
    CarteraSyncService(db).sincronizar()

    assert causa.rut_efectivo == ABOGADO


# ── Sobrevive a una carga del Excel ───────────────────────


def _excel(ruta, filas):
    wb = openpyxl.Workbook()
    hoja = wb.active
    hoja.title = "Civil"
    hoja.append(["Rol", "Tribunal", "Fecha Ingreso", "Caratulado", "Estado Causa", "Institución"])
    for fila in filas:
        hoja.append(fila)
    wb.save(ruta)


def test_una_carga_de_excel_conserva_las_causas_de_api_y_su_abogado(db, tmp_path):
    asignada, _ = _alta(db, rol="C-100-2026")
    _alta(db, rol="C-200-2026")
    _estado_diario(db, ABOGADO, rol="C-100-2026")
    CarteraSyncService(db).sincronizar()
    assert asignada.rut_efectivo == ABOGADO
    db.commit()

    archivo = tmp_path / "Causas_12345678-5.xlsx"
    _excel(str(archivo), [["C-1-2020", "2° Juzgado Civil", None, "Otro", "Tramitación", "X"]])
    CausaImportService(db).import_file(str(archivo), OTRO_ABOGADO, date(2026, 10, 10))

    cartera_id = ultimo_origen_causas_id(db)
    en_cartera = {
        c.rol: c for c in db.query(Causa).filter(Causa.estado_diario_origen_id == cartera_id)
    }
    assert en_cartera["C-1-2020"].rut_efectivo == OTRO_ABOGADO  # la del Excel
    # Las de API siguen ahí, y la asignada conserva a SU abogado, no el del Excel.
    assert en_cartera["C-100-2026"].rut_efectivo == ABOGADO
    assert en_cartera["C-200-2026"].rut_efectivo is None


def test_si_el_excel_trae_la_causa_pasa_a_ser_del_excel(db, tmp_path):
    _alta(db, rol="C-100-2026", tribunal="1° Juzgado Civil de Santiago")
    db.commit()

    archivo = tmp_path / "Causas_12345678-5.xlsx"
    _excel(str(archivo), [
        ["C-100-2026", "1° Juzgado Civil de Santiago", None, "Pérez con Soto", "Tramitación", "X"],
    ])
    CausaImportService(db).import_file(str(archivo), OTRO_ABOGADO, date(2026, 10, 10))

    cartera_id = ultimo_origen_causas_id(db)
    filas = db.query(Causa).filter(Causa.estado_diario_origen_id == cartera_id).all()
    assert len(filas) == 1  # no se duplica
    assert filas[0].origen_dato != ORIGEN_DATO_API
    assert filas[0].rut_efectivo == OTRO_ABOGADO
