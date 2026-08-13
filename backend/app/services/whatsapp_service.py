"""Envío de recordatorios por WhatsApp usando Twilio (plantilla aprobada).

La otra mitad del circuito es el webhook `/request-tw`, que recibe la respuesta
del botón de estos mensajes: lo orquesta `twilio_webhook_service.py` y la lógica
sobre la base del cliente vive en `estado_diario_service.webhook_twilio`.

Lo que este módulo le aporta al webhook son dos cosas: `validar_firma_twilio`,
que autentica el callback, y la fila de `WhatsappEnvio` que se escribe al enviar
y es lo que después permite saber de qué cliente era el mensaje.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.crypto import descifrar
from app.models.estado_diario_agenda import EstadoDiarioAgenda
from app.models.maestra.whatsapp_envio import WhatsappEnvio
from app.repositories.configuracion_whatsapp_repository import ConfiguracionWhatsappRepository
from app.repositories.estado_diario_agenda_repository import EstadoDiarioAgendaRepository

logger = logging.getLogger(__name__)


class ErrorConfiguracion(Exception):
    """La configuración de Twilio está incompleta o desactivada."""


def validar_firma_twilio(
    db_maestra: Session, urls: list[str], params: dict, firma: Optional[str]
) -> Optional[str]:
    """Verifica la cabecera X-Twilio-Signature del webhook /request-tw.

    Devuelve None si el request es legítimo (o si la validación está
    desactivada en la configuración) y, si no, el motivo del rechazo.

    Twilio firma con el Auth Token sobre la URL exacta configurada en su
    consola más los parámetros del POST; por eso se prueban varias URLs
    candidatas (ver el endpoint): detrás del proxy el backend ve http y un
    host interno, no la URL pública que Twilio usó para firmar.

    Es una función de módulo y no un método de `WhatsappService` porque solo
    necesita la base PRINCIPAL: el webhook la llama antes de saber de qué
    cliente es el callback, que es justamente lo que no puede averiguar sin
    haberlo autenticado primero.
    """
    config = ConfiguracionWhatsappRepository(db_maestra).get_or_create(None)

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


class WhatsappService:
    def __init__(self, db: Session, db_maestra: Session, cliente_id: int):
        # Base del cliente: los recordatorios y su estado de envío.
        self.db = db
        # Base principal: las credenciales de Twilio y el índice de envíos.
        self.db_maestra = db_maestra
        # De qué cliente es la base tenant que se recibió. Hace falta para
        # anotar el envío en la base principal; el servicio no puede deducirlo
        # de `db` porque una sesión no sabe a qué cliente pertenece.
        self.cliente_id = cliente_id
        self.config_repo = ConfiguracionWhatsappRepository(db_maestra)
        self.agenda_repo = EstadoDiarioAgendaRepository(db)

    def enviar_pendientes(self) -> dict:
        config = self.config_repo.get_or_create(None)

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
                # En la base principal, para que el webhook público sepa después
                # en qué base buscar este SID. Ver `WhatsappEnvio`.
                self.db_maestra.add(WhatsappEnvio(
                    twilio_sid=mensaje.sid,
                    cliente_id=self.cliente_id,
                    agenda_id=agenda.id,
                    fecha_envio=datetime.now(timezone.utc),
                ))
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

        # Segunda base, segundo commit. Si este falla los mensajes ya salieron y
        # quedaron bien guardados en la base del cliente: lo único que se pierde
        # es el atajo del webhook, que igual tiene su respaldo por recorrido. No
        # es motivo para reportar el envío como fallido.
        try:
            self.db_maestra.commit()
        except Exception:
            self.db_maestra.rollback()
            logger.exception(
                "No se pudo anotar en la base principal el índice de envíos de "
                "WhatsApp del cliente %s; el webhook tendrá que resolverlos "
                "recorriendo los clientes",
                self.cliente_id,
            )

        return {
            "exito": True,
            "mensaje": f"{enviados} enviados, {errores} con error",
            "procesados": len(pendientes),
            "enviados": enviados,
            "errores": errores,
        }

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
