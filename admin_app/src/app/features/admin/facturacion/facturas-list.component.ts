import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  EstadoFactura,
  Factura,
  FiltroFacturas,
  GenerarPeriodoResponse,
} from '@core/models/facturacion.model';
import { NotificationService } from '@core/services/notification.service';
import { formatearRut } from '@core/utils/rut';
import {
  ChipFiltro,
  FiltrosPanelComponent,
} from '@shared/components/filtros-panel/filtros-panel.component';
import { FacturacionService } from '../services/facturacion.service';
import { nombreMes } from './periodo';

/**
 * Listado de facturas: la pantalla principal del módulo.
 *
 * **Qué se factura**: la cartera de causas vigentes de cada cliente, una línea
 * por materia más las dos cortes, a las tarifas acordadas con ese cliente. Una
 * factura por cliente y por mes, generada el día 1 por el job.
 *
 * **Por qué el listado y no un resumen por período.** La pregunta que se hace
 * acá es siempre por una factura concreta —la de tal cliente, la del mes
 * pasado, la que el cliente reclama por su número—, y eso es una búsqueda, no
 * un informe. El resumen del mes en curso vive en su propia pantalla
 * (`/facturacion/estimacion`), que es donde tiene sentido: antes de que las
 * facturas existan.
 *
 * **Los filtros viven en un panel lateral, no en una tarjeta fija.** Eran seis
 * campos ocupando una franja entera sobre la tabla, todo el tiempo, para una
 * pantalla que se abre sobre todo a mirar. Ahora lo único permanente son los
 * badges de lo que está aplicado —que además se quitan de a uno— y el resto se
 * abre a pedido. Es el mismo `app-filtros-panel` que usan las pantallas de
 * causas y audiencias en la aplicación de los estudios.
 *
 * La misma pantalla sirve filtrada por un cliente (`?cliente=12`), que es a
 * donde llevan los botones "Facturas" del listado y de la ficha del cliente. No
 * hay una pantalla aparte para eso: es el mismo listado con un filtro puesto, y
 * por eso ese filtro también aparece como badge y se puede quitar.
 */
@Component({
  selector: 'app-facturas-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FiltrosPanelComponent],
  template: `
    <div class="space-y-6">
      <div class="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Facturación</h1>
          <p class="text-neutral-500 mt-1">
            Facturas mensuales emitidas a los clientes por su cartera de causas
          </p>
        </div>
        <div class="flex items-center gap-2">
          <a routerLink="/facturacion/estimacion" class="btn-outline btn-sm">
            Estimar el mes
          </a>
          <button type="button" class="btn-primary btn-sm" (click)="generar()"
                  [disabled]="generando()">
            {{ generando() ? 'Generando...' : 'Generar período' }}
          </button>
        </div>
      </div>

      <!-- Barra de badges + botón que abre el panel. Los campos van proyectados
           acá dentro: el panel solo pone la interacción y el aspecto. -->
      <app-filtros-panel
        [chips]="chips()"
        titulo="Filtrar facturas"
        (aplicar)="aplicar()"
        (limpiar)="limpiar()"
        (quitar)="quitarChip($event)"
      >
        <div>
          <label class="form-label" for="f-q">Cliente o N° de factura</label>
          <input id="f-q" type="search" class="form-input" [(ngModel)]="borrador.q"
                 (keyup.enter)="aplicar()" placeholder="Pérez y Cía. · 42" />
          <p class="text-xs text-neutral-500 mt-1">
            Busca en el nombre del cliente y en el número, con o sin los ceros.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label" for="f-desde">Período desde</label>
            <input id="f-desde" type="date" class="form-input" [(ngModel)]="borrador.desde" />
          </div>
          <div>
            <label class="form-label" for="f-hasta">Período hasta</label>
            <input id="f-hasta" type="date" class="form-input" [(ngModel)]="borrador.hasta" />
          </div>
        </div>

        <div>
          <label class="form-label" for="f-rut">RUT del cliente</label>
          <input id="f-rut" type="text" class="form-input" [(ngModel)]="borrador.rut"
                 (keyup.enter)="aplicar()" placeholder="76.543.210-K" />
          <!-- El RUT va cifrado en la base: se busca exacto o no se busca.
               Decirlo acá evita el reclamo de que "el buscador no encuentra
               nada" cuando se escriben cuatro dígitos. -->
          <p class="text-xs text-neutral-500 mt-1">
            RUT completo. No busca por partes: en la base va cifrado.
          </p>
        </div>

        <div>
          <label class="form-label" for="f-activo">Cliente</label>
          <select id="f-activo" class="form-select" [(ngModel)]="borrador.activo">
            <option value="">Activos e inactivos</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
          </select>
        </div>

        <div>
          <label class="form-label" for="f-estado">Estado de la factura</label>
          <select id="f-estado" class="form-select" [(ngModel)]="borrador.estado">
            <option value="">Todos</option>
            <option value="emitida">Emitida</option>
            <option value="pagada">Pagada</option>
            <option value="anulada">Anulada</option>
          </select>
        </div>
      </app-filtros-panel>

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudieron cargar las facturas.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">
            Reintentar
          </button>
        </div>
      }

      @if (resumenGeneracion(); as r) {
        <div [class]="r.con_error.length ? 'alert-warning' : 'alert-success'">
          <div class="flex-1">
            <p class="font-medium">
              {{ nombreMes(r.periodo) }}: {{ r.generadas }} factura(s) nueva(s)
              por {{ r.total_generado | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}.
              @if (r.omitidas) { {{ r.omitidas }} ya existían. }
            </p>
            @if (r.con_error.length) {
              <p class="text-sm mt-1">
                No se pudo facturar a {{ r.con_error.length }} cliente(s): su base de datos
                no respondió. No se les emitió una factura en cero a propósito; arregle la
                base y vuelva a generar — los que ya tienen factura se saltan solos.
              </p>
              <ul class="text-sm mt-1 list-disc list-inside">
                @for (c of r.con_error; track c.cliente_id) {
                  <li>{{ c.cliente_nombre }} — {{ c.motivo }}</li>
                }
              </ul>
            }
          </div>
        </div>
      }

      <!-- Totales del resultado, no del sistema: cambian con el filtro y por
           eso van debajo de él y no en la cabecera. -->
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="card">
          <div class="card-body">
            <p class="text-sm text-neutral-500">Total cobrable</p>
            <p class="text-3xl font-bold text-primary-700 tabular-nums mt-1">
              {{ totalMonto() | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
            </p>
            <p class="text-xs text-neutral-500 mt-1">Sin contar las anuladas</p>
          </div>
        </div>
        <div class="card">
          <div class="card-body">
            <p class="text-sm text-neutral-500">Facturas</p>
            <p class="text-2xl font-semibold text-neutral-800 tabular-nums mt-1">
              {{ facturas().length }}
            </p>
            <p class="text-xs text-neutral-500 mt-1">
              {{ anuladas() }} anulada(s) · {{ pagadas() }} pagada(s)
            </p>
          </div>
        </div>
        <div class="card">
          <div class="card-body">
            <p class="text-sm text-neutral-500">Causas facturadas</p>
            <p class="text-2xl font-semibold text-neutral-800 tabular-nums mt-1">
              {{ totalCausas() }}
            </p>
            <p class="text-xs text-neutral-500 mt-1">Suma del detalle de todas</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          @if (cargando()) {
            <div class="flex items-center justify-center py-16">
              <svg class="animate-spin h-8 w-8 text-primary-600" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span class="sr-only">Cargando facturas</span>
            </div>
          } @else if (facturas().length === 0) {
            <div class="py-16 text-center">
              <p class="text-neutral-600 font-medium">No hay facturas que mostrar</p>
              <p class="text-neutral-500 text-sm mt-1">
                @if (chips().length) {
                  Ningún resultado con estos filtros.
                  <button type="button" class="text-primary-700 hover:underline" (click)="limpiar()">
                    Quitarlos todos
                  </button>.
                } @else {
                  Las facturas se generan solas el día 1 de cada mes. También puede
                  generarlas desde el botón de arriba.
                }
              </p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">N°</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">RUT</th>
                    <th scope="col">Período</th>
                    <th scope="col">Generada</th>
                    <th scope="col" class="text-right">Causas</th>
                    <th scope="col" class="text-right">Total</th>
                    <th scope="col">Estado</th>
                    <th scope="col"><span class="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of facturas(); track f.id) {
                    <tr [class.opacity-60]="f.anulada">
                      <td class="font-medium tabular-nums">
                        <a [routerLink]="['/facturacion', f.id]" class="text-primary-700 hover:underline">
                          {{ f.numero }}
                        </a>
                      </td>
                      <td>
                        {{ f.razon_social }}
                        @if (!f.cliente_activo) {
                          <span class="badge-neutral ml-2" title="El cliente está inactivo">
                            Inactivo
                          </span>
                        }
                        <!-- Un mes que no se pudo contar no existe como
                             factura, así que lo que se marca acá es el otro
                             caso: se facturó con la base sin datos. -->
                        @if (f.origen_estado === 'sin_datos') {
                          <span class="badge-warning ml-2" [title]="f.origen_detalle || ''">
                            Sin causas
                          </span>
                        }
                      </td>
                      <td class="tabular-nums whitespace-nowrap">{{ rutBonito(f.rut) }}</td>
                      <td class="whitespace-nowrap">
                        {{ f.periodo ? nombreMes(f.periodo) : '—' }}
                      </td>
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
                        <div class="flex gap-2 justify-end">
                          <a [routerLink]="['/facturacion', f.id]" class="btn-outline btn-sm">
                            Ver detalle
                          </a>
                          <button type="button" class="btn-secondary btn-sm"
                                  (click)="descargar(f)" [disabled]="descargando() === f.id">
                            {{ descargando() === f.id ? '...' : 'PDF' }}
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <p class="text-xs text-neutral-500 mt-3">
              El PDF se descarga tal como se emitió, no se vuelve a generar. No constituye
              documento tributario del SII.
            </p>
          }
        </div>
      </div>
    </div>
  `,
})
export class FacturasListComponent implements OnInit {
  private service = inject(FacturacionService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  facturas = signal<Factura[]>([]);
  totalMonto = signal(0);
  cargando = signal(false);
  generando = signal(false);
  descargando = signal<number | null>(null);
  error = signal<string | null>(null);
  resumenGeneracion = signal<GenerarPeriodoResponse | null>(null);

  /**
   * Lo que el usuario está escribiendo en el panel. Se separa de lo aplicado
   * porque el panel tiene botón "Aplicar": mientras esté abierto, la tabla y
   * los badges siguen mostrando el filtro anterior, y cerrar sin aplicar no
   * debe cambiar nada.
   */
  borrador: Borrador = vacio();
  /** Lo que de verdad está filtrando. De acá salen los badges y la consulta. */
  private aplicado = signal<Borrador>(vacio());

  /** Id del cliente cuando se llegó desde su ficha o desde el listado. */
  clienteId = signal<number | null>(null);
  /** Su nombre, para el badge. Sale de la primera factura que llegue. */
  private clienteNombre = signal<string | null>(null);

  nombreMes = nombreMes;

  /**
   * Los badges de lo aplicado.
   *
   * El cliente va primero y es el único que no sale del panel: se fija
   * navegando desde otra pantalla. Igual se muestra y se puede quitar, para que
   * nadie quede atrapado en un listado filtrado sin entender por qué.
   */
  chips = computed<ChipFiltro[]>(() => {
    const f = this.aplicado();
    const lista: ChipFiltro[] = [];

    if (this.clienteId() !== null) {
      lista.push({
        clave: 'cliente',
        etiqueta: 'Cliente',
        valor: this.clienteNombre() ?? `#${this.clienteId()}`,
      });
    }
    if (f.q) lista.push({ clave: 'q', etiqueta: 'Búsqueda', valor: f.q });
    if (f.rut) lista.push({ clave: 'rut', etiqueta: 'RUT', valor: formatearRut(f.rut) });
    if (f.desde) lista.push({ clave: 'desde', etiqueta: 'Desde', valor: fechaLegible(f.desde) });
    if (f.hasta) lista.push({ clave: 'hasta', etiqueta: 'Hasta', valor: fechaLegible(f.hasta) });
    if (f.activo) {
      lista.push({
        clave: 'activo',
        etiqueta: 'Cliente',
        valor: f.activo === 'true' ? 'Solo activos' : 'Solo inactivos',
      });
    }
    if (f.estado) {
      lista.push({ clave: 'estado', etiqueta: 'Estado', valor: this.etiquetaEstado(f.estado) });
    }
    return lista;
  });

  anuladas = computed(() => this.facturas().filter((f) => f.anulada).length);
  pagadas = computed(() => this.facturas().filter((f) => f.estado === 'pagada').length);
  totalCausas = computed(() =>
    this.facturas().reduce((suma, f) => suma + (f.anulada ? 0 : f.total_causas), 0)
  );

  ngOnInit(): void {
    // El cliente llega por query param y no por una ruta propia: es el mismo
    // listado con un filtro, y una ruta aparte obligaría a duplicar la pantalla.
    this.route.queryParamMap.subscribe((params) => {
      const cliente = params.get('cliente');
      const id = cliente ? Number(cliente) : null;
      if (id !== this.clienteId()) {
        this.clienteNombre.set(null);
      }
      this.clienteId.set(id);
      this.cargar();
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.listar(this.armarFiltro()).subscribe({
      next: (r) => {
        this.facturas.set(r.facturas);
        this.totalMonto.set(r.total_monto);
        // El nombre para el badge sale de la respuesta: pedir el cliente aparte
        // sería una segunda consulta para mostrar un texto que ya vino.
        if (this.clienteId() !== null && r.facturas.length) {
          this.clienteNombre.set(r.facturas[0].cliente_nombre);
        }
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(mensajeError(e));
      },
    });
  }

  // ── Filtros ──────────────────────────────────────────────────────────────

  aplicar(): void {
    this.aplicado.set({ ...this.borrador });
    this.cargar();
  }

  limpiar(): void {
    this.borrador = vacio();
    this.aplicado.set(vacio());
    if (this.clienteId() !== null) {
      // Navegar limpia el query param y el `subscribe` de ngOnInit recarga: sin
      // esto el badge del cliente se quedaría puesto.
      this.quitarCliente();
      return;
    }
    this.cargar();
  }

  /** La ✕ de un badge: quita ese filtro y vuelve a consultar de inmediato. */
  quitarChip(clave: string): void {
    if (clave === 'cliente') {
      this.quitarCliente();
      return;
    }
    this.borrador = { ...this.borrador, [clave]: '' };
    this.aplicar();
  }

  private quitarCliente(): void {
    this.router.navigate(['/facturacion'], { queryParams: {} });
  }

  private armarFiltro(): FiltroFacturas {
    const f = this.aplicado();
    return {
      cliente_id: this.clienteId(),
      q: f.q || null,
      rut: f.rut || null,
      desde: f.desde || null,
      hasta: f.hasta || null,
      cliente_activo: f.activo === '' ? null : f.activo === 'true',
      estado: (f.estado || null) as EstadoFactura | null,
    };
  }

  // ── Acciones ─────────────────────────────────────────────────────────────

  generar(): void {
    if (this.generando()) return;
    if (
      !confirm(
        'Se generará la factura del mes anterior para cada cliente que todavía no ' +
          'la tenga. Los que ya tienen una vigente no se tocan.\n\n¿Continuar?'
      )
    ) {
      return;
    }

    this.generando.set(true);
    this.resumenGeneracion.set(null);
    this.service.generar({}).subscribe({
      next: (r) => {
        this.generando.set(false);
        this.resumenGeneracion.set(r);
        this.notification.success(`${r.generadas} factura(s) generada(s)`);
        this.cargar();
      },
      error: (e) => {
        this.generando.set(false);
        this.notification.error(mensajeError(e));
      },
    });
  }

  descargar(factura: Factura): void {
    this.descargando.set(factura.id);
    this.service.descargarPdf(factura.id).subscribe({
      next: (blob) => {
        this.descargando.set(null);
        guardarArchivo(blob, `factura-${factura.numero}.pdf`);
      },
      error: () => {
        this.descargando.set(null);
        this.notification.error('No se pudo descargar el PDF');
      },
    });
  }

  // ── Presentación ─────────────────────────────────────────────────────────

  rutBonito(rut: string): string {
    return rut && rut !== '—' ? formatearRut(rut) : rut;
  }

  etiquetaEstado(estado: string): string {
    return (
      { emitida: 'Emitida', pagada: 'Pagada', anulada: 'Anulada' }[estado] ?? estado
    );
  }

  claseEstado(estado: EstadoFactura): string {
    return (
      { emitida: 'badge-info', pagada: 'badge-success', anulada: 'badge-danger' }[estado] ??
      'badge-neutral'
    );
  }
}

/**
 * Los campos del panel, todos como texto.
 *
 * `activo` y `estado` viajan así y no como `boolean | null` porque un `<select>`
 * con `[(ngModel)]` sobre un booleano termina comparando `'true'` con `true` y
 * el filtro no se aplica nunca. La conversión se hace una sola vez, en
 * `armarFiltro`.
 */
interface Borrador {
  q: string;
  rut: string;
  desde: string;
  hasta: string;
  activo: string;
  estado: string;
}

function vacio(): Borrador {
  return { q: '', rut: '', desde: '', hasta: '', activo: '', estado: '' };
}

/** `2026-07-01` → `01-07-2026`. Sin pasar por Date, que desplaza el día. */
function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return dia ? `${dia}-${mes}-${anio}` : iso;
}

/** Dispara la descarga del blob. Se revoca la URL: sin eso el navegador
 *  conserva el PDF entero en memoria hasta recargar la página. */
export function guardarArchivo(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** El `detail` de FastAPI, que llega como texto o como lista de errores. */
export function mensajeError(err: unknown): string {
  const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const primero = detail[0] as { msg?: string };
    if (primero?.msg) return primero.msg;
  }
  return 'No se pudo completar la operación. Intente de nuevo.';
}
