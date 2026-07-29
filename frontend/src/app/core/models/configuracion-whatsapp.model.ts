export interface ConfiguracionWhatsapp {
  activo: boolean;
  twilio_account_sid: string | null;
  tiene_auth_token: boolean;
  twilio_numero_whatsapp: string | null;
  plantilla_content_sid: string | null;
  fecha_modificacion: string;
}

export interface ConfiguracionWhatsappUpdate {
  activo: boolean;
  twilio_account_sid: string | null;
  /** Vacío = conservar el auth token ya guardado */
  twilio_auth_token?: string | null;
  twilio_numero_whatsapp: string | null;
  plantilla_content_sid: string | null;
}

export interface OperacionResponse {
  exito: boolean;
  mensaje: string;
}
