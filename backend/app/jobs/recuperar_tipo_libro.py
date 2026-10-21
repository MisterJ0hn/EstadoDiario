"""Recupera `tipo_libro` en las causas de corte que se cargaron antes de que
existiera la columna.

Uso:
    python -m app.jobs.recuperar_tipo_libro                    # todos
    python -m app.jobs.recuperar_tipo_libro --guid <guid>      # uno solo
    python -m app.jobs.recuperar_tipo_libro --simular          # sin escribir

**Por qué no relee los Excel.** El archivo que se sube queda en `uploads/` con
un nombre al azar y nada en la base lo liga a su `estado_diario_origen`, así
que no hay forma segura de saber qué archivo dio qué fila. No hace falta: el
importador guardó el texto original del rol (`numero_ingreso` en el estado
diario, `rol` en Movimientos y Causas), que es de donde sale el tipo de libro
("Civil" en "Civil-1620-2026"). Se aplica sobre eso la misma regla que usa la
importación (`tipo_libro_de`).

Pasos, en este orden:
1. `estado_diario_corte`: desde `numero_ingreso`.
2. `movimiento_corte` y `causa_corte`: desde `rol`, si trae el prefijo.
3. Lo que siga vacío se completa cruzando por (tipo, rol, era, corte) con las
   filas de las otras dos tablas que sí lo tienen. Es el mismo cruce que hace
   la cartera al importar: el Estado Diario es el que trae el prefijo en el
   número de ingreso, y los otros dos reportes lo heredan.

Solo escribe donde `tipo_libro` es nulo: no pisa nada, así que correrlo dos
veces seguidas no cambia nada la segunda. Un cliente cuya base no responde no
tumba a los demás; termina con código 1 si alguno falló.
"""

import argparse
import logging
import re
import sys
from typing import Optional

from sqlalchemy.orm import Session

from app.core.database import SesionMaestra, sesion_tenant
from app.core.logging_config import setup_logging
from app.models.causa_corte import CausaCorte
from app.models.estado_diario_corte import EstadoDiarioCorte
from app.models.maestra.cliente import Cliente
from app.models.movimiento_corte import MovimientoCorte
from app.repositories.cliente_repository import ClienteRepository
from app.services.cartera_sync_service import tipo_libro_de

logger = logging.getLogger(__name__)

_NUMERO = re.compile(r"(\d+)")
_ANIO = re.compile(r"(\d{4})")
# `Civil-2786-2026`: el número de ingreso del estado diario trae rol y era.
_NUMERO_INGRESO = re.compile(r"^\s*.+?-\s*(\d+)\s*-\s*(\d{4})\s*$")


def _clave(tipo: Optional[str], rol: Optional[str], era: Optional[str], corte: Optional[str]) -> Optional[tuple]:
    """(tipo, rol sin ceros ni prefijo, año, corte). None si no hay rol."""
    m = _NUMERO.search(rol or "")
    if not m:
        return None
    a = _ANIO.search(era or "")
    return (
        (tipo or "").strip().lower(),
        str(int(m.group(1))),
        a.group(1) if a else "",
        (corte or "").strip().lower(),
    )


def _clave_estado_diario(fila: EstadoDiarioCorte) -> Optional[tuple]:
    m = _NUMERO_INGRESO.match(fila.numero_ingreso or "")
    if not m:
        return None
    return _clave(fila.tipo, m.group(1), m.group(2), fila.corte)


def recuperar(db: Session) -> dict:
    """Completa `tipo_libro` en las tres tablas de corte. No hace commit."""
    res = {"estado_diario_corte": 0, "movimiento_corte": 0, "causa_corte": 0, "sin_dato": 0}
    conocidos: dict[tuple, str] = {}

    # 1. Estado diario: el prefijo del número de ingreso.
    for f in db.query(EstadoDiarioCorte).all():
        if not f.tipo_libro:
            f.tipo_libro = tipo_libro_de(f.numero_ingreso)
            if f.tipo_libro:
                res["estado_diario_corte"] += 1
        clave = _clave_estado_diario(f)
        if f.tipo_libro and clave:
            conocidos.setdefault(clave, f.tipo_libro)

    # 2. Movimientos y Causas: el prefijo del rol, si lo trae.
    pendientes: list[tuple[str, object]] = []
    for nombre, modelo in (("movimiento_corte", MovimientoCorte), ("causa_corte", CausaCorte)):
        for f in db.query(modelo).all():
            if not f.tipo_libro:
                f.tipo_libro = tipo_libro_de(f.rol)
                if f.tipo_libro:
                    res[nombre] += 1
            clave = _clave(f.tipo, f.rol, f.era, f.corte)
            if f.tipo_libro:
                if clave:
                    conocidos.setdefault(clave, f.tipo_libro)
            else:
                pendientes.append((nombre, f))

    # 3. Lo que siga vacío, por el cruce con las filas que sí lo tienen.
    for nombre, f in pendientes:
        clave = _clave(f.tipo, f.rol, f.era, f.corte)
        valor = conocidos.get(clave) if clave else None
        if valor:
            f.tipo_libro = valor
            res[nombre] += 1
        else:
            res["sin_dato"] += 1
    db.flush()
    return res


def _clientes(guid: Optional[str]) -> list[Cliente]:
    db = SesionMaestra()
    try:
        todos = ClienteRepository(db).find_all()
        listos = [c for c in todos if c.estado_aprovisionamiento == Cliente.APROV_LISTO]
        return [c for c in listos if c.guid == guid] if guid else listos
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Recupera tipo_libro en las causas de corte ya cargadas"
    )
    parser.add_argument("--guid", help="Recuperar solo este cliente.")
    parser.add_argument(
        "--simular", action="store_true",
        help="Informa cuántas filas completaría sin escribir nada en la base.",
    )
    args = parser.parse_args(argv)

    setup_logging()
    clientes = _clientes(args.guid)
    if not clientes:
        logger.warning("No hay clientes%s", f" con guid {args.guid}" if args.guid else "")
        return 0

    con_error = 0
    for cliente in clientes:
        try:
            with sesion_tenant(cliente.guid) as db:
                res = recuperar(db)
                if args.simular:
                    db.rollback()
                else:
                    db.commit()
            logger.info(
                "%s (%s)%s: %s", cliente.nombre, cliente.guid,
                " [simulacion]" if args.simular else "", res,
            )
        except Exception as e:
            con_error += 1
            logger.exception("No se pudo recuperar tipo_libro de %s: %s", cliente.guid, e)

    logger.info(
        "tipo_libro recuperado en %d cliente(s), %d con error",
        len(clientes) - con_error, con_error,
    )
    return 1 if con_error else 0


if __name__ == "__main__":
    sys.exit(main())
