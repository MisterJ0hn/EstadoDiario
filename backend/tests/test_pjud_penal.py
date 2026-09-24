"""`obtener_detalle_penal`: mismo flujo asíncrono que Laboral/Cobranza, con
`tipo` como nombre ("Ordinaria"), historia sin cuadernos y `Relaciones`."""

import types

import pytest

from app.services.pjud_service import PjudApiError, PjudNoEncontrado, PjudService

_CREDS = {"rut": "12345678-9", "clave": "secreta", "metodo_login": 1}
_CATALOGO = {"cortes": [{"id": 90, "tribunales": [{"id": 387, "nombre": "Juzgado de Garantía de Chile Chico"}]}]}


def _causa(rol="1-2025", tribunal="Juzgado de Garantía de Chile Chico", tipo_causa="Ordinaria"):
    return types.SimpleNamespace(
        id=1, materia="Penal", rol=rol, tribunal=tribunal, tipo_causa=tipo_causa,
    )


class TestObtenerDetallePenal:
    def _servicio(self, monkeypatch, respuestas: dict) -> PjudService:
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_EMAIL", "bot@x.cl")
        monkeypatch.setattr("app.services.pjud_service.settings.PJUD_API_PASSWORD", "x")
        PjudService._catalogo.pop("penal", None)
        servicio = PjudService()
        self.cuerpos: dict[str, dict] = {}

        def fake_request(metodo, ruta, **kwargs):
            self.cuerpos[ruta] = kwargs.get("json")
            valor = {"/catalogo/tribunales": _CATALOGO, **respuestas}[ruta]
            if isinstance(valor, Exception):
                raise valor
            return valor

        monkeypatch.setattr(servicio, "_request", fake_request)
        return servicio

    def test_nunca_vista_encola_con_tipo_nombre_y_ids_del_catalogo(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_penal": PjudNoEncontrado("no está"),
            "/sincronizar_penal": {"exito": True},
        })
        r = servicio.obtener_detalle_penal(_causa(), credenciales_pjud=_CREDS)
        assert r["estado"] == "sincronizando"
        cuerpo = self.cuerpos["/sincronizar_penal"]
        assert (cuerpo["corte"], cuerpo["tribunal"]) == (90, 387)
        assert (cuerpo["tipo"], cuerpo["rol"], cuerpo["anio"]) == ("Ordinaria", 1, 2025)
        assert cuerpo["rut"] == "12345678-9"

    def test_sin_clave_devuelve_sin_credenciales(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {"/consultar_penal": PjudNoEncontrado("no está")})
        r = servicio.obtener_detalle_penal(_causa(), credenciales_pjud=None)
        assert r["estado"] == "sin_credenciales"
        assert "/sincronizar_penal" not in self.cuerpos

    def test_tipo_viene_del_tipo_causa_y_tolera_acentos_y_mayusculas(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_penal": PjudNoEncontrado("no está"),
            "/sincronizar_penal": {"exito": True},
        })
        servicio.obtener_detalle_penal(
            _causa(rol="1-2025", tipo_causa="EXTRADICION"), credenciales_pjud=_CREDS,
        )
        assert self.cuerpos["/sincronizar_penal"]["tipo"] == "Extradición"

    def test_tipo_causa_desconocido_falla_claro(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {})
        with pytest.raises(PjudApiError, match="no es uno de los del PJUD Penal"):
            servicio.obtener_detalle_penal(_causa(tipo_causa="Otra"), credenciales_pjud=_CREDS)

    def test_tribunal_fuera_del_catalogo_es_error_con_diagnostico(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {})
        r = servicio.obtener_detalle_penal(_causa(tribunal="Otro"), credenciales_pjud=_CREDS)
        assert r["estado"] == "error"
        assert "catálogo Penal" in r["ultimo_error"]

    def test_listo_normaliza_cabecera_documentos_y_relaciones(self, monkeypatch):
        servicio = self._servicio(monkeypatch, {
            "/consultar_penal": {"causa": {
                "identificador": "abc", "estado": "Completo", "rit": "1-2025",
                "cuadernos": [{"id": 1, "nombre": "1 - principal"}, {"id": 2, "nombre": "2 - x"}],
                "est_adm": "Sin archivar", "certificado_envio": "https://x/c.pdf", "acumulada": "",
            }},
            "/consultar_movimientos_penal": {
                "historia": [{
                    "folio": 1, "folio_texto": "1",
                    "doc": [{"doc": "https://h/a.pdf", "color": "#ffddee"}],
                    "anexo": [{"doc": "b.pdf", "color": "#fff", "fecha": "24/02/2025", "referencia": "Mandato"}],
                }],
                "Relaciones": [{"nombre": "NN"}],
            },
        })
        r = servicio.obtener_detalle_penal(_causa(), cuaderno_id=2, credenciales_pjud=_CREDS)
        assert r["estado"] == "listo" and r["cuaderno_consultado_id"] == 2
        assert r["causa"]["rol"] == "1-2025" and r["causa"]["estado_adm"] == "Sin archivar"
        assert r["causa"]["acumulada"] is None
        assert r["historia"][0]["documentos"] == [{"url": "https://h/a.pdf", "color": "#ffddee"}]
        assert r["historia"][0]["anexo"][0]["doc"].endswith("/public/abc/1/b.pdf")
        assert r["relaciones"] == [{"nombre": "NN"}]
        assert self.cuerpos["/consultar_movimientos_penal"] == {"identificador": "abc", "cuaderno": 2}

    def test_rol_de_penal_es_rol_anio_y_tolera_prefijo(self):
        assert PjudService.parsear_rol_penal("1653-2023") == (1653, 2023)
        assert PjudService.parsear_rol_penal("O-1653-2023") == (1653, 2023)
        with pytest.raises(PjudApiError, match="rol-año"):
            PjudService.parsear_rol_penal("abc")
