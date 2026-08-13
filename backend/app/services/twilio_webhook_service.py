"""Orquestación del webhook público de Twilio (`/api/v1/estado-diario/request-tw`).

Este módulo existe por una razón puntual: **el callback de Twilio no trae JWT**,
y sin JWT no hay guid de cliente, y sin guid no se sabe a qué base ir. Todo lo
que hay acá es resolver esa pregunta antes de poder trabajar. La lógica de
negocio —marcar leído, postergar, dejar la llamada en la bitácora— no cambió de
lugar: sigue en `EstadoDiarioService.webhook_twilio`, sobre la base del cliente.

El orden importa por seguridad: **primero se valida la firma, después se busca
el cliente.** Validar la firma solo necesita la configuración global (base
principal), así que un callback falso se rechaza sin haber abierto una sola
conexión contra la base de ningún estudio. Al revés, cualquiera que conociera la
URL podría hacernos recorrer todas las bases con un SID inventado.

Cómo se resuelve el cliente, en orden:

1. `whatsapp_envio` en la base principal, que se escribe al enviar el mensaje
   (ver `WhatsappService.enviar_pendientes`). Es una consulta y es el camino
   normal.
2. Si el SID no está anotado, se recorren los clientes activos buscándolo, igual
   que hace `app/jobs/enviar_recordatorios_whatsapp.py`. Cubre los mensajes que
   salieron antes de que existiera la tabla, y de paso la rellena: cada SID se
   recorre una vez y nunca más.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.database import sesion_tenant
from app.core.exceptions import ForbiddenException
from app.models.maestra.cliente import Cliente
from app.models.maestra.whatsapp_envio import WhatsappEnvio
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.estado_diario_agenda_repository import EstadoDiarioAgendaRepository
from app.services.estado_diario_service import EstadoDiarioService
from app.services.whatsapp_service import validar_firma_twilio

logger = logging.getLogger(__name__)


def procesar_callback(
    db_maestra: Session,
    datos: dict,
    firma: Optional[str] = None,
    urls: Optional[list[str]] = None,
) -> dict:
    """Autentica el callback, ubica al cliente y delega en su base.

    Devuelve `exito=True` con el motivo cuando el callback es legítimo pero no
    hay nada que hacer con él (sin SID, SID desconocido): Twilio reintenta lo
    que responde con error, y reintentar algo que no va a cambiar es ruido
    eterno. Solo la firma inválida corta con 403.
    """
    motivo = validar_firma_twilio(db_maestra, urls or [], datos, firma)
    if motivo:
        # No queda en `api_llamado_estado_diario`: esa tabla vive en la base de
        # un cliente y acá todavía no se sabe cuál (ni si existe). El log de la
        # aplicación es el único lugar posible.
        logger.warning("Webhook Twilio rechazado: %s", motivo)
        raise ForbiddenException("Firma de Twilio inválida")

    twilio_sid = str(datos.get("OriginalRepliedMessageSid") or "").strip()
    if not twilio_sid:
        return _sin_procesar("Sin OriginalRepliedMessageSid: nada que procesar")

    guid = _resolver_cliente(db_maestra, twilio_sid)
    if guid is None:
        return _sin_procesar(f"No hay recordatorio con el SID {twilio_sid}")

    with sesion_tenant(guid) as db:
        return EstadoDiarioService(db).webhook_twilio(datos)


def _sin_procesar(mensaje: str) -> dict:
    """Callback legítimo que no corresponde a ningún recordatorio nuestro.

    Mismo formato de respuesta que da el servicio cuando sí encuentra el
    cliente, para que Twilio vea siempre lo mismo.
    """
    logger.info("Webhook Twilio: %s", mensaje)
    return {"exito": True, "mensaje": mensaje}


def _resolver_cliente(db_maestra: Session, twilio_sid: str) -> Optional[str]:
    """Guid del cliente dueño del mensaje, o None si no lo reconoce nadie."""
    # La más reciente: `twilio_sid` no es único (ver el modelo), por el mismo
    # motivo por el que `find_by_twilio_sid` ordena igual del lado del cliente.
    envio = (
        db_maestra.query(WhatsappEnvio)
        .filter(WhatsappEnvio.twilio_sid == twilio_sid)
        .order_by(WhatsappEnvio.id.desc())
        .first()
    )
    if envio is not None:
        cliente = ClienteRepository(db_maestra).find_by_id(envio.cliente_id)
        if cliente is not None:
            return cliente.guid
        # La fila apunta a un cliente que ya no está: se cae al recorrido, que
        # como mucho no lo va a encontrar tampoco.
        logger.warning(
            "El envío %s apunta al cliente %s, que no existe", twilio_sid, envio.cliente_id
        )

    return _buscar_recorriendo_clientes(db_maestra, twilio_sid)


def _buscar_recorriendo_clientes(db_maestra: Session, twilio_sid: str) -> Optional[str]:
    """Respaldo: abre cada base de cliente hasta encontrar el SID.

    Es lo que hace funcionar los mensajes enviados antes de que existiera
    `whatsapp_envio`. Cuando encuentra el SID anota la fila que faltaba, así que
    cada mensaje viejo paga este recorrido una sola vez.

    Una base caída no puede dejar sin respuesta a un callback que quizá era de
    otro cliente: se registra y se sigue con el siguiente.
    """
    for cliente in ClienteRepository(db_maestra).find_activos():
        if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
            # Su base puede ni existir; intentar abrirla sería un error de
            # conexión por cada callback.
            continue
        try:
            with sesion_tenant(cliente.guid) as db:
                agenda = EstadoDiarioAgendaRepository(db).find_by_twilio_sid(twilio_sid)
                agenda_id = agenda.id if agenda else None
        except Exception:
            logger.exception(
                "No se pudo revisar la base del cliente %s buscando el SID %s",
                cliente.guid,
                twilio_sid,
            )
            continue

        if agenda_id is None:
            continue

        logger.info(
            "SID %s resuelto por recorrido: es del cliente %s", twilio_sid, cliente.guid
        )
        _anotar_envio_faltante(db_maestra, twilio_sid, cliente.cliente_id, agenda_id)
        return cliente.guid

    return None


def _anotar_envio_faltante(
    db_maestra: Session, twilio_sid: str, cliente_id: int, agenda_id: int
) -> None:
    """Rellena `whatsapp_envio` con lo que el recorrido acaba de averiguar.

    Que falle no cambia el resultado del callback, que ya está resuelto: solo
    significa que el próximo del mismo mensaje vuelve a recorrer.
    """
    try:
        db_maestra.add(WhatsappEnvio(
            twilio_sid=twilio_sid,
            cliente_id=cliente_id,
            agenda_id=agenda_id,
            fecha_envio=datetime.now(timezone.utc),
        ))
        db_maestra.commit()
    except Exception:
        db_maestra.rollback()
        logger.exception("No se pudo anotar el envío %s encontrado por recorrido", twilio_sid)
