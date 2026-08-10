import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { RecaptchaService } from '@core/services/recaptcha.service';
import { RecaptchaAvisoComponent } from '@shared/components/recaptcha-aviso.component';
import {
  NOTA_HISTORIAL_PASSWORD,
  passwordCumplePolitica,
  reglasPassword,
} from '@core/utils/password';

/**
 * "Olvidé mi contraseña", paso 2: la pantalla a la que lleva el enlace del
 * correo.
 *
 * Es la única pantalla que se abre sin sesión y sin login: la prueba de
 * identidad fue recibir el correo. El token viaja en `?token=` de la URL y no
 * se guarda en ninguna parte —no es una sesión— así que si la persona recarga
 * la página con el enlace, sigue funcionando, y si lo pierde tiene que pedir
 * otro.
 *
 * Al terminar NO queda la sesión iniciada: se manda al login. Es un paso más,
 * pero deja claro que la clave nueva funciona, que es justamente lo que la
 * persona quiere comprobar.
 */
@Component({
  selector: 'app-restablecer-clave',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RecaptchaAvisoComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 px-4 py-8">
      <div class="card w-full max-w-md">
        <div class="card-body p-8">
          <div class="text-center mb-6">
            <div class="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-neutral-800">Cree su contraseña nueva</h1>
            <p class="text-neutral-500 mt-1">
              Este enlace se puede usar una sola vez.
            </p>
          </div>

          @if (!token) {
            <div class="alert-danger mb-4" role="alert">
              El enlace está incompleto. Ábralo desde el correo tal como llegó, sin
              copiar solo una parte.
            </div>
            <a routerLink="/recuperar-clave" class="btn-primary w-full">Pedir un enlace nuevo</a>
          } @else if (listo()) {
            <div class="alert-success mb-4" role="status">
              Su contraseña quedó actualizada. Ingrese con ella.
            </div>
            <a routerLink="/login" class="btn-primary w-full">Ir al ingreso</a>
          } @else {
            @if (errorMsg()) {
              <div class="alert-danger mb-4" role="alert">{{ errorMsg() }}</div>
            }

            <form (ngSubmit)="guardar()" class="space-y-5" novalidate>
              <div>
                <label class="form-label" for="nueva">Contraseña nueva</label>
                <input
                  id="nueva"
                  type="password"
                  class="form-input"
                  [ngModel]="nueva()"
                  (ngModelChange)="nueva.set($event)"
                  name="nueva"
                  autocomplete="new-password"
                  aria-describedby="reglas-clave"
                />
              </div>

              <div>
                <label class="form-label" for="confirmacion">Repita la contraseña nueva</label>
                <input
                  id="confirmacion"
                  type="password"
                  class="form-input"
                  [ngModel]="confirmacion()"
                  (ngModelChange)="confirmacion.set($event)"
                  name="confirmacion"
                  autocomplete="new-password"
                />
              </div>

              <!-- Las reglas se ven antes de escribir y se van cumpliendo a la
                   vista. El estado no depende solo del color: cada regla lleva
                   su marca y su texto. -->
              <ul id="reglas-clave" class="space-y-1.5 text-sm">
                @for (r of reglas(); track r.texto) {
                  <li class="flex items-start gap-2"
                      [class]="r.cumple ? 'text-accent-700' : 'text-neutral-600'">
                    @if (r.cumple) {
                      <svg class="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span class="sr-only">Cumple:</span>
                    } @else {
                      <svg class="w-4 h-4 mt-0.5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="8" stroke-width="2" />
                      </svg>
                      <span class="sr-only">Falta:</span>
                    }
                    <span>{{ r.texto }}</span>
                  </li>
                }
              </ul>
              <p class="text-xs text-neutral-500 -mt-2">{{ notaHistorial }}</p>

              <button type="submit" class="btn-primary w-full" [disabled]="guardando()">
                @if (guardando()) {
                  <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                }
                {{ guardando() ? 'Guardando...' : 'Guardar contraseña' }}
              </button>
            </form>

            <div class="border-t border-neutral-200 mt-6 pt-4 text-center">
              <a routerLink="/login"
                 class="text-sm text-neutral-500 hover:text-primary-700 hover:underline
                        focus:outline-none focus:ring-2 focus:ring-primary-200 rounded px-2 py-1">
                Volver al ingreso
              </a>
            </div>
          }

          <app-recaptcha-aviso />
        </div>
      </div>
    </div>
  `,
})
export class RestablecerClaveComponent {
  private auth = inject(AuthService);

  constructor() {
    inject(RecaptchaService).precargar();
  }

  /** Del `?token=` del enlace. Sin él la pantalla no tiene nada que hacer. */
  readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  readonly notaHistorial = NOTA_HISTORIAL_PASSWORD;

  nueva = signal('');
  confirmacion = signal('');
  guardando = signal(false);
  listo = signal(false);
  errorMsg = signal('');

  reglas = computed(() => [
    ...reglasPassword(this.nueva()),
    {
      texto: 'Las dos contraseñas coinciden',
      cumple: this.nueva().length > 0 && this.nueva() === this.confirmacion(),
    },
  ]);

  guardar(): void {
    if (!passwordCumplePolitica(this.nueva())) {
      this.errorMsg.set('La contraseña nueva no cumple los requisitos indicados abajo');
      return;
    }
    if (this.nueva() !== this.confirmacion()) {
      this.errorMsg.set('Las dos contraseñas no coinciden. Vuelva a escribirlas.');
      return;
    }

    this.errorMsg.set('');
    this.guardando.set(true);

    this.auth
      .restablecerPassword({ token: this.token, password_nueva: this.nueva() })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.listo.set(true);
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorMsg.set(this.mensajeError(err));
        },
      });
  }

  private mensajeError(err: unknown): string {
    const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const primero = detail[0] as { msg?: string };
      if (primero?.msg) return primero.msg;
    }
    return 'No se pudo guardar la contraseña. Intente de nuevo.';
  }
}
