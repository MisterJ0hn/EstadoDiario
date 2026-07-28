import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import { Movimiento, Jurisdiccion } from '@core/models/estado-diario.model';

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

      <!-- Filters -->
      @if (filterType() !== 'origen') {
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
                        <span class="badge-success">Leído</span>
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
                          <button (click)="onMarcarLeido(m.id)" class="btn-success btn-sm">Leído</button>
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

  movimientos = signal<Movimiento[]>([]);
  jurisdicciones = signal<Jurisdiccion[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);

  filterType = signal<'no-leidos' | 'leidos' | 'pendientes' | 'origen'>('no-leidos');
  filterJurisdiccion: number | null = null;
  filterFecha = '';
  filterRut = '';

  title = computed(() => {
    switch (this.filterType()) {
      case 'leidos': return 'Movimientos Leídos';
      case 'pendientes': return 'Movimientos Pendientes';
      case 'origen': return 'Movimientos del Origen';
      default: return 'Movimientos No Leídos';
    }
  });

  ngOnInit(): void {
    const filter = this.route.snapshot.data['filter'] || 'no-leidos';
    this.filterType.set(filter);

    if (filter !== 'origen') {
      this.service.getJurisdicciones().subscribe({
        next: (res) => this.jurisdicciones.set(res.jurisdicciones),
      });
    }

    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    if (this.filterType() === 'origen') {
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

      this.service.getMovimientos(this.filterType() as 'no-leidos' | 'leidos' | 'pendientes', params as any).subscribe({
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

  onFilter(): void {
    this.currentPage.set(1);
    this.loadData();
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
        this.notification.success('Marcado como leído');
        this.loadData();
      },
      error: () => this.notification.error('Error al marcar como leído'),
    });
  }
}
