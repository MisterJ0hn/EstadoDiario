import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  AdminOperacionResponse,
  ConfiguracionSistema,
  ConfiguracionSistemaUpdate,
} from '@core/models/admin.model';

/** Ajustes transversales de la plataforma que no son de un cliente concreto. */
@Injectable({ providedIn: 'root' })
export class AdminSistemaService {
  private readonly apiUrl = `${environment.apiUrl}/admin/configuracion/sistema`;
  private http = inject(HttpClient);

  get(): Observable<ConfiguracionSistema> {
    return this.http.get<ConfiguracionSistema>(this.apiUrl);
  }

  save(datos: ConfiguracionSistemaUpdate): Observable<ConfiguracionSistema> {
    return this.http.put<ConfiguracionSistema>(this.apiUrl, datos);
  }

  /** Aplica la política ahora, sin esperar a la purga programada. */
  purgarLog(): Observable<AdminOperacionResponse> {
    return this.http.post<AdminOperacionResponse>(`${this.apiUrl}/purgar-log`, {});
  }
}
