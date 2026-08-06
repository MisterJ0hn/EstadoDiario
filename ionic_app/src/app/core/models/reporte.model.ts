/**
 * Informes dinámicos: el usuario arma el informe eligiendo la fuente de datos y
 * los campos, lo guarda para reutilizarlo y lo recibe por correo o lo descarga.
 *
 * El backend acota siempre los datos al usuario autenticado (el admin ve todo),
 * por eso aquí nunca viaja un id de usuario.
 */

export type FuenteReporte = 'estado_diario' | 'movimientos' | 'agenda';

export interface CampoDisponible {
  clave: string;
  etiqueta: string;
}

export interface FuenteDisponible {
  fuente: FuenteReporte;
  etiqueta: string;
  campos: CampoDisponible[];
}

export interface CamposDisponiblesResponse {
  exito: boolean;
  fuentes: FuenteDisponible[];
}

/** Todos opcionales; los que no aplican a la fuente simplemente no se envían. */
export interface FiltrosReporte {
  /** estado_diario: no-leido | pendiente | resuelto — agenda: vigentes | finalizados */
  estado?: string;
  /** bajo | medio | alto */
  nivel?: string;
  jurisdiccion_id?: number;
  materia?: string;
  estado_causa?: string;
  /** ISO yyyy-MM-dd */
  fecha_desde?: string;
  /** ISO yyyy-MM-dd */
  fecha_hasta?: string;
}

export interface ReportePlantilla {
  id: number;
  nombre: string;
  descripcion: string | null;
  fuente: FuenteReporte;
  /** El ORDEN de esta lista es el orden de las columnas del Excel. */
  campos: string[];
  filtros: FiltrosReporte;
  fecha_creacion: string;
  fecha_modificacion: string;
  ultima_generacion: string | null;
  ultimo_resultado: string | null;
}

export interface ReportePlantillaRequest {
  nombre: string;
  descripcion?: string | null;
  fuente: FuenteReporte;
  campos: string[];
  filtros: FiltrosReporte;
}

export interface ReportePlantillaListResponse {
  exito: boolean;
  total: number;
  plantillas: ReportePlantilla[];
}

export interface GenerarReporteResponse {
  exito: boolean;
  mensaje: string;
  archivo: string | null;
}
