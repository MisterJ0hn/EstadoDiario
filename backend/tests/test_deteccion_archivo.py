"""Tests de la identificación de adjuntos del PJUD.

Cubren las dos piezas que reemplazaron a la detección por nombre de archivo:
el extractor tolerante (`utils.nombre_archivo`) y la cascada de resolución
(`services.deteccion_archivo`), que ahora parte por el asunto del correo.

No tocan la base de datos: `ConfiguracionCorreo` se instancia suelta.
"""

from datetime import date

import pytest

from app.models.configuracion_correo import ConfiguracionCorreo
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.services import deteccion_archivo
from app.utils.nombre_archivo import (
    extraer_fechas,
    extraer_rut,
    extraer_rut_y_fechas,
    fechas_en_texto,
    rut_en_texto,
)

ED = EstadoDiarioOrigen.TIPO_ESTADO_DIARIO
MOV = EstadoDiarioOrigen.TIPO_MOVIMIENTOS
AUD = EstadoDiarioOrigen.TIPO_AUDIENCIAS


def config(**kwargs) -> ConfiguracionCorreo:
    return ConfiguracionCorreo(**kwargs)


CONFIG_COMPLETA = dict(
    asunto_estado_diario="Estado Diario",
    asunto_movimientos="Movimientos del día",
    asunto_audiencias="Nómina de audiencias",
)


# ── Extractor tolerante: nombres reales ───────────────────

@pytest.mark.parametrize(
    "nombre, esperado",
    [
        ("estadoDiario_16952077__28072026.xls", ("16952077", date(2026, 7, 28), None)),
        ("EstadoDiario17314741-4_15_07_2026.xls", ("17314741-4", date(2026, 7, 15), None)),
        ("Movimientos_16952077__30_07_2026.xls", ("16952077", date(2026, 7, 30), None)),
        (
            "Audiencias_16952077_03_08_2026_09_08_2026.xls",
            ("16952077", date(2026, 8, 3), date(2026, 8, 9)),
        ),
    ],
)
def test_lee_los_nombres_historicos_del_pjud(nombre, esperado):
    assert extraer_rut_y_fechas(nombre) == esperado


@pytest.mark.parametrize(
    "nombre, esperado",
    [
        # Separadores y palabras distintas
        (
            "Audiencias 16952077 03-08-2026 al 09-08-2026.xls",
            ("16952077", date(2026, 8, 3), date(2026, 8, 9)),
        ),
        # Fechas en formato ISO pegado
        (
            "reporte_audiencias_16952077_20260803_20260809.xls",
            ("16952077", date(2026, 8, 3), date(2026, 8, 9)),
        ),
        # Otro prefijo, RUT con dígito verificador, fechas pegadas DDMMYYYY
        (
            "AudienciasProgramadas-16952077-4-03082026-09082026.xls",
            ("16952077-4", date(2026, 8, 3), date(2026, 8, 9)),
        ),
        # Fechas ISO con guiones
        (
            "Audiencias_2026-08-03_2026-08-09.xls",
            (None, date(2026, 8, 3), date(2026, 8, 9)),
        ),
    ],
)
def test_tolera_formatos_de_nombre_no_vistos(nombre, esperado):
    """Es el punto del extractor: que un cambio de nombre no vuelva a romper la
    importación, como pasó con el reporte de audiencias."""
    assert extraer_rut_y_fechas(nombre) == esperado


def test_nombre_sin_datos_no_inventa_nada():
    assert extraer_rut_y_fechas("Audiencias.xls") == (None, None, None)


def test_no_confunde_una_fecha_pegada_con_un_rut():
    """28072026 son 8 dígitos y es una fecha válida; el RUT es el otro."""
    assert extraer_rut("estadoDiario_16952077__28072026.xls") == "16952077"


def test_un_candidato_invalido_no_se_traga_la_fecha_siguiente():
    """En "17314741-4_15_07_2026", el trozo "4_15_07" calza con la forma de una
    fecha pero no es una; si consumiera el texto, se perdería 15_07_2026."""
    assert extraer_fechas("EstadoDiario17314741-4_15_07_2026.xls") == [date(2026, 7, 15)]


def test_no_repite_la_misma_fecha():
    assert extraer_fechas("Audiencias_16952077_03_08_2026_03_08_2026.xls") == [
        date(2026, 8, 3)
    ]


# ── Extractor sobre el asunto del correo ──────────────────

def test_el_asunto_completa_lo_que_el_nombre_no_trae():
    assert extraer_rut_y_fechas("adjunto.xls", "Estado Diario del 28-07-2026") == (
        None, date(2026, 7, 28), None,
    )


def test_el_nombre_manda_sobre_el_asunto():
    """Un correo puede traer varios adjuntos de fechas distintas: ahí lo que
    identifica a cada uno es su propio nombre, no el asunto común."""
    assert extraer_rut_y_fechas(
        "Movimientos_16952077__30_07_2026.xls", "Estado Diario del 01-01-2020"
    ) == ("16952077", date(2026, 7, 30), None)


def test_el_asunto_no_pierde_texto_por_un_punto():
    """`splitext` sobre un asunto se comería todo lo que siga a un punto."""
    assert fechas_en_texto("Informe v1.2 del 03-08-2026") == [date(2026, 8, 3)]


def test_rut_en_texto_acepta_dv_k():
    assert rut_en_texto("Reporte de 12345678-K") == "12345678-K"


# ── Detección del tipo: por asunto ────────────────────────

@pytest.mark.parametrize(
    "asunto, esperado",
    [
        ("PJUD: Nómina de audiencias semana del 03-08", AUD),
        ("Estado Diario del 28-07-2026", ED),
        ("Movimientos del día 30/07/2026", MOV),
        ("estado diario en minúsculas", ED),
    ],
)
def test_detecta_el_tipo_por_el_asunto(asunto, esperado):
    detectado = deteccion_archivo.detectar("cualquier_cosa.xls", asunto, config(**CONFIG_COMPLETA))
    assert detectado.tipo == esperado
    assert detectado.origen_tipo == "asunto"


def test_el_asunto_manda_sobre_el_nombre_del_archivo():
    """Es el objetivo del cambio: el nombre dejó de ser confiable."""
    detectado = deteccion_archivo.detectar(
        "Movimientos_16952077__30_07_2026.xls",
        "Nómina de audiencias",
        config(**CONFIG_COMPLETA),
    )
    assert detectado.tipo == AUD


def test_entre_dos_asuntos_que_calzan_gana_el_mas_especifico():
    """Sin esto, configurar "Audiencias" y "Audiencias Penales" haría que el
    resultado dependiera del orden del diccionario."""
    detectado = deteccion_archivo.detectar(
        "x.xls",
        "Envío de Movimientos del día y audiencias",
        config(asunto_audiencias="audiencias", asunto_movimientos="Movimientos del día"),
    )
    assert detectado.tipo == MOV


# ── Detección del tipo: respaldo por nombre ───────────────

@pytest.mark.parametrize(
    "nombre, esperado",
    [
        ("Audiencias_16952077_03_08_2026_09_08_2026.xls", AUD),
        ("Movimientos_16952077__30_07_2026.xls", MOV),
        ("estadoDiario_16952077__28072026.xls", ED),
        ("EstadoDiario17314741-4_15_07_2026.xls", ED),
    ],
)
def test_sin_asuntos_configurados_cae_al_nombre(nombre, esperado):
    """Compatibilidad: las casillas ya configuradas siguen funcionando aunque
    nadie haya llenado los asuntos nuevos."""
    detectado = deteccion_archivo.detectar(nombre, "cualquier asunto", config())
    assert detectado.tipo == esperado
    assert detectado.origen_tipo == "nombre"


def test_no_reconocido_cuando_no_calza_ni_asunto_ni_nombre():
    detectado = deteccion_archivo.detectar("adjunto.xls", "hola", config(**CONFIG_COMPLETA))
    assert not detectado.reconocido
    assert detectado.tipo is None


# ── RUT: nombre, luego respaldo de la casilla ─────────────

def test_usa_el_rut_de_la_casilla_cuando_el_nombre_no_lo_trae():
    detectado = deteccion_archivo.detectar(
        "adjunto.xls", "Nómina de audiencias", config(rut="16952077-5", **CONFIG_COMPLETA)
    )
    assert detectado.rut == "16952077-5"


def test_el_rut_del_nombre_manda_sobre_el_de_la_casilla():
    """Un archivo reenviado de otro RUT tiene que conservar el suyo."""
    detectado = deteccion_archivo.detectar(
        "Audiencias_11111111_03_08_2026_09_08_2026.xls",
        "Nómina de audiencias",
        config(rut="16952077-5", **CONFIG_COMPLETA),
    )
    assert detectado.rut == "11111111"


def test_sin_rut_por_ninguna_via_queda_nulo():
    detectado = deteccion_archivo.detectar("adjunto.xls", "Nómina de audiencias", config(**CONFIG_COMPLETA))
    assert detectado.rut is None


# ── Mensajes para la bitácora ─────────────────────────────

def test_explica_que_faltan_los_asuntos_cuando_no_hay_ninguno():
    mensaje = deteccion_archivo.explicar_no_reconocido(config())
    assert "Configure en su casilla el asunto" in mensaje


def test_explica_cuales_asuntos_faltan_cuando_hay_algunos():
    mensaje = deteccion_archivo.explicar_no_reconocido(config(asunto_audiencias="Audiencias"))
    assert "estado diario" in mensaje
    assert "movimientos" in mensaje
    assert "audiencias" not in mensaje.split("Le falta configurar el asunto de:")[1]
