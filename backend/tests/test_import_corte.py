"""Separación de las hojas de corte del estado diario.

El Excel del PJUD trae una hoja por materia y además dos de corte, con otras
columnas. Estas pruebas corren contra los archivos de `ejemplos/`, que son
archivos reales: si el PJUD cambia un encabezado, esto lo delata acá y no en
producción con una tabla vacía.
"""

import pathlib

import pytest

from app.services.import_service import (
    HEADER_ALIASES,
    HEADER_ALIASES_CORTE,
    ImportService,
    normalizar_texto,
    tipo_de_hoja_corte,
)

EJEMPLOS = pathlib.Path(__file__).resolve().parent.parent.parent / "ejemplos"
XLS = EJEMPLOS / "estadoDiario_16952077__01082026.xls"
XLSX = EJEMPLOS / "EstadoDiario17314741-4_01_04_2025-67efcf7676e4e.xlsx"


@pytest.fixture
def servicio():
    # No se toca la base: solo se ejercitan los lectores.
    return ImportService.__new__(ImportService)


# ── Reconocer la hoja ─────────────────────────────────────


@pytest.mark.parametrize(
    "nombre,esperado",
    [
        ("Corte Suprema", "suprema"),
        ("corte suprema", "suprema"),
        ("Corte Apelaciones", "apelaciones"),
        # El nombre cambia entre archivos: con "de" y sin "de".
        ("Corte de Apelaciones", "apelaciones"),
        ("CORTE DE APELACIONES", "apelaciones"),
        ("Civil", None),
        ("Familia", None),
        # Una materia que solo contiene la palabra no es una hoja de corte.
        ("Cobranza", None),
    ],
)
def test_reconoce_las_hojas_de_corte(nombre, esperado):
    assert tipo_de_hoja_corte(nombre) == esperado


def test_normalizar_saca_acentos_y_grados():
    assert normalizar_texto("Ubicación") == "ubicacion"
    assert normalizar_texto("N° Ingreso") == "n ingreso"
    assert normalizar_texto("  Fecha   Ubicación  ") == "fecha ubicacion"


def test_tipo_recurso_significa_cosas_distintas_segun_la_hoja():
    # En una hoja de materia "Tipo Recurso" es el tipo de causa; en la de Corte
    # Suprema es el recurso. Por eso los dos mapas están separados: con uno
    # solo, el dato caía en la columna equivocada.
    assert HEADER_ALIASES["tipo recurso"] == "tipo_causa"
    assert HEADER_ALIASES_CORTE["tipo recurso"] == "tipo_recurso"


# ── Lectura de archivos reales ────────────────────────────


@pytest.mark.skipif(not XLS.exists(), reason="falta el archivo de ejemplo .xls")
def test_las_causas_de_corte_no_quedan_en_materia(servicio):
    materia, cortes = servicio._read_xls(str(XLS))

    # Ninguna fila de materia puede venir de una hoja de corte.
    assert not [m for m in materia if tipo_de_hoja_corte(m.get("corte") or "")]
    assert materia, "el archivo sí tiene hojas de materia"
    assert cortes, "el archivo sí tiene filas en Corte Apelaciones"


@pytest.mark.skipif(not XLS.exists(), reason="falta el archivo de ejemplo .xls")
def test_apelaciones_trae_sus_columnas_propias(servicio):
    _, cortes = servicio._read_xls(str(XLS))
    fila = next(c for c in cortes if c["tipo"] == "apelaciones")

    assert fila["numero_ingreso"]
    assert fila["caratulado"]
    assert fila["fecha_ingreso"] is not None
    # Ubicación, fecha de ubicación y corte son de esta hoja y de la otra no.
    assert fila["ubicacion"]
    assert fila["fecha_ubicacion"] is not None
    assert fila["corte"]
    # El tipo de recurso es de Corte Suprema: acá no viene.
    assert fila.get("tipo_recurso") is None


@pytest.mark.skipif(not XLS.exists(), reason="falta el archivo de ejemplo .xls")
def test_el_numero_de_ingreso_no_se_confunde_con_el_rol(servicio):
    _, cortes = servicio._read_xls(str(XLS))
    # "Número de Ingreso" es la columna de las hojas de corte; en materia el
    # equivalente es `rol`. Si el alias estuviera cruzado, esto vendría vacío.
    assert all(c.get("numero_ingreso") for c in cortes)
    assert all("rol" not in c for c in cortes)


@pytest.mark.skipif(not XLSX.exists(), reason="falta el archivo de ejemplo .xlsx")
def test_hojas_de_corte_vacias_no_inventan_filas(servicio):
    # En este archivo las dos hojas de corte traen solo el encabezado.
    materia, cortes = servicio._read_xlsx(str(XLSX))
    assert cortes == []
    assert materia, "las hojas de materia sí tienen datos"


@pytest.mark.skipif(not XLSX.exists(), reason="falta el archivo de ejemplo .xlsx")
def test_los_dos_lectores_separan_igual(servicio):
    # xls y xlsx son dos implementaciones distintas: tienen que decidir lo
    # mismo sobre qué hoja es de corte.
    for ruta, lector in ((XLS, servicio._read_xls), (XLSX, servicio._read_xlsx)):
        if not ruta.exists():
            continue
        materia, _ = lector(str(ruta))
        assert not [m for m in materia if tipo_de_hoja_corte(m.get("corte") or "")]
