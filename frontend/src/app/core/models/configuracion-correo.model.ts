export interface ConfiguracionCorreo {
  activo: boolean;
  host: string;
  puerto: number;
  usar_ssl: boolean;
  usuario: string | null;
  carpeta: string;
  /** El backend nunca devuelve la contraseña, solo si hay una guardada */
  tiene_password: boolean;
  remitentes_permitidos: string | null;
  asunto_contiene: string | null;
  max_tamano_mb: number;
  hora_ejecucion: string | null;
  marcar_como_leido: boolean;
  ultima_ejecucion: string | null;
  ultimo_resultado: string | null;
}

export interface ConfiguracionCorreoUpdate {
  activo: boolean;
  host: string;
  puerto: number;
  usar_ssl: boolean;
  usuario: string | null;
  /** Vacío = conservar la contraseña ya guardada */
  password?: string | null;
  carpeta: string;
  remitentes_permitidos: string | null;
  asunto_contiene: string | null;
  max_tamano_mb: number;
  hora_ejecucion: string | null;
  marcar_como_leido: boolean;
}

export interface OperacionResponse {
  exito: boolean;
  mensaje: string;
}

export interface RevisarResponse extends OperacionResponse {
  procesados: number;
  importados: number;
  descartados: number;
  duplicados: number;
  errores: number;
}

export type ResultadoCorreo =
  | 'importado'
  | 'descartado'
  | 'duplicado'
  | 'error'
  | 'conexion';

export interface CorreoLog {
  id: number;
  fecha: string;
  remitente: string | null;
  asunto: string | null;
  nombre_archivo: string | null;
  resultado: ResultadoCorreo;
  detalle: string | null;
  estado_diario_origen_id: number | null;
  movimientos_importados: number | null;
  disparo: string;
}

export interface CorreoLogListResponse {
  exito: boolean;
  total: number;
  page: number;
  total_pages: number;
  registros: CorreoLog[];
}
