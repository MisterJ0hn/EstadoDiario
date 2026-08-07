"""Parseo del Excel de Causas, contra el archivo de ejemplo real.

Se usa el archivo de verdad y no uno fabricado porque lo que hay que proteger
son justamente sus rarezas: las hojas NO traen las mismas columnas ni en el
mismo orden, y dos de ellas nombran distinto el mismo dato. Un fixture escrito
a mano tendría las columnas parejas y no probaría nada de eso.
"""

import pathlib
from collections import Counter

import pytest

from app.services.causa_import_service import parse_causas_file, parse_nombre_archivo

EJEMPLO = pathlib.Path(__file__).resolve().parents[2] / "ejemplos" / "Causas_16952077-1.xlsx"

pytestmark = pytest.mark.skipif(
    not EJEMPLO.is_file(), reason=f"falta el archivo de ejemplo {EJEMPLO}"
)


@pytest.fixture(scope="module")
def filas():
    return parse_causas_file(str(EJEMPLO))


@pytest.fixture(scope="module")
def materia(filas):
    return [f for f in filas if not f.get("tipo")]


@pytest.fixture(scope="module")
def corte(filas):
    return [f for f in filas if f.get("tipo")]


class TestConteos:
    def test_lee_todas_las_hojas(self, materia):
        # Los totales son las filas del Excel menos su encabezado.
        assert Counter(f["materia"] for f in materia) == {
            "Civil": 9238,
            "Familia": 2916,
            "Laboral": 75,
            "Cobranza": 17,
            "Penal": 2,
        }

    def test_separa_las_dos_hojas_de_corte(self, corte):
        assert Counter(f["tipo"] for f in corte) == {"apelaciones": 492, "suprema": 9}

    def test_las_de_corte_no_entran_como_materia(self, materia):
        """El error que hay que evitar: una fila de corte listada entre las de
        materia, con casi todas sus columnas vacías."""
        assert all(f["materia"] not in ("Corte Suprema", "Corte Apelaciones") for f in materia)


class TestColumnasQueCambianEntreHojas:
    def test_penal_trae_tipo_causa_y_ruc(self, materia):
        """Es la única hoja que los trae; si el mapeo fuera por posición, estos
        dos campos se irían a las columnas de al lado en el resto."""
        penal = [f for f in materia if f["materia"] == "Penal"]
        assert all(f.get("tipo_causa") for f in penal)
        assert all(f.get("ruc") for f in penal)

    def test_el_resto_no_trae_tipo_causa_ni_ruc(self, materia):
        otras = [f for f in materia if f["materia"] != "Penal"]
        assert not any(f.get("tipo_causa") for f in otras)
        assert not any(f.get("ruc") for f in otras)

    def test_cobranza_no_trae_estado_causa(self, materia):
        """No es un dato que falte: esa hoja no tiene la columna."""
        cobranza = [f for f in materia if f["materia"] == "Cobranza"]
        assert cobranza
        assert not any(f.get("estado_causa") for f in cobranza)

    def test_familia_mapea_bien_pese_al_orden_distinto(self, materia):
        """En Familia, Caratulado va ANTES que Fecha Ingreso. Con mapeo por
        posición, la fecha terminaría en el carátulado."""
        familia = [f for f in materia if f["materia"] == "Familia"]
        assert all(f.get("fecha_ingreso") is None or hasattr(f["fecha_ingreso"], "year")
                   for f in familia)
        assert any(f.get("caratulado") for f in familia)

    def test_rit_y_rol_van_al_mismo_campo(self, materia):
        """Civil/Laboral/Cobranza lo llaman Rol y Penal/Familia Rit."""
        por_materia = {}
        for f in materia:
            por_materia.setdefault(f["materia"], []).append(f)
        for nombre in ("Civil", "Familia", "Penal", "Cobranza", "Laboral"):
            assert any(f.get("rol") for f in por_materia[nombre]), nombre


class TestCorte:
    def test_suprema_no_trae_corte_ni_ubicacion(self, corte):
        suprema = [f for f in corte if f["tipo"] == "suprema"]
        assert not any(f.get("corte") for f in suprema)
        assert not any(f.get("ubicacion") for f in suprema)

    def test_apelaciones_trae_corte_y_ubicacion(self, corte):
        apel = [f for f in corte if f["tipo"] == "apelaciones"]
        assert all(f.get("corte") for f in apel)
        assert any(f.get("ubicacion") for f in apel)

    def test_estado_procesal_llega_desde_los_dos_nombres(self, corte):
        """Suprema encabeza "Estado Causa" y Apelaciones "Estado Procesal": es
        el mismo dato y los dos tienen que caer en `estado_procesal`."""
        for tipo in ("suprema", "apelaciones"):
            filas = [f for f in corte if f["tipo"] == tipo]
            assert any(f.get("estado_procesal") for f in filas), tipo

    def test_no_usa_el_campo_estado_causa(self, corte):
        """`estado_causa` es de las hojas de materia. Si una fila de corte lo
        trae, los alias se cruzaron y el dato quedaría en la tabla equivocada."""
        assert not any("estado_causa" in f for f in corte)


class TestNombreArchivo:
    def test_saca_el_rut(self):
        assert parse_nombre_archivo("Causas_16952077-1.xlsx")[0] == "16952077-1"

    def test_no_hay_fecha_en_el_nombre(self):
        # A diferencia de movimientos y audiencias. La pone quien carga.
        assert parse_nombre_archivo("Causas_16952077-1.xlsx")[1] is None

    def test_otro_reporte_no_calza(self):
        assert parse_nombre_archivo("Movimientos_16952077__30_07_2026.xls")[0] is None
