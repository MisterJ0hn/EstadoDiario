import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MovimientoCorte } from '@core/models/movimiento.model';
import {
  ChipFiltro,
  FiltrosPanelComponent,
} from '@shared/components/filtros-panel/filtros-panel.component';
import { MovimientoService } from './services/movimiento.service';

/**
 * Causas de corte del reporte de Movimientos (submenú **Corte**).
 *
 * Las dos hojas de corte del reporte no traen las mismas columnas: Apelaciones
 * informa en qué corte está el expediente y dónde (Corte, Ubicación y su
 * fecha); Suprema no. Se muestran juntas y lo que no aplica queda con un
 * guion, porque una celda vacía parece un dato que falta y esto es un dato que
 * esa hoja no tiene.
 *
 * Filtrando por una sola de las dos, que es cuando la tabla se ve sin huecos.
 *
 * Los filtros van en el mismo panel lateral que usa Materia, para que las dos
 * pantallas del menú se manejen igual.
 */
@Component({
  selector: 'app-movimientos-cortes',
  standalone: true,
  imports: [CommonModule, FormsModule, FiltrosPanelComponent],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Movimientos · Corte</h1>
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
          <label class="form-label" for="mc-busqueda">Búsqueda</label>
          <input
            id="mc-busqueda"
            type="text"
            class="form-input"
            placeholder="Carátula o rol"
            [(ngModel)]="filtroBusqueda"
            (keyup.enter)="aplicarDesdeCampo()"
          />
        </div>
        <div>
          <label class="form-label" for="mc-tipo">Tipo de corte</label>
          <select id="mc-tipo" class="form-select" [(ngModel)]="filtroTipo">
            @for (op of opciones; track op.valor) {
              <option [ngValue]="op.valor">{{ op.etiqueta }}</option>
            }
          </select>
        </div>
        @if (cortesDisponibles().length) {
          <div>
            <label class="form-label" for="mc-corte">Corte</label>
            <select id="mc-corte" class="form-select" [(ngModel)]="filtroCorte">
              <option [ngValue]="''">Todas</option>
              @for (c of cortesDisponibles(); track c) {
                <option [ngValue]="c">{{ c }}</option>
              }
            </select>
          </div>
        }
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
                Aparecerán acá cuando llegue un reporte de movimientos con las hojas de Corte
                Suprema o Corte de Apelaciones.
              </p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>Era</th>
                    <th>FechaIngreso</th>
                    <th>Caratulado</th>
                    <th>EstadoCausa</th>
                    <th>Institución</th>
                    <th>Corte</th>
                    <th>Ubicación</th>
                    <th>FechaUbicación</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of cortes(); track c.id) {
                    <tr>
                      <td class="font-medium whitespace-nowrap">{{ c.rol || '-' }}</td>
                      <td>{{ c.era || '-' }}</td>
                      <td class="whitespace-nowrap">{{ fecha(c.fecha_ingreso) }}</td>
                      <td class="max-w-[220px] truncate" [title]="c.caratulado || ''">
                        {{ c.caratulado || '-' }}
                      </td>
                      <td>{{ c.estado_causa || '-' }}</td>
                      <td>{{ c.institucion || '-' }}</td>
                      <td class="max-w-[180px] truncate" [title]="c.corte || ''">
                        {{ c.corte || '-' }}
                      </td>
                      <td>{{ c.ubicacion || '-' }}</td>
                      <td class="whitespace-nowrap">{{ fecha(c.fecha_ubicacion) }}</td>
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
export class MovimientosCortesComponent implements OnInit {
  private service = inject(MovimientoService);

  readonly opciones: { valor: 'suprema' | 'apelaciones' | ''; etiqueta: string }[] = [
    { valor: '', etiqueta: 'Todas' },
    { valor: 'suprema', etiqueta: 'Corte Suprema' },
    { valor: 'apelaciones', etiqueta: 'Corte de Apelaciones' },
  ];

  cortes = signal<MovimientoCorte[]>([]);
  cortesDisponibles = signal<string[]>([]);
  total = signal(0);
  pagina = signal(1);
  totalPaginas = signal(1);
  cargando = signal(true);
  error = signal<string | null>(null);

  filtroBusqueda = '';
  filtroTipo: 'suprema' | 'apelaciones' | '' = '';
  filtroCorte = '';

  /** Filtros ya aplicados, los que se ven como badges. */
  readonly chipsFiltros = signal<ChipFiltro[]>([]);
  private readonly panel = viewChild(FiltrosPanelComponent);

  private readonly porPagina = 50;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.service
      .getCortes({
        tipo: this.filtroTipo || undefined,
        busqueda: this.filtroBusqueda.trim() || undefined,
        corte: this.filtroCorte || undefined,
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
