import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Se fue el render en servidor y con él la hidratación de cliente que lo
    // acompañaba: esto arranca vacío y se llena pidiéndole todo a `admin_api`.
    // `withFetch` se queda porque `fetch` es el cliente que Angular recomienda
    // hoy en navegador; XHR solo sigue existiendo por compatibilidad.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
  ],
};
