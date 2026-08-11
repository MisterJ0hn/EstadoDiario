from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseMaestra


class Factura(BaseMaestra):
    """Documento de cobro emitido a un cliente por un rango de meses.

    **No es un DTE del SII.** No lleva folio autorizado (CAF) ni timbre
    electrónico, así que no reemplaza a la factura tributaria: es el documento
    de cobro de la plataforma, con su propia numeración. Emitir el DTE es una
    integración aparte y este modelo no la impide — el día que exista, el folio
    del SII sería otra columna al lado de `numero`.

    **Todo lo que se imprime queda copiado acá.** La razón social, el RUT, el
    giro y la dirección del cliente, y también las cantidades y las tarifas de
    cada mes. Una factura emitida no puede cambiar porque el cliente se mudó o
    porque se rehízo un cierre: lo que se cobró, se cobró. Referenciar al
    cliente y recalcular sería más corto y convertiría cada factura vieja en
    una mentira distinta cada vez que se abre.

    Por lo mismo se guarda **el PDF exacto que se entregó** (`pdf`), y no se
    regenera al descargarlo. Es la copia de referencia contra la que se
    contrasta cualquier archivo que llegue adulterado: el PDF sale con la
    edición bloqueada, pero eso disuade, no impide.
    """

    __tablename__ = "factura"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Correlativo global de la plataforma, uno solo para todos los clientes.
    # UNIQUE porque es la identidad del documento: dos facturas con el mismo
    # número harían imposible saber a cuál se refiere un pago. Cómo se asigna
    # sin huecos ni repetidos está en `FacturaService._siguiente_numero`.
    numero: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, index=True)

    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("cliente.cliente_id"), nullable=False, index=True
    )

    # El rango facturado, tal como se pidió. Las líneas son los meses que
    # caen dentro (ver `FacturaLinea`).
    fecha_desde: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_hasta: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_emision: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # ── Copia de los datos del cliente al emitir ──
    razon_social: Mapped[str] = mapped_column(String(255), nullable=False)
    rut: Mapped[str] = mapped_column(String(20), nullable=False)
    giro: Mapped[Optional[str]] = mapped_column(String(255))
    direccion: Mapped[Optional[str]] = mapped_column(String(255))
    comuna: Mapped[Optional[str]] = mapped_column(String(100))
    ciudad: Mapped[Optional[str]] = mapped_column(String(100))
    correo: Mapped[Optional[str]] = mapped_column(String(255))

    # Numeric y no Float: es plata. Un Float que redondea un total de
    # facturación es un error que aparece recién cuando alguien cuadra la
    # contabilidad.
    total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    # El PDF entregado, byte por byte. En la base y no en disco por lo mismo
    # que el logo del cliente: el backend corre en contenedores sin volumen
    # compartido, y un archivo escrito por una réplica no lo ve la otra.
    # Además viaja con el respaldo, que es lo que uno espera de una factura.
    pdf: Mapped[Optional[bytes]] = mapped_column(LargeBinary)
    pdf_nombre: Mapped[Optional[str]] = mapped_column(String(255))

    # Quién la emitió, por nombre y no por FK: el administrador puede ser dado
    # de baja y la factura tiene que seguir diciendo quién la hizo.
    emitida_por: Mapped[Optional[str]] = mapped_column(String(100))

    # Anulación: no se borra nunca. Una factura borrada deja un hueco en el
    # correlativo que nadie puede explicar después.
    anulada: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    motivo_anulacion: Mapped[Optional[str]] = mapped_column(Text)

    cliente = relationship("Cliente")
    lineas: Mapped[List["FacturaLinea"]] = relationship(
        "FacturaLinea",
        back_populates="factura",
        cascade="all, delete-orphan",
        order_by="FacturaLinea.periodo",
    )

    @property
    def numero_formateado(self) -> str:
        """`000042`. Seis dígitos: un talonario que llega al millón ya tuvo
        tiempo de sobra para que alguien decida otro formato."""
        return f"{self.numero:06d}"


class FacturaLinea(BaseMaestra):
    """Un mes dentro de una factura.

    Es una copia del `FacturacionCierre` de ese mes, no una referencia: si el
    cierre se rehace después, la factura ya emitida no puede cambiar de monto.
    `facturacion_cierre_id` queda solo como rastro de dónde salió.

    Las tarifas se copian por lo mismo que en el cierre: sin ellas, subir el
    precio reescribiría el detalle de las facturas viejas al reimprimirlas.
    """

    __tablename__ = "factura_linea"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factura_id: Mapped[int] = mapped_column(
        ForeignKey("factura.id"), nullable=False, index=True
    )

    # Primer día del mes facturado.
    periodo: Mapped[date] = mapped_column(Date, nullable=False)

    causas_materia: Mapped[int] = mapped_column(Integer, default=0)
    cortes_apelaciones: Mapped[int] = mapped_column(Integer, default=0)
    cortes_suprema: Mapped[int] = mapped_column(Integer, default=0)

    tarifa_materia: Mapped[int] = mapped_column(Integer, default=1)
    tarifa_apelaciones: Mapped[int] = mapped_column(Integer, default=2)
    tarifa_suprema: Mapped[int] = mapped_column(Integer, default=3)

    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    # De qué cierre salió. Sin FK con cascada: el cierre no debería borrarse,
    # pero si alguien lo hiciera, la factura tiene que sobrevivir.
    facturacion_cierre_id: Mapped[Optional[int]] = mapped_column(Integer)

    factura = relationship("Factura", back_populates="lineas")
