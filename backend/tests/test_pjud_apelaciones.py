"""`obtener_detalle_apelaciones`: mismo flujo asíncrono que las otras materias,
con `{rol, anio, corte}` como clave (sin catálogo ni cuadernos)."""

import types

import pytest

from app.services.pjud_service import PjudApiError, PjudNoEncontrado, PjudService

_CREDS = {"rut": "12345678-9", "clave": "secreta", "metodo_login": 1}


def _corte(rol="23414", era="2026", corte="C.A. de Santiago", tipo="apelaciones", tipo_libro="Civil"):
    return types.SimpleNamespace(id=1, tipo=tipo, rol=rol, era=era, corte=corte, tipo_libro=tipo_libro)


class TestObtenerDetalleApelaciones:
    def _servicio(self, monkeypatch, respuestas: dict) -> PjudService:
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@x.cl")
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "x")
        servicio = PjudService()
        self.cuerpos: dict[str, dict] = {}

        def fake_request(metodo, ruta, **kwargs):
            self.cuerpos[ruta] = kwargs.get("json")
            valor = respuestas[ruta]
            if isinstance(valor, Exception):
                raise valor
            return valor

        monkeypatch.setattr(servicio, "_request", fake_request)
        return servicio

    def test_nunca_vista_encola_con_rol_anio_y_corte(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_apelaciones": PjudNoEncontrado("no está"),
            "/sincronizar_apelaciones": {"exito": True},
        })
        r = servicio.obtener_detalle_apelaciones(_corte(), credenciales_dueno=_CREDS)
        assert r["estado"] == "sincronizando"
        cuerpo = dict(self.cuerpos["/sincronizar_apelaciones"])
        assert cuerpo.pop("callback_url").endswith("/api/v1/causas/pjud/callback")
        assert cuerpo == {
            "rol": 23414, "anio": 2026, "corte": "C.A. de Santiago", "libro": "Civil", **_CREDS,
        }

    def test_sin_credenciales_del_dueno_va_sin_rut_ni_clave(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_apelaciones": PjudNoEncontrado("no está"),
            "/sincronizar_apelaciones": {"exito": True},
        })
        servicio.obtener_detalle_apelaciones(_corte(), credenciales_dueno=None)
        cuerpo = dict(self.cuerpos["/sincronizar_apelaciones"])
        assert cuerpo.pop("callback_url").endswith("/api/v1/causas/pjud/callback")
        assert cuerpo == {
            "rol": 23414, "anio": 2026, "corte": "C.A. de Santiago", "libro": "Civil",
        }

    def test_libro_sale_del_prefijo_del_rol_si_falta_la_columna(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_apelaciones": PjudNoEncontrado("no está"),
            "/sincronizar_apelaciones": {"exito": True},
        })
        servicio.obtener_detalle_apelaciones(_corte(rol="Laboral-23414", tipo_libro=None))
        assert self.cuerpos["/sincronizar_apelaciones"]["libro"] == "Laboral"

    def test_sin_libro_no_se_manda_la_clave(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_apelaciones": PjudNoEncontrado("no está"),
            "/sincronizar_apelaciones": {"exito": True},
        })
        servicio.obtener_detalle_apelaciones(_corte(tipo_libro=None))
        assert "libro" not in self.cuerpos["/sincronizar_apelaciones"]

    def test_solo_aplica_a_la_hoja_de_apelaciones(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {})
        with pytest.raises(PjudApiError, match="Corte de Apelaciones"):
            servicio.obtener_detalle_apelaciones(_corte(tipo="suprema"))

    def test_corte_incompleta_falla_claro(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {})
        with pytest.raises(PjudApiError, match="completos"):
            servicio.obtener_detalle_apelaciones(_corte(corte=None))

    def test_error_del_scrape_se_informa(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_apelaciones": {"identificador": "abc", "estado": "Error", "ultimo_error": "boom"},
            "/consultar_movimientos_apelaciones": {"movimientos": [{"folio": 5, "doc": [], "anexo": []}]},
        })
        r = servicio.obtener_detalle_apelaciones(_corte(), credenciales_dueno=_CREDS)
        assert r["estado"] == "error" and r["ultimo_error"] == "boom"
        # El error del scrape no esconde lo que api-pjud ya tenía de la causa.
        assert r["causa"] is not None and len(r["movimientos"]) == 1

    def test_listo_normaliza_documentos_icono_y_movimientos(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_apelaciones": {"identificador": "abc", "estado": "Completo",
                "libro": "Civil - 23414 - 2026",
                "certificado_envio": {"doc": "https://h/c.pdf", "color": "#ffddee"},
                "ebook": None,
                "texto": [
                    {"id": 1, "doc_principal": ["fa-check", "#AD5454"],
                     "doc": {"doc": "t.pdf", "color": "#fff"}, "fecha": "13/10/2026", "referencia": "Recurso"},
                    {"id": 2, "doc_principal": {"icono": "fa-times-circle", "color": "#111"}},
                ],
                "anexo": [{"id": 1, "doc": {"doc": "a.pdf"}, "codigo": 12, "tipo_documento": " Expedientes ",
                           "cantidad": 1}],
                "expediente_primera": {"causa_origen": "C - 711 - 2026", "tribunal": "3º JUZGADO CIVIL DE SANTIAGO"},
            },
            "/consultar_movimientos_apelaciones": {
                "movimientos": [{
                    "folio": 5,
                    "doc": [{"doc": "https://h/m.pdf", "color": "#ffdd44"}],
                    "anexo": [], "tramite": "Resolución", "georeferencia": {},
                }],
                "liquidantes": [{"sujeto": "recurrente"}],
                "exhortos": [{}],
                "incompentencia": [{"x": 1}],
            },
        })
        r = servicio.obtener_detalle_apelaciones(_corte(), credenciales_dueno=_CREDS)
        assert r["estado"] == "listo"
        c = r["causa"]
        assert c["certificado_envio"] == {"url": "https://h/c.pdf", "color": "#ffddee"}
        assert c["ebook"] is None
        assert c["texto"][0]["doc_principal"] == {"icono": "fa-check", "color": "#AD5454"}
        assert c["texto"][0]["doc"]["url"].endswith("/public/abc/1/t.pdf")
        assert c["texto"][1]["doc_principal"] == {"icono": "fa-times-circle", "color": "#111"}
        assert c["anexo"][0]["codigo"] == "12" and c["anexo"][0]["tipo_documento"] == "Expedientes"
        assert c["anexo"][0]["cantidad"] == "1"
        m = r["movimientos"][0]
        assert m["documentos"] == [{"url": "https://h/m.pdf", "color": "#ffdd44"}]
        assert m["georeferencia"] is None
        assert r["liquidantes"] == [{"sujeto": "recurrente"}]
        assert r["exhortos"] == []
        assert r["incompetencia"] == [{"x": 1}]
        assert self.cuerpos["/consultar_movimientos_apelaciones"] == {"identificador": "abc", **_CREDS}
