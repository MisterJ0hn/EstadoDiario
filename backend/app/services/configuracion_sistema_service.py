"""Purga de la bitácora de actividad, según la política de cada cliente.

**Editar la política es de la consola de administración** (`admin_app/`); lo
que quedó acá es aplicarla, que es trabajo del backend: el job nocturno
`app.jobs.purgar_logs` recorre las bases de los clientes y borra lo vencido.

La política es global (`configuracion_sistema.dias_retencion_log`) con override
opcional por cliente (`cliente.dias_retencion_log`).
"""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.database import sesion_tenant
from app.models.maestra.cliente import Cliente
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.configuracion_sistema_repository import ConfiguracionSistemaRepository
from app.repositories.log_actividades_repository import LogActividadesRepository
from app.schemas.comunes import OperacionResponse

logger = logging.getLogger(__name__)


class ConfiguracionSistemaService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.repo = ConfiguracionSistemaRepository(db_maestra)
        self.clientes = ClienteRepository(db_maestra)

    def purgar_logs(self) -> OperacionResponse:
        """Aplica la política de permanencia, cliente por cliente.

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
        # y la consola necesita distinguir "nunca se purgó" de "se purgó y
        # algunos clientes dieron error".
        config.ultima_purga = datetime.now(timezone.utc)
        self.repo.save(config)

        mensaje = f"{eliminados} registros eliminados en {procesados} clientes"
        if con_error:
            mensaje += f" ({con_error} con error, revise el log)"

        return OperacionResponse(exito=con_error == 0, mensaje=mensaje)

    def _clientes_con_base(self) -> list[Cliente]:
        """Activos y con la base ya creada: los únicos a los que se les puede
        abrir una sesión."""
        return [
            c
            for c in self.clientes.find_activos()
            if c.estado_aprovisionamiento == Cliente.APROV_LISTO
        ]
