import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { PagoDisponible, PagoIniciado } from '@core/models/pago.model';

/**
 * Pago de las facturas propias con Webpay Plus.
 *
 * No recibe ni manda `cliente_id`: el backend lo saca del token, igual que
 * `FacturaService`.
 */
@Injectable({ providedIn: 'root' })
export class PagoService {
  private readonly apiUrl = `${environment.apiUrl}/pagos`;
  private http = inject(HttpClient);

  /** Si la plataforma tiene el pago en línea encendido. */
  disponible(): Observable<PagoDisponible> {
    return this.http.get<PagoDisponible>(`${this.apiUrl}/disponible`);
  }

  /**
   * Crea la transacción. **No cobra nada todavía**: devuelve a dónde hay que
   * mandar al usuario, y el cargo se hace recién cuando él termina en el
   * formulario de Webpay y el backend confirma.
   */
  iniciar(facturaId: number): Observable<PagoIniciado> {
    return this.http.post<PagoIniciado>(`${this.apiUrl}/webpay/${facturaId}`, {});
  }

  /**
   * Manda el navegador al formulario de Webpay.
   *
   * **Tiene que ser un POST de formulario, no un `location.href`.** Webpay
   * espera el token en el cuerpo (`token_ws`) y rechaza que se llegue por GET;
   * con una navegación normal el usuario ve un error de Transbank en vez del
   * formulario. Por eso se arma un `<form>` de verdad y se envía.
   *
   * El formulario se agrega al documento porque `submit()` no funciona en un
   * elemento suelto, y se quita después por prolijidad: si el envío falla, la
   * página no queda con un formulario invisible pegado.
   */
  irAWebpay(pago: PagoIniciado): void {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = pago.url;

    const campo = document.createElement('input');
    campo.type = 'hidden';
    campo.name = 'token_ws';
    campo.value = pago.token;
    form.appendChild(campo);

    document.body.appendChild(form);
    form.submit();
    form.remove();
  }
}
