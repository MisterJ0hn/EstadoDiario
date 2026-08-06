import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ConfiguracionWhatsapp,
  ConfiguracionWhatsappUpdate,
  OperacionResponse,
} from '@core/models/configuracion-whatsapp.model';

@Injectable({ providedIn: 'root' })
export class ConfiguracionWhatsappService {
  private readonly apiUrl = `${environment.apiUrl}/configuracion-whatsapp`;
  private http = inject(HttpClient);

  get(): Observable<ConfiguracionWhatsapp> {
    return this.http.get<ConfiguracionWhatsapp>(this.apiUrl);
  }

  save(datos: ConfiguracionWhatsappUpdate): Observable<ConfiguracionWhatsapp> {
    return this.http.put<ConfiguracionWhatsapp>(this.apiUrl, datos);
  }

  probarConexion(): Observable<OperacionResponse> {
    return this.http.post<OperacionResponse>(`${this.apiUrl}/probar-conexion`, {});
  }
}
