import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Causa, PjudHistoriaAnexoItem, PjudMovimientosResponse } from '@core/models/causa.model';
import { CausaService } from '../../services/causa.service';

type TabPjud = 'historia' | 'litigantes' | 'notificaciones' | 'escritos' | 'exhortos';

/**
 * "Detalle Causa Civil": la ficha del PJUD de una causa Civil, consultada EN
 * VIVO a api-pjud.codifica.cl (no al Excel de Movimientos que sube el estudio).
 *
 * El layout replica la ventana "Detalle Causa Civil" de la Oficina Judicial
 * Virtual: panel gris con los datos de la causa, fila de documentos, selector de
 * cuaderno y las cinco pestañas (Historia, Litigantes, Notificaciones, Escritos
 * por Resolver, Exhortos) con tablas con borde y filas alternadas.
 *
 * Solo aplica a causas Civiles: es lo único que esa API expone hoy. El padre
 * controla la apertura pasando la causa; null = cerrado.
 *
 * El scrape del proveedor es asíncrono: la primera consulta de una causa vuelve
 * con `estado: 'sincronizando'` y hay que reintentar a los pocos minutos. El
 * modal muestra ese aviso con un botón "Reintentar" en vez de un error, y por
 * debajo va pintando los datos parciales (cabecera, historia) a medida que el
 * proveedor los expone.
 */
@Component({
  selector: 'app-pjud-movimientos-modal',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, FormsModule, RouterLink],
  template: `
    <!-- Ícono reutilizable: abre un PDF del PJUD en una pestaña nueva, en el
         visor del navegador (sin descargarlo). El backend lo baja del proveedor
         (http, adjunto, sin CORS) y lo reenvía https/inline; acá se pide como
         blob para que el visor lo muestre. Rojo para el documento principal,
         azul para el certificado: lo marca el backend (tipo 'certificado') o,
         donde no viene ese dato, la URL del proveedor con el sufijo _doc2. -->
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

    <!-- Ícono reutilizable: carpeta (secciones desplegables). -->
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
              <h3 class="text-lg font-semibold text-primary-700">Detalle Causa Civil</h3>
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
                  <p>
                    {{ d.mensaje || 'La primera consulta puede tardar varios minutos.' }}
                  </p>
                  @if (d.detalle_estado) {
                    <p class="inline-flex items-center gap-2 rounded-md bg-primary-100 px-2.5 py-1 text-sm font-medium text-primary-800">
                      <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {{ d.detalle_estado }}
                    </p>
                  }
                  <button (click)="reintentar()" [disabled]="cargando()"
                          class="btn-primary btn-sm mt-1 disabled:opacity-50">
                    {{ cargando() ? 'Consultando...' : 'Reintentar' }}
                  </button>
                </div>
              }

              @if (d.estado === 'error') {
                <div class="flex flex-col items-start gap-2 rounded-lg bg-danger-600 px-4 py-3 text-white">
                  <p class="font-semibold">Upss!! algo salió mal</p>
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
                  <p>
                    {{ d.mensaje || 'Para consultar esta causa por primera vez hay que iniciar sesión en el Poder Judicial con tu clave. Configúrala en Mi Perfil.' }}
                  </p>
                  <a routerLink="/perfil" (click)="cerrar()" class="btn-primary btn-sm mt-1">Ir a Mi Perfil</a>
                </div>
              }

              @if ((d.estado === 'listo' || d.estado === 'sincronizando') && d.causa; as c) {

                <!-- ── Panel de datos de la causa (gris, como el OJV) ──── -->
                <!-- Se pinta también en 'sincronizando': el proveedor puede
                     traer la cabecera y parte de la historia antes de terminar,
                     y el aviso de sincronización queda arriba. -->

                <div class="rounded-lg border border-neutral-200 bg-neutral-50">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1.5 px-4 py-3 text-sm">
                    <p><span class="pjud-k">ROL:</span> {{ c.rol || causa.rol }}</p>
                    <p><span class="pjud-k">F. Ing.:</span> {{ c.fecha_ingreso || '-' }}</p>
                    <p class="md:text-right md:col-span-1 font-medium text-neutral-800">{{ c.caratula || '-' }}</p>

                    <p><span class="pjud-k">Est. Adm.:</span> {{ c.est_adm || '-' }}</p>
                    <p><span class="pjud-k">Proc.:</span> {{ c.proceso || '-' }}</p>
                    <p><span class="pjud-k">Ubicación:</span> {{ c.ubicacion || '-' }}</p>

                    <p><span class="pjud-k">Estado Proc.:</span> {{ c.estado_proceso || '-' }}</p>
                    <p><span class="pjud-k">Etapa:</span> {{ c.etapa || '-' }}</p>
                    <p><span class="pjud-k">Tribunal:</span> {{ c.tribunal || causa.tribunal }}</p>
                  </div>

                  <!-- Documentos de la causa -->
                  @if (c.texto_demanda?.url || c.certificado_envio?.url || c.ebook?.url || c.anexos_causa.length > 0) {
                    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-neutral-200 px-4 py-2.5 text-sm">
                      @if (c.texto_demanda?.url) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Texto Demanda:</span>
                          <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: c.texto_demanda!.url }" />
                        </span>
                      }
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

                  <!-- Anexos de la causa (desplegable) -->
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

                <!-- ── Cuaderno + info receptor ─────────────────────────── -->
                <div class="flex flex-wrap items-end gap-x-8 gap-y-3">
                  @if (c.cuadernos.length >= 1) {
                    <div>
                      <label class="pjud-k block mb-1" for="pjud-cuaderno">Historia Causa Cuaderno</label>
                      <select id="pjud-cuaderno" class="form-select !w-auto"
                              [ngModel]="cuadernoSel()" (ngModelChange)="cambiarCuaderno($event)"
                              [disabled]="c.cuadernos.length === 1">
                        @for (cu of c.cuadernos; track cu.id) {
                          <option [ngValue]="cu.id">{{ cu.nombre }}</option>
                        }
                      </select>
                    </div>
                  }
                  @if (c.informacion_receptor.length > 0) {
                    <div>
                      <span class="pjud-k block mb-1">Información notificaciones receptor</span>
                      <button type="button" (click)="verReceptor.set(!verReceptor())"
                              class="inline-flex items-center gap-1 text-amber-500 hover:text-amber-600"
                              [title]="verReceptor() ? 'Ocultar' : 'Ver información del receptor'">
                        <ng-container *ngTemplateOutlet="iconoCarpeta" />
                        <span class="text-xs font-semibold text-neutral-500">{{ c.informacion_receptor.length }}</span>
                      </button>
                    </div>
                  }
                </div>

                @if (verReceptor() && c.informacion_receptor.length > 0) {
                  <div class="overflow-x-auto rounded-lg border border-neutral-200">
                    <table class="pjud-table">
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
                      Escritos por Resolver <span class="tab-contador">{{ d.escritos_resolver.length }}</span>
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
                      <p class="text-sm text-neutral-500">
                        {{ d.estado === 'sincronizando'
                          ? 'El Poder Judicial todavía no entrega los trámites de este cuaderno.'
                          : 'El PJUD no registra trámites en este cuaderno.' }}
                      </p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead>
                            <tr>
                              <th>Folio</th><th>Doc.</th><th>Anexo</th><th>Etapa</th>
                              <th>Trámite</th><th>Desc. Trámite</th><th>Fec. Trámite</th><th>Foja</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (h of d.historia; track $index) {
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
                                <td class="whitespace-normal">{{ h.tramite || '-' }}</td>
                                <td class="whitespace-normal">{{ h.descripcion_tramite || '-' }}</td>
                                <td>{{ h.fecha_tramite || '-' }}</td>
                                <td class="text-center">{{ h.foja ?? '-' }}</td>
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
                          <thead><tr><th>Participante</th><th>Rut</th><th>Persona</th><th>Nombre o Razón Social</th></tr></thead>
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
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>ROL</th><th>Est. Notif.</th><th>Tipo Notif.</th><th>Fecha Trámite</th><th>Tipo Part.</th><th>Nombre</th><th>Trámite</th><th>Obs. Fallida</th></tr></thead>
                          <tbody>
                            @for (n of d.notificaciones; track $index) {
                              <tr>
                                <td>{{ n.rol || '-' }}</td>
                                <td>
                                  @if (n.estado_notificacion) {
                                    <span class="badge-neutral">{{ n.estado_notificacion }}</span>
                                  } @else { <span>-</span> }
                                </td>
                                <td>{{ n.tipo_notificacion || '-' }}</td>
                                <td>{{ n.fecha_tramite || '-' }}</td>
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

                  <!-- Escritos por Resolver -->
                  @if (tab() === 'escritos') {
                    @if (d.escritos_resolver.length === 0) {
                      <p class="text-sm text-neutral-500">No hay escritos pendientes de resolución.</p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Doc.</th><th>Anexo</th><th>Fecha de Ingreso</th><th>Tipo Escrito</th><th>Solicitante</th></tr></thead>
                          <tbody>
                            @for (e of d.escritos_resolver; track $index) {
                              <tr>
                                <td class="text-center">
                                  @if (e.doc) {
                                    <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: e.doc }" />
                                  } @else { <span>-</span> }
                                </td>
                                <td class="text-center">
                                  @if (e.anexo) {
                                    <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: e.anexo }" />
                                  } @else { <span>-</span> }
                                </td>
                                <td>{{ e.fecha_ingreso || '-' }}</td>
                                <td class="whitespace-normal">{{ e.tipo_escrito || '-' }}</td>
                                <td>{{ e.solicitante || '-' }}</td>
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
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Rol Origen</th><th>Tipo Exhorto</th><th>Rol Destino</th><th>Fecha Ordena Exhorto</th><th>Fecha Ingreso Exhorto</th><th>Tribunal Destino</th><th>Estado Exhorto</th></tr></thead>
                          <tbody>
                            @for (x of d.exhortos; track $index) {
                              <tr>
                                <td>{{ x.rol_origen || '-' }}</td>
                                <td>{{ x.tipo_exhorto || 'Exhorto' }}</td>
                                <td>
                                  @if (x.rol_destino.length > 0) {
                                    <button type="button" (click)="toggleExhorto($index)" class="pjud-link">
                                      {{ exhortoAbierto() === $index ? 'ocultar' : 'ver detalle' }}
                                    </button>
                                  } @else { <span>-</span> }
                                </td>
                                <td>{{ x.fecha_ordena_exhorto || '-' }}</td>
                                <td>{{ x.fecha_ingreso_exhorto || '-' }}</td>
                                <td class="whitespace-normal">{{ x.tribunal_destino || '-' }}</td>
                                <td>
                                  @if (x.estado_exhorto) {
                                    <span class="badge-neutral">{{ x.estado_exhorto }}</span>
                                  } @else { <span>-</span> }
                                </td>
                              </tr>
                              @if (exhortoAbierto() === $index) {
                                <tr>
                                  <td colspan="7" class="bg-neutral-50 whitespace-normal">
                                    @for (rd of x.rol_destino; track $index) {
                                      <div class="mb-3 last:mb-0">
                                        <p class="font-semibold text-neutral-700">{{ rd.nombre || 'Rol destino' }}</p>
                                        <ul class="mt-1 space-y-1">
                                          @for (rol of rd.roles; track $index) {
                                            <li class="flex items-center justify-between gap-3">
                                              <span class="text-neutral-600">
                                                {{ rol.tramite || 'Trámite' }}
                                                @if (rol.referencia) { <span>— {{ rol.referencia }}</span> }
                                                @if (rol.fecha) { <span class="text-neutral-400">({{ rol.fecha }})</span> }
                                              </span>
                                              @if (rol.doc) {
                                                <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: rol.doc }" />
                                              }
                                            </li>
                                          }
                                        </ul>
                                      </div>
                                    }
                                  </td>
                                </tr>
                              }
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

      <!-- ── Anexos de un trámite de la Historia ──────────────────
           El endpoint entrega la columna "Anexo" como un array; la celda
           muestra una carpeta y este modal (por encima del principal) despliega
           el detalle (Doc., Fecha, Referencia). El "Doc." se abre en el visor
           del navegador con el mismo mecanismo que el resto de los PDF. -->
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
                  <thead><tr><th>Doc.</th><th>Fecha</th><th>Referencia</th></tr></thead>
                  <tbody>
                    @for (a of anexos; track $index) {
                      <tr>
                        <td class="text-center">
                          @if (a.doc) {
                            <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: a.doc }" />
                          } @else { <span>-</span> }
                        </td>
                        <td>{{ a.fecha || '-' }}</td>
                        <td class="whitespace-normal">{{ a.referencia || '-' }}</td>
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
    .pjud-link { @apply text-primary-600 hover:underline font-medium cursor-pointer; }
    .pjud-doc { @apply text-danger-600 hover:underline font-medium; }

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
export class PjudMovimientosModalComponent {
  private service = inject(CausaService);

  private _causa: Causa | null = null;

  @Input()
  set causa(c: Causa | null) {
    this._causa = c;
    if (c !== null) {
      this.tab.set('historia');
      this.cuadernoSel.set(null);
      this.verAnexos.set(false);
      this.verReceptor.set(false);
      this.exhortoAbierto.set(null);
      this.anexosTramite.set(null);
      this.docError.set(null);
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
  verAnexos = signal(false);
  verReceptor = signal(false);
  exhortoAbierto = signal<number | null>(null);
  /** Array `anexo` del trámite de la Historia que se está mirando en el modal
   *  secundario; `null` = cerrado. */
  anexosTramite = signal<PjudHistoriaAnexoItem[] | null>(null);
  docError = signal<string | null>(null);

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

  toggleExhorto(i: number): void {
    this.exhortoAbierto.set(this.exhortoAbierto() === i ? null : i);
  }

  /** Un documento se pinta azul (certificado) si el backend lo marcó así
   *  (`tipo === 'certificado'`) o si la URL del proveedor trae el sufijo
   *  `_doc2`, que es como el OJV nombra el certificado de un escrito. */
  esCertificado(url: string | null | undefined, tipo?: string): boolean {
    return tipo === 'certificado' || (url ?? '').includes('_doc2');
  }

  /** Abre el modal secundario con el detalle del array de anexos de un trámite
   *  de la Historia (Doc., Fecha, Referencia). */
  abrirAnexosTramite(anexos: PjudHistoriaAnexoItem[]): void {
    this.docError.set(null);
    this.anexosTramite.set(anexos);
  }

  /**
   * Abre un documento del detalle en el visor del navegador, sin descargarlo.
   *
   * El backend (`/causas/pjud/documento`) baja el PDF del proveedor —que va por
   * `http`, como adjunto y sin CORS— y lo reenvía `https`/inline. Se pide como
   * blob (el interceptor le pone el token) y se navega la pestaña al
   * `objectURL`: la pestaña se abre YA, en el gesto del clic, para que el
   * bloqueador de pop-ups no la mate mientras llega la respuesta.
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
        // Para entonces el visor ya cargó el PDF; revocar libera la memoria
        // sin afectar la pestaña abierta.
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
