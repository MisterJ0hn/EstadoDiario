"""Contratos del pago con Webpay.

El **token de Webpay no viaja en ninguna respuesta de consulta**: sirve para
confirmar la transacción y no aporta nada al mirar un pago viejo. Lo que
necesita soporte para reclamar ante Transbank es la orden de compra y el código
de autorización, y esos sí están.
"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class PagoDisponibleResponse(BaseModel):
    """Si el estudio debe ver el botón de pagar.

    Lo decide el servidor y no la app: la configuración de Transbank vive en la
    base principal y el frontend no tiene por qué conocerla.
    """

    habilitado: bool


class PagoIniciadoResponse(BaseModel):
    """Lo que necesita el navegador para llegar al formulario de Webpay.

    Con `url` y `token` hay que hacer un **POST de formulario** con el campo
    `token_ws`. Webpay no acepta que se llegue por GET.
    """

    exito: bool = True
    pago_id: int
    token: str
    url: str
    # Entero: es lo que se le cobra, y en CLP Webpay no acepta decimales.
    monto: int
    buy_order: str
    factura_numero: str


class PagoResponse(BaseModel):
    """Un intento de pago, como lo ve la consola de administración."""

    id: int
    factura_id: int
    buy_order: str
    monto: Decimal
    # iniciado | aprobado | rechazado | anulado | error
    estado: str
    response_code: int | None = None
    authorization_code: str | None = None
    tarjeta_final4: str | None = None
    tipo_pago: str | None = None
    cuotas: int | None = None
    fecha_transaccion: datetime | None = None
    mensaje: str | None = None
    fecha_creacion: datetime
    fecha_cierre: datetime | None = None

    class Config:
        from_attributes = True


class PagoListResponse(BaseModel):
    exito: bool = True
    total: int
    pagos: list[PagoResponse]
