from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseMaestra


class Factura(BaseMaestra):
    """La factura mensual de un cliente: un mes, un documento.

    **No es un DTE del SII.** No lleva folio autorizado (CAF) ni timbre
    electrónico, así que no reemplaza a la factura tributaria: es el documento
    de cobro de la plataforma, con su propia numeración. Emitir el DTE es una
    integración aparte y este modelo no la impide — el día que exista, el folio
    del SII sería otra columna al lado de `numero`.

    **Una por cliente y período, y eso lo garantiza la base.** El
    `UniqueConstraint` no es una precaución de más: el job del día 1 puede
    dispararse dos veces (un reintento del cron, alguien que lo corre a mano) y
    una factura duplicada se descubre recién cuando el cliente reclama que le
    cobraron doble.

    **Todo lo que se imprime queda copiado acá.** La razón social, el RUT, el
    giro y la dirección del cliente; y en `detalles`, las cantidades y el valor
    unitario de cada concepto. Una factura no puede cambiar porque el cliente se
    mudó, porque se le subió la tarifa o porque el estudio cerró tres causas:
    lo que se cobró, se cobró. Referenciar al cliente y recalcular sería más
    corto y convertiría cada factura vieja en una mentira distinta cada vez que
    se abre.

    Por lo mismo se guarda **el PDF exacto que se entregó** (`pdf`), y no se
    regenera al descargarlo. Es la copia de referencia contra la que se
    contrasta cualquier archivo que llegue adulterado: el PDF sale con la
    edición bloqueada, pero eso disuade, no impide.
    """

    __tablename__ = "factura"
    # Una factura VIVA por cliente y período. El índice es parcial —solo sobre
    # las no anuladas— porque regenerar un mes anula la anterior y emite otra:
    # las dos comparten cliente y período, y un índice total lo prohibiría. Lo
    # que no puede haber es dos cobrables del mismo mes.
    __table_args__ = (
        Index(
            "uq_factura_cliente_periodo",
            "cliente_id",
            "periodo",
            unique=True,
            postgresql_where=text("anulada = false"),
        ),
    )

    # Estados. `emitida` es el estado en que nace: el día 1 la factura ya está
    # calculada y es cobrable, no hay un borrador que alguien deba aprobar.
    # `pagada` la marca una persona; no hay integración con ningún banco.
    ESTADO_EMITIDA = "emitida"
    ESTADO_PAGADA = "pagada"
    ESTADO_ANULADA = "anulada"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Correlativo global de la plataforma, uno solo para todos los clientes.
    # UNIQUE porque es la identidad del documento: dos facturas con el mismo
    # número harían imposible saber a cuál se refiere un pago. Cómo se asigna
    # sin huecos ni repetidos está en `FacturaService._siguiente_numero`.
    numero: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, index=True)

    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("cliente.cliente_id"), nullable=False, index=True
    )

    # Primer día del mes facturado. El período de julio es 2026-07-01 aunque la
    # factura se genere el 1 de agosto: se factura el mes que terminó.
    periodo: Mapped[Optional[date]] = mapped_column(Date, index=True)

    # Los bordes del mes: 01-07 y 31-07. Redundan con `periodo` a propósito —
    # son NOT NULL en las bases ya desplegadas y son lo que imprime el PDF, así
    # que se siguen escribiendo en vez de borrar la columna bajo los pies de una
    # instalación en producción.
    fecha_desde: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_hasta: Mapped[date] = mapped_column(Date, nullable=False)

    # Cuándo se generó. Es la "fecha de generación" del listado.
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
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    estado: Mapped[str] = mapped_column(
        String(20), default=ESTADO_EMITIDA, server_default=ESTADO_EMITIDA, index=True
    )

    # ── Cómo salió el conteo ──
    # Distingue un cero real de un cero por base caída: las dos dan monto 0 y no
    # se facturan igual. Sin esto, un cliente cuya base estaba apagada el día 1
    # se ve idéntico a uno que no tiene ni una causa.
    ORIGEN_OK = "ok"
    ORIGEN_SIN_DATOS = "sin_datos"
    ORIGEN_ERROR = "error"

    origen_estado: Mapped[str] = mapped_column(
        String(20), default=ORIGEN_OK, server_default=ORIGEN_OK
    )
    origen_detalle: Mapped[Optional[str]] = mapped_column(String(500))
    # De qué archivo de causas salieron los números. El origen vive en la base
    # del cliente, así que va como número suelto y no como FK: no se puede
    # referenciar una tabla de otra base.
    origen_causas_id: Mapped[Optional[int]] = mapped_column(Integer)
    # Fecha de ese archivo. Null = el cliente no tenía ninguno cargado, y por eso
    # la factura va en cero. Es el dato que delata al cliente que dejó de subir
    # el Excel hace tres meses y se está facturando con una cartera vieja.
    fecha_archivo_causas: Mapped[Optional[date]] = mapped_column(Date)

    # El PDF entregado, byte por byte. En la base y no en disco por lo mismo
    # que el logo del cliente: el backend corre en contenedores sin volumen
    # compartido, y un archivo escrito por una réplica no lo ve la otra.
    # Además viaja con el respaldo, que es lo que uno espera de una factura.
    pdf: Mapped[Optional[bytes]] = mapped_column(LargeBinary)
    pdf_nombre: Mapped[Optional[str]] = mapped_column(String(255))

    # Quién la generó, por nombre y no por FK: el administrador puede ser dado
    # de baja y la factura tiene que seguir diciendo quién la hizo. Cuando la
    # genera el job del día 1 queda el nombre del proceso, no un nulo: "nadie la
    # emitió" y "la emitió el cron" son cosas distintas al auditar.
    emitida_por: Mapped[Optional[str]] = mapped_column(String(100))

    # Anulación: no se borra nunca. Una factura borrada deja un hueco en el
    # correlativo que nadie puede explicar después.
    #
    # `anulada` es NOT NULL en las bases ya desplegadas y es por donde filtra el
    # total cobrable; `estado` es el campo que se muestra. Se escriben juntas
    # por `marcar_anulada` para que no puedan discrepar.
    anulada: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    motivo_anulacion: Mapped[Optional[str]] = mapped_column(Text)

    cliente = relationship("Cliente")
    detalles: Mapped[List["FacturaDetalle"]] = relationship(
        "FacturaDetalle",
        back_populates="factura",
        cascade="all, delete-orphan",
        order_by="FacturaDetalle.orden, FacturaDetalle.id",
    )

    @property
    def numero_formateado(self) -> str:
        """`000042`. Seis dígitos: un talonario que llega al millón ya tuvo
        tiempo de sobra para que alguien decida otro formato."""
        return f"{self.numero:06d}"

    def marcar_anulada(self, motivo: str) -> None:
        self.anulada = True
        self.estado = self.ESTADO_ANULADA
        self.motivo_anulacion = motivo


class FacturaDetalle(BaseMaestra):
    """Una línea del detalle: un concepto con su cantidad y su valor unitario.

    Es lo que hace explicable una factura. Antes el detalle eran tres números
    fijos —materia, apelaciones, suprema— y "materia: 47" no le dice nada a un
    estudio que quiere saber cuántas de esas eran de Familia. Acá cada materia
    es su propia fila y el modelo no tiene que saber cuáles existen: las
    materias son las hojas que traiga el Excel de Causas.

    **El valor unitario se copia, no se referencia.** Si mañana se le sube la
    tarifa al cliente, esta línea sigue diciendo lo que se cobró. Es la misma
    razón por la que la cantidad se guarda en vez de recontarse: la cartera es
    una foto que se reemplaza con cada carga y el mes pasado ya no se puede
    volver a contar.
    """

    __tablename__ = "factura_detalle"

    # De dónde salió la línea. La cantidad se cuenta distinto según el tipo
    # (`causa` vigente vs. `causa_corte` completa) y la pantalla los agrupa.
    TIPO_MATERIA = "materia"
    TIPO_CORTE = "corte"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factura_id: Mapped[int] = mapped_column(
        ForeignKey("factura.id"), nullable=False, index=True
    )

    tipo: Mapped[str] = mapped_column(String(20), nullable=False, default=TIPO_MATERIA)

    # Lo que se imprime: `Familia`, `Civil`, `Corte de Apelaciones`. Texto y no
    # FK a un catálogo: el nombre de la materia lo pone el Excel del Poder
    # Judicial y una materia que deje de existir no puede romper una factura
    # vieja.
    concepto: Mapped[str] = mapped_column(String(150), nullable=False)

    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valor_unitario: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    # Guardado y no calculado al vuelo: es lo que se cobró. Si algún día cambia
    # la regla (un mínimo, un tramo, un descuento) el total de la línea sigue
    # siendo el que se imprimió.
    valor_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    # Orden de impresión: las materias alfabéticas primero y las cortes al
    # final, que es como se lee el detalle. Sin esto el orden sería el de
    # inserción, que nadie garantiza tras un UPDATE.
    orden: Mapped[int] = mapped_column(Integer, default=0)

    factura = relationship("Factura", back_populates="detalles")
