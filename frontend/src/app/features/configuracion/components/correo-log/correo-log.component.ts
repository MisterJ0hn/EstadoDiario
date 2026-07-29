import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfiguracionCorreoService } from '../../services/configuracion-correo.service';
import { NotificationService } from '@core/services/notification.service';
import { CorreoLog, ResultadoCorreo } from '@core/models/configuracion-correo.model';

@Component({
  selector: 'app-correo-log',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Bitácora de Importación por Correo</h1>
          <p class="text-neutral-500 mt-1">
            Registro de cada mensaje evaluado, incluidos los descartados
          </p>
        </div>
        <a routerLink="/configuracion/correo" class="btn-secondary shrink-0">Configuración</a>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <label class="form-label mb-0">Filtrar por resultado</label>
            <select class="form-input w-auto" [(ngModel)]="filtro" (ngModelChange)="cargar(1)">
              <option value="">Todos</option>
              <option value="importado">Importados</option>
              <option value="descartado">Descartados</option>
              <option value="duplicado">Duplicados</option>
              <option value="error">Errores</option>
              <option value="conexion">Fallas de conexión</option>
            </select>
            <button (click)="cargar(page())" class="btn-secondary text-sm">Actualizar</button>
          </div>

          @if (cargando()) {
            <p class="text-neutral-500 py-8 text-center">Cargando...</p>
          } @else if (registros().length === 0) {
            <p class="text-neutral-500 py-8 text-center">No hay registros para este filtro.</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-neutral-500 border-b border-neutral-200">
                    <th class="py-2 pr-4 font-medium">Fecha</th>
                    <th class="py-2 pr-4 font-medium">Resultado</th>
                    <th class="py-2 pr-4 font-medium">Archivo</th>
                    <th class="py-2 pr-4 font-medium">Remitente</th>
                    <th class="py-2 pr-4 font-medium">Detalle</th>
                    <th class="py-2 pr-4 font-medium">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of registros(); track r.id) {
                    <tr class="border-b border-neutral-100 align-top">
                      <td class="py-2 pr-4 whitespace-nowrap text-neutral-600">
                        {{ r.fecha | date: 'dd/MM/yy HH:mm' }}
                        <span class="block text-xs text-neutral-400">{{ r.disparo }}</span>
                      </td>
                      <td class="py-2 pr-4">
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium" [class]="claseBadge(r.resultado)">
                          {{ etiqueta(r.resultado) }}
                        </span>
                      </td>
                      <td class="py-2 pr-4 text-neutral-700 break-all">{{ r.nombre_archivo || '—' }}</td>
                      <td class="py-2 pr-4 text-neutral-600 break-all">{{ r.remitente || '—' }}</td>
                      <td class="py-2 pr-4 text-neutral-600">{{ r.detalle || '—' }}</td>
                      <td class="py-2 pr-4 whitespace-nowrap">
                        @if (r.estado_diario_origen_id) {
                          <a [routerLink]="['/estado-diario/origen', r.estado_diario_origen_id, 'movimientos']"
                             class="text-primary-600 hover:underline">
                            Ver {{ r.movimientos_importados }} mov.
                          </a>
                        } @else { — }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (totalPages() > 1) {
              <div class="flex items-center justify-between mt-4">
                <span class="text-sm text-neutral-500">
                  Página {{ page() }} de {{ totalPages() }} ({{ total() }} registros)
                </span>
                <div class="flex gap-2">
                  <button (click)="cargar(page() - 1)" class="btn-secondary text-sm" [disabled]="page() <= 1">
                    Anterior
                  </button>
                  <button (click)="cargar(page() + 1)" class="btn-secondary text-sm" [disabled]="page() >= totalPages()">
                    Siguiente
                  </button>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class CorreoLogComponent implements OnInit {
  private service = inject(ConfiguracionCorreoService);
  private notification = inject(NotificationService);

  filtro = '';
  registros = signal<CorreoLog[]>([]);
  cargando = signal(true);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

  ngOnInit(): void {
    this.cargar(1);
  }

  cargar(page: number): void {
    if (page < 1) return;
    this.cargando.set(true);

    this.service.getLog(page, 20, this.filtro || undefined).subscribe({
      next: (res) => {
        this.registros.set(res.registros);
        this.page.set(res.page);
        this.totalPages.set(res.total_pages);
        this.total.set(res.total);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.notification.error('No se pudo cargar la bitácora');
      },
    });
  }

  etiqueta(resultado: ResultadoCorreo): string {
    const mapa: Record<ResultadoCorreo, string> = {
      importado: 'Importado',
      descartado: 'Descartado',
      duplicado: 'Duplicado',
      error: 'Error',
      conexion: 'Conexión',
    };
    return mapa[resultado] ?? resultado;
  }

  claseBadge(resultado: ResultadoCorreo): string {
    const mapa: Record<ResultadoCorreo, string> = {
      importado: 'bg-accent-100 text-accent-700',
      descartado: 'bg-neutral-100 text-neutral-600',
      duplicado: 'bg-neutral-100 text-neutral-600',
      error: 'bg-danger-100 text-danger-700',
      conexion: 'bg-danger-100 text-danger-700',
    };
    return mapa[resultado] ?? 'bg-neutral-100 text-neutral-600';
  }
}
