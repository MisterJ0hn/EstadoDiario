import { Component, inject, signal, OnInit, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import {
  Movimiento,
  Jurisdiccion,
  FechaInicialResponse,
} from '@core/models/estado-diario.model';
import { RecordatorioModalComponent } from '../recordatorio-modal/recordatorio-modal.component';
import {
  ChipFiltro,
  FiltrosPanelComponent,
} from '@shared/components/filtros-panel/filtros-panel.component';
import { etiquetaFecha, fmtFechaChip } from '@shared/fecha-estado-diario';

type Tab = 'no-leidos' | 'leidos' | 'pendientes';

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
                  <th>Rit/Rol</th>
                  <th>Ruc/RolUnico</th>
                  <th>FechaIngreso</th>
                  <th>Caratulado</th>
                  <th>Tribunal</th>
                  <th>TipoCausa</th>
                  <th>Estado</th>
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
                    <td>{{ m.rol_unico || '-' }}</td>
                    <td class="whitespace-nowrap">{{ m.fecha_ingreso || '-' }}</td>
                    <td class="max-w-[200px] truncate" [title]="m.caratulado || ''">
                      <a [routerLink]="['/estado-diario', m.id]" class="hover:text-primary-600 hover:underline">
                        {{ m.caratulado || '-' }}
                      </a>
                    </td>
                    <td>{{ m.tribunal || '-' }}</td>
                    <td>{{ m.tipo_causa || '-' }}</td>
                    <td>
                      @if (m.leido) {
                        <span class="badge-success">Resuelto</span>
                      } @else if (m.pendiente) {
                        <span [class]="claseNivel(m.nivel_pendiente)">Pendiente - {{ m.nivel_pendiente }}</span>
                      } @else {
                        <span class="badge-neutral">No leído</span>
                      }
                    </td>
                    <td>
                      <!-- Los dos botones sueltos, no dentro de un desplegable:
                           son las dos únicas acciones de la fila y son las que
                           se usan todo el día. Mismos colores que en el detalle
                           del movimiento, para que la acción se reconozca igual
                           en las dos pantallas. -->
                      @if (!m.leido) {
                        <div class="inline-flex items-center gap-2 align-middle">
                          <!-- Solo icono: title da el tooltip, que es lo único
                               que queda para descubrir qué hace el botón, y
                               aria-label el nombre accesible — sin texto
                               adentro, un lector de pantalla anunciaría "botón"
                               y nada más.
                               (Sin backticks en este comentario: el template es
                               un template literal y lo cerrarían.)
                               Sin confirmación: marca resuelto de inmediato. -->
                          <button (click)="onResolver(m.id)" class="btn-success btn-sm"
                                  title="Marcar como resuelto" aria-label="Marcar como resuelto">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <!-- "Pendiente" abre el modal de recordatorio: marcar
                               pendiente y agendar son una sola acción. De ahí el
                               reloj y no un signo de admiración: lo que se elige
                               ahí es para cuándo queda agendado. -->
                          <button (click)="onPendiente(m.id)" class="btn-warning btn-sm"
                                  title="Marcar como pendiente" aria-label="Marcar como pendiente">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        </div>
                      } @else if (activeTab() === 'leidos') {
                        <!-- Solo tiene sentido en la pestaña Resueltos: deshace
                             el "resuelto" y el registro vuelve a No Leídos. -->
                        <button (click)="onNoResuelto(m.id)" class="btn-outline btn-sm"
                                title="Volver a No Leído" aria-label="Volver a No Leído">
                          No resuelto
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="text-center py-10 text-neutral-400">
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
  /**
   * De dónde salió la fecha que está puesta: "ayer", "ultimo" o null si la
   * eligió el usuario. Solo cambia el rótulo del chip — sin él, un día de hace
   * dos semanas parece un error de la aplicación y no el último con datos.
   */
  motivoFecha: FechaInicialResponse['motivo'] = null;

  /** Filtros ya aplicados, los que se ven como badges. */
  readonly chipsFiltros = signal<ChipFiltro[]>([]);
  private readonly panel = viewChild(FiltrosPanelComponent);

  /**
   * Id del registro para el que está abierto el modal de recordatorio; null = cerrado.
   * Marcar "Pendiente" y agendar son una sola acción: el modal registra el
   * recordatorio y deja el registro en estado pendiente con el nivel elegido ahí.
   */
  recordatorioMovimientoId = signal<number | null>(null);

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

    // Sin las de corte: esas causas se movieron a su propia tabla y filtrar
    // por ellas acá no devolvería nada.
    this.service.getJurisdicciones(true).subscribe({
      next: (res) => this.jurisdicciones.set(res.jurisdicciones),
    });

    // El día por defecto se pide ANTES de la primera consulta y no en paralelo:
    // cargar todo el histórico para reemplazarlo medio segundo después haría
    // dos consultas pesadas y un parpadeo de contenido en pantalla.
    this.service.getFechaInicial().subscribe({
      next: (res) => {
        this.aplicarFechaInicial(res);
        this.loadData();
        this.loadCounts();
      },
      // Sin fecha sugerida se muestra todo, que es como funcionaba antes: es
      // una comodidad, no un requisito para que la pantalla sirva.
      error: () => {
        this.loadData();
        this.loadCounts();
      },
    });
  }

  /**
   * Deja puesto el día que sugiere el backend, como filtro de UN día.
   *
   * Es solo el valor inicial: queda como chip y el usuario lo puede quitar para
   * ver todo el histórico. Por eso se escribe en los mismos campos que usaría a
   * mano y no en un filtro aparte que no pudiera sacar.
   */
  private aplicarFechaInicial(res: FechaInicialResponse): void {
    if (!res?.fecha) return;
    this.filterFechaDesde = res.fecha;
    this.filterFechaHasta = res.fecha;
    this.motivoFecha = res.motivo;
    this.sincronizarChips();
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
    this.motivoFecha = null;
    this.onFilter();
  }

  /** Quita un solo filtro desde su badge y vuelve a consultar. */
  quitarFiltro(clave: string): void {
    switch (clave) {
      case 'jurisdiccion':
        this.filterJurisdiccion = null;
        break;
      case 'fecha_dia':
        // El chip de un día son los dos extremos puestos en la misma fecha.
        this.filterFechaDesde = '';
        this.filterFechaHasta = '';
        this.motivoFecha = null;
        break;
      case 'fecha_desde':
        this.filterFechaDesde = '';
        this.motivoFecha = null;
        break;
      case 'fecha_hasta':
        this.filterFechaHasta = '';
        this.motivoFecha = null;
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
    // Un solo día se muestra como un chip y no como "Desde X" + "Hasta X":
    // es el caso del valor por defecto, y dos badges con la misma fecha se
    // leen como si fueran un rango.
    if (this.filterFechaDesde && this.filterFechaDesde === this.filterFechaHasta) {
      chips.push({
        clave: 'fecha_dia',
        etiqueta: etiquetaFecha(this.motivoFecha),
        valor: fmtFechaChip(this.filterFechaDesde),
      });
    } else {
      if (this.filterFechaDesde) {
        chips.push({ clave: 'fecha_desde', etiqueta: 'Desde', valor: fmtFechaChip(this.filterFechaDesde) });
      }
      if (this.filterFechaHasta) {
        chips.push({ clave: 'fecha_hasta', etiqueta: 'Hasta', valor: fmtFechaChip(this.filterFechaHasta) });
      }
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

  /** Sin confirmación: marca resuelto de inmediato al apretar el botón. */
  onResolver(id: number): void {
    this.service.marcarLeido(id).subscribe({
      next: () => {
        this.notification.success('Marcado como resuelto');
        this.loadData();
        if (!this.isOrigen()) this.loadCounts();
      },
      error: () => this.notification.error('Error al marcar como resuelto'),
    });
  }

  /** Deshace un "resuelto" desde la pestaña Resueltos: vuelve a No Leídos. */
  onNoResuelto(id: number): void {
    this.service.marcarNoLeido(id).subscribe({
      next: () => {
        this.notification.success('Vuelto a No Leído');
        this.loadData();
        this.loadCounts();
      },
      error: () => this.notification.error('Error al deshacer el resuelto'),
    });
  }

  /**
   * "Pendiente" abre el modal de recordatorio: ahí se elige el nivel de urgencia
   * (bajo/medio/alto), que es el que queda guardado tanto en el registro como en
   * el recordatorio. No se pregunta el nivel dos veces.
   */
  onPendiente(id: number): void {
    this.recordatorioMovimientoId.set(id);
  }

  onRecordatorioGuardado(): void {
    this.recordatorioMovimientoId.set(null);
    this.loadData();
    this.loadCounts();
  }
}
