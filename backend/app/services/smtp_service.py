"""Envío de correo saliente.

Es la contraparte de `correo_service` (IMAP de entrada, una casilla por
cliente): acá hay UNA cuenta remitente del sistema, global, que despacha los
informes de todos. Un usuario nunca envía desde su propia casilla — el informe
le llega *desde* el sistema *a* su correo.

La configuración vive en la base PRINCIPAL, así que la sesión que recibe este
servicio es la maestra, no la del cliente.
"""

import logging
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from html import escape
from typing import Optional

from sqlalchemy.orm import Session

from app.core.crypto import descifrar
from app.models.maestra.configuracion_smtp import ConfiguracionSmtp

logger = logging.getLogger(__name__)

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class ErrorEnvio(Exception):
    """Falla de configuración o de entrega. El llamador la traduce a un
    mensaje para el usuario; nunca se deja escapar el traceback crudo."""


class SmtpService:
    def __init__(self, db: Session):
        self.db = db

    def get_config(self) -> ConfiguracionSmtp:
        """Fila GLOBAL del sistema: la que tiene `cliente_id` nulo.

        El modelo admite además una fila por cliente, pero la cuenta de salida
        es del SaaS: hoy nadie envía desde la suya. Se crea vacía la primera
        vez para que la pantalla de administración tenga algo que editar.
        """
        config = (
            self.db.query(ConfiguracionSmtp)
            .filter(ConfiguracionSmtp.cliente_id.is_(None))
            .order_by(ConfiguracionSmtp.id)
            .first()
        )
        if config is None:
            config = ConfiguracionSmtp(cliente_id=None)
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        return config

    def _password(self, config: ConfiguracionSmtp, override: Optional[str]) -> str:
        if override:
            return override
        if not config.password_cifrado:
            raise ErrorEnvio("No hay contraseña guardada para la cuenta de envío")
        return descifrar(config.password_cifrado)

    def _conectar(self, config: ConfiguracionSmtp, password: str):
        # 465 usa SSL desde el saludo; 587 abre en claro y sube a TLS con
        # STARTTLS. Son incompatibles entre sí: mezclarlos da un error de
        # handshake que no dice nada útil.
        if config.usar_ssl:
            cliente = smtplib.SMTP_SSL(config.host, config.puerto, timeout=30)
        else:
            cliente = smtplib.SMTP(config.host, config.puerto, timeout=30)
            if config.usar_tls:
                cliente.starttls()
        cliente.login(config.usuario, password)
        return cliente

    def probar_conexion(self, password_override: Optional[str] = None) -> dict:
        """Valida credenciales sin enviar nada."""
        config = self.get_config()
        if not config.usuario:
            return {"exito": False, "mensaje": "Falta el usuario de la cuenta de envío"}

        try:
            password = self._password(config, password_override)
        except (ErrorEnvio, ValueError) as e:
            return {"exito": False, "mensaje": str(e)}

        cliente = None
        try:
            cliente = self._conectar(config, password)
            return {"exito": True, "mensaje": f"Conexión correcta con {config.host}"}
        except smtplib.SMTPAuthenticationError as e:
            # Gmail exige contraseña de aplicación; el error propio lo dice mal.
            return {
                "exito": False,
                "mensaje": (
                    f"Error de autenticación: {e}. Si es Gmail, use una contraseña "
                    "de aplicación (requiere verificación en dos pasos)."
                ),
            }
        except Exception as e:
            return {"exito": False, "mensaje": f"No se pudo conectar: {e}"}
        finally:
            self._cerrar(cliente)

    @staticmethod
    def _cerrar(cliente) -> None:
        if cliente is None:
            return
        try:
            cliente.quit()
        except Exception:
            pass

    @staticmethod
    def _html_con_logo(cuerpo: str, cid_logo: str, nombre_estudio: Optional[str]) -> str:
        """Versión HTML del mensaje, con el logo del estudio arriba.

        El logo va como imagen ADJUNTA referenciada por `cid:` y no como
        `data:` URI: Gmail y Outlook bloquean las imágenes embebidas en base64,
        así que un logo puesto de esa forma no se vería en los dos clientes de
        correo que usa casi todo el mundo.

        El cuerpo se escapa: viene del nombre de la plantilla y del usuario, y
        un `<` ahí no puede convertirse en etiqueta.
        """
        parrafos = "".join(
            f'<p style="margin:0 0 12px">{escape(bloque)}</p>'
            for bloque in cuerpo.split("\n\n")
            if bloque.strip()
        )
        alt = escape(nombre_estudio or "")
        encabezado = (
            f'<img src="cid:{cid_logo}" alt="{alt}" '
            f'style="max-height:56px;max-width:220px;margin-bottom:20px">'
        )
        return (
            '<html><body style="font-family:Arial,Helvetica,sans-serif;'
            'font-size:14px;color:#262626;line-height:1.5">'
            f"{encabezado}{parrafos}"
            "</body></html>"
        )

    def _config_operativa(self, destinatario: str) -> ConfiguracionSmtp:
        """La cuenta de envío, verificando que se pueda usar de verdad.

        Se comprueba antes de armar el mensaje: si la cuenta está apagada o a
        medio configurar, el error dice qué falta en vez de fallar más adelante
        con un mensaje de smtplib.
        """
        config = self.get_config()

        if not config.activo:
            raise ErrorEnvio(
                "El envío de correo está desactivado. Actívelo en "
                "Configuración → Correo de envío."
            )
        if not config.usuario:
            raise ErrorEnvio("Falta configurar la cuenta de envío")
        if not destinatario:
            raise ErrorEnvio("El usuario no tiene un correo registrado al cual enviar")

        return config

    def _sobre(self, config: ConfiguracionSmtp, destinatario: str, asunto: str, cuerpo: str):
        mensaje = EmailMessage()
        mensaje["Subject"] = asunto
        remitente = config.remitente_email or config.usuario
        mensaje["From"] = formataddr((config.remitente_nombre or "Estado Diario", remitente))
        mensaje["To"] = destinatario
        mensaje.set_content(cuerpo)
        return mensaje

    def _despachar(self, config: ConfiguracionSmtp, mensaje, destinatario: str) -> None:
        """Conecta, envía y deja anotado el resultado en la configuración.

        No se traga los errores: si el correo no salió, quien lo pidió tiene
        que enterarse. Un envío que dice "enviado" y nunca llega es peor que
        uno que falla a la vista.
        """
        password = self._password(config, None)

        cliente = None
        try:
            cliente = self._conectar(config, password)
            cliente.send_message(mensaje)
            config.ultimo_envio = datetime.now(timezone.utc)
            config.ultimo_resultado = f"Enviado a {destinatario}"
            self.db.commit()
            logger.info("Correo enviado a %s", destinatario)
        except Exception as e:
            logger.exception("Fallo al enviar el correo a %s", destinatario)
            config.ultimo_envio = datetime.now(timezone.utc)
            config.ultimo_resultado = f"Error: {e}"
            self.db.commit()
            raise ErrorEnvio(f"No se pudo enviar el correo: {e}") from e
        finally:
            self._cerrar(cliente)

    def enviar(self, destinatario: str, asunto: str, cuerpo: str) -> None:
        """Correo de texto plano, sin adjunto ni logo.

        Lo usa la recuperación de contraseña: ahí el mensaje sale ANTES de que
        haya sesión, así que no se sabe de qué estudio es el logo, y el enlace
        tiene que poder leerse en cualquier cliente de correo.
        """
        config = self._config_operativa(destinatario)
        self._despachar(config, self._sobre(config, destinatario, asunto, cuerpo), destinatario)

    def enviar_con_adjunto(
        self,
        destinatario: str,
        asunto: str,
        cuerpo: str,
        adjunto: bytes,
        nombre_adjunto: str,
        logo: Optional[tuple[bytes, str]] = None,
        nombre_estudio: Optional[str] = None,
    ) -> None:
        """Despacha el informe. Lanza ErrorEnvio si no se pudo entregar."""
        config = self._config_operativa(destinatario)
        mensaje = self._sobre(config, destinatario, asunto, cuerpo)

        # Con logo el mensaje pasa a ser multiparte: el texto plano queda como
        # alternativa y se agrega un HTML que referencia la imagen en línea.
        # Sin logo se queda como estaba, en texto plano y sin partes de más.
        if logo is not None:
            contenido_logo, mime_logo = logo
            cid = make_msgid(domain="estadodiario")
            mensaje.add_alternative(
                # cid[1:-1]: make_msgid devuelve <...> y en el src del <img> va
                # sin los ángulos. Ponerlos deja la imagen rota, en silencio.
                self._html_con_logo(cuerpo, cid[1:-1], nombre_estudio),
                subtype="html",
            )
            subtipo = mime_logo.split("/", 1)[-1] if "/" in mime_logo else "png"
            # La imagen se cuelga de la parte HTML, no del mensaje: colgada del
            # mensaje sería un adjunto más y el cliente de correo la mostraría
            # junto al Excel en vez de dentro del texto.
            mensaje.get_payload()[-1].add_related(
                contenido_logo, maintype="image", subtype=subtipo, cid=cid
            )

        mensaje.add_attachment(
            adjunto,
            maintype="application",
            subtype=XLSX_MIME.split("/", 1)[1],
            filename=nombre_adjunto,
        )

        self._despachar(config, mensaje, destinatario)
