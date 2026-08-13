/**
 * El día por defecto de las pantallas de estado diario, y cómo se rotula.
 *
 * Vive acá y no dentro de una pantalla porque son tres las que lo usan
 * —movimientos, causas de corte y archivos recibidos— y tienen que coincidir:
 * abrir dos pestañas y ver días distintos sería peor que no tener default.
 *
 * Qué día es lo decide el backend (`GET /estado-diario/fecha-inicial`), no
 * esto: depende de qué hay cargado en la base y de qué día es hoy en Chile, y
 * el reloj del navegador no sabe ninguna de las dos cosas. Acá solo está lo
 * que es puramente de presentación.
 */

import { FechaInicialResponse } from '@core/models/estado-diario.model';

/**
 * ISO (yyyy-MM-dd) a formato chileno (dd-mm-yyyy).
 *
 * Se parte el string en vez de usar `Date`: una fecha ISO pura se interpreta
 * como UTC y en Chile se muestra corrida un día.
 */
export function fmtFechaChip(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return dia && mes && anio ? `${dia}-${mes}-${anio}` : iso;
}

/**
 * Etiqueta del chip del filtro de fecha.
 *
 * Cuando la fecha viene del default hay que decir POR QUÉ es esa: un 13 de
 * agosto, ver "28-07-2026" sin explicación parece un error de la aplicación y
 * no lo que es —que ese fue el último día con estado diario cargado—. Con
 * cualquier fecha que el usuario haya elegido a mano, en cambio, la etiqueta
 * sobra: ya sabe por qué está ahí.
 */
export function etiquetaFecha(motivo: FechaInicialResponse['motivo']): string {
  if (motivo === 'ayer') return 'Día';
  if (motivo === 'ultimo') return 'Último día con datos';
  return 'Día';
}
