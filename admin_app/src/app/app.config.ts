import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

// Sin esto Angular formatea en inglés y los montos salen `$7,151` en vez de
// `$7.151`: en Chile el punto separa los miles y la coma los decimales. Se
// registra el locale completo y además se fija como el de la aplicación, que es
// lo que leen los pipes `currency`, `date` y `number` cuando no se les pasa uno.
registerLocaleData(localeEsCl);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CL' },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Se fue el render en servidor y con él la hidratación de cliente que lo
    // acompañaba: esto arranca vacío y se llena pidiéndole todo a `admin_api`.
    // `withFetch` se queda porque `fetch` es el cliente que Angular recomienda
    // hoy en navegador; XHR solo sigue existiendo por compatibilidad.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
  ],
};
