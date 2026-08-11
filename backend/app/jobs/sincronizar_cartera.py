"""Cruza los reportes contra la cartera de todos los clientes.

Uso:
    python -m app.jobs.sincronizar_cartera                    # todos
    python -m app.jobs.sincronizar_cartera --guid <guid>      # uno solo
    python -m app.jobs.sincronizar_cartera --simular          # sin escribir

**Para qué existe si el cruce ya corre al importar.** Por lo que ya está
cargado: un cliente con años de estado diario y movimientos en la base nunca
pasó por el cruce, y sin este job habría que esperar a que llegue el próximo
Excel para que su cartera se complete. También sirve para rehacerlo después de
cambiar una regla.

Un cliente cuya base no responde no puede tumbar a los demás: se registra y se
sigue. Termina con código 1 si alguno falló, para que el cron lo reporte.

Correrlo dos veces seguidas no hace nada la segunda: el cruce solo escribe lo
que falta, así que es idempotente por construcción.
"""

import argparse
import logging
import sys

from app.core.database import SesionMaestra, sesion_tenant
from app.core.logging_config import setup_logging
from app.models.maestra.cliente import Cliente
from app.repositories.cliente_repository import ClienteRepository
from app.services.cartera_sync_service import CarteraSyncService

logger = logging.getLogger(__name__)


def _clientes(guid: str | None) -> list[Cliente]:
    db = SesionMaestra()
    try:
        todos = ClienteRepository(db).find_all()
        # Los que no terminaron de aprovisionarse se saltan: su base puede ni
        # existir todavía y el error no diría nada útil.
        listos = [c for c in todos if c.estado_aprovisionamiento == Cliente.APROV_LISTO]
        if guid:
            return [c for c in listos if c.guid == guid]
        return listos
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Cruza estado diario y movimientos contra la cartera"
    )
    parser.add_argument("--guid", help="Sincronizar solo este cliente.")
    parser.add_argument(
        "--simular",
        action="store_true",
        help="Informa qué haría sin escribir nada en la base.",
    )
    args = parser.parse_args(argv)

    setup_logging()
    clientes = _clientes(args.guid)
    if not clientes:
        logger.warning("No hay clientes que sincronizar%s", f" con guid {args.guid}" if args.guid else "")
        return 0

    con_error = 0
    for cliente in clientes:
        try:
            with sesion_tenant(cliente.guid) as db:
                resultado = CarteraSyncService(db).sincronizar()
                if args.simular:
                    db.rollback()
                else:
                    db.commit()
            logger.info(
                "%s (%s)%s: %s",
                cliente.nombre, cliente.guid,
                " [simulacion]" if args.simular else "",
                resultado,
            )
        except Exception as e:
            con_error += 1
            logger.exception("No se pudo sincronizar la cartera de %s: %s", cliente.guid, e)

    logger.info(
        "Cartera sincronizada en %d cliente(s), %d con error",
        len(clientes) - con_error, con_error,
    )
    return 1 if con_error else 0


if __name__ == "__main__":
    sys.exit(main())
