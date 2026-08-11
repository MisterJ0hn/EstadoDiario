"""Cierre mensual de facturación: congela lo que se le cobra a cada cliente.

Uso:
    python -m app.jobs.cerrar_facturacion              # cierra el mes anterior
    python -m app.jobs.cerrar_facturacion --periodo 2026-07
    python -m app.jobs.cerrar_facturacion --rehacer    # sobrescribe el cierre

**Por qué es un job y no una consulta.** La cartera de causas es una foto que
se reemplaza con cada carga del Excel: el archivo de marzo ya no está en la
base en junio, así que el período de marzo no se puede recalcular después. El
día 1 se cuenta una vez y queda escrito (ver `FacturacionService`).

Corre sobre TODOS los clientes, activos y suspendidos: a un cliente suspendido
a mitad de mes igual hay que facturarle lo que usó, y el cierre es lo único que
lo deja registrado. Un cliente con la base caída queda con su fila en estado
`error` en vez de tumbar el cierre de los demás.

Es **idempotente**: un cliente que ya tiene cierre del período se salta, así
que si el cron se dispara dos veces el día 1 no se duplica ninguna factura.

Entrada en el crontab del host (el día 1 de cada mes, temprano):

    0 4 1 * * docker exec ed_backend python -m app.jobs.cerrar_facturacion >> /var/log/estado_diario_facturacion.log 2>&1
"""

import argparse
import logging
import sys
from datetime import date

from app.core.database import SesionMaestra
from app.core.logging_config import setup_logging
from app.models.maestra.facturacion_cierre import FacturacionCierre
from app.services.facturacion_service import FacturacionService, periodo_de

logger = logging.getLogger(__name__)


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
    parser = argparse.ArgumentParser(description="Cierre mensual de facturación")
    parser.add_argument(
        "--periodo",
        type=_parse_periodo,
        help="Mes a cerrar, AAAA-MM. Por defecto, el mes anterior a hoy.",
    )
    parser.add_argument(
        "--rehacer",
        action="store_true",
        help="Sobrescribe los cierres que ya existan del período. Solo tiene "
             "sentido el mismo día: después, el archivo de causas ya es otro.",
    )
    args = parser.parse_args(argv)

    setup_logging()
    periodo = args.periodo or periodo_de(date.today())

    db_maestra = SesionMaestra()
    try:
        cierres = FacturacionService(db_maestra).cerrar_periodo(periodo, args.rehacer)
    except Exception:
        logger.exception("El cierre de facturación de %s falló", periodo)
        return 1
    finally:
        db_maestra.close()

    con_problema = [c for c in cierres if c.estado == FacturacionCierre.ESTADO_ERROR]
    total = sum(float(c.monto or 0) for c in cierres)
    logger.info(
        "Período %s cerrado: %d clientes, $%s facturados, %d sin poder consultar",
        periodo, len(cierres), total, len(con_problema),
    )
    # Los clientes que no se pudieron consultar son un cierre incompleto, no un
    # cierre en cero: se devuelve error para que el cron lo reporte y alguien
    # lo repita con --rehacer.
    return 1 if con_problema else 0


if __name__ == "__main__":
    sys.exit(main())
