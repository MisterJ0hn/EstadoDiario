import {
  Router
} from "./chunk-O3CMZLWV.js";
import {
  HttpClient,
  Injectable,
  computed,
  environment,
  setClassMetadata,
  signal,
  switchMap,
  tap,
  ɵɵdefineInjectable,
  ɵɵinject
} from "./chunk-WMIGZGXS.js";

// src/app/core/services/auth.service.ts
var TOKEN_KEY = "ed_access_token";
var REFRESH_KEY = "ed_refresh_token";
var USER_KEY = "ed_user";
var AuthService = class _AuthService {
  http;
  router;
  apiUrl = `${environment.apiUrl}/auth`;
  _user = signal(this.loadUser());
  user = this._user.asReadonly();
  isAuthenticated = computed(() => !!this._user());
  isAdmin = computed(() => this._user()?.rol === "admin");
  constructor(http, router) {
    this.http = http;
    this.router = router;
  }
  /** true = la sesión sirve, pero solo para cambiar la contraseña. */
  debeCambiarPassword = computed(() => !!this._user()?.debe_cambiar_password);
  /**
   * Guid del cliente de la sesión, o null si la sesión es del administrador
   * de la plataforma (que no opera sobre la base de ningún cliente).
   * Se guarda con el resto de la sesión: sale de `/auth/me`.
   */
  getGuidCliente() {
    return this._user()?.cliente_guid ?? null;
  }
  /**
   * Sesión de usuario de un cliente: rut + usuario + contraseña.
   *
   * Resuelve con el perfil ya cargado, no con el token: quien llama necesita
   * saber si el usuario está obligado a cambiar su clave antes de decidir a
   * qué pantalla mandarlo.
   */
  login(credentials) {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(switchMap((res) => this.guardarSesion(res)));
  }
  guardarSesion(res) {
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(REFRESH_KEY, res.refresh_token);
    return this.cargarPerfil();
  }
  /**
   * Cambio de contraseña obligatorio: administrador sembrado al instalar el
   * sistema o cuenta cuya clave se reseteó. Al terminar, el perfil vuelve sin
   * la marca y el usuario puede navegar.
   */
  cambiarPasswordObligatorio(datos) {
    return this.http.post(`${this.apiUrl}/cambiar-password`, datos).pipe(switchMap(() => this.cargarPerfil()));
  }
  /** Adónde mandar al usuario recién autenticado según su tipo de sesión. */
  rutaInicial() {
    if (this.debeCambiarPassword())
      return "/cambiar-clave";
    return "/";
  }
  refreshToken() {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    return this.http.post(`${this.apiUrl}/refresh`, { refresh_token: refreshToken }).pipe(tap((res) => {
      localStorage.setItem(TOKEN_KEY, res.access_token);
      localStorage.setItem(REFRESH_KEY, res.refresh_token);
    }));
  }
  /** Trae el perfil y deja la sesión lista. Falla → se cierra la sesión. */
  cargarPerfil() {
    return this.http.get(`${this.apiUrl}/me`).pipe(tap({
      next: (user) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this._user.set(user);
      },
      error: () => this.logout()
    }));
  }
  loadProfile() {
    this.cargarPerfil().subscribe({ error: () => void 0 });
  }
  actualizarPerfil(datos) {
    return this.http.put(`${this.apiUrl}/me`, datos).pipe(tap((user) => {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      this._user.set(user);
    }));
  }
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    this.router.navigate(["/login"]);
  }
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  loadUser() {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }
  static \u0275fac = function AuthService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _AuthService)(\u0275\u0275inject(HttpClient), \u0275\u0275inject(Router));
  };
  static \u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _AuthService, factory: _AuthService.\u0275fac, providedIn: "root" });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(AuthService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], () => [{ type: HttpClient }, { type: Router }], null);
})();

export {
  AuthService
};
//# sourceMappingURL=chunk-M4LO6B3L.js.map
