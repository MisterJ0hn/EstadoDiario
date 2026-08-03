import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AudienciaService } from './services/audiencia.service';
import { NotificationService } from '@core/services/notification.service';
import {
  Audiencia,
  AudienciaFiltros,
  ConteoMateriaAudiencia,
} from '@core/models/audiencia.model';
import {
  ChipFiltro,
  FiltrosPanelComponent,
} from '@shared/components/filtros-panel/filtros-panel.component';

/** Filas agrupadas por día, que es como se lee una agenda. */
interface GrupoDia {
  fecha: string;
  etiqueta: string;
  esHoy: boolean;
  audiencias: Audiencia[];
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** yyyy-MM-dd de una fecha local, sin pasar por toISOString (que va a UTC). */
function claveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Próximas audiencias: las que el tribunal ya fijó, de hoy en adelante.
 *
 * SOLO CONSULTA, igual que Movimientos: no hay leído / pendiente / agendar
 * porque la audiencia la fija el tribunal, no el estudio.
 *
 * Dos decisiones de presentación:
 *  - Se agrupa por día en vez de mostrar una tabla plana. Una agenda se lee por
 *    jornada ("qué tengo el jueves"), no fila por fila.
 *  - El default es desde hoy; ver el histórico es explícito ("Incluir pasadas"),
 *    porque una audiencia de la semana pasada ya no es accionable.
 *
 * Columnas: `rol` (Rit) y `caratulado` no vienen en la hoja Penal, y `estado`
 * solo viene ahí. Por eso la tabla muestra lo común y cada fila se expande con
 * los campos que efectivamente traen dato.
 */
@Component({
  selector: 'app-audiencias',
  standalone: true,
  imports: [CommonModule, FormsModule, FiltrosPanelComponent],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Próximas audiencias</h1>
          <p class="text-neutral-500 mt-1">
            {{ incluirPasadas() ? 'Todas las audiencias' : 'Audiencias fijadas de hoy en adelante' }}
            — {{ total() }} {{ total() === 1 ? 'audiencia' : 'audiencias' }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="alternarPasadas()" class="btn-secondary btn-sm">
            {{ incluirPasadas() ? 'Ver solo próximas' : 'Incluir pasadas' }}
          </button>
          <button (click)="sincronizarGoogle()" class="btn-outline btn-sm" [disabled]="sincronizando()">
            {{ sincronizando() ? 'Publicando...' : 'Publicar en Google Calendar' }}
          </button>
        </div>
      </div>

      <!-- Se llegó acotado a un archivo concreto desde la vista Archivos -->
      @if (filtroOrigenId) {
        <div class="alert-info flex items-center justify-between gap-4">
          <span>Mostrando solo las audiencias del archivo #{{ filtroOrigenId }}.</span>
          <button (click)="quitarFiltroArchivo()" class="btn-secondary btn-sm shrink-0">Ver todas</button>
        </div>
      }

      <!-- Pestañas por materia (las alimenta /audiencias/resumen) -->
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

      <!-- Filtros: campos en el panel lateral, badges de lo aplicado acá. -->
      <app-filtros-panel
        [chips]="chipsFiltros()"
        (aplicar)="onFiltrar()"
        (limpiar)="onLimpiarFiltros()"
        (quitar)="quitarFiltro($event)"
      >
        <div>
          <label class="form-label" for="a-busqueda">Búsqueda</label>
          <input id="a-busqueda" type="text" class="form-input" [(ngModel)]="filtroBusqueda"
                 placeholder="Carátula, RIT o RUC" (keyup.enter)="aplicarDesdeCampo()" />
        </div>
        <div>
          <label class="form-label" for="a-tipo">Tipo de audiencia</label>
          <select id="a-tipo" class="form-select" [(ngModel)]="filtroTipo">
            <option [ngValue]="''">Todos</option>
            @for (t of tiposAudiencia(); track t) {
              <option [ngValue]="t">{{ t }}</option>
            }
          </select>
        </div>
        <div>
          <label class="form-label" for="a-tribunal">Tribunal</label>
          <input id="a-tribunal" type="text" class="form-input" [(ngModel)]="filtroTribunal"
                 placeholder="Coincidencia parcial" (keyup.enter)="aplicarDesdeCampo()" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label" for="a-desde">Desde</label>
            <input id="a-desde" type="date" class="form-input" [(ngModel)]="filtroDesde" />
          </div>
          <div>
            <label class="form-label" for="a-hasta">Hasta</label>
            <input id="a-hasta" type="date" class="form-input" [(ngModel)]="filtroHasta" />
          </div>
        </div>
      </app-filtros-panel>

      <!-- Listado agrupado por día -->
      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      } @else if (grupos().length === 0) {
        <div class="card">
          <div class="py-16 text-center text-neutral-400">
            @if (incluirPasadas()) {
              No se encontraron audiencias con esos filtros
            } @else {
              No hay audiencias próximas. Si esperaba alguna, revise que el archivo
              de audiencias se haya importado.
            }
          </div>
        </div>
      } @else {
        <div class="space-y-5">
          @for (g of grupos(); track g.fecha) {
            <div class="card">
              <div class="flex items-center gap-3 px-6 py-3 border-b border-neutral-200 bg-neutral-50">
                <span class="font-semibold text-neutral-800">{{ g.etiqueta }}</span>
                @if (g.esHoy) {
                  <span class="badge-info">Hoy</span>
                }
                <span class="text-sm text-neutral-500 ml-auto">
                  {{ g.audiencias.length }} {{ g.audiencias.length === 1 ? 'audiencia' : 'audiencias' }}
                </span>
              </div>

              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th class="w-8"></th>
                      <th class="w-20">Hora</th>
                      @if (materiaActiva() === null) {
                        <th>Materia</th>
                      }
                      <th>Tipo de audiencia</th>
                      <th>Carátula</th>
                      <th>RIT / RUC</th>
                      <th>Tribunal</th>
                      <th>Sala</th>
                      <th class="w-10" title="Publicada en Google Calendar">GCal</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (a of g.audiencias; track a.id) {
                      <tr class="cursor-pointer" (click)="alternarDetalle(a.id)">
                        <td class="text-neutral-400">
                          <svg class="w-4 h-4 transition-transform" [class.rotate-90]="detalleAbiertoId() === a.id"
                               fill="none" stroke="currentColor" viewBox="0 0 24 24"
                               [attr.aria-label]="detalleAbiertoId() === a.id ? 'Ocultar detalle' : 'Ver detalle'">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td class="font-semibold tabular-nums">{{ fmtHora(a.hora) }}</td>
                        @if (materiaActiva() === null) {
                          <td>
                            @if (a.materia) {
                              <span class="badge-neutral">{{ a.materia }}</span>
                            } @else { - }
                          </td>
                        }
                        <td class="max-w-[220px] truncate" [title]="a.tipo_audiencia || ''">
                          {{ a.tipo_audiencia || '-' }}
                        </td>
                        <td class="max-w-[240px] truncate" [title]="a.caratulado || ''">{{ a.caratulado || '-' }}</td>
                        <td class="whitespace-nowrap">{{ a.rol || a.ruc || '-' }}</td>
                        <td class="max-w-[220px] truncate" [title]="a.tribunal || ''">{{ a.tribunal || '-' }}</td>
                        <td class="whitespace-nowrap">{{ a.sala || '-' }}</td>
                        <td class="text-center">
                          @if (a.en_google_calendar) {
                            <span class="text-accent-600" title="Publicada en Google Calendar">&#10003;</span>
                          } @else {
                            <span class="text-neutral-300"
                                  [title]="a.google_sync_error || 'Todavía no publicada en Google Calendar'">&ndash;</span>
                          }
                        </td>
                      </tr>

                      <!-- Detalle expandible: solo los campos con dato. Es la forma
                           de mostrar juez, estado y procedencia sin dejar columnas
                           vacías en la tabla. -->
                      @if (detalleAbiertoId() === a.id) {
                        <tr class="bg-neutral-50">
                          <td [attr.colspan]="colspan()" class="whitespace-normal">
                            <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
                              @for (d of detalle(a); track d.etiqueta) {
                                <div>
                                  <dt class="text-xs text-neutral-500 uppercase tracking-wide">{{ d.etiqueta }}</dt>
                                  <dd class="text-sm text-neutral-800 mt-0.5 break-words">{{ d.valor }}</dd>
                                </div>
                              } @empty {
                                <div class="text-sm text-neutral-400">Sin datos adicionales para esta audiencia</div>
                              }
                            </dl>
                            @if (a.google_sync_error) {
                              <p class="text-xs text-danger-600 pb-2">
                                Google Calendar: {{ a.google_sync_error }}
                              </p>
                            }
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>

        <!-- Paginación -->
        @if (totalPages() > 1) {
          <div class="card flex items-center justify-between px-6 py-4">
            <span class="text-sm text-neutral-500">
              Página {{ currentPage() }} de {{ totalPages() }} ({{ total() }} audiencias)
            </span>
            <div class="flex gap-2">
              <button (click)="irAPagina(currentPage() - 1)" [disabled]="currentPage() <= 1"
                      class="btn-secondary btn-sm">Anterior</button>
              <button (click)="irAPagina(currentPage() + 1)" [disabled]="currentPage() >= totalPages()"
                      class="btn-secondary btn-sm">Siguiente</button>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class AudienciasComponent implements OnInit {
  private service = inject(AudienciaService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  audiencias = signal<Audiencia[]>([]);
  materias = signal<ConteoMateriaAudiencia[]>([]);
  tiposAudiencia = signal<string[]>([]);
  totalResumen = signal(0);

  loading = signal(true);
  sincronizando = signal(false);
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);

  /** null = pestaña "Todas". Se refleja en el query param `materia`. */
  materiaActiva = signal<string | null>(null);
  detalleAbiertoId = signal<number | null>(null);
  /** Por defecto solo lo que viene; el histórico es una decisión explícita. */
  incluirPasadas = signal(false);

  filtroBusqueda = '';
  filtroTipo = '';
  filtroTribunal = '';
  filtroRut = '';
  filtroDesde = '';
  filtroHasta = '';

  /** Filtros ya aplicados, los que se ven como badges. */
  readonly chipsFiltros = signal<ChipFiltro[]>([]);
  private readonly panel = viewChild(FiltrosPanelComponent);
  /** Fijado por query param cuando se entra desde un archivo; no se edita en pantalla. */
  filtroOrigenId: number | undefined;

  /** Columnas visibles, para el colspan de las filas de detalle. */
  colspan = computed(() => (this.materiaActiva() === null ? 9 : 8));

  /** Agrupación por día: una agenda se lee por jornada, no fila por fila. */
  grupos = computed<GrupoDia[]>(() => {
    const hoy = claveDia(new Date());
    const mapa = new Map<string, Audiencia[]>();

    // El backend ya entrega ordenado por fecha y hora, así que el orden de
    // inserción del Map es el orden correcto de los grupos.
    for (const a of this.audiencias()) {
      const lista = mapa.get(a.fecha_audiencia) ?? [];
      lista.push(a);
      mapa.set(a.fecha_audiencia, lista);
    }

    return [...mapa.entries()].map(([fecha, lista]) => ({
      fecha,
      etiqueta: this.etiquetaDia(fecha),
      esHoy: fecha === hoy,
      audiencias: lista,
    }));
  });

  ngOnInit(): void {
    const materia = this.route.snapshot.queryParamMap.get('materia');
    this.materiaActiva.set(materia || null);

    // Se llega con ?origen_id=N desde la pestaña "Audiencias" de Archivos, y
    // con ?busqueda=RIT desde un chip del calendario. En ambos casos se apunta a
    // algo concreto que puede estar en el pasado, así que se muestra el
    // histórico: si no, el usuario haría clic y vería una lista vacía.
    const origenId = Number(this.route.snapshot.queryParamMap.get('origen_id'));
    this.filtroOrigenId = Number.isFinite(origenId) && origenId > 0 ? origenId : undefined;

    const busqueda = this.route.snapshot.queryParamMap.get('busqueda');
    if (busqueda) this.filtroBusqueda = busqueda;

    if (this.filtroOrigenId || busqueda) this.incluirPasadas.set(true);

    this.sincronizarChips();
    this.cargarResumen();
    this.cargarDatos();
  }

  /** "Jueves 7 de agosto de 2026", sin pasar por Date (que desplaza por zona horaria). */
  private etiquetaDia(iso: string): string {
    const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return iso;
    const nombreDia = DIAS_SEMANA[new Date(anio, mes - 1, dia).getDay()];
    return `${nombreDia} ${dia} de ${MESES[mes - 1]} de ${anio}`;
  }

  /** "10:00:00" -> "10:00". Sin hora (pasa en la hoja Penal) se dice explícitamente. */
  fmtHora(valor: string | null): string {
    return valor ? valor.slice(0, 5) : 'Sin hora';
  }

  /** Fechas ISO (yyyy-MM-dd) a dd-MM-yyyy sin pasar por Date. */
  fmtFecha(valor: string | null): string {
    if (!valor) return '-';
    const partes = valor.slice(0, 10).split('-');
    return partes.length === 3 ? `${partes[2]}-${partes[1]}-${partes[0]}` : valor;
  }

  /** Campos que no están en la tabla; se omiten los vacíos. */
  detalle(a: Audiencia): { etiqueta: string; valor: string }[] {
    const campos: { etiqueta: string; valor: string | null }[] = [
      { etiqueta: 'Materia', valor: a.materia },
      { etiqueta: 'RIT', valor: a.rol },
      { etiqueta: 'RUC', valor: a.ruc },
      { etiqueta: 'Juez', valor: a.juez },
      { etiqueta: 'Estado', valor: a.estado },
      { etiqueta: 'Tribunal', valor: a.tribunal },
      { etiqueta: 'Sala', valor: a.sala },
      { etiqueta: 'RUT', valor: a.rut },
      { etiqueta: 'Archivo', valor: a.nombre_archivo },
    ];
    return campos
      .filter((c) => !!c.valor && String(c.valor).trim() !== '')
      .map((c) => ({ etiqueta: c.etiqueta, valor: String(c.valor) }));
  }

  alternarDetalle(id: number): void {
    this.detalleAbiertoId.set(this.detalleAbiertoId() === id ? null : id);
  }

  alternarPasadas(): void {
    this.incluirPasadas.set(!this.incluirPasadas());
    this.onFiltrar();
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
      .getAudiencias({
        ...this.filtros(),
        materia: this.materiaActiva() || undefined,
        page: this.currentPage(),
        limit: 50,
      })
      .subscribe({
        next: (res) => {
          this.audiencias.set(res.audiencias);
          this.total.set(res.total);
          this.currentPage.set(res.page);
          this.totalPages.set(res.total_pages);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notification.error('Error al cargar las audiencias');
        },
      });
  }

  /** Conteos por materia y tipos disponibles; respeta los filtros activos. */
  cargarResumen(): void {
    this.service.getResumen(this.filtros()).subscribe({
      next: (res) => {
        this.materias.set(res.por_materia);
        this.totalResumen.set(res.total);
        this.tiposAudiencia.set(res.tipos_audiencia);
      },
      error: () => {
        this.materias.set([]);
        this.tiposAudiencia.set([]);
      },
    });
  }

  private filtros(): AudienciaFiltros {
    return {
      busqueda: this.filtroBusqueda || undefined,
      tipo_audiencia: this.filtroTipo || undefined,
      tribunal: this.filtroTribunal || undefined,
      rut: this.filtroRut || undefined,
      origen_id: this.filtroOrigenId,
      desde: this.filtroDesde || undefined,
      hasta: this.filtroHasta || undefined,
      incluir_pasadas: this.incluirPasadas() || undefined,
    };
  }

  onFiltrar(): void {
    this.currentPage.set(1);
    this.detalleAbiertoId.set(null);
    this.sincronizarChips();
    this.cargarDatos();
    this.cargarResumen();
  }

  onLimpiarFiltros(): void {
    this.filtroBusqueda = '';
    this.filtroTipo = '';
    this.filtroTribunal = '';
    this.filtroRut = '';
    this.filtroDesde = '';
    this.filtroHasta = '';
    this.onFiltrar();
  }

  /** Enter dentro de un campo del panel: aplica sin ir hasta el botón. */
  aplicarDesdeCampo(): void {
    this.panel()?.cerrar();
    this.onFiltrar();
  }

  /** Quita un solo filtro desde su badge y vuelve a consultar. */
  quitarFiltro(clave: string): void {
    switch (clave) {
      case 'busqueda':
        this.filtroBusqueda = '';
        break;
      case 'tipo_audiencia':
        this.filtroTipo = '';
        break;
      case 'tribunal':
        this.filtroTribunal = '';
        break;
      case 'rut':
        this.filtroRut = '';
        break;
      case 'desde':
        this.filtroDesde = '';
        break;
      case 'hasta':
        this.filtroHasta = '';
        break;
    }
    this.onFiltrar();
  }

  /**
   * Badges de lo APLICADO, no de lo escrito: si el usuario abre el panel,
   * escribe y lo cierra sin aplicar, la barra no debe mentir sobre qué se está
   * consultando.
   *
   * `origen_id` queda fuera a propósito: no se edita en pantalla y ya tiene su
   * propio aviso arriba del listado.
   */
  private sincronizarChips(): void {
    const chips: ChipFiltro[] = [];
    if (this.filtroBusqueda) {
      chips.push({ clave: 'busqueda', etiqueta: 'Búsqueda', valor: this.filtroBusqueda });
    }
    if (this.filtroTipo) {
      chips.push({ clave: 'tipo_audiencia', etiqueta: 'Tipo', valor: this.filtroTipo });
    }
    if (this.filtroTribunal) {
      chips.push({ clave: 'tribunal', etiqueta: 'Tribunal', valor: this.filtroTribunal });
    }
    if (this.filtroRut) {
      chips.push({ clave: 'rut', etiqueta: 'RUT', valor: this.filtroRut });
    }
    if (this.filtroDesde) {
      chips.push({ clave: 'desde', etiqueta: 'Desde', valor: this.fmtFecha(this.filtroDesde) });
    }
    if (this.filtroHasta) {
      chips.push({ clave: 'hasta', etiqueta: 'Hasta', valor: this.fmtFecha(this.filtroHasta) });
    }
    this.chipsFiltros.set(chips);
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

  /**
   * Reintento manual de la publicación en Google, que ya corre sola al
   * importar. Sirve para cuando el usuario conectó su cuenta DESPUÉS de que le
   * llegaran las audiencias por correo.
   */
  sincronizarGoogle(): void {
    this.sincronizando.set(true);
    this.service.sincronizarGoogle().subscribe({
      next: (res) => {
        this.sincronizando.set(false);
        if (res.exito) {
          this.notification.success(res.mensaje || 'Audiencias publicadas en Google Calendar');
          this.cargarDatos(); // refresca la columna GCal
        } else {
          this.notification.warning(res.mensaje || 'No se pudo publicar en Google Calendar');
        }
      },
      error: (err) => {
        this.sincronizando.set(false);
        this.notification.error(err.error?.detail || 'No se pudo publicar en Google Calendar');
      },
    });
  }

  irAPagina(page: number): void {
    this.currentPage.set(page);
    this.detalleAbiertoId.set(null);
    this.cargarDatos();
  }
}
