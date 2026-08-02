/** Payload del dashboard de gestión (`GET /api/v1/dashboard`).
 *
 * El backend devuelve todo en una sola respuesta a propósito: la página hace
 * una única llamada y pinta todos los gráficos juntos.
 */

export interface DashboardKpis {
  /** Ni resueltos ni pendientes: el "inbox". No se acota al período. */
  sin_revisar: number;
  pendientes: number;
  resueltos_periodo: number;
  recibidos_periodo: number;
  recordatorios_vigentes: number;
  /** Métrica de alarma: vencidos y sin finalizar. */
  recordatorios_atrasados: number;
  /** `null` = no hubo resoluciones en el período (distinto de 0 días). */
  promedio_resolucion_dias: number | null;
}

export interface ConteoNivel {
  /** bajo | medio | alto */
  nivel: string;
  total: number;
}

export interface PuntoDiario {
  dia: string;
  recibidos: number;
  resueltos: number;
}

export interface PuntoResolucion {
  dia: string;
  dias_promedio: number;
}

export interface Composicion {
  no_leidos: number;
  pendientes: number;
  resueltos: number;
}

export interface ConteoEtiqueta {
  etiqueta: string;
  total: number;
}

export interface Cumplimiento {
  a_tiempo: number;
  atrasados: number;
}

export interface AvisoCarga {
  sin_carga_reciente: boolean;
  ultima_fecha_archivo: string | null;
  dias_habiles_revisados: number;
  mensaje: string | null;
}

export interface DashboardResponse {
  exito: boolean;
  dias: number;
  desde: string;
  hasta: string;
  kpis: DashboardKpis;
  atrasados_por_nivel: ConteoNivel[];
  evolucion_diaria: PuntoDiario[];
  evolucion_resolucion: PuntoResolucion[];
  composicion: Composicion;
  por_tribunal: ConteoEtiqueta[];
  por_jurisdiccion: ConteoEtiqueta[];
  cumplimiento: Cumplimiento;
  aviso_carga: AvisoCarga;
}
