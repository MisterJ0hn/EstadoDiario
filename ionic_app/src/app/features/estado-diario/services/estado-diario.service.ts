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
  TipoOrigen,
  CorteListResponse,
  TipoCorte,
  FechaInicialResponse,
} from '@core/models/estado-diario.model';

@Injectable({ providedIn: 'root' })
export class EstadoDiarioService {
  private readonly apiUrl = `${environment.apiUrl}/estado-diario`;
  private readonly jurisdiccionUrl = `${environment.apiUrl}/jurisdicciones`;

  constructor(private http: HttpClient) {}

  // ── Jurisdicciones ─────────────────────
  /**
   * `excluirCorte` deja fuera Corte Suprema y Corte de Apelaciones. Se usa en
   * el filtro de Materia: esas causas se movieron a su propia tabla, así que
   * ofrecerlas ahí no filtraría nada.
   */
  getJurisdicciones(excluirCorte = false): Observable<JurisdiccionListResponse> {
    const params = excluirCorte ? new HttpParams().set('excluir_corte', true) : undefined;
    return this.http.get<JurisdiccionListResponse>(this.jurisdiccionUrl, { params });
  }

  // ── Causas de corte ────────────────────
  getCortes(
    params: {
      tipo?: TipoCorte;
      busqueda?: string;
      corte?: string;
      fecha_desde?: string;
      fecha_hasta?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Observable<CorteListResponse> {
    let httpParams = new HttpParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        httpParams = httpParams.set(clave, valor as string | number);
      }
    }
    return this.http.get<CorteListResponse>(`${this.apiUrl}/cortes`, { params: httpParams });
  }

  // ── Día por defecto ────────────────────
  /**
   * Qué día proponer al abrir las pantallas de estado diario: ayer, o el
   * último con datos si ayer no tiene.
   *
   * Lo decide el backend a propósito. Depende de qué hay cargado en la base y
   * de qué día es hoy EN CHILE, y el reloj del navegador no sabe ninguna de
   * las dos cosas. Ver `shared/fecha-inicial.ts`.
   */
  getFechaInicial(): Observable<FechaInicialResponse> {
    return this.http.get<FechaInicialResponse>(`${this.apiUrl}/fecha-inicial`);
  }

  // ── Orígenes ───────────────────────────
  getOrigenes(
    page = 1,
    perPage = 20,
    tipo?: TipoOrigen,
    fechaDesde?: string,
    fechaHasta?: string
  ): Observable<OrigenListResponse> {
    let params = new HttpParams().set('page', page).set('per_page', perPage);
    if (tipo) params = params.set('tipo', tipo);
    if (fechaDesde) params = params.set('fecha_desde', fechaDesde);
    if (fechaHasta) params = params.set('fecha_hasta', fechaHasta);
    return this.http.get<OrigenListResponse>(`${this.apiUrl}/origenes`, { params });
  }

  deleteOrigen(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/origenes/${id}`);
  }

  uploadFile(file: File, rut?: string, fecha?: string): Observable<ApiResponse & { origen_id?: number; movimientos_importados?: number; rut?: string; fecha?: string; aviso_cartera?: string | null; causas_agregadas?: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('rut', rut || '');
    formData.append('fecha', fecha || '');
    return this.http.post<ApiResponse & { origen_id?: number; movimientos_importados?: number; rut?: string; fecha?: string; aviso_cartera?: string | null; causas_agregadas?: number }>(
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
  /** La observación es opcional; si no se indica se manda el body vacío. */
  marcarLeido(id: number, observacion?: string | null): Observable<ApiResponse> {
    const body = observacion?.trim() ? { observacion: observacion.trim() } : {};
    return this.http.post<ApiResponse>(`${this.apiUrl}/${id}/leido`, body);
  }

  /** Deshace un "resuelto": vuelve el movimiento a No Leído. */
  marcarNoLeido(id: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${id}/no-leido`, {});
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
