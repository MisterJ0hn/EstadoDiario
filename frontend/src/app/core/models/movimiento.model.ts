import { VigenciaCausa } from './causa.model';
/**
 * Módulo Movimientos: reporte del estado procesal de las causas.
 *
 * Es un Excel distinto al del estado diario y es de SOLO CONSULTA: no existen
 * acciones (leído / pendiente / agenda) porque no hay nada que despachar.
 */

export interface Movimiento {
  id: number;
  origen_id: number;
  /** Nombre de la hoja del Excel: Civil, Familia, Laboral, Cobranza, Penal, Corte Apelaciones, Corte Suprema */
  materia: string | null;
  rol: string | null;
  /** Solo viene en las hojas de Corte */
  era: string | null;
  tribunal: string | null;
  /** Solo viene en las hojas de Corte */
  corte: string | null;
  caratulado: string | null;
  fecha_ingreso: string | null;
  estado_causa: string | null;
  institucion: string | null;
  /** Solo viene en las hojas de Corte */
  ubicacion: string | null;
  /** Solo viene en las hojas de Corte */
  fecha_ubicacion: string | null;
  jurisdiccion_id: number | null;
  // Datos heredados del archivo del que vino la fila
  rut: string | null;
  fecha_archivo: string | null;
  nombre_archivo: string | null;
}

export interface MovimientoListResponse {
  exito: boolean;
  total: number;
  page: number;
  total_pages: number;
  movimientos: Movimiento[];
}

export interface ConteoMateria {
  materia: string | null;
  total: number;
}

export interface MovimientoResumenResponse {
  exito: boolean;
  total: number;
  por_materia: ConteoMateria[];
  estados_causa: string[];
}

export interface MovimientoFiltros {
  materia?: string;
  estado_causa?: string;
  tribunal?: string;
  busqueda?: string;
  rut?: string;
  origen_id?: number;
  /** Interruptor de pantalla: qué mitad de la cartera se mira. */
  vigencia?: VigenciaCausa;
  page?: number;
  limit?: number;
}

export interface MovimientoUploadResponse {
  exito: boolean;
  mensaje?: string;
  rut?: string;
  fecha?: string;
  origen_id?: number;
  movimientos_importados?: number;
  por_materia?: Record<string, number>;
  /**
   * Lo que el cruce tenga que advertir, o null. Hoy es una sola cosa: que la
   * cartera se armó con estos reportes porque falta el de Causas.
   */
  aviso_cartera?: string | null;
  causas_agregadas?: number;
}

// ── Causas de corte del reporte de Movimientos ───────────────────────────
// Tabla propia: las hojas de corte traen Era, Ubicación y Fecha Ubicación, que
// las de materia no tienen, y les falta el tribunal.

export interface MovimientoCorte {
  id: number;
  tipo: 'suprema' | 'apelaciones';
  rol: string | null;
  era: string | null;
  fecha_ingreso: string | null;
  caratulado: string | null;
  estado_causa: string | null;
  institucion: string | null;
  /** Solo Corte de Apelaciones. */
  corte: string | null;
  ubicacion: string | null;
  fecha_ubicacion: string | null;
  fecha_archivo: string | null;
}

export interface MovimientoCorteListResponse {
  exito: boolean;
  total: number;
  page: number;
  total_pages: number;
  cortes: MovimientoCorte[];
  cortes_disponibles: string[];
}
