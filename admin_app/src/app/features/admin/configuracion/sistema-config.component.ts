import { Component, computed, OnInit, inject, signal } from '@angular/core';
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
            

            <!-- Tarifas de lista. Van antes que la mora porque es lo que se
                 consulta seguido; la mora se fija una vez y no se toca. -->
            <div class="pb-5 mb-5 border-b border-neutral-200">
              <h3 class="text-sm font-semibold text-neutral-800">Tarifas de la plataforma</h3>
              <p class="text-xs text-neutral-500 mt-0.5 mb-3">
                Precio por causa y por mes para los clientes que no tienen valores propios.
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="form-label" for="t-materia">Causas por materia</label>
                  <input id="t-materia" type="number" class="form-input" min="0" step="1"
                         [(ngModel)]="tarifaMateria" />
                </div>
                <div>
                  <label class="form-label" for="t-apelaciones">Corte de Apelaciones</label>
                  <input id="t-apelaciones" type="number" class="form-input" min="0" step="1"
                         [(ngModel)]="tarifaApelaciones" />
                </div>
                <div>
                  <label class="form-label" for="t-suprema">Corte Suprema</label>
                  <input id="t-suprema" type="number" class="form-input" min="0" step="1"
                         [(ngModel)]="tarifaSuprema" />
                </div>
              </div>

              <p class="text-xs text-neutral-500 mt-2">
                Rigen <strong>desde la próxima facturación</strong>: cada factura ya emitida
                guarda el valor que usó y no cambia. Un cliente con tarifa propia sigue con la
                suya — se fija en su ficha, botón <em>Tarifas</em>.
              </p>
            </div>

            <!-- Suspensión automática por mora. Va junto a la retención de
                 log porque las dos son políticas del sistema que se fijan una
                 vez; lo que las distingue es que ésta puede dejar a un estudio
                 sin acceso, y por eso avisa a cuántos afectaría. -->
            <div class="pb-5 mb-5 border-b border-neutral-200">
              <label class="form-label" for="mora">Suspender por mora a los</label>
              <div class="flex flex-wrap items-center gap-2">
                <input id="mora" type="number" class="form-input w-32" min="0" max="365"
                       [(ngModel)]="diasMora" aria-describedby="ayuda-mora" />
                <span class="text-sm text-neutral-700">días de la emisión</span>
              </div>
              <p id="ayuda-mora" class="text-xs text-neutral-500 mt-2">
                Se cuenta desde la emisión de la factura impaga más antigua: el documento
                no lleva fecha de vencimiento. Un cliente suspendido no vuelve solo aunque
                pague — reactivarlo es una decisión que se toma a mano.
              </p>

              @if (diasMora === 0) {
                <p class="text-xs text-neutral-500 mt-1">
                  <strong>0 = apagada.</strong> Ningún cliente se suspende solo.
                </p>
              } @else {
                <div class="alert-warning mt-3">
                  <div class="flex-1 text-sm">
                    @if (enMora() > 0) {
                      Con el plazo guardado hoy hay
                      <strong>{{ enMora() }} cliente(s)</strong> en condición de
                      suspenderse. La suspensión la aplica el proceso diario, no este botón.
                    } @else {
                      Ningún cliente está en mora con el plazo guardado.
                    }
                  </div>
                </div>
              }
            </div>
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
                <dt class="text-neutral-500">Última Limpieza</dt>
                <dd class="text-neutral-800">
                  {{ c.ultima_purga ? (c.ultima_purga | date: 'dd-MM-yyyy HH:mm') : 'Nunca se ha limpiado' }}
                </dd>
              </div>
            </dl>

            @if (mensaje()) {
              <div [class]="esError() ? 'alert-danger' : 'alert-success'">{{ mensaje() }}</div>
            }

            <div class="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button type="button" class="btn-secondary mr-auto" (click)="confirmarPurga.set(true)"
                      [disabled]="ocupado() || c.registros_a_purgar === 0">
                Limpiar ahora
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
            <h3 id="titulo-purga" class="text-lg font-semibold">Limpiar el log de actividades</h3>
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
              {{ purgando() ? 'Limpiando...' : 'Eliminar los registros' }}
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
  /** Días de mora para la suspensión automática. 0 = apagada. */
  diasMora = 0;
  /** Tarifas de lista, en pesos por causa y por mes. */
  tarifaMateria = 1;
  tarifaApelaciones = 2;
  tarifaSuprema = 3;
  /** Cuántos caerían con el plazo GUARDADO, no con el que se está escribiendo. */
  enMora = computed(() => this.config()?.clientes_en_mora ?? 0);

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
        this.diasMora = c.dias_mora_suspension ?? 0;
        this.tarifaMateria = Number(c.tarifa_materia ?? 1);
        this.tarifaApelaciones = Number(c.tarifa_apelaciones ?? 2);
        this.tarifaSuprema = Number(c.tarifa_suprema ?? 3);
      },
      error: (e) => this.error.set(this.mensajeError(e)),
    });
  }

  guardar(): void {
    const tarifas = [this.tarifaMateria, this.tarifaApelaciones, this.tarifaSuprema];
    if (tarifas.some((t) => t === null || t === undefined || t < 0)) {
      this.mensaje.set('Las tarifas no pueden ser negativas');
      this.esError.set(true);
      return;
    }
    if (this.diasMora < 0 || this.diasMora > 365) {
      this.mensaje.set('Los días de mora deben estar entre 0 y 365 (0 = apagada)');
      this.esError.set(true);
      return;
    }
    if (this.dias < 7 || this.dias > 3650) {
      this.mensaje.set('El plazo debe estar entre 7 y 3.650 días');
      this.esError.set(true);
      return;
    }

    this.mensaje.set('');
    this.guardando.set(true);
    this.ocupado.set(true);

    this.service
      .save({
        retencion_log_dias: this.dias,
        dias_mora_suspension: this.diasMora,
        tarifa_materia: this.tarifaMateria,
        tarifa_apelaciones: this.tarifaApelaciones,
        tarifa_suprema: this.tarifaSuprema,
      })
      .subscribe({
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
