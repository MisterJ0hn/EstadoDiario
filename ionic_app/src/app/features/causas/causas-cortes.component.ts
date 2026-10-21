import { Component, computed, OnInit, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { VigenciaCausa } from '@core/models/causa.model';
import { CausaCorte, TipoCorteCausa } from '@core/models/causa.model';
import {
  ChipFiltro,
  FiltrosPanelComponent,
} from '@shared/components/filtros-panel/filtros-panel.component';
import { CausaService } from './services/causa.service';
import { PjudApelacionesModalComponent } from './components/pjud-apelaciones-modal/pjud-apelaciones-modal.component';

/**
 * Causas de corte de la cartera (submenú **Corte** de Mis Causas).
 *
 * Las dos hojas no traen las mismas columnas: Apelaciones informa en qué corte
 * está el expediente y dónde (Corte, Ubicación y su fecha); Suprema no. Se
 * muestran juntas y lo que no aplica queda con un guion, porque una celda
 * vacía parece un dato que falta y esto es un dato que esa hoja no tiene.
 *
 * Filtrando por una sola de las dos, la tabla se ve sin huecos.
 */
@Component({
  selector: 'app-causas-cortes',
  standalone: true,
  imports: [CommonModule, FormsModule, FiltrosPanelComponent, PjudApelacionesModalComponent],
  template: `
    <div class="space-y-6">
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Causas de Corte</h1>
          <p class="text-neutral-500 mt-1">
          {{ titulo() }} - {{ total() }} {{ total() === 1 ? 'causa' : 'causas' }} en Corte Suprema y Corte de
            Apelaciones
          </p>
        </div>

      </div>

      <app-filtros-panel
        [chips]="chipsFiltros()"
        (aplicar)="onFiltrar()"
        (limpiar)="onLimpiarFiltros()"
        (quitar)="quitarFiltro($event)"
      >
        <div>
          <label class="form-label" for="cc-vigencia">Vigencia</label>
          <select id="cc-vigencia" class="form-select" [(ngModel)]="filtroVigencia">
            <option value="vigentes">Vigentes</option>
            <option value="finalizadas">No vigentes</option>
          </select>
          <!-- Sin opción "todas" a propósito: mezclar causas vivas con
               concluidas es lo que hace inútil el listado, y el título dice
               cuál de las dos mitades se está mirando. -->
        </div>
        <div>
          <label class="form-label" for="cc-busqueda">Búsqueda</label>
          <input
            id="cc-busqueda"
            type="text"
            class="form-input"
            placeholder="Carátula o rol"
            [(ngModel)]="filtroBusqueda"
            (keyup.enter)="aplicarDesdeCampo()"
          />
        </div>
        @if (cortesDisponibles().length) {
          <div>
            <label class="form-label" for="cc-corte">Corte</label>
            <select id="cc-corte" class="form-select" [(ngModel)]="filtroCorte">
              <option [ngValue]="''">Todas</option>
              @for (c of cortesDisponibles(); track c) {
                <option [ngValue]="c">{{ c }}</option>
              }
            </select>
          </div>
        }
      </app-filtros-panel>

      <!-- Pestañas por tipo de corte, igual que las de materia en Mis Causas -->
      <div class="border-b border-neutral-200">
        <nav class="-mb-px flex gap-1 overflow-x-auto" role="tablist">
          @for (op of opciones; track op.valor) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="filtroTipo === op.valor"
              (click)="seleccionarTipo(op.valor)"
              class="flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              [class]="
                filtroTipo === op.valor
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
              "
            >
              {{ op.etiqueta }}
            </button>
          }
        </nav>
      </div>

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
                Aparecerán acá cuando cargue un Excel de causas con las hojas de Corte Suprema o
                Corte Apelaciones.
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
                    <th>EstadoProcesal</th>
                    <th>Institución</th>
                   
                    
                    <th>Ubicación</th>
                    <th>FechaUbicación</th>
                     <th>Corte</th>
                    @if (pjudDisponible()) {
                      <th>PJUD</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (c of cortes(); track c.id) {
                    <tr>
                      <td class="font-medium whitespace-nowrap">{{ c.rol || '-' }}</td>
                      <td>{{ c.era || '-' }}</td>
                      <td class="whitespace-nowrap">{{ fecha(c.fecha_ingreso) }}</td>
                      <td class="max-w-[240px] truncate" [title]="c.caratulado || ''">
                        {{ c.caratulado || '-' }}
                      </td>
                      <td>{{ c.estado_procesal || '-' }}</td>
                      <td class="max-w-[160px] truncate" [title]="c.institucion || ''">
                        {{ c.institucion || '-' }}
                      </td>
                      
                      
                      <td>{{ c.ubicacion || '-' }}</td>
                      <td class="whitespace-nowrap">{{ fecha(c.fecha_ubicacion) }}</td>
                      <td class="max-w-[180px] truncate" [title]="c.corte || ''">
                        {{ c.corte || '-' }}
                      </td>
                      @if (pjudDisponible()) {
                        <td class="text-center">
                          @if (c.tipo === 'apelaciones') {
                            <button type="button" class="btn-outline btn-sm !px-2 outline outline-1 outline-primary-600 outline-offset-2"
                                    (click)="causaPjud.set(c)" title="Ver detalle de la causa en el Poder Judicial"
                                    aria-label="Ver detalle de la causa en el Poder Judicial">
                              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                   stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
                                <path d="M14 3v5h5M9 13h6M9 17h6" />
                              </svg>
                            </button>
                          } @else {
                            <span>-</span>
                          }
                        </td>
                      }
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
                  <button type="button" class="btn-secondary btn-sm" [disabled]="pagina() <= 1"
                          (click)="irA(pagina() - 1)">
                    Anterior
                  </button>
                  <button type="button" class="btn-secondary btn-sm"
                          [disabled]="pagina() >= totalPaginas()" (click)="irA(pagina() + 1)">
                    Siguiente
                  </button>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>

    <app-pjud-apelaciones-modal [causa]="causaPjud()" (cerrado)="causaPjud.set(null)" />
  `,
})
export class CausasCortesComponent implements OnInit {
  private service = inject(CausaService);

  readonly opciones: { valor: TipoCorteCausa | ''; etiqueta: string }[] = [
    { valor: '', etiqueta: 'Todas' },
    { valor: 'suprema', etiqueta: 'Corte Suprema' },
    { valor: 'apelaciones', etiqueta: 'Corte de Apelaciones' },
  ];

  cortes = signal<CausaCorte[]>([]);
  /** Si la consulta al PJUD está habilitada; sin esto no se ofrece el botón de detalle. */
  pjudDisponible = signal(false);
  /** La causa de corte cuyo detalle PJUD está abierto; null = cerrado. */
  causaPjud = signal<CausaCorte | null>(null);
  cortesDisponibles = signal<string[]>([]);
  total = signal(0);

  /**
   * Qué mitad se está viendo. Por defecto las vigentes: son las que el estudio
   * tramita, y una cartera con años de causas concluidas encima haría inútil el
   * listado el primer día.
   */
  vigencia = signal<VigenciaCausa>('vigentes');
  /**
   * Lo que está elegido en el panel, que no es lo mismo que lo aplicado: el
   * panel tiene botón "Aplicar", y mientras esté abierto la tabla y el título
   * siguen mostrando la vigencia anterior.
   */
  filtroVigencia: VigenciaCausa = 'vigentes';

  readonly VIGENCIAS: { clave: VigenciaCausa; etiqueta: string; titulo: string }[] = [
    { clave: 'vigentes', etiqueta: 'Vigentes', titulo: 'Cartera cliente Vigentes' },
    { clave: 'finalizadas', etiqueta: 'No vigentes', titulo: 'Cartera cliente Finalizada' },
  ];

  titulo = computed(
    () => this.VIGENCIAS.find((v) => v.clave === this.vigencia())!.titulo
  );

  pagina = signal(1);
  totalPaginas = signal(1);
  cargando = signal(true);
  error = signal<string | null>(null);

  filtroBusqueda = '';
  filtroTipo: TipoCorteCausa | '' = '';
  filtroCorte = '';

  readonly chipsFiltros = signal<ChipFiltro[]>([]);
  private readonly panel = viewChild(FiltrosPanelComponent);

  private readonly porPagina = 50;

  ngOnInit(): void {
    this.cargar();
    this.service.pjudDisponible().subscribe({
      next: (res) => this.pjudDisponible.set(res.disponible),
      // Si falla la consulta simplemente no se ofrece el botón.
      error: () => this.pjudDisponible.set(false),
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
        vigencia: this.vigencia(),
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
    // Lo elegido en el panel pasa a ser lo aplicado: de acá salen la
    // consulta, el título y el chip.
    this.vigencia.set(this.filtroVigencia);
    // Cambiar un filtro vuelve a la primera página: quedarse en la 4 tras
    // filtrar muestra una tabla vacía que parece un error.
    this.pagina.set(1);
    this.sincronizarChips();
    this.cargar();
  }

  onLimpiarFiltros(): void {
    // Vuelve a Vigentes, que es el valor por defecto de la pantalla.
    this.filtroVigencia = 'vigentes';
    this.filtroBusqueda = '';
    this.filtroCorte = '';
    this.onFiltrar();
  }

  aplicarDesdeCampo(): void {
    this.panel()?.cerrar();
    this.onFiltrar();
  }

  quitarFiltro(clave: string): void {
    switch (clave) {
      case 'vigencia':
        this.filtroVigencia = 'vigentes';
        break;
      case 'busqueda':
        this.filtroBusqueda = '';
        break;
      case 'corte':
        this.filtroCorte = '';
        break;
    }
    this.onFiltrar();
  }

  seleccionarTipo(tipo: TipoCorteCausa | ''): void {
    if (this.filtroTipo === tipo) return;
    this.filtroTipo = tipo;
    this.onFiltrar();
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

  private sincronizarChips(): void {
    const chips: ChipFiltro[] = [];
    if (this.vigencia() === 'finalizadas') {
      chips.push({ clave: 'vigencia', etiqueta: 'Vigencia', valor: 'No vigentes' });
    }
    if (this.filtroBusqueda) {
      chips.push({ clave: 'busqueda', etiqueta: 'Búsqueda', valor: this.filtroBusqueda });
    }
    if (this.filtroCorte) {
      chips.push({ clave: 'corte', etiqueta: 'Corte', valor: this.filtroCorte });
    }
    this.chipsFiltros.set(chips);
  }


}
