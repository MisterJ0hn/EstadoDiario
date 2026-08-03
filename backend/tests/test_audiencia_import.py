"""Tests del parseo del Excel de audiencias.

Solo la parte pura (nombre de archivo, lectura de hojas y clave natural): no
tocan la base de datos, así que corren sin PostgreSQL levantado.

El archivo de referencia es `ejemplos/Audiencias_16952077_03_08_2026_09_08_2026.xls`,
un reporte real del PJUD. Si no está, los tests que lo usan se saltan en vez de
fallar: el repositorio no siempre lleva los ejemplos.
"""

from datetime import date, time
from pathlib import Path

import pytest

from app.services.audiencia_import_service import (
    calcular_clave_natural,
    parse_audiencias_file,
    parse_nombre_archivo,
)

ARCHIVO_EJEMPLO = (
    Path(__file__).resolve().parents[2]
    / "ejemplos"
    / "Audiencias_16952077_03_08_2026_09_08_2026.xls"
)

requiere_ejemplo = pytest.mark.skipif(
    not ARCHIVO_EJEMPLO.exists(),
    reason="No está el Excel de audiencias de ejemplo",
)


# ── Nombre del archivo ────────────────────────────────────

def test_parse_nombre_extrae_rut_y_rango():
    rut, desde, hasta = parse_nombre_archivo(
        "Audiencias_16952077_03_08_2026_09_08_2026.xls"
    )
    assert rut == "16952077"
    assert desde == date(2026, 8, 3)
    assert hasta == date(2026, 8, 9)


def test_parse_nombre_acepta_rut_con_digito_verificador_y_doble_guion():
    rut, desde, hasta = parse_nombre_archivo(
        "Audiencias_17314741-4__15_07_2026_21_07_2026.xls"
    )
    assert rut == "17314741-4"
    assert desde == date(2026, 7, 15)
    assert hasta == date(2026, 7, 21)


@pytest.mark.parametrize(
    "nombre",
    [
        "Movimientos_16952077__30_07_2026.xls",   # otro reporte del PJUD
        "estadoDiario_16952077__28072026.xls",
        "Audiencias_16952077_03_08_2026.xls",     # le falta el fin del rango
        "cualquier_cosa.xls",
        "",
    ],
)
def test_parse_nombre_rechaza_lo_que_no_es_audiencias(nombre):
    assert parse_nombre_archivo(nombre) == (None, None, None)


# ── Lectura del Excel ─────────────────────────────────────

@requiere_ejemplo
def test_lee_las_audiencias_del_archivo_real():
    filas, sin_fecha = parse_audiencias_file(str(ARCHIVO_EJEMPLO))

    assert len(filas) == 10
    assert sin_fecha == 0
    # Las hojas Laboral y Penal del ejemplo vienen solo con encabezado: se
    # saltan sin error y sin aportar filas.
    assert {f["materia"] for f in filas} == {"Familia"}


@requiere_ejemplo
def test_mapea_las_columnas_por_encabezado_y_no_por_posicion():
    filas, _ = parse_audiencias_file(str(ARCHIVO_EJEMPLO))
    fila = next(f for f in filas if f["rol"] == "C-3434-2025")

    assert fila["ruc"] == "25- 2-5683611-7"
    assert fila["fecha_audiencia"] == date(2026, 8, 7)
    assert fila["hora"] == time(10, 0)
    assert fila["tribunal"] == "1 Juzgado de Familia San Miguel"
    assert fila["tipo_audiencia"] == "Continuación Audiencia de Juicio"
    assert fila["juez"] == "Paula Ortuzar Pruzzo"


@requiere_ejemplo
def test_recorta_el_relleno_de_espacios_del_pjud():
    """El Excel rellena el caratulado hasta ~100 caracteres con espacios."""
    filas, _ = parse_audiencias_file(str(ARCHIVO_EJEMPLO))
    fila = next(f for f in filas if f["rol"] == "C-3434-2025")
    assert fila["caratulado"] == "MATAMORO/SANHUEZA"


@requiere_ejemplo
def test_celda_solo_con_espacios_queda_en_none():
    """La columna Juez viene como '  ' en la mayoría de las filas."""
    filas, _ = parse_audiencias_file(str(ARCHIVO_EJEMPLO))
    fila = next(f for f in filas if f["rol"] == "C-1382-2026")
    assert fila["juez"] is None


@requiere_ejemplo
def test_el_archivo_real_no_trae_audiencias_duplicadas():
    filas, _ = parse_audiencias_file(str(ARCHIVO_EJEMPLO))
    claves = [f["clave_natural"] for f in filas]
    assert len(set(claves)) == len(claves)


# ── Clave natural (deduplicación entre archivos traslapados) ──

def _fila(**overrides) -> dict:
    base = {
        "materia": "Familia",
        "rol": "C-3434-2025",
        "ruc": "25- 2-5683611-7",
        "tribunal": "1 Juzgado de Familia San Miguel",
        "tipo_audiencia": "Continuación Audiencia de Juicio",
        "fecha_audiencia": date(2026, 8, 7),
        "hora": time(10, 0),
    }
    base.update(overrides)
    return base


def test_clave_ignora_sala_juez_y_estado():
    """Son los campos que cambian entre un archivo y el siguiente; si entraran
    en la clave, la misma audiencia se duplicaría en vez de actualizarse."""
    a = _fila(sala="Sala N° 9", juez="Paula Ortuzar", estado="Agendada")
    b = _fila(sala="Sala N° 2", juez="Otro Juez", estado="Realizada")
    assert calcular_clave_natural(a) == calcular_clave_natural(b)


def test_clave_ignora_mayusculas_tildes_y_espacios_repetidos():
    a = _fila(tribunal="1 Juzgado de Familia San Miguel")
    b = _fila(tribunal="  1  JUZGADO DE FAMILIA SAN MIGUEL ")
    assert calcular_clave_natural(a) == calcular_clave_natural(b)


@pytest.mark.parametrize(
    "cambio",
    [
        {"fecha_audiencia": date(2026, 8, 8)},   # recalendarizada a otro día
        {"hora": time(11, 0)},                   # o a otra hora
        {"rol": "C-9999-2026"},
        {"ruc": "26- 2-0000000-0"},
        {"tipo_audiencia": "Citación a Audiencia Preparatoria"},
        {"materia": "Laboral"},
    ],
)
def test_clave_distingue_audiencias_distintas(cambio):
    assert calcular_clave_natural(_fila()) != calcular_clave_natural(_fila(**cambio))


def test_clave_distingue_hora_nula_de_hora_cero():
    """La hoja Penal puede venir sin hora; eso no es lo mismo que medianoche."""
    assert calcular_clave_natural(_fila(hora=None)) != calcular_clave_natural(
        _fila(hora=time(0, 0))
    )


def test_clave_no_colisiona_con_campos_vacios():
    """La hoja Penal no trae Rit ni Caratulado: dos audiencias del mismo día que
    solo se distinguen por RUC tienen que seguir siendo distintas."""
    a = _fila(rol=None, ruc="26- 2-1111111-1")
    b = _fila(rol=None, ruc="26- 2-2222222-2")
    assert calcular_clave_natural(a) != calcular_clave_natural(b)
