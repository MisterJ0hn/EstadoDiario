import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import { EstadoDiarioOrigen, TipoOrigen } from '@core/models/estado-diario.model';

@Component({
  selector: 'app-origenes-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Archivos</h1>
          <p class="text-neutral-500 mt-1">{{ subtitulo() }}</p>
        </div>
        <a routerLink="/estado-diario/upload" class="btn-primary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Cargar Archivo
        </a>
      </div>

      <!-- Pestañas por tipo de archivo -->
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
              @if (activeTab() === t.key) {
                <span class="rounded-full px-2 py-0.5 text-xs font-semibold bg-primary-100 text-primary-700">
                  {{ total() }}
                </span>
              }
            </button>
          }
        </nav>
      </div>

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
                  <th>ID</th>
                  <th>RUT</th>
                  <th>Fecha</th>
                  <th>Archivo</th>
                  <th>Fecha Carga</th>
                  <th>Usuario</th>
                  <th>{{ columnaContador() }}</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (o of origenes(); track o.id) {
                  <tr>
                    <td class="font-medium">{{ o.id }}</td>
                    <td>{{ o.rut || '-' }}</td>
                    <td>{{ o.fecha || '-' }}</td>
                    <td class="max-w-[200px] truncate" [title]="o.nombre_archivo || ''">{{ o.nombre_archivo || '-' }}</td>
                    <td>{{ o.fecha_carga | date:'dd/MM/yyyy HH:mm' }}</td>
                    <td>{{ o.usuario_carga || '-' }}</td>
                    <td>
                      <span class="badge-info">{{ o.total_movimientos }}</span>
                    </td>
                    <td>
                      <div class="flex items-center gap-2">
                        <a [routerLink]="verLink(o)" [queryParams]="verQueryParams(o)"
                           class="btn-outline btn-sm">Ver</a>
                        <!--
                          Botón "Eliminar" oculto por decisión de negocio: los archivos
                          cargados no se borran desde la interfaz. El método onDelete() y el
                          llamado a deleteOrigen() se mantienen intactos a propósito.
                          Para reactivarlo, cambiar la condición del bloque de abajo de
                          false a true (o eliminar el bloque y dejar el botón suelto).
                        -->
                        @if (false) {
                          <button (click)="onDelete(o.id)" class="btn-danger btn-sm">Eliminar</button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="text-center py-10 text-neutral-400">
                      No hay archivos cargados
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
                Mostrando página {{ currentPage() }} de {{ totalPages() }} ({{ total() }} registros)
              </span>
              <div class="flex gap-2">
                <button (click)="loadPage(currentPage() - 1)" [disabled]="currentPage() <= 1"
                        class="btn-secondary btn-sm">Anterior</button>
                <button (click)="loadPage(currentPage() + 1)" [disabled]="currentPage() >= totalPages()"
                        class="btn-secondary btn-sm">Siguiente</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class OrigenesListComponent implements OnInit {
  private service = inject(EstadoDiarioService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  /** Los dos tipos de Excel que maneja el sistema; el `key` es el valor que espera el backend. */
  readonly tabs: { key: TipoOrigen; label: string }[] = [
    { key: 'estado_diario', label: 'Estado Diario' },
    { key: 'movimientos', label: 'Movimientos' },
  ];

  origenes = signal<EstadoDiarioOrigen[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);

  activeTab = signal<TipoOrigen>('estado_diario');

  subtitulo = computed(() =>
    this.activeTab() === 'movimientos'
      ? 'Archivos de movimientos cargados'
      : 'Archivos de estado diario cargados'
  );

  /** El contador de filas por archivo significa algo distinto en cada pestaña. */
  columnaContador = computed(() =>
    this.activeTab() === 'movimientos' ? 'Movimientos' : 'Estado Diario'
  );

  ngOnInit(): void {
    const queryTab = this.route.snapshot.queryParamMap.get('tab');
    this.activeTab.set(this.normalizeTab(queryTab) ?? 'estado_diario');
    this.loadPage(1);
  }

  private normalizeTab(value: string | null): TipoOrigen | null {
    return this.tabs.some((t) => t.key === value) ? (value as TipoOrigen) : null;
  }

  selectTab(tab: TipoOrigen): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.loadPage(1);
  }

  /**
   * "Ver" lleva a la vista que corresponde al tipo de archivo: el estado diario
   * tiene su listado por origen, y los movimientos se filtran por `origen_id`
   * en el módulo Movimientos.
   */
  verLink(o: EstadoDiarioOrigen): (string | number)[] {
    return o.tipo === 'movimientos'
      ? ['/movimientos']
      : ['/estado-diario/origen', o.id, 'movimientos'];
  }

  verQueryParams(o: EstadoDiarioOrigen): Record<string, number> | null {
    return o.tipo === 'movimientos' ? { origen_id: o.id } : null;
  }

  loadPage(page: number): void {
    this.loading.set(true);
    this.service.getOrigenes(page, 20, this.activeTab()).subscribe({
      next: (res) => {
        this.origenes.set(res.origenes);
        this.currentPage.set(res.page);
        this.totalPages.set(res.total_pages);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error('Error al cargar los archivos');
      },
    });
  }

  onDelete(id: number): void {
    if (!confirm('¿Está seguro de eliminar este archivo y todo su estado diario?')) return;

    this.service.deleteOrigen(id).subscribe({
      next: () => {
        this.notification.success('Archivo eliminado correctamente');
        this.loadPage(this.currentPage());
      },
      error: () => this.notification.error('Error al eliminar'),
    });
  }
}
