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
