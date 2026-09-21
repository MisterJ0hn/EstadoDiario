import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import {
  Causa,
  PjudGeoreferencia,
  PjudHistoriaAnexoItem,
  PjudLaboralMovimientoItem,
  PjudLaboralMovimientosResponse,
} from '@core/models/causa.model';
import { CausaService } from '../../services/causa.service';

type TabLaboral =
  | 'movimiento'
  | 'litigantes'
  | 'notificaciones'
  | 'diligencias'
  | 'liquidacion'
  | 'materias'
  | 'escritos_pendientes';

/**
 * "Detalle Causa Laboral": la ficha del PJUD de una causa de materia Laboral,
 * consultada EN VIVO a api-pjud (no al Excel de Movimientos que sube el estudio).
 *
 * Es el tercer gemelo de `PjudMovimientosModalComponent` (Civil) y
 * `PjudFamiliaModalComponent` (Familia): mismo layout de panel gris + pestañas
 * y mismo flujo de sincronización asíncrona (la primera consulta vuelve con
 * `estado: 'sincronizando'` y un botón "Reintentar"). Cambia respecto a esos
 * dos:
 *  - la cabecera trae `texto_demanda` (una lista, con un ícono de estado por
 *    fila) y `audio_laboral`, en vez de un único documento de demanda;
 *  - las pestañas son `movimiento`, `litigantes`, `notificaciones`,
 *    `diligencias`, `liquidacion`, `materias` y `escritos_pendientes`;
 *  - Litigantes trae además un ícono de estado por fila (mismo criterio que
 *    `texto_demanda`).
 *
 * El padre controla la apertura pasando la causa; null = cerrado.
 */
@Component({
  selector: 'app-pjud-laboral-modal',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, RouterLink],
  template: `
    <!-- Ícono reutilizable: abre un documento del PJUD (PDF, DOC o DOCX,
         según venga) en el visor del navegador o, si el navegador no sabe
         mostrarlo (DOC/DOCX), lo descarga con su extensión real. -->
    <ng-template #enlacePdf let-url let-tipo="tipo">
      <button type="button" (click)="abrirDocumento(url)"
         class="inline-flex align-middle transition-opacity hover:opacity-60"
         [class.text-danger-600]="!esCertificado(url, tipo)"
         [class.text-blue-500]="esCertificado(url, tipo)"
         [title]="(esCertificado(url, tipo) ? 'Ver certificado' : 'Ver documento') + ' (' + extensionDocumento(url) + ')'">
        @if (esDocWord(url)) {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="h-5 w-5" aria-hidden="true">
            <path stroke-width="2" stroke-linecap="round"
                  d="M4 4C4 3.44772 4.44772 3 5 3H14H14.5858C14.851 3 15.1054 3.10536 15.2929 3.29289L19.7071 7.70711C19.8946 7.89464 20 8.149 20 8.41421V20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V4Z" />
            <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 8H15V3" />
            <path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                  d="M7.5 13H7V17H7.5C8.60457 17 9.5 16.1046 9.5 15C9.5 13.8954 8.60457 13 7.5 13Z" />
            <path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                  d="M17.5 13L17 13C16.4477 13 16 13.4477 16 14V16C16 16.5523 16.4477 17 17 17H17.5" />
            <path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                  d="M11.5 14C11.5 13.4477 11.9477 13 12.5 13H13C13.5523 13 14 13.4477 14 14V16C14 16.5523 13.5523 17 13 17H12.5C11.9477 17 11.5 16.5523 11.5 16V14Z" />
          </svg>
        } @else {
          <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5" aria-hidden="true">
            <path fill-rule="evenodd" clip-rule="evenodd"
                  d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V7a1 1 0 0 0 1 1h3.5L13 3.5Z" />
          </svg>
        }
        <span class="sr-only">{{ extensionDocumento(url) }}</span>
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

    <!-- Ícono reutilizable: audífonos (abre el popup de Audio Laboral). -->
    <ng-template #iconoAudio>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round"
              d="M4 13.5V12a8 8 0 0 1 16 0v1.5M4 13.5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1v-6H4Zm16 0h-1v6h1a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2Z" />
      </svg>
    </ng-template>

    <!-- Ícono de estado (fa-minus = 0, fa-check = 1) reutilizable en
         texto_demanda y litigantes. -->
    <ng-template #iconoEstado let-valor>
      @if (valor === 1) {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
             class="h-4 w-4 text-accent-600 inline-block align-middle" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span class="sr-only">Con documento</span>
      } @else if (valor === 0) {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
             class="h-4 w-4 text-neutral-400 inline-block align-middle" aria-hidden="true">
          <path stroke-linecap="round" d="M5 12h14" />
        </svg>
        <span class="sr-only">Sin documento</span>
      } @else {
        <span>-</span>
      }
    </ng-template>

    @if (causa !== null) {
      <div class="modal-backdrop" (click)="cerrar()">
        <div class="modal-content !max-w-7xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3 class="text-lg font-semibold text-primary-700">Detalle Causa Laboral</h3>
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
                    <p class="font-medium text-neutral-800">{{ c.caratula || '-' }}</p>
                    <p><span class="pjud-k">F. Ing.:</span> {{ c.fecha_ingreso || '-' }}</p>

                    <p><span class="pjud-k">RUC:</span> {{ c.ruc || '-' }}</p>
                    <p><span class="pjud-k">Proc.:</span> {{ c.proceso || '-' }}</p>
                    <p><span class="pjud-k">Forma Inicio:</span> {{ c.forma_inicio || '-' }}</p>

                    <p><span class="pjud-k">Est. Adm.:</span> {{ c.est_adm || '-' }}</p>
                    <p><span class="pjud-k">Etapa:</span> {{ c.etapa || '-' }}</p>
                    <p><span class="pjud-k">Estado Proc.:</span> {{ c.estado_proceso || '-' }}</p>

                    <p class="md:col-span-3"><span class="pjud-k">Tribunal:</span> {{ c.tribunal || causa.tribunal }}</p>
                    @if (c.tramites) {
                      <p class="md:col-span-3"><span class="pjud-k">Trámites:</span> {{ c.tramites }}</p>
                    }
                  </div>

                  @if (c.certificado_envio?.url || c.ebook?.url || c.texto_demanda.length > 0 || c.audio_laboral.length > 0) {
                    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-neutral-200 px-4 py-2.5 text-sm">
                      @if (c.texto_demanda.length > 0) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Texto Demanda:</span>
                          <button type="button" (click)="verTextoDemanda.set(!verTextoDemanda())"
                                  class="inline-flex items-center gap-1 text-amber-500 hover:text-amber-600"
                                  [title]="verTextoDemanda() ? 'Ocultar texto de demanda' : 'Ver texto de demanda'">
                            <ng-container *ngTemplateOutlet="iconoCarpeta" />
                            <span class="text-xs font-semibold text-neutral-500">{{ c.texto_demanda.length }}</span>
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
                      @if (c.audio_laboral.length > 0) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Audio Laboral:</span>
                          <button type="button" (click)="verAudios.set(!verAudios())"
                                  class="inline-flex items-center gap-1 text-sky-500 hover:text-sky-600"
                                  [title]="verAudios() ? 'Ocultar audios' : 'Ver audios'">
                            <ng-container *ngTemplateOutlet="iconoAudio" />
                            <span class="text-xs font-semibold text-neutral-500">{{ c.audio_laboral.length }}</span>
                          </button>
                        </span>
                      }
                    </div>
                  }

                  @if (verTextoDemanda() && c.texto_demanda.length > 0) {
                    <div class="border-t border-neutral-200 px-4 py-2">
                      <div class="overflow-x-auto rounded border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Estado</th><th>Doc.</th><th>Fecha</th><th>Referencia</th></tr></thead>
                          <tbody>
                            @for (t of c.texto_demanda; track $index) {
                              <tr>
                                <td class="text-center"><ng-container *ngTemplateOutlet="iconoEstado; context: { $implicit: t.doc_demanda }" /></td>
                                <td class="text-center">
                                  @if (t.doc) {
                                    <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: t.doc }" />
                                  } @else { <span>-</span> }
                                </td>
                                <td>{{ t.fecha || '-' }}</td>
                                <td class="whitespace-normal">{{ t.referencia || '-' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>
                  }

                  @if (verAudios() && c.audio_laboral.length > 0) {
                    <div class="border-t border-neutral-200 px-4 py-2">
                      <div class="overflow-x-auto rounded border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>N°</th><th>Audio</th><th>Fecha</th><th>Referencia</th></tr></thead>
                          <tbody>
                            @for (a of c.audio_laboral; track $index) {
                              <tr>
                                <td class="text-center">{{ a.numero ?? '-' }}</td>
                                <td>
                                  @if (a.audio) {
                                    <audio controls preload="none" [src]="a.audio" class="h-8 max-w-xs"></audio>
                                  } @else { <span>-</span> }
                                </td>
                                <td>{{ a.fecha || '-' }}</td>
                                <td class="whitespace-normal">{{ a.referencia || '-' }}</td>
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
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'movimiento'" (click)="tab.set('movimiento')">
                      Movimiento <span class="tab-contador">{{ d.movimiento.length }}</span>
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
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'materias'" (click)="tab.set('materias')">
                      Materias <span class="tab-contador">{{ d.materias.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'escritos_pendientes'" (click)="tab.set('escritos_pendientes')">
                      Escritos Pendientes <span class="tab-contador">{{ d.escritos_pendientes.length }}</span>
                    </button>
                  </nav>
                </div>

                <div class="pt-1">
                  <!-- Movimiento -->
                  @if (tab() === 'movimiento') {
                    @if (d.movimiento.length === 0) {
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
                              <th>Folio</th><th>Doc.</th><th>Anexos</th><th>Etapa</th>
                              <th>Trámite</th><th>Desc. Trámite</th><th>Fecha Trámite</th><th>Estado</th><th>Georreferencia</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (h of d.movimiento; track $index) {
                              <tr>
                                <td class="text-center">{{ h.folio_texto ?? '-' }}</td>
                                <td class="text-center">
                                  @if (esIngresoCausa(h)) {
                                    <button type="button" (click)="verTextoDemanda.set(true)"
                                            class="inline-flex items-center text-amber-500 hover:text-amber-600"
                                            title="Ver texto de demanda">
                                      <ng-container *ngTemplateOutlet="iconoCarpeta" />
                                    </button>
                                  } @else if (h.documentos.length > 0) {
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
                                 <td class="whitespace-normal">{{ h.estado || '-' }}</td>
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
                          <thead><tr><th>Est.</th><th>Abog. Defensor</th><th>Sujeto</th><th>Rut</th><th>Persona</th><th>Nombre o Razón Social</th></tr></thead>
                          <tbody>
                            @for (l of d.litigantes; track $index) {
                              <tr>
                                <td class="text-center"><ng-container *ngTemplateOutlet="iconoEstado; context: { $implicit: l.estado }" /></td>
                                <td>{{ l.defensor || '-' }}</td>
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
                          <thead><tr><th>Estado Notif.</th><th>Fecha Trámite</th><th>Tipo Parte</th><th>Nombre</th><th>Trámite</th><th>Obs. Fallida</th></tr></thead>
                          <tbody>
                            @for (n of d.notificaciones; track $index) {
                              <tr>
                                <td>
                                  @if (n.estado_notificacion) {
                                    <span class="badge-neutral">{{ n.estado_notificacion }}</span>
                                  } @else { <span>-</span> }
                                </td>
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

                  <!-- Diligencias -->
                  @if (tab() === 'diligencias') {
                    @if (d.diligencias.length === 0) {
                      <p class="text-sm text-neutral-500">Sin diligencias registradas.</p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Doc. Ida</th><th>Doc. Vta</th><th>Estado Diligencia</th><th>RIT</th><th>RUC</th><th>Tipo Diligencia</th><th>Referencia</th><th>Fecha Trámite</th></tr></thead>
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
                                <td class="whitespace-normal">{{ x.referencia || '-' }}</td>
                                <td>{{ x.fecha_tramite || '-' }}</td>
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
                          <thead><tr><th>Liquidación</th><th>Rut</th><th>Nombre</th><th>Monto Líquido</th></tr></thead>
                          <tbody>
                            @for (li of d.liquidacion; track $index) {
                              <tr>
                                <td class="whitespace-normal">{{ li.liquidacion || '-' }}</td>
                                <td>{{ li.rut || '-' }}</td>
                                <td class="whitespace-normal">{{ li.nombre || '-' }}</td>
                                <td>{{ li.monto_liquido || '-' }}</td>
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
                          <thead><tr><th>Código</th><th>Glosa de Materia</th><th>Estado</th><th>Fecha Término</th></tr></thead>
                          <tbody>
                            @for (m of d.materias; track $index) {
                              <tr>
                                <td>{{ m.codigo || '-' }}</td>
                                <td class="whitespace-normal">{{ m.glosa_materia || '-' }}</td>
                                <td>{{ m.estado || '-' }}</td>
                                <td>{{ m.fecha_termino || '-' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  }

                  <!-- Escritos Pendientes -->
                  @if (tab() === 'escritos_pendientes') {
                    @if (d.escritos_pendientes.length === 0) {
                      <p class="text-sm text-neutral-500">Sin escritos pendientes registrados.</p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Doc.</th><th>Anexo</th><th>Fecha Ing.</th><th>Referencia</th><th>Solicitante</th><th>Tipo Ingreso</th></tr></thead>
                          <tbody>
                            @for (e of d.escritos_pendientes; track $index) {
                              <tr>
                                <td class="text-center">
                                  @if (e.doc) {
                                    <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: e.doc }" />
                                  } @else { <span>-</span> }
                                </td>
                                <td class="whitespace-normal">{{ e.anexo || '-' }}</td>
                                <td>{{ e.fecha_ing || '-' }}</td>
                                <td class="whitespace-normal">{{ e.referencia || '-' }}</td>
                                <td class="whitespace-normal">{{ e.solicitante || '-' }}</td>
                                <td>{{ e.tipo_ingreso || '-' }}</td>
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

      <!-- ── Georeferencia de un movimiento ────────────────────────
           Popup con tres pestañas: mapa (situado según latitud/longitud),
           imágenes (carrusel si hay más de una) y videos (por ahora siempre
           vacío: el proveedor todavía no manda ejemplos de esa sección). -->
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

      <!-- ── Anexos de un trámite de Movimiento ────────────────────
           Mismo mecanismo que "Anexos del trámite" de Historia en Civil. -->
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
export class PjudLaboralModalComponent {
  private service = inject(CausaService);
  private sanitizer = inject(DomSanitizer);

  private _causa: Causa | null = null;

  @Input()
  set causa(c: Causa | null) {
    this._causa = c;
    if (c !== null) {
      this.tab.set('movimiento');
      this.verTextoDemanda.set(false);
      this.verAudios.set(false);
      this.docError.set(null);
      this.georef.set(null);
      this.georefTab.set('mapa');
      this.imagenIdx.set(0);
      this.anexosTramite.set(null);
      this.cargar(c.id, false);
    }
  }
  get causa(): Causa | null {
    return this._causa;
  }

  @Output() cerrado = new EventEmitter<void>();
  /** Cada vez que se consulta al PJUD se avisa el estado resultante, para que el
   *  botón que abrió el modal (en otra pantalla) actualice su ícono sin recargar. */
  @Output() estadoPjud = new EventEmitter<{ causaId: number; estado: PjudLaboralMovimientosResponse['estado'] }>();

  cargando = signal(false);
  error = signal<string | null>(null);
  datos = signal<PjudLaboralMovimientosResponse | null>(null);
  tab = signal<TabLaboral>('movimiento');
  verTextoDemanda = signal(false);
  verAudios = signal(false);
  docError = signal<string | null>(null);

  /** Georeferencia del movimiento que se está mirando en el popup; `null` = cerrado. */
  georef = signal<PjudGeoreferencia | null>(null);
  georefTab = signal<'mapa' | 'imagenes' | 'videos'>('mapa');
  imagenIdx = signal(0);

  /** Array `anexo` del trámite de Movimiento que se está mirando en el modal
   *  secundario (mismo mecanismo que Historia en Civil); `null` = cerrado. */
  anexosTramite = signal<PjudHistoriaAnexoItem[] | null>(null);

  private cargar(causaId: number, forzar: boolean): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.pjudLaboral(causaId, forzar).subscribe({
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

  /** En Laboral (`movimiento`) el documento puede venir como PDF, DOC o DOCX
   *  en vez de solo PDF; se identifica por la extensión de la URL para
   *  mostrar el tipo real en el tooltip/etiqueta del ícono. */
  extensionDocumento(url: string | null | undefined): string {
    const match = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(url ?? '');
    return match ? match[1].toUpperCase() : 'PDF';
  }

  /** true si el documento es .doc o .docx, para mostrar el ícono de Word en vez del genérico. */
  esDocWord(url: string | null | undefined): boolean {
    const ext = this.extensionDocumento(url).toLowerCase();
    return ext === 'doc' || ext === 'docx';
  }

  /** El trámite de "Ingreso Causa" no trae el documento en `documentos` sino
   *  en la demanda (`texto_demanda` de la cabecera): en vez del ícono de
   *  documento se muestra una carpeta que abre ese panel. */
  esIngresoCausa(item: PjudLaboralMovimientoItem): boolean {
    return (item.descripcion_tramite ?? '').trim().toLowerCase() === 'ingreso causa';
  }

  /** Abre el modal secundario con el detalle del array de anexos de un
   *  trámite de Movimiento (Doc., Fecha, Referencia), igual que Historia
   *  en Civil. */
  abrirAnexosTramite(anexos: PjudHistoriaAnexoItem[]): void {
    this.docError.set(null);
    this.anexosTramite.set(anexos);
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
   * Abre un documento del detalle en el visor del navegador (PDF) o lo
   * descarga con su extensión real (DOC/DOCX, que el navegador no sabe
   * mostrar inline). El backend baja el documento del proveedor (http,
   * adjunto, sin CORS), identifica el tipo por la extensión y lo reenvía
   * https/inline con el `Content-Type` correcto; se pide como blob y se
   * navega la pestaña al objectURL.
   */
  abrirDocumento(url: string | null | undefined): void {
    if (!url) return;
    this.docError.set(null);
    // Solo el PDF tiene visor nativo del navegador; DOC/DOCX se descargan
    // directo (una pestaña en blanco quedaría vacía para siempre).
    const esPdf = this.extensionDocumento(url).toLowerCase() === 'pdf';
    const win = esPdf ? window.open('', '_blank') : null;
    this.service.pjudDocumento(url).subscribe({
      next: (blob) => {
        const obj = URL.createObjectURL(blob);
        if (esPdf) {
          if (win) win.location.href = obj;
          else window.open(obj, '_blank');
        } else {
          // Un objectURL no trae el nombre de archivo del `Content-Disposition`
          // del backend, así que se arma acá desde la URL original para que
          // la descarga no quede sin extensión.
          const nombre = url.split('/').pop()?.split('?')[0] || `documento.${this.extensionDocumento(url).toLowerCase()}`;
          const a = document.createElement('a');
          a.href = obj;
          a.download = nombre;
          a.click();
        }
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
