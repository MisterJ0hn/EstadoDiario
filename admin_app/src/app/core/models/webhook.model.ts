/** Webhook de importación por correo de un cliente.
 *
 * Cuando termina de importarse un archivo que llegó por correo, la plataforma
 * avisa a una URL del estudio con los datos importados. Ver
 * `backend/app/services/webhook_service.py`.
 */

export interface WebhookConfig {
  cliente_id: number;
  url: string | null;
  activo: boolean;
  enviar_estado_diario: boolean;
  enviar_movimientos: boolean;
  enviar_audiencias: boolean;
  /** El secreto nunca llega al navegador: solo se sabe si existe. */
  tiene_secreto: boolean;
  ultimo_envio: string | null;
  ultimo_resultado: string | null;
  /** Entregas que agotaron sus reintentos y siguen sin enviarse. */
  fallidos: number;
}

export interface WebhookConfigUpdate {
  url: string | null;
  activo: boolean;
  enviar_estado_diario: boolean;
  enviar_movimientos: boolean;
  enviar_audiencias: boolean;
}

/** Al guardar por primera vez trae el secreto: es la única vez que se ve. */
export interface WebhookConfigGuardada extends WebhookConfig {
  secreto: string | null;
}

export interface WebhookSecreto {
  secreto: string;
}

export interface WebhookPrueba {
  exito: boolean;
  mensaje: string;
  status_http: number | null;
}

export type EstadoEnvio = 'pendiente' | 'enviado' | 'fallido';

export interface WebhookEnvio {
  id: number;
  evento_id: string;
  /** estado_diario | movimientos | audiencias */
  tipo: string;
  origen_id: number | null;
  lote: number;
  total_lotes: number;
  total_registros: number;
  estado: EstadoEnvio;
  intentos: number;
  proximo_intento: string;
  ultimo_status_http: number | null;
  ultimo_error: string | null;
  fecha_creacion: string;
  fecha_envio: string | null;
}

export interface WebhookEnvioList {
  total: number;
  envios: WebhookEnvio[];
}

export interface WebhookReintento {
  reencolados: number;
}
