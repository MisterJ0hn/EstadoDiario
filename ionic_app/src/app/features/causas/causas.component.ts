import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Causa, CausaFiltros, ConteoMateria, VigenciaCausa } from '@core/models/causa.model';
import { NotificationService } from '@core/services/notification.service';
import {
  ChipFiltro,
  FiltrosPanelComponent,
} from '@shared/components/filtros-panel/filtros-panel.component';
import { CausaService } from './services/causa.service';

/**
 * Cartera de causas por materia (submenú **Materia** de Mis Causas).
 *
 * Las columnas son la UNIÓN de lo que traen las cinco hojas del Excel, que no
 * son las mismas: Cobranza no informa estado, y solo Penal trae tipo de causa
 * y RUC. Por eso lo que no aplica va con guion y no vacío: una celda en blanco
 * parece un dato que falta, y esto es un dato que esa hoja no tiene.
 */
@Component({
  selector: 'app-causas',
  standalone: true,
  imports: [CommonModule, FormsModule, FiltrosPanelComponent],
  template: `
    <div class="space-y-6">
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Mis Causas</h1>
          <p class="text-neutral-500 mt-1">
           {{ titulo() }} - {{ total() }} causas encontradas
          </p>
        </div>

      </div>

      @if (filtroOrigenId) {
        <div class="alert-info flex items-center justify-between gap-4">
          <span>
            Mostrando las causas del archivo #{{ filtroOrigenId }}, que puede no ser
            el último cargado.
          </span>
          <button (click)="quitarFiltroArchivo()" class="btn-secondary btn-sm shrink-0">
            Ver todas
          </button>
        </div>
      }

      <!-- Pestañas por materia (las alimenta /causas/resumen) -->
      <div class="border-b border-neutral-200">
        <nav class="-mb-px flex gap-1 overflow-x-auto" role="tablist">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="materiaActiva() === null"
            (click)="seleccionarMateria(null)"
            class="flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors"
            [class]="
              materiaActiva() === null
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
            "
          >
            Todas
            <span
              class="rounded-full px-2 py-0.5 text-xs font-semibold"
              [class]="
                materiaActiva() === null
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-neutral-100 text-neutral-600'
              "
            >
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
              [class]="
                materiaActiva() === c.materia
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
              "
            >
              {{ c.materia || 'Sin materia' }}
              <span
                class="rounded-full px-2 py-0.5 text-xs font-semibold"
                [class]="
                  materiaActiva() === c.materia
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-neutral-100 text-neutral-600'
                "
              >
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
          <label class="form-label" for="c-actividad">Sin movimientos hace</label>
          <select id="c-actividad" class="form-select" [(ngModel)]="filtroSinActividad">
            <option value="">No filtrar</option>
            <option value="1">Más de 1 mes</option>
            <option value="3">Más de 3 meses</option>
            <option value="6">Más de 6 meses</option>
            <option value="12">Más de 1 año</option>
          </select>
          <p class="text-xs text-neutral-500 mt-1">
            Solo cuenta lo que consta en los reportes cargados. Una causa sin registro
            no se considera dormida: no se sabe.
          </p>
        </div>

        <div>
          <label class="form-label" for="c-audiencia">Con audiencia en</label>
          <select id="c-audiencia" class="form-select" [(ngModel)]="filtroConAudiencia">
            <option value="">No filtrar</option>
            <option value="7">Los próximos 7 días</option>
            <option value="15">Los próximos 15 días</option>
            <option value="30">Los próximos 30 días</option>
          </select>
        </div>

        <div>
          <label class="form-label" for="c-orden">Ordenar por</label>
          <select id="c-orden" class="form-select" [(ngModel)]="filtroOrden">
            <option value="">Fecha de ingreso</option>
            <option value="actividad">Último movimiento, más antiguo primero</option>
            <option value="audiencia">Próxima audiencia</option>
          </select>
        </div>

        <div>
          <label class="form-label" for="c-vigencia">Vigencia</label>
          <select id="c-vigencia" class="form-select" [(ngModel)]="filtroVigencia">
            <option value="vigentes">Vigentes</option>
            <option value="finalizadas">No vigentes</option>
          </select>
          <!-- Sin opción "todas" a propósito: mezclar causas vivas con
               concluidas es lo que hace inútil el listado, y el título dice
               cuál de las dos mitades se está mirando. -->
        </div>
        <div>
          <label class="form-label" for="c-busqueda">Búsqueda</label>
          <input
            id="c-busqueda"
            type="text"
            class="form-input"
            placeholder="Carátula, rol o RUC"
            [(ngModel)]="filtroBusqueda"
            (keyup.enter)="aplicarDesdeCampo()"
          />
        </div>
        <div>
          <label class="form-label" for="c-estado">Estado de la causa</label>
          <select id="c-estado" class="form-select" [(ngModel)]="filtroEstadoCausa">
            <option [ngValue]="''">Todos</option>
            @for (e of estadosCausa(); track e) {
              <option [ngValue]="e">{{ e }}</option>
            }
          </select>
        </div>
        <div>
          <label class="form-label" for="c-tribunal">Tribunal</label>
          <input
            id="c-tribunal"
            type="text"
            class="form-input"
            placeholder="Coincidencia parcial"
            [(ngModel)]="filtroTribunal"
            (keyup.enter)="aplicarDesdeCampo()"
          />
        </div>
      </app-filtros-panel>

      @if (cargando()) {
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
                  
                  <th>Rol/Rit</th>
                  <th>Ruc/RolUnico</th>
                  <th>FechaIngreso</th>
                  <th>Caratulado</th>
                  <th>Tribunal</th>
                  <th>TipoCausa</th>
                  
                  <th>EstadoCausa</th>
                  <th>Institución</th>
                  <!-- El cruce con los otros tres reportes. Van al final porque
                       son lo que se consulta, no lo que identifica la causa. -->
                  <th title="Fecha del último movimiento: la última vez que la causa apareció en el estado diario, en movimientos o en una audiencia ya celebrada">
                    Último Movimiento
                  </th>
                  <th title="Próxima audiencia agendada">Audiencia</th>
                </tr>
              </thead>
              <tbody>
                @for (c of causas(); track c.id) {
                  <tr>
                           
                    <td class="font-medium whitespace-nowrap">{{ c.rol || '-' }}</td>
                    <td class="whitespace-nowrap">{{ c.ruc || '-' }}</td>            
                    <td class="whitespace-nowrap">{{ fmtFecha(c.fecha_ingreso) }}</td>
                    <td class="max-w-[260px] truncate" [title]="c.caratulado || ''">
                      {{ c.caratulado || '-' }}
                    </td>
                    <td class="max-w-[220px] truncate" [title]="c.tribunal || ''">
                      {{ c.tribunal || '-' }}
                    </td>
                     <td>{{ c.tipo_causa || '-' }}</td>                    
                    <td>{{ c.estado_causa || '-' }}</td>
                    <td class="max-w-[180px] truncate" [title]="c.institucion || ''">
                      {{ c.institucion || '-' }}
                    </td>
                    <td class="whitespace-nowrap">
                      @if (c.ultima_actividad) {
                        <span [title]="detalleActividad(c)">{{ fmtFecha(c.ultima_actividad) }}</span>
                      } @else {
                        <!-- Sin registro NO es "sin movimiento": puede que el
                             estudio solo tenga cargados los reportes de esta
                             semana. Decir "nunca" sería afirmar algo que el
                             sistema no sabe. -->
                        <span class="text-neutral-400" title="No aparece en los reportes cargados">
                          sin registro
                        </span>
                      }
                    </td>
                    <td class="whitespace-nowrap">
                      @if (c.proxima_audiencia) {
                        <span [class]="claseAudiencia(c.proxima_audiencia)">
                          {{ fmtFecha(c.proxima_audiencia) }}
                        </span>
                      } @else {
                        <span class="text-neutral-400">-</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="colspan" class="py-10 text-center">
                      <p class="text-neutral-600 font-medium">No hay causas para este filtro</p>
                      <p class="text-sm text-neutral-500 mt-1">
                        Cargue el Excel de causas desde el menú «Cargar Causas».
                      </p>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (totalPaginas() > 1) {
            <div class="flex items-center justify-between p-4 border-t border-neutral-200">
              <p class="text-sm text-neutral-500">
                Página {{ pagina() }} de {{ totalPaginas() }} ({{ total() }} causas)
              </p>
              <div class="flex gap-2">
                <button type="button" class="btn-secondary btn-sm" [disabled]="pagina() <= 1"
                        (click)="irA(pagina() - 1)">
                  Anterior
                </button>
                <button type="button" class="btn-secondary btn-sm" [disabled]="pagina() >= totalPaginas()"
                        (click)="irA(pagina() + 1)">
                  Siguiente
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CausasComponent implements OnInit {
  private service = inject(CausaService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  causas = signal<Causa[]>([]);
  materias = signal<ConteoMateria[]>([]);
  estadosCausa = signal<string[]>([]);
  totalResumen = signal(0);
  total = signal(0);
  pagina = signal(1);
  totalPaginas = signal(1);
  cargando = signal(true);

  /** null = pestaña "Todas". Se refleja en el query param `materia`. */
  materiaActiva = signal<string | null>(null);

  /**
   * Qué mitad de la cartera se está viendo. Por defecto las vigentes: son las
   * que el estudio tramita, y una cartera con años de causas concluidas
   * encima haría inútil el listado el primer día.
   */
  vigencia = signal<VigenciaCausa>('vigentes');
  /**
   * Lo elegido en el panel, que no es lo mismo que lo aplicado: el panel tiene
   * botón "Aplicar", y hasta pulsarlo la tabla y el título siguen mostrando la
   * vigencia anterior.
   */
  filtroVigencia: VigenciaCausa = 'vigentes';

  readonly VIGENCIAS: { clave: VigenciaCausa; etiqueta: string; titulo: string }[] = [
    { clave: 'vigentes', etiqueta: 'Vigentes', titulo: 'Cartera cliente Vigentes' },
    { clave: 'finalizadas', etiqueta: 'No vigentes', titulo: 'Cartera cliente Finalizada' },
  ];

  titulo = computed(
    () => this.VIGENCIAS.find((v) => v.clave === this.vigencia())!.titulo
  );

  filtroBusqueda = '';
  filtroEstadoCausa = '';
  filtroTribunal = '';
  /** Meses sin novedades. Texto porque sale de un <select>. */
  filtroSinActividad = '';
  /** Días hacia adelante para la próxima audiencia. */
  filtroConAudiencia = '';
  filtroOrden = '';
  /** Fijado por query param al llegar desde un archivo; no se edita en pantalla. */
  filtroOrigenId: number | undefined;

  readonly chipsFiltros = signal<ChipFiltro[]>([]);
  private readonly panel = viewChild(FiltrosPanelComponent);

  /** TipoCausa + Rol/Rit + Ruc + Tribunal + FechaIngreso + Caratulado +
   *  EstadoCausa + Institución. */
  readonly colspan = 10;

  private readonly porPagina = 20;

  ngOnInit(): void {
    const materia = this.route.snapshot.queryParamMap.get('materia');
    this.materiaActiva.set(materia || null);

    // Se sigue aceptando por URL para que un enlace guardado abra la mitad
    // que corresponde. El control ya no la escribe —vive en el panel de
    // filtros—, pero al leerla hay que dejar el panel diciendo lo mismo que la
    // tabla, o el select mostraría "Vigentes" sobre un listado de finalizadas.
    const vigencia = this.route.snapshot.queryParamMap.get('vigencia');
    if (vigencia === 'finalizadas' || vigencia === 'vigentes') {
      this.vigencia.set(vigencia);
      this.filtroVigencia = vigencia;
    }

    const origenId = Number(this.route.snapshot.queryParamMap.get('origen_id'));
    this.filtroOrigenId = Number.isFinite(origenId) && origenId > 0 ? origenId : undefined;

    this.cargarResumen();
    this.cargar();
  }

  /** ISO (yyyy-MM-dd) a dd-MM-yyyy sin pasar por Date, que desplaza el día. */
  fmtFecha(valor: string | null): string {
    if (!valor) return '-';
    const partes = valor.slice(0, 10).split('-');
    return partes.length === 3 ? `${partes[2]}-${partes[1]}-${partes[0]}` : valor;
  }

  seleccionarMateria(materia: string | null): void {
    if (this.materiaActiva() === materia) return;
    this.materiaActiva.set(materia);
    this.pagina.set(1);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { materia: materia || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.service
      .getCausas({
        ...this.filtros(),
        materia: this.materiaActiva() || undefined,
        page: this.pagina(),
        limit: this.porPagina,
      })
      .subscribe({
        next: (res) => {
          this.causas.set(res.causas);
          this.total.set(res.total);
          this.pagina.set(res.page);
          this.totalPaginas.set(res.total_pages);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.notification.error('No se pudieron cargar las causas');
        },
      });
  }

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


  private filtros(): CausaFiltros {
    return {
      busqueda: this.filtroBusqueda || undefined,
      estado_causa: this.filtroEstadoCausa || undefined,
      tribunal: this.filtroTribunal || undefined,
      origen_id: this.filtroOrigenId,
      vigencia: this.vigencia(),
      sin_actividad_meses: this.filtroSinActividad
        ? Number(this.filtroSinActividad)
        : undefined,
      con_audiencia_dias: this.filtroConAudiencia
        ? Number(this.filtroConAudiencia)
        : undefined,
      orden: this.filtroOrden || undefined,
    };
  }

  onFiltrar(): void {
    // Lo elegido en el panel pasa a ser lo aplicado: de acá salen la consulta,
    // el título y el chip.
    this.vigencia.set(this.filtroVigencia);
    this.pagina.set(1);
    this.sincronizarChips();
    this.cargar();
    this.cargarResumen();
  }

  onLimpiarFiltros(): void {
    // Vuelve a Vigentes, que es el valor por defecto de la pantalla.
    this.filtroVigencia = 'vigentes';
    this.filtroBusqueda = '';
    this.filtroEstadoCausa = '';
    this.filtroTribunal = '';
    this.filtroSinActividad = '';
    this.filtroConAudiencia = '';
    this.filtroOrden = '';
    this.onFiltrar();
  }

  /** Enter dentro de un campo del panel: aplica sin ir hasta el botón. */
  aplicarDesdeCampo(): void {
    this.panel()?.cerrar();
    this.onFiltrar();
  }

  quitarFiltro(clave: string): void {
    switch (clave) {
      case 'vigencia':
        this.filtroVigencia = 'vigentes';
        break;
      case 'sin_actividad':
        this.filtroSinActividad = '';
        break;
      case 'con_audiencia':
        this.filtroConAudiencia = '';
        break;
      case 'busqueda':
        this.filtroBusqueda = '';
        break;
      case 'estado_causa':
        this.filtroEstadoCausa = '';
        break;
      case 'tribunal':
        this.filtroTribunal = '';
        break;
    }
    this.onFiltrar();
  }

  irA(pagina: number): void {
    this.pagina.set(pagina);
    this.cargar();
  }

  /** Badges de lo APLICADO, no de lo escrito. `origen_id` queda fuera: no se
   *  edita en pantalla y ya tiene su propio aviso arriba del listado. */
  private sincronizarChips(): void {
    const chips: ChipFiltro[] = [];
    if (this.vigencia() === 'finalizadas') {
      chips.push({ clave: 'vigencia', etiqueta: 'Vigencia', valor: 'No vigentes' });
    }
    if (this.filtroSinActividad) {
      chips.push({
        clave: 'sin_actividad',
        etiqueta: 'Sin movimientos',
        valor: `más de ${this.filtroSinActividad} mes(es)`,
      });
    }
    if (this.filtroConAudiencia) {
      chips.push({
        clave: 'con_audiencia',
        etiqueta: 'Audiencia',
        valor: `próximos ${this.filtroConAudiencia} días`,
      });
    }
    if (this.filtroBusqueda) {
      chips.push({ clave: 'busqueda', etiqueta: 'Búsqueda', valor: this.filtroBusqueda });
    }
    if (this.filtroEstadoCausa) {
      chips.push({ clave: 'estado_causa', etiqueta: 'Estado', valor: this.filtroEstadoCausa });
    }
    if (this.filtroTribunal) {
      chips.push({ clave: 'tribunal', etiqueta: 'Tribunal', valor: this.filtroTribunal });
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

  /** De qué reporte salió la fecha, para el tooltip.
   *
   *  No repite la fecha: desde que la columna la muestra en vez del tiempo
   *  relativo, el tooltip solo tiene que agregar lo que no se ve. */
  detalleActividad(c: Causa): string {
    const de: Record<string, string> = {
      estado_diario: 'Apareció en el estado diario',
      movimientos: 'Apareció en movimientos',
      audiencias: 'Tuvo una audiencia',
    };
    return (c.origen_actividad ? de[c.origen_actividad] : null) ?? 'Última vez que se movió';
  }

  /** Resalta la audiencia inminente: es lo más caro de dejar pasar. */
  claseAudiencia(iso: string): string {
    const [a, m, d] = iso.split('-').map(Number);
    const dias = Math.floor((new Date(a, m - 1, d).getTime() - Date.now()) / 86400000);
    if (dias <= 7) return 'badge-danger';
    if (dias <= 30) return 'badge-warning';
    return 'badge-neutral';
  }

}
