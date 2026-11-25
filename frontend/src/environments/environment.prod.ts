/**
 * La URL de la API sale de `FRONTEND_API_URL` del `.env`: el contenedor la
 * vuelca al arrancar en `config.js` (`docker-entrypoint.d/40-config-js.sh`), que
 * `index.html` carga antes del bundle. Cambiarla es editar el `.env` y recrear
 * el contenedor, sin recompilar.
 *
 * Vacía (lo normal) se usa `/api/v1`: el Nginx que sirve la app hace de proxy
 * hacia el backend (ver `nginx.conf`), y no hay CORS. Con valor es una URL
 * absoluta, que sí exige el origen de la app en `BACKEND_CORS_ORIGINS`.
 */
declare global {
  interface Window {
    __ED_CONFIG__?: { apiUrl?: string };
  }
}

export const environment = {
  production: true,
  apiUrl: window.__ED_CONFIG__?.apiUrl || '/api/v1',
};
