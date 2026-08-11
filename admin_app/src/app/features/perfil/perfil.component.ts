import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import {
  HISTORIAL_PASSWORD,
  LARGO_MINIMO_PASSWORD,
  passwordCumplePolitica,
  reglasPassword,
} from '@core/utils/password';

/**
 * Perfil del administrador de la plataforma.
 *
 * **Faltaba.** El enlace estaba en la barra lateral desde siempre, pero no
 * había ni ruta ni componente: al pulsarlo la navegación caía en el comodín
 * `**` y volvía al dashboard, así que parecía que el enlace no hacía nada.
 *
 * Tiene menos que el perfil de un usuario de estudio, y es correcto: el
 * administrador no tiene teléfono para recordatorios, ni RUT del Poder
 * Judicial, ni Google Calendar. Lo que sí necesita es ver con qué cuenta entró
 * y poder cambiar su clave sin que se la resetee otro.
 *
 * El cambio de clave es el **voluntario**: se exige la actual. El otro caso
 * —clave provisoria, sin salida hasta reemplazarla— lo cubre `/cambiar-clave`,
 * que es una pantalla aparte porque bloquea el resto de la consola.
 */
@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 max-w-2xl">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Mi Perfil</h1>
        <p class="text-neutral-500 mt-1">Su cuenta de administrador de la plataforma</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="text-lg font-semibold">Datos</h2>
        </div>
        <div class="card-body">
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt class="text-xs text-neutral-500 uppercase">Usuario</dt>
              <dd class="font-medium mt-0.5">{{ auth.user()?.username }}</dd>
            </div>
            @if (nombreCompleto(); as nombre) {
              <div>
                <dt class="text-xs text-neutral-500 uppercase">Nombre</dt>
                <dd class="font-medium mt-0.5">{{ nombre }}</dd>
              </div>
            }
            @if (auth.user()?.email; as correo) {
              <div>
                <dt class="text-xs text-neutral-500 uppercase">Correo</dt>
                <dd class="font-medium mt-0.5 break-all">{{ correo }}</dd>
              </div>
            }
            <div>
              <dt class="text-xs text-neutral-500 uppercase">Ámbito</dt>
              <dd class="mt-0.5"><span class="badge-info">Administrador de la plataforma</span></dd>
            </div>
          </dl>
          <p class="text-xs text-neutral-500 mt-4 pt-4 border-t border-neutral-100">
            Estos datos los administra el sistema. Para cambiarlos, contacte a otro
            administrador.
          </p>
        </div>
      </div>

      <!-- Cambio voluntario de contraseña: la actual es obligatoria. -->
      <div class="card">
        <div class="card-header">
          <h2 class="text-lg font-semibold">Contraseña</h2>
        </div>
        <div class="card-body space-y-4">
          <div>
            <label class="form-label" for="p-actual">Contraseña actual</label>
            <input id="p-actual" type="password" class="form-input" autocomplete="current-password"
                   [ngModel]="claveActual()" (ngModelChange)="claveActual.set($event)" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="form-label" for="p-nueva">Contraseña nueva</label>
              <input id="p-nueva" type="password" class="form-input" autocomplete="new-password"
                     [ngModel]="claveNueva()" (ngModelChange)="claveNueva.set($event)" />
            </div>
            <div>
              <label class="form-label" for="p-repite">Repita la nueva</label>
              <input id="p-repite" type="password" class="form-input" autocomplete="new-password"
                     [ngModel]="claveConfirmacion()" (ngModelChange)="claveConfirmacion.set($event)" />
            </div>
          </div>

          <!-- Las reglas que el navegador puede comprobar. Que la actual sea
               correcta y que la nueva no repita las últimas solo las sabe el
               servidor, y llegan como mensaje de error. -->
          @if (claveNueva()) {
            <ul class="text-xs space-y-1">
              @for (r of reglas(); track r.texto) {
                <li [class]="r.cumple ? 'text-accent-700' : 'text-neutral-500'">
                  {{ r.cumple ? '✓' : '·' }} {{ r.texto }}
                </li>
              }
            </ul>
          }

          @if (errorClave()) {
            <div class="alert-danger"><div class="flex-1">{{ errorClave() }}</div></div>
          }

          <div class="flex justify-end">
            <button type="button" class="btn-primary" (click)="cambiarClave()"
                    [disabled]="guardando() || !puedeGuardar()">
              {{ guardando() ? 'Guardando...' : 'Cambiar contraseña' }}
            </button>
          </div>

          <p class="text-xs text-neutral-500">
            No puede repetir sus últimas {{ HISTORIAL }} contraseñas.
          </p>
        </div>
      </div>
    </div>
  `,
})
export class PerfilComponent {
  auth = inject(AuthService);
  private notification = inject(NotificationService);

  readonly HISTORIAL = HISTORIAL_PASSWORD;

  claveActual = signal('');
  claveNueva = signal('');
  claveConfirmacion = signal('');
  guardando = signal(false);
  errorClave = signal('');

  nombreCompleto = computed(() => {
    const u = this.auth.user();
    return [u?.nombre, u?.apellido].filter(Boolean).join(' ') || null;
  });

  reglas = computed(() => [
    ...reglasPassword(this.claveNueva()),
    {
      texto: 'Ambas contraseñas coinciden',
      cumple: !!this.claveNueva() && this.claveNueva() === this.claveConfirmacion(),
    },
  ]);

  puedeGuardar = computed(
    () =>
      !!this.claveActual() &&
      passwordCumplePolitica(this.claveNueva()) &&
      this.claveNueva() === this.claveConfirmacion()
  );

  cambiarClave(): void {
    if (this.guardando() || !this.puedeGuardar()) return;
    this.errorClave.set('');
    this.guardando.set(true);

    this.auth
      .cambiarPasswordObligatorio({
        password_actual: this.claveActual(),
        password_nueva: this.claveNueva(),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.claveActual.set('');
          this.claveNueva.set('');
          this.claveConfirmacion.set('');
          this.notification.success('Contraseña actualizada');
        },
        error: (e) => {
          this.guardando.set(false);
          const detail = (e as { error?: { detail?: unknown } })?.error?.detail;
          this.errorClave.set(
            typeof detail === 'string'
              ? detail
              : `No se pudo cambiar la contraseña. Debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`
          );
        },
      });
  }
}
