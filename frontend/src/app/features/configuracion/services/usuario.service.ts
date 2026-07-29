import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  Usuario,
  UsuarioCreate,
  UsuarioListResponse,
  UsuarioUpdate,
} from '@core/models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly apiUrl = `${environment.apiUrl}/usuarios`;
  private http = inject(HttpClient);

  list(): Observable<UsuarioListResponse> {
    return this.http.get<UsuarioListResponse>(this.apiUrl);
  }

  create(datos: UsuarioCreate): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, datos);
  }

  update(id: number, datos: UsuarioUpdate): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/${id}`, datos);
  }
}
