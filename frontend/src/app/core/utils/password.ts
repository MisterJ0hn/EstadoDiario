/**
 * Reglas de contraseña, para poder mostrarlas mientras la persona escribe.
 *
 * Es una copia de la política del servidor
 * (`backend/app/core/password_policy.py`), no la política misma: la que manda
 * es la del backend, que además comprueba el historial de las últimas
 * contraseñas —algo que el navegador no puede saber— y rechaza igual lo que
 * llegue sin pasar por esta pantalla.
 *
 * Si allá cambia el largo o se agrega una regla, esto hay que actualizarlo: no
 * son datos que viajen en ninguna respuesta.
 */

export const LARGO_MINIMO_PASSWORD = 8;

/** Cuántas contraseñas anteriores quedan vetadas, contando la vigente. */
export const HISTORIAL_PASSWORD = 4;

export interface ReglaPassword {
  texto: string;
  cumple: boolean;
}

/**
 * Estado de cada regla para el valor dado. Se devuelven TODAS, cumplidas o no:
 * la lista se muestra desde antes de escribir, para que nadie descubra un
 * requisito recién al mandar el formulario.
 */
export function reglasPassword(valor: string): ReglaPassword[] {
  const v = valor ?? '';
  return [
    { texto: `Al menos ${LARGO_MINIMO_PASSWORD} caracteres`, cumple: v.length >= LARGO_MINIMO_PASSWORD },
    { texto: 'Al menos una letra mayúscula', cumple: /[A-ZÁÉÍÓÚÜÑ]/.test(v) },
    { texto: 'Al menos una letra minúscula', cumple: /[a-záéíóúüñ]/.test(v) },
    { texto: 'Al menos un número', cumple: /[0-9]/.test(v) },
  ];
}

export function passwordCumplePolitica(valor: string): boolean {
  return reglasPassword(valor).every((r) => r.cumple);
}

/** El mismo texto en los dos lados: lo que el servidor va a exigir. */
export const NOTA_HISTORIAL_PASSWORD =
  `Además tiene que ser distinta de sus últimas ${HISTORIAL_PASSWORD} contraseñas; ` +
  `el sistema lo verifica al guardar.`;
