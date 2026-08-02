"""Envío de correo saliente.

Es la contraparte de `correo_service` (IMAP de entrada, una casilla por
usuario): acá hay UNA cuenta remitente del sistema, global, que despacha los
informes. Un usuario nunca envía desde su propia casilla — el informe le llega
*desde* el sistema *a* su `usuario.email`.
"""

import logging
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional

from sqlalchemy.orm import Session

from app.core.crypto import descifrar
from app.models.configuracion_smtp import ConfiguracionSmtp

logger = logging.getLogger(__name__)

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class ErrorEnvio(Exception):
    """Falla de configuración o de entrega. El llamador la traduce a un
    mensaje para el usuario; nunca se deja escapar el traceback crudo."""


class SmtpService:
    def __init__(self, db: Session):
        self.db = db

    def get_config(self) -> ConfiguracionSmtp:
        """Configuración única (fila id=1). Se crea vacía la primera vez para
        que la pantalla de administración tenga algo que editar."""
        config = self.db.query(ConfiguracionSmtp).order_by(ConfiguracionSmtp.id).first()
        if config is None:
            config = ConfiguracionSmtp()
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

    def enviar_con_adjunto(
        self,
        destinatario: str,
        asunto: str,
        cuerpo: str,
        adjunto: bytes,
        nombre_adjunto: str,
    ) -> None:
        """Despacha el informe. Lanza ErrorEnvio si no se pudo entregar.

        No se traga los errores: si el correo no salió, el usuario tiene que
        enterarse. Un informe que dice "enviado" y nunca llega es peor que uno
        que falla a la vista.
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

        password = self._password(config, None)

        mensaje = EmailMessage()
        mensaje["Subject"] = asunto
        remitente = config.remitente_email or config.usuario
        mensaje["From"] = formataddr((config.remitente_nombre or "Estado Diario", remitente))
        mensaje["To"] = destinatario
        mensaje.set_content(cuerpo)
        mensaje.add_attachment(
            adjunto,
            maintype="application",
            subtype=XLSX_MIME.split("/", 1)[1],
            filename=nombre_adjunto,
        )

        cliente = None
        try:
            cliente = self._conectar(config, password)
            cliente.send_message(mensaje)
            config.ultimo_envio = datetime.now(timezone.utc)
            config.ultimo_resultado = f"Enviado a {destinatario}"
            self.db.commit()
            logger.info("Informe enviado a %s", destinatario)
        except Exception as e:
            logger.exception("Fallo al enviar el informe a %s", destinatario)
            config.ultimo_envio = datetime.now(timezone.utc)
            config.ultimo_resultado = f"Error: {e}"
            self.db.commit()
            raise ErrorEnvio(f"No se pudo enviar el correo: {e}") from e
        finally:
            self._cerrar(cliente)
