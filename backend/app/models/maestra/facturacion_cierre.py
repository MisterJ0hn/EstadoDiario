from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseMaestra


class FacturacionCierre(BaseMaestra):
    """Lo que se le cobra a un cliente en un mes, congelado el día del cierre.

    Vive en la base **principal** y no en la del cliente: es un dato comercial
    de la plataforma, no operativo del estudio, y quien lo mira es el
    administrador que factura, que nunca abre la base de un cliente.

    **Por qué se guarda en vez de calcularse.** La cartera es una foto que se
    reemplaza con cada carga del Excel de Causas: una causa que hoy está activa
    puede aparecer concluida el mes que viene, y el archivo de este mes puede
    no existir dentro de un año. Recalcular el período de marzo en junio daría
    otro número —y una factura ya emitida no puede cambiar de monto—, así que
    el cierre se toma una vez y queda.

    Se guardan las tres cantidades además del monto: sin ellas, una factura
    discutida no se puede explicar, y cambiar las tarifas reescribiría el
    pasado.
    """

    __tablename__ = "facturacion_cierre"
    # Un cierre por cliente y período. Es lo que hace idempotente al job: si se
    # corre dos veces el día 1, la segunda no duplica la factura.
    __table_args__ = (
        UniqueConstraint("cliente_id", "periodo", name="uq_facturacion_cliente_periodo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("cliente.cliente_id"), nullable=False, index=True
    )

    # Primer día del mes facturado. El período de julio es 2026-07-01 aunque el
    # cierre se haya tomado el 1 de agosto: se factura el mes que terminó.
    periodo: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Las tres cantidades contadas, cada una con su tarifa.
    causas_materia: Mapped[int] = mapped_column(Integer, default=0)
    cortes_apelaciones: Mapped[int] = mapped_column(Integer, default=0)
    cortes_suprema: Mapped[int] = mapped_column(Integer, default=0)

    # Las tarifas VIGENTES AL CIERRE, copiadas acá. Sin esto, subir el precio
    # cambiaría el monto de las facturas ya emitidas al reconstruir el detalle.
    tarifa_materia: Mapped[int] = mapped_column(Integer, default=1)
    tarifa_apelaciones: Mapped[int] = mapped_column(Integer, default=2)
    tarifa_suprema: Mapped[int] = mapped_column(Integer, default=3)

    # Numeric y no Float: es plata. Con la tarifa en pesos enteros el decimal
    # sobra hoy, pero un Float que redondea un total de facturación es un error
    # que aparece recién cuando alguien cuadra la contabilidad.
    monto: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    # Cuándo se tomó la foto, y de qué archivo de causas salió. El origen es de
    # la base del cliente, así que va como número suelto y no como FK: no se
    # puede referenciar una tabla de otra base.
    fecha_cierre: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    origen_causas_id: Mapped[Optional[int]] = mapped_column(Integer)
    # Fecha del archivo de causas con el que se contó. Null = el cliente no
    # tenía ninguno cargado, y por eso el cierre va en cero.
    fecha_archivo_causas: Mapped[Optional[date]] = mapped_column(Date)

    # Qué pasó al cerrar este cliente: sirve para distinguir un cero real de un
    # cero por base caída, que no se pueden facturar igual.
    ESTADO_OK = "ok"
    ESTADO_SIN_DATOS = "sin_datos"
    ESTADO_ERROR = "error"

    estado: Mapped[str] = mapped_column(String(20), default=ESTADO_OK)
    detalle: Mapped[Optional[str]] = mapped_column(String(500))

    cliente = relationship("Cliente")
