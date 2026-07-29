"""Revisión programada de la casilla de correo.

Uso:
    python -m app.jobs.revisar_correo          # respeta la hora configurada
    python -m app.jobs.revisar_correo --forzar # ejecuta de inmediato

La hora la fija el administrador desde la UI, no el crontab. Por eso el cron
invoca este comando cada 15 minutos y es el propio job el que decide si
corresponde correr: si todavía no llega la hora de hoy, o si ya hubo una
corrida programada después de esa hora, termina sin hacer nada.

Entrada sugerida en el crontab del host:

    */15 * * * * docker exec ed_backend python -m app.jobs.revisar_correo >> /var/log/estado_diario_correo.log 2>&1
"""

import argparse
import logging
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging_config import setup_logging
from app.repositories.configuracion_correo_repository import ConfiguracionCorreoRepository
from app.repositories.correo_log_repository import CorreoLogRepository
from app.services.correo_service import CorreoService

logger = logging.getLogger(__name__)


def _zona() -> ZoneInfo:
    try:
        return ZoneInfo(settings.TIMEZONE)
    except Exception:
        logger.warning("Zona horaria '%s' inválida; se usa UTC", settings.TIMEZONE)
        return ZoneInfo("UTC")


def corresponde_ejecutar(db) -> tuple[bool, str]:
    """Decide si toca correr ahora según la hora configurada."""
    config = ConfiguracionCorreoRepository(db).get_or_create()

    if not config.activo:
        return False, "La ingesta por correo está desactivada"
    if not config.hora_ejecucion:
        return False, "No hay hora de ejecución configurada"

    tz = _zona()
    ahora_local = datetime.now(tz)
    programada_local = ahora_local.replace(
        hour=config.hora_ejecucion.hour,
        minute=config.hora_ejecucion.minute,
        second=0,
        microsecond=0,
    )

    if ahora_local < programada_local:
        return False, f"Aún no son las {config.hora_ejecucion.strftime('%H:%M')}"

    # ¿Ya se corrió para el turno de hoy?
    if CorreoLogRepository(db).existe_corrida_desde(
        programada_local.astimezone(ZoneInfo("UTC")), disparo="programado"
    ):
        return False, "La revisión de hoy ya se ejecutó"

    return True, "Corresponde ejecutar"


def main() -> int:
    parser = argparse.ArgumentParser(description="Revisa la casilla e importa los estados diarios")
    parser.add_argument(
        "--forzar", action="store_true",
        help="Ignora la hora configurada y la corrida previa del día",
    )
    args = parser.parse_args()

    setup_logging()
    db = SessionLocal()
    try:
        if not args.forzar:
            procede, motivo = corresponde_ejecutar(db)
            if not procede:
                logger.info("Sin acción: %s", motivo)
                return 0

        resultado = CorreoService(db).revisar(disparo="programado")
        logger.info("Revisión programada: %s", resultado.get("mensaje"))
        return 0 if resultado.get("exito") else 1
    except Exception:
        logger.exception("La revisión programada falló")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
