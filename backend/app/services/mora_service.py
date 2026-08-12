"""Suspensión automática de clientes con facturas impagas.

**Qué cuenta como mora.** La factura más antigua que está `emitida` —ni pagada
ni anulada— y cuya emisión tiene más días de los configurados. Se cuenta desde
`fecha_emision` porque el documento no tiene fecha de vencimiento: es lo único
que consta.

**Está apagada por defecto** (`dias_mora_suspension = 0`). Cortarle el acceso a
un estudio es la acción más agresiva del sistema —sus abogados dejan de poder
entrar, la ingesta por correo lo salta y no se envían sus recordatorios— y no
puede empezar a ocurrir sola porque alguien desplegó una versión nueva. Se
enciende desde Configuración.

**Este módulo no reactiva a nadie**, y sigue sin hacerlo. Lo que cambió con el
pago en línea es que *otro* módulo sí puede: `PagoService` levanta la suspensión
del estudio que paga toda su deuda con Webpay. Para que eso no alcance al
cliente que un operador dio de baja a mano, acá se deja marcado quién fue:
suspender por mora escribe `cliente.suspendido_por_mora`, y el pago solo
reactiva a los que tienen esa marca. En la base las dos situaciones son el mismo
`activo = False`; sin la marca serían indistinguibles.

Lo que sí hace es no volver a suspender al que ya está suspendido, para no
llenar el log.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.maestra.cliente import Cliente
from app.models.maestra.factura import Factura
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.configuracion_sistema_repository import (
    ConfiguracionSistemaRepository,
)

logger = logging.getLogger(__name__)


class ClienteEnMora:
    """Un cliente que cumple la condición, con el porqué a la vista."""

    def __init__(self, cliente: Cliente, factura: Factura, dias: int):
        self.cliente = cliente
        self.factura = factura
        self.dias = dias

    def __str__(self) -> str:
        return (
            f"{self.cliente.nombre}: factura {self.factura.numero_formateado} "
            f"emitida hace {self.dias} días"
        )


class MoraService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.clientes = ClienteRepository(db_maestra)
        self.config = ConfiguracionSistemaRepository(db_maestra)

    def dias_configurados(self) -> int:
        return int(self.config.get_or_create().dias_mora_suspension or 0)

    def en_mora(self, dias: Optional[int] = None) -> List[ClienteEnMora]:
        """Los clientes ACTIVOS cuya factura impaga más antigua superó el plazo.

        Devuelve la lista sin tocar nada: la usa el job para suspender y la
        consola para poder decir a quién afectaría antes de encender la regla.
        """
        umbral = dias if dias is not None else self.dias_configurados()
        if umbral <= 0:
            return []

        corte = datetime.now(timezone.utc) - timedelta(days=umbral)
        # Solo activos: al suspendido no hay nada que suspenderle.
        activos = {c.cliente_id: c for c in self.clientes.find_all() if c.activo}
        if not activos:
            return []

        impagas = (
            self.db.query(Factura)
            .filter(
                Factura.cliente_id.in_(list(activos)),
                Factura.estado == Factura.ESTADO_EMITIDA,
                Factura.anulada.is_(False),
                Factura.fecha_emision <= corte,
            )
            .order_by(Factura.fecha_emision.asc())
            .all()
        )

        # La más antigua por cliente: es la que define cuántos días lleva en
        # mora, y es la que hay que nombrar al explicar la suspensión.
        vistos: dict[int, ClienteEnMora] = {}
        ahora = datetime.now(timezone.utc)
        for f in impagas:
            if f.cliente_id in vistos:
                continue
            emision = f.fecha_emision
            if emision.tzinfo is None:
                emision = emision.replace(tzinfo=timezone.utc)
            vistos[f.cliente_id] = ClienteEnMora(
                activos[f.cliente_id], f, (ahora - emision).days
            )
        return list(vistos.values())

    def suspender_en_mora(self, simular: bool = False) -> Tuple[List[ClienteEnMora], int]:
        """Suspende a los que corresponda. Devuelve (afectados, umbral usado).

        Con el umbral en 0 no hace nada y lo dice: es el estado por defecto y
        no un error.
        """
        umbral = self.dias_configurados()
        if umbral <= 0:
            logger.info("Suspensión por mora apagada (dias_mora_suspension = 0)")
            return [], 0

        morosos = self.en_mora(umbral)
        for m in morosos:
            logger.warning(
                "Cliente %s suspendido por mora: %s (umbral %d días)%s",
                m.cliente.guid, m, umbral, " [simulación]" if simular else "",
            )
            if not simular:
                m.cliente.activo = False
                # La marca es lo único que después distingue esta suspensión de
                # una baja hecha a mano, y es lo que autoriza a `PagoService` a
                # reactivar al que paga. Va junto al `activo = False`: separarlas
                # dejaría suspendidos sin marca, que nunca se reactivarían solos.
                m.cliente.suspendido_por_mora = True
                self.clientes.save(m.cliente)

        if morosos and not simular:
            self.db.commit()
        return morosos, umbral
