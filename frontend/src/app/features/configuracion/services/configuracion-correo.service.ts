import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ConfiguracionCorreo,
  CorreoLogListResponse,
  OperacionResponse,
  RevisarResponse,
} from '@core/models/configuracion-correo.model';

/**
 * Casilla de ingesta del estudio, en **solo lectura**.
 *
 * La configura la plataforma (`/admin/clientes/{id}/inbox`), no el estudio: de
 * qué casilla se lee determina en qué base entra cada archivo. Al estudio le
 * queda mirar cómo va la ingesta, y solo a su administrador.
 */
@Injectable({ providedIn: 'root' })
export class ConfiguracionCorreoService {
  private readonly apiUrl = `${environment.apiUrl}/configuracion-correo`;
  private http = inject(HttpClient);

  get(): Observable<ConfiguracionCorreo> {
    return this.http.get<ConfiguracionCorreo>(this.apiUrl);
  }

  /** Comprueba que la casilla responda, con la credencial ya guardada. */
  probarConexion(): Observable<OperacionResponse> {
    return this.http.post<OperacionResponse>(`${this.apiUrl}/probar-conexion`, {});
  }

  revisarAhora(): Observable<RevisarResponse> {
    return this.http.post<RevisarResponse>(`${this.apiUrl}/revisar`, {});
  }

  getLog(page = 1, perPage = 20, resultado?: string): Observable<CorreoLogListResponse> {
    let params = new HttpParams().set('page', page).set('per_page', perPage);
    if (resultado) {
      params = params.set('resultado', resultado);
    }
    return this.http.get<CorreoLogListResponse>(`${this.apiUrl}/log`, { params });
  }
}
