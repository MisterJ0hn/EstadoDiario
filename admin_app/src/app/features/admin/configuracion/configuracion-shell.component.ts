import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Módulo de configuración de la plataforma.
 *
 * Es un solo módulo con cuatro paneles, no cuatro entradas de menú: son
 * ajustes que se tocan juntos al poner el sistema en marcha y casi nunca
 * después. El armazón aporta solo la navegación; cada panel conserva su propio
 * título y su propio formulario.
 */
@Component({
  selector: 'app-configuracion-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <div class="border-b border-neutral-200">
        <nav class="tabs-nav" aria-label="Configuración de la plataforma">
          @for (p of paneles; track p.ruta) {
            <a
              [routerLink]="p.ruta"
              routerLinkActive="tab-link-activo"
              #activo="routerLinkActive"
              [attr.aria-current]="activo.isActive ? 'page' : null"
              class="tab-link"
            >
              {{ p.etiqueta }}
            </a>
          }
        </nav>
      </div>

      <router-outlet />
    </div>
  `,
})
export class ConfiguracionShellComponent {
  readonly paneles = [
    { ruta: 'smtp', etiqueta: 'Correo de salida' },
    { ruta: 'google-calendar', etiqueta: 'Google Calendar' },
    { ruta: 'whatsapp', etiqueta: 'WhatsApp' },
    { ruta: 'transbank', etiqueta: 'Transbank' },
    { ruta: 'sistema', etiqueta: 'Sistema' },
  ];
}
