"""La cartera que el cruce arma cuando el estudio no cargó el reporte de Causas.

**El caso real que motivó esto.** Un estudio subió sus Excel por el importador
manual y "Mis Causas" quedó vacío. No había ningún error: el importador del
estado diario dispara el cruce, y el cruce se detenía sin hacer nada porque no
existía cartera sobre la que escribir. El único rastro era una línea de log que
nadie mira.

Ahora el cruce **arma** la cartera con lo que traigan los otros reportes. Eso
tiene una consecuencia que estos tests fijan por escrito, porque es plata: esa
cartera es la vigente mientras no llegue el reporte de Causas, se muestra en Mis
Causas y **se factura**. Es parcial por construcción —el estado diario de un día
trae decenas de causas y el reporte de Causas, miles— y por eso queda marcada
(`deducida`) y la reemplaza el archivo real en cuanto llega.

Base SQLite en memoria: acá no se prueba SQL de PostgreSQL, se prueba la regla.
"""

from datetime import date, datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import BaseTenant
from app.models.causa import ORIGEN_DATO_ESTADO_DIARIO, Causa
from app.models.causa_corte import CausaCorte
from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_corte import EstadoDiarioCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.movimiento import Movimiento
from app.models.movimiento_corte import MovimientoCorte
from app.repositories.causa_repository import ultimo_origen_causas_id
from app.services.cartera_sync_service import CarteraSyncService


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
        ],
    )
    sesion = sessionmaker(bind=engine)()
    try:
        yield sesion
    finally:
        sesion.close()


def _origen(db, tipo, fecha, deducida=False) -> EstadoDiarioOrigen:
    origen = EstadoDiarioOrigen(
        tipo=tipo,
        fecha=fecha,
        fecha_carga=datetime.now(timezone.utc),
        deducida=deducida,
    )
    db.add(origen)
    db.flush()
    return origen


def _estado_diario(db, origen, rol, tribunal) -> EstadoDiario:
    fila = EstadoDiario(
        estado_diario_origen_id=origen.id, rol=rol, tribunal=tribunal,
        caratulado="Pérez con Soto",
    )
    db.add(fila)
    db.flush()
    return fila


# ── Sin cartera ───────────────────────────────────────────


def test_el_cruce_arma_la_cartera_cuando_no_hay_reporte_de_causas(db):
    # El caso del estudio: solo cargó el estado diario.
    origen = _origen(db, EstadoDiarioOrigen.TIPO_ESTADO_DIARIO, date(2026, 8, 1))
    _estado_diario(db, origen, "C-17-2021", "1º Juzgado Civil de Santiago")

    resultado = CarteraSyncService(db).sincronizar()

    assert resultado.cartera_deducida is True
    assert resultado.causas_creadas == 1
    assert db.query(Causa).count() == 1


def test_la_cartera_armada_queda_marcada_como_deducida(db):
    # Es lo que después permite reemplazarla y explicar de dónde salió cada
    # causa que se cobró.
    origen = _origen(db, EstadoDiarioOrigen.TIPO_ESTADO_DIARIO, date(2026, 8, 1))
    _estado_diario(db, origen, "C-17-2021", "1º Juzgado Civil de Santiago")

    CarteraSyncService(db).sincronizar()

    cartera = (
        db.query(EstadoDiarioOrigen)
        .filter(EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_CAUSAS)
        .one()
    )
    assert cartera.deducida is True
    assert db.query(Causa).one().origen_dato == ORIGEN_DATO_ESTADO_DIARIO


def test_el_aviso_dice_que_la_cartera_esta_incompleta(db):
    # Antes esto era una línea de log: el usuario veía "importado con éxito" y
    # Mis Causas vacío, sin nada que se lo explicara.
    origen = _origen(db, EstadoDiarioOrigen.TIPO_ESTADO_DIARIO, date(2026, 8, 1))
    _estado_diario(db, origen, "C-17-2021", "1º Juzgado Civil de Santiago")

    aviso = CarteraSyncService(db).sincronizar().como_aviso()

    assert aviso is not None
    assert "reporte de Causas" in aviso


def test_sin_cartera_y_sin_nada_que_cruzar_no_inventa_causas(db):
    # Un estudio recién creado no puede terminar con una cartera vacía que
    # igual figure como "la cartera" del mes.
    resultado = CarteraSyncService(db).sincronizar()

    assert resultado.causas_creadas == 0
    assert db.query(Causa).count() == 0


# ── Con cartera cargada ───────────────────────────────────


def test_con_reporte_de_causas_no_se_deduce_nada(db):
    cartera = _origen(db, EstadoDiarioOrigen.TIPO_CAUSAS, date(2026, 8, 1))
    db.add(Causa(estado_diario_origen_id=cartera.id, rol="C-17-2021",
                 tribunal="1º Juzgado Civil de Santiago", materia="Civil"))
    origen = _origen(db, EstadoDiarioOrigen.TIPO_ESTADO_DIARIO, date(2026, 8, 2))
    _estado_diario(db, origen, "C-99-2021", "1º Juzgado Civil de Santiago")

    resultado = CarteraSyncService(db).sincronizar()

    assert resultado.cartera_deducida is False
    assert resultado.como_aviso() is None
    # La causa nueva entra en la cartera que ya existía, no en una inventada.
    assert db.query(EstadoDiarioOrigen).filter(
        EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_CAUSAS
    ).count() == 1


def test_una_cartera_cargada_le_gana_a_una_deducida_aunque_sea_mas_vieja(db):
    """El orden de desempate, que decide qué se muestra y qué se factura.

    Si ganara la más nueva, un estudio con su reporte de Causas del mes pasado
    pasaría a mostrar —y a cobrar— las pocas causas que se movieron esta semana.
    """
    real = _origen(db, EstadoDiarioOrigen.TIPO_CAUSAS, date(2026, 7, 1))
    _origen(db, EstadoDiarioOrigen.TIPO_CAUSAS, date(2026, 8, 12), deducida=True)

    assert ultimo_origen_causas_id(db) == real.id


def test_entre_dos_cargadas_manda_la_mas_nueva(db):
    # La regla de siempre no cambió: la deducida solo se posterga entre iguales.
    _origen(db, EstadoDiarioOrigen.TIPO_CAUSAS, date(2026, 7, 1))
    nueva = _origen(db, EstadoDiarioOrigen.TIPO_CAUSAS, date(2026, 8, 1))

    assert ultimo_origen_causas_id(db) == nueva.id
