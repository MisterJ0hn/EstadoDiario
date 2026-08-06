import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfiguracionGoogleService } from '../../services/configuracion-google.service';
import { NotificationService } from '@core/services/notification.service';
import { ConfiguracionGoogleUpdate } from '@core/models/google-calendar.model';

@Component({
  selector: 'app-google-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Google Calendar</h1>
          <p class="text-neutral-500 mt-1">
            Credenciales del proyecto de Google Cloud. Cada abogado conecta su propia
            cuenta desde <strong>Mi Perfil</strong>; acá solo se configura el proyecto.
          </p>
        </div>
      </div>

      @if (cargando()) {
        <div class="card"><div class="card-body text-neutral-500">Cargando configuración...</div></div>
      } @else {
        <div class="card">
          <div class="card-body space-y-5">
            <label class="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" class="mt-1" [(ngModel)]="modelo.activo" />
              <span>
                <span class="font-medium text-neutral-800">Activar Google Calendar</span>
                <span class="block text-sm text-neutral-500">
                  Mientras esté desactivado, nadie puede conectar su cuenta ni se sincronizan recordatorios.
                </span>
              </span>
            </label>

            <hr class="border-neutral-200" />

            <div class="alert-info">
              <div class="space-y-1">
                <p><strong>Redirect URI a registrar en Google Cloud Console:</strong></p>
                <code class="text-xs break-all">{{ redirectUri }}</code>
                <p class="text-xs mt-2">
                  1. Crear un proyecto en Google Cloud Console y habilitar la <em>Google Calendar API</em>.<br />
                  2. Configurar la pantalla de consentimiento OAuth (externa) con el scope de Calendar.<br />
                  3. Crear credenciales <em>OAuth Client ID</em> tipo "Aplicación web" y registrar el redirect URI de arriba.<br />
                  4. Pegar el Client ID y Client Secret abajo.
                </p>
              </div>
            </div>

            <div>
              <label class="form-label">Client ID <span class="text-danger-600">*</span></label>
              <input type="text" class="form-input" [(ngModel)]="modelo.client_id"
                     placeholder="xxxxxxxx.apps.googleusercontent.com" autocomplete="off" />
            </div>

            <div>
              <label class="form-label">
                Client Secret
                @if (tieneClientSecret()) {
                  <span class="text-xs font-normal text-accent-600">(hay uno guardado)</span>
                }
              </label>
              <input type="password" class="form-input" [(ngModel)]="modelo.client_secret"
                     [placeholder]="tieneClientSecret() ? 'Dejar vacío para no cambiarlo' : 'Client Secret'"
                     autocomplete="new-password" />
            </div>

            @if (mensaje()) {
              <div [class]="mensajeEsError() ? 'alert-danger' : 'alert-info'">{{ mensaje() }}</div>
            }

            <div class="flex flex-wrap justify-end gap-3 pt-2">
              <button (click)="guardar()" class="btn-primary" [disabled]="guardando()">
                {{ guardando() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class GoogleConfigComponent implements OnInit {
  private service = inject(ConfiguracionGoogleService);
  private notification = inject(NotificationService);

  // Se arma con el origen actual del navegador: la app siempre se sirve
  // desde el mismo dominio que expone /api (ver frontend/nginx.conf).
  readonly redirectUri = `${window.location.origin}/api/v1/google-calendar/callback`;

  modelo: ConfiguracionGoogleUpdate = {
    activo: false,
    client_id: '',
    client_secret: '',
  };

  cargando = signal(true);
  guardando = signal(false);
  tieneClientSecret = signal(false);
  mensaje = signal('');
  mensajeEsError = signal(false);

  ngOnInit(): void {
    this.service.get().subscribe({
      next: (config) => {
        this.modelo = {
          activo: config.activo,
          client_id: config.client_id ?? '',
          client_secret: '',
        };
        this.tieneClientSecret.set(config.tiene_client_secret);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.notification.error('No se pudo cargar la configuración');
      },
    });
  }

  private validar(): string | null {
    if (this.modelo.activo && !this.modelo.client_id) return 'Indique el Client ID';
    if (this.modelo.activo && !this.modelo.client_secret && !this.tieneClientSecret()) {
      return 'Indique el Client Secret';
    }
    return null;
  }

  guardar(): void {
    const error = this.validar();
    if (error) {
      this.mensaje.set(error);
      this.mensajeEsError.set(true);
      return;
    }

    this.mensaje.set('');
    this.guardando.set(true);

    this.service
      .save({
        ...this.modelo,
        client_secret: this.modelo.client_secret || null,
      })
      .subscribe({
        next: (config) => {
          this.guardando.set(false);
          this.tieneClientSecret.set(config.tiene_client_secret);
          this.modelo.client_secret = '';
          this.notification.success('Configuración guardada');
        },
        error: (err) => {
          this.guardando.set(false);
          this.mensaje.set(err.error?.detail || 'No se pudo guardar la configuración');
          this.mensajeEsError.set(true);
        },
      });
  }
}
