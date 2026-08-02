import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MovimientoService } from './services/movimiento.service';
import { NotificationService } from '@core/services/notification.service';
import { ConteoMateria, Movimiento, MovimientoFiltros } from '@core/models/movimiento.model';

/**
 * Listado del módulo Movimientos: estado procesal de las causas.
 *
 * SOLO CONSULTA. A diferencia del estado diario aquí no hay acciones (leído,
 * pendiente, agendar, resolver) porque este reporte no es una bandeja de
 * trabajo, solo informa en qué va cada causa.
 *
 * Columnas: `era`, `corte`, `ubicacion` y `fecha_ubicacion` solo vienen en las
 * hojas de Corte (Corte Apelaciones / Corte Suprema). Para no dejar columnas en
 * blanco en el grueso de las filas:
 *  - la tabla base no las incluye;
 *  - cuando la pestaña activa es una materia de Corte se agregan como columnas
 *    (ahí sí vienen pobladas);
 *  - en cualquier pestaña, cada fila se puede expandir y muestra solo los
 *    campos que efectivamente traen dato.
 */
@Component({
  selector: 'app-movimientos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Movimientos</h1>
          <p class="text-neutral-500 mt-1">
            Estado procesal de las causas — {{ total() }} registros encontrados
          </p>
        </div>
      </div>

      <!-- Se llegó acotado a un archivo concreto desde la vista Archivos -->
      @if (filtroOrigenId) {
        <div class="alert-info flex items-center justify-between gap-4">
          <span>Mostrando solo los movimientos del archivo #{{ filtroOrigenId }}.</span>
          <button (click)="quitarFiltroArchivo()" class="btn-secondary btn-sm shrink-0">Ver todos</button>
        </div>
      }

      <!-- Pestañas por materia (las alimenta /movimientos/resumen) -->
      <div class="border-b border-neutral-200">
        <nav class="-mb-px flex gap-1 overflow-x-auto" role="tablist">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="materiaActiva() === null"
            (click)="seleccionarMateria(null)"
            class="flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors"
            [class]="materiaActiva() === null
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'"
          >
            Todas
            <span class="rounded-full px-2 py-0.5 text-xs font-semibold"
                  [class]="materiaActiva() === null ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'">
              {{ totalResumen() }}
            </span>
          </button>
          @for (c of materias(); track c.materia) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="materiaActiva() === c.materia"
              (click)="seleccionarMateria(c.materia)"
              class="flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              [class]="materiaActiva() === c.materia
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'"
            >
              {{ c.materia || 'Sin materia' }}
              <span class="rounded-full px-2 py-0.5 text-xs font-semibold"
                    [class]="materiaActiva() === c.materia ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'">
                {{ c.total }}
              </span>
            </button>
          }
        </nav>
      </div>

      <!-- Filtros -->
      <div class="card">
        <div class="card-body">
          <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div class="md:col-span-2">
              <label class="form-label">Búsqueda</label>
              <input type="text" class="form-input" [(ngModel)]="filtroBusqueda"
                     placeholder="Carátula o rol" (keyup.enter)="onFiltrar()" />
            </div>
            <div>
              <label class="form-label">Estado de la causa</label>
              <select class="form-select" [(ngModel)]="filtroEstadoCausa" (ngModelChange)="onFiltrar()">
                <option [ngValue]="''">Todos</option>
                @for (e of estadosCausa(); track e) {
                  <option [ngValue]="e">{{ e }}</option>
                }
              </select>
            </div>
            <div>
              <label class="form-label">Tribunal</label>
              <input type="text" class="form-input" [(ngModel)]="filtroTribunal"
                     placeholder="Coincidencia parcial" (keyup.enter)="onFiltrar()" />
            </div>
            <div class="flex items-end gap-2">
              <button (click)="onFiltrar()" class="btn-primary">Filtrar</button>
              <button (click)="onLimpiarFiltros()" class="btn-secondary">Limpiar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabla -->
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
                  <th class="w-8"></th>
                  @if (materiaActiva() === null) {
                    <th>Materia</th>
                  }
                  <th>Rol</th>
                  @if (esMateriaCorte()) {
                    <th>Era</th>
                  }
                  <th>Carátula</th>
                  @if (esMateriaCorte()) {
                    <th>Corte</th>
                  } @else {
                    <th>Tribunal</th>
                  }
                  <th>Estado de la causa</th>
                  @if (esMateriaCorte()) {
                    <th>Ubicación</th>
                  }
                  <th>F. Ingreso</th>
                  <th>RUT</th>
                </tr>
              </thead>
              <tbody>
                @for (m of movimientos(); track m.id) {
                  <tr class="cursor-pointer" (click)="alternarDetalle(m.id)">
                    <td class="text-neutral-400">
                      <svg class="w-4 h-4 transition-transform" [class.rotate-90]="detalleAbiertoId() === m.id"
                           fill="none" stroke="currentColor" viewBox="0 0 24 24"
                           [attr.aria-label]="detalleAbiertoId() === m.id ? 'Ocultar detalle' : 'Ver detalle'">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                    @if (materiaActiva() === null) {
                      <td>
                        @if (m.materia) {
                          <span class="badge-neutral">{{ m.materia }}</span>
                        } @else { - }
                      </td>
                    }
                    <td class="font-medium">{{ m.rol || '-' }}</td>
                    @if (esMateriaCorte()) {
                      <td>{{ m.era || '-' }}</td>
                    }
                    <td class="max-w-[280px] truncate" [title]="m.caratulado || ''">{{ m.caratulado || '-' }}</td>
                    @if (esMateriaCorte()) {
                      <td class="max-w-[200px] truncate" [title]="m.corte || ''">{{ m.corte || '-' }}</td>
                    } @else {
                      <td class="max-w-[200px] truncate" [title]="m.tribunal || ''">{{ m.tribunal || '-' }}</td>
                    }
                    <td>
                      @if (m.estado_causa) {
                        <span class="badge-info">{{ m.estado_causa }}</span>
                      } @else { - }
                    </td>
                    @if (esMateriaCorte()) {
                      <td class="max-w-[180px] truncate" [title]="m.ubicacion || ''">{{ m.ubicacion || '-' }}</td>
                    }
                    <td>{{ fmtFecha(m.fecha_ingreso) }}</td>
                    <td>{{ m.rut || '-' }}</td>
                  </tr>

                  <!-- Detalle expandible: solo los campos con dato. Es la forma de
                       mostrar era/corte/ubicación en las materias donde vienen
                       esporádicamente, sin columnas vacías en la tabla. -->
                  @if (detalleAbiertoId() === m.id) {
                    <tr class="bg-neutral-50">
                      <td [attr.colspan]="colspan()" class="whitespace-normal">
                        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
                          @for (d of detalle(m); track d.etiqueta) {
                            <div>
                              <dt class="text-xs text-neutral-500 uppercase tracking-wide">{{ d.etiqueta }}</dt>
                              <dd class="text-sm text-neutral-800 mt-0.5 break-words">{{ d.valor }}</dd>
                            </div>
                          } @empty {
                            <div class="text-sm text-neutral-400">Sin datos adicionales para este registro</div>
                          }
                        </dl>
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr>
                    <td [attr.colspan]="colspan()" class="text-center py-10 text-neutral-400">
                      No se encontraron movimientos
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Paginación -->
          @if (totalPages() > 1) {
            <div class="flex items-center justify-between px-6 py-4 border-t border-neutral-200">
              <span class="text-sm text-neutral-500">
                Página {{ currentPage() }} de {{ totalPages() }} ({{ total() }} registros)
              </span>
              <div class="flex gap-2">
                <button (click)="irAPagina(currentPage() - 1)" [disabled]="currentPage() <= 1"
                        class="btn-secondary btn-sm">Anterior</button>
                <button (click)="irAPagina(currentPage() + 1)" [disabled]="currentPage() >= totalPages()"
                        class="btn-secondary btn-sm">Siguiente</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class MovimientosComponent implements OnInit {
  private service = inject(MovimientoService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  movimientos = signal<Movimiento[]>([]);
  materias = signal<ConteoMateria[]>([]);
  estadosCausa = signal<string[]>([]);
  totalResumen = signal(0);

  loading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);

  /** null = pestaña "Todas". Se refleja en el query param `materia`. */
  materiaActiva = signal<string | null>(null);
  detalleAbiertoId = signal<number | null>(null);

  filtroBusqueda = '';
  filtroEstadoCausa = '';
  filtroTribunal = '';
  filtroRut = '';
  /** Fijado por query param cuando se entra desde un archivo concreto; no se edita en pantalla. */
  filtroOrigenId: number | undefined;

  /** Las hojas de Corte son las únicas que traen era / corte / ubicación. */
  esMateriaCorte = computed(() => (this.materiaActiva() ?? '').toLowerCase().startsWith('corte'));

  /** Columnas visibles, para el colspan de las filas de detalle y del estado vacío. */
  colspan = computed(() => {
    // Base: chevron + rol + carátula + tribunal/corte + estado + fecha ingreso + rut
    let columnas = 7;
    if (this.materiaActiva() === null) columnas += 1; // Materia
    if (this.esMateriaCorte()) columnas += 2; // Era + Ubicación
    return columnas;
  });

  ngOnInit(): void {
    const materia = this.route.snapshot.queryParamMap.get('materia');
    this.materiaActiva.set(materia || null);

    // Se llega con ?origen_id=N desde la pestaña "Movimientos" de Archivos.
    const origenId = Number(this.route.snapshot.queryParamMap.get('origen_id'));
    this.filtroOrigenId = Number.isFinite(origenId) && origenId > 0 ? origenId : undefined;

    this.cargarResumen();
    this.cargarDatos();
  }

  /** Fechas ISO (yyyy-MM-dd) a dd-MM-yyyy sin pasar por Date, que desplaza el día por zona horaria. */
  fmtFecha(valor: string | null): string {
    if (!valor) return '-';
    const partes = valor.slice(0, 10).split('-');
    return partes.length === 3 ? `${partes[2]}-${partes[1]}-${partes[0]}` : valor;
  }

  /** Campos que no están en la tabla; se omiten los vacíos. */
  detalle(m: Movimiento): { etiqueta: string; valor: string }[] {
    const campos: { etiqueta: string; valor: string | null }[] = [
      { etiqueta: 'Materia', valor: m.materia },
      { etiqueta: 'Tribunal', valor: m.tribunal },
      { etiqueta: 'Corte', valor: m.corte },
      { etiqueta: 'Era', valor: m.era },
      { etiqueta: 'Institución', valor: m.institucion },
      { etiqueta: 'Ubicación', valor: m.ubicacion },
      { etiqueta: 'Fecha ubicación', valor: m.fecha_ubicacion ? this.fmtFecha(m.fecha_ubicacion) : null },
      { etiqueta: 'Fecha del archivo', valor: m.fecha_archivo ? this.fmtFecha(m.fecha_archivo) : null },
      { etiqueta: 'Archivo', valor: m.nombre_archivo },
    ];
    return campos
      .filter((c) => !!c.valor && String(c.valor).trim() !== '')
      .map((c) => ({ etiqueta: c.etiqueta, valor: String(c.valor) }));
  }

  alternarDetalle(id: number): void {
    this.detalleAbiertoId.set(this.detalleAbiertoId() === id ? null : id);
  }

  seleccionarMateria(materia: string | null): void {
    if (this.materiaActiva() === materia) return;
    this.materiaActiva.set(materia);
    this.currentPage.set(1);
    this.detalleAbiertoId.set(null);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { materia: materia || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.loading.set(true);
    this.service
      .getMovimientos({
        ...this.filtros(),
        materia: this.materiaActiva() || undefined,
        page: this.currentPage(),
        limit: 20,
      })
      .subscribe({
        next: (res) => {
          this.movimientos.set(res.movimientos);
          this.total.set(res.total);
          this.currentPage.set(res.page);
          this.totalPages.set(res.total_pages);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notification.error('Error al cargar los movimientos');
        },
      });
  }

  /** Conteos por materia y estados de causa disponibles; respeta los filtros activos. */
  cargarResumen(): void {
    this.service.getResumen(this.filtros()).subscribe({
      next: (res) => {
        this.materias.set(res.por_materia);
        this.totalResumen.set(res.total);
        this.estadosCausa.set(res.estados_causa);
      },
      error: () => {
        this.materias.set([]);
        this.estadosCausa.set([]);
      },
    });
  }

  private filtros(): MovimientoFiltros {
    return {
      busqueda: this.filtroBusqueda || undefined,
      estado_causa: this.filtroEstadoCausa || undefined,
      tribunal: this.filtroTribunal || undefined,
      rut: this.filtroRut || undefined,
      origen_id: this.filtroOrigenId,
    };
  }

  onFiltrar(): void {
    this.currentPage.set(1);
    this.detalleAbiertoId.set(null);
    this.cargarDatos();
    this.cargarResumen();
  }

  onLimpiarFiltros(): void {
    this.filtroBusqueda = '';
    this.filtroEstadoCausa = '';
    this.filtroTribunal = '';
    this.filtroRut = '';
    this.onFiltrar();
  }

  quitarFiltroArchivo(): void {
    this.filtroOrigenId = undefined;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { origen_id: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.onFiltrar();
  }

  irAPagina(page: number): void {
    this.currentPage.set(page);
    this.detalleAbiertoId.set(null);
    this.cargarDatos();
  }
}
