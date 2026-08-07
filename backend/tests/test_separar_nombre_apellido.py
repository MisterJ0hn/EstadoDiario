"""La regla de separación de nombre y apellido, sin tocar la base.

`separar()` es pura a propósito: es la única parte del job que decide algo, y
decidir mal deja a alguien apellidado "Carlos" de forma permanente.
"""

import pytest

from app.jobs.separar_nombre_apellido import separar
from app.schemas.usuario import validar_palabra_unica


class TestSeparar:
    def test_ya_separado_no_cambia(self):
        assert separar("Juan", "Perez") == ("Juan", "Perez")

    def test_es_idempotente(self):
        # Correr el job dos veces no puede cambiar nada la segunda.
        primera = separar("Juan Carlos", "Perez Gonzalez")
        assert separar(*primera) == primera

    def test_dos_nombres_se_queda_con_el_primero(self):
        assert separar("Juan Carlos", "Perez") == ("Juan", "Perez")

    def test_dos_apellidos_se_queda_con_el_primero(self):
        assert separar("Juan", "Perez Gonzalez") == ("Juan", "Perez")

    def test_nombre_completo_sin_apellido_se_parte(self):
        # El caso del sistema viejo: todo junto en `nombre`.
        assert separar("Juan Perez", None) == ("Juan", "Perez")

    def test_nombre_completo_largo_toma_la_segunda_palabra(self):
        # "Juan Carlos Perez" -> se prefiere equivocarse dejando "Carlos" de
        # apellido antes que descartar el nombre; ver el docstring del job.
        assert separar("Juan Carlos Perez", "") == ("Juan", "Carlos")

    def test_solo_una_palabra_deja_el_apellido_vacio(self):
        assert separar("Admin", None) == ("Admin", None)

    def test_vacio_queda_vacio(self):
        assert separar(None, None) == (None, None)
        assert separar("", "") == (None, None)

    def test_espacios_de_sobra_no_generan_palabras_falsas(self):
        assert separar("  Juan   Carlos ", "  Perez ") == ("Juan", "Perez")

    def test_apellido_sin_nombre(self):
        assert separar(None, "Perez Gonzalez") == (None, "Perez")


class TestValidadorConcuerdaConElJob:
    """Lo que produce el job tiene que pasar el validador de la API.

    Si no, quedarían usuarios migrados que el backend rechaza al editarlos:
    no se podría guardar la ficha sin reescribir el nombre.
    """

    @pytest.mark.parametrize(
        "nombre,apellido",
        [
            ("Juan Carlos", "Perez Gonzalez"),
            ("Juan Perez", None),
            ("  Ana   Maria  ", "Soto"),
            ("Admin", None),
        ],
    )
    def test_lo_migrado_pasa_la_validacion(self, nombre, apellido):
        n, a = separar(nombre, apellido)
        assert validar_palabra_unica(n, "nombre") == n
        assert validar_palabra_unica(a, "apellido") == a


class TestValidadorPalabraUnica:
    def test_rechaza_dos_palabras(self):
        with pytest.raises(ValueError, match="una sola palabra"):
            validar_palabra_unica("Juan Carlos", "nombre")

    def test_acepta_una(self):
        assert validar_palabra_unica("  Juan  ", "nombre") == "Juan"

    def test_vacio_es_none(self):
        assert validar_palabra_unica("   ", "nombre") is None
        assert validar_palabra_unica(None, "nombre") is None

    def test_rechaza_tabulacion(self):
        # `strip()` no alcanza: un tab en el medio también parte el campo.
        with pytest.raises(ValueError):
            validar_palabra_unica("Juan\tCarlos", "nombre")
