import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  CargarCausasResponse,
  CausaCorteListResponse,
  CausaFiltros,
  CausaListResponse,
  CausaResumenResponse,
  PjudMovimientosResponse,
} from '@core/models/causa.model';

/** Dentro de un estudio todos ven todo, así que nunca se manda un id de usuario. */
@Injectable({ providedIn: 'root' })
export class CausaService {
  private readonly apiUrl = `${environment.apiUrl}/causas`;
  private http = inject(HttpClient);

  getCausas(filtros: CausaFiltros = {}): Observable<CausaListResponse> {
    return this.http.get<CausaListResponse>(this.apiUrl, {
      params: this.toParams(filtros),
    });
  }

  /** Conteo por materia (pestañas) y estados disponibles (combo). */
  getResumen(filtros: CausaFiltros = {}): Observable<CausaResumenResponse> {
    // Sin `materia` ni paginación: el resumen es justamente el que cuenta cada
    // materia sobre el universo de los demás filtros.
    return this.http.get<CausaResumenResponse>(`${this.apiUrl}/resumen`, {
      params: this.toParams({
        estado_causa: filtros.estado_causa,
        tribunal: filtros.tribunal,
        busqueda: filtros.busqueda,
        origen_id: filtros.origen_id,
        // La vigencia SÍ va: es un interruptor de toda la pantalla, no una
        // pestaña. Sin esto los contadores de cada materia contarían la
        // cartera completa y no cuadrarían con las filas de la tabla.
        vigencia: filtros.vigencia,
      }),
    });
  }

  /** Causas de corte: viven en otra tabla y se muestran en el submenú Corte. */
  getCortes(
    params: {
      tipo?: 'suprema' | 'apelaciones';
      busqueda?: string;
      corte?: string;
      vigencia?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Observable<CausaCorteListResponse> {
    return this.http.get<CausaCorteListResponse>(`${this.apiUrl}/cortes`, {
      params: this.toParams(params),
    });
  }

  /**
   * Sube el Excel de causas.
   *
   * `rut` y `fecha` van vacíos salvo que el usuario los indique: el RUT sale
   * del nombre del archivo y la fecha, si no viene, la pone el backend en hoy
   * — este reporte no trae fecha, es una foto de la cartera.
   */
  cargar(archivo: File, rut?: string, fecha?: string): Observable<CargarCausasResponse> {
    const datos = new FormData();
    datos.append('file', archivo);
    if (rut) datos.append('rut', rut);
    if (fecha) datos.append('fecha', fecha);
    return this.http.post<CargarCausasResponse>(`${this.apiUrl}/upload`, datos);
  }

  /** Si api-pjud.codifica.cl está configurada. Se pide una sola vez para
   *  decidir si se muestra el botón "Detalle PJUD". */
  pjudDisponible(): Observable<{ disponible: boolean }> {
    return this.http.get<{ disponible: boolean }>(`${this.apiUrl}/pjud/disponible`);
  }

  /** Detalle EN VIVO de una causa Civil, consultado directo al PJUD.
   *  `forzar` pide además que el PJUD sincronice antes de responder.
   *  `cuaderno` elige qué cuaderno traer en Historia (por defecto el primero).
   *  Puede volver con `estado: 'sincronizando'` si el PJUD aún está scrapeando. */
  pjudMovimientos(
    causaId: number,
    forzar = false,
    cuaderno?: number,
  ): Observable<PjudMovimientosResponse> {
    let params = new HttpParams();
    if (forzar) params = params.set('forzar', 'true');
    if (cuaderno != null) params = params.set('cuaderno', String(cuaderno));
    return this.http.get<PjudMovimientosResponse>(
      `${this.apiUrl}/${causaId}/pjud/movimientos`,
      { params },
    );
  }

  /** Un PDF de documento del detalle PJUD, traído por el backend (que lo baja
   *  del proveedor y lo reenvía por `https` como `application/pdf` inline).
   *  Se pide como Blob para abrirlo en el visor del navegador sin descargarlo;
   *  `url` es la que vino en el detalle. */
  pjudDocumento(url: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/pjud/documento`, {
      params: new HttpParams().set('url', url),
      responseType: 'blob',
    });
  }

  private toParams(filtros: object): HttpParams {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, valor as string | number);
      }
    }
    return params;
  }
}
