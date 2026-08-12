/**
 * Credenciales de Webpay Plus.
 *
 * Es la otra cara de `backend/app/schemas/configuracion_transbank.py`. La API
 * key **nunca** viaja de vuelta: el backend solo dice si hay una guardada
 * (`tiene_api_key`), igual que con el auth token de Twilio.
 */

/** `integracion` no cobra: es el comercio de prueba de Transbank. */
export type AmbienteTransbank = 'integracion' | 'produccion';

export interface ConfiguracionTransbank {
  activo: boolean;
  ambiente: AmbienteTransbank;
  /** No es secreto: viaja en cada transacción. */
  commerce_code: string | null;
  tiene_api_key: boolean;
  fecha_modificacion: string;
}

export interface ConfiguracionTransbankUpdate {
  activo: boolean;
  ambiente: AmbienteTransbank;
  commerce_code: string | null;
  /** Vacío o null = conservar la que ya está guardada. */
  api_key: string | null;
}
