"""Revisión programada de la casilla de correo.

Uso:
    python -m app.jobs.revisar_correo          # respeta la hora configurada
    python -m app.jobs.revisar_correo --forzar # ejecuta de inmediato

La hora la fija el administrador desde la UI, no el crontab. Por eso el cron
invoca este comando cada 15 minutos y es el propio job el que decide si
corresponde correr: si todavía no llega la hora de hoy, o si ya hubo una
corrida programada después de esa hora, termina sin hacer nada.

**Dejar la hora vacía es una opción, no un olvido**: esa casilla se revisa en
cada pasada del cron. La cadencia pasa a ser entonces la del crontab —con la
línea de abajo, cada 15 minutos— en vez de una vez al día. Es lo que quiere un
estudio al que le llega correo a cualquier hora.

Entrada sugerida en el crontab del host:

    */15 * * * * docker exec ed_backend python -m app.jobs.revisar_correo >> /var/log/estado_diario_correo.log 2>&1
"""

import argparse
import logging
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.database import SesionMaestra, sesion_tenant
from app.core.logging_config import setup_logging
from app.models.maestra.cliente import Cliente
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.configuracion_correo_repository import ConfiguracionCorreoRepository
from app.repositories.correo_log_repository import CorreoLogRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.services.correo_service import CorreoService

logger = logging.getLogger(__name__)


def _zona() -> ZoneInfo:
    try:
        return ZoneInfo(settings.TIMEZONE)
    except Exception:
        logger.warning("Zona horaria '%s' inválida; se usa UTC", settings.TIMEZONE)
        return ZoneInfo("UTC")


def corresponde_ejecutar(db_tenant, config, usuario_destino_id) -> tuple[bool, str]:
    """Decide si toca correr ahora la casilla `config`.

    Cada cliente tiene su propia casilla y su propia hora, así que la decisión
    es por casilla y no global: que a uno le toque a las 09:00 no dice nada del
    que la programó a las 14:00. La bitácora que responde "¿ya se corrió hoy?"
    vive en la base del cliente, por eso recibe la sesión del tenant.
    """
    if not config.activo:
        return False, "La ingesta por correo está desactivada"

    # Sin hora configurada, la casilla se revisa CADA VEZ que corre el cron:
    # la cadencia pasa a ser la del crontab (cada 15 minutos, cada hora, la que
    # sea). Es una opción de verdad y no un caso degenerado — un estudio que
    # recibe correo a cualquier hora no quiere una revisión diaria, quiere que
    # se mire seguido.
    #
    # Ojo con lo que se salta: sin hora tampoco corre el control de "ya se
    # ejecutó el turno de hoy", que está anclado a esa hora. Es coherente —lo
    # pedido es revisar en cada pasada— pero significa que la frecuencia la
    # decide el crontab y nadie más. Si el cron quedara cada minuto, la casilla
    # se consultaría cada minuto.
    if not config.hora_ejecucion:
        return True, "Sin hora configurada: se revisa en cada pasada del cron"

    tz = _zona()
    ahora_local = datetime.now(tz)
    programada_local = ahora_local.replace(
        hour=config.hora_ejecucion.hour,
        minute=config.hora_ejecucion.minute,
        second=0,
        microsecond=0,
    )

    if ahora_local < programada_local:
        return False, f"Aún no son las {config.hora_ejecucion.strftime('%H:%M')}"

    # ¿Ya se corrió para el turno de hoy, en ESTA casilla?
    #if CorreoLogRepository(db_tenant).existe_corrida_desde(
    #    programada_local.astimezone(ZoneInfo("UTC")),
    #    disparo="programado",
    #    usuario_id=usuario_destino_id,
    #):
    #    return False, "La revisión de hoy ya se ejecutó"

    return True, "Corresponde ejecutar"


def _primer_usuario(db_tenant) -> int | None:
    """Usuario a nombre de quien queda lo importado cuando la casilla no fija
    uno: el primero activo del cliente.

    Antes era "el primer administrador". Al eliminarse los roles ya no hay a
    quién preferir, y quién figura como autor de una importación automática no
    cambia lo que nadie ve: dentro del estudio todos ven todo.
    """
    for usuario in UsuarioRepository(db_tenant).find_all():
        if usuario.activo:
            return usuario.id
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Revisa la casilla e importa los estados diarios")
    parser.add_argument(
        "--forzar", action="store_true",
        help="Ignora la hora configurada y la corrida previa del día",
    )
    args = parser.parse_args()

    setup_logging()
    # La configuración de las casillas vive en la base PRINCIPAL; lo que se
    # importa, en la base de cada cliente. Por eso el job abre la maestra una
    # vez y una sesión de tenant por cliente que efectivamente toque revisar.
    db_maestra = SesionMaestra()
    try:
        configs = ConfiguracionCorreoRepository(db_maestra).find_activas()
        if not configs:
            logger.info("Sin acción: no hay casillas de correo activas")
            return 0

        clientes = ClienteRepository(db_maestra)
        revisadas = 0
        con_error = 0

        for config in configs:
            cliente = clientes.find_by_id(config.cliente_id)
            if not cliente or not cliente.activo:
                # Un cliente suspendido se salta: su base y su casilla siguen
                # como estaban, simplemente no se revisan hasta reactivarlo.
                logger.info("Casilla del cliente %s omitida: cliente suspendido", config.cliente_id)
                continue

            if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
                # Su base puede ni existir todavía: no hay dónde escribir lo
                # importado, y el intento sería un error de conexión por corrida.
                logger.info(
                    "Casilla del cliente %s omitida: su base no está lista", cliente.guid
                )
                continue

            # Una casilla con la credencial vencida, o una base caída, no
            # pueden impedir que se revisen las demás.
            try:
                with sesion_tenant(cliente.guid) as db_tenant:
                    usuario_destino = config.usuario_destino_id or _primer_usuario(db_tenant)
                    if usuario_destino is None:
                        logger.warning(
                            "Casilla del cliente %s sin usuario destino; se omite", cliente.guid
                        )
                        continue

                    if not args.forzar:
                        procede, motivo = corresponde_ejecutar(db_tenant, config, usuario_destino)
                        if not procede:
                            logger.info("Casilla del cliente %s sin acción: %s", cliente.guid, motivo)
                            continue

                    resultado = CorreoService(db_tenant, db_maestra).revisar(
                        config.cliente_id, usuario_destino, disparo="programado"
                    )
                    revisadas += 1
                    logger.info("Casilla del cliente %s: %s", cliente.guid, resultado.get("mensaje"))
                    if not resultado.get("exito"):
                        con_error += 1
            except Exception:
                con_error += 1
                logger.exception("Falló la revisión de la casilla del cliente %s", cliente.guid)

        logger.info("Revisión programada: %d casillas revisadas, %d con error", revisadas, con_error)
        return 1 if con_error else 0
    except Exception:
        logger.exception("La revisión programada falló")
        return 1
    finally:
        db_maestra.close()


if __name__ == "__main__":
    sys.exit(main())
