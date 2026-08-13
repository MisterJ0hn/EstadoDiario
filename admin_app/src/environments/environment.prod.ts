/**
 * Build de producción de la consola.
 *
 * **Apunta a `localhost:8092`, y eso significa el equipo de quien abre la
 * consola, no el servidor.** Es deliberado: la API de administración no se
 * expone a internet, así que la consola solo funciona desde una máquina que
 * tenga `admin_api` corriendo o alcanzable en ese puerto (en el propio
 * servidor, o por un túnel SSH). Es la contracara de la decisión: nadie llega
 * a los endpoints de la plataforma desde fuera, y a cambio la consola no se
 * puede abrir desde cualquier navegador.
 *
 * Antes era `/api/v1` relativa, asumiendo un Nginx que hiciera de proxy en el
 * mismo origen. Si algún día se publica así, hay que volver a la relativa —o
 * poner acá el dominio público— **y** agregar el origen de la SPA a
 * `ADMIN_API_CORS_ORIGINS`. Las dos cosas o ninguna: con una sola, la consola
 * queda en blanco sin error de servidor.
 *
 * Ojo con el esquema: si la consola se sirve por **https** y pide a
 * `http://localhost:8092`, el navegador lo bloquea por contenido mixto.
 * Sirviéndola por http, o abriéndola desde el disco, no hay problema.
 */
export const environment = {
  production: true,
  apiUrl: '/api/v1',
};
