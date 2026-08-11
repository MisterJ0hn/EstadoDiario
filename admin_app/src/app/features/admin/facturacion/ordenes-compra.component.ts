import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Cliente } from '@core/models/admin.model';
import { OrdenCompra } from '@core/models/orden-compra.model';
import { NotificationService } from '@core/services/notification.service';
import { formatearRut } from '@core/utils/rut';
import { AdminClienteService } from '../services/admin-cliente.service';
import { FacturacionService } from '../services/facturacion.service';

/**
 * Emisión y descarga de las órdenes de compra.
 *
 * Una orden cubre un rango de fechas y suma los **cierres mensuales** que caen
 * dentro. No recalcula: emitir dos veces el mismo rango da el mismo total. Por
 * eso el formulario puede fallar con "falta el cierre de marzo" — y eso no es
 * un error del formulario sino un mes que todavía nadie cerró.
 *
 * El listado y el formulario van en la misma pantalla porque son el mismo
 * gesto: se emite y se quiere ver que quedó, con su número.
 */
@Component({
  selector: 'app-ordenes-compra',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Órdenes de compra</h1>
        <p class="text-neutral-500 mt-1">
          Documento de cobro por rango de fechas, con el detalle mes a mes
        </p>
      </div>

      <!-- Emisión -->
      <div class="card">
        <div class="card-body space-y-4">
          <h2 class="text-sm font-semibold text-neutral-800">Emitir una orden</h2>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="md:col-span-2">
              <label class="form-label" for="o-cliente">Cliente</label>
              <select id="o-cliente" class="form-select" [(ngModel)]="clienteId">
                <option [ngValue]="0">Seleccione...</option>
                @for (c of clientes(); track c.id) {
                  <option [ngValue]="c.id">{{ c.nombre }} — {{ rutBonito(c.rut) }}</option>
                }
              </select>
            </div>
            <div>
              <label class="form-label" for="o-desde">Desde</label>
              <input id="o-desde" type="date" class="form-input" [(ngModel)]="desde" />
            </div>
            <div>
              <label class="form-label" for="o-hasta">Hasta</label>
              <input id="o-hasta" type="date" class="form-input" [(ngModel)]="hasta" />
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button type="button" class="btn-primary" (click)="emitir()" [disabled]="emitiendo()">
              {{ emitiendo() ? 'Emitiendo...' : 'Emitir orden de compra' }}
            </button>
            <p class="text-xs text-neutral-500">
              Se factura por <strong>mes completo</strong>: entra todo mes que se cruce con el
              rango, y cada uno tiene que estar cerrado.
            </p>
          </div>

          @if (errorEmision()) {
            <div class="alert-danger">
              <div class="flex-1">{{ errorEmision() }}</div>
            </div>
          }
        </div>
      </div>

      <!-- Listado -->
      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudieron cargar las órdenes.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">Reintentar</button>
        </div>
      } @else {
        <div class="card">
          <div class="card-body">
            @if (cargando()) {
              <div class="flex items-center justify-center py-16">
                <svg class="animate-spin h-8 w-8 text-primary-600" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span class="sr-only">Cargando órdenes</span>
              </div>
            } @else if (ordenes().length === 0) {
              <div class="py-16 text-center">
                <p class="text-neutral-600 font-medium">Todavía no se ha emitido ninguna orden</p>
                <p class="text-neutral-500 text-sm mt-1">
                  Elija un cliente y un rango de fechas arriba.
                </p>
              </div>
            } @else {
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold text-neutral-800">Emitidas</h2>
                <p class="text-sm text-neutral-500">
                  Total vigente:
                  <strong class="text-neutral-800">
                    {{ totalMonto() | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                  </strong>
                </p>
              </div>

              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th scope="col">N°</th>
                      <th scope="col">Cliente</th>
                      <th scope="col">Período facturado</th>
                      <th scope="col">Emitida</th>
                      <th scope="col">Total</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (o of ordenes(); track o.id) {
                      <tr [class.opacity-60]="o.anulada">
                        <td class="font-medium tabular-nums">{{ o.numero }}</td>
                        <td>
                          {{ o.razon_social }}
                          @if (o.anulada) {
                            <span class="badge-danger ml-2" [title]="o.motivo_anulacion || ''">Anulada</span>
                          }
                        </td>
                        <td class="whitespace-nowrap">
                          {{ o.fecha_desde | date: 'dd-MM-yyyy' }} al
                          {{ o.fecha_hasta | date: 'dd-MM-yyyy' }}
                          <span class="text-neutral-500 text-xs">({{ o.lineas.length }} mes(es))</span>
                        </td>
                        <td class="whitespace-nowrap">{{ o.fecha_emision | date: 'dd-MM-yyyy' }}</td>
                        <td class="tabular-nums font-semibold">
                          {{ o.total | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                        </td>
                        <td>
                          <div class="flex gap-2">
                            <button type="button" class="btn-outline btn-sm"
                                    (click)="descargar(o)" [disabled]="descargando() === o.id">
                              {{ descargando() === o.id ? 'Abriendo...' : 'PDF' }}
                            </button>
                            @if (!o.anulada) {
                              <button type="button" class="btn-secondary btn-sm" (click)="anular(o)">
                                Anular
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <p class="text-xs text-neutral-500 mt-3">
                El PDF se descarga tal como se emitió, no se vuelve a generar. Sale con la
                edición y la copia bloqueadas; la copia de referencia es la guardada acá.
                No constituye documento tributario del SII.
              </p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class OrdenesCompraComponent implements OnInit {
  private service = inject(FacturacionService);
  private clienteService = inject(AdminClienteService);
  private notification = inject(NotificationService);

  clientes = signal<Cliente[]>([]);
  ordenes = signal<OrdenCompra[]>([]);
  totalMonto = signal(0);

  cargando = signal(false);
  emitiendo = signal(false);
  descargando = signal<number | null>(null);
  error = signal<string | null>(null);
  errorEmision = signal<string | null>(null);

  clienteId = 0;
  desde = '';
  hasta = '';

  ngOnInit(): void {
    // El rango por defecto es el mes pasado: es el que se acaba de cerrar y
    // por lejos el que más se factura.
    const hoy = new Date();
    const primeroMesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const ultimoMesPasado = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    this.desde = this.aIso(primeroMesPasado);
    this.hasta = this.aIso(ultimoMesPasado);

    this.clienteService.list(1, 200).subscribe({
      next: (r) => this.clientes.set(r.clientes),
      error: () => this.notification.error('No se pudo cargar la lista de clientes'),
    });
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.listarOrdenes().subscribe({
      next: (r) => {
        this.ordenes.set(r.facturas);
        this.totalMonto.set(r.total_monto);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(this.mensajeError(e));
      },
    });
  }

  emitir(): void {
    this.errorEmision.set(null);
    if (!this.clienteId) {
      this.errorEmision.set('Elija un cliente.');
      return;
    }
    if (!this.desde || !this.hasta) {
      this.errorEmision.set('Indique el rango de fechas.');
      return;
    }
    if (this.hasta < this.desde) {
      this.errorEmision.set('La fecha "hasta" no puede ser anterior a "desde".');
      return;
    }

    this.emitiendo.set(true);
    this.service
      .emitirOrden({
        cliente_id: this.clienteId,
        fecha_desde: this.desde,
        fecha_hasta: this.hasta,
      })
      .subscribe({
        next: (o) => {
          this.emitiendo.set(false);
          this.notification.success(`Orden de compra ${o.numero} emitida`);
          this.cargar();
          // Se abre de inmediato: quien emite lo hace para mandarla, y el paso
          // siguiente es siempre tener el archivo.
          this.descargar(o);
        },
        error: (e) => {
          this.emitiendo.set(false);
          this.errorEmision.set(this.mensajeError(e));
        },
      });
  }

  descargar(orden: OrdenCompra): void {
    this.descargando.set(orden.id);
    this.service.descargarPdf(orden.id).subscribe({
      next: (blob) => {
        this.descargando.set(null);
        this.guardarArchivo(blob, `orden-compra-${orden.numero}.pdf`);
      },
      error: () => {
        this.descargando.set(null);
        this.notification.error('No se pudo descargar el PDF');
      },
    });
  }

  anular(orden: OrdenCompra): void {
    const motivo = prompt(
      `Anular la orden ${orden.numero}. La orden no se borra ni libera su número; ` +
        'queda marcada como anulada.\n\nMotivo:'
    );
    if (!motivo || !motivo.trim()) return;

    this.service.anularOrden(orden.id, motivo.trim()).subscribe({
      next: () => {
        this.notification.success(`Orden ${orden.numero} anulada`);
        this.cargar();
      },
      error: (e) => this.notification.error(this.mensajeError(e)),
    });
  }

  // ── Apoyo ────────────────────────────────────────────────────────────────

  rutBonito(rut: string): string {
    return formatearRut(rut);
  }

  private aIso(d: Date): string {
    const mes = `${d.getMonth() + 1}`.padStart(2, '0');
    const dia = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  /** Dispara la descarga del blob. Se revoca la URL: sin eso el navegador
   *  conserva el PDF entero en memoria hasta recargar la página. */
  private guardarArchivo(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  private mensajeError(err: unknown): string {
    const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const primero = detail[0] as { msg?: string };
      if (primero?.msg) return primero.msg;
    }
    return 'No se pudo completar la operación. Intente de nuevo.';
  }
}
