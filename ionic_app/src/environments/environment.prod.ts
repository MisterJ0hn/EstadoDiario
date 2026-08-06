/**
 * Producción: la build que se empaqueta en el APK y la que se publica en web.
 *
 * **La URL tiene que ser absoluta.** En el frontend web bastaba `/api/v1`
 * porque la app y la API salen del mismo origen; en Android no hay tal cosa:
 * la app se sirve desde el WebView (`https://localhost`), así que una ruta
 * relativa pega contra el propio teléfono y todo falla con un error de red que
 * no explica nada.
 *
 * Dos cosas del despliegue actual que hay que tener presentes:
 *
 * - El backend responde por **http**, no https. Android 9+ bloquea el tráfico
 *   en claro por defecto, y por eso el `AndroidManifest` habilita
 *   `usesCleartextTraffic` para este dominio. Cuando la API tenga TLS,
 *   cambiar a `https://` y quitar esa excepción.
 * - Para la build **web** servida desde otro origen hay que agregarlo a
 *   `BACKEND_CORS_ORIGINS` del backend. Android no pasa por CORS.
 */
export const environment = {
  production: true,
  apiUrl: 'http://edapi.temposoft.cl/api/v1',
};
