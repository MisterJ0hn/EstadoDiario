"""Facturación mensual: genera la factura de cada cliente por el mes que terminó.

Uso:
    python -m app.jobs.generar_facturacion              # factura el mes anterior
    python -m app.jobs.generar_facturacion --periodo 2026-07
    python -m app.jobs.generar_facturacion --rehacer    # anula y vuelve a emitir

**Por qué es un job y no una consulta.** La cartera de causas es una foto que se
reemplaza con cada carga del Excel: el archivo de marzo ya no está en la base en
junio, así que el período de marzo no se puede recalcular después. El día 1 se
cuenta una vez, se aplican las tarifas del cliente y la factura queda escrita
con su detalle (ver `FacturacionService`).

Corre sobre TODOS los clientes, activos y suspendidos: a un cliente suspendido a
mitad de mes igual hay que facturarle lo que usó, y la factura es lo único que
lo deja registrado.

Es **idempotente**: un cliente que ya tiene factura del período se salta, así
que si el cron se dispara dos veces el día 1 no se cobra dos veces. Además lo
respalda un índice único por cliente y período en la base.

Un cliente cuya base no se pudo consultar **no se factura** y el job termina con
código 1. Emitirle una factura en $0 gastaría un número del correlativo en un
documento que nadie debería mandar, y un mes en cero por caída se ve idéntico a
un mes sin causas. Lo que corresponde es arreglar la base y volver a correr el
job: los que ya tienen factura se saltan solos.

Entrada en el crontab del host (el día 1 de cada mes, temprano):

    0 4 1 * * docker exec ed_backend python -m app.jobs.generar_facturacion >> /var/log/estado_diario_facturacion.log 2>&1
"""

import argparse
import logging
import sys
from datetime import date

from app.core.database import SesionMaestra
from app.core.logging_config import setup_logging
from app.services.facturacion_service import FacturacionService, periodo_de

logger = logging.getLogger(__name__)

# Queda registrado como emisor de la factura. No es un nulo a propósito: "nadie
# la emitió" y "la emitió el proceso automático" son cosas distintas al auditar.
EMISOR = "proceso automático"


def _parse_periodo(valor: str) -> date:
    """`2026-07` o `2026-07-01` → el primer día de ese mes."""
    partes = valor.split("-")
    if len(partes) < 2:
        raise argparse.ArgumentTypeError("Formato esperado: AAAA-MM")
    try:
        return date(int(partes[0]), int(partes[1]), 1)
    except ValueError as e:
        raise argparse.ArgumentTypeError(f"Período inválido: {valor}") from e


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Facturación mensual")
    parser.add_argument(
        "--periodo",
        type=_parse_periodo,
        help="Mes a facturar, AAAA-MM. Por defecto, el mes anterior a hoy.",
    )
    parser.add_argument(
        "--rehacer",
        action="store_true",
        help="Anula la factura que ya exista del período y emite una nueva. Solo "
             "tiene sentido el mismo día: después, el archivo de causas ya es otro.",
    )
    args = parser.parse_args(argv)

    setup_logging()
    periodo = args.periodo or periodo_de(date.today())

    db_maestra = SesionMaestra()
    try:
        resultado = FacturacionService(db_maestra).generar_periodo(
            periodo, args.rehacer, generado_por=EMISOR
        )
    except Exception:
        logger.exception("La facturación de %s falló", periodo)
        return 1
    finally:
        db_maestra.close()

    logger.info(
        "Período %s facturado: %d facturas nuevas por $%s, %d ya existían, "
        "%d clientes sin poder consultar",
        periodo,
        len(resultado.generadas),
        resultado.total_generado,
        len(resultado.omitidas),
        len(resultado.con_error),
    )
    for cliente, motivo in resultado.con_error:
        logger.error("  sin facturar: %s (%s) — %s", cliente.nombre, cliente.guid, motivo)

    # Un cliente sin facturar es un período incompleto, no un período en cero:
    # se devuelve error para que el cron lo reporte y alguien vuelva a correrlo.
    return 1 if resultado.con_error else 0


if __name__ == "__main__":
    sys.exit(main())
