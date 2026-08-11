/**
 * Las facturas del propio estudio, de solo lectura.
 *
 * Es la otra cara de `backend/app/schemas/factura.py`. Un contrato distinto al
 * de la consola de administración aunque salgan de la misma tabla: acá no viaja
 * quién la emitió, de qué archivo de causas salió ni si la base respondió al
 * generarla. Son datos internos de la plataforma y el estudio no los necesita.
 */

/** En qué está la factura. `anulada` no se cobra ni suma en el total. */
export type EstadoFacturaCliente = 'emitida' | 'pagada' | 'anulada';

export interface FacturaDetalleCliente {
  /** Lo que se imprime: `Familia`, `Civil`, `Corte de Apelaciones`. */
  concepto: string;
  cantidad: number;
  /**
   * El valor usado AL GENERAR la factura, no el vigente hoy: por eso una
   * factura vieja sigue diciendo lo que se cobró.
   */
  valor_unitario: number;
  valor_total: number;
}

export interface FacturaCliente {
  id: number;
  /** Correlativo de seis dígitos, como se imprime: `000042`. */
  numero: string;
  /** Primer día del mes facturado, ISO. */
  periodo: string | null;
  fecha_emision: string;
  total: number;
  estado: EstadoFacturaCliente;
  anulada: boolean;
  motivo_anulacion: string | null;
  /** Suma de las cantidades del detalle, ya calculada por el backend. */
  total_causas: number;
  detalles: FacturaDetalleCliente[];
}

export interface FacturaClienteListResponse {
  exito: boolean;
  total: number;
  /** Suma de las NO anuladas. */
  total_monto: number;
  facturas: FacturaCliente[];
}
