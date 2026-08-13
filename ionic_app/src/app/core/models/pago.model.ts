/**
 * Pago de una factura con Webpay Plus.
 *
 * Es la otra cara de `backend/app/schemas/pago.py`. El estudio ve muy poco:
 * si el pago está habilitado y a dónde tiene que ir para pagar. Todo lo demás
 * —intentos, códigos de respuesta, autorizaciones— vive en la consola de
 * administración, que es donde se responde un reclamo.
 */

export interface PagoDisponible {
  habilitado: boolean;
}

export interface PagoIniciado {
  exito: boolean;
  pago_id: number;
  /** El token que hay que mandarle a Webpay como campo `token_ws`. */
  token: string;
  /** A dónde hay que hacer el POST de formulario. */
  url: string;
  /** Entero: en pesos Webpay no acepta decimales. */
  monto: number;
  buy_order: string;
  factura_numero: string;
}

/** Cómo terminó el pago, tal como vuelve en la URL al regresar de Webpay. */
export type ResultadoPago = 'exito' | 'rechazado' | 'anulado' | 'error';
