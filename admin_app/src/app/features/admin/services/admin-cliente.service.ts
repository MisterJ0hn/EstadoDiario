import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  AdminOperacionResponse,
  AprovisionamientoEstado,
  Cliente,
  ClienteCreate,
  ClienteInbox,
  ClienteInboxUpdate,
  ClienteListResponse,
  ClienteUpdate,
} from '@core/models/admin.model';
import { Usuario, UsuarioCreate, UsuarioListResponse, UsuarioUpdate } from '@core/models/usuario.model';

/**
 * Consola de clientes. Todo cuelga de `/admin/clientes`; el backend valida el
 * rol `superadmin` en el prefijo completo.
 */
@Injectable({ providedIn: 'root' })
export class AdminClienteService {
  private readonly apiUrl = `${environment.apiUrl}/admin/clientes`;
  private http = inject(HttpClient);

  /** `estado`: 'activos' | 'suspendidos' | undefined (todos). */
  list(
    page = 1,
    perPage = 25,
    buscar?: string,
    estado?: string
  ): Observable<ClienteListResponse> {
    let params = new HttpParams().set('page', page).set('per_page', perPage);
    if (buscar) params = params.set('buscar', buscar);
    if (estado) params = params.set('estado', estado);
    return this.http.get<ClienteListResponse>(this.apiUrl, { params });
  }

  get(id: number): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.apiUrl}/${id}`);
  }

  /**
   * Da de alta el cliente y dispara la creación de su base de datos.
   * Responde de inmediato con el cliente en estado `en_cola` o `creando`; el
   * avance se consulta con `estadoAprovisionamiento`.
   */
  create(datos: ClienteCreate): Observable<Cliente> {
    return this.http.post<Cliente>(this.apiUrl, datos);
  }

  update(id: number, datos: ClienteUpdate): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.apiUrl}/${id}`, datos);
  }

  /**
   * Guarda o quita el logo del estudio.
   *
   * `logo` va SIN el prefijo `data:...;base64,` — el backend guarda el base64
   * puro para poder adjuntarlo a un correo, donde el prefijo estorba.
   * Mandar `null` lo quita.
   */
  guardarLogo(id: number, logo: string | null, mime: string | null): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.apiUrl}/${id}/logo`, {
      logo,
      logo_mime: mime,
    });
  }

  /** Polling del alta. Liviano a propósito: se llama cada pocos segundos. */
  estadoAprovisionamiento(id: number): Observable<AprovisionamientoEstado> {
    return this.http.get<AprovisionamientoEstado>(`${this.apiUrl}/${id}/aprovisionamiento`);
  }

  /** Reintenta la creación de la base de datos después de un error. */
  reintentarAprovisionamiento(id: number): Observable<AprovisionamientoEstado> {
    return this.http.post<AprovisionamientoEstado>(
      `${this.apiUrl}/${id}/aprovisionamiento/reintentar`,
      {}
    );
  }

  /**
   * Suspender es reversible y no borra nada: corta el acceso, la ingesta y los
   * envíos mientras dura. `reactivar` lo deja como estaba.
   */
  suspender(id: number): Observable<Cliente> {
    return this.http.post<Cliente>(`${this.apiUrl}/${id}/suspender`, {});
  }

  reactivar(id: number): Observable<Cliente> {
    return this.http.post<Cliente>(`${this.apiUrl}/${id}/reactivar`, {});
  }

  // ── Casilla de ingesta ─────────────────────────────────────────────────

  getInbox(id: number): Observable<ClienteInbox> {
    return this.http.get<ClienteInbox>(`${this.apiUrl}/${id}/inbox`);
  }

  saveInbox(id: number, datos: ClienteInboxUpdate): Observable<ClienteInbox> {
    return this.http.put<ClienteInbox>(`${this.apiUrl}/${id}/inbox`, datos);
  }

  probarInbox(id: number, datos: ClienteInboxUpdate): Observable<AdminOperacionResponse> {
    return this.http.post<AdminOperacionResponse>(`${this.apiUrl}/${id}/inbox/probar`, datos);
  }

  // ── Usuarios del cliente ───────────────────────────────────────────────

  listUsuarios(id: number): Observable<UsuarioListResponse> {
    return this.http.get<UsuarioListResponse>(`${this.apiUrl}/${id}/usuarios`);
  }

  createUsuario(id: number, datos: UsuarioCreate): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.apiUrl}/${id}/usuarios`, datos);
  }

  updateUsuario(id: number, usuarioId: number, datos: UsuarioUpdate): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/${id}/usuarios/${usuarioId}`, datos);
  }
}
