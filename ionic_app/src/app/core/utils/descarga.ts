/**
 * Descargas de los archivos que el backend entrega como blob (los informes en
 * Excel).
 *
 * **En Android no sirve `<a download>`.** Dentro del WebView ese truco no
 * hace absolutamente nada: no se guarda el archivo y tampoco aparece un error,
 * así que quien aprieta "Descargar" se queda mirando una pantalla que no
 * responde. Por eso en nativo el archivo se escribe con Filesystem y se abre
 * la hoja de compartir, que es la forma en que Android entrega un archivo a la
 * app que corresponda (Drive, Gmail, Excel...).
 *
 * En web se conserva el comportamiento de siempre.
 */

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Entrega el blob al usuario. Devuelve una promesa porque en Android escribir
 * el archivo es asíncrono; en web resuelve de inmediato.
 *
 * `titulo` es lo que se muestra en la hoja de compartir de Android.
 */
export async function descargarBlob(
  blob: Blob,
  nombreArchivo: string,
  titulo = 'Informe'
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const base64 = await blobABase64(blob);

  // Cache y no Documents: no requiere permiso de almacenamiento en ninguna
  // versión de Android, y el archivo ya quedó donde el usuario lo mande desde
  // la hoja de compartir. Lo que queda acá lo limpia el sistema solo.
  const { uri } = await Filesystem.writeFile({
    path: nombreArchivo,
    data: base64,
    directory: Directory.Cache,
  });

  await Share.share({
    title: titulo,
    text: nombreArchivo,
    url: uri,
    dialogTitle: 'Guardar o compartir el informe',
  });
}

/**
 * Filesystem espera base64, no un Blob.
 *
 * `readAsDataURL` devuelve `data:<mime>;base64,<datos>` y hay que quedarse con
 * la última parte: si se manda el prefijo, el archivo se escribe corrupto y
 * Excel lo abre vacío.
 */
function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(lector.error);
    lector.onload = () => {
      const resultado = String(lector.result);
      resolver(resultado.slice(resultado.indexOf(',') + 1));
    };
    lector.readAsDataURL(blob);
  });
}

/**
 * Cuando la petición va con `responseType: 'blob'`, el cuerpo del error también
 * llega como blob, así que hay que leerlo para recuperar el `detail` del backend.
 */
export function mensajeErrorBlob(error: unknown, respaldo: string): Promise<string> {
  const cuerpo = (error as { error?: unknown } | null)?.error;

  if (cuerpo instanceof Blob) {
    return cuerpo.text().then((texto) => {
      try {
        const json = JSON.parse(texto) as { detail?: string; mensaje?: string };
        return json.detail || json.mensaje || respaldo;
      } catch {
        return texto || respaldo;
      }
    });
  }

  const detalle = (cuerpo as { detail?: string } | null)?.detail;
  return Promise.resolve(detalle || respaldo);
}

/** Nombre de archivo seguro: sin separadores de ruta ni caracteres inválidos. */
export function nombreArchivoSeguro(nombre: string, extension = '.xlsx'): string {
  const limpio = (nombre || 'informe').replace(/[\\/:*?"<>|]+/g, '_').trim();
  return `${limpio || 'informe'}${extension}`;
}

export { MIME_XLSX };
