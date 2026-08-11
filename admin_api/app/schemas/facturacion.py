"""Contratos de la API de facturación.

Están acá y no en `cliente.py` porque el módulo creció: facturas, detalle,
tarifas por cliente y generación del período son cuatro cosas distintas y
meterlas al final del archivo de clientes las hacía imposibles de encontrar.
"""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


# ── Detalle y factura ─────────────────────────────────────


class FacturaDetalleResponse(BaseModel):
    """Una línea del detalle: concepto, cantidad, valor unitario y total.

    El valor unitario es el que se usó **al generar la factura**, no el que el
    cliente tiene configurado hoy. Sin eso, subir una tarifa reescribiría el
    detalle de todos los meses anteriores.
    """

    id: int
    # materia | corte. Deja agrupar el detalle sin adivinar por el nombre.
    tipo: str
    concepto: str
    cantidad: int
    valor_unitario: Decimal
    valor_total: Decimal


class FacturaResponse(BaseModel):
    """Una factura mensual.

    **No es un DTE del SII**: no lleva folio autorizado ni timbre electrónico.
    Es el documento de cobro de la plataforma, con numeración propia.

    El PDF no viaja acá: se descarga por `/facturas/{id}/pdf`. Meterlo en el
    listado significaría mandar cientos de kilobytes por fila.
    """

    id: int
    # Correlativo global de seis dígitos, como se imprime: `000042`.
    numero: str
    cliente_id: int
    # Nombre y estado ACTUALES del cliente, para el listado y sus filtros. No
    # confundir con `razon_social`, que es la copia congelada del documento.
    cliente_nombre: str
    cliente_activo: bool = True
    # Primer día del mes facturado.
    periodo: date | None = None
    fecha_emision: datetime
    total: Decimal
    # emitida | pagada | anulada
    estado: str

    # Datos congelados al generar: si el cliente se muda, esta factura no cambia.
    razon_social: str
    rut: str
    giro: str | None = None
    direccion: str | None = None
    comuna: str | None = None
    ciudad: str | None = None
    correo: str | None = None

    # Cómo salió el conteo: ok | sin_datos | error. `error` es un mes que no se
    # pudo contar, no un cliente sin causas; los dos dan 0 y no son lo mismo.
    origen_estado: str = "ok"
    origen_detalle: str | None = None
    # Fecha del archivo de causas con el que se contó. Null = no había ninguno.
    # Delata al cliente que dejó de cargar el Excel y se factura con una cartera
    # vieja.
    fecha_archivo_causas: date | None = None

    emitida_por: str | None = None
    anulada: bool = False
    motivo_anulacion: str | None = None
    detalles: list[FacturaDetalleResponse] = []

    # Suma de las cantidades del detalle. Se manda calculada: sumarla en la
    # pantalla obligaría a traer el detalle completo solo para mostrar una cifra
    # en el listado.
    total_causas: int = 0


class FacturaListResponse(BaseModel):
    exito: bool = True
    total: int
    # Suma de las facturas NO anuladas del listado: el total tiene que ser lo
    # cobrable, no una cifra que incluye documentos que no existen.
    total_monto: Decimal = Decimal("0")
    facturas: list[FacturaResponse]


# ── Generación ────────────────────────────────────────────


class GenerarPeriodoRequest(BaseModel):
    """Generación manual desde la consola.

    La vía normal es el job del día 1; esto existe para reintentar el cliente
    cuya base estaba caída. `periodo` ausente = el mes anterior a hoy, igual que
    el job.
    """

    periodo: date | None = None
    # Anula la factura que ya exista del período y emite otra. Solo tiene
    # sentido el mismo día: después, el archivo de causas del cliente ya es otro
    # y el recuento no daría lo que se facturó.
    rehacer: bool = False


class ClienteConErrorResponse(BaseModel):
    cliente_id: int
    cliente_nombre: str
    motivo: str


class GenerarPeriodoResponse(BaseModel):
    """Qué pasó al generar. Los tres grupos van por separado: "todo bien" y
    "todo bien menos dos clientes que no respondieron" exigen cosas distintas
    de quien está mirando la pantalla."""

    periodo: date
    generadas: int
    omitidas: int
    total_generado: Decimal = Decimal("0")
    con_error: list[ClienteConErrorResponse] = []


# ── Estimación del período en curso ───────────────────────


class EstimacionLineaResponse(BaseModel):
    tipo: str
    concepto: str
    cantidad: int
    valor_unitario: Decimal
    valor_total: Decimal


class EstimacionClienteResponse(BaseModel):
    cliente_id: int
    cliente_nombre: str
    cliente_rut: str
    cliente_activo: bool = True
    total: Decimal
    total_causas: int
    origen_estado: str
    origen_detalle: str | None = None
    fecha_archivo_causas: date | None = None
    detalles: list[EstimacionLineaResponse] = []


class EstimacionPeriodoResponse(BaseModel):
    """Lo que saldría si se facturara ahora.

    Es la pregunta que se hace el 20 del mes y no tiene respuesta en las
    facturas —todavía no existen—, así que se cuenta al momento y **no se
    escribe nada**. `ya_generado` avisa que el período ya tiene facturas y que
    lo que se está mirando es una estimación de algo ya cobrado.
    """

    periodo: date
    ya_generado: bool = False
    total_clientes: int
    total_monto: Decimal = Decimal("0")
    total_causas: int = 0
    clientes_con_error: int = 0
    clientes: list[EstimacionClienteResponse] = []


# ── Tarifas por cliente ───────────────────────────────────


class TarifaResponse(BaseModel):
    id: int
    cliente_id: int
    # `materia`, `apelaciones`, `suprema` o `materia:<nombre>`.
    concepto: str
    valor_unitario: Decimal
    activo: bool = True


class TarifasClienteResponse(BaseModel):
    """Lo configurado para el cliente, más lo que la plataforma cobra por
    defecto.

    Van los dos: la pantalla necesita distinguir "este cliente tiene $2
    acordado" de "a este se le cobra lo de la plataforma", y una lista que
    siempre trae tres filas borra esa diferencia.
    """

    cliente_id: int
    cliente_nombre: str
    tarifas: list[TarifaResponse] = []
    # {concepto: valor} de la plataforma, para mostrarlo como referencia.
    por_defecto: dict[str, Decimal] = {}


class TarifaUpsertRequest(BaseModel):
    concepto: str = Field(..., min_length=1, max_length=100)
    valor_unitario: Decimal = Field(..., ge=0)
    activo: bool = True


# ── Acciones sobre una factura ────────────────────────────


class AnularFacturaRequest(BaseModel):
    """El motivo es obligatorio: una factura anulada sin explicación es un
    agujero en la contabilidad que nadie puede cerrar después."""

    motivo: str = Field(..., min_length=3, max_length=500)


class MarcarPagadaRequest(BaseModel):
    """No hay integración con ningún banco: lo registra quien vio el pago."""

    pagada: bool = True


class FiltroFacturasQuery(BaseModel):
    """Los filtros del listado, para validarlos juntos."""

    desde: date | None = None
    hasta: date | None = None

    @model_validator(mode="after")
    def _validar_rango(self) -> "FiltroFacturasQuery":
        if self.desde and self.hasta and self.hasta < self.desde:
            raise ValueError("La fecha 'hasta' no puede ser anterior a 'desde'.")
        return self
