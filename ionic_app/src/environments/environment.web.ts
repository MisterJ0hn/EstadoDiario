/**
 * Build **web** para publicar en el servidor (`ng build --configuration web`).
 *
 * **URL absoluta hacia `edapi`, no relativa.** La relativa asumía que la app y
 * la API salen por el mismo Nginx; en el despliegue actual no es así: el host
 * que sirve la app (`ed.temposoft.cl`) tiene su `/api/` apuntando a otra cosa,
 * y el login moría con un 404 de FastAPI —`{"detail":"Not Found"}`— porque
 * llegaba a la API de la consola, que no tiene `/auth/login`. Con la URL
 * absoluta la app habla directo con su backend y deja de depender de cómo esté
 * ruteado ese host.
 *
 * **Esto activa CORS**, que con la URL relativa no existía. Requiere que el
 * origen de la app esté en `BACKEND_CORS_ORIGINS` del backend; hoy lo está
 * (`https://ed.temposoft.cl` responde el preflight con su
 * `access-control-allow-origin`). Si mañana se publica la web en otro dominio,
 * hay que agregarlo ahí también: si se olvida, la app queda en blanco sin
 * ningún error de servidor que lo explique.
 *
 * **https y no http**: el servidor responde 301 hacia https, y el navegador no
 * sigue redirecciones en un preflight (ver `environment.prod.ts`).
 *
 * `production` —la del APK— apunta al mismo backend por su cuenta: son el
 * mismo código y el mismo destino, pero configuraciones distintas.
 */
export const environment = {
  production: true,
  apiUrl: 'https://edapi.temposoft.cl/api/v1',
};
