/**
 * Órdenes de compra: el documento que se le entrega al cliente.
 *
 * Cubre un rango de fechas y suma los **cierres mensuales** que caen dentro.
 * No recalcula nada, así que emitir dos veces el mismo rango da el mismo
 * total aunque el estudio haya cargado causas en el medio.
 *
 * **No es un DTE del SII**: no lleva folio autorizado ni timbre electrónico.
 *
 * Espejo de `admin_api/app/schemas/cliente.py`. Como la consola se compila
 * aparte del backend, los dos archivos son un mismo contrato y se cambian
 * juntos: no hay compilador que avise si se separan.
 */

export interface OrdenCompraLinea {
  /** Primer día del mes facturado, ISO. */
  periodo: string;
  causas_materia: number;
  cortes_apelaciones: number;
  cortes_suprema: number;
  /** Las tarifas vigentes al CIERRE de ese mes, no las de hoy. */
  tarifa_materia: number;
  tarifa_apelaciones: number;
  tarifa_suprema: number;
  subtotal: number;
}

export interface OrdenCompra {
  id: number;
  /** Correlativo global de seis dígitos, como se imprime: `000042`. */
  numero: string;
  cliente_id: number;
  /** Nombre ACTUAL del cliente, para el listado. */
  cliente_nombre: string;
  /**
   * Datos congelados al emitir. Si el cliente se muda, la orden ya emitida
   * sigue diciendo la dirección que se imprimió.
   */
  razon_social: string;
  rut: string;
  giro: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  correo: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  fecha_emision: string;
  total: number;
  emitida_por: string | null;
  anulada: boolean;
  motivo_anulacion: string | null;
  lineas: OrdenCompraLinea[];
}

export interface OrdenCompraListResponse {
  exito: boolean;
  total: number;
  /** Suma de las NO anuladas: es lo cobrable, no lo emitido. */
  total_monto: number;
  facturas: OrdenCompra[];
}

export interface EmitirOrdenRequest {
  cliente_id: number;
  /**
   * El rango se guarda tal como se pide, pero el detalle va por mes completo:
   * entra todo mes que se cruce con el rango.
   */
  fecha_desde: string;
  fecha_hasta: string;
}
