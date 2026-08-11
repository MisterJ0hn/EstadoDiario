import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { FacturacionPeriodo } from '@core/models/facturacion.model';
import { NotificationService } from '@core/services/notification.service';
import { formatearRut } from '@core/utils/rut';
import { FacturacionService } from '../services/facturacion.service';

/**
 * Facturación de la plataforma.
 *
 * **Qué se cobra**: $1 por causa de materia vigente, $2 por causa de Corte de
 * Apelaciones y $3 por causa de Corte Suprema, sobre el último archivo de
 * causas que cargó cada cliente.
 *
 * **Por qué hay dos clases de período.** El día 1 un job congela el mes que
 * terminó y esa fila ya no cambia: la cartera es una foto que se reemplaza con
 * cada carga del Excel, así que un mes viejo no se puede recalcular. Pero la
 * pregunta que más se hace acá es "cuánto va a salir la factura", en mitad del
 * mes, cuando todavía no hay nada cerrado. Por eso un período sin cierre se
 * muestra igual, contado al momento y marcado como estimación.
 *
 * La tabla se ordena por monto y no alfabéticamente: la pantalla se abre para
 * ver cuánto se factura, y el que más pesa va arriba.
 */
@Component({
  selector: 'app-facturacion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div class="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Facturación</h1>
          <p class="text-neutral-500 mt-1">
            Lo que se le cobra a cada cliente por su cartera de causas
          </p>
        </div>

        @if (datos(); as d) {
          <div class="flex items-end gap-3">
            <div>
              <label class="form-label" for="periodo">Período</label>
              <select id="periodo" class="form-select w-auto" [ngModel]="periodoElegido()"
                      (ngModelChange)="elegirPeriodo($event)" [disabled]="cargando()">
                <!-- El período en curso no está entre los ya cerrados (no
                     tiene cierre) pero tiene que poder elegirse: es el que se
                     mira el resto del mes. -->
                @for (p of opcionesPeriodo(); track p) {
                  <option [ngValue]="p">{{ nombreMes(p) }}</option>
                }
              </select>
            </div>
            @if (d.es_estimacion) {
              <button type="button" class="btn-primary" (click)="cerrar()" [disabled]="cerrando()">
                {{ cerrando() ? 'Cerrando...' : 'Cerrar período' }}
              </button>
            }
          </div>
        }
      </div>

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudo cargar la facturación.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">Reintentar</button>
        </div>
      } @else if (!datos()) {
        <div class="card animate-pulse">
          <div class="card-body h-64 bg-neutral-100 rounded-b-xl"></div>
        </div>
      } @else {
        <!-- El alias "as" no existe en un @else if, así que la rama va
             anidada: es la forma de tener "d" no nulo en todo el bloque. -->
        @if (datos(); as d) {
        @if (d.es_estimacion) {
          <div class="alert-warning">
            <div class="flex-1">
              <p class="font-medium">Este período todavía no se ha cerrado.</p>
              <p class="text-sm mt-1">
                Los números se contaron recién y pueden cambiar: la cartera de un cliente
                se mueve cada vez que carga el Excel de causas. El cierre lo toma
                automáticamente el día 1 de cada mes.
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
                Sus filas van en cero, que no es lo mismo que no tener causas. Revise su base
                de datos y vuelva a cerrar el período el mismo día.
              </p>
            </div>
          </div>
        }

        <!-- Totales del período. El monto va primero y más grande: es la única
             cifra que se busca al abrir la pantalla. -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="card">
            <div class="card-body">
              <p class="text-sm text-neutral-500">Total a facturar</p>
              <p class="text-3xl font-bold text-primary-700 tabular-nums mt-1">
                {{ d.total_monto | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
              </p>
              <p class="text-xs text-neutral-500 mt-1">{{ d.total_clientes }} clientes</p>
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <p class="text-sm text-neutral-500">Causas por materia</p>
              <p class="text-2xl font-semibold text-neutral-800 tabular-nums mt-1">
                {{ d.total_causas_materia }}
              </p>
              <p class="text-xs text-neutral-500 mt-1">$1 c/u — solo las vigentes</p>
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <p class="text-sm text-neutral-500">Corte de Apelaciones</p>
              <p class="text-2xl font-semibold text-neutral-800 tabular-nums mt-1">
                {{ d.total_cortes_apelaciones }}
              </p>
              <p class="text-xs text-neutral-500 mt-1">$2 c/u</p>
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <p class="text-sm text-neutral-500">Corte Suprema</p>
              <p class="text-2xl font-semibold text-neutral-800 tabular-nums mt-1">
                {{ d.total_cortes_suprema }}
              </p>
              <p class="text-xs text-neutral-500 mt-1">$3 c/u</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            @if (d.cierres.length === 0) {
              <div class="py-16 text-center">
                <p class="text-neutral-600 font-medium">No hay nada que facturar en este período</p>
                <p class="text-neutral-500 text-sm mt-1">
                  Ningún cliente tiene causas cargadas.
                </p>
              </div>
            } @else {
              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Cliente</th>
                      <th scope="col">RUT</th>
                      <th scope="col">Materia</th>
                      <th scope="col">Apelaciones</th>
                      <th scope="col">Suprema</th>
                      <th scope="col">Monto</th>
                      <th scope="col">Cartera del</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of d.cierres; track c.cliente_id) {
                      <tr>
                        <td class="font-medium">
                          <a [routerLink]="['/clientes', c.cliente_id]"
                             class="text-primary-700 hover:underline">
                            {{ c.cliente_nombre }}
                          </a>
                          @if (c.estado !== 'ok') {
                            <span [class]="c.estado === 'error' ? 'badge-danger ml-2' : 'badge-neutral ml-2'"
                                  [title]="c.detalle || ''">
                              {{ c.estado === 'error' ? 'Sin consultar' : 'Sin causas' }}
                            </span>
                          }
                        </td>
                        <td class="tabular-nums">{{ rutBonito(c.cliente_rut) }}</td>
                        <td class="tabular-nums">{{ c.causas_materia }}</td>
                        <td class="tabular-nums">{{ c.cortes_apelaciones }}</td>
                        <td class="tabular-nums">{{ c.cortes_suprema }}</td>
                        <td class="tabular-nums font-semibold">
                          {{ c.monto | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                        </td>
                        <!-- De qué archivo salieron los números: sin esto, un
                             cliente que dejó de cargar el Excel se ve igual que
                             uno al día, con la cartera de hace tres meses. -->
                        <td class="text-neutral-600 whitespace-nowrap">
                          {{ c.fecha_archivo_causas ? (c.fecha_archivo_causas | date: 'dd-MM-yyyy') : '—' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              @if (!d.es_estimacion && fechaCierre(); as cerrado) {
                <p class="text-xs text-neutral-500 mt-3">
                  Período cerrado el {{ cerrado | date: 'dd-MM-yyyy HH:mm' }}. Estos montos ya
                  no cambian aunque la cartera de un cliente se mueva.
                </p>
              }
            }
          </div>
        </div>
        }
      }
    </div>
  `,
})
export class FacturacionComponent implements OnInit {
  private service = inject(FacturacionService);
  private notification = inject(NotificationService);

  datos = signal<FacturacionPeriodo | null>(null);
  cargando = signal(false);
  cerrando = signal(false);
  error = signal<string | null>(null);

  /** Qué período se está mirando, como ISO del primer día del mes. */
  periodoElegido = signal<string>('');

  /**
   * Los períodos del selector: los que tienen cierre, más el mes en curso y el
   * anterior.
   *
   * Los dos últimos se agregan a mano porque el backend solo lista lo cerrado,
   * y sin ellos no habría forma de pedir una estimación del mes que corre —que
   * es justo para lo que se abre esta pantalla entre cierre y cierre.
   */
  opcionesPeriodo = computed(() => {
    const disponibles = this.datos()?.periodos_disponibles ?? [];
    const abiertos = [this.mesDe(0), this.mesDe(-1)];
    const elegido = this.periodoElegido();
    const todos = [...abiertos, ...disponibles, ...(elegido ? [elegido] : [])];
    // Sin repetir y del más nuevo al más viejo, que es el orden en que se
    // consultan.
    return [...new Set(todos)].sort().reverse();
  });

  fechaCierre = computed(() => this.datos()?.cierres[0]?.fecha_cierre ?? null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.periodo(this.periodoElegido() || undefined).subscribe({
      next: (d) => {
        this.datos.set(d);
        // El backend decide cuál período respondió cuando no se pidió ninguno:
        // el selector tiene que quedar en ese, no en uno inventado acá.
        this.periodoElegido.set(d.periodo);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(this.mensajeError(e));
      },
    });
  }

  elegirPeriodo(periodo: string): void {
    if (periodo === this.periodoElegido()) return;
    this.periodoElegido.set(periodo);
    this.cargar();
  }

  cerrar(): void {
    if (this.cerrando()) return;
    if (
      !confirm(
        'Cerrar el período congela estos montos: se facturan tal como están ahora y ' +
          'no se recalculan después. ¿Continuar?'
      )
    ) {
      return;
    }

    this.cerrando.set(true);
    this.service.cerrar({ periodo: this.periodoElegido() }).subscribe({
      next: (d) => {
        this.cerrando.set(false);
        this.datos.set(d);
        this.notification.success('Período cerrado');
      },
      error: (e) => {
        this.cerrando.set(false);
        this.notification.error(this.mensajeError(e));
      },
    });
  }

  // ── Presentación ─────────────────────────────────────────────────────────

  rutBonito(rut: string): string {
    return rut && rut !== '—' ? formatearRut(rut) : rut;
  }

  /** `2026-07-01` → `julio 2026`. Sin pasar por Date, que desplaza el día. */
  nombreMes(periodo: string): string {
    const [anio, mes] = periodo.split('-');
    const nombres = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    const nombre = nombres[Number(mes) - 1] ?? mes;
    return `${nombre} ${anio}`;
  }

  /** El primer día del mes, `desplazamiento` meses desde hoy. */
  private mesDe(desplazamiento: number): string {
    const hoy = new Date();
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + desplazamiento, 1);
    const mes = `${d.getMonth() + 1}`.padStart(2, '0');
    return `${d.getFullYear()}-${mes}-01`;
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
