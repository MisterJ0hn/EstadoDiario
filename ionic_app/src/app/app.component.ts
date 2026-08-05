import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Armazón de la app.
 *
 * `ion-router-outlet` en vez de `router-outlet`: es el que da las
 * transiciones y, sobre todo, el que mantiene la pila de navegación que el
 * botón físico de atrás de Android necesita para retroceder.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet />
    </ion-app>
  `,
})
export class AppComponent {
  private router = inject(Router);

  constructor() {
    this.configurarBotonAtras();
  }

  /**
   * Botón físico de atrás de Android.
   *
   * Sin esto, el comportamiento por defecto en la primera pantalla es cerrar
   * la app: alguien que está en el listado de causas y toca atrás por reflejo
   * se queda sin sesión a la vista. Acá, si no hay a dónde volver, se
   * minimiza —que es lo que hacen las apps del sistema— en vez de cerrarse.
   */
  private configurarBotonAtras(): void {
    if (!Capacitor.isNativePlatform()) return;

    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }
      // En el login sí corresponde salir: atrás desde ahí no tiene a dónde ir.
      if (this.router.url.startsWith('/login')) {
        CapacitorApp.exitApp();
        return;
      }
      CapacitorApp.minimizeApp();
    });
  }
}
