import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { PermisosUsuario, PermisosUsuarioListResponse } from '@core/models/usuario.model';

/**
 * Usuarios del estudio, vistos desde el estudio: **solo lectura y permisos**.
 *
 * Crear y editar usuarios es de la plataforma (`/admin/clientes/{id}/usuarios`),
 * no del estudio. Lo que el administrador del estudio decide es qué ve cada
 * uno de los suyos.
 */
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly apiUrl = `${environment.apiUrl}/usuarios`;
  private http = inject(HttpClient);

  /** Usuarios con sus jurisdicciones, más el catálogo para poder asignarlas. */
  permisos(): Observable<PermisosUsuarioListResponse> {
    return this.http.get<PermisosUsuarioListResponse>(`${this.apiUrl}/permisos`);
  }

  /**
   * Reemplaza las jurisdicciones de un usuario.
   * Lista vacía = ve todas (no "no ve nada").
   */
  guardarPermisos(id: number, jurisdicciones: number[]): Observable<PermisosUsuario> {
    return this.http.put<PermisosUsuario>(`${this.apiUrl}/${id}/permisos`, { jurisdicciones });
  }
}
