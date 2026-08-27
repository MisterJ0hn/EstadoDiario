"""Lógica pura del cliente de api-pjud.codifica.cl, sin red.

`parsear_rol_civil` y `resolver_tribunal` son lo único que puede fallar por un
dato mal formado del Excel (rol raro, nombre de tribunal que no calza con el
catálogo) en vez de por la API misma, así que son lo que vale la pena probar
sin depender de que el servicio externo esté arriba.
"""

import types

import pytest

from app.services.pjud_service import (
    PjudApiError,
    PjudNoEncontrado,
    PjudService,
    _normalizar,
)


class TestParsearRolCivil:
    def test_formato_estandar(self):
        assert PjudService.parsear_rol_civil("C-10825-2026") == ("C", 10825, 2026)

    def test_tipo_de_varias_letras(self):
        # No medido en la cartera real, pero el schema de la API permite hasta
        # 4 caracteres de tipo.
        assert PjudService.parsear_rol_civil("EXH-17-2021") == ("EXH", 17, 2021)

    def test_espacios_de_sobra_no_rompen_el_parseo(self):
        assert PjudService.parsear_rol_civil("  C-17-2021  ") == ("C", 17, 2021)

    def test_tipo_queda_en_mayusculas(self):
        assert PjudService.parsear_rol_civil("c-17-2021") == ("C", 17, 2021)

    @pytest.mark.parametrize(
        "rol",
        [None, "", "17-2021", "C-17", "C--2021", "C-17-21", "T-720-2020-1"],
    )
    def test_formato_invalido_se_rechaza(self, rol):
        with pytest.raises(PjudApiError):
            PjudService.parsear_rol_civil(rol)


class TestNormalizar:
    def test_ignora_acentos_mayusculas_y_espacios_de_sobra(self):
        assert _normalizar("  23° Juzgado Civil de Santiago  ") == _normalizar(
            "23º JUZGADO CIVIL DE SANTIAGO"
        )

    def test_nombres_distintos_no_calzan(self):
        assert _normalizar("1° Juzgado Civil de Santiago") != _normalizar(
            "2° Juzgado Civil de Santiago"
        )


class TestResolverTribunal:
    """`resolver_tribunal` no llama a la red directamente: usa
    `_obtener_catalogo_civil`, que sí lo hace. Se reemplaza por un catálogo
    fijo para probar solo el calce de nombres."""

    CATALOGO = [
        {
            "id": 5,
            "nombre": "C.A. de Santiago",
            "tribunales": [
                {"id": 101, "nombre": "23° Juzgado Civil de Santiago"},
                {"id": 102, "nombre": "1° Juzgado Civil de Santiago"},
            ],
        },
    ]

    def _servicio(self, monkeypatch) -> PjudService:
        monkeypatch.setattr(
            "app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@codifica.cl"
        )
        monkeypatch.setattr(
            "app.services.pjud_service.settings.PJUD_API_PASSWORD", "x"
        )
        servicio = PjudService()
        monkeypatch.setattr(servicio, "_obtener_catalogo_civil", lambda: self.CATALOGO)
        return servicio

    def test_calza_por_nombre_exacto(self, monkeypatch):
        servicio = self._servicio(monkeypatch)
        assert servicio.resolver_tribunal("23° Juzgado Civil de Santiago") == (5, 101)

    def test_calza_ignorando_acentos_y_simbolo_de_grado(self, monkeypatch):
        servicio = self._servicio(monkeypatch)
        # "º" en vez de "°", como puede llegar de una fuente distinta al Excel.
        assert servicio.resolver_tribunal("23º Juzgado Civil de Santiago") == (5, 101)

    def test_tribunal_desconocido_da_error_claro(self, monkeypatch):
        servicio = self._servicio(monkeypatch)
        with pytest.raises(PjudApiError, match="no está en el catálogo"):
            servicio.resolver_tribunal("Tribunal Que No Existe")


class TestPjudServiceApagado:
    def test_sin_credenciales_no_se_puede_instanciar(self, monkeypatch):
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "")
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "")
        with pytest.raises(PjudApiError):
            PjudService()


def _causa_civil(rol="C-6181-2026", tribunal="1° Juzgado Civil de Puente Alto"):
    return types.SimpleNamespace(id=1, materia="Civil", rol=rol, tribunal=tribunal)


_CREDS = {"rut": "17314741", "clave": "secreta", "metodo_login": 1}


class TestObtenerDetalle:
    """`obtener_detalle` orquesta 2-3 llamadas a `_request`. Se reemplaza
    `_request` por un doble que responde según la ruta, para probar el manejo
    del scrape asíncrono del proveedor sin tocar la red."""

    def _servicio(self, monkeypatch, respuestas: dict) -> PjudService:
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@x.cl")
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "x")
        servicio = PjudService()
        monkeypatch.setattr(servicio, "_obtener_catalogo_civil", lambda: [
            {"id": 91, "nombre": "C.A. de San Miguel", "tribunales": [
                {"id": 364, "nombre": "1° Juzgado Civil de Puente Alto"},
            ]},
        ])
        self.llamadas: list[str] = []

        def fake_request(metodo, ruta, **kwargs):
            self.llamadas.append(ruta)
            valor = respuestas[ruta]
            if isinstance(valor, Exception):
                raise valor
            return valor

        monkeypatch.setattr(servicio, "_request", fake_request)
        return servicio

    def test_causa_nunca_vista_encola_y_devuelve_sincronizando(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_civil": PjudNoEncontrado("no está"),
            "/sincronizar_civil": {"exito": True},
        })
        resultado = servicio.obtener_detalle(_causa_civil(), credenciales_pjud=_CREDS)
        assert resultado["estado"] == "sincronizando"
        assert "/sincronizar_civil" in self.llamadas
        # El diagnóstico explica el 404 y el resultado del sync, para la consola.
        assert "consultar_civil: 404" in resultado["diagnostico"]
        assert "sincronizar_civil: 200" in resultado["diagnostico"]

    def test_sin_clave_del_ojv_devuelve_sin_credenciales_y_no_sincroniza(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_civil": PjudNoEncontrado("no está"),
        })
        resultado = servicio.obtener_detalle(_causa_civil(), credenciales_pjud=None)
        assert resultado["estado"] == "sin_credenciales"
        assert "/sincronizar_civil" not in self.llamadas

    def test_sincronizar_manda_rut_clave_y_metodo(self, monkeypatch):
        cuerpos: list[dict] = []
        servicio = self._servicio(monkeypatch, {
            "/consultar_civil": {"causa": {"estado": "Sincronizando", "cuadernos": []}},
            "/sincronizar_civil": {"exito": True},
        })
        original = servicio._request

        def espia(metodo, ruta, **kwargs):
            if ruta == "/sincronizar_civil":
                cuerpos.append(kwargs.get("json"))
            return original(metodo, ruta, **kwargs)

        monkeypatch.setattr(servicio, "_request", espia)
        servicio.obtener_detalle(_causa_civil(), credenciales_pjud=_CREDS)
        assert cuerpos and cuerpos[0]["rut"] == "17314741"
        assert cuerpos[0]["clave"] == "secreta"
        assert cuerpos[0]["metodo_login"] == 1

    def test_causa_en_proceso_devuelve_sincronizando(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_civil": {"causa": {"estado": "Sincronizando", "cuadernos": []}},
            "/sincronizar_civil": {"exito": True},
        })
        resultado = servicio.obtener_detalle(_causa_civil(), credenciales_pjud=_CREDS)
        assert resultado["estado"] == "sincronizando"

    def test_causa_lista_trae_las_secciones(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_civil": {"causa": {
                "identificador": "abc", "estado": "Completo",
                "cuadernos": [{"id": 1, "nombre": "Principal"}],
            }},
            "/consultar_movimientos_civil": {
                "historia": [{"folio": 1, "doc": "https://x/f1.pdf", "anexo": []}],
                "litigantes": [{"participante": "DTE"}],
                "notificaciones": [],
                "escritos_resolver": [],
                "exhortos": [{"rol_origen": "C-1-2020"}],
            },
        })
        # Una causa lista NO necesita credenciales: no se sincroniza.
        resultado = servicio.obtener_detalle(_causa_civil(), credenciales_pjud=None)
        assert resultado["estado"] == "listo"
        assert resultado["cuaderno_consultado_id"] == 1
        assert resultado["historia"][0]["documento_url"] == "https://x/f1.pdf"
        assert resultado["exhortos"][0]["rol_origen"] == "C-1-2020"

    def test_url_de_documento_se_arma_si_viene_solo_el_nombre(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {})
        url = servicio._url_documento("folio1.pdf", "abc-123", 2)
        assert url.endswith("/public/abc-123/2/folio1.pdf")

    def test_materia_no_civil_se_rechaza(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {})
        causa = types.SimpleNamespace(id=1, materia="Laboral", rol="C-1-2020", tribunal="x")
        with pytest.raises(PjudApiError, match="Civiles"):
            servicio.obtener_detalle(causa)
