import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import { Movimiento, Jurisdiccion } from '@core/models/estado-diario.model';

type Tab = 'no-leidos' | 'leidos' | 'pendientes';

@Component({
  selector: 'app-movimientos-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">{{ title() }}</h1>
          <p class="text-neutral-500 mt-1">{{ total() }} movimientos encontrados</p>
        </div>
      </div>

      @if (!isOrigen()) {
        <!-- Tabs de estado -->
        <div class="border-b border-neutral-200">
          <nav class="-mb-px flex gap-1 overflow-x-auto" role="tablist">
            @for (t of tabs; track t.key) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="activeTab() === t.key"
                (click)="selectTab(t.key)"
                class="flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors"
                [class]="activeTab() === t.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'"
              >
                {{ t.label }}
                @if (counts()[t.key] !== null) {
                  <span class="rounded-full px-2 py-0.5 text-xs font-semibold"
                        [class]="activeTab() === t.key ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'">
                    {{ counts()[t.key] }}
                  </span>
                }
              </button>
            }
          </nav>
        </div>

        <!-- Filters -->
        <div class="card">
          <div class="card-body">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label class="form-label">Jurisdicción</label>
                <select class="form-select" [(ngModel)]="filterJurisdiccion" (ngModelChange)="onFilter()">
                  <option [ngValue]="null">Todas</option>
                  @for (j of jurisdicciones(); track j.id) {
                    <option [ngValue]="j.id">{{ j.nombre }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label">Fecha</label>
                <input type="date" class="form-input" [(ngModel)]="filterFecha" (ngModelChange)="onFilter()" />
              </div>
              <div>
                <label class="form-label">RUT</label>
                <input type="text" class="form-input" [(ngModel)]="filterRut" placeholder="Ej: 16952077-1"
                       (keyup.enter)="onFilter()" />
              </div>
              <div class="flex items-end gap-2">
                <button (click)="onFilter()" class="btn-primary">Filtrar</button>
                <button (click)="onClearFilters()" class="btn-secondary">Limpiar</button>
              </div>
            </div>
          </div>
        </div>
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
                  <th>Estado Diario</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (m of movimientos(); track m.id) {
                  <tr>
                    <td class="font-medium">{{ m.rol || '-' }}</td>
                    <td class="max-w-[200px] truncate" [title]="m.caratulado || ''">{{ m.caratulado || '-' }}</td>
                    <td>{{ m.tribunal || '-' }}</td>
                    <td>
                      @if (m.leido) {
                        <span class="badge-success">Resuelto</span>
                      } @else if (m.pendiente) {
                        <span
                          [class]="m.nivel_pendiente === 'alto' ? 'badge-danger' : m.nivel_pendiente === 'medio' ? 'badge-warning' : 'badge-info'"
                        >Pendiente - {{ m.nivel_pendiente }}</span>
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
                    <td>
                      <div class="flex items-center gap-1">
                        <a [routerLink]="['/estado-diario', m.id]" class="btn-outline btn-sm">Detalle</a>
                        @if (!m.leido) {
                          <button (click)="onMarcarLeido(m.id)" class="btn-success btn-sm">Resolver</button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="9" class="text-center py-10 text-neutral-400">
                      No se encontraron movimientos
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
  filterFecha = '';
  filterRut = '';

  title = computed(() => (this.isOrigen() ? 'Movimientos del Origen' : 'Movimientos'));

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
          this.notification.error('Error al cargar movimientos');
        },
      });
    } else {
      const params: Record<string, unknown> = { page: this.currentPage(), limit: 20 };
      if (this.filterJurisdiccion) params['jurisdiccion'] = this.filterJurisdiccion;
      if (this.filterFecha) params['fecha'] = this.filterFecha;
      if (this.filterRut) params['rut'] = this.filterRut;

      this.service.getMovimientos(this.activeTab(), params as any).subscribe({
        next: (res) => {
          this.movimientos.set(res.movimientos);
          this.total.set(res.total);
          this.currentPage.set(res.page);
          this.totalPages.set(res.total_pages);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notification.error('Error al cargar movimientos');
        },
      });
    }
  }

  /** Totales por estado para los contadores de las pestañas (respetan los filtros activos). */
  loadCounts(): void {
    const params: { jurisdiccion?: number; fecha?: string; rut?: string; page: number; limit: number } = {
      page: 1,
      limit: 1,
    };
    if (this.filterJurisdiccion) params.jurisdiccion = this.filterJurisdiccion;
    if (this.filterFecha) params.fecha = this.filterFecha;
    if (this.filterRut) params.rut = this.filterRut;

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
    this.loadData();
    this.loadCounts();
  }

  onClearFilters(): void {
    this.filterJurisdiccion = null;
    this.filterFecha = '';
    this.filterRut = '';
    this.onFilter();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadData();
  }

  onMarcarLeido(id: number): void {
    this.service.marcarLeido(id).subscribe({
      next: () => {
        this.notification.success('Marcado como resuelto');
        this.loadData();
        if (!this.isOrigen()) this.loadCounts();
      },
      error: () => this.notification.error('Error al marcar como resuelto'),
    });
  }
}
