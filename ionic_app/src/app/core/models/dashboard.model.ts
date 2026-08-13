/** Payload del dashboard de gestión (`GET /api/v1/dashboard`).
 *
 * El backend devuelve todo en una sola respuesta a propósito: la página hace
 * una única llamada y pinta todos los gráficos juntos.
 */

/**
 * Las tarjetas de arriba.
 *
 * **Ninguna de las que se muestran hoy mira el período.** Son el estado del
 * estudio ahora; el filtro de días gobierna solo los gráficos. Los campos que
 * sí son del período siguen acá porque los usan los gráficos y el estado vacío
 * de la pantalla, pero ya no tienen tarjeta propia.
 */
export interface DashboardKpis {
  /** Ni resueltos ni pendientes: el "inbox". No se acota al período. */
  sin_revisar: number;
  /**
   * Causas DISTINTAS (rol + tribunal) de la cartera actual. La misma causa
   * viene repetida en el Excel del PJUD, así que contar filas la infla.
   * Vigente le gana a finalizada: las dos cifras son disjuntas y suman el
   * total de la cartera.
   */
  causas_activas: number;
  causas_finalizadas: number;
  /**
   * Por ahora, TODAS las audiencias cargadas: el PJUD no informa asistencia y
   * la tabla no tiene el campo. Cuando exista, cambia el filtro del backend y
   * esta tarjeta ya está puesta.
   */
  audiencias_no_asistidas: number;
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

export interface AudienciaDia {
  dia: string;
  total: number;
  /** Desglose del día: materia -> cantidad. Solo trae las que tienen valor. */
  materias: Record<string, number>;
}

export interface Audiencias {
  desde: string;
  hasta: string;
  total: number;
  /** Series del gráfico, en orden fijo alfabético (no por volumen). */
  materias: string[];
  totales_por_materia: ConteoEtiqueta[];
  por_dia: AudienciaDia[];
  /** Hasta dónde alcanzan las audiencias cargadas; `null` = no hay ninguna. */
  cubierto_hasta: string | null;
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
  /** Único bloque que mira hacia adelante: audiencias por venir. */
  audiencias: Audiencias;
  aviso_carga: AvisoCarga;
}
