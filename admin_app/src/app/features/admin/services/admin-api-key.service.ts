import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ApiKey,
  ApiKeyCreada,
  ApiKeyCreate,
  ApiKeyList,
  ApiKeyUpdate,
} from '@core/models/api-key.model';

/** API keys de un cliente. Cuelgan de su ficha: `/admin/clientes/{id}/api-keys`. */
@Injectable({ providedIn: 'root' })
export class AdminApiKeyService {
  private readonly apiUrl = `${environment.apiUrl}/admin/clientes`;
  private http = inject(HttpClient);

  private base(clienteId: number): string {
    return `${this.apiUrl}/${clienteId}/api-keys`;
  }

  list(clienteId: number): Observable<ApiKeyList> {
    return this.http.get<ApiKeyList>(this.base(clienteId));
  }

  /** La respuesta trae la key en claro; es la única vez que se puede ver. */
  create(clienteId: number, datos: ApiKeyCreate): Observable<ApiKeyCreada> {
    return this.http.post<ApiKeyCreada>(this.base(clienteId), datos);
  }

  update(clienteId: number, keyId: number, datos: ApiKeyUpdate): Observable<ApiKey> {
    return this.http.put<ApiKey>(`${this.base(clienteId)}/${keyId}`, datos);
  }

  /** Efecto inmediato e irreversible. */
  revocar(clienteId: number, keyId: number): Observable<ApiKey> {
    return this.http.post<ApiKey>(`${this.base(clienteId)}/${keyId}/revocar`, {});
  }
}
