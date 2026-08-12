from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseMaestra


class Pago(BaseMaestra):
    """Un intento de pago con Webpay Plus. Vive en la base principal, al lado
    de la factura que paga.

    **Se guarda todo intento, no solo el que resultó.** Un rechazo que no queda
    registrado es un reclamo que no se puede contestar: el estudio dice que
    pagó, la factura sigue emitida y no hay nada que mirar. Acá queda la orden
    de compra, el código de respuesta y la hora, que es exactamente lo que pide
    Transbank cuando hay que reclamar una transacción.

    **La respuesta cruda se guarda entera** (`respuesta_cruda`). Los campos que
    se desglosan en columnas son los que se consultan; el resto —vci, tipo de
    cuotas, fecha contable— aparece cuando hay que cuadrar con el cierre diario
    de Transbank, y para entonces ya no se puede volver a pedir.

    **No hay FK al cliente por guid**: `cliente_id` apunta a la tabla `cliente`
    de esta misma base, igual que `factura.cliente_id`.
    """

    __tablename__ = "pago"

    # Estados propios, que no son los de Transbank. `iniciado` es el hueco
    # peligroso: la transacción se creó y el usuario está en el formulario de
    # Webpay. Si nunca vuelve, se queda así y Transbank la reversa sola a los
    # 10 minutos.
    ESTADO_INICIADO = "iniciado"
    ESTADO_APROBADO = "aprobado"
    ESTADO_RECHAZADO = "rechazado"
    # El usuario apretó "Anular" en el formulario de Webpay.
    ESTADO_ANULADO = "anulado"
    # No se pudo hablar con Transbank, o respondió algo que no se entiende. No
    # es lo mismo que rechazado: acá no se sabe si se cobró.
    ESTADO_ERROR = "error"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    factura_id: Mapped[int] = mapped_column(
        ForeignKey("factura.id"), nullable=False, index=True
    )
    # Redundante con `factura.cliente_id` a propósito: es por donde se
    # comprueba que la factura sea del estudio que está pagando, y tenerlo acá
    # evita un join en el camino más sensible del flujo.
    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("cliente.cliente_id"), nullable=False, index=True
    )

    # La orden de compra que ve Transbank: `F000042-17` (factura e id de este
    # intento). Única por intento, porque reintentar una factura rechazada no
    # puede reusar la orden anterior. Máximo 26 caracteres (ver core/transbank).
    buy_order: Mapped[str] = mapped_column(String(26), nullable=False, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(26))

    # El token de Webpay. Es la identidad de la transacción y por donde se
    # confirma; único porque dos pagos con el mismo token serían el mismo.
    token: Mapped[Optional[str]] = mapped_column(String(128), unique=True, index=True)

    # Lo que se le cobró al estudio. Entero en la práctica (CLP no lleva
    # decimales en Webpay), pero Numeric para poder compararlo con
    # `factura.total` sin convertir tipos en el medio.
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ESTADO_INICIADO,
        server_default=ESTADO_INICIADO, index=True,
    )

    # ── Lo que devuelve Transbank al confirmar ──
    # 0 es aprobada; el resto son los motivos de rechazo de la tarjeta.
    response_code: Mapped[Optional[int]] = mapped_column(Integer)
    authorization_code: Mapped[Optional[str]] = mapped_column(String(20))
    # Solo los cuatro últimos dígitos: es lo único que manda Transbank y lo
    # único que corresponde guardar.
    tarjeta_final4: Mapped[Optional[str]] = mapped_column(String(8))
    # VD débito, VN crédito sin cuotas, VC/SI/S2/NC con cuotas.
    tipo_pago: Mapped[Optional[str]] = mapped_column(String(10))
    cuotas: Mapped[Optional[int]] = mapped_column(Integer)
    # Hora de la transacción según Transbank, que no es la del servidor.
    fecha_transaccion: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # El motivo, en castellano, cuando algo salió mal. Es lo que se le muestra
    # al estudio y lo que lee el operador en la consola.
    mensaje: Mapped[Optional[str]] = mapped_column(String(500))

    # La respuesta completa de Transbank, como JSON. Ver docstring de la clase.
    respuesta_cruda: Mapped[Optional[str]] = mapped_column(Text)

    # Quién lo inició, para la bitácora. Es el usuario del estudio.
    usuario_id: Mapped[Optional[int]] = mapped_column(Integer)

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # Cuándo se cerró el intento (aprobado, rechazado, anulado o error). Nulo
    # mientras siga en `iniciado`, que es como se reconoce el abandonado.
    fecha_cierre: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    factura = relationship("Factura")

    @property
    def aprobado(self) -> bool:
        return self.estado == self.ESTADO_APROBADO

    def cerrar(self, estado: str, mensaje: Optional[str] = None) -> None:
        """Deja el intento en su estado final con la hora de cierre.

        Va junto y no en tres asignaciones sueltas para que no quede un pago
        `aprobado` sin `fecha_cierre`, que es lo que rompe después cualquier
        consulta de "pagos del día".
        """
        self.estado = estado
        self.mensaje = mensaje
        self.fecha_cierre = datetime.now(timezone.utc)
