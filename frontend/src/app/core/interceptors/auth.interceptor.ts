import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Endpoints donde todavía no hay sesión: no llevan token ni tenant. */
function esAutenticacion(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/admin/login') ||
    url.includes('/auth/refresh')
  );
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
  const token = auth.getToken();

  if (esAutenticacion(req.url)) {
    return next(req);
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
