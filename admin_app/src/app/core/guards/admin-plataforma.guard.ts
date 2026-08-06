import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Consola de la plataforma. El backend igual exige el rol `superadmin`; esto
 * solo evita mostrar una pantalla que no va a cargar.
 *
 * Un usuario de cliente que llega acá vuelve a su inicio, no al login: su
 * sesión es válida, simplemente no es la suya esta sección.
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

  router.navigate(['/dashboard']);
  return false;
};
