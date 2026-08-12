from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseMaestra


class ClienteEstadoHistorial(BaseMaestra):
    """Cada vez que un cliente pasa de activo a suspendido o al revés.

    **Por qué hace falta una tabla y no dos columnas de fecha.** Un cliente se
    suspende y se reactiva más de una vez, y la pregunta que responde el
    dashboard —cuántos estaban activos en marzo— necesita todas las
    transiciones, no la última. Con `fecha_suspension` / `fecha_reactivacion`
    cada nuevo cambio borraría el anterior y la serie mensual sería una línea
    recta.

    **Lo que NO se puede reconstruir.** Esta tabla nace hoy, así que del pasado
    no hay transiciones: lo único que consta de antes es `cliente.fecha_creacion`
    —cuándo entró— y el estado en que está ahora. La serie del dashboard lo
    dice explícitamente en vez de dibujar una suspensión que nadie registró
    (ver `AdminDashboardService.evolucion_clientes`).

    **Registrar no puede romper la acción**, igual que en `auditoria_service`:
    suspender a un moroso tiene que ocurrir aunque esta línea falle. Por eso
    quien escribe acá lo hace dentro de la misma transacción y sin manejo
    propio de errores: si la transacción se cae, se cae entera y el cliente
    tampoco cambió de estado.
    """

    __tablename__ = "cliente_estado_historial"

    # A qué estado PASÓ el cliente. No se guarda el anterior: es el de la fila
    # previa, y duplicarlo abre la puerta a que las dos no coincidan.
    ESTADO_ACTIVO = "activo"
    ESTADO_SUSPENDIDO = "suspendido"

    # Quién o qué lo movió. Es la diferencia entre "no paga" y "lo dimos de
    # baja", que en `cliente.activo` son indistinguibles.
    MOTIVO_ALTA = "alta"
    MOTIVO_MANUAL = "manual"
    MOTIVO_MORA = "mora"
    MOTIVO_PAGO = "pago"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("cliente.cliente_id"), nullable=False, index=True
    )

    estado: Mapped[str] = mapped_column(String(20), nullable=False)
    motivo: Mapped[str] = mapped_column(
        String(20), nullable=False, default=MOTIVO_MANUAL, server_default=MOTIVO_MANUAL
    )

    # Quién lo hizo, por nombre y no por FK: el administrador puede ser dado de
    # baja y el historial tiene que seguir diciendo quién movió qué. Los cambios
    # automáticos guardan el nombre del proceso, no un nulo: "nadie lo suspendió"
    # y "lo suspendió el job de mora" son cosas distintas al auditar.
    actor: Mapped[Optional[str]] = mapped_column(String(100))

    # Por acá se ordena y se corta la serie mensual, de ahí el índice.
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    cliente = relationship("Cliente")

    @classmethod
    def de(
        cls, cliente_id: int, activo: bool, motivo: str, actor: Optional[str] = None
    ) -> "ClienteEstadoHistorial":
        """Atajo para no repetir la traducción de `activo` a estado.

        Existe porque quien registra tiene a mano el booleano que acaba de
        escribir en `cliente.activo`, y hacer la traducción en cada punto de
        llamada es exactamente donde se cuela un `activo` invertido.
        """
        return cls(
            cliente_id=cliente_id,
            estado=cls.ESTADO_ACTIVO if activo else cls.ESTADO_SUSPENDIDO,
            motivo=motivo,
            actor=actor,
        )
