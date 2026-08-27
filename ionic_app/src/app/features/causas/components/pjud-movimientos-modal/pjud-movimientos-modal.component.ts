import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Causa, PjudMovimientosResponse } from '@core/models/causa.model';
import { CausaService } from '../../services/causa.service';

type TabPjud = 'historia' | 'litigantes' | 'notificaciones' | 'escritos' | 'exhortos';

/**
 * "Detalle Causa Civil": la ficha del PJUD de una causa Civil, consultada EN
 * VIVO a api-pjud.codifica.cl (no al Excel de Movimientos que sube el estudio).
 *
 * Solo aplica a causas Civiles: es lo único que esa API expone hoy. El padre
 * controla la apertura pasando la causa; null = cerrado.
 *
 * El scrape del proveedor es asíncrono: la primera consulta de una causa vuelve
 * con `estado: 'sincronizando'` y hay que reintentar a los pocos minutos. El
 * modal muestra ese aviso con un botón "Reintentar" en vez de un error.
 */
@Component({
  selector: 'app-pjud-movimientos-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    @if (causa !== null) {
      <div class="modal-backdrop" (click)="cerrar()">
        <div class="modal-content !max-w-4xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3 class="text-lg font-semibold">Detalle Causa Civil</h3>
              <p class="text-sm text-neutral-500">{{ causa.rol }} — {{ causa.tribunal }}</p>
            </div>
            <button (click)="cerrar()" class="text-neutral-400 hover:text-neutral-600 text-xl leading-none">&times;</button>
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

              @if (d.estado === 'sincronizando') {
                <div class="alert-info flex-col items-start gap-2">
                  <p class="font-medium">El Poder Judicial está sincronizando esta causa</p>
                  <p>
                    {{ d.mensaje || 'La primera consulta puede tardar varios minutos. Vuelve a intentar en un rato.' }}
                  </p>
                  <button (click)="reintentar()" class="btn-primary btn-sm mt-1">Reintentar</button>
                </div>
              }

              @if (d.estado === 'sin_credenciales') {
                <div class="alert-warning flex-col items-start gap-2">
                  <p class="font-medium">Falta tu clave del Poder Judicial</p>
                  <p>
                    {{ d.mensaje || 'Para consultar esta causa por primera vez hay que iniciar sesión en el Poder Judicial con tu clave. Configúrala en Mi Perfil.' }}
                  </p>
                  <a routerLink="/perfil" (click)="cerrar()" class="btn-primary btn-sm mt-1">Ir a Mi Perfil</a>
                </div>
              }

              @if (d.estado === 'listo' && d.causa; as c) {

                <!-- ── Cabecera ─────────────────────────── -->
                <div class="rounded-lg border border-neutral-200 p-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
                  <div><p class="dato-label">ROL</p><p class="dato-valor">{{ c.rol || causa.rol }}</p></div>
                  <div><p class="dato-label">F. Ingreso</p><p class="dato-valor">{{ c.fecha_ingreso || '-' }}</p></div>
                  <div><p class="dato-label">Est. Adm.</p><p class="dato-valor">{{ c.est_adm || '-' }}</p></div>
                  <div><p class="dato-label">Proceso</p><p class="dato-valor">{{ c.proceso || '-' }}</p></div>
                  <div><p class="dato-label">Ubicación</p><p class="dato-valor">{{ c.ubicacion || '-' }}</p></div>
                  <div><p class="dato-label">Estado Proc.</p><p class="dato-valor">{{ c.estado_proceso || '-' }}</p></div>
                  <div><p class="dato-label">Etapa</p><p class="dato-valor">{{ c.etapa || '-' }}</p></div>
                  <div class="col-span-2"><p class="dato-label">Tribunal</p><p class="dato-valor">{{ c.tribunal || causa.tribunal }}</p></div>
                  <div class="col-span-2 sm:col-span-3">
                    <p class="dato-label">Carátula</p>
                    <p class="dato-valor">{{ c.caratula || '-' }}</p>
                  </div>
                </div>

                <!-- ── Documentos de la causa ───────────── -->
                @if (c.texto_demanda?.url || c.certificado_envio?.url || c.ebook?.url) {
                  <div class="flex flex-wrap gap-2">
                    @if (c.texto_demanda?.url) {
                      <a [href]="c.texto_demanda!.url" target="_blank" rel="noopener" class="btn-outline btn-sm">Texto de demanda</a>
                    }
                    @if (c.certificado_envio?.url) {
                      <a [href]="c.certificado_envio!.url" target="_blank" rel="noopener" class="btn-outline btn-sm">Certificado de envío</a>
                    }
                    @if (c.ebook?.url) {
                      <a [href]="c.ebook!.url" target="_blank" rel="noopener" class="btn-outline btn-sm">Ebook</a>
                    }
                  </div>
                }

                <!-- ── Anexos de la causa ───────────────── -->
                @if (c.anexos_causa.length > 0) {
                  <details class="rounded-lg border border-neutral-200">
                    <summary class="cursor-pointer px-4 py-2 text-sm font-semibold text-neutral-700">
                      Anexos de la causa ({{ c.anexos_causa.length }})
                    </summary>
                    <ul class="border-t border-neutral-100 divide-y divide-neutral-100">
                      @for (a of c.anexos_causa; track $index) {
                        <li class="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                          <span>
                            {{ a.referencia || a.nombre_doc || 'Anexo' }}
                            @if (a.fecha) { <span class="text-neutral-400">· {{ a.fecha }}</span> }
                          </span>
                          @if (a.doc) {
                            <a [href]="a.doc" target="_blank" rel="noopener" class="text-primary-600 hover:underline font-medium whitespace-nowrap">Ver</a>
                          }
                        </li>
                      }
                    </ul>
                  </details>
                }

                <!-- ── Información del receptor ──────────── -->
                @if (c.informacion_receptor.length > 0) {
                  <div>
                    <h4 class="text-sm font-semibold text-neutral-700 mb-2">Información notificaciones receptor</h4>
                    <div class="table-wrapper">
                      <table class="data-table">
                        <thead><tr><th>Cuaderno</th><th>Datos de retiro</th><th>Fecha retiro</th><th>Estado</th></tr></thead>
                        <tbody>
                          @for (r of c.informacion_receptor; track $index) {
                            <tr>
                              <td>{{ r.cuaderno || '-' }}</td>
                              <td class="whitespace-normal">{{ r.datos_retiro || '-' }}</td>
                              <td>{{ r.fecha_retiro || '-' }}</td>
                              <td>{{ r.estado || '-' }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                }

                <!-- ── Cuaderno ─────────────────────────── -->
                @if (c.cuadernos.length > 1) {
                  <div class="flex items-center gap-2">
                    <label class="form-label !mb-0" for="pjud-cuaderno">Cuaderno</label>
                    <select id="pjud-cuaderno" class="form-select !w-auto"
                            [ngModel]="cuadernoSel()" (ngModelChange)="cambiarCuaderno($event)">
                      @for (cu of c.cuadernos; track cu.id) {
                        <option [ngValue]="cu.id">{{ cu.nombre }}</option>
                      }
                    </select>
                  </div>
                }

                @if (d.escritos_resolver.length > 0) {
                  <div class="alert-warning">
                    {{ d.escritos_resolver.length }} escrito(s) por resolver — ver la pestaña.
                  </div>
                }

                <!-- ── Pestañas ─────────────────────────── -->
                <div class="border-b border-neutral-200">
                  <nav class="tabs-nav">
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'historia'" (click)="tab.set('historia')">
                      Historia <span class="tab-contador">{{ d.historia.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'litigantes'" (click)="tab.set('litigantes')">
                      Litigantes <span class="tab-contador">{{ d.litigantes.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'notificaciones'" (click)="tab.set('notificaciones')">
                      Notificaciones <span class="tab-contador">{{ d.notificaciones.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'escritos'" (click)="tab.set('escritos')">
                      Escritos por resolver <span class="tab-contador">{{ d.escritos_resolver.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'exhortos'" (click)="tab.set('exhortos')">
                      Exhortos <span class="tab-contador">{{ d.exhortos.length }}</span>
                    </button>
                  </nav>
                </div>

                <div class="pt-1">
                  <!-- Historia -->
                  @if (tab() === 'historia') {
                    @if (d.historia.length === 0) {
                      <p class="text-sm text-neutral-500">El PJUD no registra trámites en este cuaderno.</p>
                    } @else {
                      <ol class="relative border-l-2 border-neutral-200 pl-5 space-y-5">
                        @for (h of d.historia; track $index) {
                          <li class="relative">
                            <span class="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-primary-500 ring-4 ring-white"></span>
                            <div class="flex items-baseline justify-between gap-3 flex-wrap">
                              <p class="font-medium text-neutral-800">
                                @if (h.folio != null) { <span class="text-neutral-400">#{{ h.folio }}</span> }
                                {{ h.tramite || h.descripcion_tramite || 'Trámite' }}
                              </p>
                              <span class="text-xs text-neutral-500 whitespace-nowrap">{{ h.fecha_tramite || '-' }}</span>
                            </div>
                            @if (h.descripcion_tramite && h.descripcion_tramite !== h.tramite) {
                              <p class="text-sm text-neutral-600 mt-0.5">{{ h.descripcion_tramite }}</p>
                            }
                            <div class="flex flex-wrap items-center gap-3 mt-1 text-xs text-neutral-400">
                              @if (h.etapa) { <span>{{ h.etapa }}</span> }
                              @if (h.foja) { <span>Foja {{ h.foja }}</span> }
                              @if (h.documento_url) {
                                <a [href]="h.documento_url" target="_blank" rel="noopener" class="text-primary-600 hover:underline font-medium">Ver documento</a>
                              }
                              @for (an of h.anexo; track $index) {
                                @if (an.doc) {
                                  <a [href]="an.doc" target="_blank" rel="noopener" class="text-primary-600 hover:underline">
                                    Anexo{{ an.referencia ? ' · ' + an.referencia : '' }}
                                  </a>
                                }
                              }
                            </div>
                          </li>
                        }
                      </ol>
                    }
                  }

                  <!-- Litigantes -->
                  @if (tab() === 'litigantes') {
                    @if (d.litigantes.length === 0) {
                      <p class="text-sm text-neutral-500">Sin litigantes registrados.</p>
                    } @else {
                      <div class="table-wrapper">
                        <table class="data-table">
                          <thead><tr><th>Participante</th><th>RUT</th><th>Persona</th><th>Nombre o razón social</th></tr></thead>
                          <tbody>
                            @for (l of d.litigantes; track $index) {
                              <tr>
                                <td>{{ l.participante || '-' }}</td>
                                <td>{{ l.rut || '-' }}</td>
                                <td>{{ l.persona || '-' }}</td>
                                <td class="whitespace-normal">{{ l.razon_social || '-' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  }

                  <!-- Notificaciones -->
                  @if (tab() === 'notificaciones') {
                    @if (d.notificaciones.length === 0) {
                      <p class="text-sm text-neutral-500">Sin notificaciones registradas.</p>
                    } @else {
                      <div class="table-wrapper">
                        <table class="data-table">
                          <thead><tr><th>Fecha</th><th>Tipo</th><th>Est. notif.</th><th>Tipo part.</th><th>Nombre</th><th>Trámite</th><th>Obs. fallida</th></tr></thead>
                          <tbody>
                            @for (n of d.notificaciones; track $index) {
                              <tr>
                                <td>{{ n.fecha_tramite || '-' }}</td>
                                <td>{{ n.tipo_notificacion || '-' }}</td>
                                <td>
                                  @if (n.estado_notificacion) {
                                    <span class="badge-neutral">{{ n.estado_notificacion }}</span>
                                  } @else {
                                    <span>-</span>
                                  }
                                </td>
                                <td>{{ n.tipo_part || '-' }}</td>
                                <td class="whitespace-normal">{{ n.nombre || '-' }}</td>
                                <td>{{ n.tramite || '-' }}</td>
                                <td class="whitespace-normal">{{ n.observacion_fallida || '-' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  }

                  <!-- Escritos por resolver -->
                  @if (tab() === 'escritos') {
                    @if (d.escritos_resolver.length === 0) {
                      <p class="text-sm text-neutral-500">No hay escritos pendientes de resolución.</p>
                    } @else {
                      <div class="table-wrapper">
                        <table class="data-table">
                          <thead><tr><th>Fecha ingreso</th><th>Tipo de escrito</th><th>Solicitante</th><th>Documento</th></tr></thead>
                          <tbody>
                            @for (e of d.escritos_resolver; track $index) {
                              <tr>
                                <td>{{ e.fecha_ingreso || '-' }}</td>
                                <td class="whitespace-normal">{{ e.tipo_escrito || '-' }}</td>
                                <td>{{ e.solicitante || '-' }}</td>
                                <td>
                                  @if (e.doc) {
                                    <a [href]="e.doc" target="_blank" rel="noopener" class="text-primary-600 hover:underline font-medium">Ver</a>
                                  } @else {
                                    <span>-</span>
                                  }
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  }

                  <!-- Exhortos -->
                  @if (tab() === 'exhortos') {
                    @if (d.exhortos.length === 0) {
                      <p class="text-sm text-neutral-500">Sin exhortos registrados.</p>
                    } @else {
                      <div class="space-y-4">
                        @for (x of d.exhortos; track $index) {
                          <div class="rounded-lg border border-neutral-200 p-4 text-sm">
                            <div class="flex items-baseline justify-between gap-3 flex-wrap">
                              <p class="font-medium text-neutral-800">
                                {{ x.tipo_exhorto || 'Exhorto' }}
                                @if (x.rol_origen) { <span class="text-neutral-400">· origen {{ x.rol_origen }}</span> }
                              </p>
                              @if (x.estado_exhorto) { <span class="badge-neutral">{{ x.estado_exhorto }}</span> }
                            </div>
                            <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-neutral-500">
                              @if (x.tribunal_destino) { <span>Destino: {{ x.tribunal_destino }}</span> }
                              @if (x.fecha_ordena_exhorto) { <span>Ordena: {{ x.fecha_ordena_exhorto }}</span> }
                              @if (x.fecha_ingreso_exhorto) { <span>Ingreso: {{ x.fecha_ingreso_exhorto }}</span> }
                            </div>
                            @for (rd of x.rol_destino; track $index) {
                              <div class="mt-3">
                                <p class="font-medium text-neutral-700">{{ rd.nombre || 'Rol destino' }}</p>
                                <ul class="mt-1 space-y-1">
                                  @for (rol of rd.roles; track $index) {
                                    <li class="flex items-center justify-between gap-3">
                                      <span class="text-neutral-600">
                                        {{ rol.tramite || 'Trámite' }}
                                        @if (rol.referencia) { <span>— {{ rol.referencia }}</span> }
                                        @if (rol.fecha) { <span class="text-neutral-400">({{ rol.fecha }})</span> }
                                      </span>
                                      @if (rol.doc) {
                                        <a [href]="rol.doc" target="_blank" rel="noopener" class="text-primary-600 hover:underline whitespace-nowrap">Ver</a>
                                      }
                                    </li>
                                  }
                                </ul>
                              </div>
                            }
                          </div>
                        }
                      </div>
                    }
                  }
                </div>

                <p class="text-xs text-neutral-400">
                  Consultado directo al Poder Judicial.
                  @if (c.fecha_ultima_sincronizacion) {
                    <span>Última sincronización del PJUD: {{ c.fecha_ultima_sincronizacion }}.</span>
                  }
                </p>
              }
             }
            }
          </div>

          <div class="modal-footer">
            @if (datos()?.estado === 'listo') {
              <button (click)="actualizar()" class="btn-secondary" [disabled]="cargando()">
                {{ cargando() ? 'Actualizando...' : 'Actualizar desde el PJUD' }}
              </button>
            }
            <button (click)="cerrar()" class="btn-primary">Cerrar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dato-label { @apply text-neutral-400 text-xs uppercase tracking-wide; }
    .dato-valor { @apply font-medium text-neutral-800; }
  `],
})
export class PjudMovimientosModalComponent {
  private service = inject(CausaService);

  private _causa: Causa | null = null;

  @Input()
  set causa(c: Causa | null) {
    this._causa = c;
    if (c !== null) {
      this.tab.set('historia');
      this.cuadernoSel.set(null);
      this.cargar(c.id, false);
    }
  }
  get causa(): Causa | null {
    return this._causa;
  }

  @Output() cerrado = new EventEmitter<void>();

  cargando = signal(false);
  error = signal<string | null>(null);
  datos = signal<PjudMovimientosResponse | null>(null);
  tab = signal<TabPjud>('historia');
  cuadernoSel = signal<number | null>(null);

  private cargar(causaId: number, forzar: boolean, cuaderno?: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.pjudMovimientos(causaId, forzar, cuaderno).subscribe({
      next: (res) => {
        this.datos.set(res);
        if (res.estado === 'listo' && res.cuaderno_consultado_id != null) {
          this.cuadernoSel.set(res.cuaderno_consultado_id);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.datos.set(null);
        this.error.set(
          err.error?.detail || 'No se pudo obtener el detalle desde el PJUD',
        );
      },
    });
  }

  reintentar(): void {
    if (this.causa) this.cargar(this.causa.id, false, this.cuadernoSel() ?? undefined);
  }

  actualizar(): void {
    if (this.causa) this.cargar(this.causa.id, true, this.cuadernoSel() ?? undefined);
  }

  cambiarCuaderno(id: number): void {
    if (this.causa) this.cargar(this.causa.id, false, id);
  }

  cerrar(): void {
    this.cerrado.emit();
  }
}
