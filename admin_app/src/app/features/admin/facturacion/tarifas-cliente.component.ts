import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Tarifa, TarifasCliente } from '@core/models/facturacion.model';
import { NotificationService } from '@core/services/notification.service';
import { FacturacionService } from '../services/facturacion.service';
import { mensajeError } from './facturas-list.component';

/**
 * Tarifas de un cliente: cuánto se le cobra por cada concepto.
 *
 * **Un concepto sin configurar no vale $0**: se cobra el valor de la
 * plataforma. La pantalla muestra las dos cosas —lo acordado y lo que se
 * aplicaría sin acordar nada— porque son la misma pregunta con dos respuestas
 * distintas, y una tabla que siempre trae tres filas borra la diferencia entre
 * "a este cliente se le negoció $2" y "a este se le cobra lo de siempre".
 *
 * **Cambiar una tarifa no toca ninguna factura ya emitida.** Cada factura
 * guarda el valor unitario que usó, así que lo de acá rige desde la próxima
 * generación. Se dice en pantalla: es lo primero que se pregunta al subir un
 * precio.
 */
@Component({
  selector: 'app-tarifas-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <a [routerLink]="['/clientes', clienteId]" class="text-sm text-primary-700 hover:underline">
          ← Volver a la ficha del cliente
        </a>
      </div>

      <div class="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Tarifas de facturación</h1>
          <p class="text-neutral-500 mt-1">
            {{ datos()?.cliente_nombre || 'Cargando...' }}
          </p>
        </div>
        <a [routerLink]="['/facturacion']" [queryParams]="{ cliente: clienteId }"
           class="btn-outline btn-sm">
          Ver sus facturas
        </a>
      </div>

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudieron cargar las tarifas.</p>
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
        <div class="alert-info">
          <div class="flex-1">
            <p class="text-sm">
              Lo que se fije acá rige <strong>desde la próxima facturación</strong>. Las
              facturas ya emitidas guardan el valor que usaron y no cambian.
            </p>
          </div>
        </div>

        <!-- Los tres conceptos base, siempre visibles. Es la vista que responde
             "cuánto se le cobra a este cliente" sin tener que saber que la
             ausencia de una fila significa algo. -->
        <div class="card">
          <div class="card-header">
            <h2 class="text-sm font-semibold text-neutral-800">Valores por concepto</h2>
          </div>
          <div class="card-body">
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">Concepto</th>
                    <th scope="col" style="text-align:right!important">Valor por causa</th>
                    <th scope="col">Origen</th>
                    <th scope="col"><span class="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (b of base(); track b.concepto) {
                    <tr>
                      <td class="font-medium">{{ b.etiqueta }}</td>
                      <td class="tabular-nums font-semibold" style="text-align:right!important">
                        {{ b.valor | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                      </td>
                      <td>
                        @if (b.tarifa) {
                          <span class="badge-info">Acordado con el cliente</span>
                        } @else {
                          <span class="badge-neutral">Valor de la plataforma</span>
                        }
                      </td>
                      <td>
                        <div class="flex gap-2 justify-end">
                          <button type="button" class="btn-outline btn-sm"
                                  (click)="editar(b.concepto, b.valor)">
                            {{ b.tarifa ? 'Cambiar' : 'Fijar valor propio' }}
                          </button>
                          @if (b.tarifa) {
                            <button type="button" class="btn-secondary btn-sm"
                                    (click)="quitar(b.tarifa!)">
                              Usar el de plataforma
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Excepciones por materia. Es lo raro, así que va aparte y se explica:
             mezclarlas con los tres conceptos base haría parecer que hay que
             enumerar las cinco materias para facturar bien. -->
        <div class="card">
          <div class="card-header">
            <h2 class="text-sm font-semibold text-neutral-800">Excepciones por materia</h2>
          </div>
          <div class="card-body space-y-4">
            <p class="text-sm text-neutral-500">
              Solo si a este cliente se le cobra distinto <em>una</em> materia. El resto
              sigue con el valor de "Causas por materia" de arriba.
            </p>

            @if (excepciones().length) {
              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Materia</th>
                      <th scope="col" style="text-align:right!important">Valor por causa</th>
                      <th scope="col">Estado</th>
                      <th scope="col"><span class="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (t of excepciones(); track t.id) {
                      <tr [class.opacity-60]="!t.activo">
                        <td class="font-medium">{{ nombreMateria(t.concepto) }}</td>
                        <td class="tabular-nums font-semibold" style="text-align:right!important">
                          {{ t.valor_unitario | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                        </td>
                        <td>
                          @if (t.activo) {
                            <span class="badge-success">Activa</span>
                          } @else {
                            <span class="badge-neutral">Desactivada</span>
                          }
                        </td>
                        <td>
                          <div class="flex gap-2 justify-end">
                            <button type="button" class="btn-outline btn-sm"
                                    (click)="editar(t.concepto, t.valor_unitario)">
                              Cambiar
                            </button>
                            <button type="button" class="btn-secondary btn-sm"
                                    (click)="alternarActiva(t)">
                              {{ t.activo ? 'Desactivar' : 'Activar' }}
                            </button>
                            <button type="button" class="btn-danger btn-sm" (click)="quitar(t)">
                              Quitar
                            </button>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="text-sm text-neutral-600">
                Sin excepciones: todas las materias se cobran igual.
              </p>
            }

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-neutral-100">
              <div class="md:col-span-1">
                <label class="form-label" for="e-materia">Materia</label>
                <input id="e-materia" type="text" class="form-input" [(ngModel)]="nuevaMateria"
                       placeholder="Familia" />
              </div>
              <div>
                <label class="form-label" for="e-valor">Valor por causa</label>
                <input id="e-valor" type="number" min="0" step="1" class="form-input"
                       [(ngModel)]="nuevoValor" />
              </div>
              <div class="flex items-end">
                <button type="button" class="btn-primary" (click)="agregarExcepcion()"
                        [disabled]="guardando()">
                  Agregar excepción
                </button>
              </div>
            </div>
            <p class="text-xs text-neutral-500">
              El nombre tiene que coincidir con el de la hoja del Excel de Causas
              (Civil, Cobranza, Familia, Laboral, Penal). Si no coincide, la materia se
              factura al valor general y no habrá ningún aviso.
            </p>
          </div>
        </div>
        }
      }
    </div>
  `,
})
export class TarifasClienteComponent implements OnInit {
  private service = inject(FacturacionService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);

  datos = signal<TarifasCliente | null>(null);
  error = signal<string | null>(null);
  guardando = signal(false);

  clienteId = 0;
  nuevaMateria = '';
  nuevoValor: number | null = null;

  /**
   * Los tres conceptos base con su valor efectivo: el acordado si existe, y si
   * no, el de la plataforma. Es lo que de verdad se le va a cobrar.
   */
  base = computed(() => {
    const d = this.datos();
    if (!d) return [];
    const etiquetas: Record<string, string> = {
      materia: 'Causas por materia',
      apelaciones: 'Corte de Apelaciones',
      suprema: 'Corte Suprema',
    };
    return ['materia', 'apelaciones', 'suprema'].map((concepto) => {
      const tarifa = d.tarifas.find((t) => t.concepto === concepto && t.activo) ?? null;
      return {
        concepto,
        etiqueta: etiquetas[concepto],
        tarifa,
        valor: tarifa ? tarifa.valor_unitario : (d.por_defecto[concepto] ?? 0),
      };
    });
  });

  /** Las tarifas `materia:<nombre>`, que son las que pisan una materia puntual. */
  excepciones = computed(
    () => this.datos()?.tarifas.filter((t) => t.concepto.startsWith('materia:')) ?? []
  );

  ngOnInit(): void {
    this.clienteId = Number(this.route.snapshot.paramMap.get('id'));
    this.cargar();
  }

  cargar(): void {
    this.error.set(null);
    this.service.tarifas(this.clienteId).subscribe({
      next: (d) => this.datos.set(d),
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  // ── Acciones ─────────────────────────────────────────────────────────────

  editar(concepto: string, actual: number): void {
    const texto = prompt(
      `Valor por causa para "${this.nombreMateria(concepto)}", en pesos:`,
      String(actual)
    );
    if (texto === null) return;
    const valor = Number(texto.replace(/[^0-9.,]/g, '').replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0) {
      this.notification.error('Indique un valor numérico mayor o igual a cero.');
      return;
    }
    this.guardar(concepto, valor, true);
  }

  agregarExcepcion(): void {
    const materia = this.nuevaMateria.trim();
    if (!materia) {
      this.notification.error('Indique la materia.');
      return;
    }
    if (this.nuevoValor === null || this.nuevoValor < 0) {
      this.notification.error('Indique un valor mayor o igual a cero.');
      return;
    }
    this.guardar(`materia:${materia}`, this.nuevoValor, true, () => {
      this.nuevaMateria = '';
      this.nuevoValor = null;
    });
  }

  alternarActiva(tarifa: Tarifa): void {
    this.guardar(tarifa.concepto, tarifa.valor_unitario, !tarifa.activo);
  }

  quitar(tarifa: Tarifa): void {
    if (
      !confirm(
        `Quitar esta tarifa. El concepto vuelve al valor por defecto de la plataforma, ` +
          'no a cero.\n\n¿Continuar?'
      )
    ) {
      return;
    }
    this.service.eliminarTarifa(this.clienteId, tarifa.id).subscribe({
      next: (r) => {
        this.notification.success(r.mensaje);
        this.cargar();
      },
      error: (e) => this.notification.error(mensajeError(e)),
    });
  }

  private guardar(
    concepto: string,
    valor_unitario: number,
    activo: boolean,
    despues?: () => void
  ): void {
    this.guardando.set(true);
    this.service
      .guardarTarifa(this.clienteId, { concepto, valor_unitario, activo })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.notification.success('Tarifa guardada');
          despues?.();
          this.cargar();
        },
        error: (e) => {
          this.guardando.set(false);
          this.notification.error(mensajeError(e));
        },
      });
  }

  // ── Presentación ─────────────────────────────────────────────────────────

  /** `materia:Familia` → `Familia`; los conceptos base, con su nombre largo. */
  nombreMateria(concepto: string): string {
    if (concepto.startsWith('materia:')) return concepto.slice('materia:'.length);
    return (
      {
        materia: 'Causas por materia',
        apelaciones: 'Corte de Apelaciones',
        suprema: 'Corte Suprema',
      }[concepto] ?? concepto
    );
  }
}
