"""Vuelve a dibujar el PDF de las facturas ya emitidas, con el diseño vigente.

Uso:
    python -m app.jobs.redibujar_facturas --simular     # dice qué haría
    python -m app.jobs.redibujar_facturas
    python -m app.jobs.redibujar_facturas --desde 2026-01 --hasta 2026-07
    python -m app.jobs.redibujar_facturas --numero 42 --numero 43

**Es un job de mantenimiento, no una rutina.** No va al crontab: se corre a mano
cuando cambia el diseño del documento y hay facturas viejas que quedaron con el
anterior. El resto del tiempo, el PDF de una factura se escribe una sola vez —al
emitirla— y no se regenera al descargarlo, que es lo que garantiza que la copia
del correo del cliente y la que descarga hoy sean el mismo archivo.

**Qué cambia y qué no.** El documento se redibuja a partir de la factura tal
como está guardada: el número, la razón social, el RUT, las líneas, las
cantidades, los valores unitarios y el total salen de la base y no se
recalculan. Lo único que cambia es el dibujo. Una factura no puede cambiar de
monto por correr esto.

**Qué implica igual.** Reescribe el PDF de documentos ya entregados: el cliente
que guardó el suyo tendrá un archivo distinto —mismo contenido, otra
presentación— al que descargue después. Por eso `--simular` existe y conviene
usarlo primero.

Las facturas sin PDF guardado se saltan: no hay uno que reemplazar y fabricarlo
acá es distinto de reemplazarlo. Esas se resuelven regenerando el período.
"""

import argparse
import logging
import sys
from datetime import date

from app.core.database import SesionMaestra
from app.core.logging_config import setup_logging
from app.models.maestra.factura import Factura
from app.services import factura_pdf
from app.services.facturacion_service import datos_pdf

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
    parser = argparse.ArgumentParser(
        description="Redibuja el PDF de las facturas emitidas"
    )
    parser.add_argument(
        "--simular", action="store_true",
        help="No escribe nada: lista qué facturas se redibujarían.",
    )
    parser.add_argument("--desde", type=_parse_periodo, help="Período mínimo, AAAA-MM.")
    parser.add_argument("--hasta", type=_parse_periodo, help="Período máximo, AAAA-MM.")
    parser.add_argument(
        "--numero", type=int, action="append",
        help="Solo estos números de factura. Se puede repetir.",
    )
    args = parser.parse_args(argv)

    setup_logging()

    db = SesionMaestra()
    try:
        consulta = db.query(Factura).order_by(Factura.numero)
        if args.desde:
            consulta = consulta.filter(Factura.periodo >= args.desde)
        if args.hasta:
            consulta = consulta.filter(Factura.periodo <= args.hasta)
        if args.numero:
            consulta = consulta.filter(Factura.numero.in_(args.numero))

        facturas = consulta.all()
        if not facturas:
            logger.warning("No hay facturas que coincidan con el filtro")
            return 0

        redibujadas = 0
        sin_pdf = 0
        con_error: list[tuple[str, str]] = []

        for factura in facturas:
            if not factura.pdf:
                sin_pdf += 1
                logger.info(
                    "  %s (%s): sin PDF guardado, se salta",
                    factura.numero_formateado, factura.periodo,
                )
                continue

            antes = len(factura.pdf)
            if args.simular:
                logger.info(
                    "  %s (%s, %s): se redibujaria, %d bytes actuales",
                    factura.numero_formateado, factura.periodo, factura.estado, antes,
                )
                redibujadas += 1
                continue

            try:
                factura.pdf = factura_pdf.generar(datos_pdf(factura))
            except Exception as e:  # noqa: BLE001
                # Una factura que no se puede dibujar no puede llevarse las
                # demás: se anota y se sigue. El commit del final conserva las
                # que sí salieron.
                logger.exception(
                    "  %s: no se pudo redibujar", factura.numero_formateado
                )
                con_error.append((factura.numero_formateado, str(e)))
                continue

            # Sin flechas ni comillas tipográficas: la consola de Windows es
            # cp1252 y un carácter fuera de esa tabla revienta el handler.
            logger.info(
                "  %s (%s, %s): %d -> %d bytes",
                factura.numero_formateado, factura.periodo, factura.estado,
                antes, len(factura.pdf),
            )
            redibujadas += 1

        if args.simular:
            db.rollback()
            logger.info(
                "Simulación: %d factura(s) se redibujarían, %d sin PDF. No se escribió nada.",
                redibujadas, sin_pdf,
            )
            return 0

        db.commit()
    finally:
        db.close()

    logger.info(
        "Redibujadas %d factura(s), %d sin PDF, %d con error",
        redibujadas, sin_pdf, len(con_error),
    )
    for numero, motivo in con_error:
        logger.error("  falló %s — %s", numero, motivo)

    return 1 if con_error else 0


if __name__ == "__main__":
    sys.exit(main())
