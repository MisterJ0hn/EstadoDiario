import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { FacturaCliente, FacturaClienteListResponse } from '@core/models/factura.model';

/**
 * Facturas del propio estudio.
 *
 * No recibe ni manda `cliente_id`: el backend lo saca del token. Un parámetro
 * acá sería una invitación a probar con el número de al lado.
 */
@Injectable({ providedIn: 'root' })
export class FacturaService {
  private readonly apiUrl = `${environment.apiUrl}/facturas`;
  private http = inject(HttpClient);

  /** Las últimas 12, de la más nueva a la más vieja. El tope lo pone el backend. */
  listar(): Observable<FacturaClienteListResponse> {
    return this.http.get<FacturaClienteListResponse>(this.apiUrl);
  }

  obtener(id: number): Observable<FacturaCliente> {
    return this.http.get<FacturaCliente>(`${this.apiUrl}/${id}`);
  }

  /**
   * Descarga el PDF guardado.
   *
   * Va por HttpClient como blob y no con un `<a href>`: el endpoint exige el
   * Bearer, que lo pone el interceptor y una navegación del navegador no lleva.
   */
  descargarPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/pdf`, { responseType: 'blob' });
  }
}
