import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { formatearRut, rutPlano, rutValido } from '@core/utils/rut';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 px-4 py-8">
      <div class="card w-full max-w-md">
        <div class="card-body p-8">
          <div class="text-center mb-8">
            <div class="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-neutral-800">Movimientos PJUD</h1>
            <p class="text-neutral-500 mt-1">
              Ingrese las credenciales
            </p>
          </div>

          @if (errorMsg()) {
            <div class="alert-danger mb-4" role="alert">{{ errorMsg() }}</div>
          }

          <form (ngSubmit)="onLogin()" class="space-y-5" novalidate>
            <!-- El RUT del estudio es lo primero: define en qué base de datos
                 se busca el usuario. Sin él, el mismo nombre de usuario puede
                 existir en varios estudios. -->
            <div>
              <label class="form-label" for="rut">RUT Cliente</label>
              <input
                id="rut"
                type="text"
                class="form-input"
                [ngModel]="rut()"
                (ngModelChange)="alEscribirRut($event)"
                name="rut"
                inputmode="text"
                placeholder="12.345.678-9"
                autocomplete="organization"
                [attr.aria-invalid]="rutMalFormado() ? 'true' : null"
                aria-describedby="ayuda-rut"
              />
              <p id="ayuda-rut" class="text-xs mt-1"
                 [class]="rutMalFormado() ? 'text-danger-600' : 'text-neutral-500'">
                {{ rutMalFormado()
                    ? 'Revise el RUT: el dígito verificador no corresponde.'
                    : '' }}
              </p>
            </div>

            <div>
              <label class="form-label" for="username">Usuario</label>
              <input id="username" type="text" class="form-input" [(ngModel)]="username" name="username"
                     placeholder="Ingrese su usuario" autocomplete="username" />
            </div>

            <div>
              <label class="form-label" for="password">Contraseña</label>
              <input id="password" type="password" class="form-input" [(ngModel)]="password" name="password"
                     placeholder="Ingrese su contraseña" autocomplete="current-password" />
            </div>

            <button type="submit" class="btn-primary w-full" [disabled]="loading()">
              @if (loading()) {
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              }
              {{ loading() ? 'Ingresando...' : 'Ingresar' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  rut = signal('');
  username = '';
  password = '';
  loading = signal(false);
  errorMsg = signal('');

  /** Solo se marca en rojo cuando ya escribió un RUT completo y no cuadra. */
  rutMalFormado = computed(() => {
    const valor = this.rut().replace(/[^0-9kK]/g, '');
    return valor.length >= 8 && !rutValido(valor);
  });

  /** Se formatea mientras escribe: el abogado dicta el RUT con puntos. */
  alEscribirRut(valor: string): void {
    this.rut.set(formatearRut(valor));
  }

  onLogin(): void {
    if (!this.rut().trim()) {
      this.errorMsg.set('Indique el RUT de su estudio');
      return;
    }
    if (!rutValido(this.rut())) {
      this.errorMsg.set('El RUT no es válido. Revise el dígito verificador.');
      return;
    }
    if (!this.username || !this.password) {
      this.errorMsg.set('Ingrese usuario y contraseña');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');

    // La consola de la plataforma es otra aplicación (`admin_app/`): acá solo
    // entran los estudios.
    this.auth
      .login({
        rut: rutPlano(this.rut()),
        username: this.username,
        password: this.password,
      })
      .subscribe({
      next: (usuario) => {
        // Clave provisoria: no entra al sistema, entra a cambiarla.
        if (usuario.debe_cambiar_password) {
          this.router.navigate(['/cambiar-clave']);
          return;
        }
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(this.mensajeError(err));
      },
    });
  }

  /** Decir qué falló sin regalar cuál de los tres campos está mal. */
  private mensajeError(err: unknown): string {
    const e = err as { status?: number; error?: { detail?: unknown } };
    const detail = e?.error?.detail;
    if (typeof detail === 'string') return detail;
    if (e?.status === 403) {
      return 'Su cuenta está desactivada. Comuníquese con el administrador del sistema.';
    }
    if (e?.status === 404) {
      return 'No encontramos un estudio con ese RUT. Verifíquelo con el administrador del sistema.';
    }
    return 'No pudimos validar sus credenciales. Revise los datos e intente de nuevo.';
  }
}
