"""Lo que un estudio ve de sus propias facturas.

Es un contrato aparte del de la consola de administración (`admin_api`) a
propósito, aunque salgan de la misma tabla: el estudio no tiene por qué recibir
quién la emitió, de qué archivo de causas salió ni si su base respondió al
generarla. Compartir el schema haría que agregar un campo interno se lo
mandara al cliente sin que nadie lo decidiera.
"""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class FacturaClienteDetalleResponse(BaseModel):
    """Una línea del detalle, tal como se imprime."""

    concepto: str
    cantidad: int
    # El valor que se usó AL GENERAR la factura, no el vigente hoy: por eso una
    # factura vieja sigue diciendo lo que se cobró.
    valor_unitario: Decimal
    valor_total: Decimal


class FacturaClienteResponse(BaseModel):
    id: int
    # Correlativo de seis dígitos, como se imprime: `000042`.
    numero: str
    # Primer día del mes facturado.
    periodo: date | None = None
    fecha_emision: datetime
    total: Decimal
    # emitida | pagada | anulada
    estado: str
    anulada: bool = False
    motivo_anulacion: str | None = None
    # Suma de las cantidades del detalle, ya calculada.
    total_causas: int = 0
    detalles: list[FacturaClienteDetalleResponse] = []


class FacturaClienteListResponse(BaseModel):
    exito: bool = True
    total: int
    # Suma de las NO anuladas.
    total_monto: Decimal = Decimal("0")
    facturas: list[FacturaClienteResponse]
