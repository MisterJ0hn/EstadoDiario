"""Envío programado de recordatorios por WhatsApp (Twilio).

Uso:
    python -m app.jobs.enviar_recordatorios_whatsapp           # normal
    python -m app.jobs.enviar_recordatorios_whatsapp --forzar  # idéntico,
        no hay "hora configurada" que ignorar: el job siempre revisa qué
        recordatorios ya llegaron a su fecha_hora_whatsapp. --forzar se deja
        por simetría con revisar_correo.py y para uso manual explícito.

Entrada sugerida en el crontab del host (cada 5 minutos):

    */5 * * * * docker exec ed_backend python -m app.jobs.enviar_recordatorios_whatsapp >> /var/log/estado_diario_whatsapp.log 2>&1
"""

import argparse
import logging
import sys

from app.core.database import SessionLocal
from app.core.logging_config import setup_logging
from app.services.whatsapp_service import WhatsappService

logger = logging.getLogger(__name__)


def main() -> int:
    parser = argparse.ArgumentParser(description="Envía los recordatorios de WhatsApp vencidos")
    parser.add_argument("--forzar", action="store_true", help="Sin efecto adicional; ver docstring")
    parser.parse_args()

    setup_logging()
    db = SessionLocal()
    try:
        resultado = WhatsappService(db).enviar_pendientes()
        logger.info("Envío de WhatsApp: %s", resultado.get("mensaje"))
        return 0 if resultado.get("exito") else 1
    except Exception:
        logger.exception("El envío de recordatorios por WhatsApp falló")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
