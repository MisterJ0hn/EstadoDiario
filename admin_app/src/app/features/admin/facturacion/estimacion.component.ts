import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { EstimacionCliente, EstimacionPeriodo } from '@core/models/facturacion.model';
import { NotificationService } from '@core/services/notification.service';
import { formatearRut } from '@core/utils/rut';
import { FacturacionService } from '../services/facturacion.service';
import { mensajeError } from './facturas-list.component';
import { nombreMes } from './periodo';

/**
 * Cuánto va a salir la facturación: la vista previa del período.
 *
 * **Por qué existe.** Las facturas se generan el día 1, así que entre el 2 y el
 * 31 no hay ninguna del mes en curso y la pregunta que igual se hace es cuánto
 * se va a cobrar. Esta pantalla la responde contando la cartera al momento y
 * aplicando las tarifas de cada cliente, **sin escribir nada**.
 *
 * Los números pueden cambiar hasta la generación: la cartera de un cliente se
 * mueve cada vez que carga el Excel de causas. La pantalla lo dice en vez de
 * presentar la estimación como si fuera una factura, que es lo que llevaría a
 * discutir un monto que todavía no existe.
 *
 * La tabla se ordena por monto y no alfabéticamente: se abre para ver cuánto se
 * va a facturar, y el que más pesa va arriba.
 */
@Component({
  selector: 'app-estimacion-facturacion',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <a routerLink="/facturacion" class="text-sm text-primary-700 hover:underline">
          ← Volver a facturación
        </a>
      </div>

      <div class="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Estimación del período</h1>
          <p class="text-neutral-500 mt-1">
            Lo que saldría si se facturara ahora, cliente por cliente
          </p>
        </div>
        @if (datos(); as d) {
          <button type="button" class="btn-primary btn-sm" (click)="generar()"
                  [disabled]="generando()">
            {{ generando() ? 'Generando...' : 'Generar ' + nombreMes(d.periodo) }}
          </button>
        }
      </div>

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudo calcular la estimación.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">
            Reintentar
          </button>
        </div>
      } @else if (!datos()) {
        <div class="card animate-pulse">
          <div class="card-body h-64 bg-neutral-100 rounded-b-xl"></div>
        </div>
      } @else {
        <!-- El alias "as" no existe en un @else if, así que la rama va
             anidada: es la forma de tener "d" no nulo en todo el bloque. -->
        @if (datos(); as d) {
        <div class="alert-warning">
          <div class="flex-1">
            <p class="font-medium">Estos números todavía no son una factura.</p>
            <p class="text-sm mt-1">
              Se contaron recién y pueden cambiar: la cartera de un cliente se mueve cada
              vez que carga el Excel de causas. La facturación de
              {{ nombreMes(d.periodo) }} la toma automáticamente el job del día 1.
            </p>
          </div>
        </div>

        @if (d.ya_generado) {
          <div class="alert-info">
            <div class="flex-1">
              <p class="font-medium">
                {{ nombreMes(d.periodo) }} ya tiene facturas emitidas.
              </p>
              <p class="text-sm mt-1">
                Lo de abajo es un recuento de hoy, no lo que se cobró. Las facturas
                emitidas están en el
                <a routerLink="/facturacion" class="underline">listado</a>.
              </p>
            </div>
          </div>
        }

        @if (d.clientes_con_error > 0) {
          <div class="alert-danger">
            <div class="flex-1">
              <p class="font-medium">
                {{ d.clientes_con_error }} cliente(s) no se pudieron consultar.
              </p>
              <p class="text-sm mt-1">
                Sus filas van en cero, que no es lo mismo que no tener causas. Al generar
                el período no se les emitirá factura: revise su base de datos primero.
              </p>
            </div>
          </div>
        }

        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="card">
            <div class="card-body">
              <p class="text-sm text-neutral-500">Estimado a facturar</p>
              <p class="text-3xl font-bold text-primary-700 tabular-nums mt-1">
                {{ d.total_monto | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
              </p>
              <p class="text-xs text-neutral-500 mt-1">{{ d.total_clientes }} clientes</p>
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <p class="text-sm text-neutral-500">Causas en cartera</p>
              <p class="text-2xl font-semibold text-neutral-800 tabular-nums mt-1">
                {{ d.total_causas }}
              </p>
              <p class="text-xs text-neutral-500 mt-1">Vigentes, más las de corte</p>
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <p class="text-sm text-neutral-500">Período</p>
              <p class="text-2xl font-semibold text-neutral-800 mt-1">
                {{ nombreMes(d.periodo) }}
              </p>
              <p class="text-xs text-neutral-500 mt-1">El mes que se va a facturar</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            @if (d.clientes.length === 0) {
              <div class="py-16 text-center">
                <p class="text-neutral-600 font-medium">No hay clientes que facturar</p>
              </div>
            } @else {
              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th scope="col"><span class="sr-only">Desglose</span></th>
                      <th scope="col">Cliente</th>
                      <th scope="col">RUT</th>
                      <th scope="col" style="text-align:right!important">Causas</th>
                      <th scope="col" style="text-align:right!important">Estimado</th>
                      <th scope="col">Cartera del</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of d.clientes; track c.cliente_id) {
                      <tr>
                        <td>
                          <!-- El desglose por materia se abre por fila: en la
                               tabla plana serían cinco columnas por cliente que
                               casi nunca se miran, y acá se mira justo la del
                               cliente que se está revisando. -->
                          <button type="button"
                                  class="text-neutral-500 hover:text-neutral-800 px-1"
                                  (click)="alternar(c.cliente_id)"
                                  [attr.aria-expanded]="abierto() === c.cliente_id"
                                  [attr.aria-label]="'Ver desglose de ' + c.cliente_nombre">
                            {{ abierto() === c.cliente_id ? '▾' : '▸' }}
                          </button>
                        </td>
                        <td class="font-medium">
                          <a [routerLink]="['/clientes', c.cliente_id]"
                             class="text-primary-700 hover:underline">
                            {{ c.cliente_nombre }}
                          </a>
                          @if (!c.cliente_activo) {
                            <span class="badge-neutral ml-2">Inactivo</span>
                          }
                          @if (c.origen_estado !== 'ok') {
                            <span [class]="c.origen_estado === 'error' ? 'badge-danger ml-2' : 'badge-warning ml-2'"
                                  [title]="c.origen_detalle || ''">
                              {{ c.origen_estado === 'error' ? 'Sin consultar' : 'Sin causas' }}
                            </span>
                          }
                        </td>
                        <td class="tabular-nums whitespace-nowrap">{{ rutBonito(c.cliente_rut) }}</td>
                        <td class="tabular-nums" style="text-align:right!important">{{ c.total_causas }}</td>
                        <td class="tabular-nums font-semibold" style="text-align:right!important">
                          {{ c.total | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                        </td>
                        <td class="text-neutral-600 whitespace-nowrap">
                          {{ c.fecha_archivo_causas
                              ? (c.fecha_archivo_causas | date: 'dd-MM-yyyy')
                              : '—' }}
                        </td>
                      </tr>

                      @if (abierto() === c.cliente_id) {
                        <tr>
                          <td colspan="6" class="bg-neutral-50">
                            @if (c.detalles.length === 0) {
                              <p class="text-sm text-neutral-500 py-2">
                                Sin causas que facturar en este momento.
                              </p>
                            } @else {
                              <table class="w-full text-sm my-2">
                                <thead>
                                  <tr class="text-neutral-500">
                                    <th scope="col" class="text-left font-medium py-1">Concepto</th>
                                    <th scope="col" class="font-medium py-1" style="text-align:right!important">Cantidad</th>
                                    <th scope="col" class="font-medium py-1" style="text-align:right!important">Valor U.</th>
                                    <th scope="col" class="font-medium py-1" style="text-align:right!important">Valor total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (l of c.detalles; track l.concepto) {
                                    <tr>
                                      <td class="py-1">{{ l.concepto }}</td>
                                      <td class="py-1 tabular-nums" style="text-align:right!important">{{ l.cantidad }}</td>
                                      <td class="py-1 tabular-nums" style="text-align:right!important">
                                        {{ l.valor_unitario | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                                      </td>
                                      <td class="py-1 tabular-nums font-medium" style="text-align:right!important">
                                        {{ l.valor_total | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                                      </td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                              <a [routerLink]="['/clientes', c.cliente_id, 'tarifas']"
                                 class="text-sm text-primary-700 hover:underline">
                                Ajustar las tarifas de este cliente →
                              </a>
                            }
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
        }
      }
    </div>
  `,
})
export class EstimacionComponent implements OnInit {
  private service = inject(FacturacionService);
  private notification = inject(NotificationService);

  datos = signal<EstimacionPeriodo | null>(null);
  error = signal<string | null>(null);
  generando = signal(false);
  /** Qué fila tiene el desglose abierto. Una sola: son largas. */
  abierto = signal<number | null>(null);

  nombreMes = nombreMes;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.error.set(null);
    this.service.estimacion().subscribe({
      next: (d) => this.datos.set(d),
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  alternar(clienteId: number): void {
    this.abierto.set(this.abierto() === clienteId ? null : clienteId);
  }

  generar(): void {
    const d = this.datos();
    if (!d || this.generando()) return;
    if (
      !confirm(
        `Se emitirá la factura de ${nombreMes(d.periodo)} para cada cliente que ` +
          'todavía no la tenga. Los montos quedan congelados: no se recalculan ' +
          'después.\n\n¿Continuar?'
      )
    ) {
      return;
    }

    this.generando.set(true);
    this.service.generar({ periodo: d.periodo }).subscribe({
      next: (r) => {
        this.generando.set(false);
        this.notification.success(
          `${r.generadas} factura(s) generada(s)` +
            (r.con_error.length ? `; ${r.con_error.length} cliente(s) con error` : '')
        );
        this.cargar();
      },
      error: (e) => {
        this.generando.set(false);
        this.notification.error(mensajeError(e));
      },
    });
  }

  rutBonito(rut: string): string {
    return rut && rut !== '—' ? formatearRut(rut) : rut;
  }
}
