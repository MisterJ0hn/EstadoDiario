"""El correo del informe con el logo del estudio.

Se arma el mensaje y se inspecciona su estructura MIME; no sale nada a la red.

Vale la pena testearlo porque las tres formas de equivocarse acá **no fallan**:
el correo se envía igual y el logo simplemente no se ve, que es algo que solo
descubre el destinatario.
"""

from unittest.mock import patch

import pytest

from app.services.smtp_service import SmtpService

PNG = b"\x89PNG\r\n\x1a\nFALSO"


class _Config:
    activo = True
    usuario = "sistema@temposoft.cl"
    remitente_email = None
    remitente_nombre = "Estado Diario"
    ultimo_envio = None
    ultimo_resultado = None


class _Db:
    def commit(self):
        pass


def _enviar(**extra):
    """Arma el mensaje interceptando el envío, y lo devuelve."""
    capturado = {}

    class _Cliente:
        def send_message(self, mensaje):
            capturado["msg"] = mensaje

    servicio = SmtpService.__new__(SmtpService)
    servicio.db = _Db()

    with patch.object(SmtpService, "get_config", lambda self: _Config()), patch.object(
        SmtpService, "_password", lambda self, c, p: "x"
    ), patch.object(SmtpService, "_conectar", lambda self, c, p: _Cliente()), patch.object(
        SmtpService, "_cerrar", lambda self, c: None
    ):
        servicio.enviar_con_adjunto(
            destinatario="abogado@estudio.cl",
            asunto="Informe",
            cuerpo="Hola:\n\nAdjunto el informe.\n",
            adjunto=b"xlsx",
            nombre_adjunto="informe.xlsx",
            **extra,
        )
    return capturado["msg"]


@pytest.fixture
def con_logo():
    return _enviar(logo=(PNG, "image/png"), nombre_estudio="Estudio Alfaro")


class TestConLogo:
    def test_el_img_apunta_al_cid_de_la_imagen(self, con_logo):
        """El error clásico: dejar los <> del Content-ID en el src del <img>.

        No falla; la imagen queda rota en el correo del destinatario.
        """
        html = _parte(con_logo, "text/html").get_content()
        cid = _parte(con_logo, "image/png").get("Content-ID").strip("<>")
        assert f"cid:{cid}" in html

    def test_no_usa_data_uri(self, con_logo):
        # Gmail y Outlook bloquean las imágenes en base64 embebidas.
        assert "data:image" not in _parte(con_logo, "text/html").get_content()

    def test_la_imagen_no_queda_como_adjunto(self, con_logo):
        """Colgada del mensaje en vez de del HTML, el cliente de correo la
        mostraría junto al Excel."""
        adjuntos = [p.get_filename() for p in con_logo.walk() if p.get_filename()]
        assert adjuntos == ["informe.xlsx"]

    def test_conserva_el_texto_plano(self, con_logo):
        # Un correo solo-HTML puntúa peor en los filtros de spam.
        assert _parte(con_logo, "text/plain") is not None

    def test_el_excel_sigue_adjunto(self, con_logo):
        assert any("informe.xlsx" == p.get_filename() for p in con_logo.walk())

    def test_escapa_el_cuerpo(self):
        msg = _enviar(logo=(PNG, "image/png"), nombre_estudio="Perez & <b>Cia</b>")
        html = _parte(msg, "text/html").get_content()
        assert "<b>Cia</b>" not in html
        assert "&lt;b&gt;" in html


class TestSinLogo:
    def test_queda_en_texto_plano(self):
        msg = _enviar()
        assert _parte(msg, "text/html") is None
        assert _parte(msg, "text/plain") is not None

    def test_el_excel_sigue_adjunto(self):
        msg = _enviar()
        assert any("informe.xlsx" == p.get_filename() for p in msg.walk())


def _parte(mensaje, tipo):
    for parte in mensaje.walk():
        if parte.get_content_type() == tipo:
            return parte
    return None
