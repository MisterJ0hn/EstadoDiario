import { Component, EventEmitter, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import {
  Causa,
  PjudAnexoCausaItem,
  PjudCobranzaMovimientosResponse,
  PjudCuaderno,
  PjudGeoreferencia,
  PjudHistoriaAnexoItem,
} from '@core/models/causa.model';
import { CausaService } from '../../services/causa.service';

type TabCobranza = 'historia' | 'litigantes' | 'notificaciones' | 'diligencias' | 'liquidacion';

/** Cada cuánto se pregunta, mientras el PJUD sincroniza, si ya terminó (mismo
 *  intervalo que usa `PjudBotonComponent` para su propio polling). */
const INTERVALO_POLL_MS = 5000;

/**
 * "Detalle Causa Cobranza": la ficha del PJUD de una causa de materia
 * Cobranza, consultada EN VIVO a api-pjud (no al Excel de Movimientos que
 * sube el estudio).
 *
 * Es el cuarto gemelo de `PjudMovimientosModalComponent` (Civil),
 * `PjudFamiliaModalComponent` (Familia) y `PjudLaboralModalComponent`
 * (Laboral), armado desde "Solicitud cobranza.md" (raíz de `ionic_app/`).
 * Comparte con Civil los cuadernos y el layout de panel gris + pestañas.
 * Cambia respecto a los tres:
 *  - la cabecera suma "Título Ejecutivo" y "Juez Asignado", y el documento de
 *    demanda se llama `doc_demanda` (no `texto_demanda`);
 *  - la sección de trámites se llama `historia` (como Civil) y cada fila
 *    suma "Estado Firma" en vez de "Foja";
 *  - Litigantes, Notificaciones, Diligencias y Liquidación tienen columnas
 *    propias, ninguna calza con las de Civil/Familia/Laboral;
 *  - no hay Escritos por Resolver, Exhortos ni Causa Origen.
 *
 * El padre controla la apertura pasando la causa; null = cerrado.
 */
@Component({
  selector: 'app-pjud-cobranza-modal',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, FormsModule, RouterLink],
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

    <!-- Ícono reutilizable: mundo (abre el popup de georeferencia). -->
    <ng-template #iconoGlobo>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path stroke-linecap="round" d="M3 12h18M12 3c2.5 2.7 4 6.2 4 9s-1.5 6.3-4 9c-2.5-2.7-4-6.2-4-9s1.5-6.3 4-9Z" />
      </svg>
    </ng-template>

    @if (causa !== null) {
      <div class="modal-backdrop" (click)="cerrar()">
        <div class="modal-content !max-w-7xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3 class="text-lg font-semibold text-primary-700">Detalle Causa Cobranza</h3>
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
                    <p><span class="pjud-k">RIT:</span> {{ c.rit || causa.rol }}</p>
                    <p class="font-medium text-neutral-800">{{ c.caratula || '-' }}</p>
                    <p><span class="pjud-k">Fecha Ing.:</span> {{ c.fecha_ingreso || '-' }}</p>

                    <p><span class="pjud-k">RUC:</span> {{ c.ruc || '-' }}</p>
                    <p><span class="pjud-k">Est.Adm:</span> </p>
                    <p><span class="pjud-k">Proc.:</span> {{ c.proceso || '-' }}</p>
                    <p><span class="pjud-k">Forma Inicio:</span> {{ c.forma_inicio || '-' }}</p>

                    <p><span class="pjud-k">Estado Proc.:</span> {{ cuadernoActual(c.cuadernos)?.estado_proceso || c.estado_proceso || '-' }}</p>
                    <p><span class="pjud-k">Etapa:</span> {{ cuadernoActual(c.cuadernos)?.etapa || c.etapa || '-' }}</p>
                     <p><span class="pjud-k">Título Ejec.:</span>
                    @if (c.titulo_ejec?.url) {
                        
                          <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: c.titulo_ejec!.url }" />
                       
                      }
                    </p>
                    <p><span class="pjud-k">Juez Asignado:</span> {{ c.juez_asignado || '-' }}</p>

                    <p class="md:col-span-3"><span class="pjud-k">Tribunal:</span> {{ c.tribunal || causa.tribunal }}</p>
                  </div>

                  <!-- Documentos de la causa -->
                  @if (c.doc_demanda?.url || c.titulo_ejec?.url || c.certificado_envio?.url || c.ebook?.url || c.anexos_causa.length > 0 || c.documentos_laboral.length > 0) {
                    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-neutral-200 px-4 py-2.5 text-sm">
                      @if (c.doc_demanda?.url) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Doc. Demanda:</span>
                          <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: c.doc_demanda!.url }" />
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
                        @if (c.ebook?.url) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Ebook:</span>
                          <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: c.ebook!.url }" />
                        </span>
                      }
                      
                      
                      @if (c.certificado_envio?.url) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Certificado de Envío:</span>
                          <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: c.certificado_envio!.url }" />
                        </span>
                      }
                        @if (c.documentos_laboral.length > 0) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Documentos Laboral:</span>
                          <button type="button" (click)="abrirDocumentosLaboral(c.documentos_laboral)"
                                  class="inline-flex items-center gap-1 text-amber-500 hover:text-amber-600"
                                  title="Ver documentos laboral">
                            <ng-container *ngTemplateOutlet="iconoCarpeta" />
                            <span class="text-xs font-semibold text-neutral-500">{{ c.documentos_laboral.length }}</span>
                          </button>
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
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'diligencias'" (click)="tab.set('diligencias')">
                      Diligencias <span class="tab-contador">{{ d.diligencias.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'liquidacion'" (click)="tab.set('liquidacion')">
                      Liquidación <span class="tab-contador">{{ d.liquidacion.length }}</span>
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
                              <th>Trámite</th><th>Desc. Trámite</th><th>Estado Firma</th><th>Fec. Trámite</th><th>Georref.</th>
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
                                <td>{{ h.estado_firma || '-' }}</td>
                                <td>{{ h.fecha_tramite || '-' }}</td>
                                <td class="text-center">
                                  @if (h.georeferencia) {
                                    <button type="button" (click)="abrirGeoreferencia(h.georeferencia)"
                                            class="inline-flex items-center text-sky-500 hover:text-sky-600"
                                            title="Ver georeferencia">
                                      <ng-container *ngTemplateOutlet="iconoGlobo" />
                                    </button>
                                  } @else { <span>-</span> }
                                </td>
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
                          <thead><tr><th>Tip.Not.</th><th>Est.Not.</th><th>Fec.Not.</th><th>Fec.Trám.</th><th>Trámite</th><th>Tip.Part.</th><th>Nombre</th></tr></thead>
                          <tbody>
                            @for (n of d.notificaciones; track $index) {
                              <tr>
                                <td>{{ n.tipo_notificacion || '-' }}</td>
                                <td>
                                  @if (n.estado_notificacion) {
                                    <span class="badge-neutral">{{ n.estado_notificacion }}</span>
                                  } @else { <span>-</span> }
                                </td>
                                <td>{{ n.fecha_notificacion || '-' }}</td>
                                <td>{{ n.fecha_tramite || '-' }}</td>
                                <td>{{ n.tramite || '-' }}</td>                                
                                <td>{{ n.tipo_part || '-' }}</td>
                                <td class="whitespace-normal">{{ n.nombre || '-' }}</td>                                
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
                          <thead><tr><th>Doc. Ida</th><th>Doc. Vta</th><th>Estado Diligencia</th><th>RIT</th><th>RUC</th><th>Tipo Diligencia</th><th>Fecha Trámite</th><th>Destinatario</th><th>Responsable</th></tr></thead>
                          <tbody>
                            @for (x of d.diligencias; track $index) {
                              <tr>
                                <td class="text-center">
                                  @if (x.doc_ida) {
                                    <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: x.doc_ida }" />
                                  } @else { <span>-</span> }
                                </td>
                                <td class="text-center">
                                  @if (x.doc_vta) {
                                    <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: x.doc_vta }" />
                                  } @else { <span>-</span> }
                                </td>
                                <td>{{ x.estado_diligencia || '-' }}</td>
                                <td>{{ x.rit || '-' }}</td>
                                <td>{{ x.ruc || '-' }}</td>
                                <td class="whitespace-normal">{{ x.tipo_diligencia || '-' }}</td>
                                <td>{{ x.fecha_tramite || '-' }}</td>
                                <td class="whitespace-normal">{{ x.destinatario || '-' }}</td>
                                <td class="whitespace-normal">{{ x.responsable || '-' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  }

                  <!-- Liquidación -->
                  @if (tab() === 'liquidacion') {
                    @if (d.liquidacion.length === 0) {
                      <p class="text-sm text-neutral-500">Sin liquidaciones registradas.</p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Liquidación</th><th>Fecha Liquidación</th><th>Cuaderno</th><th>Estado</th><th>Monto Líquido</th></tr></thead>
                          <tbody>
                            @for (li of d.liquidacion; track $index) {
                              <tr>
                                <td class="text-center">
                                  @if (li.liquidacion) {
                                    <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: li.liquidacion }" />
                                  } @else { <span>-</span> }
                                </td>
                                <td>{{ li.fecha_liquidacion || '-' }}</td>
                                <td>{{ li.cuaderno || '-' }}</td>
                                <td>{{ li.estado || '-' }}</td>
                                <td>{{ li.monto_liquido || '-' }}</td>
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

      <!-- ── Anexos de un trámite de Historia ──────────────────────
           Mismo mecanismo que Civil/Laboral: la celda "Anexo" muestra una
           carpeta y este modal (por encima del principal) despliega el
           detalle (Doc., Fecha, Referencia). -->
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

      <!-- ── Documentos Laboral de la causa ────────────────────────
           Mismo mecanismo que "Anexos del trámite": la cabecera muestra una
           carpeta con el conteo y este modal (por encima del principal)
           despliega el detalle (Doc., Fecha, Referencia). -->
      @if (documentosLaboralAbierto(); as documentos) {
        <div class="modal-backdrop !z-[60]" (click)="documentosLaboralAbierto.set(null)">
          <div class="modal-content !z-[70] !max-w-2xl" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="text-lg font-semibold text-primary-700">Documentos Laboral</h3>
              <button (click)="documentosLaboralAbierto.set(null)"
                      class="text-neutral-400 hover:text-neutral-600 text-xl leading-none">&times;</button>
            </div>
            <div class="modal-body">
              <div class="overflow-x-auto rounded-lg border border-neutral-200">
                <table class="pjud-table">
                  <thead><tr><th>Doc.</th><th>Fecha</th><th>Referencia</th></tr></thead>
                  <tbody>
                    @for (doc of documentos; track $index) {
                      <tr>
                        <td class="text-center">
                          @if (doc.doc) {
                            <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: doc.doc }" />
                          } @else { <span>-</span> }
                        </td>
                        <td>{{ doc.fecha || '-' }}</td>
                        <td class="whitespace-normal">{{ doc.referencia || doc.nombre_doc || '-' }}</td>
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
              <button (click)="documentosLaboralAbierto.set(null)" class="btn-primary">Cerrar</button>
            </div>
          </div>
        </div>
      }

      <!-- ── Georeferencia de un movimiento de la Historia ─────────
           Mismo mecanismo que Civil/Familia/Laboral: popup con tres pestañas:
           mapa (situado según latitud/longitud), imágenes (carrusel si hay
           más de una) y videos (por ahora siempre vacío). -->
      @if (georef(); as g) {
        <div class="modal-backdrop !z-[60]" (click)="cerrarGeoreferencia()">
          <div class="modal-content !z-[70] !max-w-2xl" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="text-lg font-semibold text-primary-700">Georeferencia</h3>
              <button (click)="cerrarGeoreferencia()"
                      class="text-neutral-400 hover:text-neutral-600 text-xl leading-none">&times;</button>
            </div>
            <div class="modal-body space-y-3">
              <div class="border-b border-neutral-200">
                <nav class="tabs-nav">
                  <button class="tab-link" [class.tab-link-activo]="georefTab() === 'mapa'" (click)="georefTab.set('mapa')">
                    Mapa
                  </button>
                  <button class="tab-link" [class.tab-link-activo]="georefTab() === 'imagenes'" (click)="georefTab.set('imagenes')">
                    Imágenes <span class="tab-contador">{{ g.imagenes.length }}</span>
                  </button>
                  <button class="tab-link" [class.tab-link-activo]="georefTab() === 'videos'" (click)="georefTab.set('videos')">
                    Videos <span class="tab-contador">{{ g.videos.length }}</span>
                  </button>
                </nav>
              </div>

              @if (georefTab() === 'mapa') {
                @if (g.mapa?.latitud && g.mapa?.longitud) {
                  <div class="overflow-hidden rounded-lg border border-neutral-200">
                    <iframe class="h-80 w-full" style="border:0" [src]="mapaSrc(g.mapa!.latitud!, g.mapa!.longitud!)"
                            loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                  </div>
                  <p class="text-xs text-neutral-500 space-x-2">
                    <span id="latitud"><span class="pjud-k">Latitud:</span> {{ g.mapa?.latitud }}</span>
                    <span id="longitud"><span class="pjud-k">Longitud:</span> {{ g.mapa?.longitud }}</span>
                    @if (g.mapa?.corrector) {
                      <span id="corrector"><span class="pjud-k">Corrector:</span> {{ g.mapa?.corrector }}</span>
                    }
                  </p>
                } @else {
                  <p class="text-sm text-neutral-500">Sin coordenadas registradas.</p>
                }
              }

              @if (georefTab() === 'imagenes') {
                @if (g.imagenes.length === 0) {
                  <p class="text-sm text-neutral-500">Sin imágenes registradas.</p>
                } @else {
                  <div class="flex flex-col items-center gap-2">
                    <img [src]="g.imagenes[imagenIdx()].img" alt="Imagen de georeferencia"
                         class="max-h-80 w-full rounded-lg border border-neutral-200 object-contain" />
                    @if (g.imagenes.length > 1) {
                      <div class="flex items-center gap-3">
                        <button type="button" class="btn-secondary btn-sm" (click)="imagenAnterior(g.imagenes.length)">‹ Anterior</button>
                        <span class="text-xs text-neutral-500">{{ imagenIdx() + 1 }} / {{ g.imagenes.length }}</span>
                        <button type="button" class="btn-secondary btn-sm" (click)="imagenSiguiente(g.imagenes.length)">Siguiente ›</button>
                      </div>
                    }
                  </div>
                }
              }

              @if (georefTab() === 'videos') {
                <p class="text-sm text-neutral-500">Sin videos registrados.</p>
              }
            </div>
            <div class="modal-footer">
              <button (click)="cerrarGeoreferencia()" class="btn-primary">Cerrar</button>
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
export class PjudCobranzaModalComponent implements OnDestroy {
  private service = inject(CausaService);
  private sanitizer = inject(DomSanitizer);

  private _causa: Causa | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  @Input()
  set causa(c: Causa | null) {
    this.detenerPolling();
    this._causa = c;
    if (c !== null) {
      this.tab.set('historia');
      this.cuadernoSel.set(null);
      this.verAnexos.set(false);
      this.verReceptor.set(false);
      this.anexosTramite.set(null);
      this.documentosLaboralAbierto.set(null);
      this.docError.set(null);
      this.georef.set(null);
      this.georefTab.set('mapa');
      this.imagenIdx.set(0);
      this.cargar(c.id, false);
    }
  }
  get causa(): Causa | null {
    return this._causa;
  }

  ngOnDestroy(): void {
    this.detenerPolling();
  }

  @Output() cerrado = new EventEmitter<void>();
  /** Cada vez que se consulta al PJUD se avisa el estado resultante, para que el
   *  botón que abrió el modal (en otra pantalla) actualice su ícono sin recargar. */
  @Output() estadoPjud = new EventEmitter<{ causaId: number; estado: PjudCobranzaMovimientosResponse['estado'] }>();

  cargando = signal(false);
  error = signal<string | null>(null);
  datos = signal<PjudCobranzaMovimientosResponse | null>(null);
  tab = signal<TabCobranza>('historia');
  cuadernoSel = signal<number | null>(null);
  verAnexos = signal(false);
  verReceptor = signal(false);
  /** Array `anexo` del trámite de Historia que se está mirando en el modal
   *  secundario; `null` = cerrado. */
  anexosTramite = signal<PjudHistoriaAnexoItem[] | null>(null);
  /** `documentos_laboral` de la cabecera, mirado en el modal secundario;
   *  `null` = cerrado. */
  documentosLaboralAbierto = signal<PjudAnexoCausaItem[] | null>(null);
  docError = signal<string | null>(null);

  /** Georeferencia del movimiento que se está mirando en el popup; `null` = cerrado. */
  georef = signal<PjudGeoreferencia | null>(null);
  georefTab = signal<'mapa' | 'imagenes' | 'videos'>('mapa');
  imagenIdx = signal(0);

  private cargar(causaId: number, forzar: boolean, cuaderno?: number): void {
    this.detenerPolling();
    this.cargando.set(true);
    this.error.set(null);
    this.service.pjudCobranza(causaId, forzar, cuaderno).subscribe({
      next: (res) => {
        this.datos.set(res);
        if (res.estado === 'listo' && res.cuaderno_consultado_id != null) {
          this.cuadernoSel.set(res.cuaderno_consultado_id);
        }
        this.cargando.set(false);
        this.estadoPjud.emit({ causaId, estado: res.estado });
        if (res.estado === 'sincronizando') {
          this.iniciarPolling(causaId, cuaderno);
        }
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

  /** Mientras el popup siga abierto y el PJUD siga sincronizando, pregunta
   *  cada `INTERVALO_POLL_MS` (sin `forzar`, solo consulta el estado) y
   *  refresca el popup solo con lo que vuelva; se detiene sola al salir de
   *  'sincronizando', o antes si el usuario cierra el modal, cambia de
   *  cuaderno o dispara otra consulta (Actualizar/Reintentar). */
  private iniciarPolling(causaId: number, cuaderno?: number): void {
    this.detenerPolling();
    this.pollTimer = setInterval(() => {
      this.service.pjudCobranza(causaId, false, cuaderno).subscribe({
        next: (res) => {
          this.datos.set(res);
          if (res.estado === 'listo' && res.cuaderno_consultado_id != null) {
            this.cuadernoSel.set(res.cuaderno_consultado_id);
          }
          this.estadoPjud.emit({ causaId, estado: res.estado });
          if (res.estado !== 'sincronizando') this.detenerPolling();
        },
        // Error de red en un tick: no se sabe nada nuevo, se sigue
        // preguntando en el próximo intervalo.
        error: () => {},
      });
    }, INTERVALO_POLL_MS);
  }

  private detenerPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  actualizar(): void {
    if (this.causa) this.cargar(this.causa.id, true, this.cuadernoSel() ?? undefined);
  }

  cambiarCuaderno(id: number): void {
    if (this.causa) this.cargar(this.causa.id, false, id);
  }

  /** Estado Proc. y Etapa cambian por cuaderno (no son fijos de la causa),
   *  igual que en Civil: se pinta el del cuaderno seleccionado, con el
   *  primero como respaldo mientras no haya selección. */
  cuadernoActual(cuadernos: PjudCuaderno[]): PjudCuaderno | undefined {
    return cuadernos.find((cu) => cu.id === this.cuadernoSel()) ?? cuadernos[0];
  }

  /** Un documento se pinta azul (certificado) si el backend lo marcó así
   *  (`tipo === 'certificado'`) o si la URL del proveedor trae el sufijo
   *  `_doc2`, que es como el OJV nombra el certificado de un escrito. */
  esCertificado(url: string | null | undefined, tipo?: string): boolean {
    return tipo === 'certificado' || (url ?? '').includes('_doc2');
  }

  /** Abre el modal secundario con el detalle del array de anexos de un
   *  trámite de Historia (Doc., Fecha, Referencia). */
  abrirAnexosTramite(anexos: PjudHistoriaAnexoItem[]): void {
    this.docError.set(null);
    this.anexosTramite.set(anexos);
  }

  /** Abre el modal secundario con el detalle de `documentos_laboral` de la
   *  cabecera (Doc., Fecha, Referencia). */
  abrirDocumentosLaboral(documentos: PjudAnexoCausaItem[]): void {
    this.docError.set(null);
    this.documentosLaboralAbierto.set(documentos);
  }

  abrirGeoreferencia(g: PjudGeoreferencia): void {
    this.georefTab.set('mapa');
    this.imagenIdx.set(0);
    this.georef.set(g);
  }

  cerrarGeoreferencia(): void {
    this.georef.set(null);
  }

  /** Embed de Google Maps sin API key, situado en la latitud/longitud del
   *  movimiento. Se marca como segura porque la arma este mismo componente. */
  mapaSrc(latitud: string, longitud: string): SafeResourceUrl {
    const url = `https://www.google.com/maps?q=${encodeURIComponent(latitud)},${encodeURIComponent(longitud)}&z=15&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  imagenSiguiente(total: number): void {
    this.imagenIdx.set((this.imagenIdx() + 1) % total);
  }

  imagenAnterior(total: number): void {
    this.imagenIdx.set((this.imagenIdx() - 1 + total) % total);
  }

  /**
   * Abre un documento del detalle en el visor del navegador, sin descargarlo.
   * Mismo mecanismo que Civil: el backend baja el PDF del proveedor y lo
   * reenvía inline; se pide como blob y se navega la pestaña al objectURL.
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
