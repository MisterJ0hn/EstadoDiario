import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { RecaptchaService } from '@core/services/recaptcha.service';
import { RecaptchaAvisoComponent } from '@shared/components/recaptcha-aviso.component';
import { formatearRut, rutPlano, rutValido } from '@core/utils/rut';

/**
 * "Olvidé mi contraseña", paso 1: pedir el enlace.
 *
 * Se piden los mismos dos datos que identifican a la persona sin sesión: el
 * RUT del estudio —que dice en qué base de datos buscar, igual que en el
 * login— y su correo. No se pide el nombre de usuario: quien olvidó la clave
 * suele haber olvidado también cuál de sus variantes registró, y el correo ya
 * es único dentro del estudio.
 *
 * Enviado el formulario, la pantalla no vuelve al login sola: el mensaje de
 * confirmación tiene que quedar a la vista, porque el paso siguiente ocurre en
 * el correo y no acá.
 */
@Component({
  selector: 'app-recuperar-clave',
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-neutral-800">Recuperar contraseña</h1>
            <p class="text-neutral-500 mt-1">
              Le enviamos un enlace a su correo para que cree una contraseña nueva.
            </p>
          </div>

          @if (enviado()) {
            <!-- El mensaje viene del servidor y es el mismo exista o no la
                 cuenta: no se reemplaza por uno más específico. -->
            <div class="alert-success mb-4" role="status">{{ mensaje() }}</div>
            <a routerLink="/login" class="btn-primary w-full">Volver al ingreso</a>
          } @else {
            @if (errorMsg()) {
              <div class="alert-danger mb-4" role="alert">{{ errorMsg() }}</div>
            }

            <form (ngSubmit)="enviar()" class="space-y-5" novalidate>
              <div>
                <label class="form-label" for="rut">RUT cliente</label>
                <input
                  id="rut"
                  type="text"
                  class="form-input"
                  [ngModel]="rut()"
                  (ngModelChange)="alEscribirRut($event)"
                  name="rut"
                  placeholder="12.345.678-9"
                  autocomplete="organization"
                  [attr.aria-invalid]="rutMalFormado() ? 'true' : null"
                  aria-describedby="ayuda-rut"
                />
                <p id="ayuda-rut" class="text-xs mt-1"
                   [class]="rutMalFormado() ? 'text-danger-600' : 'text-neutral-500'">
                  {{ rutMalFormado()
                      ? 'Revise el RUT: el dígito verificador no corresponde.'
                      : 'El mismo RUT con el que ingresa al sistema.' }}
                </p>
              </div>

              <div>
                <label class="form-label" for="email">Su correo</label>
                <input
                  id="email"
                  type="email"
                  class="form-input"
                  [(ngModel)]="email"
                  name="email"
                  placeholder="nombre@estudio.cl"
                  autocomplete="email"
                  inputmode="email"
                />
                <p class="text-xs text-neutral-500 mt-1">
                  El correo registrado en su cuenta. Si no lo recuerda, pídalo al
                  administrador del sistema.
                </p>
              </div>

              <button type="submit" class="btn-primary w-full" [disabled]="enviando()">
                @if (enviando()) {
                  <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                }
                {{ enviando() ? 'Enviando...' : 'Enviarme el enlace' }}
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
export class RecuperarClaveComponent {
  private auth = inject(AuthService);

  constructor() {
    inject(RecaptchaService).precargar();
  }

  rut = signal('');
  email = '';
  enviando = signal(false);
  enviado = signal(false);
  mensaje = signal('');
  errorMsg = signal('');

  rutMalFormado = computed(() => {
    const valor = this.rut().replace(/[^0-9kK]/g, '');
    return valor.length >= 8 && !rutValido(valor);
  });

  alEscribirRut(valor: string): void {
    this.rut.set(formatearRut(valor));
  }

  enviar(): void {
    if (!rutValido(this.rut())) {
      this.errorMsg.set('El RUT no es válido. Revise el dígito verificador.');
      return;
    }
    if (!this.email.includes('@')) {
      this.errorMsg.set('Escriba un correo válido.');
      return;
    }

    this.errorMsg.set('');
    this.enviando.set(true);

    this.auth
      .recuperarPassword({ rut: rutPlano(this.rut()), email: this.email.trim() })
      .subscribe({
        next: (res) => {
          this.enviando.set(false);
          this.mensaje.set(res.mensaje);
          this.enviado.set(true);
        },
        error: (err) => {
          this.enviando.set(false);
          this.errorMsg.set(this.mensajeError(err));
        },
      });
  }

  private mensajeError(err: unknown): string {
    const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
    if (typeof detail === 'string') return detail;
    return 'No pudimos procesar la solicitud. Intente de nuevo en unos minutos.';
  }
}
