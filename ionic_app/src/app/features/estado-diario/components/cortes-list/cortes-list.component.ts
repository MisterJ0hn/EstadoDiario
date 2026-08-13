import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Corte, TipoCorte, FechaInicialResponse } from '@core/models/estado-diario.model';
import {
  ChipFiltro,
  FiltrosPanelComponent,
} from '@shared/components/filtros-panel/filtros-panel.component';
import { etiquetaFecha, fmtFechaChip } from '@shared/fecha-estado-diario';
import { EstadoDiarioService } from '../../services/estado-diario.service';

/**
 * Causas de corte del estado diario (submenú **Corte**).
 *
 * El Excel del PJUD trae dos hojas de corte, y **no tienen las mismas
 * columnas entre sí**: Apelaciones informa dónde está el expediente
 * (ubicación, fecha de ubicación, corte) y Suprema informa qué recurso es. Se
 * muestran en una sola tabla con las columnas de ambas, y las que no aplican
 * quedan con un guion en vez de vacías: una celda en blanco parece un dato
 * que falta, y esto es un dato que esa hoja no tiene.
 *
 * Filtrando por una sola de las dos, que es cuando la tabla se ve sin huecos.
 *
 * Los filtros van en el mismo panel lateral que usa Materia, para que las dos
 * pantallas del menú se manejen igual.
 */
@Component({
  selector: 'app-cortes-list',
  standalone: true,
  imports: [CommonModule, FormsModule, FiltrosPanelComponent],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Corte</h1>
        <p class="text-neutral-500 mt-1">
          {{ total() }} {{ total() === 1 ? 'causa' : 'causas' }} en Corte Suprema y Corte de
          Apelaciones
        </p>
      </div>

      <!-- Filtros: campos en el panel lateral, badges de lo aplicado acá. -->
      <app-filtros-panel
        [chips]="chipsFiltros()"
        (aplicar)="onFiltrar()"
        (limpiar)="onLimpiarFiltros()"
        (quitar)="quitarFiltro($event)"
      >
        <div>
          <label class="form-label" for="c-busqueda">Búsqueda</label>
          <input
            id="c-busqueda"
            type="text"
            class="form-input"
            placeholder="Carátula o número de ingreso"
            [(ngModel)]="filtroBusqueda"
            (keyup.enter)="aplicarDesdeCampo()"
          />
        </div>
        <div>
          <label class="form-label" for="c-tipo">Tipo de corte</label>
          <select id="c-tipo" class="form-select" [(ngModel)]="filtroTipo">
            @for (op of opciones; track op.valor) {
              <option [ngValue]="op.valor">{{ op.etiqueta }}</option>
            }
          </select>
        </div>
        @if (cortesDisponibles().length) {
          <div>
            <label class="form-label" for="c-corte">Corte</label>
            <select id="c-corte" class="form-select" [(ngModel)]="filtroCorte">
              <option [ngValue]="''">Todas</option>
              @for (c of cortesDisponibles(); track c) {
                <option [ngValue]="c">{{ c }}</option>
              }
            </select>
          </div>
        }
        <div>
          <label class="form-label" for="c-desde">Fecha desde</label>
          <input id="c-desde" type="date" class="form-input" [(ngModel)]="filtroFechaDesde" />
        </div>
        <div>
          <label class="form-label" for="c-hasta">Fecha hasta</label>
          <input id="c-hasta" type="date" class="form-input" [(ngModel)]="filtroFechaHasta" />
        </div>
      </app-filtros-panel>

      <div class="card">
        <div class="card-body">
          @if (cargando()) {
            <p class="text-neutral-500 py-8 text-center">Cargando...</p>
          } @else if (error()) {
            <div class="alert-danger">
              <div class="flex-1">{{ error() }}</div>
              <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">
                Reintentar
              </button>
            </div>
          } @else if (!cortes().length) {
            <div class="py-10 text-center">
              <p class="text-neutral-600 font-medium">No hay causas de corte</p>
              <p class="text-sm text-neutral-500 mt-1">
                Aparecerán acá cuando llegue un estado diario con las hojas de Corte Suprema o
                Corte de Apelaciones.
              </p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>FechaIngreso</th>
                    <th>Caratulado</th>
                    <th>Ubicación</th>
                    <th>FechaUbicación</th>
                    <th>Corte</th>
                    <th>TipoRecurso</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of cortes(); track c.id) {
                    <tr>
                      <td class="whitespace-nowrap">{{ fecha(c.fecha_ingreso) }}</td>
                      <td>{{ c.caratulado || '-' }}</td>
                      <td>{{ c.ubicacion || '-' }}</td>
                      <td class="whitespace-nowrap">{{ fecha(c.fecha_ubicacion) }}</td>
                      <td>{{ c.corte || '-' }}</td>
                      <td>{{ c.tipo_recurso || '-' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (totalPaginas() > 1) {
              <div class="flex items-center justify-between mt-4">
                <p class="text-sm text-neutral-500">
                  Página {{ pagina() }} de {{ totalPaginas() }}
                </p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn-secondary btn-sm"
                    [disabled]="pagina() <= 1"
                    (click)="irA(pagina() - 1)"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    class="btn-secondary btn-sm"
                    [disabled]="pagina() >= totalPaginas()"
                    (click)="irA(pagina() + 1)"
                  >
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
export class CortesListComponent implements OnInit {
  private service = inject(EstadoDiarioService);

  readonly opciones: { valor: TipoCorte | ''; etiqueta: string }[] = [
    { valor: '', etiqueta: 'Todas' },
    { valor: 'suprema', etiqueta: 'Corte Suprema' },
    { valor: 'apelaciones', etiqueta: 'Corte de Apelaciones' },
  ];

  cortes = signal<Corte[]>([]);
  cortesDisponibles = signal<string[]>([]);
  total = signal(0);
  pagina = signal(1);
  totalPaginas = signal(1);
  cargando = signal(true);
  error = signal<string | null>(null);

  filtroBusqueda = '';
  filtroTipo: TipoCorte | '' = '';
  filtroCorte = '';
  filtroFechaDesde = '';
  filtroFechaHasta = '';
  /** De dónde salió la fecha puesta: solo cambia el rótulo del chip. */
  motivoFecha: FechaInicialResponse['motivo'] = null;

  /** Filtros ya aplicados, los que se ven como badges. */
  readonly chipsFiltros = signal<ChipFiltro[]>([]);
  private readonly panel = viewChild(FiltrosPanelComponent);

  private readonly porPagina = 50;

  ngOnInit(): void {
    // Mismo día por defecto que las otras pantallas de estado diario, y por el
    // mismo motivo: lo que se revisa es el día anterior. Se pide antes de la
    // primera consulta para no traer todo el histórico y reemplazarlo enseguida.
    this.service.getFechaInicial().subscribe({
      next: (res) => {
        if (res?.fecha) {
          this.filtroFechaDesde = res.fecha;
          this.filtroFechaHasta = res.fecha;
          this.motivoFecha = res.motivo;
          this.sincronizarChips();
        }
        this.cargar();
      },
      // Sin fecha sugerida se muestra todo, como antes: es una comodidad.
      error: () => this.cargar(),
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.service
      .getCortes({
        tipo: this.filtroTipo || undefined,
        busqueda: this.filtroBusqueda.trim() || undefined,
        corte: this.filtroCorte || undefined,
        fecha_desde: this.filtroFechaDesde || undefined,
        fecha_hasta: this.filtroFechaHasta || undefined,
        page: this.pagina(),
        limit: this.porPagina,
      })
      .subscribe({
        next: (res) => {
          this.cortes.set(res.cortes);
          this.total.set(res.total);
          this.pagina.set(res.page);
          this.totalPaginas.set(res.total_pages);
          this.cortesDisponibles.set(res.cortes_disponibles ?? []);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.error.set('No se pudieron cargar las causas de corte.');
        },
      });
  }

  onFiltrar(): void {
    // Cambiar un filtro vuelve a la primera página: quedarse en la 4 tras
    // filtrar muestra una tabla vacía que parece un error.
    this.pagina.set(1);
    this.sincronizarChips();
    this.cargar();
  }

  onLimpiarFiltros(): void {
    this.filtroBusqueda = '';
    this.filtroTipo = '';
    this.filtroCorte = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.motivoFecha = null;
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
      case 'tipo':
        this.filtroTipo = '';
        break;
      case 'corte':
        this.filtroCorte = '';
        break;
      case 'fecha_dia':
        // El chip de un día son los dos extremos en la misma fecha.
        this.filtroFechaDesde = '';
        this.filtroFechaHasta = '';
        this.motivoFecha = null;
        break;
      case 'fecha_desde':
        this.filtroFechaDesde = '';
        this.motivoFecha = null;
        break;
      case 'fecha_hasta':
        this.filtroFechaHasta = '';
        this.motivoFecha = null;
        break;
    }
    this.onFiltrar();
  }

  /** Badges de lo APLICADO, no de lo escrito: si el usuario abre el panel,
   *  escribe y lo cierra sin aplicar, la barra no debe mentir sobre qué se
   *  está consultando. */
  private sincronizarChips(): void {
    const chips: ChipFiltro[] = [];
    if (this.filtroBusqueda) {
      chips.push({ clave: 'busqueda', etiqueta: 'Búsqueda', valor: this.filtroBusqueda });
    }
    if (this.filtroTipo) {
      const op = this.opciones.find((o) => o.valor === this.filtroTipo);
      chips.push({ clave: 'tipo', etiqueta: 'Tipo', valor: op?.etiqueta ?? this.filtroTipo });
    }
    if (this.filtroCorte) {
      chips.push({ clave: 'corte', etiqueta: 'Corte', valor: this.filtroCorte });
    }
    // Un solo día va como un chip, no como "Desde X" + "Hasta X": es el caso
    // del valor por defecto y dos badges iguales se leen como un rango.
    if (this.filtroFechaDesde && this.filtroFechaDesde === this.filtroFechaHasta) {
      chips.push({
        clave: 'fecha_dia',
        etiqueta: etiquetaFecha(this.motivoFecha),
        valor: fmtFechaChip(this.filtroFechaDesde),
      });
    } else {
      if (this.filtroFechaDesde) {
        chips.push({ clave: 'fecha_desde', etiqueta: 'Desde', valor: fmtFechaChip(this.filtroFechaDesde) });
      }
      if (this.filtroFechaHasta) {
        chips.push({ clave: 'fecha_hasta', etiqueta: 'Hasta', valor: fmtFechaChip(this.filtroFechaHasta) });
      }
    }
    this.chipsFiltros.set(chips);
  }

  irA(pagina: number): void {
    this.pagina.set(pagina);
    this.cargar();
  }

  fecha(valor: string | null): string {
    if (!valor) return '-';
    const [anio, mes, dia] = valor.split('-');
    return dia ? `${dia}-${mes}-${anio}` : valor;
  }
}
