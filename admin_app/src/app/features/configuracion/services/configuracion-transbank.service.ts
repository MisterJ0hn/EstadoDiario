import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ConfiguracionTransbank,
  ConfiguracionTransbankUpdate,
} from '@core/models/configuracion-transbank.model';
import { OperacionResponse } from '@core/models/configuracion-whatsapp.model';

@Injectable({ providedIn: 'root' })
export class ConfiguracionTransbankService {
  private readonly apiUrl = `${environment.apiUrl}/configuracion-transbank`;
  private http = inject(HttpClient);

  get(): Observable<ConfiguracionTransbank> {
    return this.http.get<ConfiguracionTransbank>(this.apiUrl);
  }

  save(datos: ConfiguracionTransbankUpdate): Observable<ConfiguracionTransbank> {
    return this.http.put<ConfiguracionTransbank>(this.apiUrl, datos);
  }

  /**
   * Crea una transacción de $10 que no se confirma, que es la única forma de
   * comprobar las credenciales: Transbank no tiene endpoint de "ping". No
   * cobra nada, ni siquiera en producción.
   */
  probarConexion(): Observable<OperacionResponse> {
    return this.http.post<OperacionResponse>(`${this.apiUrl}/probar-conexion`, {});
  }
}
