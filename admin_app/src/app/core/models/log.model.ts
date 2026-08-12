/**
 * Bitácora de actividad de un cliente.
 *
 * Es la otra cara de `admin_api/app/schemas/logs.py`. Los registros viven en la
 * base de cada cliente, no en la principal: la consola los pide por cliente y
 * el servicio abre esa base para responder.
 */

export interface LogActividad {
  id: number;
  fecha_hora: string;
  /** Módulo de la aplicación del estudio: estado_diario, audiencias, reportes… */
  modulo: string;
  /** Qué se hizo: crear, editar, eliminar, importar, login. */
  accion: string;
  usuario_id: number | null;
  /**
   * Quién la hizo. Nulo en los intentos de login fallidos, donde todavía no hay
   * usuario resuelto: es información, no un dato que falte.
   */
  usuario: string | null;
  ip: string | null;
  detalle: string | null;
}

export interface LogActividadesListResponse {
  exito: boolean;
  cliente_id: number;
  cliente_nombre: string;
  total: number;
  page: number;
  total_pages: number;
  /** Los que existen en ESTA bitácora, para armar los filtros. */
  modulos: string[];
  acciones: string[];
  registros: LogActividad[];
}

export interface FiltroLogs {
  modulo?: string | null;
  accion?: string | null;
  desde?: string | null;
  hasta?: string | null;
  /** Texto dentro del detalle. */
  q?: string | null;
  page?: number;
  per_page?: number;
}
