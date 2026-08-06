import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ConectarGoogleResponse,
  EstadoConexionGoogle,
} from '@core/models/google-calendar.model';
import { ApiResponse } from '@core/models/estado-diario.model';

/** Conexión OAuth del usuario actual con SU Google Calendar personal. */
@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {
  private readonly apiUrl = `${environment.apiUrl}/google-calendar`;
  private http = inject(HttpClient);

  estado(): Observable<EstadoConexionGoogle> {
    return this.http.get<EstadoConexionGoogle>(`${this.apiUrl}/estado`);
  }

  conectar(): Observable<ConectarGoogleResponse> {
    return this.http.get<ConectarGoogleResponse>(`${this.apiUrl}/conectar`);
  }

  desconectar(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/desconectar`, {});
  }
}
