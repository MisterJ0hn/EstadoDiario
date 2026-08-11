import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  CerrarPeriodoRequest,
  FacturacionCierre,
  FacturacionPeriodo,
} from '@core/models/facturacion.model';
import {
  EmitirOrdenRequest,
  OrdenCompra,
  OrdenCompraListResponse,
} from '@core/models/orden-compra.model';

/**
 * Facturación de la plataforma. Cuelga de `/admin/facturacion` y exige
 * administrador del sistema con la clave ya definitiva, igual que el resto de
 * la consola.
 */
@Injectable({ providedIn: 'root' })
export class FacturacionService {
  private readonly apiUrl = `${environment.apiUrl}/admin/facturacion`;
  private http = inject(HttpClient);

  /**
   * Detalle y totales de un período.
   *
   * Sin `periodo` devuelve el último cerrado. Un período que todavía no cerró
   * se responde igual, contado al momento y con `es_estimacion` en true.
   */
  periodo(periodo?: string): Observable<FacturacionPeriodo> {
    let params = new HttpParams();
    if (periodo) params = params.set('periodo', periodo);
    return this.http.get<FacturacionPeriodo>(this.apiUrl, { params });
  }

  /** Historial de un cliente, del período más nuevo al más viejo. */
  historialCliente(clienteId: number): Observable<FacturacionCierre[]> {
    return this.http.get<FacturacionCierre[]>(`${this.apiUrl}/clientes/${clienteId}`);
  }

  /**
   * Congela un período a mano.
   *
   * La vía normal es el job del día 1; esto existe para repetir el cierre que
   * falló porque la base de un cliente estaba caída.
   */
  cerrar(datos: CerrarPeriodoRequest = {}): Observable<FacturacionPeriodo> {
    return this.http.post<FacturacionPeriodo>(`${this.apiUrl}/cerrar`, datos);
  }

  // ── Órdenes de compra ──────────────────────────────────────────────────

  /** Emite el documento y guarda el PDF. Falla con 400 si falta algún cierre. */
  emitirOrden(datos: EmitirOrdenRequest): Observable<OrdenCompra> {
    return this.http.post<OrdenCompra>(`${this.apiUrl}/facturas`, datos);
  }

  /** El filtro de fechas va contra el RANGO facturado, no contra la emisión. */
  listarOrdenes(cliente_id?: number): Observable<OrdenCompraListResponse> {
    let params = new HttpParams();
    if (cliente_id) params = params.set('cliente_id', cliente_id);
    return this.http.get<OrdenCompraListResponse>(`${this.apiUrl}/facturas`, { params });
  }

  anularOrden(id: number, motivo: string): Observable<OrdenCompra> {
    return this.http.post<OrdenCompra>(`${this.apiUrl}/facturas/${id}/anular`, { motivo });
  }

  /**
   * Descarga el PDF guardado.
   *
   * Va por HttpClient como blob y no con un `<a href>` a la URL: el endpoint
   * exige el Bearer, que lo pone el interceptor y una navegación del navegador
   * no lleva. Un enlace directo respondería 403 y parecería que la orden no
   * existe.
   */
  descargarPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/facturas/${id}/pdf`, {
      responseType: 'blob',
    });
  }
}
