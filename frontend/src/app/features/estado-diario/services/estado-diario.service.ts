import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  OrigenListResponse,
  MovimientoListResponse,
  Movimiento,
  AgendaListResponse,
  JurisdiccionListResponse,
  ApiResponse,
  CalendarioResponse,
  FinalizarAgendaRequest,
  MarcarPendienteRequest,
} from '@core/models/estado-diario.model';

@Injectable({ providedIn: 'root' })
export class EstadoDiarioService {
  private readonly apiUrl = `${environment.apiUrl}/estado-diario`;
  private readonly jurisdiccionUrl = `${environment.apiUrl}/jurisdicciones`;

  constructor(private http: HttpClient) {}

  // ── Jurisdicciones ─────────────────────
  getJurisdicciones(): Observable<JurisdiccionListResponse> {
    return this.http.get<JurisdiccionListResponse>(this.jurisdiccionUrl);
  }

  // ── Orígenes ───────────────────────────
  getOrigenes(page = 1, perPage = 20): Observable<OrigenListResponse> {
    const params = new HttpParams().set('page', page).set('per_page', perPage);
    return this.http.get<OrigenListResponse>(`${this.apiUrl}/origenes`, { params });
  }

  deleteOrigen(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/origenes/${id}`);
  }

  uploadFile(file: File, rut?: string, fecha?: string): Observable<ApiResponse & { origen_id?: number; movimientos_importados?: number; rut?: string; fecha?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('rut', rut || '');
    formData.append('fecha', fecha || '');
    return this.http.post<ApiResponse & { origen_id?: number; movimientos_importados?: number; rut?: string; fecha?: string }>(
      `${this.apiUrl}/upload`,
      formData
    );
  }

  // ── Movimientos ────────────────────────
  getMovimientos(
    filter: 'no-leidos' | 'leidos' | 'pendientes',
    params: {
      jurisdiccion?: number;
      fecha_desde?: string;
      fecha_hasta?: string;
      rut?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Observable<MovimientoListResponse> {
    let httpParams = new HttpParams();
    if (params.jurisdiccion) httpParams = httpParams.set('jurisdiccion', params.jurisdiccion);
    if (params.fecha_desde) httpParams = httpParams.set('fecha_desde', params.fecha_desde);
    if (params.fecha_hasta) httpParams = httpParams.set('fecha_hasta', params.fecha_hasta);
    if (params.rut) httpParams = httpParams.set('rut', params.rut);
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.limit) httpParams = httpParams.set('limit', params.limit);

    return this.http.get<MovimientoListResponse>(`${this.apiUrl}/${filter}`, { params: httpParams });
  }

  getMovimientosByOrigen(origenId: number): Observable<{ exito: boolean; total: number; movimientos: Movimiento[] }> {
    return this.http.get<{ exito: boolean; total: number; movimientos: Movimiento[] }>(
      `${this.apiUrl}/origenes/${origenId}/movimientos`
    );
  }

  getMovimientoDetalle(id: number): Observable<{ exito: boolean; movimiento: Movimiento }> {
    return this.http.get<{ exito: boolean; movimiento: Movimiento }>(`${this.apiUrl}/${id}`);
  }

  // ── Acciones ───────────────────────────
  marcarLeido(id: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${id}/leido`, {});
  }

  marcarPendiente(id: number, data: MarcarPendienteRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${id}/pendiente`, data);
  }

  // ── Agendas / Recordatorios ─────────────
  getAgendas(estadoDiarioId: number): Observable<AgendaListResponse> {
    return this.http.get<AgendaListResponse>(`${this.apiUrl}/${estadoDiarioId}/agendas`);
  }

  crearAgenda(
    estadoDiarioId: number,
    data: { detalle: string; fecha_hora: string; username?: string }
  ): Observable<ApiResponse & { id?: number }> {
    return this.http.post<ApiResponse & { id?: number }>(`${this.apiUrl}/${estadoDiarioId}/agenda`, data);
  }

  finalizarAgenda(agendaId: number, data: FinalizarAgendaRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/agendas/${agendaId}/finalizar`, data);
  }

  getCalendario(): Observable<CalendarioResponse> {
    return this.http.get<CalendarioResponse>(`${this.apiUrl}/calendario`);
  }
}
