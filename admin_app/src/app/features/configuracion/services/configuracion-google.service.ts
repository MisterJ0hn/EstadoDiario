import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ConfiguracionGoogle,
  ConfiguracionGoogleUpdate,
} from '@core/models/google-calendar.model';

/** Client ID/Secret del proyecto de Google Cloud: solo Administración. */
@Injectable({ providedIn: 'root' })
export class ConfiguracionGoogleService {
  private readonly apiUrl = `${environment.apiUrl}/configuracion-google`;
  private http = inject(HttpClient);

  get(): Observable<ConfiguracionGoogle> {
    return this.http.get<ConfiguracionGoogle>(this.apiUrl);
  }

  save(datos: ConfiguracionGoogleUpdate): Observable<ConfiguracionGoogle> {
    return this.http.put<ConfiguracionGoogle>(this.apiUrl, datos);
  }
}
