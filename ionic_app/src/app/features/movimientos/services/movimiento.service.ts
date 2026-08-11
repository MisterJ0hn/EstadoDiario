import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  MovimientoFiltros,
  MovimientoListResponse,
  MovimientoResumenResponse,
  MovimientoUploadResponse,
  MovimientoCorteListResponse,
} from '@core/models/movimiento.model';

/**
 * El backend acota los resultados al usuario autenticado (el admin ve todo),
 * así que aquí nunca se manda un id de usuario.
 */
@Injectable({ providedIn: 'root' })
export class MovimientoService {
  private readonly apiUrl = `${environment.apiUrl}/movimientos`;
  private http = inject(HttpClient);

  getMovimientos(filtros: MovimientoFiltros = {}): Observable<MovimientoListResponse> {
    return this.http.get<MovimientoListResponse>(this.apiUrl, {
      params: this.toParams(filtros),
    });
  }

  /** Conteo por materia (pestañas) y estados de causa disponibles (combo). */
  getResumen(filtros: MovimientoFiltros = {}): Observable<MovimientoResumenResponse> {
    // Ni materia ni paginación: el resumen es justamente el que entrega los
    // conteos por materia sobre el universo completo de los demás filtros.
    return this.http.get<MovimientoResumenResponse>(`${this.apiUrl}/resumen`, {
      params: this.toParams({
        estado_causa: filtros.estado_causa,
        tribunal: filtros.tribunal,
        busqueda: filtros.busqueda,
        rut: filtros.rut,
        origen_id: filtros.origen_id,
      }),
    });
  }

  /** Causas de corte: viven en otra tabla y se muestran en el submenú Corte. */
  getCortes(
    params: {
      tipo?: 'suprema' | 'apelaciones';
      busqueda?: string;
      corte?: string;
      fecha_desde?: string;
      fecha_hasta?: string;
      vigencia?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Observable<MovimientoCorteListResponse> {
    let httpParams = new HttpParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        httpParams = httpParams.set(clave, valor as string | number);
      }
    }
    return this.http.get<MovimientoCorteListResponse>(`${this.apiUrl}/cortes`, {
      params: httpParams,
    });
  }

  uploadFile(file: File, rut?: string, fecha?: string): Observable<MovimientoUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('rut', rut || '');
    formData.append('fecha', fecha || '');
    return this.http.post<MovimientoUploadResponse>(`${this.apiUrl}/upload`, formData);
  }

  private toParams(filtros: MovimientoFiltros): HttpParams {
    let params = new HttpParams();
    if (filtros.materia) params = params.set('materia', filtros.materia);
    if (filtros.estado_causa) params = params.set('estado_causa', filtros.estado_causa);
    if (filtros.tribunal) params = params.set('tribunal', filtros.tribunal);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.rut) params = params.set('rut', filtros.rut);
    if (filtros.origen_id) params = params.set('origen_id', filtros.origen_id);
    if (filtros.vigencia) params = params.set('vigencia', filtros.vigencia);
    if (filtros.page) params = params.set('page', filtros.page);
    if (filtros.limit) params = params.set('limit', filtros.limit);
    return params;
  }
}
