/**
 * Log de consultas a api-pjud.codifica.cl.
 *
 * Es la otra cara de `admin_api/app/schemas/pjud_logs.py`. A diferencia de la
 * bitácora por cliente, estas filas viven todas en la base principal —la
 * credencial de api-pjud es de la plataforma— así que se piden de una vez, con
 * filtro opcional por cliente.
 */

export type ResultadoPjud = 'listo' | 'sincronizando' | 'error';

export interface PjudLlamado {
  id: number;
  fecha_hora: string;
  cliente_id: number | null;
  /** Nombre del estudio. Nulo si el cliente se borró. */
  cliente_nombre: string | null;
  rol: string | null;
  tribunal: string | null;
  /** true = el usuario apretó "Actualizar desde el PJUD". */
  forzar: boolean;
  resultado: ResultadoPjud;
  http_status: number | null;
  /** El aviso de "sincronizando" o el texto del error. Nulo en 'listo'. */
  mensaje: string | null;
  duracion_ms: number | null;
}

export interface PjudLlamadosListResponse {
  exito: boolean;
  total: number;
  page: number;
  total_pages: number;
  /** Conteo por resultado de los últimos 7 días. */
  resumen: Partial<Record<ResultadoPjud, number>>;
  registros: PjudLlamado[];
}

export interface FiltroPjudLlamados {
  cliente_id?: number | null;
  resultado?: ResultadoPjud | '' | null;
  desde?: string | null;
  hasta?: string | null;
  /** Texto en rol, tribunal o mensaje. */
  q?: string | null;
  page?: number;
  per_page?: number;
}
