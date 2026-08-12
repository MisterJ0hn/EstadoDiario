import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EstadoFactura, Factura } from '@core/models/facturacion.model';
import { NotificationService } from '@core/services/notification.service';
import { formatearRut } from '@core/utils/rut';
import { FacturacionService } from '../services/facturacion.service';
import { guardarArchivo, mensajeError } from './facturas-list.component';
import { nombreMes } from './periodo';

/**
 * Detalle de una factura: qué se cobró y por qué.
 *
 * Es la pantalla a la que se llega cuando un cliente reclama, así que está
 * ordenada para responder en ese orden: quién es, de qué mes, y recién después
 * el desglose. El total va abajo y a la derecha del detalle, donde termina de
 * leerse la tabla, y no arriba: acá no se viene a mirar la cifra —esa ya se vio
 * en el listado— sino a entender de dónde sale.
 *
 * **Los datos del cliente son los del día que se emitió**, no los de hoy. Si el
 * estudio se cambió de dirección, esta factura sigue diciendo la anterior:
 * es lo que se imprimió y lo que el cliente tiene.
 */
@Component({
  selector: 'app-factura-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <a routerLink="/facturacion" class="text-sm text-primary-700 hover:underline">
          ← Volver a facturación
        </a>
      </div>

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudo cargar la factura.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">
            Reintentar
          </button>
        </div>
      } @else if (!factura()) {
        <div class="card animate-pulse">
          <div class="card-body h-64 bg-neutral-100 rounded-b-xl"></div>
        </div>
      } @else {
        <!-- El alias "as" no existe en un @else if, así que la rama va
             anidada: es la forma de tener "f" no nulo en todo el bloque. -->
        @if (factura(); as f) {
        <div class="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-neutral-800">Factura {{ f.numero }}</h1>
              <span [class]="claseEstado(f.estado)">{{ etiquetaEstado(f.estado) }}</span>
            </div>
            <p class="text-neutral-500 mt-1">
              {{ nombreMes(f.periodo) }} · generada el
              {{ f.fecha_emision | date: 'dd-MM-yyyy HH:mm' }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="btn-secondary btn-sm" (click)="descargar()"
                    [disabled]="descargando()">
              {{ descargando() ? 'Abriendo...' : 'Descargar PDF' }}
            </button>
            @if (!f.anulada) {
              <button type="button" class="btn-outline btn-sm" (click)="alternarPagada()"
                      [disabled]="guardando()">
                {{ f.estado === 'pagada' ? 'Marcar como no pagada' : 'Marcar como pagada' }}
              </button>
              <button type="button" class="btn-danger btn-sm" (click)="anular()"
                      [disabled]="guardando()">
                Anular
              </button>
            }
          </div>
        </div>

        @if (f.anulada) {
          <div class="alert-danger">
            <div class="flex-1">
              <p class="font-medium">Esta factura está anulada.</p>
              @if (f.motivo_anulacion) {
                <p class="text-sm mt-1">{{ f.motivo_anulacion }}</p>
              }
              <p class="text-sm mt-1">
                No se borró ni se liberó su número: un correlativo con huecos no se
                puede auditar, y el PDF que el cliente recibió existe igual.
              </p>
            </div>
          </div>
        }

        @if (f.origen_estado !== 'ok') {
          <div class="alert-warning">
            <div class="flex-1">
              <p class="font-medium">
                {{ f.origen_estado === 'sin_datos'
                    ? 'El cliente no tenía causas cargadas en este período.'
                    : 'La cartera de este período no se pudo consultar completa.' }}
              </p>
              @if (f.origen_detalle) {
                <p class="text-sm mt-1">{{ f.origen_detalle }}</p>
              }
            </div>
          </div>
        }

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Cliente y datos de la emisión -->
          <div class="space-y-6">
            <div class="card">
              <div class="card-header">
                <h2 class="text-sm font-semibold text-neutral-800">Cliente</h2>
              </div>
              <div class="card-body space-y-2 text-sm">
                <p class="font-medium text-neutral-800 text-base">{{ f.razon_social }}</p>
                <dl class="space-y-1">
                  <div class="flex gap-2">
                    <dt class="text-neutral-500 w-28 shrink-0">RUT</dt>
                    <dd class="tabular-nums">{{ rutBonito(f.rut) }}</dd>
                  </div>
                  <!-- Lo que no está no se imprime: una etiqueta con la línea
                       vacía al lado parece un dato perdido, y acá simplemente
                       no se había cargado. -->
                  @if (f.giro) {
                    <div class="flex gap-2">
                      <dt class="text-neutral-500 w-28 shrink-0">Giro</dt>
                      <dd>{{ f.giro }}</dd>
                    </div>
                  }
                  @if (f.direccion) {
                    <div class="flex gap-2">
                      <dt class="text-neutral-500 w-28 shrink-0">Dirección</dt>
                      <dd>{{ f.direccion }}</dd>
                    </div>
                  }
                  @if (ubicacion(); as lugar) {
                    <div class="flex gap-2">
                      <dt class="text-neutral-500 w-28 shrink-0">Comuna</dt>
                      <dd>{{ lugar }}</dd>
                    </div>
                  }
                  @if (f.correo) {
                    <div class="flex gap-2">
                      <dt class="text-neutral-500 w-28 shrink-0">Correo</dt>
                      <dd class="break-all">{{ f.correo }}</dd>
                    </div>
                  }
                </dl>
                <p class="text-xs text-neutral-500 pt-2 border-t border-neutral-100">
                  Datos tal como estaban al emitir. Si el cliente cambió después, esta
                  factura no cambia.
                </p>
                <a [routerLink]="['/clientes', f.cliente_id]"
                   class="text-primary-700 hover:underline inline-block pt-1">
                  Ver ficha del cliente →
                </a>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <h2 class="text-sm font-semibold text-neutral-800">Facturación</h2>
              </div>
              <div class="card-body text-sm">
                <dl class="space-y-1">
                  <div class="flex gap-2">
                    <dt class="text-neutral-500 w-28 shrink-0">N° factura</dt>
                    <dd class="tabular-nums font-medium">{{ f.numero }}</dd>
                  </div>
                  <div class="flex gap-2">
                    <dt class="text-neutral-500 w-28 shrink-0">Período</dt>
                    <dd>{{ nombreMes(f.periodo) }}</dd>
                  </div>
                  <div class="flex gap-2">
                    <dt class="text-neutral-500 w-28 shrink-0">Generada</dt>
                    <dd>{{ f.fecha_emision | date: 'dd-MM-yyyy HH:mm' }}</dd>
                  </div>
                  @if (f.emitida_por) {
                    <div class="flex gap-2">
                      <dt class="text-neutral-500 w-28 shrink-0">Emitida por</dt>
                      <dd>{{ f.emitida_por }}</dd>
                    </div>
                  }
                  <!-- De qué archivo salieron los números. Sin esto, un cliente
                       que dejó de cargar el Excel se ve igual que uno al día,
                       con la cartera de hace tres meses. -->
                  <div class="flex gap-2">
                    <dt class="text-neutral-500 w-28 shrink-0">Periodo</dt>
                    <dd>
                      {{ nombreMes(f.periodo) }}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <!-- Detalle -->
          <div class="lg:col-span-2">
            <div class="card">
              <div class="card-header flex items-center justify-between">
                <h2 class="text-sm font-semibold text-neutral-800">Detalle</h2>
                <a [routerLink]="['/clientes', f.cliente_id, 'tarifas']"
                   class="text-sm text-primary-700 hover:underline">
                  Tarifas del cliente
                </a>
              </div>
              <div class="card-body">
                @if (f.detalles.length === 0) {
                  <div class="py-12 text-center">
                    <p class="text-neutral-600 font-medium">Sin causas en el período</p>
                    <p class="text-neutral-500 text-sm mt-1">
                      La factura se emitió en cero.
                    </p>
                  </div>
                } @else {
                  <div class="table-wrapper">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Concepto</th>
                          <th scope="col" style="text-align:right!important">Cantidad</th>
                          <th scope="col" style="text-align:right!important">Valor U.</th>
                          <th scope="col" style="text-align:right!important">Valor total</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (d of f.detalles; track d.id) {
                          <tr>
                            <td class="font-medium">
                              {{ d.concepto }}
                              @if (d.tipo === 'corte') {
                                <span class="text-neutral-500 text-xs ml-1">(corte)</span>
                              }
                            </td>
                            <td class="tabular-nums" style="text-align:right!important">{{ d.cantidad }}</td>
                            <td class="tabular-nums" style="text-align:right!important">
                              {{ d.valor_unitario | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                            </td>
                            <td class="tabular-nums font-semibold" style="text-align:right!important">
                              {{ d.valor_total | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                            </td>
                          </tr>
                        }
                      </tbody>
                      <tfoot>
                        <tr class="border-t-2 border-neutral-200">
                          <td class="font-semibold text-neutral-800 py-3">Total</td>
                          <td class="tabular-nums font-semibold py-3" style="text-align:right!important">
                            {{ f.total_causas }}
                          </td>
                          <td></td>
                          <td class="tabular-nums py-3" style="text-align:right!important">
                            <span class="text-xl font-bold text-primary-700">
                              {{ f.total | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <p class="text-xs text-neutral-500 mt-4">
                    Los valores unitarios son los que estaban vigentes al generar la factura.
                    Cambiar hoy las tarifas del cliente no modifica este detalle.
                  </p>
                }
              </div>
            </div>
          </div>
        </div>
        }
      }
    </div>
  `,
})
export class FacturaDetalleComponent implements OnInit {
  private service = inject(FacturacionService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);

  factura = signal<Factura | null>(null);
  error = signal<string | null>(null);
  descargando = signal(false);
  guardando = signal(false);

  nombreMes = nombreMes;

  /** `Providencia, Santiago`, omitiendo lo que falte. */
  ubicacion = computed(() => {
    const f = this.factura();
    if (!f) return null;
    return [f.comuna, f.ciudad].filter(Boolean).join(', ') || null;
  });

  private id = 0;

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.cargar();
  }

  cargar(): void {
    this.error.set(null);
    this.service.obtener(this.id).subscribe({
      next: (f) => this.factura.set(f),
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  descargar(): void {
    const f = this.factura();
    if (!f) return;
    this.descargando.set(true);
    this.service.descargarPdf(f.id).subscribe({
      next: (blob) => {
        this.descargando.set(false);
        guardarArchivo(blob, `factura-${f.numero}.pdf`);
      },
      error: () => {
        this.descargando.set(false);
        this.notification.error('No se pudo descargar el PDF');
      },
    });
  }

  alternarPagada(): void {
    const f = this.factura();
    if (!f || this.guardando()) return;
    const pagada = f.estado !== 'pagada';
    this.guardando.set(true);
    this.service.marcarPagada(f.id, pagada).subscribe({
      next: (actualizada) => {
        this.guardando.set(false);
        this.factura.set(actualizada);
        this.notification.success(pagada ? 'Factura marcada como pagada' : 'Marca de pago quitada');
      },
      error: (e) => {
        this.guardando.set(false);
        this.notification.error(mensajeError(e));
      },
    });
  }

  anular(): void {
    const f = this.factura();
    if (!f || this.guardando()) return;
    const motivo = prompt(
      `Anular la factura ${f.numero}. No se borra ni libera su número; queda ` +
        'marcada como anulada.\n\nMotivo:'
    );
    if (!motivo || !motivo.trim()) return;

    this.guardando.set(true);
    this.service.anular(f.id, motivo.trim()).subscribe({
      next: (actualizada) => {
        this.guardando.set(false);
        this.factura.set(actualizada);
        this.notification.success(`Factura ${f.numero} anulada`);
      },
      error: (e) => {
        this.guardando.set(false);
        this.notification.error(mensajeError(e));
      },
    });
  }

  // ── Presentación ─────────────────────────────────────────────────────────

  rutBonito(rut: string): string {
    return rut && rut !== '—' ? formatearRut(rut) : rut;
  }

  etiquetaEstado(estado: EstadoFactura): string {
    return { emitida: 'Emitida', pagada: 'Pagada', anulada: 'Anulada' }[estado] ?? estado;
  }

  claseEstado(estado: EstadoFactura): string {
    return (
      { emitida: 'badge-info', pagada: 'badge-success', anulada: 'badge-danger' }[estado] ??
      'badge-neutral'
    );
  }
}
