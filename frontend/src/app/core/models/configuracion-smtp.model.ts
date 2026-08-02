/**
 * Cuenta de salida (SMTP) desde la que se despachan los informes.
 *
 * A diferencia de la casilla IMAP de entrada, que es de cada usuario, esta es
 * una sola cuenta del sistema y solo el administrador la configura.
 */

export interface ConfiguracionSmtp {
  activo: boolean;
  host: string;
  puerto: number;
  usar_tls: boolean;
  usar_ssl: boolean;
  usuario: string | null;
  /** El backend nunca devuelve la contraseña, solo si hay una guardada */
  tiene_password: boolean;
  remitente_email: string | null;
  remitente_nombre: string | null;
  ultimo_envio: string | null;
  ultimo_resultado: string | null;
}

export interface ConfiguracionSmtpUpdate {
  activo: boolean;
  host: string;
  puerto: number;
  usar_tls: boolean;
  usar_ssl: boolean;
  usuario: string | null;
  /** Vacío = conservar la contraseña ya guardada */
  password?: string | null;
  remitente_email: string | null;
  remitente_nombre: string | null;
}

export interface SmtpOperacionResponse {
  exito: boolean;
  mensaje: string;
}
