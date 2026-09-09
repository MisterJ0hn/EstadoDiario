import { Injectable } from '@angular/core';
import { FechaInicialResponse } from '@core/models/estado-diario.model';

export type TabMovimientos = 'no-leidos' | 'leidos' | 'pendientes';

/** Lo que el usuario tiene aplicado en el listado de Estado Diario. */
export interface EstadoFiltrosMovimientos {
  tab: TabMovimientos;
  jurisdiccion: number | null;
  fechaDesde: string;
  fechaHasta: string;
  rut: string;
  page: number;
  /** De dónde salió la fecha puesta ("ayer" / "ultimo" / null): rótulo del chip. */
  motivoFecha: FechaInicialResponse['motivo'];
}

/**
 * Recuerda el filtro del listado de Estado Diario mientras dure la sesión.
 *
 * El componente del listado se destruye al entrar a una causa y se vuelve a
 * crear al volver (Angular no reusa la ruta), así que sin esto el filtro y la
 * pestaña se perdían en cada ida y vuelta. Se guarda en memoria a propósito: un
 * F5 lo limpia y ahí vuelve a aplicarse el día por defecto.
 *
 * `get()` devuelve `null` mientras el listado no se haya abierto ni una vez en
 * la sesión: recién en ese primer ingreso se pide el día sugerido por el
 * backend. Después, incluso "sin filtros" es un estado que se recuerda.
 */
@Injectable({ providedIn: 'root' })
export class MovimientosFiltrosStore {
  private estado: EstadoFiltrosMovimientos | null = null;

  get(): EstadoFiltrosMovimientos | null {
    return this.estado ? { ...this.estado } : null;
  }

  set(estado: EstadoFiltrosMovimientos): void {
    this.estado = { ...estado };
  }
}
