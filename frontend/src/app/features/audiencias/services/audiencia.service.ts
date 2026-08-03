import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  AudienciaFiltros,
  AudienciaListResponse,
  AudienciaResumenResponse,
  AudienciaUploadResponse,
  SincronizarGoogleResponse,
} from '@core/models/audiencia.model';

/**
 * El backend acota los resultados al usuario autenticado (el admin ve todo),
 * así que aquí nunca se manda un id de usuario.
 */
@Injectable({ providedIn: 'root' })
export class AudienciaService {
  private readonly apiUrl = `${environment.apiUrl}/audiencias`;
  private http = inject(HttpClient);

  getAudiencias(filtros: AudienciaFiltros = {}): Observable<AudienciaListResponse> {
    return this.http.get<AudienciaListResponse>(this.apiUrl, {
      params: this.toParams(filtros),
    });
  }

  /** Conteo por materia (pestañas) y tipos de audiencia disponibles (combo). */
  getResumen(filtros: AudienciaFiltros = {}): Observable<AudienciaResumenResponse> {
    // Ni materia ni paginación: el resumen es justamente el que entrega los
    // conteos por materia sobre el universo de los demás filtros.
    return this.http.get<AudienciaResumenResponse>(`${this.apiUrl}/resumen`, {
      params: this.toParams({
        tipo_audiencia: filtros.tipo_audiencia,
        tribunal: filtros.tribunal,
        busqueda: filtros.busqueda,
        rut: filtros.rut,
        origen_id: filtros.origen_id,
        desde: filtros.desde,
        hasta: filtros.hasta,
        incluir_pasadas: filtros.incluir_pasadas,
      }),
    });
  }

  /**
   * Audiencias de una ventana de fechas para el calendario. El rango es
   * obligatorio: las audiencias se acumulan sin techo y no se traen todas.
   */
  getCalendario(desde: string, hasta: string): Observable<AudienciaListResponse> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<AudienciaListResponse>(`${this.apiUrl}/calendario`, { params });
  }

  uploadFile(file: File, rut?: string, fecha?: string): Observable<AudienciaUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('rut', rut || '');
    formData.append('fecha', fecha || '');
    return this.http.post<AudienciaUploadResponse>(`${this.apiUrl}/upload`, formData);
  }

  /** Reintento manual: publica en Google las audiencias futuras que falten. */
  sincronizarGoogle(): Observable<SincronizarGoogleResponse> {
    return this.http.post<SincronizarGoogleResponse>(`${this.apiUrl}/sincronizar-google`, {});
  }

  private toParams(filtros: AudienciaFiltros): HttpParams {
    let params = new HttpParams();
    if (filtros.materia) params = params.set('materia', filtros.materia);
    if (filtros.tipo_audiencia) params = params.set('tipo_audiencia', filtros.tipo_audiencia);
    if (filtros.tribunal) params = params.set('tribunal', filtros.tribunal);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.rut) params = params.set('rut', filtros.rut);
    if (filtros.origen_id) params = params.set('origen_id', filtros.origen_id);
    if (filtros.desde) params = params.set('desde', filtros.desde);
    if (filtros.hasta) params = params.set('hasta', filtros.hasta);
    // Solo se manda cuando es true: el backend ya asume false y mandarlo
    // siempre ensuciaría la URL.
    if (filtros.incluir_pasadas) params = params.set('incluir_pasadas', true);
    if (filtros.page) params = params.set('page', filtros.page);
    if (filtros.limit) params = params.set('limit', filtros.limit);
    return params;
  }
}
