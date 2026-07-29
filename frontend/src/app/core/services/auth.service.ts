import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import { ActualizarPerfilRequest, LoginRequest, TokenResponse, UserInfo } from '../models/auth.model';

const TOKEN_KEY = 'ed_access_token';
const REFRESH_KEY = 'ed_refresh_token';
const USER_KEY = 'ed_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private _user = signal<UserInfo | null>(this.loadUser());
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isAdmin = computed(() => this._user()?.rol === 'admin');

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  login(credentials: LoginRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.access_token);
        localStorage.setItem(REFRESH_KEY, res.refresh_token);
        this.loadProfile();
      })
    );
  }

  refreshToken(): Observable<TokenResponse> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/refresh`, { refresh_token: refreshToken })
      .pipe(
        tap((res) => {
          localStorage.setItem(TOKEN_KEY, res.access_token);
          localStorage.setItem(REFRESH_KEY, res.refresh_token);
        })
      );
  }

  loadProfile(): void {
    this.http.get<UserInfo>(`${this.apiUrl}/me`).subscribe({
      next: (user) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this._user.set(user);
      },
      error: () => this.logout(),
    });
  }

  actualizarPerfil(datos: ActualizarPerfilRequest): Observable<UserInfo> {
    return this.http.put<UserInfo>(`${this.apiUrl}/me`, datos).pipe(
      tap((user) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this._user.set(user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private loadUser(): UserInfo | null {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }
}
