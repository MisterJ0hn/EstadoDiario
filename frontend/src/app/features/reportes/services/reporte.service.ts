import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  CamposDisponiblesResponse,
  GenerarReporteResponse,
  ReportePlantilla,
  ReportePlantillaListResponse,
  ReportePlantillaRequest,
} from '@core/models/reporte.model';

/**
 * El backend acota los informes al usuario autenticado (el admin ve todo), así
 * que aquí nunca se manda un id de usuario ni un destinatario: el correo sale
 * siempre a la dirección del usuario de la sesión.
 */
@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly apiUrl = `${environment.apiUrl}/reportes`;
  private http = inject(HttpClient);

  /** Catálogo de fuentes y campos con que se pinta el selector. */
  getCampos(): Observable<CamposDisponiblesResponse> {
    return this.http.get<CamposDisponiblesResponse>(`${this.apiUrl}/campos`);
  }

  getPlantillas(): Observable<ReportePlantillaListResponse> {
    return this.http.get<ReportePlantillaListResponse>(this.apiUrl);
  }

  crear(datos: ReportePlantillaRequest): Observable<ReportePlantilla> {
    return this.http.post<ReportePlantilla>(this.apiUrl, datos);
  }

  actualizar(id: number, datos: ReportePlantillaRequest): Observable<ReportePlantilla> {
    return this.http.put<ReportePlantilla>(`${this.apiUrl}/${id}`, datos);
  }

  eliminar(id: number): Observable<{ exito: boolean }> {
    return this.http.delete<{ exito: boolean }>(`${this.apiUrl}/${id}`);
  }

  /** Genera el Excel y lo despacha al correo del usuario de la sesión. */
  enviar(id: number): Observable<GenerarReporteResponse> {
    return this.http.post<GenerarReporteResponse>(`${this.apiUrl}/${id}/enviar`, {});
  }

  /** Descarga directa del .xlsx, sin pasar por el correo. */
  descargar(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/descargar`, { responseType: 'blob' });
  }
}
