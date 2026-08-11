import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import {
  NOTA_HISTORIAL_PASSWORD,
  passwordCumplePolitica,
  reglasPassword,
} from '@core/utils/password';
import { GoogleCalendarService } from '../configuracion/services/google-calendar.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Mi Perfil</h1>
        <p class="text-neutral-500 mt-1">Tus datos y tu conexión personal con Google Calendar.</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="text-lg font-semibold">Datos</h3>
        </div>
        <div class="card-body space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-xs text-neutral-500 uppercase">Usuario</span>
              <p class="font-medium">{{ auth.user()?.username }}</p>
            </div>
            <div>
              <span class="text-xs text-neutral-500 uppercase">Correo</span>
              <p class="font-medium">{{ auth.user()?.email }}</p>
            </div>
            <div>
              <span class="text-xs text-neutral-500 uppercase">Nombre</span>
              <p class="font-medium">{{ auth.user()?.nombre }} {{ auth.user()?.apellido }}</p>
            </div>
            <!-- Acá iba "Rol", que quedó sin valor cuando se eliminaron los
                 roles dentro de un estudio: mostraba la etiqueta sola. -->
          </div>

          @if (auth.user()?.cliente_inbox; as inbox) {
            <hr class="border-neutral-200" />

            <!-- La casilla de ingesta del estudio. Va en el perfil porque es
                 dato de solo lectura que se necesita a mano —para reenviarle
                 los Excel del PJUD— y no tenía dónde consultarse: la configura
                 la plataforma, no el estudio. -->
            <div>
              <span class="text-xs text-neutral-500 uppercase">Casilla PJUD</span>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <code class="font-medium text-primary-700 break-all">{{ inbox }}</code>
                <button type="button" (click)="copiarInbox(inbox)" class="btn-secondary btn-sm shrink-0">
                  {{ inboxCopiado() ? 'Copiado' : 'Copiar' }}
                </button>
              </div>
              <p class="text-xs text-neutral-400 mt-1">
                Reenvíe a esta dirección los correos del Poder Judicial y sus archivos se
                importan solos. Lo que llega queda en Bitácora, pestaña Correo.
              </p>
            </div>
          }

          <hr class="border-neutral-200" />

          <div>
            <label class="form-label">Teléfono</label>
            <input type="text" class="form-input" [(ngModel)]="telefono" placeholder="+56912345678" />
            <p class="text-xs text-neutral-400 mt-1">
              Número por defecto para recibir recordatorios de WhatsApp; puedes cambiarlo al crear cada uno.
            </p>
          </div>

          <div class="flex justify-end">
            <button (click)="guardarTelefono()" class="btn-primary" [disabled]="guardandoTelefono()">
              {{ guardandoTelefono() ? 'Guardando...' : 'Guardar teléfono' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Cambio voluntario de contraseña. La pantalla /cambiar-clave cubre el
           otro caso —clave provisoria, sin salida hasta reemplazarla—; acá la
           clave ya es definitiva, así que se exige la actual. -->
      <div class="card">
        <div class="card-header">
          <h3 class="text-lg font-semibold">Contraseña</h3>
        </div>
        <div class="card-body space-y-4">
          <div>
            <label class="form-label" for="clave-actual">Contraseña actual</label>
            <input
              id="clave-actual"
              type="password"
              class="form-input"
              [ngModel]="claveActual()"
              (ngModelChange)="claveActual.set($event)"
              autocomplete="current-password"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="form-label" for="clave-nueva">Contraseña nueva</label>
              <input
                id="clave-nueva"
                type="password"
                class="form-input"
                [ngModel]="claveNueva()"
                (ngModelChange)="claveNueva.set($event)"
                autocomplete="new-password"
                aria-describedby="reglas-clave-perfil"
              />
            </div>
            <div>
              <label class="form-label" for="clave-confirmacion">Repita la nueva</label>
              <input
                id="clave-confirmacion"
                type="password"
                class="form-input"
                [ngModel]="claveConfirmacion()"
                (ngModelChange)="claveConfirmacion.set($event)"
                autocomplete="new-password"
              />
            </div>
          </div>

          <!-- Las reglas se ven antes de escribir y se van cumpliendo a la
               vista: nadie descubre el requisito recién al mandar. El estado no
               depende solo del color, cada regla lleva su marca y su texto. -->
          <ul id="reglas-clave-perfil" class="space-y-1.5 text-sm">
            @for (r of reglasClave(); track r.texto) {
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

          @if (errorClave()) {
            <div class="alert-danger" role="alert">{{ errorClave() }}</div>
          }

          <div class="flex justify-end">
            <button (click)="cambiarClave()" class="btn-primary" [disabled]="guardandoClave()">
              @if (guardandoClave()) {
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              }
              {{ guardandoClave() ? 'Guardando...' : 'Cambiar contraseña' }}
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="text-lg font-semibold">Google Calendar</h3>
        </div>
        <div class="card-body space-y-4">
          @if (cargandoEstado()) {
            <p class="text-neutral-500">Consultando estado de conexión...</p>
          } @else if (conectado()) {
            <div class="alert-success">
              Conectado como <strong>{{ googleEmail() }}</strong>. Los recordatorios que crees se
              agregarán a este calendario.
            </div>
            <div class="flex justify-end">
              <button (click)="desconectar()" class="btn-danger" [disabled]="ocupadoGoogle()">
                {{ ocupadoGoogle() ? 'Desconectando...' : 'Desconectar' }}
              </button>
            </div>
          } @else {
            <p class="text-neutral-600">
              No has conectado tu cuenta de Google. Sin conectarla, los recordatorios se
              siguen guardando en el sistema, pero no aparecen en tu Google Calendar.
            </p>
            <div class="flex justify-end">
              <button (click)="conectar()" class="btn-primary" [disabled]="ocupadoGoogle()">
                {{ ocupadoGoogle() ? 'Redirigiendo...' : 'Conectar Google Calendar' }}
              </button>
            </div>
          }

          @if (mensajeGoogle()) {
            <div [class]="mensajeGoogleEsError() ? 'alert-danger' : 'alert-info'">{{ mensajeGoogle() }}</div>
          }
        </div>
      </div>
    </div>
  `,
})
export class PerfilComponent implements OnInit {
  auth = inject(AuthService);
  private googleService = inject(GoogleCalendarService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  telefono = '';
  guardandoTelefono = signal(false);
  /** Marca "Copiado" en el botón un momento, para que se vea que pasó algo. */
  inboxCopiado = signal(false);

  readonly notaHistorial = NOTA_HISTORIAL_PASSWORD;
  claveActual = signal('');
  claveNueva = signal('');
  claveConfirmacion = signal('');
  guardandoClave = signal(false);
  errorClave = signal('');

  /** Las reglas que el navegador puede comprobar. Las otras dos —que la actual
   *  sea correcta y que la nueva no repita las últimas— solo las sabe el
   *  servidor, y llegan como mensaje de error. */
  reglasClave = computed(() => [
    ...reglasPassword(this.claveNueva()),
    {
      texto: 'Las dos contraseñas coinciden',
      cumple: this.claveNueva().length > 0 && this.claveNueva() === this.claveConfirmacion(),
    },
  ]);

  cargandoEstado = signal(true);
  conectado = signal(false);
  googleEmail = signal<string | null>(null);
  ocupadoGoogle = signal(false);
  mensajeGoogle = signal('');
  mensajeGoogleEsError = signal(false);

  ngOnInit(): void {
    this.telefono = this.auth.user()?.telefono ?? '';
    // Se vuelve a pedir el perfil al servidor en vez de confiar en el que hay
    // guardado: `_user` sale de localStorage y se escribió al iniciar sesión,
    // así que un campo agregado después —como la casilla de ingesta— no
    // aparecería hasta que la persona volviera a entrar. Esta es la pantalla
    // que lo muestra todo, y es donde tiene que estar al día.
    this.auth.loadProfile();
    this.cargarEstadoGoogle();

    const resultado = this.route.snapshot.queryParamMap.get('google');
    if (resultado === 'ok') {
      this.mensajeGoogle.set('Cuenta de Google conectada correctamente.');
      this.mensajeGoogleEsError.set(false);
    } else if (resultado === 'error') {
      this.mensajeGoogle.set('No se pudo completar la conexión con Google. Intenta nuevamente.');
      this.mensajeGoogleEsError.set(true);
    }
    if (resultado) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  guardarTelefono(): void {
    this.guardandoTelefono.set(true);
    this.auth.actualizarPerfil({ telefono: this.telefono.trim() || null }).subscribe({
      next: () => {
        this.guardandoTelefono.set(false);
        this.notification.success('Teléfono actualizado');
      },
      error: () => {
        this.guardandoTelefono.set(false);
        this.notification.error('No se pudo guardar el teléfono');
      },
    });
  }

  cambiarClave(): void {
    if (!this.claveActual()) {
      this.errorClave.set('Escriba su contraseña actual');
      return;
    }
    if (!passwordCumplePolitica(this.claveNueva())) {
      this.errorClave.set('La contraseña nueva no cumple los requisitos indicados abajo');
      return;
    }
    if (this.claveNueva() !== this.claveConfirmacion()) {
      this.errorClave.set('Las dos contraseñas no coinciden. Vuelva a escribirlas.');
      return;
    }

    this.errorClave.set('');
    this.guardandoClave.set(true);

    this.auth
      .cambiarPassword({
        password_actual: this.claveActual(),
        password_nueva: this.claveNueva(),
      })
      .subscribe({
        next: (res) => {
          this.guardandoClave.set(false);
          // Los tres campos se vacían: dejarlos escritos deja la contraseña
          // nueva a la vista de quien pase por el computador.
          this.claveActual.set('');
          this.claveNueva.set('');
          this.claveConfirmacion.set('');
          this.notification.success(res.mensaje || 'Contraseña actualizada');
        },
        error: (err) => {
          this.guardandoClave.set(false);
          this.errorClave.set(this.mensajeErrorClave(err));
        },
      });
  }

  /** El backend manda el motivo real —clave actual incorrecta, política no
   *  cumplida, contraseña repetida— y se muestra tal cual. */
  private mensajeErrorClave(err: unknown): string {
    const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const primero = detail[0] as { msg?: string };
      if (primero?.msg) return primero.msg;
    }
    return 'No se pudo cambiar la contraseña. Intente de nuevo.';
  }

  private cargarEstadoGoogle(): void {
    this.cargandoEstado.set(true);
    this.googleService.estado().subscribe({
      next: (res) => {
        this.conectado.set(res.conectado);
        this.googleEmail.set(res.google_email ?? null);
        this.cargandoEstado.set(false);
      },
      error: () => {
        this.cargandoEstado.set(false);
        this.notification.error('No se pudo consultar el estado de Google Calendar');
      },
    });
  }

  conectar(): void {
    this.ocupadoGoogle.set(true);
    this.googleService.conectar().subscribe({
      next: (res) => {
        window.location.href = res.url;
      },
      error: (err) => {
        this.ocupadoGoogle.set(false);
        this.mensajeGoogle.set(err.error?.detail || 'No se pudo iniciar la conexión con Google');
        this.mensajeGoogleEsError.set(true);
      },
    });
  }

  desconectar(): void {
    this.ocupadoGoogle.set(true);
    this.googleService.desconectar().subscribe({
      next: () => {
        this.ocupadoGoogle.set(false);
        this.conectado.set(false);
        this.googleEmail.set(null);
        this.notification.success('Cuenta de Google desconectada');
      },
      error: () => {
        this.ocupadoGoogle.set(false);
        this.notification.error('No se pudo desconectar la cuenta');
      },
    });
  }

  /**
   * Copia la casilla de ingesta al portapapeles.
   *
   * `navigator.clipboard` no existe fuera de un contexto seguro (http:// que no
   * sea localhost), de ahí el `?.` y el aviso: es preferible decir que no se
   * pudo a que el botón no haga nada.
   */
  copiarInbox(direccion: string): void {
    navigator.clipboard?.writeText(direccion).then(
      () => {
        this.inboxCopiado.set(true);
        setTimeout(() => this.inboxCopiado.set(false), 2000);
      },
      () => this.notification.error('El navegador no permitió copiar. Selecciónela a mano.')
    );
  }

}
