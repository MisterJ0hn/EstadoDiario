import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, switchMap, tap } from 'rxjs';
import { environment } from '@env/environment';
import {
  ActualizarPerfilRequest,
  CambiarPasswordRequest,
  LoginRequest,
  OperacionResponse,
  RecuperarPasswordRequest,
  RestablecerPasswordRequest,
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


  private guardarSesion(res: TokenResponse): Observable<UserInfo> {
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(REFRESH_KEY, res.refresh_token);
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

  /**
   * Paso 1 de "olvidé mi contraseña": pide el correo con el enlace.
   *
   * El backend responde lo mismo exista o no la cuenta, así que el mensaje que
   * vuelve se muestra tal cual: inventar acá uno más específico delataría qué
   * correos son usuarios del sistema.
   */
  recuperarPassword(datos: RecuperarPasswordRequest): Observable<OperacionResponse> {
    return this.http.post<OperacionResponse>(`${this.apiUrl}/recuperar-password`, datos);
  }

  /**
   * Paso 2: fija la contraseña con el token del enlace. No deja sesión
   * iniciada —el token del correo no sirve para eso— así que después hay que
   * pasar por el login.
   */
  restablecerPassword(datos: RestablecerPasswordRequest): Observable<OperacionResponse> {
    return this.http.post<OperacionResponse>(`${this.apiUrl}/restablecer-password`, datos);
  }

  /** Adónde mandar al usuario recién autenticado según su tipo de sesión. */
  rutaInicial(): string {
    if (this.debeCambiarPassword()) return '/cambiar-clave';
    return '/';
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

  /** Trae el perfil y deja la sesión lista. Falla → se cierra la sesión. */
  cargarPerfil(): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${this.apiUrl}/me`).pipe(
      tap({
        next: (user) => {
          localStorage.setItem(USER_KEY, JSON.stringify(user));
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
