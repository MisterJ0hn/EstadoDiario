import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ConfiguracionSistema } from '@core/models/admin.model';
import { NotificationService } from '@core/services/notification.service';
import { AdminSistemaService } from '../services/admin-sistema.service';

/**
 * Ajustes transversales de la plataforma. Hoy es uno solo: cuánto tiempo se
 * conserva el log de actividades.
 *
 * Va acá y no en la ficha de cada cliente porque la política es del sistema:
 * el log registra todo lo que pasa en la plataforma, no lo de un estudio.
 */
@Component({
  selector: 'app-sistema-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Sistema</h1>
        <p class="text-neutral-500 mt-1">
          Cuánto tiempo se conserva el registro de actividades de la plataforma
        </p>
      </div>

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudo cargar la configuración del sistema.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">Reintentar</button>
        </div>
      } @else if (!config()) {
        <div class="card animate-pulse">
          <div class="card-body h-48 bg-neutral-100 rounded-b-xl"></div>
        </div>
      } @else {
        @if (config(); as c) {
        <div class="card">
          <div class="card-body space-y-5">
            <div class="alert-info">
              <div class="flex-1">
                El log guarda quién hizo qué y cuándo: ingresos, importaciones, cambios de
                configuración. Es lo que permite reconstruir qué pasó cuando un estudio reclama.
                Borrarlo antes de tiempo deja esos hechos sin respaldo.
              </div>
            </div>

            <div>
              <label class="form-label" for="retencion">Conservar el log durante</label>
              <div class="flex flex-wrap items-center gap-2">
                <input
                  id="retencion"
                  type="number"
                  class="form-input w-32"
                  min="7"
                  max="3650"
                  [(ngModel)]="dias"
                  aria-describedby="ayuda-retencion"
                />
                <span class="text-sm text-neutral-700">días</span>
              </div>
              <div class="flex flex-wrap gap-2 mt-2">
                @for (p of presets; track p) {
                  <button type="button" class="btn-secondary btn-sm" (click)="dias = p">
                    {{ p }} días
                  </button>
                }
              </div>
              <p id="ayuda-retencion" class="text-xs text-neutral-500 mt-2">
                Mínimo 7 días, máximo 10 años. Los registros más antiguos que este plazo se
                eliminan en la purga automática diaria.
              </p>
            </div>

            <hr class="border-neutral-200" />

            <dl class="rounded-lg border border-neutral-200 divide-y divide-neutral-200 text-sm">
              <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <dt class="text-neutral-500">Registros en el log</dt>
                <dd class="font-medium text-neutral-800 tabular-nums">{{ miles(c.registros_log) }}</dd>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <dt class="text-neutral-500">Se eliminarían con la política actual</dt>
                <dd class="font-medium tabular-nums"
                    [class]="c.registros_a_purgar > 0 ? 'text-danger-700' : 'text-neutral-800'">
                  {{ miles(c.registros_a_purgar) }}
                </dd>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <dt class="text-neutral-500">Última purga</dt>
                <dd class="text-neutral-800">
                  {{ c.ultima_purga ? (c.ultima_purga | date: 'dd-MM-yyyy HH:mm') : 'Nunca se ha purgado' }}
                </dd>
              </div>
            </dl>

            @if (mensaje()) {
              <div [class]="esError() ? 'alert-danger' : 'alert-success'">{{ mensaje() }}</div>
            }

            <div class="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button type="button" class="btn-secondary mr-auto" (click)="confirmarPurga.set(true)"
                      [disabled]="ocupado() || c.registros_a_purgar === 0">
                Purgar ahora
              </button>
              <button type="button" class="btn-primary" (click)="guardar()" [disabled]="ocupado()">
                {{ guardando() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>
        }
      }
    </div>

    <!-- Purgar borra registros: nunca directo. -->
    @if (confirmarPurga() && config(); as c) {
      <div class="modal-backdrop animar-fondo" (click)="confirmarPurga.set(false)">
        <div class="modal-content" (click)="$event.stopPropagation()" role="dialog" aria-modal="true"
             aria-labelledby="titulo-purga" (keydown.escape)="confirmarPurga.set(false)" tabindex="-1">
          <div class="modal-header">
            <h3 id="titulo-purga" class="text-lg font-semibold">Purgar el log de actividades</h3>
            <button type="button" (click)="confirmarPurga.set(false)"
                    class="text-neutral-400 hover:text-neutral-600" aria-label="Cerrar">&times;</button>
          </div>
          <div class="modal-body space-y-3">
            <p class="text-sm text-neutral-700">
              Se eliminarán <strong>{{ miles(c.registros_a_purgar) }}</strong> registros con más de
              {{ c.retencion_log_dias }} días de antigüedad.
            </p>
            <p class="text-sm text-neutral-700">
              La eliminación es definitiva: esos registros no se pueden recuperar y dejan de estar
              disponibles para revisar reclamos o auditorías.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="confirmarPurga.set(false)"
                    [disabled]="purgando()">Cancelar</button>
            <button type="button" class="btn-danger" (click)="purgar()" [disabled]="purgando()">
              {{ purgando() ? 'Purgando...' : 'Eliminar los registros' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class SistemaConfigComponent implements OnInit {
  private service = inject(AdminSistemaService);
  private notification = inject(NotificationService);

  readonly presets = [30, 90, 180, 365] as const;

  config = signal<ConfiguracionSistema | null>(null);
  error = signal<string | null>(null);
  guardando = signal(false);
  purgando = signal(false);
  confirmarPurga = signal(false);
  mensaje = signal('');
  esError = signal(false);

  dias = 90;

  ocupado = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.error.set(null);
    this.service.get().subscribe({
      next: (c) => {
        this.config.set(c);
        this.dias = c.retencion_log_dias;
      },
      error: (e) => this.error.set(this.mensajeError(e)),
    });
  }

  guardar(): void {
    if (this.dias < 7 || this.dias > 3650) {
      this.mensaje.set('El plazo debe estar entre 7 y 3.650 días');
      this.esError.set(true);
      return;
    }

    this.mensaje.set('');
    this.guardando.set(true);
    this.ocupado.set(true);

    this.service.save({ retencion_log_dias: this.dias }).subscribe({
      next: (c) => {
        this.guardando.set(false);
        this.ocupado.set(false);
        this.config.set(c);
        this.notification.success('Política de permanencia guardada');
      },
      error: (e) => {
        this.guardando.set(false);
        this.ocupado.set(false);
        this.mensaje.set(this.mensajeError(e));
        this.esError.set(true);
      },
    });
  }

  purgar(): void {
    this.purgando.set(true);
    this.service.purgarLog().subscribe({
      next: (res) => {
        this.purgando.set(false);
        this.confirmarPurga.set(false);
        this.notification.success(res.mensaje || 'Log purgado');
        this.cargar();
      },
      error: (e) => {
        this.purgando.set(false);
        this.confirmarPurga.set(false);
        this.notification.error(this.mensajeError(e));
      },
    });
  }

  miles(valor: number | null | undefined): string {
    return (valor ?? 0).toLocaleString('es-CL');
  }

  private mensajeError(err: unknown): string {
    const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
    if (typeof detail === 'string') return detail;
    return 'No se pudo completar la operación. Intente de nuevo.';
  }
}
