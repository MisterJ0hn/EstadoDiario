/**
 * Fechas de período, en un solo lugar.
 *
 * Todas las pantallas de facturación necesitan lo mismo: convertir
 * `2026-07-01` en "julio 2026" y calcular el primer día de un mes. Estaba
 * copiado en cada componente y era cuestión de tiempo que dos versiones
 * discreparan en el mes que muestran.
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * `2026-07-01` → `julio 2026`.
 *
 * Sin pasar por `Date`: una fecha ISO sin hora se interpreta como UTC y en
 * Chile eso la corre al día anterior, que en el día 1 del mes cambia el mes
 * entero.
 */
export function nombreMes(periodo: string | null | undefined): string {
  if (!periodo) return '—';
  const [anio, mes] = periodo.split('-');
  return `${MESES[Number(mes) - 1] ?? mes} ${anio}`;
}

/** El primer día del mes, `desplazamiento` meses desde hoy, en ISO. */
export function mesDe(desplazamiento: number): string {
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + desplazamiento, 1);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-01`;
}

/** El último día del mes de esa fecha ISO. `2026-07-01` → `2026-07-31`. */
export function finDeMes(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const ultimo = new Date(anio, mes, 0);
  return `${anio}-${`${mes}`.padStart(2, '0')}-${`${ultimo.getDate()}`.padStart(2, '0')}`;
}
