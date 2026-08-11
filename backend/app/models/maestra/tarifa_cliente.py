from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseMaestra

# Los tres conceptos base que sabe contar el sistema. Son las claves que busca
# `TarifaService`, y también los valores por defecto de la plataforma para el
# cliente que todavía no tiene nada configurado.
CONCEPTO_MATERIA = "materia"
CONCEPTO_APELACIONES = "apelaciones"
CONCEPTO_SUPREMA = "suprema"

# Prefijo de una tarifa que aplica a UNA materia en particular:
# `materia:Familia` pisa a `materia` solo para las causas de Familia. Sirve para
# el cliente al que se le cobra distinto lo penal, sin obligar a nadie más a
# enumerar sus cinco materias.
PREFIJO_MATERIA = "materia:"

# Tarifas de la plataforma, en pesos por causa y por mes. Son el piso: un
# cliente sin fila en esta tabla se factura con esto. Están acá y no en la base
# para que una instalación nueva facture bien sin que nadie configure nada.
TARIFAS_POR_DEFECTO: dict[str, Decimal] = {
    CONCEPTO_MATERIA: Decimal("1"),
    CONCEPTO_APELACIONES: Decimal("2"),
    CONCEPTO_SUPREMA: Decimal("3"),
}


class TarifaCliente(BaseMaestra):
    """Lo que se le cobra a UN cliente por cada concepto.

    Existe porque el precio es parte del contrato con cada estudio y no una
    constante del producto: al cliente A la causa le sale $1 y al B $2. Antes
    esto vivía en tres constantes del servicio y cambiarlas era un despliegue
    que además cambiaba el precio de todos.

    **Una fila ausente no es un precio cero**: es "cobre lo de la plataforma"
    (`TARIFAS_POR_DEFECTO`). Sembrar tres filas por cada cliente nuevo daría lo
    mismo hasta el día en que se agregue un concepto y haya que rellenar a mano
    todos los clientes que existan.

    **Esta tabla no reescribe el pasado.** La factura copia el valor unitario
    que usó (`FacturaDetalle.valor_unitario`), así que subir el precio acá afecta
    a las facturas que se generen de ahora en adelante y a ninguna anterior.
    """

    __tablename__ = "tarifa_cliente"
    # Un valor por cliente y concepto. Sin esto, dos filas de `materia` para el
    # mismo cliente harían que el precio dependiera del orden de la consulta.
    __table_args__ = (
        UniqueConstraint("cliente_id", "concepto", name="uq_tarifa_cliente_concepto"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("cliente.cliente_id"), nullable=False, index=True
    )

    # `materia`, `apelaciones`, `suprema`, o `materia:<nombre>` para pisar una
    # materia puntual.
    concepto: Mapped[str] = mapped_column(String(100), nullable=False)

    # Numeric y no Integer: hoy las tarifas son pesos enteros, pero un contrato
    # en UF o con decimales no debería obligar a migrar la columna. Y no Float,
    # que es lo que arruina un total al cuadrar la contabilidad.
    valor_unitario: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    # Desactivar en vez de borrar: deja el valor a la vista para volver a
    # ponerlo, y el historial de por qué un mes salió distinto.
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    cliente = relationship("Cliente")
