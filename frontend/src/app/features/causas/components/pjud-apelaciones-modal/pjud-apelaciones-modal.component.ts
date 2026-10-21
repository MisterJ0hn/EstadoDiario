import { Component, EventEmitter, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import {
  CausaCorte,
  PjudApelacionesMovimientosResponse,
  PjudGeoreferencia,
  PjudPenalAnexoItem,
} from '@core/models/causa.model';
import { CausaService } from '../../services/causa.service';

type TabApelaciones = 'movimientos' | 'documentos' | 'liquidantes' | 'exhortos' | 'incompetencia';

/** Cada cuánto se pregunta, mientras el PJUD sincroniza, si ya terminó (mismo
 *  intervalo que usa `PjudPenalModalComponent`). */
const INTERVALO_POLL_MS = 5000;

/**
 * "Detalle Causa Corte de Apelaciones": la ficha del PJUD de una causa de la
 * hoja Corte Apelaciones, consultada EN VIVO a api-pjud.
 *
 * Gemelo de `PjudPenalModalComponent` (mismo panel gris, pestañas y flujo de
 * sincronización asíncrona). Cambia la clave de la causa (rol/era/corte, sin
 * cuadernos) y el contenido: Movimientos (con sala y georeferencia),
 * Documentos (texto del recurso y anexos de la causa), Liquidantes, Exhortos e
 * Incompetencia. Ver "solicitud apelaciones.md".
 *
 * El padre controla la apertura pasando la causa de corte; null = cerrado.
 */
@Component({
  selector: 'app-pjud-apelaciones-modal',
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
              <h3 class="text-lg font-semibold text-primary-700">Detalle Causa Corte de Apelaciones</h3>
              <p class="text-sm text-neutral-500">{{ causa.rol }}-{{ causa.era }} — {{ causa.corte }}</p>
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

                <!-- ── Vista: el recurso o el expediente de primera instancia ──── -->
                <div class="border-b border-neutral-200">
                  <nav class="tabs-nav">
                    <button class="tab-link" [class.tab-link-activo]="vista() === 'recurso'" (click)="vista.set('recurso')">Recurso</button>
                    <button class="tab-link" [class.tab-link-activo]="vista() === 'expediente'" (click)="vista.set('expediente')">Expediente Primera Instancia</button>
                  </nav>
                </div>

                @if (vista() === 'recurso') {
                <!-- ── Panel de datos de la causa ──── -->
                <div class="rounded-lg border border-neutral-200 bg-neutral-50">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1.5 px-4 py-3 text-sm">
                    <p><span class="pjud-k">Libro:</span> {{ c.libro || '-' }}</p>
                    <p><span class="pjud-k">Fecha:</span> {{ c.fecha || '-' }}</p>
                    <p><span class="pjud-k">Corte:</span> {{ c.corte || causa.corte }}</p>
                    <p><span class="pjud-k">Estado Recurso:</span> {{ c.estado_recurso || '-' }}</p>
                    <p><span class="pjud-k">Estado Procesal:</span> {{ c.estado_procesal || '-' }}</p>
                    <p><span class="pjud-k">Ubicación:</span> {{ c.ubicacion || '-' }}</p>
                    <p class="md:col-span-3"><span class="pjud-k">Recurso:</span> {{ c.recurso || '-' }}</p>
                  </div>

                  @if (c.certificado_envio || c.ebook) {
                    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-neutral-200 px-4 py-2.5 text-sm">
                      @if (c.certificado_envio; as ce) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">Certificado de Envío:</span>
                          <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: ce.url, color: ce.color }" />
                        </span>
                      }
                      @if (c.ebook; as eb) {
                        <span class="inline-flex items-center gap-1.5"><span class="pjud-k">eBook:</span>
                          <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: eb.url, color: eb.color }" />
                        </span>
                      }
                    </div>
                  }
                </div>

                <!-- ── Pestañas ──── -->
                <div class="border-b border-neutral-200">
                  <nav class="tabs-nav">
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'movimientos'" (click)="tab.set('movimientos')">
                      Movimientos <span class="tab-contador">{{ d.movimientos.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'documentos'" (click)="tab.set('documentos')">
                      Documentos <span class="tab-contador">{{ c.texto.length + c.anexo.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'liquidantes'" (click)="tab.set('liquidantes')">
                      Liquidantes <span class="tab-contador">{{ d.liquidantes.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'exhortos'" (click)="tab.set('exhortos')">
                      Exhortos <span class="tab-contador">{{ d.exhortos.length }}</span>
                    </button>
                    <button class="tab-link" [class.tab-link-activo]="tab() === 'incompetencia'" (click)="tab.set('incompetencia')">
                      Incompetencia <span class="tab-contador">{{ d.incompetencia.length }}</span>
                    </button>
                  </nav>
                </div>

                <div class="pt-1">
                  <!-- Movimientos -->
                  @if (tab() === 'movimientos') {
                    @if (d.movimientos.length === 0) {
                      <p class="text-sm text-neutral-500">
                        {{ d.estado === 'sincronizando'
                          ? 'El Poder Judicial todavía no entrega los movimientos.'
                          : 'El PJUD no registra movimientos en esta causa.' }}
                      </p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead>
                            <tr>
                              <th>Folio</th><th>Doc.</th><th>Anexo</th><th>Trámite</th>
                              <th>Descripción</th><th>Fecha</th><th>Sala</th><th>Estado</th><th>Geo</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (m of d.movimientos; track $index) {
                              <tr>
                                <td class="text-center">{{ m.folio ?? '-' }}</td>
                                <td class="text-center">
                                  @if (m.documentos.length > 0) {
                                    <span class="inline-flex items-center justify-center gap-2">
                                      @for (doc of m.documentos; track $index) {
                                        <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: doc.url, color: doc.color || ($index === 1 ? '#3b82f6' : null) }" />
                                      }
                                    </span>
                                  } @else { <span>-</span> }
                                </td>
                                <td class="text-center">
                                  @if (m.anexo.length > 0) {
                                    <button type="button" (click)="abrirAnexosTramite(m.anexo)"
                                            class="inline-flex items-center gap-1 text-amber-500 hover:text-amber-600"
                                            title="Ver anexos del movimiento">
                                      <ng-container *ngTemplateOutlet="iconoCarpeta" />
                                      <span class="text-xs font-semibold text-neutral-500">{{ m.anexo.length }}</span>
                                    </button>
                                  } @else { <span>-</span> }
                                </td>
                                <td class="whitespace-normal">{{ m.tramite || '-' }}</td>
                                <td class="whitespace-normal">{{ m.descripcion || '-' }}</td>
                                <td>{{ m.fecha || '-' }}</td>
                                <td>{{ m.sala || '-' }}</td>
                                <td>{{ m.estado || '-' }}</td>
                                <td class="text-center">
                                  @if (m.georeferencia) {
                                    <button type="button" (click)="abrirGeoreferencia(m.georeferencia)"
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

                  <!-- Documentos: texto del recurso y anexos de la causa -->
                  @if (tab() === 'documentos') {
                    @if (c.texto.length === 0 && c.anexo.length === 0) {
                      <p class="text-sm text-neutral-500">Sin documentos registrados.</p>
                    } @else {
                      @if (c.texto.length > 0) {
                        <p class="pjud-k mb-1">Texto</p>
                        <div class="overflow-x-auto rounded-lg border border-neutral-200">
                          <table class="pjud-table">
                            <thead><tr><th>Doc. principal</th><th>Doc.</th><th>Fecha</th><th>Referencia</th></tr></thead>
                            <tbody>
                              @for (t of c.texto; track $index) {
                                <tr>
                                  <td class="text-center">
                                    @if (t.doc_principal; as dp) {
                                      <span class="inline-flex items-center justify-center"
                                            [style.color]="dp.color || null"
                                            [title]="esPrincipal(dp.icono) ? 'Documento principal' : 'No es el documento principal'">
                                        @if (esPrincipal(dp.icono)) {
                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="h-4 w-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7" /></svg>
                                        } @else {
                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path stroke-linecap="round" d="m9 9 6 6m0-6-6 6" /></svg>
                                        }
                                      </span>
                                    } @else { <span>-</span> }
                                  </td>
                                  <td class="text-center">
                                    @if (t.doc; as td) {
                                      <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: td.url, color: td.color }" />
                                    } @else { <span>-</span> }
                                  </td>
                                  <td>{{ t.fecha || '-' }}</td>
                                  <td class="whitespace-normal">{{ t.referencia || '-' }}</td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      }
                      @if (c.anexo.length > 0) {
                        <p class="pjud-k mb-1 mt-4">Anexos</p>
                        <div class="overflow-x-auto rounded-lg border border-neutral-200">
                          <table class="pjud-table">
                            <thead><tr><th>Doc.</th><th>Código</th><th>Tipo Documento</th><th>Cantidad</th><th>Observación</th></tr></thead>
                            <tbody>
                              @for (a of c.anexo; track $index) {
                                <tr>
                                  <td class="text-center">
                                    @if (a.doc; as ad) {
                                      <ng-container *ngTemplateOutlet="enlacePdf; context: { $implicit: ad.url, color: ad.color }" />
                                    } @else { <span>-</span> }
                                  </td>
                                  <td>{{ a.codigo || '-' }}</td>
                                  <td class="whitespace-normal">{{ a.tipo_documento || '-' }}</td>
                                  <td>{{ a.cantidad || '-' }}</td>
                                  <td class="whitespace-normal">{{ a.observacion_documento || '-' }}</td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      }
                    }
                  }

                  <!-- Liquidantes -->
                  @if (tab() === 'liquidantes') {
                    @if (d.liquidantes.length === 0) {
                      <p class="text-sm text-neutral-500">Sin liquidantes registrados.</p>
                    } @else {
                      <div class="overflow-x-auto rounded-lg border border-neutral-200">
                        <table class="pjud-table">
                          <thead><tr><th>Sujeto</th><th>RUT</th><th>Persona</th><th>Nombre o Razón Social</th></tr></thead>
                          <tbody>
                            @for (l of d.liquidantes; track $index) {
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

                  <!-- Exhortos / Incompetencia: el proveedor aún no entrega un
                       ejemplo, así que se pintan genéricos con las claves que lleguen. -->
                  @if (tab() === 'exhortos') {
                    <ng-container *ngTemplateOutlet="tablaGenerica; context: { $implicit: d.exhortos, vacio: 'Sin exhortos registrados.' }" />
                  }
                  @if (tab() === 'incompetencia') {
                    <ng-container *ngTemplateOutlet="tablaGenerica; context: { $implicit: d.incompetencia, vacio: 'Sin incompetencias registradas.' }" />
                  }
                </div>
                }

                <!-- ── Expediente de primera instancia, y la causa de la cartera que le corresponde ──── -->
                @if (vista() === 'expediente') {
                @if (c.expediente_primera; as p) {
                  <div class="rounded-lg border border-neutral-200 bg-neutral-50">
                    <p class="border-b border-neutral-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                      Expediente primera instancia
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 px-4 py-3 text-sm">
                      <p class="flex items-center gap-1.5"><span class="pjud-k">Causa Origen:</span> {{ p.causa_origen || '-' }}
                        @if (d.causa_origen; as o) {
                          <button type="button" (click)="abrirCausaOrigen(o.id, o.rol)"
                                  class="inline-flex items-center text-primary-600 hover:text-primary-800"
                                  title="Abrir la causa en Mis Causas" aria-label="Abrir la causa en Mis Causas">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4" aria-hidden="true">
                              <circle cx="11" cy="11" r="7" /><path stroke-linecap="round" d="m20 20-3.5-3.5" />
                            </svg>
                          </button>
                        }
                      </p>
                      <p><span class="pjud-k">Tribunal:</span> {{ p.tribunal || '-' }}</p>
                      <p><span class="pjud-k">Caratulado:</span> {{ p.caratulado || '-' }}</p>
                      <p><span class="pjud-k">Materia:</span> {{ p.materia || '-' }}</p>
                    </div>
                    <p class="border-t border-neutral-200 px-4 py-2 text-sm">
                      @if (d.causa_origen; as o) {
                        <span class="badge-success">En tu cartera</span>
                        <span class="ml-2 text-neutral-700">{{ o.rol }} — {{ o.materia || 'Sin materia' }} — {{ o.tribunal }}</span>
                      } @else {
                        <span class="badge-neutral">No está en tu cartera</span>
                      }
                    </p>
                  </div>
                  } @else {
                    <p class="text-sm text-neutral-500">El PJUD no informa expediente de primera instancia.</p>
                  }
                }

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

      <!-- Tabla genérica para listas cuyas columnas no están definidas. -->
      <ng-template #tablaGenerica let-filas let-vacio="vacio">
        @if (filas.length === 0) {
          <p class="text-sm text-neutral-500">{{ vacio }}</p>
        } @else {
          <div class="overflow-x-auto rounded-lg border border-neutral-200">
            <table class="pjud-table">
              <thead>
                <tr>@for (col of columnas(filas); track col) { <th>{{ col }}</th> }</tr>
              </thead>
              <tbody>
                @for (fila of filas; track $index) {
                  <tr>@for (col of columnas(filas); track col) { <td class="whitespace-normal">{{ valor(fila[col]) }}</td> }</tr>
                }
              </tbody>
            </table>
          </div>
        }
      </ng-template>

      <!-- Anexos de un movimiento -->
      @if (anexosTramite(); as anexos) {
        <div class="modal-backdrop !z-[60]" (click)="anexosTramite.set(null)">
          <div class="modal-content !z-[70] !max-w-2xl" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="text-lg font-semibold text-primary-700">Anexos del movimiento</h3>
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

      <!-- ── Georeferencia de un movimiento ────────────────────────────
           Popup con tres pestañas: mapa (según latitud/longitud), imágenes
           (carrusel si hay más de una) y videos (por ahora siempre vacío). -->
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
                    <span><span class="pjud-k">Latitud:</span> {{ g.mapa?.latitud }}</span>
                    <span><span class="pjud-k">Longitud:</span> {{ g.mapa?.longitud }}</span>
                    @if (g.mapa?.corrector) {
                      <span><span class="pjud-k">Corrector:</span> {{ g.mapa?.corrector }}</span>
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
export class PjudApelacionesModalComponent implements OnDestroy {
  private service = inject(CausaService);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);

  private _causa: CausaCorte | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  @Input()
  set causa(c: CausaCorte | null) {
    this.detenerPolling();
    this._causa = c;
    if (c !== null) {
      this.tab.set('movimientos');
      this.vista.set('recurso');
      this.datos.set(null);
      this.anexosTramite.set(null);
      this.docError.set(null);
      this.georef.set(null);
      this.georefTab.set('mapa');
      this.imagenIdx.set(0);
      // Abrir el modal es lo que dispara el scrape si nunca se sincronizó; si
      // ya estaba lista, consultar basta (el botón "Actualizar" fuerza).
      this.cargar(c.id, false);
    }
  }
  get causa(): CausaCorte | null {
    return this._causa;
  }

  ngOnDestroy(): void {
    this.detenerPolling();
  }

  @Output() cerrado = new EventEmitter<void>();
  /** Cada consulta avisa el estado resultante para que el botón de Corte
   *  actualice su ícono sin recargar el listado. */
  @Output() estadoPjud = new EventEmitter<{ causaId: number; estado: PjudApelacionesMovimientosResponse['estado'] }>();

  cargando = signal(false);
  error = signal<string | null>(null);
  datos = signal<PjudApelacionesMovimientosResponse | null>(null);
  tab = signal<TabApelaciones>('movimientos');
  /** Vista superior: la causa de apelaciones o su expediente de primera instancia. */
  vista = signal<'recurso' | 'expediente'>('recurso');
  anexosTramite = signal<PjudPenalAnexoItem[] | null>(null);
  docError = signal<string | null>(null);

  /** Georeferencia del movimiento que se está mirando en el popup; `null` = cerrado. */
  georef = signal<PjudGeoreferencia | null>(null);
  georefTab = signal<'mapa' | 'imagenes' | 'videos'>('mapa');
  imagenIdx = signal(0);

  private cargar(corteId: number, forzar: boolean): void {
    this.detenerPolling();
    this.cargando.set(true);
    this.error.set(null);
    this.service.pjudApelaciones(corteId, forzar).subscribe({
      next: (res) => {
        this.datos.set(res);
        this.cargando.set(false);
        this.estadoPjud.emit({ causaId: corteId, estado: res.estado });
        if (res.estado === 'sincronizando') this.iniciarPolling(corteId);
      },
      error: (err) => {
        this.cargando.set(false);
        this.datos.set(null);
        this.error.set(err.error?.detail || 'No se pudo obtener el detalle desde el PJUD');
      },
    });
  }

  /** Mientras el modal siga abierto y el PJUD siga sincronizando, pregunta cada
   *  `INTERVALO_POLL_MS` (sin `forzar`, solo consulta el estado); se detiene al
   *  salir de 'sincronizando', al cerrar el modal o al disparar otra consulta. */
  private iniciarPolling(corteId: number): void {
    this.detenerPolling();
    this.pollTimer = setInterval(() => {
      this.service.pjudApelaciones(corteId, false).subscribe({
        next: (res) => {
          this.datos.set(res);
          this.estadoPjud.emit({ causaId: corteId, estado: res.estado });
          if (res.estado !== 'sincronizando') this.detenerPolling();
        },
        // Error de red en un tick: se sigue preguntando en el próximo.
        error: () => {},
      });
    }, INTERVALO_POLL_MS);
  }

  private detenerPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  actualizar(): void {
    if (this.causa) this.cargar(this.causa.id, true);
  }

  /** `doc_principal` llega con un ícono FontAwesome: `fa-check` es el
   *  documento principal y `fa-times-circle` el que no lo es. */
  esPrincipal(icono: string | null): boolean {
    return !!icono && icono.includes('check');
  }

  /** Columnas de una lista genérica: la unión de las claves de todas las filas. */
  columnas(filas: Record<string, unknown>[]): string[] {
    const claves = new Set<string>();
    for (const f of filas) Object.keys(f).forEach((k) => claves.add(k));
    return [...claves];
  }

  valor(v: unknown): string {
    if (v === null || v === undefined || v === '') return '-';
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
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
   * El backend baja el PDF del proveedor y lo reenvía https/inline; se pide
   * como blob y se navega la pestaña al objectURL.
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

  /** Lleva a Mis Causas y abre el detalle PJUD de la causa de la cartera que
   *  calza con el expediente de primera instancia (ver `CausasComponent`). */
  abrirCausaOrigen(id: number, rol: string | null): void {
    this.cerrar();
    this.router.navigate(['/causas'], { queryParams: { abrir: id, busqueda: rol || null } });
  }

  cerrar(): void {
    this.cerrado.emit();
  }
}
