import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { DashboardResponse } from '@core/models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/dashboard`;

  /** Una sola llamada trae KPIs y todas las series. */
  getDashboard(dias = 30): Observable<DashboardResponse> {
    const params = new HttpParams().set('dias', dias);
    return this.http.get<DashboardResponse>(this.apiUrl, { params });
  }
}
