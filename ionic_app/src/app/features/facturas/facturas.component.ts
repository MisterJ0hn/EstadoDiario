import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FacturaCliente } from '@core/models/factura.model';
import { NotificationService } from '@core/services/notification.service';
import { FacturaService } from './factura.service';

/**
 * Mis Facturas: lo que la plataforma le cobra a este estudio.
 *
 * **De solo lectura.** Generar, anular y marcar pagada viven en la consola de
 * administración y no tienen equivalente acá: el estudio es el destinatario del
 * documento, no quien lo emite.
 *
 * **Las últimas 12**, que es un año. El tope lo pone el backend; más atrás se
 * consulta puntualmente y no hojeando una tabla, así que no hay paginación.
 *
 * El detalle se abre por fila en vez de en otra pantalla: son siete líneas y la
 * pregunta ("¿por qué me cobraron esto?") se responde justo al lado del monto
 * que la disparó.
 */
@Component({
  selector: 'app-facturas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Mis Facturas</h1>
        <p class="text-neutral-500 mt-1">
          Lo que se le cobra a su estudio por su cartera de causas — últimas 12
        </p>
      </div>

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudieron cargar sus facturas.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">
            Reintentar
          </button>
        </div>
      } @else if (cargando()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span class="sr-only">Cargando facturas</span>
        </div>
      } @else if (facturas().length === 0) {
        <div class="card">
          <div class="card-body py-16 text-center">
            <p class="text-neutral-600 font-medium">Todavía no hay facturas emitidas</p>
            <p class="text-neutral-500 text-sm mt-1">
              La facturación se genera el día 1 de cada mes.
            </p>
          </div>
        </div>
      } @else {
        <div class="card">
          <div class="card-body">
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 class="text-sm font-semibold text-neutral-800">
                {{ facturas().length }} factura(s)
              </h2>
              <p class="text-sm text-neutral-500">
                Total cobrable:
                <strong class="text-neutral-800">
                  {{ totalMonto() | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                </strong>
              </p>
            </div>

            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col"><span class="sr-only">Detalle</span></th>
                    <th scope="col">N°</th>
                    <th scope="col">Período</th>
                    <th scope="col">Emitida</th>
                    <th scope="col" class="text-right">Causas</th>
                    <th scope="col" class="text-right">Total</th>
                    <th scope="col">Estado</th>
                    <th scope="col"><span class="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of facturas(); track f.id) {
                    <tr [class.opacity-60]="f.anulada">
                      <td>
                        <button type="button"
                                class="text-neutral-500 hover:text-neutral-800 px-1"
                                (click)="alternar(f.id)"
                                [attr.aria-expanded]="abierta() === f.id"
                                [attr.aria-label]="'Ver el detalle de la factura ' + f.numero">
                          {{ abierta() === f.id ? '▾' : '▸' }}
                        </button>
                      </td>
                      <td class="font-medium tabular-nums">{{ f.numero }}</td>
                      <td class="whitespace-nowrap">{{ nombreMes(f.periodo) }}</td>
                      <td class="whitespace-nowrap text-neutral-600">
                        {{ f.fecha_emision | date: 'dd-MM-yyyy' }}
                      </td>
                      <td class="tabular-nums text-right">{{ f.total_causas }}</td>
                      <td class="tabular-nums text-right font-semibold">
                        {{ f.total | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                      </td>
                      <td>
                        <span [class]="claseEstado(f.estado)"
                              [title]="f.motivo_anulacion || ''">
                          {{ etiquetaEstado(f.estado) }}
                        </span>
                      </td>
                      <td>
                        <div class="flex justify-end">
                          <button type="button" class="btn-outline btn-sm"
                                  (click)="descargar(f)" [disabled]="descargando() === f.id">
                            {{ descargando() === f.id ? '...' : 'PDF' }}
                          </button>
                        </div>
                      </td>
                    </tr>

                    @if (abierta() === f.id) {
                      <tr>
                        <td colspan="8" class="bg-neutral-50">
                          @if (f.detalles.length === 0) {
                            <p class="text-sm text-neutral-500 py-2">
                              Sin causas en la cartera de este período.
                            </p>
                          } @else {
                            <table class="w-full text-sm my-2">
                              <thead>
                                <tr class="text-neutral-500">
                                  <th scope="col" class="text-left font-medium py-1">Concepto</th>
                                  <th scope="col" class="text-right font-medium py-1">Cantidad</th>
                                  <th scope="col" class="text-right font-medium py-1">Valor U.</th>
                                  <th scope="col" class="text-right font-medium py-1">Valor total</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (d of f.detalles; track d.concepto) {
                                  <tr>
                                    <td class="py-1">{{ d.concepto }}</td>
                                    <td class="py-1 text-right tabular-nums">{{ d.cantidad }}</td>
                                    <td class="py-1 text-right tabular-nums">
                                      {{ d.valor_unitario | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                                    </td>
                                    <td class="py-1 text-right tabular-nums font-medium">
                                      {{ d.valor_total | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                                    </td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                            <p class="text-xs text-neutral-500 pb-2">
                              Los valores son los que estaban vigentes cuando se emitió la
                              factura.
                            </p>
                          }
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>

            <p class="text-xs text-neutral-500 mt-3">
              El PDF se descarga tal como se emitió. No constituye documento tributario
              del SII.
            </p>
          </div>
        </div>
      }
    </div>
  `,
})
export class FacturasComponent implements OnInit {
  private service = inject(FacturaService);
  private notification = inject(NotificationService);

  facturas = signal<FacturaCliente[]>([]);
  totalMonto = signal(0);
  cargando = signal(true);
  error = signal<string | null>(null);
  descargando = signal<number | null>(null);
  /** Qué fila tiene el detalle abierto. Una sola: son largas. */
  abierta = signal<number | null>(null);

  private readonly MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.listar().subscribe({
      next: (r) => {
        this.facturas.set(r.facturas);
        this.totalMonto.set(r.total_monto);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('Intente de nuevo en unos momentos.');
      },
    });
  }

  alternar(id: number): void {
    this.abierta.set(this.abierta() === id ? null : id);
  }

  descargar(factura: FacturaCliente): void {
    this.descargando.set(factura.id);
    this.service.descargarPdf(factura.id).subscribe({
      next: (blob) => {
        this.descargando.set(null);
        // Se revoca la URL: sin eso el navegador conserva el PDF entero en
        // memoria hasta recargar la página.
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `factura-${factura.numero}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.descargando.set(null);
        this.notification.error('No se pudo descargar el PDF');
      },
    });
  }

  /** `2026-07-01` → `julio 2026`. Sin pasar por Date, que desplaza el día. */
  nombreMes(periodo: string | null): string {
    if (!periodo) return '—';
    const [anio, mes] = periodo.split('-');
    return `${this.MESES[Number(mes) - 1] ?? mes} ${anio}`;
  }

  etiquetaEstado(estado: string): string {
    return { emitida: 'Emitida', pagada: 'Pagada', anulada: 'Anulada' }[estado] ?? estado;
  }

  claseEstado(estado: string): string {
    return (
      { emitida: 'badge-info', pagada: 'badge-success', anulada: 'badge-danger' }[estado] ??
      'badge-neutral'
    );
  }
}
