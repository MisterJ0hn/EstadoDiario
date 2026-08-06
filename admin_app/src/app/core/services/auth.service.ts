import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, switchMap, tap } from 'rxjs';
import { environment } from '@env/environment';
import { borrar, escribir, leer } from '../utils/almacenamiento';
import {
  ActualizarPerfilRequest,
  CambiarPasswordRequest,
  LoginAdminRequest,
  LoginRequest,
  TokenResponse,
  UserInfo,
} from '../models/auth.model';

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
  /** Administrador de la plataforma: ve clientes, no causas. */
  readonly esAdminPlataforma = computed(() => this._user()?.rol === 'superadmin');

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  /** true = la sesión sirve, pero solo para cambiar la contraseña. */
  readonly debeCambiarPassword = computed(() => !!this._user()?.debe_cambiar_password);

  /**
   * Guid del cliente de la sesión, o null si la sesión es del administrador
   * de la plataforma (que no opera sobre la base de ningún cliente).
   * Se guarda con el resto de la sesión: sale de `/auth/me`.
   */
  getGuidCliente(): string | null {
    return this._user()?.cliente_guid ?? null;
  }

  /**
   * Sesión de usuario de un cliente: rut + usuario + contraseña.
   *
   * Resuelve con el perfil ya cargado, no con el token: quien llama necesita
   * saber si el usuario está obligado a cambiar su clave antes de decidir a
   * qué pantalla mandarlo.
   */
  login(credentials: LoginRequest): Observable<UserInfo> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(switchMap((res) => this.guardarSesion(res)));
  }

  /** Sesión del administrador de la plataforma: usuario + contraseña. */
  loginAdmin(credentials: LoginAdminRequest): Observable<UserInfo> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/admin/login`, credentials)
      .pipe(switchMap((res) => this.guardarSesion(res)));
  }

  private guardarSesion(res: TokenResponse): Observable<UserInfo> {
    escribir(TOKEN_KEY, res.access_token);
    escribir(REFRESH_KEY, res.refresh_token);
    return this.cargarPerfil();
  }

  /**
   * Cambio de contraseña obligatorio: administrador sembrado al instalar el
   * sistema o cuenta cuya clave se reseteó. Al terminar, el perfil vuelve sin
   * la marca y el usuario puede navegar.
   */
  cambiarPasswordObligatorio(datos: CambiarPasswordRequest): Observable<UserInfo> {
    return this.http
      .post<unknown>(`${this.apiUrl}/cambiar-password`, datos)
      .pipe(switchMap(() => this.cargarPerfil()));
  }

  /** Adónde mandar al usuario recién autenticado según su tipo de sesión. */
  rutaInicial(): string {
    if (this.debeCambiarPassword()) return '/cambiar-clave';
    return '/';
  }

  refreshToken(): Observable<TokenResponse> {
    const refreshToken = leer(REFRESH_KEY);
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/refresh`, { refresh_token: refreshToken })
      .pipe(
        tap((res) => {
          escribir(TOKEN_KEY, res.access_token);
          escribir(REFRESH_KEY, res.refresh_token);
        })
      );
  }

  /** Trae el perfil y deja la sesión lista. Falla → se cierra la sesión. */
  cargarPerfil(): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${this.apiUrl}/me`).pipe(
      tap({
        next: (user) => {
          escribir(USER_KEY, JSON.stringify(user));
          this._user.set(user);
        },
        error: () => this.logout(),
      })
    );
  }

  loadProfile(): void {
    this.cargarPerfil().subscribe({ error: () => undefined });
  }

  actualizarPerfil(datos: ActualizarPerfilRequest): Observable<UserInfo> {
    return this.http.put<UserInfo>(`${this.apiUrl}/me`, datos).pipe(
      tap((user) => {
        escribir(USER_KEY, JSON.stringify(user));
        this._user.set(user);
      })
    );
  }

  logout(): void {
    borrar(TOKEN_KEY);
    borrar(REFRESH_KEY);
    borrar(USER_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return leer(TOKEN_KEY);
  }

  private loadUser(): UserInfo | null {
    const stored = leer(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }
}
