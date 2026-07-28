import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import { EstadoDiarioOrigen } from '@core/models/estado-diario.model';

@Component({
  selector: 'app-origenes-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Orígenes</h1>
          <p class="text-neutral-500 mt-1">Archivos de estado diario cargados</p>
        </div>
        <a routerLink="/estado-diario/upload" class="btn-primary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Cargar Archivo
        </a>
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
                  <th>Movimientos</th>
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
                        <a [routerLink]="['/estado-diario/origen', o.id, 'movimientos']"
                           class="btn-outline btn-sm">Ver</a>
                        <button (click)="onDelete(o.id)" class="btn-danger btn-sm">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="text-center py-10 text-neutral-400">
                      No hay orígenes cargados
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

  origenes = signal<EstadoDiarioOrigen[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);

  ngOnInit(): void {
    this.loadPage(1);
  }

  loadPage(page: number): void {
    this.loading.set(true);
    this.service.getOrigenes(page).subscribe({
      next: (res) => {
        this.origenes.set(res.origenes);
        this.currentPage.set(res.page);
        this.totalPages.set(res.total_pages);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error('Error al cargar orígenes');
      },
    });
  }

  onDelete(id: number): void {
    if (!confirm('¿Está seguro de eliminar este origen y todos sus movimientos?')) return;

    this.service.deleteOrigen(id).subscribe({
      next: () => {
        this.notification.success('Origen eliminado correctamente');
        this.loadPage(this.currentPage());
      },
      error: () => this.notification.error('Error al eliminar'),
    });
  }
}
