import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { FiltroPjudLlamados, PjudLlamadosListResponse } from '@core/models/pjud-log.model';

/**
 * Log de consultas a api-pjud.codifica.cl.
 *
 * Global, no por cliente: las filas viven en la base principal porque la
 * credencial de api-pjud es de la plataforma. El filtro por cliente es opcional.
 */
@Injectable({ providedIn: 'root' })
export class PjudLogService {
  private readonly apiUrl = `${environment.apiUrl}/admin/pjud`;
  private http = inject(HttpClient);

  listar(filtro: FiltroPjudLlamados = {}): Observable<PjudLlamadosListResponse> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== null && valor !== undefined && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return this.http.get<PjudLlamadosListResponse>(`${this.apiUrl}/llamados`, { params });
  }
}
