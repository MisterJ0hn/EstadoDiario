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

from app.core.database import SesionMaestra, sesion_tenant
from app.core.logging_config import setup_logging
from app.models.maestra.cliente import Cliente
from app.repositories.cliente_repository import ClienteRepository
from app.services.whatsapp_service import WhatsappService

logger = logging.getLogger(__name__)


def main() -> int:
    parser = argparse.ArgumentParser(description="Envía los recordatorios de WhatsApp vencidos")
    parser.add_argument("--forzar", action="store_true", help="Sin efecto adicional; ver docstring")
    parser.parse_args()

    setup_logging()
    # Los recordatorios viven en la base de cada cliente: hay que recorrerlos
    # todos. Un cliente con la base caída no puede dejar sin enviar a los demás.
    # find_activos() deja fuera a los suspendidos: sus recordatorios quedan
    # guardados y sin enviar hasta que se reactive el cliente.
    db_maestra = SesionMaestra()
    con_error = 0
    try:
        for cliente in ClienteRepository(db_maestra).find_activos():
            if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
                # Su base puede ni existir: intentar abrirla sería un error de
                # conexión por cada corrida del cron, cada cinco minutos.
                continue
            try:
                with sesion_tenant(cliente.guid) as db_tenant:
                    resultado = WhatsappService(db_tenant, db_maestra).enviar_pendientes()
                logger.info("WhatsApp del cliente %s: %s", cliente.guid, resultado.get("mensaje"))
                if not resultado.get("exito"):
                    con_error += 1
            except Exception:
                con_error += 1
                logger.exception("Falló el envío de WhatsApp del cliente %s", cliente.guid)
        return 1 if con_error else 0
    except Exception:
        logger.exception("El envío de recordatorios por WhatsApp falló")
        return 1
    finally:
        db_maestra.close()


if __name__ == "__main__":
    sys.exit(main())
