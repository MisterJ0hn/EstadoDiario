import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Cliente } from '@core/models/admin.model';
import { FiltroLogs, LogActividad } from '@core/models/log.model';
import { NotificationService } from '@core/services/notification.service';
import {
  ChipFiltro,
  FiltrosPanelComponent,
} from '@shared/components/filtros-panel/filtros-panel.component';
import { AdminClienteService } from '../services/admin-cliente.service';
import { LogService } from './log.service';

/**
 * Bitácora de actividad, por cliente.
 *
 * **Para qué.** Es la pantalla de soporte: cuando alguien pregunta "¿quién
 * borró esto?" o "¿por qué no le llegó el informe?", la respuesta está en el
 * log del cliente, que vive en SU base y a la que el administrador no tiene
 * otra forma de entrar.
 *
 * **Es de solo lectura.** No hay borrado ni edición: una bitácora que se puede
 * corregir no sirve para lo único que sirve una bitácora. Lo que sí existe es
 * la purga por antigüedad, que es política del sistema y vive en Configuración.
 *
 * **Se elige un cliente antes de ver nada.** Los registros están repartidos —una
 * base por estudio— así que no hay una consulta "de todos" que no sea recorrer
 * cincuenta bases.
 *
 * **No cuelga del menú**: se entra desde la ficha del cliente, que es donde ya
 * se sabe de quién se está hablando. El selector de acá arriba se queda para
 * poder saltar a otro estudio sin volver, y porque la ruta también se abre
 * directo desde un enlace pegado en un ticket de soporte.
 */
@Component({
  selector: 'app-bitacora',
  standalone: true,
  imports: [CommonModule, FormsModule, FiltrosPanelComponent],
  template: `
    <div class="space-y-6">
      <div class="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Bitácora de actividad</h1>
          <p class="text-neutral-500 mt-1">
            Log de cliente
          </p>
        </div>
        <div class="min-w-[16rem]">
          <label class="form-label" for="b-cliente">Cliente</label>
          <select id="b-cliente" class="form-select" [ngModel]="clienteId()"
                  (ngModelChange)="elegirCliente($event)">
            <option [ngValue]="null">Seleccione un cliente...</option>
            @for (c of clientes(); track c.id) {
              <option [ngValue]="c.id">{{ c.nombre }}</option>
            }
          </select>
        </div>
      </div>

      @if (clienteId() === null) {
        <div class="card">
          <div class="card-body py-16 text-center">
            <p class="text-neutral-600 font-medium">Elija un cliente para ver su bitácora</p>
            <p class="text-neutral-500 text-sm mt-1">
              Los registros viven en la base de cada estudio, así que se consultan de a uno.
            </p>
          </div>
        </div>
      } @else {
        <app-filtros-panel
          [chips]="chips()"
          titulo="Filtrar la bitácora"
          (aplicar)="aplicar()"
          (limpiar)="limpiar()"
          (quitar)="quitarChip($event)"
        >
          <div>
            <label class="form-label" for="b-q">Buscar en el detalle</label>
            <input id="b-q" type="search" class="form-input" [(ngModel)]="borrador.q"
                   (keyup.enter)="aplicar()" placeholder="nombre de archivo, id…" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label" for="b-desde">Desde</label>
              <input id="b-desde" type="date" class="form-input" [(ngModel)]="borrador.desde" />
            </div>
            <div>
              <label class="form-label" for="b-hasta">Hasta</label>
              <input id="b-hasta" type="date" class="form-input" [(ngModel)]="borrador.hasta" />
            </div>
          </div>

          <div>
            <label class="form-label" for="b-modulo">Módulo</label>
            <select id="b-modulo" class="form-select" [(ngModel)]="borrador.modulo">
              <option value="">Todos</option>
              <!-- Solo los que existen en esta bitácora: ofrecer opciones que
                   nunca devuelven nada hace parecer que el filtro está roto. -->
              @for (m of modulos(); track m) {
                <option [value]="m">{{ m }}</option>
              }
            </select>
          </div>

          <div>
            <label class="form-label" for="b-accion">Acción</label>
            <select id="b-accion" class="form-select" [(ngModel)]="borrador.accion">
              <option value="">Todas</option>
              @for (a of acciones(); track a) {
                <option [value]="a">{{ a }}</option>
              }
            </select>
          </div>
        </app-filtros-panel>

        @if (error()) {
          <div class="alert-danger">
            <div class="flex-1">
              <p class="font-medium">No se pudo cargar la bitácora.</p>
              <p class="text-sm mt-1">{{ error() }}</p>
            </div>
            <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">
              Reintentar
            </button>
          </div>
        }

        <div class="card">
          <div class="card-body">
            @if (cargando()) {
              <div class="flex items-center justify-center py-16">
                <svg class="animate-spin h-8 w-8 text-primary-600" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span class="sr-only">Cargando la bitácora</span>
              </div>
            } @else if (registros().length === 0) {
              <div class="py-16 text-center">
                <p class="text-neutral-600 font-medium">No hay actividad registrada</p>
                <p class="text-neutral-500 text-sm mt-1">
                  @if (chips().length) {
                    Pruebe con otro filtro, o
                    <button type="button" class="text-primary-700 hover:underline" (click)="limpiar()">
                      quítelos todos</button>.
                  } @else {
                    La bitácora se purga por antigüedad según la política de Configuración.
                  }
                </p>
              </div>
            } @else {
              <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 class="text-sm font-semibold text-neutral-800">
                  {{ clienteNombre() }}
                </h2>
                <p class="text-sm text-neutral-500">{{ total() }} registro(s)</p>
              </div>

              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Usuario</th>
                      <th scope="col">Módulo</th>
                      <th scope="col">Acción</th>
                      <th scope="col">Detalle</th>
                      <th scope="col">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of registros(); track r.id) {
                      <tr>
                        <td class="whitespace-nowrap tabular-nums">
                          {{ r.fecha_hora | date: 'dd-MM-yyyy HH:mm:ss' }}
                        </td>
                        <td class="whitespace-nowrap">
                          @if (r.usuario) {
                            {{ r.usuario }}
                          } @else {
                            <!-- Un login fallido no tiene usuario resuelto: no es
                                 un dato perdido, es lo que significa. -->
                            <span class="text-neutral-400" title="Sin usuario identificado">—</span>
                          }
                        </td>
                        <td><span class="badge-neutral">{{ r.modulo }}</span></td>
                        <td>{{ r.accion }}</td>
                        <td class="max-w-[380px] truncate" [title]="r.detalle || ''">
                          {{ r.detalle || '-' }}
                        </td>
                        <td class="whitespace-nowrap text-neutral-500 tabular-nums">
                          {{ r.ip || '-' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              @if (totalPaginas() > 1) {
                <div class="flex items-center justify-between mt-4">
                  <span class="text-sm text-neutral-500">
                    Página {{ pagina() }} de {{ totalPaginas() }}
                  </span>
                  <div class="flex gap-2">
                    <button type="button" class="btn-secondary btn-sm"
                            (click)="irA(pagina() - 1)" [disabled]="pagina() <= 1">
                      Anterior
                    </button>
                    <button type="button" class="btn-secondary btn-sm"
                            (click)="irA(pagina() + 1)" [disabled]="pagina() >= totalPaginas()">
                      Siguiente
                    </button>
                  </div>
                </div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class BitacoraComponent implements OnInit {
  private service = inject(LogService);
  private clienteService = inject(AdminClienteService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  clientes = signal<Cliente[]>([]);
  registros = signal<LogActividad[]>([]);
  modulos = signal<string[]>([]);
  acciones = signal<string[]>([]);
  clienteNombre = signal('');
  total = signal(0);
  pagina = signal(1);
  totalPaginas = signal(1);
  cargando = signal(false);
  error = signal<string | null>(null);

  clienteId = signal<number | null>(null);

  /** Lo que se escribe en el panel; `aplicado` es lo que filtra. */
  borrador: Borrador = vacio();
  private aplicado = signal<Borrador>(vacio());

  chips = computed<ChipFiltro[]>(() => {
    const f = this.aplicado();
    const lista: ChipFiltro[] = [];
    if (f.q) lista.push({ clave: 'q', etiqueta: 'Detalle', valor: f.q });
    if (f.modulo) lista.push({ clave: 'modulo', etiqueta: 'Módulo', valor: f.modulo });
    if (f.accion) lista.push({ clave: 'accion', etiqueta: 'Acción', valor: f.accion });
    if (f.desde) lista.push({ clave: 'desde', etiqueta: 'Desde', valor: legible(f.desde) });
    if (f.hasta) lista.push({ clave: 'hasta', etiqueta: 'Hasta', valor: legible(f.hasta) });
    return lista;
  });

  ngOnInit(): void {
    this.clienteService.list(1, 200).subscribe({
      next: (r) => this.clientes.set(r.clientes),
      error: () => this.notification.error('No se pudo cargar la lista de clientes'),
    });

    // El cliente llega por query param, igual que en facturación: se llega acá
    // desde su ficha y el enlace tiene que poder compartirse.
    this.route.queryParamMap.subscribe((params) => {
      const cliente = params.get('cliente');
      this.clienteId.set(cliente ? Number(cliente) : null);
      if (this.clienteId() !== null) {
        this.pagina.set(1);
        this.cargar();
      }
    });
  }

  elegirCliente(id: number | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { cliente: id ?? null },
      queryParamsHandling: 'merge',
    });
  }

  cargar(): void {
    const id = this.clienteId();
    if (id === null) return;

    this.cargando.set(true);
    this.error.set(null);
    const f = this.aplicado();
    const filtro: FiltroLogs = {
      q: f.q || null,
      modulo: f.modulo || null,
      accion: f.accion || null,
      desde: f.desde || null,
      hasta: f.hasta || null,
      page: this.pagina(),
      per_page: 50,
    };
    this.service.listar(id, filtro).subscribe({
      next: (r) => {
        this.registros.set(r.registros);
        this.total.set(r.total);
        this.pagina.set(r.page);
        this.totalPaginas.set(r.total_pages);
        this.clienteNombre.set(r.cliente_nombre);
        this.modulos.set(r.modulos);
        this.acciones.set(r.acciones);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.registros.set([]);
        const detalle = (e as { error?: { detail?: unknown } })?.error?.detail;
        this.error.set(
          typeof detalle === 'string' ? detalle : 'Intente de nuevo en unos momentos.'
        );
      },
    });
  }

  aplicar(): void {
    this.aplicado.set({ ...this.borrador });
    this.pagina.set(1);
    this.cargar();
  }

  limpiar(): void {
    this.borrador = vacio();
    this.aplicado.set(vacio());
    this.pagina.set(1);
    this.cargar();
  }

  quitarChip(clave: string): void {
    this.borrador = { ...this.borrador, [clave]: '' };
    this.aplicar();
  }

  irA(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) return;
    this.pagina.set(pagina);
    this.cargar();
  }
}

/** Los campos del panel, todos como texto: salen de inputs y selects. */
interface Borrador {
  q: string;
  modulo: string;
  accion: string;
  desde: string;
  hasta: string;
}

function vacio(): Borrador {
  return { q: '', modulo: '', accion: '', desde: '', hasta: '' };
}

/** `2026-08-12` → `12-08-2026`. Sin pasar por Date, que desplaza el día. */
function legible(iso: string): string {
  const [a, m, d] = iso.split('-');
  return d ? `${d}-${m}-${a}` : iso;
}
