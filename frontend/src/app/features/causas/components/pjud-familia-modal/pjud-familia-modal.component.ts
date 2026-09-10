import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import {
  Causa,
  PjudFamiliaAnexoItem,
  PjudFamiliaMovimientosResponse,
} from '@core/models/causa.model';
import { CausaService } from '../../services/causa.service';

type TabFamilia =
  | 'historia'
  | 'litigantes'
  | 'notificaciones'
  | 'materias'
  | 'plazos'
  | 'diligencias';

/**
 * "Detalle Causa Familia": la ficha del PJUD de una causa de materia Familia,
 * consultada EN VIVO a api-pjud (no al Excel de Movimientos que sube el estudio).
 *
 * Es el gemelo de `PjudMovimientosModalComponent` (Civil): mismo layout de panel
 * gris + pestañas y mismo flujo de sincronización asíncrona (la primera consulta
 * vuelve con `estado: 'sincronizando'` y un botón "Reintentar"). Cambian las
 * pestañas —Familia trae `movimientos`, `materias`, `plazos` y `diligencias`, no
 * `escritos_resolver` ni `exhortos`— y que Familia no tiene selector de cuaderno.
 *
 * El padre controla la apertura pasando la causa; null = cerrado.
 */
@Component({
  selector: 'app-pjud-familia-modal',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, RouterLink],
  template: `
    <!-- Ícono reutilizable: abre un PDF del PJUD en el visor del navegador. -->
    <ng-template #enlacePdf let-url let-tipo="tipo">
      <button type="button" (click)="abrirDocumento(url)"
         class="inline-flex align-middle transition-opacity hover:opacity-60"
         [class.text-danger-600]="!esCertificado(url, tipo)"
         [class.text-blue-500]="esCertificado(url, tipo)"
         [title]="(esCertificado(url, tipo) ? 'Ver certificado' : 'Ver documento') + ' (PDF)'">
        <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5" aria-hidden="true">
          <path fill-rule="evenodd" clip-rule="evenodd"
                d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V7a1 1 0 0 0 1 1h3.5L13 3.5Z" />
        </svg>
        <span class="sr-only">PDF</span>
      </button>
    </ng-template>

    <ng-template #iconoCarpeta>
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5" aria-hidden="true">
        <path d="M3 6a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
      </svg>
    </ng-template>

    @if (causa !== null) {
      <div class="modal-backdrop" (click)="cerrar()">
        <div class="modal-content !max-w-7xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3 class="text-lg font-semibold text-primary-700">Detalle Causa Familia</h3>
              <p class="text-sm text-neutral-500">{{ causa.rol }} — {{ causa.tribunal }}</p>
            </div>
            <button (click)="cerrar()" class="text-neutral-400 hover:text-neutral-600 text-xl leading-none">&times;</button>
          </div>

          <div class="modal-body space-y-4">
            @if (cargando() && !datos()) {
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
                  <p>{{ d.mensaje || 'La primera consulta puede tardar varios minutos. Vuelve a intentar en un rato.' }}</p>
                  @if (d.detalle_estado) {
                    <p class="inline-flex items-center gap-2 rounded-md bg-primary-100 px-2.5 py-1 text-sm font-medium text-primary-800">
                      <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {{ d.detalle_estado }}
                    </p>
                  }
                </div>
              }

              @if (d.estado === 'error') {
                <div class="flex flex-col items-start gap-2 rounded-lg bg-danger-600 px-4 py-3 text-white">
                  <p class="font-semibold">La sincronización con el Poder Judicial falló</p>
                  @if (d.ultimo_error) {
                    <p class="text-sm text-white/90">{{ d.ultimo_error }}</p>
                  } @else if (d.detalle_estado) {
                    <p class="text-sm text-white/90">{{ d.detalle_estado }}</p>
                  } @else if (d.mensaje) {
                    <p class="text-sm text-white/90">{{ d.mensaje }}</p>
                  }
                  <button (click)="actualizar()" [disabled]="cargando()"
                          class="mt-1 rounded-md bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25 disabled:opacity-50">
                    {{ cargando() ? 'Reintentando...' : 'Reintentar' }}
                  </button>
                </div>
              }

              @if (d.estado === 'sin_credenciales') {
                <div class="alert-warning flex-col items-start gap-2">
                  <p class="font-medium">Falta tu clave del Poder Judicial</p>
                  <p>{{ d.mensaje || 'Para consultar esta causa por primera vez hay que iniciar sesión en el Poder Judicial con tu clave. Configúrala en Mi Perfil.' }}</p>
                  <a routerLink="/perfil" (click)="cerrar()" class="btn-primary btn-sm mt-1">Ir a Mi Perfil</a>
                </div>
              }

              @if ((d.estado === 'listo' || d.estado === 'sincronizando') && d.causa; as c) {

                <!-- ── Panel de datos de la causa ──── -->
                <div class="rounded-lg border border-neutral-200 bg-neutral-50">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1.5 px-4 py-3 text-sm">
                    <p><span class="pjud-k">ROL:</span> {{ c.rit || causa.rol }}</p>
                    <p><span class="pjud-k">F. Ing.:</span> {{ c.fecha_ingreso || '-' }}</p>
                    <p class="md:text-right font-medium text-neutral-800">{{ c.caratula || '-' }}</p>

                    <p><span class="pjud-k">RUC:</span> {{ c.ruc || '-' }}</p>
                    <p><span class="pjud-k">Proc.:</span> {{ c.proceso || '-' }}</p>
                    <p><span class="pjud-k">Forma Inicio:</span> {{ c.forma_inicio || '-' }}</p>

                    <p><span class="pjud-k">Est. Adm.:</span> {{ c.est_adm || '-' }}</p>
                    <p><span class="pjud-k">Etapa:</span> {{ c.etapa || '-' }}</p>
                    <p><span class="pjud-k">Estado Proc.:</span> {{ c.estado_proceso || '-' }}</p>

                    <p class="md:col-span-3"><span class="pjud-k">Tribunal:</span> {{ c.tribunal || causa.tribunal }}</p>
                  </div>

                  @if (c.certificado_envio?.url || c.ebook?.url || c.anexos_causa.length > 0) {
                    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-neutral-200 px-4 py-2.5 text-sm">
                      @if (c.anexos_causa.length > 0) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Anexos de la causa:</span>
                          <button type="button" (click)="verAnexos.set(!verAnexos())"
                                  class="inline-flex items-center gap-1 text-amber-500 hover:text-amber-600"
                                  [title]="verAnexos() ? 'Ocultar anexos' : 'Ver anexos de la causa'">
                            <ng-container *ngTemplateOutlet="iconoCarpeta" />
                            <span class="text-xs font-semibold text-neutral-500">{{ c.anexos_causa.length }}</span>
                          </button>
                        </span>
                      }
                      @if (c.certificado_envio?.url) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Certificado de Envío:</span>
                          <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: c.certificado_envio!.url }" />
                        </span>
                      }
                      @if (c.ebook?.url) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Ebook:</span>
                          <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: c.ebook!.url }" />
                        </span>
                      }
                    </div>
                  }

                  @if (verAnexos() && c.anexos_causa.length > 0) {
                    <div class="border-t border-neutral-200 px-4 py-2">
                      <div class="overflow-x-auto rounded border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Doc.</th><th>Fecha</th><th>Referencia</th></tr></thead>
                          <tbody>
                            @for (a of c.anexos_causa; track $index) {
                              <tr>
                                <td class="text-center">
                                  @if (a.doc) {
                                    <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: a.doc }" />
                                  } @else { <span>-</span> }
                                </td>
                                <td>{{ a.fecha || '-' }}</td>
                                <td class="whitespace-normal">{{ a.referencia || a.nombre_doc || '-' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>
                  }
                </div>

                <!-- ── Pestañas ──── -->
                <div class="border-b border-neutral-200">
                  <nav class="tabs-nav">
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'historia'" (click)="tab.set('historia')">
                      Historia <span class="tab-contador">{{ d.movimientos.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'litigantes'" (click)="tab.set('litigantes')">
                      Litigantes <span class="tab-contador">{{ d.litigantes.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'notificaciones'" (click)="tab.set('notificaciones')">
                      Notificaciones <span class="tab-contador">{{ d.notificaciones.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'materias'" (click)="tab.set('materias')">
                      Materias <span class="tab-contador">{{ d.materias.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'plazos'" (click)="tab.set('plazos')">
                      Plazos <span class="tab-contador">{{ d.plazos.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'diligencias'" (click)="tab.set('diligencias')">
                      Diligencias <span class="tab-contador">{{ d.diligencias.length }}</span>
                    </button>
                  </nav>
                </div>

                <div class="pt-1">
                  <!-- Historia -->
                  @if (tab() === 'historia') {
                    @if (d.movimientos.length === 0) {
                      <p class="text-sm text-neutral-500">
                        {{ d.estado === 'sincronizando'
                          ? 'El Poder Judicial todavía no entrega los trámites.'
                          : 'El PJUD no registra trámites en esta causa.' }}
                      </p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead>
                            <tr>
                              <th>Folio</th><th>Doc.</th><th>Anexo</th><th>Etapa</th><th>Estado</th>
                              <th>Trámite</th><th>Desc. Trámite</th><th>Fec. Trámite</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (h of d.movimientos; track $index) {
                              <tr>
                                <td class="text-center">{{ h.folio_texto ?? '-' }}</td>
                                <td class="text-center">
                                  @if (h.documentos.length > 0) {
                                    <span class="inline-flex items-center justify-center gap-2">
                                      @for (doc of h.documentos; track $index) {
                                        <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: doc.url, tipo: doc.tipo }" />
                                      }
                                    </span>
                                  } @else { <span>-</span> }
                                </td>
                                <td class="text-center">
                                  @if (h.anexo.length > 0) {
                                    <button type="button" (click)="abrirAnexosTramite(h.anexo)"
                                            class="inline-flex items-center gap-1 text-amber-500 hover:text-amber-600"
                                            title="Ver anexos del trámite">
                                      <ng-container *ngTemplateOutlet="iconoCarpeta" />
                                      <span class="text-xs font-semibold text-neutral-500">{{ h.anexo.length }}</span>
                                    </button>
                                  } @else { <span>-</span> }
                                </td>
                                <td class="whitespace-normal">{{ h.etapa || '-' }}</td>
                                <td class="whitespace-normal">{{ h.estado || '-' }}</td>
                                <td class="whitespace-normal">{{ h.tramite || '-' }}</td>
                                <td class="whitespace-normal">{{ h.descripcion_tramite || '-' }}</td>
                                <td>{{ h.fecha_tramite || '-' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  }

                  <!-- Litigantes -->
                  @if (tab() === 'litigantes') {
                    @if (d.litigantes.length === 0) {
                      <p class="text-sm text-neutral-500">Sin litigantes registrados.</p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Sujeto</th><th>Rut</th><th>Persona</th><th>Nombre o Razón Social</th></tr></thead>
                          <tbody>
                            @for (l of d.litigantes; track $index) {
                              <tr>
                                <td>{{ l.sujeto || '-' }}</td>
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
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Est./Fecha</th><th>Tipo</th><th>Ente</th><th>RIT</th><th>RUC</th><th>Fec. Trámite</th><th>Tipo Parte</th><th>Nombre</th><th>Trámite</th><th>Certificación</th></tr></thead>
                          <tbody>
                            @for (n of d.notificaciones; track $index) {
                              <tr>
                                <td>
                                  @if (n.estado_fecha_notif) {
                                    <span class="badge-neutral">{{ n.estado_fecha_notif }}</span>
                                  } @else { <span>-</span> }
                                </td>
                                <td>{{ n.tipo_notif || '-' }}</td>
                                <td>{{ n.ente_notif || '-' }}</td>
                                <td>{{ n.rit || '-' }}</td>
                                <td>{{ n.ruc || '-' }}</td>
                                <td>{{ n.fecha_tramite || '-' }}</td>
                                <td>{{ n.tipo_parte || '-' }}</td>
                                <td class="whitespace-normal">{{ n.nombre || '-' }}</td>
                                <td>{{ n.tramite || '-' }}</td>
                                <td class="whitespace-normal">{{ n.certificacion || '-' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  }

                  <!-- Materias -->
                  @if (tab() === 'materias') {
                    @if (d.materias.length === 0) {
                      <p class="text-sm text-neutral-500">Sin materias registradas.</p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Código</th><th>Glosa</th><th>Estado</th><th>Fec. Término</th></tr></thead>
                          <tbody>
                            @for (m of d.materias; track $index) {
                              <tr>
                                <td>{{ m.codigo || '-' }}</td>
                                <td class="whitespace-normal">{{ m.glosa_de_materia || '-' }}</td>
                                <td>{{ m.estado || '-' }}</td>
                                <td>{{ m.fecha_termino || '-' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  }

                  <!-- Plazos -->
                  @if (tab() === 'plazos') {
                    @if (d.plazos.length === 0) {
                      <p class="text-sm text-neutral-500">Sin plazos registrados.</p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Tipo</th><th>Ámbito Afectado</th><th>Inicio</th><th>Término</th><th>Duración</th><th>Estado</th><th>Trámite</th><th>Suspensión</th><th>Reactivación</th></tr></thead>
                          <tbody>
                            @for (p of d.plazos; track $index) {
                              <tr>
                                <td class="whitespace-normal">{{ p.tipo_plazo || '-' }}</td>
                                <td class="whitespace-normal">{{ p.ambito_afectado || '-' }}</td>
                                <td>{{ p.fecha_inicio || '-' }}</td>
                                <td>{{ p.fecha_termino || '-' }}</td>
                                <td>{{ p.duracion || '-' }}</td>
                                <td>{{ p.estado || '-' }}</td>
                                <td class="whitespace-normal">{{ p.tramite || '-' }}</td>
                                <td>{{ p.fecha_suspension || '-' }}</td>
                                <td>{{ p.fecha_reactivacion || '-' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  }

                  <!-- Diligencias -->
                  @if (tab() === 'diligencias') {
                    @if (d.diligencias.length === 0) {
                      <p class="text-sm text-neutral-500">Sin diligencias registradas.</p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Solicitud</th><th>Respuesta</th><th>Estado</th><th>Tipo</th><th>Fec. Trámite</th></tr></thead>
                          <tbody>
                            @for (x of d.diligencias; track $index) {
                              <tr>
                                <td class="text-center">
                                  @if (x.doc_solicitud) {
                                    <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: x.doc_solicitud }" />
                                  } @else { <span>-</span> }
                                </td>
                                <td class="text-center">
                                  @if (x.doc_respuesta) {
                                    <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: x.doc_respuesta }" />
                                  } @else { <span>-</span> }
                                </td>
                                <td>{{ x.estado_diligencia || '-' }}</td>
                                <td class="whitespace-normal">{{ x.tipo_diligencia || '-' }}</td>
                                <td>{{ x.fecha_tramite || '-' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
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

          @if (docError()) {
            <p class="px-4 pb-2 text-sm text-danger-600">{{ docError() }}</p>
          }

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

      <!-- Anexos de un trámite de la Historia -->
      @if (anexosTramite(); as anexos) {
        <div class="modal-backdrop !z-[60]" (click)="anexosTramite.set(null)">
          <div class="modal-content !z-[70] !max-w-2xl" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="text-lg font-semibold text-primary-700">Anexos del trámite</h3>
              <button (click)="anexosTramite.set(null)"
                      class="text-neutral-400 hover:text-neutral-600 text-xl leading-none">&times;</button>
            </div>
            <div class="modal-body">
              <div class="overflow-x-auto rounded-lg border border-neutral-200">
                <table class="pjud-table">
                  <thead><tr><th>Doc.</th><th>Folio</th><th>Fecha</th><th>Documento</th><th>Observación</th></tr></thead>
                  <tbody>
                    @for (a of anexos; track $index) {
                      <tr>
                        <td class="text-center">
                          @if (a.doc) {
                            <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: a.doc }" />
                          } @else { <span>-</span> }
                        </td>
                        <td class="text-center">{{ a.folio ?? '-' }}</td>
                        <td>{{ a.fecha || '-' }}</td>
                        <td class="whitespace-normal">{{ a.nombre_documento || '-' }}</td>
                        <td class="whitespace-normal">{{ a.observacion || '-' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (docError()) {
                <p class="mt-2 text-sm text-danger-600">{{ docError() }}</p>
              }
            </div>
            <div class="modal-footer">
              <button (click)="anexosTramite.set(null)" class="btn-primary">Cerrar</button>
            </div>
          </div>
        </div>
      }
    }
  `,
  styles: [`
    .pjud-k { @apply font-semibold text-neutral-500; }

    .pjud-table { @apply min-w-full text-sm border-collapse; }
    .pjud-table th {
      @apply border border-neutral-200 bg-neutral-100 px-3 py-2 text-left
             text-xs font-semibold uppercase tracking-wide text-neutral-600 whitespace-nowrap;
    }
    .pjud-table td { @apply border border-neutral-200 px-3 py-1.5 align-top text-neutral-700 whitespace-nowrap; }
    .pjud-table tbody tr:nth-child(odd) { @apply bg-neutral-50/70; }
    .pjud-table tbody tr:hover { @apply bg-primary-50/40; }
  `],
})
export class PjudFamiliaModalComponent {
  private service = inject(CausaService);

  private _causa: Causa | null = null;

  @Input()
  set causa(c: Causa | null) {
    this._causa = c;
    if (c !== null) {
      this.tab.set('historia');
      this.verAnexos.set(false);
      this.anexosTramite.set(null);
      this.docError.set(null);
      this.cargar(c.id, false);
    }
  }
  get causa(): Causa | null {
    return this._causa;
  }

  @Output() cerrado = new EventEmitter<void>();
  /** Cada vez que se consulta al PJUD se avisa el estado resultante, para que el
   *  botón que abrió el modal (en otra pantalla) actualice su ícono sin recargar. */
  @Output() estadoPjud = new EventEmitter<{ causaId: number; estado: PjudFamiliaMovimientosResponse['estado'] }>();

  cargando = signal(false);
  error = signal<string | null>(null);
  datos = signal<PjudFamiliaMovimientosResponse | null>(null);
  tab = signal<TabFamilia>('historia');
  verAnexos = signal(false);
  anexosTramite = signal<PjudFamiliaAnexoItem[] | null>(null);
  docError = signal<string | null>(null);

  private cargar(causaId: number, forzar: boolean): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.pjudFamilia(causaId, forzar).subscribe({
      next: (res) => {
        this.datos.set(res);
        this.cargando.set(false);
        this.estadoPjud.emit({ causaId, estado: res.estado });
      },
      error: (err) => {
        this.cargando.set(false);
        this.datos.set(null);
        this.error.set(err.error?.detail || 'No se pudo obtener el detalle desde el PJUD');
      },
    });
  }

  actualizar(): void {
    if (this.causa) this.cargar(this.causa.id, true);
  }

  /** Azul (certificado) si el backend lo marcó así o si la URL trae `_doc2`. */
  esCertificado(url: string | null | undefined, tipo?: string): boolean {
    return tipo === 'certificado' || (url ?? '').includes('_doc2');
  }

  abrirAnexosTramite(anexos: PjudFamiliaAnexoItem[]): void {
    this.docError.set(null);
    this.anexosTramite.set(anexos);
  }

  /**
   * Abre un documento del detalle en el visor del navegador, sin descargarlo.
   * El backend baja el PDF del proveedor (http, adjunto, sin CORS) y lo reenvía
   * https/inline; se pide como blob y se navega la pestaña al objectURL.
   */
  abrirDocumento(url: string | null | undefined): void {
    if (!url) return;
    this.docError.set(null);
    const win = window.open('', '_blank');
    this.service.pjudDocumento(url).subscribe({
      next: (blob) => {
        const obj = URL.createObjectURL(blob);
        if (win) win.location.href = obj;
        else window.open(obj, '_blank');
        setTimeout(() => URL.revokeObjectURL(obj), 60_000);
      },
      error: () => {
        win?.close();
        this.docError.set('No se pudo abrir el documento desde el PJUD.');
      },
    });
  }

  cerrar(): void {
    this.cerrado.emit();
  }
}
