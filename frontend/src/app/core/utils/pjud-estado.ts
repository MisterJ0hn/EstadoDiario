/**
 * Traduce `Causa.pjud_estado` (último resultado del log de llamados a
 * api-pjud.codifica.cl, ver `pjud_llamado`) a la variante del botón "Detalle
 * PJUD": mismo icono/color en Mis Causas y en cualquier otra pantalla que lo
 * ofrezca por rol/tribunal (Estado Diario, Movimientos).
 *
 * `nuevo` = nunca se sincronizó, o falta la clave del OJV (`sin_credenciales`)
 * `listo` = el botón queda tal cual siempre (icono normal).
 */
export type PjudBotonVariante = 'nuevo' | 'sincronizando' | 'error' | 'listo';

export function pjudBotonEstado(pjudEstado: string | null | undefined): PjudBotonVariante {
  if (pjudEstado === 'sincronizando') return 'sincronizando';
  if (pjudEstado === 'error') return 'error';
  if (pjudEstado === 'listo') return 'listo';
  return 'nuevo';
}

export function pjudBotonTitulo(variante: PjudBotonVariante): string {
  switch (variante) {
    case 'sincronizando': return 'Sincronizando con el Poder Judicial...';
    case 'error': return 'La sincronización con el Poder Judicial falló';
    case 'listo': return 'Detalle PJUD';
    default: return 'Aún no se ha sincronizado con el Poder Judicial';
  }
}
