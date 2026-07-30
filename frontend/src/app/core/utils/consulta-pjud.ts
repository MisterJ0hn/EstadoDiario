/**
 * Datos para buscar una causa en la Oficina Judicial Virtual del Poder Judicial.
 *
 * El sitio del PJUD no se puede embeber (responde
 * `Content-Security-Policy: frame-ancestors *.pjud.cl ...`, así que el navegador
 * se niega a pintarlo en un iframe nuestro) y su formulario de consulta es POST
 * + JS, o sea que tampoco acepta parámetros por URL para prellenarlo. Lo que sí
 * podemos hacer es abrirlo en una ventana aparte y dejarle al usuario cada campo
 * del formulario listo para copiar y pegar.
 */

/** Página de consulta de causas de la OJV. */
export const URL_OJV = 'https://oficinajudicialvirtual.pjud.cl/indexN.php';

export interface CampoConsulta {
  /** Etiqueta igual a la del formulario del PJUD, para que se reconozca al pegar */
  etiqueta: string;
  valor: string;
}

/** Rol desglosado en las tres cajas que pide el formulario del PJUD. */
export interface RolDesglosado {
  tipoLibro: string | null;
  numero: string | null;
  anio: string | null;
}

// "C-1234-2026", "RIT C-1234-2026", "Rol: C-1234-2026", "Protección-456-2026"
const CON_LIBRO = /^(?:RIT|ROL|R\.I\.T\.)?\s*:?\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]{1,15})\s*-\s*(\d{1,7})\s*-\s*(\d{4})$/i;
// "1234-2026" (típico de Cortes: N° de ingreso y año, sin tipo de libro)
const SIN_LIBRO = /^(?:RIT|ROL|R\.I\.T\.)?\s*:?\s*(\d{1,7})\s*-\s*(\d{4})$/i;
// "C-1234" (sin año; el año se completa después con la fecha de ingreso)
const SIN_ANIO = /^(?:RIT|ROL|R\.I\.T\.)?\s*:?\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]{1,15})\s*-\s*(\d{1,7})$/i;

/**
 * Separa un rol chileno en tipo de libro, número y año.
 *
 * `anioIngreso` (el año de la fecha de ingreso del movimiento) se usa solo
 * cuando el rol no trae año. Si el formato no se reconoce se devuelve todo en
 * null y la ficha muestra el rol completo tal cual, sin inventar un desglose.
 */
export function desglosarRol(rol: string | null, anioIngreso?: string | null): RolDesglosado {
  const vacio: RolDesglosado = { tipoLibro: null, numero: null, anio: null };
  if (!rol) return vacio;

  const limpio = rol.trim();

  const conLibro = CON_LIBRO.exec(limpio);
  if (conLibro) {
    return { tipoLibro: conLibro[1].toUpperCase(), numero: conLibro[2], anio: conLibro[3] };
  }

  const sinLibro = SIN_LIBRO.exec(limpio);
  if (sinLibro) {
    return { tipoLibro: null, numero: sinLibro[1], anio: sinLibro[2] };
  }

  const sinAnio = SIN_ANIO.exec(limpio);
  if (sinAnio) {
    return {
      tipoLibro: sinAnio[1].toUpperCase(),
      numero: sinAnio[2],
      anio: anioDe(anioIngreso),
    };
  }

  // Solo un número ("1234"): sirve como rol, el año sale de la fecha de ingreso.
  if (/^\d{1,7}$/.test(limpio)) {
    return { tipoLibro: null, numero: limpio, anio: anioDe(anioIngreso) };
  }

  return vacio;
}

function anioDe(fecha?: string | null): string | null {
  if (!fecha) return null;
  const m = /^(\d{4})/.exec(fecha.trim());
  return m ? m[1] : null;
}

/**
 * Campos a mostrar para copiar, en el mismo orden en que aparecen en el
 * formulario de la OJV. Se omiten los que el movimiento no trae.
 */
export function camposConsulta(m: {
  jurisdiccion: string | null;
  corte: string | null;
  tribunal: string | null;
  rol: string | null;
  fecha_ingreso: string | null;
}): CampoConsulta[] {
  const { tipoLibro, numero, anio } = desglosarRol(m.rol, m.fecha_ingreso);

  const campos: (CampoConsulta | null)[] = [
    m.jurisdiccion ? { etiqueta: 'Competencia', valor: m.jurisdiccion } : null,
    m.corte ? { etiqueta: 'Corte', valor: m.corte } : null,
    m.tribunal ? { etiqueta: 'Tribunal', valor: m.tribunal } : null,
    tipoLibro ? { etiqueta: 'Tipo libro', valor: tipoLibro } : null,
    numero ? { etiqueta: 'Rol', valor: numero } : null,
    anio ? { etiqueta: 'Año', valor: anio } : null,
  ];

  return campos.filter((c): c is CampoConsulta => c !== null);
}
