export interface Jurisdiccion {
  id: number;
  nombre: string;
}

export interface JurisdiccionListResponse {
  exito: boolean;
  total: number;
  jurisdicciones: Jurisdiccion[];
}

export interface EstadoDiarioOrigen {
  id: number;
  rut: string | null;
  fecha: string | null;
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

export interface Agenda {
  id: number;
  detalle: string;
  fecha_hora: string;
  fecha_hora_registro: string;
  enviado: boolean;
  fecha_envio: string | null;
  usuario_registro: string | null;
}

export interface AgendaListResponse {
  exito: boolean;
  total: number;
  agendas: Agenda[];
}

export interface ApiResponse {
  exito: boolean;
  mensaje?: string;
}
