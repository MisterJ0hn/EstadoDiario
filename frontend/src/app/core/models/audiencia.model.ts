/**
 * Módulo Audiencias: las audiencias que el tribunal ya fijó.
 *
 * Es el tercer Excel del PJUD y el único que mira hacia adelante. De SOLO
 * CONSULTA, como Movimientos: la audiencia la fija el tribunal, acá solo se
 * informa. Lo que sí tiene es publicación en Google Calendar.
 */

export interface Audiencia {
  id: number;
  origen_id: number | null;
  /** Nombre de la hoja del Excel: Familia, Laboral, Penal */
  materia: string | null;
  /** "Rit" del Excel. La hoja Penal no lo trae. */
  rol: string | null;
  ruc: string | null;
  caratulado: string | null;
  tribunal: string | null;
  sala: string | null;
  tipo_audiencia: string | null;
  juez: string | null;
  /** Solo viene en la hoja Penal */
  estado: string | null;
  /** yyyy-MM-dd */
  fecha_audiencia: string;
  /** HH:mm:ss — hora de reloj del tribunal, no un instante UTC. Puede faltar. */
  hora: string | null;
  jurisdiccion_id: number | null;
  en_google_calendar: boolean;
  google_sync_error: string | null;
  // Datos heredados del archivo del que vino la fila
  rut: string | null;
  fecha_archivo: string | null;
  nombre_archivo: string | null;
}

export interface AudienciaListResponse {
  exito: boolean;
  total: number;
  page: number;
  total_pages: number;
  audiencias: Audiencia[];
}

export interface ConteoMateriaAudiencia {
  materia: string | null;
  total: number;
}

export interface AudienciaResumenResponse {
  exito: boolean;
  total: number;
  por_materia: ConteoMateriaAudiencia[];
  tipos_audiencia: string[];
}

export interface AudienciaFiltros {
  materia?: string;
  tipo_audiencia?: string;
  tribunal?: string;
  busqueda?: string;
  rut?: string;
  origen_id?: number;
  /** yyyy-MM-dd. Si no se manda, el backend asume hoy. */
  desde?: string;
  hasta?: string;
  /** Desactiva el "desde hoy" por defecto y muestra también el histórico. */
  incluir_pasadas?: boolean;
  page?: number;
  limit?: number;
}

export interface AudienciaUploadResponse {
  exito: boolean;
  mensaje?: string;
  rut?: string;
  fecha?: string;
  origen_id?: number;
  /** Nombre heredado del contrato común de carga de los tres tipos de archivo. */
  movimientos_importados?: number;
  audiencias_nuevas?: number;
  /** Ya venían de un archivo anterior traslapado: se refrescaron, no se duplicaron. */
  audiencias_actualizadas?: number;
  audiencias_sin_fecha?: number;
  por_materia?: Record<string, number>;
  /**
   * Nunca llega en audiencias —ese reporte no alimenta la cartera— pero la
   * pantalla de carga es una sola para los tres tipos y lee este campo del
   * resultado, sea cual sea el archivo.
   */
  aviso_cartera?: string | null;
}

export interface SincronizarGoogleResponse {
  exito: boolean;
  sincronizadas: number;
  pendientes: number;
  mensaje?: string;
}
