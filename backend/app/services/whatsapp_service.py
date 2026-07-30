"""Envío de recordatorios por WhatsApp usando Twilio (plantilla aprobada).

Convive con el webhook de Twilio ya existente (app/services/estado_diario_
service.py: webhook_twilio) que recibe la respuesta del botón "Resuelto" de
esos mensajes. No lo reemplaza.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.crypto import descifrar
from app.models.estado_diario_agenda import EstadoDiarioAgenda
from app.repositories.configuracion_whatsapp_repository import ConfiguracionWhatsappRepository
from app.repositories.estado_diario_agenda_repository import EstadoDiarioAgendaRepository

logger = logging.getLogger(__name__)


class ErrorConfiguracion(Exception):
    """La configuración de Twilio está incompleta o desactivada."""


class WhatsappService:
    def __init__(self, db: Session):
        self.db = db
        self.config_repo = ConfiguracionWhatsappRepository(db)
        self.agenda_repo = EstadoDiarioAgendaRepository(db)

    def enviar_pendientes(self) -> dict:
        config = self.config_repo.get_or_create()

        if not config.activo:
            return {"exito": False, "mensaje": "El envío de WhatsApp está desactivado", "procesados": 0}
        if not config.twilio_account_sid or not config.twilio_auth_token_cifrado:
            return {"exito": False, "mensaje": "Falta configurar Twilio", "procesados": 0}
        if not config.twilio_numero_whatsapp or not config.plantilla_content_sid:
            return {
                "exito": False,
                "mensaje": "Falta el número de WhatsApp o la plantilla aprobada",
                "procesados": 0,
            }

        from twilio.base.exceptions import TwilioRestException
        from twilio.rest import Client

        client = Client(config.twilio_account_sid, descifrar(config.twilio_auth_token_cifrado))

        ahora = datetime.now(timezone.utc)
        pendientes = self.agenda_repo.find_pendientes_whatsapp(ahora)
        logger.info("Envío de WhatsApp: %d recordatorios pendientes", len(pendientes))

        enviados = errores = 0
        for agenda in pendientes:
            if not agenda.whatsapp_telefono:
                agenda.mensaje_error = "Sin número de teléfono destino"
                errores += 1
                continue

            try:
                movimiento = agenda.estado_diario
                mensaje = client.messages.create(
                    from_=self._a_canal_whatsapp(config.twilio_numero_whatsapp),
                    to=self._a_canal_whatsapp(agenda.whatsapp_telefono),
                    content_sid=config.plantilla_content_sid,
                    content_variables=self._variables_plantilla(agenda, movimiento),
                    body=agenda.detalle,
                )
                agenda.enviado = True
                agenda.fecha_envio = datetime.now(timezone.utc)
                agenda.twilio_sid = mensaje.sid
                agenda.mensaje_error = None
                enviados += 1
            except TwilioRestException as e:
                logger.warning("Error de Twilio enviando agenda %s: %s", agenda.id, e)
                agenda.mensaje_error = f"Error de Twilio: {e.msg}"
                errores += 1
            except Exception as e:
                logger.exception("Fallo inesperado enviando WhatsApp para agenda %s", agenda.id)
                agenda.mensaje_error = str(e)
                errores += 1

        self.db.commit()
        return {
            "exito": True,
            "mensaje": f"{enviados} enviados, {errores} con error",
            "procesados": len(pendientes),
            "enviados": enviados,
            "errores": errores,
        }

    def validar_firma_twilio(
        self, urls: list[str], params: dict, firma: Optional[str]
    ) -> Optional[str]:
        """Verifica la cabecera X-Twilio-Signature del webhook /request-tw.

        Devuelve None si el request es legítimo (o si la validación está
        desactivada en la configuración) y, si no, el motivo del rechazo.

        Twilio firma con el Auth Token sobre la URL exacta configurada en su
        consola más los parámetros del POST; por eso se prueban varias URLs
        candidatas (ver el endpoint): detrás del proxy el backend ve http y un
        host interno, no la URL pública que Twilio usó para firmar.
        """
        config = self.config_repo.get_or_create()

        if not config.validar_firma_webhook:
            return None

        if not config.twilio_auth_token_cifrado:
            return "La validación de firma está activa pero falta el Auth Token de Twilio"

        if not firma:
            return "Falta la cabecera X-Twilio-Signature"

        from twilio.request_validator import RequestValidator

        validador = RequestValidator(descifrar(config.twilio_auth_token_cifrado))
        for url in urls:
            if validador.validate(url, params, firma):
                logger.debug("Firma de Twilio válida para %s", url)
                return None

        return f"Firma X-Twilio-Signature inválida (URLs probadas: {', '.join(urls) or 'ninguna'})"

    @staticmethod
    def _a_canal_whatsapp(numero: str) -> str:
        """Normaliza a "whatsapp:+E164": admite que el número ya venga con
        el prefijo, sin él, o con mayúsculas/espacios distintos. El SID de
        Twilio (error 63007, "no Channel with the specified From address")
        aparece justamente si falta este prefijo."""
        numero = numero.strip()
        if numero.lower().startswith("whatsapp:"):
            numero = numero.split(":", 1)[1].strip()
        return f"whatsapp:{numero}"

    @staticmethod
    def _variables_plantilla(agenda: EstadoDiarioAgenda, movimiento) -> str:
        # Mismo contrato que la plantilla ya aprobada en Twilio (heredada del
        # sistema anterior en Symfony): 3 variables, rol / detalle / id.
        import json

        return json.dumps({
            "1": str(movimiento.rol or ""),
            "2": str(agenda.detalle or ""),
            "3": str(movimiento.id),
        })
