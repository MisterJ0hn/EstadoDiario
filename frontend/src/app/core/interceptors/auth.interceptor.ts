import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AccionRecaptcha, RecaptchaService } from '../services/recaptcha.service';

/** Endpoints donde todavía no hay sesión: no llevan token ni tenant.
 *
 *  Los dos de recuperación van acá por lo mismo: quien los usa no pudo entrar,
 *  así que no hay guid que mandar. En `restablecer-password` la credencial es
 *  el token del enlace, que viaja en el cuerpo y no como Bearer.
 *
 *  `/auth/recaptcha` también: es la consulta que averigua si hay que mandar
 *  captcha, así que pedirle uno a ella sería una recursión infinita. */
function esAutenticacion(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/admin/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/recaptcha') ||
    url.includes('/auth/recuperar-password') ||
    url.includes('/auth/restablecer-password')
  );
}

/**
 * Qué acción de reCAPTCHA le corresponde a cada formulario público, o `null`
 * si ese endpoint no lleva captcha.
 *
 * La acción va firmada dentro del token, y el backend compara la que declara
 * el endpoint contra la que vino: es lo que impide reusar en el login un token
 * acuñado en la pantalla de restablecer clave.
 *
 * Se compara de la ruta más específica a la más general por costumbre
 * defensiva: hoy `/auth/admin/login` y `/auth/login` no se solapan, pero el
 * día que alguien agregue `/auth/login/algo` el orden va a importar.
 */
function accionRecaptcha(url: string): AccionRecaptcha | null {
  if (url.includes('/auth/admin/login')) return 'login_admin';
  if (url.includes('/auth/login')) return 'login';
  if (url.includes('/auth/recuperar-password')) return 'recuperar_password';
  if (url.includes('/auth/restablecer-password')) return 'restablecer_password';
  return null;
}

/**
 * La consola de administración opera sobre la base principal, no sobre la de
 * un cliente: mandarle un guid la haría apuntar al tenant equivocado.
 */
function esAdministracion(url: string): boolean {
  return url.includes('/admin/');
}

/**
 * Cabeceras de la petición autenticada.
 *
 * El token sigue siendo la autoridad; `X-Cliente-Guid` es verificación
 * cruzada, para que el servidor detecte una sesión apuntando a una base que
 * no le corresponde.
 */
function cabeceras(req: HttpRequest<unknown>, token: string, guid: string | null) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (guid && !esAdministracion(req.url)) {
    headers['X-Cliente-Guid'] = guid;
  }
  return headers;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  // Se inyecta acá arriba y no dentro del switchMap: `inject()` solo vale en
  // el contexto de inyección sincrónico del interceptor.
  const recaptcha = inject(RecaptchaService);
  const token = auth.getToken();

  if (esAutenticacion(req.url)) {
    const accion = accionRecaptcha(req.url);
    if (!accion) return next(req);

    // El token se pide ACÁ y no en el componente: así se acuña milisegundos
    // antes del POST y su vida útil de dos minutos deja de ser un problema.
    // Si viene null (captcha apagado, app nativa, script bloqueado) la
    // petición sale igual y decide el backend, que es el único lado donde la
    // decisión no se puede falsificar.
    return recaptcha
      .token(accion)
      .pipe(
        switchMap((captcha) =>
          next(captcha ? req.clone({ setHeaders: { 'X-Recaptcha-Token': captcha } }) : req)
        )
      );
  }

  let authReq = req;
  if (token) {
    authReq = req.clone({ setHeaders: cabeceras(req, token, auth.getGuidCliente()) });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        return auth.refreshToken().pipe(
          switchMap((tokenRes) => {
            const retryReq = req.clone({
              setHeaders: cabeceras(req, tokenRes.access_token, auth.getGuidCliente()),
            });
            return next(retryReq);
          }),
          catchError(() => {
            auth.logout();
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
