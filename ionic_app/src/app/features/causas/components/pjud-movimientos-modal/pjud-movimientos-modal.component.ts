import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Causa, PjudMovimientosResponse } from '@core/models/causa.model';
import { NotificationService } from '@core/services/notification.service';
import { CausaService } from '../../services/causa.service';

/**
 * Movimientos de una causa Civil consultados EN VIVO al PJUD
 * (api-pjud.codifica.cl), no al Excel de Movimientos que sube el estudio.
 *
 * Solo aplica a causas Civiles: es lo único que esa API expone hoy. El padre
 * controla la apertura pasando la causa; null = cerrado. Se consulta
 * `getResumen`-style bajo demanda, no queda cacheado entre aperturas: el
 * estudio quiere ver lo último apenas abre la ficha.
 */
@Component({
  selector: 'app-pjud-movimientos-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (causa !== null) {
      <div class="modal-backdrop" (click)="cerrar()">
        <div class="modal-content max-w-3xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3 class="text-lg font-semibold">Movimientos PJUD</h3>
              <p class="text-sm text-neutral-500">
                {{ causa.rol }} — {{ causa.tribunal }}
              </p>
            </div>
            <button (click)="cerrar()" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>

          <div class="modal-body space-y-5">
            @if (cargando()) {
              <div class="flex items-center justify-center py-16">
                <svg class="animate-spin h-8 w-8 text-primary-600" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            } @else if (error()) {
              <div class="alert-danger">{{ error() }}</div>
            } @else if (datos()) {
              @if (datos(); as d) {
              <!-- Estado actual, tal como lo tiene el PJUD -->
              <div class="rounded-lg border border-neutral-200 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p class="text-neutral-400 text-xs uppercase tracking-wide">Estado</p>
                  <p class="font-medium text-neutral-800">{{ d.causa.estado || '-' }}</p>
                </div>
                <div>
                  <p class="text-neutral-400 text-xs uppercase tracking-wide">Etapa</p>
                  <p class="font-medium text-neutral-800">{{ d.causa.etapa || '-' }}</p>
                </div>
                <div>
                  <p class="text-neutral-400 text-xs uppercase tracking-wide">Est. proceso</p>
                  <p class="font-medium text-neutral-800">{{ d.causa.estado_proceso || '-' }}</p>
                </div>
                <div class="col-span-2 sm:col-span-3">
                  <p class="text-neutral-400 text-xs uppercase tracking-wide">Carátula</p>
                  <p class="font-medium text-neutral-800">{{ d.causa.caratula || '-' }}</p>
                </div>
              </div>

              @if (d.escritos_resolver.length > 0) {
                <div class="alert-warning">
                  <div>
                    <p class="font-medium mb-1">
                      {{ d.escritos_resolver.length }} escrito(s) por resolver
                    </p>
                    <ul class="space-y-1 text-sm">
                      @for (e of d.escritos_resolver; track $index) {
                        <li>
                          {{ e.tipo_escrito || 'Escrito' }}
                          @if (e.solicitante) { — {{ e.solicitante }} }
                          @if (e.fecha_ingreso) { <span class="text-neutral-500">({{ e.fecha_ingreso }})</span> }
                        </li>
                      }
                    </ul>
                  </div>
                </div>
              }

              <!-- Historia procesal, como lo entrega el PJUD (más reciente primero) -->
              <div>
                <h4 class="text-sm font-semibold text-neutral-700 mb-3">Historia del cuaderno</h4>
                @if (d.historia.length === 0) {
                  <p class="text-sm text-neutral-500">El PJUD no registra trámites en este cuaderno.</p>
                } @else {
                  <ol class="relative border-l-2 border-neutral-200 pl-5 space-y-5">
                    @for (h of d.historia; track $index) {
                      <li class="relative">
                        <span class="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-primary-500 ring-4 ring-white"></span>
                        <div class="flex items-baseline justify-between gap-3 flex-wrap">
                          <p class="font-medium text-neutral-800">{{ h.tramite || 'Trámite' }}</p>
                          <span class="text-xs text-neutral-500 whitespace-nowrap">{{ h.fecha_tramite || '-' }}</span>
                        </div>
                        @if (h.descripcion_tramite) {
                          <p class="text-sm text-neutral-600 mt-0.5">{{ h.descripcion_tramite }}</p>
                        }
                        <div class="flex items-center gap-3 mt-1 text-xs text-neutral-400">
                          @if (h.etapa) { <span>{{ h.etapa }}</span> }
                          @if (h.foja) { <span>Foja {{ h.foja }}</span> }
                          @if (h.documento_url) {
                            <a [href]="h.documento_url" target="_blank" rel="noopener"
                               class="text-primary-600 hover:underline font-medium">
                              Ver documento
                            </a>
                          }
                        </div>
                      </li>
                    }
                  </ol>
                }
              </div>

              @if (d.litigantes.length > 0) {
                <div>
                  <h4 class="text-sm font-semibold text-neutral-700 mb-2">Litigantes</h4>
                  <div class="table-wrapper">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Participante</th>
                          <th>Persona / Razón social</th>
                          <th>RUT</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (l of d.litigantes; track $index) {
                          <tr>
                            <td>{{ l.participante || '-' }}</td>
                            <td>{{ l.persona || l.razon_social || '-' }}</td>
                            <td>{{ l.rut || '-' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }

              @if (d.notificaciones.length > 0) {
                <div>
                  <h4 class="text-sm font-semibold text-neutral-700 mb-2">Notificaciones</h4>
                  <div class="table-wrapper">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Nombre</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (n of d.notificaciones; track $index) {
                          <tr>
                            <td>{{ n.fecha_tramite || '-' }}</td>
                            <td>{{ n.tipo_notificacion || '-' }}</td>
                            <td>{{ n.nombre || '-' }}</td>
                            <td>
                              @if (n.estado_notificacion) {
                                <span class="badge-neutral">{{ n.estado_notificacion }}</span>
                              } @else { - }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }

              <p class="text-xs text-neutral-400">
                Consultado directo al Poder Judicial
                @if (d.causa.fecha_ultima_sincronizacion) {
                  ; última sincronización del PJUD: {{ d.causa.fecha_ultima_sincronizacion }}
                }.
              </p>
              }
            }
          </div>

          <div class="modal-footer">
            <button (click)="actualizar()" class="btn-secondary" [disabled]="cargando()">
              {{ cargando() ? 'Actualizando...' : 'Actualizar desde el PJUD' }}
            </button>
            <button (click)="cerrar()" class="btn-primary">Cerrar</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PjudMovimientosModalComponent {
  private service = inject(CausaService);
  private notification = inject(NotificationService);

  private _causa: Causa | null = null;

  @Input()
  set causa(c: Causa | null) {
    this._causa = c;
    if (c !== null) this.cargar(c.id, false);
  }
  get causa(): Causa | null {
    return this._causa;
  }

  @Output() cerrado = new EventEmitter<void>();

  cargando = signal(false);
  error = signal<string | null>(null);
  datos = signal<PjudMovimientosResponse | null>(null);

  private cargar(causaId: number, forzar: boolean): void {
    this.cargando.set(true);
    this.error.set(null);
    this.datos.set(null);
    this.service.pjudMovimientos(causaId, forzar).subscribe({
      next: (res) => {
        this.datos.set(res);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(
          err.error?.detail || 'No se pudieron obtener los movimientos desde el PJUD'
        );
      },
    });
  }

  actualizar(): void {
    if (this.causa) this.cargar(this.causa.id, true);
  }

  cerrar(): void {
    this.cerrado.emit();
  }
}
