import { Component, inject, signal, OnInit, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import { Movimiento, Jurisdiccion } from '@core/models/estado-diario.model';
import { RecordatorioModalComponent } from '../recordatorio-modal/recordatorio-modal.component';
import {
  ChipFiltro,
  FiltrosPanelComponent,
} from '@shared/components/filtros-panel/filtros-panel.component';

type Tab = 'no-leidos' | 'leidos' | 'pendientes';

/** ISO (yyyy-MM-dd) a formato chileno. Se parte el string en vez de usar Date:
 *  una fecha ISO pura se interpreta como UTC y en Chile corre un día. */
function fmtFechaChip(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return dia && mes && anio ? `${dia}-${mes}-${anio}` : iso;
}

@Component({
  selector: 'app-movimientos-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RecordatorioModalComponent,
    FiltrosPanelComponent,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">{{ title() }}</h1>
          <p class="text-neutral-500 mt-1">{{ total() }} registros encontrados</p>
        </div>
      </div>

      @if (!isOrigen()) {
        <!-- Tabs de estado -->
        <div class="border-b border-neutral-200">
          <nav class="tabs-nav" role="tablist">
            @for (t of tabs; track t.key) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="activeTab() === t.key"
                (click)="selectTab(t.key)"
                class="tab-link"
                [class.tab-link-activo]="activeTab() === t.key"
              >
                {{ t.label }}
                @if (counts()[t.key] !== null) {
                  <span class="tab-contador">{{ counts()[t.key] }}</span>
                }
              </button>
            }
          </nav>
        </div>

        <!-- Filtros: los campos viven en el panel lateral; acá solo quedan los
             badges de lo aplicado y el botón que lo abre. -->
        <app-filtros-panel
          [chips]="chipsFiltros()"
          (aplicar)="onFilter()"
          (limpiar)="onClearFilters()"
          (quitar)="quitarFiltro($event)"
        >
          <div>
            <label class="form-label" for="f-jurisdiccion">Jurisdicción</label>
            <select id="f-jurisdiccion" class="form-select" [(ngModel)]="filterJurisdiccion">
              <option [ngValue]="null">Todas</option>
              @for (j of jurisdicciones(); track j.id) {
                <option [ngValue]="j.id">{{ j.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="form-label" for="f-desde">Fecha desde</label>
            <input id="f-desde" type="date" class="form-input" [(ngModel)]="filterFechaDesde" />
          </div>
          <div>
            <label class="form-label" for="f-hasta">Fecha hasta</label>
            <input id="f-hasta" type="date" class="form-input" [(ngModel)]="filterFechaHasta" />
          </div>
          <div>
            <label class="form-label" for="f-rut">RUT</label>
            <input id="f-rut" type="text" class="form-input" [(ngModel)]="filterRut"
                   placeholder="Ej: 16952077-1" (keyup.enter)="aplicarDesdeCampo()" />
          </div>
        </app-filtros-panel>
      }

      <!-- Table -->
      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      } @else {
        <div class="card">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Caratulado</th>
                  <th>Tribunal</th>
                  <th>Estado</th>
                  <th>Tipo Causa</th>
                  <th>Fecha Ingreso</th>
                  <th>RUT</th>
                  <th>Estado Causa</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (m of movimientos(); track m.id) {
                  <tr>
                    <td class="font-medium">
                      <a [routerLink]="['/estado-diario', m.id]" class="hover:text-primary-600 hover:underline">
                        {{ m.rol || '-' }}
                      </a>
                    </td>
                    <td class="max-w-[200px] truncate" [title]="m.caratulado || ''">
                      <a [routerLink]="['/estado-diario', m.id]" class="hover:text-primary-600 hover:underline">
                        {{ m.caratulado || '-' }}
                      </a>
                    </td>
                    <td>{{ m.tribunal || '-' }}</td>
                    <td>
                      @if (m.leido) {
                        <span class="badge-success">Resuelto</span>
                      } @else if (m.pendiente) {
                        <span [class]="claseNivel(m.nivel_pendiente)">Pendiente - {{ m.nivel_pendiente }}</span>
                      } @else {
                        <span class="badge-neutral">No leído</span>
                      }
                    </td>
                    <td>{{ m.tipo_causa || '-' }}</td>
                    <td>{{ m.fecha_ingreso || '-' }}</td>
                    <td>{{ m.rut || '-' }}</td>
                    <td>
                      @if (m.estado) {
                        <span class="badge-info">{{ m.estado }}</span>
                      } @else {
                        -
                      }
                    </td>
                    <td class="relative">
                      <div class="inline-flex items-center gap-1 align-middle">
                        @if (!m.leido) {
                          <button (click)="toggleMenu(m.id, $event)" class="btn-outline btn-sm" title="Acciones">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          @if (menuAbiertoId() === m.id) {
                            <!-- Backdrop invisible para cerrar el menú al hacer click afuera -->
                            <div class="fixed inset-0 z-10" (click)="cerrarMenu()"></div>
                            <div class="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-neutral-200 bg-white shadow-lg py-1">
                              <button (click)="onResolver(m.id)"
                                      class="block w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                                Resuelto
                              </button>
                              <!-- "Pendiente" abre el modal de recordatorio: marcar pendiente
                                   y agendar son una sola acción. -->
                              <button (click)="onPendiente(m.id)"
                                      class="block w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                                Pendiente
                              </button>
                            </div>
                          }
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="9" class="text-center py-10 text-neutral-400">
                      No se encontraron registros del estado diario
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          @if (totalPages() > 1) {
            <div class="flex items-center justify-between px-6 py-4 border-t border-neutral-200">
              <span class="text-sm text-neutral-500">
                Página {{ currentPage() }} de {{ totalPages() }} ({{ total() }} registros)
              </span>
              <div class="flex gap-2">
                <button (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() <= 1"
                        class="btn-secondary btn-sm">Anterior</button>
                <button (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() >= totalPages()"
                        class="btn-secondary btn-sm">Siguiente</button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <app-recordatorio-modal
      [movimientoId]="recordatorioMovimientoId()"
      (cerrado)="recordatorioMovimientoId.set(null)"
      (guardado)="onRecordatorioGuardado()"
    />


    <!-- Confirmar "Resuelto" -->
    @if (confirmarResolverId() !== null) {
      <div class="modal-backdrop" (click)="cancelarResolver()">
        <div class="modal-content max-w-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">Marcar como resuelto</h3>
            <button (click)="cancelarResolver()" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>
          <div class="modal-body space-y-4">
            <div class="flex items-start gap-3">
              <div class="shrink-0 w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p class="text-sm text-neutral-600 mt-2">
                ¿Confirma que quiere marcar este registro como <strong>resuelto</strong>?
              </p>
            </div>
            <div>
              <label class="form-label">Observación (opcional)</label>
              <textarea class="form-input" rows="3" [(ngModel)]="observacionResuelto"
                        placeholder="Ej: se presentó escrito el 12-08-2026"></textarea>
              <p class="text-xs text-neutral-400 mt-1">Queda registrada junto con la resolución.</p>
            </div>
          </div>
          <div class="modal-footer">
            <button (click)="cancelarResolver()" class="btn-secondary" [disabled]="confirmandoResolver()">Cancelar</button>
            <button (click)="confirmarResolver()" class="btn-success" [disabled]="confirmandoResolver()">
              {{ confirmandoResolver() ? 'Guardando...' : 'Sí, marcar resuelto' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MovimientosListComponent implements OnInit {
  private service = inject(EstadoDiarioService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tabs: { key: Tab; label: string }[] = [
    { key: 'no-leidos', label: 'No Leídos' },
    { key: 'leidos', label: 'Resueltos' },
    { key: 'pendientes', label: 'Pendientes' },
  ];

  movimientos = signal<Movimiento[]>([]);
  jurisdicciones = signal<Jurisdiccion[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);
  counts = signal<Record<Tab, number | null>>({ 'no-leidos': null, leidos: null, pendientes: null });

  isOrigen = signal(false);
  activeTab = signal<Tab>('no-leidos');
  filterJurisdiccion: number | null = null;
  filterFechaDesde = '';
  filterFechaHasta = '';
  filterRut = '';

  /** Filtros ya aplicados, los que se ven como badges. */
  readonly chipsFiltros = signal<ChipFiltro[]>([]);
  private readonly panel = viewChild(FiltrosPanelComponent);

  menuAbiertoId = signal<number | null>(null);

  /**
   * Id del registro para el que está abierto el modal de recordatorio; null = cerrado.
   * Marcar "Pendiente" y agendar son una sola acción: el modal registra el
   * recordatorio y deja el registro en estado pendiente con el nivel elegido ahí.
   */
  recordatorioMovimientoId = signal<number | null>(null);

  confirmarResolverId = signal<number | null>(null);
  confirmandoResolver = signal(false);
  /** Comentario opcional que acompaña al "resuelto"; se limpia en cada apertura del modal. */
  observacionResuelto = '';

  title = computed(() => (this.isOrigen() ? 'Estado Diario del Archivo' : 'Estado Diario'));

  claseNivel(nivel: string | null): string {
    if (nivel === 'alto') return 'badge-danger';
    if (nivel === 'medio') return 'badge-yellow';
    return 'badge-orange';
  }

  ngOnInit(): void {
    const filter = this.route.snapshot.data['filter'] || 'movimientos';
    this.isOrigen.set(filter === 'origen');

    if (this.isOrigen()) {
      this.loadData();
      return;
    }

    const queryTab = this.route.snapshot.queryParamMap.get('tab');
    this.activeTab.set(this.normalizeTab(queryTab) ?? this.normalizeTab(filter) ?? 'no-leidos');

    this.service.getJurisdicciones().subscribe({
      next: (res) => this.jurisdicciones.set(res.jurisdicciones),
    });

    this.loadData();
    this.loadCounts();
  }

  private normalizeTab(value: string | null): Tab | null {
    return this.tabs.some((t) => t.key === value) ? (value as Tab) : null;
  }

  selectTab(tab: Tab): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.cerrarMenu();

    if (this.isOrigen()) {
      const origenId = Number(this.route.snapshot.paramMap.get('id'));
      this.service.getMovimientosByOrigen(origenId).subscribe({
        next: (res) => {
          this.movimientos.set(res.movimientos);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notification.error('Error al cargar el estado diario');
        },
      });
    } else {
      this.service.getMovimientos(this.activeTab(), this.buildParams()).subscribe({
        next: (res) => {
          this.movimientos.set(res.movimientos);
          this.total.set(res.total);
          this.currentPage.set(res.page);
          this.totalPages.set(res.total_pages);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notification.error('Error al cargar el estado diario');
        },
      });
    }
  }

  private buildParams(): {
    jurisdiccion?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
    rut?: string;
    page: number;
    limit: number;
  } {
    const params: {
      jurisdiccion?: number;
      fecha_desde?: string;
      fecha_hasta?: string;
      rut?: string;
      page: number;
      limit: number;
    } = { page: this.currentPage(), limit: 20 };
    if (this.filterJurisdiccion) params.jurisdiccion = this.filterJurisdiccion;
    if (this.filterFechaDesde) params.fecha_desde = this.filterFechaDesde;
    if (this.filterFechaHasta) params.fecha_hasta = this.filterFechaHasta;
    if (this.filterRut) params.rut = this.filterRut;
    return params;
  }

  /** Totales por estado para los contadores de las pestañas (respetan los filtros activos). */
  loadCounts(): void {
    const params = { ...this.buildParams(), page: 1, limit: 1 };

    forkJoin({
      'no-leidos': this.service.getMovimientos('no-leidos', params),
      leidos: this.service.getMovimientos('leidos', params),
      pendientes: this.service.getMovimientos('pendientes', params),
    }).subscribe({
      next: (res) =>
        this.counts.set({
          'no-leidos': res['no-leidos'].total,
          leidos: res.leidos.total,
          pendientes: res.pendientes.total,
        }),
      error: () => this.counts.set({ 'no-leidos': null, leidos: null, pendientes: null }),
    });
  }

  onFilter(): void {
    this.currentPage.set(1);
    this.sincronizarChips();
    this.loadData();
    this.loadCounts();
  }

  /** Enter dentro de un campo del panel: aplica sin obligar a ir al botón. */
  aplicarDesdeCampo(): void {
    this.panel()?.cerrar();
    this.onFilter();
  }

  onClearFilters(): void {
    this.filterJurisdiccion = null;
    this.filterFechaDesde = '';
    this.filterFechaHasta = '';
    this.filterRut = '';
    this.onFilter();
  }

  /** Quita un solo filtro desde su badge y vuelve a consultar. */
  quitarFiltro(clave: string): void {
    switch (clave) {
      case 'jurisdiccion':
        this.filterJurisdiccion = null;
        break;
      case 'fecha_desde':
        this.filterFechaDesde = '';
        break;
      case 'fecha_hasta':
        this.filterFechaHasta = '';
        break;
      case 'rut':
        this.filterRut = '';
        break;
    }
    this.onFilter();
  }

  /**
   * Los badges muestran lo que está APLICADO, no lo que hay escrito en el
   * panel: si el usuario abre, escribe y cierra sin aplicar, la barra no debe
   * mentir sobre qué se está consultando. Por eso se recalculan acá y no en un
   * computed sobre los campos.
   */
  private sincronizarChips(): void {
    const chips: ChipFiltro[] = [];

    if (this.filterJurisdiccion) {
      const j = this.jurisdicciones().find((x) => x.id === this.filterJurisdiccion);
      chips.push({
        clave: 'jurisdiccion',
        etiqueta: 'Jurisdicción',
        valor: j?.nombre ?? String(this.filterJurisdiccion),
      });
    }
    if (this.filterFechaDesde) {
      chips.push({ clave: 'fecha_desde', etiqueta: 'Desde', valor: fmtFechaChip(this.filterFechaDesde) });
    }
    if (this.filterFechaHasta) {
      chips.push({ clave: 'fecha_hasta', etiqueta: 'Hasta', valor: fmtFechaChip(this.filterFechaHasta) });
    }
    if (this.filterRut) {
      chips.push({ clave: 'rut', etiqueta: 'RUT', valor: this.filterRut });
    }

    this.chipsFiltros.set(chips);
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadData();
  }

  toggleMenu(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.menuAbiertoId.set(this.menuAbiertoId() === id ? null : id);
  }

  cerrarMenu(): void {
    this.menuAbiertoId.set(null);
  }

  onResolver(id: number): void {
    this.cerrarMenu();
    this.observacionResuelto = '';
    this.confirmarResolverId.set(id);
  }

  cancelarResolver(): void {
    if (this.confirmandoResolver()) return;
    this.observacionResuelto = '';
    this.confirmarResolverId.set(null);
  }

  confirmarResolver(): void {
    const id = this.confirmarResolverId();
    if (id === null) return;

    this.confirmandoResolver.set(true);
    this.service.marcarLeido(id, this.observacionResuelto).subscribe({
      next: () => {
        this.confirmandoResolver.set(false);
        this.confirmarResolverId.set(null);
        this.observacionResuelto = '';
        this.notification.success('Marcado como resuelto');
        this.loadData();
        if (!this.isOrigen()) this.loadCounts();
      },
      error: () => {
        this.confirmandoResolver.set(false);
        this.notification.error('Error al marcar como resuelto');
      },
    });
  }

  /**
   * "Pendiente" abre el modal de recordatorio: ahí se elige el nivel de urgencia
   * (bajo/medio/alto), que es el que queda guardado tanto en el registro como en
   * el recordatorio. No se pregunta el nivel dos veces.
   */
  onPendiente(id: number): void {
    this.cerrarMenu();
    this.recordatorioMovimientoId.set(id);
  }

  onRecordatorioGuardado(): void {
    this.recordatorioMovimientoId.set(null);
    this.loadData();
    this.loadCounts();
  }
}
