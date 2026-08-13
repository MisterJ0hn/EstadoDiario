/**
 * Producción: la build que se empaqueta en el APK y la que se publica en web.
 *
 * **La URL tiene que ser absoluta.** En el frontend web bastaba `/api/v1`
 * porque la app y la API salen del mismo origen; en Android no hay tal cosa:
 * la app se sirve desde el WebView (`https://localhost`), así que una ruta
 * relativa pega contra el propio teléfono y todo falla con un error de red que
 * no explica nada.
 *
 * **Tiene que ser `https`, y no es una preferencia.** El servidor responde a
 * todo lo que llega por http con un `301` hacia https, y el navegador —el
 * WebView de Android es uno— **no sigue redirecciones en un preflight**: la
 * petición `OPTIONS` moría con
 *
 *     Redirect is not allowed for a preflight request
 *
 * y el login fallaba con un `ERR_FAILED` que parecía un problema de CORS del
 * backend. No lo era: por https el preflight responde 200 y con el origen
 * `https://localhost` permitido.
 *
 * Para la build **web** servida desde otro origen hay que agregarlo a
 * `BACKEND_CORS_ORIGINS` del backend. Android no pasa por CORS.
 */
export const environment = {
  production: true,
  apiUrl: 'https://edapi.temposoft.cl/api/v1',
};
