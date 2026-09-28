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
from app.models.audiencia import Audiencia
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
            # `_calcular_ultima_actividad` la consulta siempre que la cartera
            # no esté vacía: sin esta tabla, cualquier test con una causa
            # revienta con "no such table: audiencia" antes de llegar a lo
            # que en realidad está probando.
            Audiencia.__table__,
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


def _estado_diario(db, origen, rol, tribunal, corte=None) -> EstadoDiario:
    fila = EstadoDiario(
        estado_diario_origen_id=origen.id, rol=rol, tribunal=tribunal,
        caratulado="Pérez con Soto", corte=corte,
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


# ── Deducción de materia por tribunal ──────────────────────


def test_una_causa_nueva_deduce_la_materia_de_un_tribunal_conocido(db):
    cartera = _origen(db, EstadoDiarioOrigen.TIPO_CAUSAS, date(2026, 8, 1))
    db.add(Causa(estado_diario_origen_id=cartera.id, rol="C-17-2021",
                 tribunal="2º Juzgado de Letras de Vallenar", materia="Civil"))
    origen = _origen(db, EstadoDiarioOrigen.TIPO_ESTADO_DIARIO, date(2026, 8, 2))
    _estado_diario(db, origen, "E-970-2026", "2º Juzgado de Letras de Vallenar")

    CarteraSyncService(db).sincronizar()

    nueva = db.query(Causa).filter(Causa.rol == "E-970-2026").one()
    assert nueva.materia == "Civil"


def test_una_causa_nueva_usa_el_nombre_de_hoja_del_estado_diario_como_materia(db):
    """El caso real, tal cual pasó en producción: E-970-2026 llegó por el
    Estado Diario a un tribunal (2º Juzgado de Letras de Vallenar) del que el
    cliente no tenía ninguna otra causa registrada con materia conocida —ni en
    la cartera vigente ni en ninguna anterior—, así que la deducción por
    tribunal no tenía de dónde sacar nada.

    El importador (`ImportService`) igual sabe la materia: es el nombre de la
    hoja del Excel, que deja en `EstadoDiario.corte` porque esa hoja no trae su
    propia columna "Corte". El cruce tiene que usar ese dato en vez de
    depender solo de la deducción.
    """
    origen = _origen(db, EstadoDiarioOrigen.TIPO_ESTADO_DIARIO, date(2026, 8, 25))
    _estado_diario(db, origen, "E-970-2026", "2º Juzgado de Letras de Vallenar", corte="Civil")

    CarteraSyncService(db).sincronizar()

    nueva = db.query(Causa).filter(Causa.rol == "E-970-2026").one()
    assert nueva.materia == "Civil"


def test_recargar_causas_sin_un_tribunal_no_le_hace_perder_la_materia_conocida(db):
    """El caso real: E-970-2026 (2º Juzgado de Letras de Vallenar, cliente
    17314741-4) quedó "Sin materia" el 25-08-2026 pese a que ese tribunal era
    Civil hacía rato.

    La cartera vigente es la del ÚLTIMO Excel de Causas cargado, y ese archivo
    no tiene por qué repetir un tribunal con pocas causas activas que sí
    apareció en uno anterior. `_materia_por_tribunal` tiene que mirar toda la
    historia del cliente, no solo la foto vigente, o esa causa nueva del
    Estado Diario no tiene de dónde deducir la materia.
    """
    vieja = _origen(db, EstadoDiarioOrigen.TIPO_CAUSAS, date(2026, 7, 1))
    db.add(Causa(estado_diario_origen_id=vieja.id, rol="C-17-2021",
                 tribunal="2º Juzgado de Letras de Vallenar", materia="Civil"))

    # El Excel de Causas de agosto se recarga y esta vez no trae ninguna causa
    # de ese tribunal (p.ej. porque las pocas que había ahí concluyeron).
    _origen(db, EstadoDiarioOrigen.TIPO_CAUSAS, date(2026, 8, 1))

    origen_ed = _origen(db, EstadoDiarioOrigen.TIPO_ESTADO_DIARIO, date(2026, 8, 25))
    _estado_diario(db, origen_ed, "E-970-2026", "2º Juzgado de Letras de Vallenar")

    CarteraSyncService(db).sincronizar()

    nueva = db.query(Causa).filter(Causa.rol == "E-970-2026").one()
    assert nueva.materia == "Civil"
