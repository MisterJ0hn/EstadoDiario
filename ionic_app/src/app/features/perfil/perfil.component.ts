import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
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
            <div>
              <span class="text-xs text-neutral-500 uppercase">Rol</span>
            </div>
          </div>

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

  cargandoEstado = signal(true);
  conectado = signal(false);
  googleEmail = signal<string | null>(null);
  ocupadoGoogle = signal(false);
  mensajeGoogle = signal('');
  mensajeGoogleEsError = signal(false);

  ngOnInit(): void {
    this.telefono = this.auth.user()?.telefono ?? '';
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
}
