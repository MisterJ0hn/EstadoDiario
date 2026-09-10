"""`obtener_detalle_familia`: mismo flujo asíncrono que Civil pero con la forma
de respuesta de Familia (`movimientos`, `materias`, `plazos`, `diligencias`; sin
cuadernos). Se reemplaza `_request` por un doble que responde según la ruta.
"""

import types

import pytest

from app.services.pjud_service import PjudApiError, PjudNoEncontrado, PjudService

_CREDS = {"rut": "12345678-9", "clave": "secreta", "metodo_login": 1}


def _causa_familia(rol="C-11247-2026", tribunal="1° Juzgado Civil de Valparaíso"):
    return types.SimpleNamespace(id=1, materia="Familia", rol=rol, tribunal=tribunal)


class TestObtenerDetalleFamilia:
    def _servicio(self, monkeypatch, respuestas: dict) -> PjudService:
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@x.cl")
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "x")
        servicio = PjudService()
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
            "/consultar_familia": PjudNoEncontrado("no está"),
            "/sincronizar_familia": {"exito": True},
        })
        resultado = servicio.obtener_detalle_familia(_causa_familia(), credenciales_pjud=_CREDS)
        assert resultado["estado"] == "sincronizando"
        assert "/sincronizar_familia" in self.llamadas
        assert "consultar_familia: 404" in resultado["diagnostico"]

    def test_sin_clave_del_ojv_devuelve_sin_credenciales_y_no_sincroniza(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_familia": PjudNoEncontrado("no está"),
        })
        resultado = servicio.obtener_detalle_familia(_causa_familia(), credenciales_pjud=None)
        assert resultado["estado"] == "sin_credenciales"
        assert "/sincronizar_familia" not in self.llamadas

    def test_sincronizar_manda_rut_clave_y_metodo(self, monkeypatch):
        cuerpos: list[dict] = []
        servicio = self._servicio(monkeypatch, {
            "/consultar_familia": {"causa": {"estado": "Sincronizando"}},
            "/sincronizar_familia": {"exito": True},
        })
        original = servicio._request

        def espia(metodo, ruta, **kwargs):
            if ruta == "/sincronizar_familia":
                cuerpos.append(kwargs.get("json"))
            return original(metodo, ruta, **kwargs)

        monkeypatch.setattr(servicio, "_request", espia)
        servicio.obtener_detalle_familia(_causa_familia(), credenciales_pjud=_CREDS)
        assert cuerpos and cuerpos[0]["rut"] == "12345678-9"
        assert cuerpos[0]["clave"] == "secreta"
        assert cuerpos[0]["metodo_login"] == 1
        # Familia no resuelve tribunal contra catálogo: corte/tribunal van en 0.
        assert cuerpos[0]["corte"] == 0 and cuerpos[0]["tribunal"] == 0

    def test_sync_con_error_devuelve_estado_error_y_no_reintenta(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_familia": {"causa": {
                "estado": "Error",
                "ultimo_error": "clave incorrecta",
            }},
        })
        resultado = servicio.obtener_detalle_familia(_causa_familia(), credenciales_pjud=_CREDS)
        assert resultado["estado"] == "error"
        assert resultado["ultimo_error"] == "clave incorrecta"
        assert "/sincronizar_familia" not in self.llamadas

    def test_causa_lista_trae_las_secciones(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_familia": {"causa": {
                "identificador": "guid-1", "estado": "Completo",
                "rit": "C-11247-2026", "Ruc": "23-2-4049306-3",
            }},
            "/consultar_movimientos_familia": {
                "movimientos": [{
                    "folio": 2, "folio_texto": "2",
                    "doc": [{"doc": "https://x/f2.pdf"}, {"doc": "https://x/f2_doc2.pdf"}],
                    "anexo": [{"folio": 14, "doc": "https://x/a.pdf", "fecha": "24/02/2025"}],
                    "tramite": "Resolución",
                }],
                "litigantes": [{"sujeto": "DTE", "rut": "97030000-7"}],
                "notificaciones": [{"tipo_notif": "e-mail"}],
                "materias": [{"glosa_de_materia": "DIVORCIO DE COMUN ACUERDO"}],
                "plazos": [{"tipo_plazo": "Legal"}],
                "diligencias": [{"tipo_diligencia": "Oficio"}],
            },
        })
        # Una causa lista NO necesita credenciales: no se sincroniza.
        resultado = servicio.obtener_detalle_familia(_causa_familia(), credenciales_pjud=None)
        assert resultado["estado"] == "listo"
        assert resultado["causa"]["ruc"] == "23-2-4049306-3"
        assert resultado["movimientos"][0]["documentos"] == [
            {"url": "https://x/f2.pdf", "tipo": "principal"},
            {"url": "https://x/f2_doc2.pdf", "tipo": "principal"},
        ]
        assert resultado["materias"][0]["glosa_de_materia"] == "DIVORCIO DE COMUN ACUERDO"
        assert resultado["plazos"] and resultado["diligencias"]
        assert "/sincronizar_familia" not in self.llamadas

    def test_sincronizando_sin_movimientos_aun_no_falla(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_familia": {"causa": {
                "identificador": "guid-1", "estado": "Sincronizando",
            }},
            "/sincronizar_familia": {"exito": True},
            "/consultar_movimientos_familia": PjudNoEncontrado("aún no"),
        })
        resultado = servicio.obtener_detalle_familia(_causa_familia(), credenciales_pjud=_CREDS)
        assert resultado["estado"] == "sincronizando"
        assert resultado["causa"]["identificador"] == "guid-1"
        assert resultado["movimientos"] == []

    def test_causa_en_raiz_sin_envoltorio_tambien_se_entiende(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_familia": {
                "identificador": "guid-1", "estado": "Completo", "rit": "C-1-2026",
            },
            "/consultar_movimientos_familia": {"movimientos": []},
        })
        resultado = servicio.obtener_detalle_familia(_causa_familia(), credenciales_pjud=None)
        assert resultado["estado"] == "listo"
        assert resultado["causa"]["identificador"] == "guid-1"

    def test_materia_no_familia_se_rechaza(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {})
        causa = types.SimpleNamespace(id=1, materia="Civil", rol="C-1-2020", tribunal="x")
        with pytest.raises(PjudApiError, match="Familia"):
            servicio.obtener_detalle_familia(causa)


def test_normalizar_documentos_familia_arma_url_desde_el_nombre(monkeypatch):
    monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@x.cl")
    monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "x")
    servicio = PjudService()
    movimientos = [{"doc": [{"doc": "folio2.pdf"}], "anexo": [{"doc": "anexo1.pdf"}]}]
    servicio._normalizar_documentos_familia(movimientos, "guid-1")
    assert movimientos[0]["documentos"][0]["url"].endswith("/public/guid-1/1/folio2.pdf")
    assert movimientos[0]["anexo"][0]["doc"].endswith("/public/guid-1/1/anexo1.pdf")
