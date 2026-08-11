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

/**
 * ¿Los dos RUT son el mismo? Tolerante con cómo vengan escritos.
 *
 * Se usa para avisar cuando el archivo que se está importando es de OTRO
 * estudio. Tiene que aguantar las tres diferencias que aparecen de verdad:
 * puntos y guion (`76.543.210-K` contra `76543210K`), mayúscula de la K, y
 * sobre todo **el dígito verificador ausente**, porque el PJUD a veces lo
 * omite en el nombre del archivo (`estadoDiario_16952077__28072026.xls`).
 *
 * Por eso también se comparan los cuerpos: dos RUT con el mismo cuerpo y
 * distinto dígito son el mismo RUT con un dígito mal escrito, no dos
 * personas — el dígito se deriva del cuerpo, no lo elige nadie.
 *
 * Con cualquiera de los dos vacío devuelve `true`: sin dato no hay nada que
 * objetar, y el llamador no debería mostrar una advertencia por no saber.
 */
export function mismoRut(a: string, b: string): boolean {
  const na = limpiarRut(a);
  const nb = limpiarRut(b);
  if (!na || !nb) return true;
  if (na === nb) return true;

  const cuerpo = (v: string) => (v.length > 1 ? v.slice(0, -1) : v);
  return cuerpo(na) === nb || na === cuerpo(nb) || cuerpo(na) === cuerpo(nb);
}

/**
 * ¿El RUT del archivo es alguno de los que la persona tiene registrados?
 *
 * `referencias` son los RUT con los que el usuario recibe archivos del PJUD
 * (`UserInfo.ruts`), o el del estudio cuando no se le cargó ninguno. Con la
 * lista vacía devuelve `true`: sin nada contra qué comparar no hay nada que
 * objetar, y el llamador no debería advertir por no saber.
 */
export function coincideConAlguno(rut: string, referencias: string[]): boolean {
  const candidatos = referencias.filter((r) => !!r && !!limpiarRut(r));
  if (!candidatos.length) return true;
  return candidatos.some((referencia) => mismoRut(rut, referencia));
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
