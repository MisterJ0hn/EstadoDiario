import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ConfiguracionSmtp,
  ConfiguracionSmtpUpdate,
  SmtpOperacionResponse,
} from '@core/models/configuracion-smtp.model';

/**
 * Cuenta de salida del sistema. Vive bajo el módulo de informes en el backend
 * porque es la que despacha los Excel, pero es configuración de administración.
 */
@Injectable({ providedIn: 'root' })
export class ConfiguracionSmtpService {
  private readonly apiUrl = `${environment.apiUrl}/configuracion-smtp`;
  private http = inject(HttpClient);

  get(): Observable<ConfiguracionSmtp> {
    return this.http.get<ConfiguracionSmtp>(this.apiUrl);
  }

  save(datos: ConfiguracionSmtpUpdate): Observable<ConfiguracionSmtp> {
    return this.http.put<ConfiguracionSmtp>(this.apiUrl, datos);
  }

  /** Se manda la configuración escrita para poder probarla antes de guardarla. */
  probarConexion(datos: ConfiguracionSmtpUpdate): Observable<SmtpOperacionResponse> {
    return this.http.post<SmtpOperacionResponse>(`${this.apiUrl}/probar`, datos);
  }
}
