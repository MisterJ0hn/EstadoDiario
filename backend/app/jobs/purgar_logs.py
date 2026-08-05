"""Purga de la bitácora de actividad, según la política de cada cliente.

Uso:
    python -m app.jobs.purgar_logs

`log_actividades` registra una fila por acción y crece rápido. La ventana de
permanencia es global (`configuracion_sistema.dias_retencion_log`, que fija el
administrador en /api/v1/admin/configuracion/sistema) y cada cliente puede
tener su propio override en la ficha. Este job aplica la que corresponda,
borrando lo más viejo base por base.

Se salta los clientes suspendidos: su base queda tal cual, sin tocarle nada.

Entrada sugerida en el crontab del host (una vez al día, de madrugada):

    30 3 * * * docker exec ed_backend python -m app.jobs.purgar_logs >> /var/log/estado_diario_purga.log 2>&1
"""

import logging
import sys

from app.core.database import SesionMaestra
from app.core.logging_config import setup_logging
from app.services.configuracion_sistema_service import ConfiguracionSistemaService

logger = logging.getLogger(__name__)


def main() -> int:
    setup_logging()
    db_maestra = SesionMaestra()
    try:
        # Misma rutina que el botón "purgar ahora" de la consola: una sola
        # implementación para las dos formas de dispararla.
        resultado = ConfiguracionSistemaService(db_maestra).purgar_logs()
        logger.info("Purga de bitácoras: %s", resultado.mensaje)
        return 0 if resultado.exito else 1
    except Exception:
        logger.exception("La purga de bitácoras falló")
        return 1
    finally:
        db_maestra.close()


if __name__ == "__main__":
    sys.exit(main())
