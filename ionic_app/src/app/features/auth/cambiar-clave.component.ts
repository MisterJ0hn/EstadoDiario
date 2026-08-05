import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

/**
 * Cambio de contraseña obligatorio.
 *
 * Es una pantalla sin salida a propósito: sin menú lateral y sin más
 * navegación que cerrar la sesión. El usuario llegó acá porque su clave es
 * provisoria (el administrador que el instalador siembra, o una cuenta
 * reseteada por soporte) y el backend no le va a responder ninguna otra
 * pantalla hasta que la cambie. Mostrarle el menú sería ofrecerle puertas que
 * dan a un error.
 *
 * Mantiene la estética del login —tarjeta centrada sobre el degradado azul—
 * para que se lea como la continuación del ingreso y no como un error.
 */
@Component({
  selector: 'app-cambiar-clave',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 px-4 py-8">
      <div class="card w-full max-w-md">
        <div class="card-body p-8">
          <div class="text-center mb-6">
            <div class="w-16 h-16 bg-warning-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-warning-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-neutral-800">Defina su contraseña</h1>
            <p class="text-neutral-500 mt-1">
              Su clave actual es provisoria. Para seguir usando el sistema tiene que
              reemplazarla por una suya.
            </p>
          </div>

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
                 vista: nadie descubre el requisito recién al mandar el
                 formulario. El estado no depende solo del color: cada regla
                 lleva su marca y su texto. -->
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
            <p class="text-xs text-neutral-500 -mt-2">
              Además tiene que ser distinta de la clave provisoria; el sistema lo verifica al
              guardar.
            </p>

            <button type="submit" class="btn-primary w-full" [disabled]="guardando()">
              @if (guardando()) {
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              }
              {{ guardando() ? 'Guardando...' : 'Guardar y entrar' }}
            </button>
          </form>

          <!-- Única salida posible: irse. No se ofrece "más tarde" porque no
               existe: el sistema no responde nada más hasta el cambio. -->
          <div class="border-t border-neutral-200 mt-6 pt-4 text-center">
            <button type="button" (click)="auth.logout()" [disabled]="guardando()"
                    class="text-sm text-neutral-500 hover:text-primary-700 hover:underline
                           focus:outline-none focus:ring-2 focus:ring-primary-200 rounded px-2 py-1">
              Cerrar sesión e ingresar con otra cuenta
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CambiarClaveComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  nueva = signal('');
  confirmacion = signal('');
  guardando = signal(false);
  errorMsg = signal('');

  /** Solo las reglas que el navegador puede comprobar de verdad. La de "no
   *  repetir la provisoria" se verifica en el servidor y se dice como nota. */
  reglas = computed(() => [
    { texto: 'Al menos 8 caracteres', cumple: this.nueva().length >= 8 },
    {
      texto: 'Las dos contraseñas coinciden',
      cumple: this.nueva().length > 0 && this.nueva() === this.confirmacion(),
    },
  ]);

  guardar(): void {
    if (this.nueva().length < 8) {
      this.errorMsg.set('La contraseña nueva debe tener al menos 8 caracteres');
      return;
    }
    if (this.nueva() !== this.confirmacion()) {
      this.errorMsg.set('Las dos contraseñas no coinciden. Vuelva a escribirlas.');
      return;
    }

    this.errorMsg.set('');
    this.guardando.set(true);

    this.auth.cambiarPasswordObligatorio({ password_nueva: this.nueva() }).subscribe({
      next: (user) => {
        this.guardando.set(false);
        this.router.navigate([user.rol === 'superadmin' ? '/admin' : '/dashboard']);
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
