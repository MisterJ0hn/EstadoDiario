import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  EstadoEnvio,
  WebhookConfig,
  WebhookConfigGuardada,
  WebhookConfigUpdate,
  WebhookEnvioList,
  WebhookPrueba,
  WebhookReintento,
  WebhookSecreto,
} from '@core/models/webhook.model';

/** Webhook de un cliente. Cuelga de la ficha: `/admin/clientes/{id}/webhook`. */
@Injectable({ providedIn: 'root' })
export class AdminWebhookService {
  private readonly apiUrl = `${environment.apiUrl}/admin/clientes`;
  private http = inject(HttpClient);

  private base(clienteId: number): string {
    return `${this.apiUrl}/${clienteId}/webhook`;
  }

  get(clienteId: number): Observable<WebhookConfig> {
    return this.http.get<WebhookConfig>(this.base(clienteId));
  }

  /** La primera vez que se guarda, la respuesta trae el secreto de firma. */
  guardar(clienteId: number, datos: WebhookConfigUpdate): Observable<WebhookConfigGuardada> {
    return this.http.put<WebhookConfigGuardada>(this.base(clienteId), datos);
  }

  rotarSecreto(clienteId: number): Observable<WebhookSecreto> {
    return this.http.post<WebhookSecreto>(`${this.base(clienteId)}/rotar-secreto`, {});
  }

  /** Manda un evento `webhook.prueba` ya, firmado igual que los reales. */
  probar(clienteId: number): Observable<WebhookPrueba> {
    return this.http.post<WebhookPrueba>(`${this.base(clienteId)}/probar`, {});
  }

  envios(clienteId: number, estado?: EstadoEnvio, limite = 50): Observable<WebhookEnvioList> {
    let params = new HttpParams().set('limite', limite);
    if (estado) params = params.set('estado', estado);
    return this.http.get<WebhookEnvioList>(`${this.base(clienteId)}/envios`, { params });
  }

  reintentarFallidos(clienteId: number): Observable<WebhookReintento> {
    return this.http.post<WebhookReintento>(`${this.base(clienteId)}/envios/reintentar`, {});
  }

  reintentarEnvio(clienteId: number, envioId: number): Observable<WebhookReintento> {
    return this.http.post<WebhookReintento>(
      `${this.base(clienteId)}/envios/${envioId}/reintentar`,
      {}
    );
  }
}
