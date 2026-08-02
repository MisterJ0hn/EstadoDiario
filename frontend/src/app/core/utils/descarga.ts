/**
 * Utilidades para las descargas de archivos que el backend entrega como blob
 * (por ahora, los informes en Excel).
 */

/** Dispara la descarga de un blob y libera el object URL enseguida. */
export function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
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
