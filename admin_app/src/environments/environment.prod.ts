/**
 * Build de producción: la SPA se sirve por Nginx y ese mismo Nginx redirige
 * `/api/` a `admin_api` (ver admin_app/nginx.conf). Por eso la URL es
 * **relativa**: SPA y API quedan en el mismo origen y el navegador no aplica
 * CORS, que es la trampa que dejó la separación en dos procesos.
 *
 * En desarrollo no aplica: ahí el dev-server (4401) y la API (8092) son
 * orígenes distintos y environment.ts sí usa la URL absoluta, con
 * `ADMIN_API_CORS_ORIGINS` permitiéndolo del otro lado.
 *
 * Si se publica sin ese Nginx delante (la SPA en un hosting estático y la API
 * en otro host), hay que volver a poner acá la URL absoluta del servicio Y
 * agregar el origen de la SPA a `ADMIN_API_CORS_ORIGINS`. Las dos cosas o
 * ninguna: con una sola, la consola queda en blanco sin error de servidor.
 */
export const environment = {
  production: true,
  apiUrl: '/api/v1',
};
