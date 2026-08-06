import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Bloquea el resto del sistema mientras la contraseña esté marcada como
 * obligatoria de cambiar. El backend rechaza igual esas llamadas; esto evita
 * que el usuario vea pantallas que solo le devolverían errores.
 */
export const claveVigenteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.debeCambiarPassword()) {
    router.navigate(['/cambiar-clave']);
    return false;
  }
  return true;
};

/**
 * Al revés: la pantalla de cambio obligatorio no tiene sentido si la clave ya
 * está al día. Evita que quede accesible escribiendo la URL.
 */
export const cambioClaveGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.getToken()) {
    router.navigate(['/login']);
    return false;
  }
  if (!auth.debeCambiarPassword()) {
    router.navigate(['/dashboard']);
    return false;
  }
  return true;
};
