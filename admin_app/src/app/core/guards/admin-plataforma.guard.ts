import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Consola de la plataforma. El backend igual rechaza los tokens que no son de
 * ámbito `sistema`; esto solo evita mostrar pantallas que no van a cargar.
 *
 * **El destino de rechazo tiene que estar FUERA de lo que este guard
 * protege.** Antes mandaba a `/dashboard`, que es hijo de la ruta guardada:
 * el guard se llamaba a sí mismo, fallaba otra vez y volvía a navegar, en un
 * bucle infinito que congelaba la pestaña. No daba error en consola ni en el
 * servidor — solo se colgaba.
 *
 * Por eso va a `/login`, que es la única ruta de esta app fuera del árbol
 * protegido, y además se cierra la sesión: si el token no es de la consola,
 * conservarlo solo repetiría el rechazo en la siguiente navegación.
 */
export const adminPlataformaGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.getToken()) {
    router.navigate(['/login']);
    return false;
  }

  if (auth.esAdminPlataforma()) {
    return true;
  }

  auth.logout();
  return false;
};
