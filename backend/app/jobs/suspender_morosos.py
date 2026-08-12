"""Suspende a los clientes con facturas impagas más viejas que el plazo fijado.

Uso:
    python -m app.jobs.suspender_morosos --simular   # dice a quién afectaría
    python -m app.jobs.suspender_morosos

El plazo se configura en **Administración → Configuración** (`días de mora`), no
acá: es una decisión comercial y tiene que poder cambiarse sin desplegar.

**Con el plazo en 0 el job no hace nada**, que es el estado por defecto. Cortarle
el acceso a un estudio es lo más agresivo que hace el sistema —sus abogados no
pueden entrar, la ingesta por correo lo salta y no salen sus recordatorios— así
que hay que encenderlo a propósito.

**No reactiva a nadie.** Pagar no levanta la suspensión sola: un cliente puede
estar suspendido por otro motivo y reactivarlo automáticamente sería revertir una
decisión que nadie tomó acá.

Entrada en el crontab del host, una vez al día:

    30 5 * * * docker exec ed_backend python -m app.jobs.suspender_morosos >> /var/log/estado_diario_mora.log 2>&1
"""

import argparse
import logging
import sys

from app.core.database import SesionMaestra
from app.core.logging_config import setup_logging
from app.services.mora_service import MoraService

logger = logging.getLogger(__name__)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Suspensión automática por mora")
    parser.add_argument(
        "--simular",
        action="store_true",
        help="Informa a quién suspendería, sin tocar la base.",
    )
    args = parser.parse_args(argv)

    setup_logging()
    db = SesionMaestra()
    try:
        morosos, umbral = MoraService(db).suspender_en_mora(simular=args.simular)
    except Exception:
        logger.exception("La revisión de mora falló")
        return 1
    finally:
        db.close()

    if umbral <= 0:
        logger.info(
            "Suspensión por mora apagada: fije los días en Administración → Configuración"
        )
        return 0

    logger.info(
        "Mora a %d días: %d cliente(s) %s",
        umbral, len(morosos),
        "que se suspenderían" if args.simular else "suspendidos",
    )
    for m in morosos:
        logger.info("  %s", m)
    return 0


if __name__ == "__main__":
    sys.exit(main())
