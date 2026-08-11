import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import { EstadoDiarioOrigen, TipoOrigen } from '@core/models/estado-diario.model';
import { CorreoLogComponent } from '../../../configuracion/components/correo-log/correo-log.component';

/** Las pestañas: los cuatro tipos de archivo, más la casilla de correo. */
type Pestana = TipoOrigen | 'correo';

/**
 * Bitácora: todo lo que entró al sistema, en un solo lugar.
 *
 * **Por qué una sola pantalla.** Antes había dos entradas de menú —"Bitácora"
 * para los archivos y "Bitácora de Correo" para la casilla— y eran lo mismo
 * visto de dos formas: un archivo entra subiéndolo a mano o llegando por
 * correo. Para responder "¿llegó hoy el estado diario?" había que mirar en dos
 * lugares y cruzarlos a ojo.
 *
 * Ahora las cuatro primeras pestañas son los archivos que **existen**, sin
 * importar cómo entraron (la columna *Vía* lo dice), y la quinta es la casilla:
 * qué mensajes llegaron y qué pasó con cada uno. Esa última sigue aparte
 * porque muestra cosas que las otras no pueden: los correos que NO produjeron
 * archivo —descartados, duplicados, errores, fallas de conexión—, que es justo
 * lo que se viene a buscar cuando algo no llegó.
 */
@Component({
  selector: 'app-origenes-list',
  standalone: true,
  imports: [CommonModule, RouterLink, CorreoLogComponent],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Bitácora</h1>
          <p class="text-neutral-500 mt-1">{{ subtitulo() }}</p>
        </div>
        @if (activeTab() !== 'correo') {
          <a [routerLink]="activeTab() === 'causas' ? '/causas/cargar' : '/estado-diario/upload'"
             class="btn-primary">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            {{ activeTab() === 'causas' ? 'Cargar Causas' : 'Cargar Archivo' }}
          </a>
        }
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
              @if (activeTab() === t.key && t.key !== 'correo') {
                <span class="rounded-full px-2 py-0.5 text-xs font-semibold bg-primary-100 text-primary-700">
                  {{ total() }}
                </span>
              }
            </button>
          }
        </nav>
      </div>

      @if (activeTab() === 'correo') {
        <!-- La casilla trae su propia paginación, su filtro por resultado y el
             botón de revisar: es su pestaña entera, no una tabla más. -->
        <app-correo-log />
      } @else if (loading()) {
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
                  <th>Vía</th>
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
                    <td>
                      <!-- De dónde vino el archivo. Es lo que hacía falta mirar
                           en la otra pantalla para saberlo. -->
                      @if (o.via === 'correo') {
                        <span class="badge-info">Correo</span>
                      } @else {
                        <span class="badge-neutral">Manual</span>
                      }
                    </td>
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
                    <td colspan="9" class="text-center py-10 text-neutral-400">
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

  /** Los cuatro tipos de Excel que maneja el sistema, más la casilla; el `key`
   *  de los cuatro primeros es el valor que espera el backend.
   *
   *  Causas va antes de Correo porque es la que menos se consulta: se carga una
   *  vez y reemplaza a la anterior, mientras que las otras tres llegan a
   *  diario. Correo va última porque no es un tipo de archivo sino la vía por
   *  donde llegan todos. */
  readonly tabs: { key: Pestana; label: string }[] = [
    { key: 'estado_diario', label: 'Estado Diario' },
    { key: 'movimientos', label: 'Movimientos' },
    { key: 'audiencias', label: 'Audiencias' },
    { key: 'causas', label: 'Causas' },
    { key: 'correo', label: 'Correo' },
  ];

  origenes = signal<EstadoDiarioOrigen[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);

  activeTab = signal<Pestana>('estado_diario');

  private readonly SUBTITULOS: Record<Pestana, string> = {
    estado_diario: 'Archivos de estado diario cargados',
    movimientos: 'Archivos de movimientos cargados',
    audiencias: 'Archivos de audiencias cargados',
    causas: 'Archivos de causas cargados — el más reciente es la cartera vigente',
    correo: 'Todo lo que llegó a su casilla de ingesta, entrara o no',
  };

  /** El contador de filas por archivo significa algo distinto en cada pestaña.
   *  En todas cuenta materia MÁS corte: son las dos clases de hoja que trae el
   *  mismo Excel, y contar solo una dejaba la columna diciendo de menos. */
  private readonly CONTADORES: Record<Pestana, string> = {
    estado_diario: 'Estado Diario',
    movimientos: 'Movimientos',
    audiencias: 'Audiencias',
    causas: 'Causas',
    // Nunca se muestra: la pestaña de correo no usa esta tabla. Está para que
    // el Record quede completo y el compilador siga cuidando el tipo.
    correo: '',
  };

  subtitulo = computed(() => this.SUBTITULOS[this.activeTab()]);

  columnaContador = computed(() => this.CONTADORES[this.activeTab()]);

  ngOnInit(): void {
    const queryTab = this.route.snapshot.queryParamMap.get('tab');
    this.activeTab.set(this.normalizeTab(queryTab) ?? 'estado_diario');
    // La pestaña de correo trae sus propios datos: pedirle archivos al backend
    // sería una consulta que nadie va a mirar.
    if (this.activeTab() !== 'correo') {
      this.loadPage(1);
    } else {
      this.loading.set(false);
    }
  }

  private normalizeTab(value: string | null): Pestana | null {
    return this.tabs.some((t) => t.key === value) ? (value as Pestana) : null;
  }

  selectTab(tab: Pestana): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (tab === 'correo') {
      this.loading.set(false);
      return;
    }
    this.loadPage(1);
  }

  /**
   * "Ver" lleva a la vista que corresponde al tipo de archivo: el estado diario
   * tiene su listado por origen, y los otros tres se filtran por `origen_id` en
   * su propio módulo.
   */
  verLink(o: EstadoDiarioOrigen): (string | number)[] {
    if (o.tipo === 'movimientos') return ['/movimientos'];
    if (o.tipo === 'audiencias') return ['/audiencias'];
    if (o.tipo === 'causas') return ['/causas'];
    return ['/estado-diario/origen', o.id, 'movimientos'];
  }

  verQueryParams(o: EstadoDiarioOrigen): Record<string, number> | null {
    return o.tipo === 'estado_diario' ? null : { origen_id: o.id };
  }

  loadPage(page: number): void {
    const tipo = this.activeTab();
    // Guarda por si alguien llama a esto desde la pestaña de correo: ese `tipo`
    // no existe en el backend y devolvería la lista vacía sin decir por qué.
    if (tipo === 'correo') return;

    this.loading.set(true);
    this.service.getOrigenes(page, 20, tipo).subscribe({
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
