import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { FiltroLogs, LogActividadesListResponse } from '@core/models/log.model';

/**
 * Bitácora de actividad de un cliente.
 *
 * El `cliente_id` va en la URL y no en el token: el administrador de plataforma
 * puede mirar a cualquiera, que es su trabajo. Quien decide qué cliente es la
 * pantalla, no la sesión.
 */
@Injectable({ providedIn: 'root' })
export class LogService {
  private readonly apiUrl = `${environment.apiUrl}/admin/clientes`;
  private http = inject(HttpClient);

  listar(clienteId: number, filtro: FiltroLogs = {}): Observable<LogActividadesListResponse> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      // Los vacíos no viajan: un parámetro en blanco el backend lo tomaría
      // como "busque nada" y devolvería cero filas.
      if (valor !== null && valor !== undefined && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return this.http.get<LogActividadesListResponse>(
      `${this.apiUrl}/${clienteId}/logs`,
      { params }
    );
  }
}
