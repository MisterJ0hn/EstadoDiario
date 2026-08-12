import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfiguracionTransbankService } from '../../services/configuracion-transbank.service';
import { NotificationService } from '@core/services/notification.service';
import { ConfiguracionTransbankUpdate } from '@core/models/configuracion-transbank.model';

/**
 * Credenciales de Webpay Plus.
 *
 * Dos avisos que la pantalla tiene que dar sí o sí, porque son las dos formas
 * de equivocarse que cuestan plata: que en producción se cobra de verdad, y
 * que el interruptor de "activo" es lo que le muestra el botón de pagar a
 * todos los estudios.
 */
@Component({
  selector: 'app-transbank-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Transbank (Webpay Plus)</h1>
        <p class="text-neutral-500 mt-1">
          Pago en línea de las facturas. Con esto activo, cada estudio ve un botón
          "Pagar" en sus facturas emitidas y la factura queda pagada sola al
          confirmarse la transacción.
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
                <span class="font-medium text-neutral-800">Activar el pago en línea</span>
                <span class="block text-sm text-neutral-500">
                  Apagado, el botón no aparece en ninguna app y el endpoint de pago
                  responde que no está disponible.
                </span>
              </span>
            </label>

            <hr class="border-neutral-200" />

            <div>
              <label class="form-label">Ambiente</label>
              <select class="form-input" [(ngModel)]="modelo.ambiente">
                <option value="integracion">Integración (pruebas, no cobra)</option>
                <option value="produccion">Producción (cobra de verdad)</option>
              </select>
              @if (modelo.ambiente === 'integracion') {
                <p class="text-xs text-neutral-400 mt-1">
                  Sin credenciales propias se usa el comercio de prueba de Transbank.
                  Las tarjetas de prueba están en la documentación de Transbank.
                </p>
              } @else {
                <div class="alert-danger mt-2">
                  En producción cada pago es un cargo real a la tarjeta del estudio.
                  Las credenciales son obligatorias: no hay comercio de prueba de respaldo.
                </div>
              }
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">Código de comercio</label>
                <input type="text" class="form-input" [(ngModel)]="modelo.commerce_code"
                       placeholder="597055555532" autocomplete="off" />
              </div>
              <div>
                <label class="form-label">
                  API key
                  @if (tieneApiKey()) {
                    <span class="text-xs font-normal text-accent-600">(hay una guardada)</span>
                  }
                </label>
                <input type="password" class="form-input" [(ngModel)]="modelo.api_key"
                       [placeholder]="tieneApiKey() ? 'Dejar vacío para no cambiarla' : 'API key del comercio'"
                       autocomplete="new-password" />
              </div>
            </div>

            <p class="text-xs text-neutral-400">
              La API key se guarda cifrada y no se vuelve a mostrar. Si cambia la clave
              de cifrado del sistema hay que escribirla de nuevo acá.
            </p>

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
export class TransbankConfigComponent implements OnInit {
  private service = inject(ConfiguracionTransbankService);
  private notification = inject(NotificationService);

  modelo: ConfiguracionTransbankUpdate = {
    activo: false,
    ambiente: 'integracion',
    commerce_code: '',
    api_key: '',
  };

  cargando = signal(true);
  guardando = signal(false);
  probando = signal(false);
  tieneApiKey = signal(false);
  mensaje = signal('');
  mensajeEsError = signal(false);
  ocupado = signal(false);

  ngOnInit(): void {
    this.service.get().subscribe({
      next: (config) => {
        this.modelo = {
          activo: config.activo,
          ambiente: config.ambiente,
          commerce_code: config.commerce_code ?? '',
          api_key: '',
        };
        this.tieneApiKey.set(config.tiene_api_key);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.notification.error('No se pudo cargar la configuración');
      },
    });
  }

  private payload(): ConfiguracionTransbankUpdate {
    return { ...this.modelo, api_key: this.modelo.api_key || null };
  }

  /**
   * Lo único que se valida acá es lo que no tiene arreglo después: activar
   * producción sin credenciales deja a todos los estudios con un botón que
   * falla. En integración se puede activar sin nada y funciona con el comercio
   * de prueba.
   */
  private validar(): string | null {
    if (this.modelo.ambiente !== 'produccion') return null;
    if (!this.modelo.commerce_code) return 'En producción hay que indicar el código de comercio';
    if (!this.modelo.api_key && !this.tieneApiKey()) return 'En producción hay que indicar la API key';
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
        this.tieneApiKey.set(config.tiene_api_key);
        this.modelo.api_key = '';
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
