"""Configuración de plataforma y purga manual de la bitácora.

La política de permanencia de `log_actividades` es global (una sola política
para todos los clientes) con override opcional por cliente. La purga normal la
corre el job `app.jobs.purgar_logs`; lo de acá es el botón "purgar ahora" de la
consola, que hace exactamente lo mismo sin esperar al cron.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.database import sesion_tenant
from app.models.maestra.cliente import Cliente
from app.repositories.cliente_repository import ClienteRepository
from app.services.mora_service import MoraService
from app.repositories.configuracion_sistema_repository import ConfiguracionSistemaRepository
from app.repositories.log_actividades_repository import LogActividadesRepository
from admin_api.app.schemas.cliente import (
    ConfiguracionSistemaResponse,
    ConfiguracionSistemaUpdate,
    OperacionResponse,
)

logger = logging.getLogger(__name__)


class ConfiguracionSistemaService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.repo = ConfiguracionSistemaRepository(db_maestra)
        self.clientes = ClienteRepository(db_maestra)

    def obtener(self) -> ConfiguracionSistemaResponse:
        config = self.repo.get_or_create()
        registros, a_purgar = self._conteos(config.dias_retencion_log)
        return ConfiguracionSistemaResponse(
            retencion_log_dias=config.dias_retencion_log,
            dias_mora_suspension=config.dias_mora_suspension or 0,
            clientes_en_mora=len(MoraService(self.db).en_mora()),
            tarifa_materia=config.tarifa_materia,
            tarifa_apelaciones=config.tarifa_apelaciones,
            tarifa_suprema=config.tarifa_suprema,
            ultima_purga=config.ultima_purga,
            registros_log=registros,
            registros_a_purgar=a_purgar,
        )

    def guardar(
        self, datos: ConfiguracionSistemaUpdate, admin_id: int
    ) -> ConfiguracionSistemaResponse:
        """Guarda la política y devuelve el estado recalculado.

        Recalcular no es un lujo: acortar el plazo cambia cuántos registros
        quedarían fuera, y la pantalla tiene que mostrar ese número nuevo sin
        pedirlo aparte.
        """
        config = self.repo.get_or_create()
        config.dias_retencion_log = datos.retencion_log_dias
        config.dias_mora_suspension = datos.dias_mora_suspension
        # Rigen desde la próxima facturación: cada factura ya emitida copió el
        # valor unitario que usó, así que subir el precio no reescribe el pasado.
        config.tarifa_materia = datos.tarifa_materia
        config.tarifa_apelaciones = datos.tarifa_apelaciones
        config.tarifa_suprema = datos.tarifa_suprema
        config.modificado_por = admin_id
        self.repo.save(config)
        logger.info(
            "Configuración del sistema actualizada (retención de log: %d días, "
            "mora: %d días)",
            config.dias_retencion_log, config.dias_mora_suspension,
        )
        return self.obtener()

    def _conteos(self, dias_globales: int) -> tuple[int, int]:
        """Registros de bitácora y cuántos purgaría la política, sumando todos
        los clientes.

        Son bases distintas: no hay un SELECT que las cuente juntas. Un cliente
        con la base caída no puede dejar la pantalla sin cargar, así que se lo
        omite y el total queda corto —es un número para dimensionar, no una
        cifra contable.
        """
        registros = 0
        a_purgar = 0
        for cliente in self._clientes_con_base():
            dias = cliente.dias_retencion_log or dias_globales
            try:
                with sesion_tenant(cliente.guid) as db_tenant:
                    repo = LogActividadesRepository(db_tenant)
                    registros += repo.contar()
                    a_purgar += repo.contar_a_purgar(dias)
            except Exception as e:
                logger.warning(
                    "No se pudo contar la bitácora del cliente %s: %s", cliente.guid, e
                )
        return registros, a_purgar

    def _clientes_con_base(self) -> list[Cliente]:
        """Activos y con la base ya creada: los únicos a los que se les puede
        abrir una sesión."""
        return [
            c
            for c in self.clientes.find_activos()
            if c.estado_aprovisionamiento == Cliente.APROV_LISTO
        ]

    def purgar_logs(self) -> OperacionResponse:
        """Aplica la política de permanencia ahora mismo, cliente por cliente.

        Los suspendidos quedan fuera: su base no se toca hasta que se
        reactiven. Un cliente con la base caída no puede impedir que se purgue
        el resto, así que cada uno va en su propio try.
        """
        config = self.repo.get_or_create()
        global_dias = config.dias_retencion_log
        procesados = 0
        eliminados = 0
        con_error = 0

        for cliente in self._clientes_con_base():
            dias = cliente.dias_retencion_log or global_dias
            try:
                with sesion_tenant(cliente.guid) as db_tenant:
                    eliminados += LogActividadesRepository(db_tenant).purgar(dias)
                procesados += 1
            except Exception:
                con_error += 1
                logger.exception("Falló la purga del cliente %s", cliente.guid)

        # Queda registrada aunque alguna base haya fallado: la purga sí corrió,
        # y la pantalla necesita distinguir "nunca se purgó" de "se purgó y
        # algunos clientes dieron error".
        config.ultima_purga = datetime.now(timezone.utc)
        self.repo.save(config)

        mensaje = f"{eliminados} registros eliminados en {procesados} clientes"
        if con_error:
            mensaje += f" ({con_error} con error, revise el log)"

        return OperacionResponse(exito=con_error == 0, mensaje=mensaje)
