"""Deja a los usuarios existentes con UN nombre y UN apellido.

Desde ahora `nombre` y `apellido` no admiten espacios (ver
`validar_palabra_unica` en `app/schemas/usuario.py`), pero los usuarios que ya
están en las bases se cargaron sin esa regla: hay filas con "Juan Carlos" en
`nombre`, con el nombre completo en `nombre` y `apellido` vacío, y con dos
apellidos.

Este job recorre TODAS las bases de cliente y las normaliza. Es de un solo uso,
pero es **idempotente**: correrlo dos veces no cambia nada la segunda, porque lo
ya separado no tiene espacios.

    python -m app.jobs.separar_nombre_apellido --ensayo   # no escribe nada
    python -m app.jobs.separar_nombre_apellido

**Cómo separa, y por qué así.** El caso ambiguo real es "Ana Maria Perez
Gonzalez": no hay forma de saber si son dos nombres y dos apellidos, o uno y
tres. Las reglas:

- Si hay `apellido`, cada campo se resuelve por su lado: se queda la PRIMERA
  palabra de `nombre` y la PRIMERA de `apellido`. Quien tenía "Perez Gonzalez"
  queda como "Perez", que es el apellido con el que se le nombra.
- Si `apellido` está vacío, el campo `nombre` traía el nombre completo: la
  primera palabra es el nombre y la SEGUNDA el apellido. La segunda y no la
  última, porque "Juan Carlos Perez" es mucho más común que "Juan Perez
  Gonzalez" escrito así, y equivocarse hacia el primer apellido es preferible a
  dejar a alguien apellidado "Carlos".

Lo descartado se registra en el log: si a alguien le importa su segundo
apellido, queda constancia de qué se sacó y se puede corregir a mano.
"""

import argparse
import logging
import sys

from app.core.database import SesionMaestra, sesion_tenant
from app.core.logging_config import setup_logging
from app.models.maestra.cliente import Cliente
from app.repositories.usuario_repository import UsuarioRepository

logger = logging.getLogger(__name__)


def separar(nombre: str | None, apellido: str | None) -> tuple[str | None, str | None]:
    """(nombre, apellido) con una sola palabra cada uno. Ver el docstring."""
    partes_nombre = (nombre or "").split()
    partes_apellido = (apellido or "").split()

    if partes_apellido:
        return (
            partes_nombre[0] if partes_nombre else None,
            partes_apellido[0],
        )

    # Sin apellido: todo venía junto en `nombre`.
    if len(partes_nombre) >= 2:
        return partes_nombre[0], partes_nombre[1]
    if partes_nombre:
        return partes_nombre[0], None
    return None, None


def _migrar_cliente(cliente: Cliente, ensayo: bool) -> tuple[int, int]:
    """(revisados, cambiados) de un cliente."""
    revisados = cambiados = 0

    with sesion_tenant(cliente.guid) as db:
        repo = UsuarioRepository(db)
        for usuario in repo.find_all():
            revisados += 1
            nuevo_nombre, nuevo_apellido = separar(usuario.nombre, usuario.apellido)
            if (nuevo_nombre, nuevo_apellido) == (usuario.nombre, usuario.apellido):
                continue

            cambiados += 1
            logger.info(
                "%s | %s: (%r, %r) -> (%r, %r)",
                cliente.nombre,
                usuario.usuario,
                usuario.nombre,
                usuario.apellido,
                nuevo_nombre,
                nuevo_apellido,
            )
            if not ensayo:
                usuario.nombre = nuevo_nombre
                usuario.apellido = nuevo_apellido

        if ensayo:
            db.rollback()
        else:
            db.commit()

    return revisados, cambiados


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Separa nombre y apellido de los usuarios existentes"
    )
    parser.add_argument(
        "--ensayo",
        action="store_true",
        help="Muestra qué cambiaría sin escribir nada en ninguna base",
    )
    args = parser.parse_args()

    setup_logging()
    if args.ensayo:
        logger.info("ENSAYO: no se escribe nada")

    db_maestra = SesionMaestra()
    try:
        clientes = db_maestra.query(Cliente).all()
    finally:
        db_maestra.close()

    total_revisados = total_cambiados = 0
    con_error = 0

    for cliente in clientes:
        try:
            revisados, cambiados = _migrar_cliente(cliente, args.ensayo)
        except Exception as e:
            # Un cliente con la base caída no puede frenar a los demás.
            con_error += 1
            logger.error("Cliente %s (%s): %s", cliente.nombre, cliente.guid, e)
            continue
        total_revisados += revisados
        total_cambiados += cambiados

    logger.info(
        "%d clientes | %d usuarios revisados | %d %s | %d con error",
        len(clientes),
        total_revisados,
        total_cambiados,
        "a cambiar" if args.ensayo else "cambiados",
        con_error,
    )
    return 1 if con_error else 0


if __name__ == "__main__":
    sys.exit(main())
