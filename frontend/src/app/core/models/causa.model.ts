/**
 * Cartera de causas del estudio: todas sus causas, se hayan movido o no.
 *
 * No confundir con Movimientos (el estado procesal de lo que se tramita) ni
 * con Estado Diario (lo que se movió un día). Son tres reportes distintos del
 * PJUD y cada uno tiene su tabla.
 */
export interface Causa {
  id: number;
  origen_id: number;
  /** Nombre de la hoja del Excel: Civil, Laboral, Penal, Cobranza, Familia. */
  materia: string | null;
  /** Solo la hoja Penal lo trae. */
  tipo_causa: string | null;
  /** "Rol" en Civil/Laboral/Cobranza, "Rit" en Penal/Familia: mismo dato. */
  rol: string | null;
  ruc: string | null;
  tribunal: string | null;
  fecha_ingreso: string | null;
  caratulado: string | null;
  estado_causa: string | null;
  institucion: string | null;
  jurisdiccion_id: number | null;
  rut: string | null;
  fecha_archivo: string | null;
  nombre_archivo: string | null;
  /**
   * Última vez que la causa apareció en el estado diario, en movimientos o en
   * una audiencia ya celebrada. Null = no consta en los reportes cargados, que
   * NO es lo mismo que "no se movió".
   */
  ultima_actividad?: string | null;
  /** De cuál de los tres reportes salió esa fecha. */
  origen_actividad?: string | null;
  /** Próxima audiencia agendada, desde hoy. */
  proxima_audiencia?: string | null;
}

export interface CausaListResponse {
  exito: boolean;
  total: number;
  page: number;
  total_pages: number;
  causas: Causa[];
}

export interface ConteoMateria {
  materia: string | null;
  total: number;
}

export interface CausaResumenResponse {
  exito: boolean;
  total: number;
  por_materia: ConteoMateria[];
  estados_causa: string[];
}

/**
 * Vigencia de una causa de la cartera.
 *
 * `vigentes` es todo lo que NO está concluido ni fallado —incluidas las que no
 * informan estado, como las de Cobranza, cuya hoja no trae la columna—, y es
 * lo que se ve por defecto: la cartera con la que el estudio trabaja hoy.
 */
export type VigenciaCausa = 'vigentes' | 'finalizadas';

export interface CausaFiltros {
  /** Solo las que no aparecen en ningún reporte hace más de N meses. */
  sin_actividad_meses?: number;
  /** Solo las que tienen audiencia dentro de los próximos N días. */
  con_audiencia_dias?: number;
  /** `actividad` | `audiencia`. Por defecto, fecha de ingreso. */
  orden?: string;
  materia?: string;
  estado_causa?: string;
  tribunal?: string;
  busqueda?: string;
  origen_id?: number;
  /** Ausente = las dos. La pantalla siempre manda una de las dos. */
  vigencia?: VigenciaCausa;
  page?: number;
  limit?: number;
}

export type TipoCorteCausa = 'suprema' | 'apelaciones';

/**
 * Causa de corte del reporte de Causas.
 *
 * Ojo: hay tres tipos de "corte" en el sistema (estado diario, movimientos y
 * éste) y traen columnas distintas. Acá el estado se llama `estado_procesal`
 * porque así lo encabeza la hoja de Apelaciones; Suprema lo llama "Estado
 * Causa" y el backend los unifica.
 */
export interface CausaCorte {
  id: number;
  tipo: TipoCorteCausa;
  rol: string | null;
  era: string | null;
  fecha_ingreso: string | null;
  caratulado: string | null;
  estado_procesal: string | null;
  institucion: string | null;
  /** Las tres siguientes solo vienen en la hoja de Apelaciones. */
  corte: string | null;
  ubicacion: string | null;
  fecha_ubicacion: string | null;
  fecha_archivo: string | null;
}

export interface CausaCorteListResponse {
  exito: boolean;
  total: number;
  page: number;
  total_pages: number;
  cortes: CausaCorte[];
  cortes_disponibles: string[];
}

export interface CargarCausasResponse {
  exito: boolean;
  mensaje: string;
  origen_id: number;
  causas_importadas: number;
  cortes_importados: number;
  por_materia: Record<string, number>;
}

/**
 * Movimientos de una causa Civil consultados EN VIVO al PJUD
 * (api-pjud.codifica.cl), no al Excel de Movimientos que sube el estudio.
 * Solo existe para causas de materia Civil: es lo único que esa API expone.
 */
export interface PjudCuaderno {
  id: number;
  nombre: string;
}

export interface PjudCausaDetalle {
  identificador: string;
  estado: string;
  rol: string | null;
  caratula: string | null;
  tribunal: string | null;
  fecha_ingreso: string | null;
  etapa: string | null;
  estado_proceso: string | null;
  est_adm: string | null;
  fecha_ultima_sincronizacion: string | null;
  cuadernos: PjudCuaderno[];
}

export interface PjudMovimientoItem {
  folio: number | null;
  etapa: string | null;
  tramite: string | null;
  descripcion_tramite: string | null;
  fecha_tramite: string | null;
  foja: number | null;
  doc: string | null;
  /** Armada por el backend a partir de `doc`; null si el trámite no trae documento. */
  documento_url: string | null;
}

export interface PjudLitiganteItem {
  participante: string | null;
  rut: string | null;
  persona: string | null;
  razon_social: string | null;
}

export interface PjudNotificacionItem {
  tipo_notificacion: string | null;
  estado_notificacion: string | null;
  fecha_tramite: string | null;
  tipo_part: string | null;
  nombre: string | null;
  tramite: string | null;
  observacion_fallida: string | null;
}

export interface PjudEscritoResolverItem {
  doc: string | null;
  tipo_escrito: string | null;
  solicitante: string | null;
  fecha_ingreso: string | null;
}

export interface PjudMovimientosResponse {
  exito: boolean;
  causa: PjudCausaDetalle;
  historia: PjudMovimientoItem[];
  litigantes: PjudLitiganteItem[];
  notificaciones: PjudNotificacionItem[];
  escritos_resolver: PjudEscritoResolverItem[];
}
