/* Configuración de la app en tiempo de ejecución.
 *
 * En el contenedor web este archivo lo REESCRIBE al arrancar
 * docker-entrypoint.d/40-config-js.sh con lo que haya en FRONTEND_API_URL.
 * Esta copia, vacía, es la que sirven `ng serve` y el APK, donde no hay
 * contenedor: ahí manda el valor de cada `environment.*.ts`. */
window.__ED_CONFIG__ = {};
