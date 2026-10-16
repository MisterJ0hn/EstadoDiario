"""Reasigna al abogado correcto los archivos que ya entraron por correo.

Hasta ahora todo lo que llegaba por la casilla de ingesta quedaba a nombre del
primer usuario activo del cliente (o de quien disparó la revisión), aunque el
Excel fuera de otro abogado. Desde ahora `CorreoService` asigna el archivo al
dueño del RUT que trae; este job hace lo mismo con lo que ya está cargado.

    python -m app.jobs.reasignar_importaciones_correo --ensayo   # no escribe nada
    python -m app.jobs.reasignar_importaciones_correo

Qué toca, por cada archivo de estado diario, movimientos o audiencias que
llegó por correo (el vínculo está en `correo_log.estado_diario_origen_id`):

- `estado_diario_origen.usuario_carga_id`, que es el dueño del archivo.
- Las filas de `audiencia` de ese archivo, que llevan el dueño denormalizado
  en `usuario_id`.

Lo que NO toca: los archivos manuales, las causas (la cartera es del estudio) y
`correo_log.usuario_id` (dueño de la casilla, no del archivo).

Un archivo se deja como está cuando su RUT no identifica a nadie, o a más de
uno. Una audiencia también se deja si el nuevo dueño ya tiene esa misma
audiencia (chocaría con el UNIQUE de deduplicación); se informa el conteo.

Es idempotente: tras la primera corrida no queda nada por cambiar.
"""

import argparse
import logging
import sys

from app.core.credenciales_pjud import usuario_dueno_de_rut
from app.core.database import SesionMaestra, sesion_tenant
from app.core.logging_config import setup_logging
from app.models.audiencia import Audiencia
from app.models.correo_log import CorreoLog, RESULTADO_IMPORTADO
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.maestra.cliente import Cliente

logger = logging.getLogger(__name__)

TIPOS = (
    EstadoDiarioOrigen.TIPO_ESTADO_DIARIO,
    EstadoDiarioOrigen.TIPO_MOVIMIENTOS,
    EstadoDiarioOrigen.TIPO_AUDIENCIAS,
)


def _migrar_cliente(cliente: Cliente, ensayo: bool) -> tuple[int, int, int]:
    """(archivos cambiados, audiencias movidas, audiencias en conflicto)."""
    cambiados = movidas = conflictos = 0

    with sesion_tenant(cliente.guid) as db:
        por_correo = (
            db.query(CorreoLog.estado_diario_origen_id)
            .filter(
                CorreoLog.resultado == RESULTADO_IMPORTADO,
                CorreoLog.estado_diario_origen_id.isnot(None),
            )
            .distinct()
        )
        origenes = (
            db.query(EstadoDiarioOrigen)
            .filter(
                EstadoDiarioOrigen.tipo.in_(TIPOS),
                EstadoDiarioOrigen.id.in_(por_correo),
            )
            .all()
        )

        for origen in origenes:
            dueno = usuario_dueno_de_rut(db, origen.rut)
            if dueno is None or dueno.id == origen.usuario_carga_id:
                continue

            cambiados += 1
            logger.info(
                "%s | origen %s (%s, RUT %s): usuario %s -> %s",
                cliente.nombre, origen.id, origen.tipo, origen.rut,
                origen.usuario_carga_id, dueno.id,
            )
            origen.usuario_carga_id = dueno.id

            if origen.tipo != EstadoDiarioOrigen.TIPO_AUDIENCIAS:
                continue

            # Las del dueño nuevo que ya existen, para no chocar con el UNIQUE.
            ya_tiene = {
                c for (c,) in db.query(Audiencia.clave_natural)
                .filter(Audiencia.usuario_id == dueno.id)
            }
            for aud in db.query(Audiencia).filter(
                Audiencia.estado_diario_origen_id == origen.id,
                Audiencia.usuario_id != dueno.id,
            ):
                if aud.clave_natural in ya_tiene:
                    conflictos += 1
                    continue
                aud.usuario_id = dueno.id
                ya_tiene.add(aud.clave_natural)
                movidas += 1

        if ensayo:
            db.rollback()
        else:
            db.commit()

    return cambiados, movidas, conflictos


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reasigna al abogado correcto los archivos importados por correo"
    )
    parser.add_argument(
        "--ensayo", action="store_true",
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

    total = [0, 0, 0]
    con_error = 0
    for cliente in clientes:
        try:
            for i, n in enumerate(_migrar_cliente(cliente, args.ensayo)):
                total[i] += n
        except Exception as e:
            # Un cliente con la base caída no puede frenar a los demás.
            con_error += 1
            logger.error("Cliente %s (%s): %s", cliente.nombre, cliente.guid, e)

    logger.info(
        "%d clientes | %d archivos %s | %d audiencias movidas | "
        "%d audiencias en conflicto (sin mover) | %d con error",
        len(clientes), total[0], "a cambiar" if args.ensayo else "reasignados",
        total[1], total[2], con_error,
    )
    return 1 if con_error else 0


if __name__ == "__main__":
    sys.exit(main())
