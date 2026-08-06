/**
 * Build **web** para publicar en el servidor (`ng build --configuration web`).
 *
 * Es una configuración aparte de `production` a propósito, y la diferencia es
 * una sola línea con consecuencias opuestas:
 *
 * - `production` (el APK) **necesita** la URL absoluta: la app se sirve desde
 *   el WebView en `https://localhost`, así que `/api/v1` pegaría contra el
 *   propio teléfono.
 * - Esta build **necesita** la relativa: sale por el mismo Nginx que hace de
 *   proxy hacia el backend (ver ionic_app/nginx.conf), así que la app y la API
 *   quedan en el mismo origen y **el navegador no aplica CORS**. Con la URL
 *   absoluta habría que mantener el dominio acá y en
 *   `BACKEND_CORS_ORIGINS` del backend, y si se olvida una de las dos la app
 *   queda en blanco sin ningún error de servidor.
 *
 * Por eso no se tocó `environment.prod.ts`: cambiarlo para la web rompería el
 * APK, y son el mismo código.
 *
 * Si se publica SIN ese Nginx delante (los estáticos en un hosting y la API en
 * otro host), hay que poner acá la URL absoluta Y agregar el origen a
 * `BACKEND_CORS_ORIGINS`. Las dos cosas o ninguna.
 */
export const environment = {
  production: true,
  apiUrl: '/api/v1',
};
