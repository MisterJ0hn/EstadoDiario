/**
 * Build **web** para publicar en el servidor (`ng build --configuration web`).
 *
 * **La URL de la API no está escrita acá**: sale de `FRONTEND_API_URL` del
 * `.env`. El contenedor la vuelca al arrancar en `config.js`
 * (`docker-entrypoint.d/40-config-js.sh`), que `index.html` carga antes del
 * bundle. Así cambiar de dominio es editar el `.env` y recrear el contenedor,
 * sin recompilar.
 *
 * - **Vacía (lo normal)**: se usa `/api/v1`, relativa. El Nginx que sirve la app
 *   hace de proxy hacia el backend (ver `nginx.conf`), así que app y API quedan
 *   en el mismo origen, no hay CORS y funciona con cualquier hostname.
 *   Requiere que el dominio público de la app mande TODO su tráfico, `/api/`
 *   incluido, a este contenedor.
 * - **Con valor**: URL absoluta, p. ej. `https://api.midominio.cl/api/v1`. Sirve
 *   cuando el host de la app tiene su `/api/` apuntando a otra cosa. Activa
 *   CORS: el origen de la app tiene que estar en `BACKEND_CORS_ORIGINS`, o la
 *   app queda en blanco sin ningún error de servidor que lo explique. Tiene que
 *   ser https: el navegador no sigue redirecciones en un preflight.
 *
 * `production` —la del APK— lleva su URL absoluta propia (ver
 * `environment.prod.ts`): no hay contenedor que escriba `config.js`.
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
