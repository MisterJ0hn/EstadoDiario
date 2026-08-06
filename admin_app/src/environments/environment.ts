/**
 * La consola dejó de ser un monolito: acá vive **solo** la SPA, y la API es un
 * servicio aparte (`admin_api/`, FastAPI, puerto 8092). Por eso la URL es
 * absoluta y ya no relativa.
 *
 * Consecuencia importante: al servirse desde otro origen (el dev-server en
 * 4401, o el host donde se publique el build), **el navegador aplica CORS**.
 * `admin_api` tiene que permitir explícitamente el origen de esta SPA, incluido
 * el preflight `OPTIONS` y el encabezado `Authorization` que manda el
 * interceptor. Cuando eran el mismo proceso esto no hacía falta y no existía
 * ninguna configuración de CORS que mantener.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8092/api/v1',
};
