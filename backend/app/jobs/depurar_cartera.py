"""Deja la cartera de cada cliente con una sola versión por abogado.

Uso:
    python -m app.jobs.depurar_cartera --simular           # cuenta, sin escribir
    python -m app.jobs.depurar_cartera --guid <guid>       # un solo cliente
    python -m app.jobs.depurar_cartera                     # todos, escribe

Corre UNA vez después de desplegar el importador que actualiza la cartera por
RUT. Ver `cartera_depuracion_service` para la regla. **Corra primero con
`--simular`** y revise cuántas filas borra: es lo único destructivo.

Es idempotente. Un cliente cuya base no responde no tumba a los demás; termina
con código 1 si alguno falló.
"""

import argparse
import logging
import sys

from app.core.database import SesionMaestra, sesion_tenant
from app.core.logging_config import setup_logging
from app.models.maestra.cliente import Cliente
from app.repositories.cliente_repository import ClienteRepository
from app.services.cartera_depuracion_service import depurar_versiones_anteriores

logger = logging.getLogger(__name__)


def _clientes(guid: str | None) -> list[Cliente]:
    db = SesionMaestra()
    try:
        listos = [
            c for c in ClienteRepository(db).find_all()
            if c.estado_aprovisionamiento == Cliente.APROV_LISTO
        ]
        return [c for c in listos if c.guid == guid] if guid else listos
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Depura las versiones viejas de la cartera")
    parser.add_argument("--guid", help="Depurar solo este cliente.")
    parser.add_argument("--simular", action="store_true", help="Informa sin escribir.")
    args = parser.parse_args(argv)

    setup_logging()
    con_error = 0
    for cliente in _clientes(args.guid):
        try:
            with sesion_tenant(cliente.guid) as db:
                resumen = depurar_versiones_anteriores(db)
                if args.simular:
                    db.rollback()
                else:
                    db.commit()
            logger.info(
                "%s (%s)%s: %s", cliente.nombre, cliente.guid,
                " [simulacion]" if args.simular else "", resumen,
            )
        except Exception as e:
            con_error += 1
            logger.exception("No se pudo depurar la cartera de %s: %s", cliente.guid, e)
    return 1 if con_error else 0


if __name__ == "__main__":
    sys.exit(main())
