import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    // `mode: 'md'` fija Material Design en las dos plataformas. Sin esto, iOS
    // y Android pintan distinto los mismos componentes, y acá lo que se quiere
    // es que la app se vea igual que el frontend web, no como una app nativa.
    provideIonicAngular({ mode: 'md' }),
  ],
};
