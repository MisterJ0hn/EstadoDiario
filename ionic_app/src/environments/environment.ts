/**
 * Desarrollo, en el navegador (`npm start`).
 *
 * Ojo con `localhost` si se prueba en un teléfono real: ahí `localhost` es el
 * propio teléfono. Para eso está `environment.prod.ts`, o se cambia esta URL
 * por la IP del equipo en la red local (ej. `http://192.168.1.20:8091/api/v1`).
 */
export const environment = {
  production: false,
  apiUrl: 'http://edapi.temposoft.cl/api/v1',
};
