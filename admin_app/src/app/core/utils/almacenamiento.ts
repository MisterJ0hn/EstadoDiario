/**
 * Envoltura de `localStorage` que nunca lanza.
 *
 * Nació por el SSR —en Node no existe `localStorage` y leer la sesión reventaba
 * el render—, pero esa razón murió con el servidor: hoy esto es una SPA y
 * siempre corre en navegador. Se conserva por el motivo que sí sigue vivo:
 * **`localStorage` puede fallar aunque exista**. Con cookies de terceros
 * bloqueadas o en modo privado, Safari y Firefox lanzan `SecurityError` al solo
 * tocar la propiedad, y `setItem` lanza `QuotaExceededError` con la cuota llena.
 *
 * La política ante esos fallos es no tumbar la aplicación: leer devuelve `null`
 * (se pinta el login) y escribir se descarta en silencio (la sesión sigue viva
 * en memoria hasta que se recargue la página). Un administrador que no puede
 * persistir su token igual puede trabajar; uno que ve una pantalla en blanco,
 * no.
 *
 * Por eso el acceso va adentro del `try`, no antes: la excepción puede saltar
 * en el propio `window.localStorage`, no solo en el método.
 */

export function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function escribir(clave: string, valor: string): void {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    /* almacenamiento bloqueado o cuota llena: ver la nota de arriba */
  }
}

export function borrar(clave: string): void {
  try {
    window.localStorage.removeItem(clave);
  } catch {
    /* ídem */
  }
}
