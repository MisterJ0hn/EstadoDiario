export interface Jurisdiccion {
  id: number;
  nombre: string;
}

export interface JurisdiccionListResponse {
  exito: boolean;
  total: number;
  jurisdicciones: Jurisdiccion[];
}

/** Tipo de archivo cargado: separa las pestañas de la vista Archivos. */
export type TipoOrigen = 'estado_diario' | 'movimientos' | 'audiencias';

export interface EstadoDiarioOrigen {
  id: number;
  rut: string | null;
  fecha: string | null;
  tipo: TipoOrigen;
  nombre_archivo: string | null;
  url: string | null;
  fecha_carga: string;
  usuario_carga: string | null;
  total_movimientos: number;
}

export interface OrigenListResponse {
  exito: boolean;
  total: number;
  page: number;
  total_pages: number;
  origenes: EstadoDiarioOrigen[];
}

export interface Movimiento {
  id: number;
  jurisdiccion: string | null;
  jurisdiccion_id: number | null;
  rol: string | null;
  rol_unico: string | null;
  fecha_ingreso: string | null;
  caratulado: string | null;
  tribunal: string | null;
  estado: string | null;
  tipo_causa: string | null;
  ubicacion: string | null;
  fecha_ubicacion: string | null;
  corte: string | null;
  leido: boolean;
  fecha_leido: string | null;
  /** Comentario opcional que se deja al marcar el registro como resuelto */
  observacion_resuelto: string | null;
  pendiente: boolean;
  nivel_pendiente: string | null;
  fecha_pendiente: string | null;
  usuario_pendiente: string | null;
  rut: string | null;
  fecha_estado_diario: string | null;
}

export interface MovimientoListResponse {
  exito: boolean;
  total: number;
  page: number;
  total_pages: number;
  movimientos: Movimiento[];
}

export type NivelRecordatorio = 'bajo' | 'medio' | 'alto';

export interface Agenda {
  id: number;
  detalle: string;
  fecha_hora: string;
  fecha_hora_registro: string;
  nivel: NivelRecordatorio;
  finalizado: boolean;
  fecha_finalizacion: string | null;
  notificar_whatsapp: boolean;
  fecha_hora_whatsapp: string | null;
  enviado: boolean;
  fecha_envio: string | null;
  google_event_id: string | null;
  google_sync_error: string | null;
  usuario_registro: string | null;
}

export interface AgendaListResponse {
  exito: boolean;
  total: number;
  agendas: Agenda[];
}

export interface MarcarPendienteRequest {
  nivel: NivelRecordatorio;
  username?: string;
  mensaje?: string;
  fecha_hora?: string;
  notificar_whatsapp?: boolean;
  whatsapp_telefono?: string | null;
  fecha_hora_whatsapp?: string;
}

export interface RecordatorioVigente {
  id: number;
  estado_diario_id: number;
  detalle: string;
  fecha_hora: string;
  nivel: NivelRecordatorio;
  usuario_registro: string | null;
  movimiento_caratulado: string | null;
  movimiento_rol: string | null;
  movimiento_tribunal: string | null;
}

export interface CalendarioResponse {
  exito: boolean;
  total: number;
  recordatorios: RecordatorioVigente[];
}

export interface FinalizarAgendaRequest {
  marcar_resuelto: boolean;
}

export interface ApiResponse {
  exito: boolean;
  mensaje?: string;
}
