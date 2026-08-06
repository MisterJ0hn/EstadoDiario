import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { AdminDashboard } from '@core/models/admin.model';

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly apiUrl = `${environment.apiUrl}/admin/dashboard`;
  private http = inject(HttpClient);

  /** `dias` acota los contadores del período (movimientos importados). */
  getDashboard(dias: number): Observable<AdminDashboard> {
    const params = new HttpParams().set('dias', dias);
    return this.http.get<AdminDashboard>(this.apiUrl, { params });
  }
}
