/** Utilidades de RUT chileno.
 *
 * El RUT deja de ser un dato más: identifica al estudio en el login y es la
 * llave con la que el administrador da de alta un cliente. Un dígito
 * verificador mal tipeado manda a crear una base de datos equivocada, así que
 * se valida en el navegador antes de llegar al servidor.
 */

/** Deja solo dígitos y el dígito verificador (K incluida), en mayúscula. */
export function limpiarRut(valor: string): string {
  return (valor || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

/** `123456789` → `12.345.678-9`. Formato de presentación. */
export function formatearRut(valor: string): string {
  const limpio = limpiarRut(valor);
  if (limpio.length <= 1) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}

/** `12.345.678-9` → `12345678-9`. Formato que viaja al backend. */
export function rutPlano(valor: string): string {
  const limpio = limpiarRut(valor);
  if (limpio.length <= 1) return limpio;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

/** Verifica el dígito verificador (módulo 11). */
export function rutValido(valor: string): boolean {
  const limpio = limpiarRut(valor);
  if (limpio.length < 2) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;

  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo.charAt(i)) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return esperado === dv;
}
