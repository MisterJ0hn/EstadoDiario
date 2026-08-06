import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfiguracionWhatsappService } from '../../services/configuracion-whatsapp.service';
import { NotificationService } from '@core/services/notification.service';
import { ConfiguracionWhatsappUpdate } from '@core/models/configuracion-whatsapp.model';

@Component({
  selector: 'app-whatsapp-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">WhatsApp (Twilio)</h1>
        <p class="text-neutral-500 mt-1">
          Envío de recordatorios por WhatsApp usando una plantilla ya aprobada por Meta/Twilio.
          Convive con el webhook de Twilio existente para el botón "Resuelto".
        </p>
      </div>

      @if (cargando()) {
        <div class="card"><div class="card-body text-neutral-500">Cargando configuración...</div></div>
      } @else {
        <div class="card">
          <div class="card-body space-y-5">
            <label class="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" class="mt-1" [(ngModel)]="modelo.activo" />
              <span>
                <span class="font-medium text-neutral-800">Activar envío de WhatsApp</span>
                <span class="block text-sm text-neutral-500">
                  Mientras esté desactivado, el job programado no envía nada.
                </span>
              </span>
            </label>

            <hr class="border-neutral-200" />

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">Account SID <span class="text-danger-600">*</span></label>
                <input type="text" class="form-input" [(ngModel)]="modelo.twilio_account_sid"
                       placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autocomplete="off" />
              </div>
              <div>
                <label class="form-label">
                  Auth Token
                  @if (tieneAuthToken()) {
                    <span class="text-xs font-normal text-accent-600">(hay uno guardado)</span>
                  }
                </label>
                <input type="password" class="form-input" [(ngModel)]="modelo.twilio_auth_token"
                       [placeholder]="tieneAuthToken() ? 'Dejar vacío para no cambiarlo' : 'Auth Token'"
                       autocomplete="new-password" />
              </div>
            </div>

            <div>
              <label class="form-label">Número de WhatsApp remitente</label>
              <input type="text" class="form-input" [(ngModel)]="modelo.twilio_numero_whatsapp"
                     placeholder="whatsapp:+14155238886" autocomplete="off" />
            </div>

            <div>
              <label class="form-label">Content SID de la plantilla aprobada <span class="text-danger-600">*</span></label>
              <input type="text" class="form-input" [(ngModel)]="modelo.plantilla_content_sid"
                     placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autocomplete="off" />
              <p class="text-xs text-neutral-400 mt-1">
                La plantilla debe estar aprobada en Twilio/Meta con 4 variables: causa, tribunal, fecha, id de movimiento.
              </p>
            </div>

            <hr class="border-neutral-200" />

            <label class="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" class="mt-1" [(ngModel)]="modelo.validar_firma_webhook" />
              <span>
                <span class="font-medium text-neutral-800">Validar la firma de los callbacks de Twilio</span>
                <span class="block text-sm text-neutral-500">
                  El webhook que recibe las respuestas de los botones es público. Con esto activo solo
                  se aceptan los requests firmados por Twilio con el Auth Token. Desactívelo únicamente
                  si los callbacks empiezan a rechazarse por firma inválida (revise antes que la URL
                  configurada en Twilio sea la pública del sitio).
                </span>
              </span>
            </label>

            @if (mensaje()) {
              <div [class]="mensajeEsError() ? 'alert-danger' : 'alert-info'">{{ mensaje() }}</div>
            }

            <div class="flex flex-wrap justify-end gap-3 pt-2">
              <button (click)="probar()" class="btn-secondary" [disabled]="ocupado()">
                {{ probando() ? 'Probando...' : 'Probar conexión' }}
              </button>
              <button (click)="guardar()" class="btn-primary" [disabled]="ocupado()">
                {{ guardando() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class WhatsappConfigComponent implements OnInit {
  private service = inject(ConfiguracionWhatsappService);
  private notification = inject(NotificationService);

  modelo: ConfiguracionWhatsappUpdate = {
    activo: false,
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_numero_whatsapp: '',
    plantilla_content_sid: '',
    validar_firma_webhook: true,
  };

  cargando = signal(true);
  guardando = signal(false);
  probando = signal(false);
  tieneAuthToken = signal(false);
  mensaje = signal('');
  mensajeEsError = signal(false);

  ocupado = signal(false);

  ngOnInit(): void {
    this.service.get().subscribe({
      next: (config) => {
        this.modelo = {
          activo: config.activo,
          twilio_account_sid: config.twilio_account_sid ?? '',
          twilio_auth_token: '',
          twilio_numero_whatsapp: config.twilio_numero_whatsapp ?? '',
          plantilla_content_sid: config.plantilla_content_sid ?? '',
          validar_firma_webhook: config.validar_firma_webhook,
        };
        this.tieneAuthToken.set(config.tiene_auth_token);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.notification.error('No se pudo cargar la configuración');
      },
    });
  }

  private payload(): ConfiguracionWhatsappUpdate {
    return {
      ...this.modelo,
      twilio_auth_token: this.modelo.twilio_auth_token || null,
    };
  }

  private validar(): string | null {
    if (!this.modelo.twilio_account_sid) return 'Indique el Account SID';
    if (!this.modelo.twilio_auth_token && !this.tieneAuthToken()) return 'Indique el Auth Token';
    if (this.modelo.activo && !this.modelo.plantilla_content_sid) {
      return 'Debe indicar el Content SID de la plantilla para activar el envío';
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
    this.ocupado.set(true);

    this.service.save(this.payload()).subscribe({
      next: (config) => {
        this.guardando.set(false);
        this.ocupado.set(false);
        this.tieneAuthToken.set(config.tiene_auth_token);
        this.modelo.twilio_auth_token = '';
        this.notification.success('Configuración guardada');
      },
      error: (err) => {
        this.guardando.set(false);
        this.ocupado.set(false);
        this.mensaje.set(err.error?.detail || 'No se pudo guardar la configuración');
        this.mensajeEsError.set(true);
      },
    });
  }

  probar(): void {
    this.mensaje.set('');
    this.probando.set(true);
    this.ocupado.set(true);

    this.service.probarConexion().subscribe({
      next: (res) => {
        this.probando.set(false);
        this.ocupado.set(false);
        this.mensaje.set(res.mensaje);
        this.mensajeEsError.set(!res.exito);
      },
      error: (err) => {
        this.probando.set(false);
        this.ocupado.set(false);
        this.mensaje.set(err.error?.detail || 'No se pudo probar la conexión');
        this.mensajeEsError.set(true);
      },
    });
  }
}
