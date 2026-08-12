import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  EstimacionPeriodo,
  Factura,
  FacturaListResponse,
  FiltroFacturas,
  GenerarPeriodoRequest,
  GenerarPeriodoResponse,
  PagoListResponse,
  Tarifa,
  TarifaUpsertRequest,
  TarifasCliente,
} from '@core/models/facturacion.model';

/**
 * Facturación de la plataforma. Cuelga de `/admin/facturacion` y exige
 * administrador del sistema con la clave ya definitiva, igual que el resto de
 * la consola.
 */
@Injectable({ providedIn: 'root' })
export class FacturacionService {
  private readonly apiUrl = `${environment.apiUrl}/admin/facturacion`;
  private http = inject(HttpClient);

  // ── Facturas ───────────────────────────────────────────────────────────

  /**
   * Listado con filtros. Los que vengan vacíos no se mandan: un parámetro con
   * cadena vacía el backend lo interpretaría como "busque nada" y devolvería
   * cero filas.
   */
  listar(filtro: FiltroFacturas = {}): Observable<FacturaListResponse> {
    let params = new HttpParams();
    const agregar = (clave: string, valor: unknown) => {
      if (valor === null || valor === undefined || valor === '') return;
      params = params.set(clave, String(valor));
    };
    agregar('cliente_id', filtro.cliente_id);
    agregar('desde', filtro.desde);
    agregar('hasta', filtro.hasta);
    agregar('rut', filtro.rut);
    agregar('cliente_activo', filtro.cliente_activo);
    agregar('q', filtro.q);
    agregar('estado', filtro.estado);
    agregar('limite', filtro.limite);
    return this.http.get<FacturaListResponse>(`${this.apiUrl}/facturas`, { params });
  }

  obtener(id: number): Observable<Factura> {
    return this.http.get<Factura>(`${this.apiUrl}/facturas/${id}`);
  }

  /** Períodos que tienen facturas, del más nuevo al más viejo. */
  periodos(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/facturas/periodos`);
  }

  anular(id: number, motivo: string): Observable<Factura> {
    return this.http.post<Factura>(`${this.apiUrl}/facturas/${id}/anular`, { motivo });
  }

  marcarPagada(id: number, pagada: boolean): Observable<Factura> {
    return this.http.post<Factura>(`${this.apiUrl}/facturas/${id}/pagada`, { pagada });
  }

  /**
   * Los intentos de pago con Webpay de una factura, del más nuevo al más viejo.
   *
   * Trae también los rechazados y los abandonados: son la mitad de lo que hay
   * que mirar cuando el estudio dice que pagó y la factura sigue emitida.
   */
  pagos(id: number): Observable<PagoListResponse> {
    return this.http.get<PagoListResponse>(`${this.apiUrl}/facturas/${id}/pagos`);
  }

  /**
   * Descarga el PDF guardado.
   *
   * Va por HttpClient como blob y no con un `<a href>` a la URL: el endpoint
   * exige el Bearer, que lo pone el interceptor y una navegación del navegador
   * no lleva. Un enlace directo respondería 403 y parecería que la factura no
   * existe.
   */
  descargarPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/facturas/${id}/pdf`, { responseType: 'blob' });
  }

  // ── Generación ─────────────────────────────────────────────────────────

  /** Cuánto saldría si se facturara ahora. No escribe nada. */
  estimacion(periodo?: string): Observable<EstimacionPeriodo> {
    let params = new HttpParams();
    if (periodo) params = params.set('periodo', periodo);
    return this.http.get<EstimacionPeriodo>(`${this.apiUrl}/estimacion`, { params });
  }

  /**
   * Genera el período a mano.
   *
   * La vía normal es el job del día 1; esto existe para reintentar el cliente
   * cuya base estaba caída.
   */
  generar(datos: GenerarPeriodoRequest = {}): Observable<GenerarPeriodoResponse> {
    return this.http.post<GenerarPeriodoResponse>(`${this.apiUrl}/generar`, datos);
  }

  // ── Tarifas por cliente ────────────────────────────────────────────────

  tarifas(clienteId: number): Observable<TarifasCliente> {
    return this.http.get<TarifasCliente>(`${this.apiUrl}/clientes/${clienteId}/tarifas`);
  }

  guardarTarifa(clienteId: number, datos: TarifaUpsertRequest): Observable<Tarifa> {
    return this.http.put<Tarifa>(`${this.apiUrl}/clientes/${clienteId}/tarifas`, datos);
  }

  eliminarTarifa(clienteId: number, tarifaId: number): Observable<{ exito: boolean; mensaje: string }> {
    return this.http.delete<{ exito: boolean; mensaje: string }>(
      `${this.apiUrl}/clientes/${clienteId}/tarifas/${tarifaId}`
    );
  }
}
