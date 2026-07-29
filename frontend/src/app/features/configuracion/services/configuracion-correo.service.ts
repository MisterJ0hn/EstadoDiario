import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ConfiguracionCorreo,
  ConfiguracionCorreoUpdate,
  CorreoLogListResponse,
  OperacionResponse,
  RevisarResponse,
} from '@core/models/configuracion-correo.model';

@Injectable({ providedIn: 'root' })
export class ConfiguracionCorreoService {
  private readonly apiUrl = `${environment.apiUrl}/configuracion-correo`;
  private http = inject(HttpClient);

  get(): Observable<ConfiguracionCorreo> {
    return this.http.get<ConfiguracionCorreo>(this.apiUrl);
  }

  save(datos: ConfiguracionCorreoUpdate): Observable<ConfiguracionCorreo> {
    return this.http.put<ConfiguracionCorreo>(this.apiUrl, datos);
  }

  /** `password` permite probar una contraseña recién escrita sin guardarla */
  probarConexion(password?: string | null): Observable<OperacionResponse> {
    return this.http.post<OperacionResponse>(`${this.apiUrl}/probar-conexion`, {
      password: password || null,
    });
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
