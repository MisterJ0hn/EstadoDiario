import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, from, of, shareReplay, switchMap, tap, timeout } from 'rxjs';
import { environment } from '@env/environment';

/**
 * reCAPTCHA v3 (invisible) para los formularios que se envían sin sesión.
 *
 * Quién lo usa: NO los componentes, sino `auth.interceptor.ts`, que pide el
 * token justo antes de despachar el POST. Eso es lo que hace irrelevante que
 * el token de Google viva solo dos minutos: se acuña milisegundos antes de
 * usarse, en vez de al cargar la pantalla.
 *
 * Si está encendido o no lo decide el SERVIDOR (`GET /auth/recaptcha`), no un
 * `environment.ts`. La site key y el secret son un par, y tenerlos en
 * repositorios con ciclos de despliegue distintos garantiza que algún día no
 * coincidan; un par desincronizado falla el 100% de las verificaciones con un
 * error que no apunta a su causa.
 *
 * **El cliente no puede fallar abierto.** Ante cualquier problema —config
 * inalcanzable, script bloqueado, Google lento— devuelve `null` y la petición
 * sale sin token. Quien decide qué hacer con eso es el backend, que es el
 * único lado en el que la decisión no se puede falsificar.
 */

/** Los mismos literales que `backend/app/core/recaptcha.py`. Si divergen en un
 *  carácter, TODAS las verificaciones fallan; el backend loguea los dos valores
 *  para que se vea de inmediato. Guion bajo y no medio: Google solo acepta
 *  `[A-Za-z/_]` en `action`. */
export type AccionRecaptcha =
  | 'login'
  | 'login_admin'
  | 'recuperar_password'
  | 'restablecer_password';

interface RecaptchaConfig {
  activo: boolean;
  site_key: string | null;
}

const APAGADO: RecaptchaConfig = { activo: false, site_key: null };

/** Tope para no dejar el botón girando si Google no contesta. */
const TIMEOUT_MS = 8000;

@Injectable({ providedIn: 'root' })
export class RecaptchaService {
  private http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/auth/recaptcha`;

  private config$?: Observable<RecaptchaConfig>;
  private script?: Promise<void>;

  /** Para el aviso legal: solo se muestra si el captcha está encendido. */
  readonly activo = signal(false);

  /**
   * Adelanta la consulta de configuración y la carga del script.
   *
   * Se llama desde el constructor de las pantallas de autenticación: mientras
   * la persona escribe el RUT, esto ya se está resolviendo, y para cuando
   * aprieta el botón no queda latencia que pagar.
   */
  precargar(): void {
    this.configuracion().subscribe((config) => {
      if (config.activo && config.site_key) {
        void this.cargarScript(config.site_key).catch(() => undefined);
      }
    });
  }

  /**
   * Token para esa acción, o `null` si no hay captcha que aplicar.
   *
   * Nunca falla: cualquier error se traduce a `null`.
   */
  token(accion: AccionRecaptcha): Observable<string | null> {
    // Gemelo del de ionic_app, menos el guard de Capacitor: esta app es solo
    // web y no tiene esa dependencia. Si algún día se empaqueta, hay que
    // traerlo de vuelta — el WebView corre desde un origen que Google no
    // reconoce. Ver el apartado del APK en ARCHITECTURE.md.
    return this.configuracion().pipe(
      switchMap((config) => {
        if (!config.activo || !config.site_key) return of(null);
        return from(this.ejecutar(config.site_key, accion));
      }),
      timeout(TIMEOUT_MS),
      catchError(() => of(null))
    );
  }

  /** Configuración del servidor, consultada una sola vez por sesión de pestaña. */
  private configuracion(): Observable<RecaptchaConfig> {
    if (!this.config$) {
      this.config$ = this.http.get<RecaptchaConfig>(this.url).pipe(
        tap((config) => this.activo.set(config.activo)),
        catchError(() => {
          // El error NO se memoiza: si la primera consulta cae con la API
          // caída, el próximo intento vuelve a preguntar en vez de dejar el
          // captcha apagado por el resto de la sesión de la pestaña.
          this.config$ = undefined;
          this.activo.set(false);
          return of(APAGADO);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.config$;
  }

  private cargarScript(siteKey: string): Promise<void> {
    if (!this.script) {
      this.script = new Promise<void>((resolver, rechazar) => {
        const etiqueta = document.createElement('script');
        etiqueta.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
        etiqueta.async = true;
        etiqueta.defer = true;
        etiqueta.onload = () => resolver();
        etiqueta.onerror = () => rechazar(new Error('No se pudo cargar reCAPTCHA'));
        document.head.appendChild(etiqueta);
      }).catch((e) => {
        // Se olvida el intento fallido para que un corte de red pasajero no
        // deje la app sin captcha hasta que alguien recargue.
        this.script = undefined;
        throw e;
      });
    }
    return this.script;
  }

  private async ejecutar(siteKey: string, accion: AccionRecaptcha): Promise<string | null> {
    await this.cargarScript(siteKey);

    // Puede no estar aunque el `load` haya disparado: un bloqueador de
    // contenido que responde con un cuerpo vacío cuenta como carga exitosa.
    const api = window.grecaptcha;
    if (!api) return null;

    await new Promise<void>((resolver) => api.ready(resolver));
    return api.execute(siteKey, { action: accion });
  }
}
