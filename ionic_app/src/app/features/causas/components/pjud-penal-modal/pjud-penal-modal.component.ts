import { Component, EventEmitter, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import {
  Causa,
  PjudGeoreferencia,
  PjudPenalAnexoItem,
  PjudPenalCuaderno,
  PjudPenalMovimientosResponse,
} from '@core/models/causa.model';
import { CausaService } from '../../services/causa.service';

type TabPenal = 'historia' | 'litigantes' | 'notificaciones' | 'relaciones';

/** Cada cuánto se pregunta, mientras el PJUD sincroniza, si ya terminó (mismo
 *  intervalo que usa `PjudBotonComponent` para su propio polling). */
const INTERVALO_POLL_MS = 5000;

/**
 * "Detalle Causa Penal": la ficha del PJUD de una causa de materia Penal,
 * consultada EN VIVO a api-pjud (no al Excel de Movimientos que sube el estudio).
 *
 * Gemelo de `PjudFamiliaModalComponent`: mismo layout de panel gris + pestañas
 * y mismo flujo de sincronización asíncrona. Cambia la cabecera (procedimiento,
 * ubicación, acumulada), la georeferencia (vive en las notificaciones, no en
 * los trámites) y las pestañas: Historia, Litigantes, Notificaciones,
 * y Relaciones, con selector de cuaderno como Cobranza. Ver "Solicitud Penal.md".
 *
 * El padre controla la apertura pasando la causa; null = cerrado.
 */
@Component({
  selector: 'app-pjud-penal-modal',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, FormsModule, RouterLink],
  template: `
    <!-- Ícono reutilizable: abre un PDF del PJUD en el visor del navegador. -->
    <ng-template #enlacePdf let-url let-color="color">
      <button type="button" (click)="abrirDocumento(url)"
         class="inline-flex align-middle transition-opacity hover:opacity-60"
         [class.text-danger-600]="!color"
         [style.color]="color || null"
         title="Ver documento">
        <svg viewBox="0 0 1920 1920" fill="currentColor" class="h-5 w-5" aria-hidden="true">
          <g fill-rule="evenodd">
            <path d="M1251.654 0c44.499 0 88.207 18.07 119.718 49.581l329.223 329.224c31.963 31.962 49.581 74.54 49.581 119.717V1920H169V0Zm-66.183 112.941H281.94V1807.06h1355.294V564.706H1185.47V112.94Zm112.94 23.379v315.445h315.445L1298.412 136.32Z" />
            <path d="M900.497 677.67c26.767 0 50.372 12.65 67.991 37.835 41.901 59.068 38.965 121.976 23.492 206.682-5.308 29.14.113 58.617 16.263 83.125 22.814 34.786 55.68 82.673 87.981 123.219 23.718 29.93 60.198 45.854 97.13 40.885 23.718-3.276 52.292-5.986 81.656-5.986 131.012 0 121.186 46.757 133.045 89.675 6.55 25.976 3.275 48.678-10.165 65.506-16.715 22.701-51.162 34.447-101.534 34.447-55.793 0-74.202-9.487-122.767-24.96-27.445-8.81-55.906-10.617-83.69-3.275-55.453 14.456-146.936 36.48-223.284 46.983-40.772 5.647-77.816 26.654-102.438 60.875-55.454 76.8-106.842 148.518-188.273 148.518-21.007 0-40.32-7.567-56.244-22.701-23.492-23.492-33.544-49.581-28.574-79.85 13.778-92.95 128.075-144.79 196.066-182.625 16.037-8.923 28.687-22.589 36.592-39.53l107.86-233.223c7.68-16.377 10.051-34.56 7.228-52.518-12.537-79.059-31.06-211.99 18.748-272.075 10.955-13.44 26.09-21.007 42.917-21.007Zm20.556 339.953c-43.257 126.607-119.718 264.282-129.996 280.32 92.273-43.37 275.916-65.28 275.916-65.28-92.386-88.998-145.92-215.04-145.92-215.04Z" />
          </g>
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
              <h3 class="text-lg font-semibold text-primary-700">Detalle Causa Penal</h3>
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
                     <p><span class="pjud-k">ROL:</span> {{ c.rol || causa.rol }} / <span class="pjud-k">RUC:</span> {{ c.ruc || '-' }}</p>
                    
                    <p><span class="pjud-k">Fecha Ingreso:</span> {{ c.fecha_ingreso || '-' }}</p>
                    <p><span class="pjud-k">Caratulado:</span>{{ c.caratula || '-' }}</p>
                    <p><span class="pjud-k">Est.Adm.:</span> {{ c.estado_adm || '-' }}</p>
                    <p><span class="pjud-k">Procedimiento:</span> {{ c.procedimiento || '-' }}</p>
                    <p><span class="pjud-k">Ubicación:</span> {{ c.ubicacion || '-' }}</p>
                    <p><span class="pjud-k">Estado Procesal:</span> {{ cuadernoActual(c.cuadernos)?.estado_proceso || c.estado_proceso || '-' }}</p>
                    <p><span class="pjud-k">Etapa:</span> {{ cuadernoActual(c.cuadernos)?.etapa || c.etapa || '-' }}</p>
                    <p><span class="pjud-k">Tribunal:</span> {{ c.tribunal || causa.tribunal }}</p>
                    
                  </div>

                  @if (c.acumulada || c.certificado_envio) {
                    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-neutral-200 px-4 py-2.5 text-sm">
                      @if (c.acumulada) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Acumulada:</span>
                          <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: c.acumulada }" />
                        </span>
                      }
                      @if (c.certificado_envio) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Certificado de Envío:</span>
                          <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: c.certificado_envio }" />
                        </span>
                      }
                    </div>
                  }
                </div>

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

                <!-- ── Pestañas ──── -->
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
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'relaciones'" (click)="tab.set('relaciones')">
                      Relaciones <span class="tab-contador">{{ d.relaciones.length }}</span>
                    </button>
                  </nav>
                </div>

                <div class="pt-1">
                  <!-- Historia -->
                  @if (tab() === 'historia') {
                    @if (d.historia.length === 0) {
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
                              <th>Folio</th><th>Doc.</th><th>Anexo</th><th>Trámite</th>
                              <th>Desc. Trámite</th><th>Fec. Trámite</th><th>Fec. Firma</th><th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (h of d.historia; track $index) {
                              <tr>
                                <td class="text-center">{{ h.folio_texto ?? h.folio ?? '-' }}</td>
                                <td class="text-center">
                                  @if (h.documentos.length > 0) {
                                    <span class="inline-flex items-center justify-center gap-2">
                                      @for (doc of h.documentos; track $index) {
                                        <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: doc.url, color: doc.color || ($index === 1 ? '#3b82f6' : null) }" />
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
                                <td class="whitespace-normal">{{ h.tramite || '-' }}</td>
                                <td class="whitespace-normal">{{ h.descripcion_tramite || '-' }}</td>
                                <td>{{ h.fecha_tramite || '-' }}</td>
                                <td>{{ h.fecha_firma || '-' }}</td>
                                <td>{{ h.estado || '-' }}</td>
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
                          <thead><tr><th>Participante</th><th>Persona</th><th>Nombre o Razón Social</th></tr></thead>
                          <tbody>
                            @for (l of d.litigantes; track $index) {
                              <tr>
                                <td>{{ l.participantes || '-' }}</td>
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
                          <thead><tr><th>Tipo Notificación</th><th>Estado Notificación</th><th>Fecha Notificación</th><th>Nombre</th><th>Estampado</th><th>Geo</th></tr></thead>
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
                                <td class="whitespace-normal">{{ n.nombre || '-' }}</td>
                                <td class="whitespace-normal">{{ n.estampado || '-' }}</td>
                                <td class="text-center">
                                  @if (n.geo) {
                                    <button type="button" (click)="abrirGeoreferencia(n.geo)"
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

                  <!-- Relaciones -->
                  @if (tab() === 'relaciones') {
                    @if (d.relaciones.length === 0) {
                      <p class="text-sm text-neutral-500">Sin relaciones registradas.</p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Nombre</th><th>Materia</th><th>Estado Causa</th><th>Fecha Cambio Estado</th></tr></thead>
                          <tbody>
                            @for (r of d.relaciones; track $index) {
                              <tr>
                                <td class="whitespace-normal">{{ r.nombre || '-' }}</td>
                                <td class="whitespace-normal">{{ r.materia || '-' }}</td>
                                <td>{{ r.estado_causa || '-' }}</td>
                                <td>{{ r.fecha_cambio_estado || '-' }}</td>
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
                  <thead><tr><th>Doc.</th><th>Fecha</th><th>Referencia</th></tr></thead>
                  <tbody>
                    @for (a of anexos; track $index) {
                      <tr>
                        <td class="text-center">
                          @if (a.doc) {
                            <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: a.doc, color: a.color }" />
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

      <!-- ── Georeferencia de una notificación ────────────────────────
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
export class PjudPenalModalComponent implements OnDestroy {
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
      this.anexosTramite.set(null);
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
  @Output() estadoPjud = new EventEmitter<{ causaId: number; estado: PjudPenalMovimientosResponse['estado'] }>();

  cargando = signal(false);
  error = signal<string | null>(null);
  datos = signal<PjudPenalMovimientosResponse | null>(null);
  tab = signal<TabPenal>('historia');
  cuadernoSel = signal<number | null>(null);
  verAnexos = signal(false);
  anexosTramite = signal<PjudPenalAnexoItem[] | null>(null);
  docError = signal<string | null>(null);

  /** Georeferencia de la notificación que se está mirando en el popup; `null` = cerrado. */
  georef = signal<PjudGeoreferencia | null>(null);
  georefTab = signal<'mapa' | 'imagenes' | 'videos'>('mapa');
  imagenIdx = signal(0);

  private cargar(causaId: number, forzar: boolean, cuaderno?: number): void {
    this.detenerPolling();
    this.cargando.set(true);
    this.error.set(null);
    this.service.pjudPenal(causaId, forzar, cuaderno).subscribe({
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
        this.error.set(err.error?.detail || 'No se pudo obtener el detalle desde el PJUD');
      },
    });
  }

  /** Mientras el popup siga abierto y el PJUD siga sincronizando, pregunta
   *  cada `INTERVALO_POLL_MS` (sin `forzar`, solo consulta el estado) y
   *  refresca el popup solo con lo que vuelva; se detiene sola al salir de
   *  'sincronizando', o antes si el usuario cierra el modal o dispara otra
   *  consulta (Actualizar). */
  private iniciarPolling(causaId: number, cuaderno?: number): void {
    this.detenerPolling();
    this.pollTimer = setInterval(() => {
      this.service.pjudPenal(causaId, false, cuaderno).subscribe({
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

  /** Estado Proc. y Etapa cambian por cuaderno: se pinta el del seleccionado,
   *  con el primero como respaldo mientras no haya selección. */
  cuadernoActual(cuadernos: PjudPenalCuaderno[]): PjudPenalCuaderno | undefined {
    return cuadernos.find((cu) => cu.id === this.cuadernoSel()) ?? cuadernos[0];
  }

  abrirAnexosTramite(anexos: PjudPenalAnexoItem[]): void {
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

  /** Embed de Google Maps sin API key, situado en la latitud/longitud de la
   *  notificación. Se marca como segura porque la arma este mismo componente. */
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
