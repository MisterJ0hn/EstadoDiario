import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, switchMap, tap } from 'rxjs';
import { ReporteService } from './services/reporte.service';
import { EstadoDiarioService } from '@features/estado-diario/services/estado-diario.service';
import { MovimientoService } from '@features/movimientos/services/movimiento.service';
import { NotificationService } from '@core/services/notification.service';
import { Jurisdiccion } from '@core/models/estado-diario.model';
import {
  CampoDisponible,
  FiltrosReporte,
  FuenteDisponible,
  FuenteReporte,
  ReportePlantilla,
  ReportePlantillaRequest,
} from '@core/models/reporte.model';
import { descargarBlob, mensajeErrorBlob, nombreArchivoSeguro } from '@core/utils/descarga';

@Component({
  selector: 'app-reporte-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">
            {{ plantillaId() ? 'Editar informe' : 'Nuevo informe' }}
          </h1>
          <p class="text-neutral-500 mt-1">
            Elija la fuente de datos y los campos que quiere ver en el Excel.
          </p>
        </div>
        <a routerLink="/informes" class="btn-secondary shrink-0">Volver a mis informes</a>
      </div>

      @if (cargando()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      } @else if (error()) {
        <div class="card">
          <div class="card-body space-y-3">
            <p class="text-danger-700">{{ error() }}</p>
            <a routerLink="/informes" class="btn-secondary">Volver a mis informes</a>
          </div>
        </div>
      } @else {
        <!-- 1. Datos del informe -->
        <div class="card">
          <div class="card-header">
            <h2 class="font-semibold text-neutral-800">1. Datos del informe</h2>
          </div>
          <div class="card-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="form-label">Nombre <span class="text-danger-600">*</span></label>
              <input type="text" class="form-input" [ngModel]="nombre()" (ngModelChange)="nombre.set($event)"
                     placeholder="Ej: Causas pendientes de la semana" maxlength="200" />
            </div>
            <div class="md:col-span-2">
              <label class="form-label">Descripción</label>
              <input type="text" class="form-input" [ngModel]="descripcion()" (ngModelChange)="descripcion.set($event)"
                     placeholder="Opcional. Para reconocerlo en la lista de informes" />
            </div>
          </div>
        </div>

        <!-- 2. Fuente de datos -->
        <div class="card">
          <div class="card-header">
            <h2 class="font-semibold text-neutral-800">2. Fuente de datos</h2>
            <p class="text-sm text-neutral-500 mt-1">
              Cada fuente tiene sus propios campos y filtros. Al cambiarla se descartan los campos ya elegidos.
            </p>
          </div>
          <div class="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
            @for (f of catalogo(); track f.fuente) {
              <button type="button" (click)="pedirCambioFuente(f.fuente)"
                      class="text-left rounded-lg border p-4 transition-colors"
                      [class]="fuente() === f.fuente
                        ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-neutral-200 hover:border-primary-300 hover:bg-neutral-50'">
                <span class="block font-medium text-neutral-800">{{ f.etiqueta }}</span>
                <span class="block text-xs text-neutral-500 mt-1">{{ f.campos.length }} campos disponibles</span>
              </button>
            }
          </div>
        </div>

        <!-- 3. Campos -->
        <div class="card">
          <div class="card-header">
            <h2 class="font-semibold text-neutral-800">3. Campos del informe</h2>
            <p class="text-sm text-neutral-500 mt-1">
              El <strong>orden de la columna derecha es el orden de las columnas del Excel</strong>:
              use las flechas para moverlos.
            </p>
          </div>
          <div class="card-body grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Disponibles -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-semibold text-neutral-700">
                  Disponibles ({{ disponibles().length }})
                </h3>
                <button type="button" (click)="agregarTodos()" class="btn-secondary btn-sm"
                        [disabled]="disponibles().length === 0">Agregar todos</button>
              </div>
              <input type="text" class="form-input mb-2" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)"
                     placeholder="Buscar campo..." />
              <ul class="rounded-lg border border-neutral-200 divide-y divide-neutral-100 max-h-80 overflow-y-auto">
                @for (c of disponiblesFiltrados(); track c.clave) {
                  <li class="flex items-center justify-between gap-2 px-3 py-2 hover:bg-neutral-50">
                    <span class="text-sm text-neutral-700 truncate" [title]="c.etiqueta">{{ c.etiqueta }}</span>
                    <button type="button" (click)="agregar(c.clave)" class="btn-outline btn-sm shrink-0"
                            [title]="'Agregar ' + c.etiqueta">Agregar</button>
                  </li>
                } @empty {
                  <li class="px-3 py-6 text-center text-sm text-neutral-400">
                    @if (busqueda()) { Ningún campo coincide con la búsqueda }
                    @else { Ya agregó todos los campos de esta fuente }
                  </li>
                }
              </ul>
            </div>

            <!-- Elegidos -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-semibold text-neutral-700">
                  Columnas del Excel ({{ elegidos().length }})
                </h3>
                <button type="button" (click)="quitarTodos()" class="btn-secondary btn-sm"
                        [disabled]="elegidos().length === 0">Quitar todos</button>
              </div>
              <!-- Ocupa el alto del buscador de la izquierda para que ambas listas queden alineadas -->
              <p class="text-xs text-neutral-400 mb-2 h-[42px] flex items-center">
                El primero de la lista es la primera columna del Excel.
              </p>
              <ul class="rounded-lg border border-neutral-200 divide-y divide-neutral-100 max-h-80 overflow-y-auto">
                @for (c of elegidosDetalle(); track c.clave; let i = $index, primero = $first, ultimo = $last) {
                  <li class="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50">
                    <span class="w-6 shrink-0 text-xs font-semibold text-neutral-400">{{ i + 1 }}</span>
                    <span class="flex-1 text-sm text-neutral-700 truncate" [title]="c.etiqueta">{{ c.etiqueta }}</span>
                    <button type="button" (click)="subir(i)" class="btn-secondary btn-sm shrink-0"
                            [disabled]="primero" title="Subir">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button type="button" (click)="bajar(i)" class="btn-secondary btn-sm shrink-0"
                            [disabled]="ultimo" title="Bajar">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button type="button" (click)="quitar(c.clave)" class="btn-danger btn-sm shrink-0" title="Quitar">
                      &times;
                    </button>
                  </li>
                } @empty {
                  <li class="px-3 py-6 text-center text-sm text-neutral-400">
                    No ha elegido ningún campo. El informe necesita al menos uno.
                  </li>
                }
              </ul>
            </div>
          </div>
        </div>

        <!-- 4. Filtros -->
        <div class="card">
          <div class="card-header">
            <h2 class="font-semibold text-neutral-800">4. Filtros</h2>
            <p class="text-sm text-neutral-500 mt-1">
              Todos opcionales. Sin filtros, el informe trae todos sus registros de esta fuente.
            </p>
          </div>
          <div class="card-body grid grid-cols-1 md:grid-cols-3 gap-4">
            @if (opcionesEstado().length > 0) {
              <div>
                <label class="form-label">Estado</label>
                <select class="form-select" [ngModel]="filtroEstado()" (ngModelChange)="filtroEstado.set($event)">
                  <option value="">Todos</option>
                  @for (o of opcionesEstado(); track o.valor) {
                    <option [value]="o.valor">{{ o.etiqueta }}</option>
                  }
                </select>
              </div>
            }

            @if (usaNivel()) {
              <div>
                <label class="form-label">Nivel de urgencia</label>
                <select class="form-select" [ngModel]="filtroNivel()" (ngModelChange)="filtroNivel.set($event)">
                  <option value="">Todos</option>
                  <option value="bajo">Bajo</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                </select>
              </div>
            }

            @if (usaJurisdiccion()) {
              <div>
                <label class="form-label">Jurisdicción</label>
                <select class="form-select" [ngModel]="filtroJurisdiccion()"
                        (ngModelChange)="filtroJurisdiccion.set($event)">
                  <option [ngValue]="null">Todas</option>
                  @for (j of jurisdicciones(); track j.id) {
                    <option [ngValue]="j.id">{{ j.nombre }}</option>
                  }
                </select>
              </div>
            }

            @if (usaMateria()) {
              <div>
                <label class="form-label">Materia</label>
                <select class="form-select" [ngModel]="filtroMateria()" (ngModelChange)="filtroMateria.set($event)">
                  <option value="">Todas</option>
                  @for (m of materias(); track m) {
                    <option [value]="m">{{ m }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label">Estado de la causa</label>
                <select class="form-select" [ngModel]="filtroEstadoCausa()"
                        (ngModelChange)="filtroEstadoCausa.set($event)">
                  <option value="">Todos</option>
                  @for (e of estadosCausa(); track e) {
                    <option [value]="e">{{ e }}</option>
                  }
                </select>
              </div>
            }

            <div>
              <label class="form-label">Fecha desde</label>
              <input type="date" class="form-input" [ngModel]="filtroDesde()" (ngModelChange)="filtroDesde.set($event)" />
            </div>
            <div>
              <label class="form-label">Fecha hasta</label>
              <input type="date" class="form-input" [ngModel]="filtroHasta()" (ngModelChange)="filtroHasta.set($event)" />
            </div>
            <div class="md:col-span-3">
              <p class="text-xs text-neutral-400">{{ ayudaFechas() }}</p>
            </div>
          </div>
        </div>

        @if (mensaje()) {
          <div [class]="mensajeEsError() ? 'alert-danger' : 'alert-success'">
            <span class="flex-1">{{ mensaje() }}</span>
            <button (click)="mensaje.set('')" class="text-current opacity-60 hover:opacity-100">&times;</button>
          </div>
        }

        <!-- Acciones -->
        <div class="card">
          <div class="card-body flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-neutral-500">
              @if (!puedeGenerar()) {
                <span class="text-danger-700">{{ motivoBloqueo() }}</span>
              } @else {
                Al enviar o descargar se guardan primero los cambios del informe.
              }
            </p>
            <div class="flex flex-wrap gap-3">
              <button (click)="guardar()" class="btn-secondary" [disabled]="!puedeGenerar() || ocupado()">
                {{ guardando() ? 'Guardando...' : 'Guardar' }}
              </button>
              <button (click)="descargar()" class="btn-outline" [disabled]="!puedeGenerar() || ocupado()">
                {{ descargando() ? 'Generando...' : 'Descargar' }}
              </button>
              <button (click)="enviar()" class="btn-primary" [disabled]="!puedeGenerar() || ocupado()">
                {{ enviando() ? 'Enviando...' : 'Enviar por correo' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Confirmar cambio de fuente: se pierden los campos elegidos -->
    @if (fuentePendiente(); as pendiente) {
      <div class="modal-backdrop" (click)="fuentePendiente.set(null)">
        <div class="modal-content max-w-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">Cambiar la fuente de datos</h3>
            <button (click)="fuentePendiente.set(null)" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>
          <div class="modal-body">
            <div class="flex items-start gap-3">
              <div class="shrink-0 w-10 h-10 rounded-full bg-warning-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p class="text-sm text-neutral-600 mt-2">
                Los <strong>{{ elegidos().length }} campos</strong> que ya eligió y los filtros se descartan,
                porque no existen en la otra fuente. ¿Continúa?
              </p>
            </div>
          </div>
          <div class="modal-footer">
            <button (click)="fuentePendiente.set(null)" class="btn-secondary">Cancelar</button>
            <button (click)="confirmarCambioFuente(pendiente)" class="btn-warning">Sí, cambiar</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ReporteFormComponent implements OnInit {
  private service = inject(ReporteService);
  private estadoDiarioService = inject(EstadoDiarioService);
  private movimientoService = inject(MovimientoService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  catalogo = signal<FuenteDisponible[]>([]);
  plantillaId = signal<number | null>(null);
  cargando = signal(true);
  error = signal('');

  nombre = signal('');
  descripcion = signal('');
  fuente = signal<FuenteReporte>('estado_diario');
  /** Claves de los campos elegidos: su orden ES el orden de columnas del Excel. */
  elegidos = signal<string[]>([]);
  busqueda = signal('');
  /** Fuente que el usuario quiere cambiar, a la espera de confirmación. */
  fuentePendiente = signal<FuenteReporte | null>(null);

  filtroEstado = signal('');
  filtroNivel = signal('');
  filtroJurisdiccion = signal<number | null>(null);
  filtroMateria = signal('');
  filtroEstadoCausa = signal('');
  filtroDesde = signal('');
  filtroHasta = signal('');

  jurisdicciones = signal<Jurisdiccion[]>([]);
  materias = signal<string[]>([]);
  estadosCausa = signal<string[]>([]);

  guardando = signal(false);
  enviando = signal(false);
  descargando = signal(false);
  mensaje = signal('');
  mensajeEsError = signal(false);

  /** Campos del catálogo para la fuente activa. */
  camposFuente = computed<CampoDisponible[]>(
    () => this.catalogo().find((f) => f.fuente === this.fuente())?.campos ?? []
  );

  disponibles = computed(() =>
    this.camposFuente().filter((c) => !this.elegidos().includes(c.clave))
  );

  disponiblesFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    if (!texto) return this.disponibles();
    return this.disponibles().filter((c) => c.etiqueta.toLowerCase().includes(texto));
  });

  /** Los elegidos, en su orden, resueltos contra el catálogo. */
  elegidosDetalle = computed<CampoDisponible[]>(() => {
    const catalogo = this.camposFuente();
    return this.elegidos()
      .map((clave) => catalogo.find((c) => c.clave === clave))
      .filter((c): c is CampoDisponible => !!c);
  });

  opcionesEstado = computed<{ valor: string; etiqueta: string }[]>(() => {
    if (this.fuente() === 'estado_diario') {
      return [
        { valor: 'no-leido', etiqueta: 'No leídos' },
        { valor: 'pendiente', etiqueta: 'Pendientes' },
        { valor: 'resuelto', etiqueta: 'Resueltos' },
      ];
    }
    if (this.fuente() === 'agenda') {
      return [
        { valor: 'vigentes', etiqueta: 'Vigentes' },
        { valor: 'finalizados', etiqueta: 'Finalizados' },
      ];
    }
    return [];
  });

  usaNivel = computed(() => this.fuente() === 'estado_diario' || this.fuente() === 'agenda');
  usaJurisdiccion = computed(() => this.fuente() === 'estado_diario');
  usaMateria = computed(() => this.fuente() === 'movimientos');

  ayudaFechas = computed(() =>
    this.fuente() === 'agenda'
      ? 'El rango se aplica sobre la fecha del recordatorio.'
      : 'El rango se aplica sobre la fecha del archivo de estado diario, no sobre la fecha de ingreso de la causa.'
  );

  puedeGenerar = computed(() => this.elegidos().length > 0 && this.nombre().trim().length > 0);

  motivoBloqueo = computed(() => {
    if (!this.nombre().trim()) return 'Póngale un nombre al informe para poder guardarlo.';
    if (this.elegidos().length === 0) return 'Elija al menos un campo: un informe sin columnas no se puede generar.';
    return '';
  });

  ocupado = computed(() => this.guardando() || this.enviando() || this.descargando());

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : null;

    this.estadoDiarioService.getJurisdicciones().subscribe({
      next: (res) => this.jurisdicciones.set(res.jurisdicciones),
    });

    this.service.getCampos().subscribe({
      next: (res) => {
        this.catalogo.set(res.fuentes);
        if (id) {
          this.cargarPlantilla(id);
        } else {
          this.cargando.set(false);
        }
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo cargar el catálogo de campos');
      },
    });
  }

  private cargarPlantilla(id: number): void {
    // El backend no expone el detalle de una plantilla suelta: se toma de la
    // lista, que ya viene acotada al usuario.
    this.service.getPlantillas().subscribe({
      next: (res) => {
        const plantilla = res.plantillas.find((p) => p.id === id);
        if (!plantilla) {
          this.cargando.set(false);
          this.error.set('El informe no existe o no está disponible para su usuario');
          return;
        }
        this.aplicar(plantilla);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo cargar el informe');
      },
    });
  }

  private aplicar(p: ReportePlantilla): void {
    this.plantillaId.set(p.id);
    this.nombre.set(p.nombre);
    this.descripcion.set(p.descripcion ?? '');
    this.fuente.set(p.fuente);
    this.elegidos.set([...p.campos]);

    const f = p.filtros ?? {};
    this.filtroEstado.set(f.estado ?? '');
    this.filtroNivel.set(f.nivel ?? '');
    this.filtroJurisdiccion.set(f.jurisdiccion_id ?? null);
    this.filtroMateria.set(f.materia ?? '');
    this.filtroEstadoCausa.set(f.estado_causa ?? '');
    this.filtroDesde.set(f.fecha_desde ?? '');
    this.filtroHasta.set(f.fecha_hasta ?? '');

    if (p.fuente === 'movimientos') this.cargarCatalogoMovimientos();
  }

  /** Materias y estados de causa reales del usuario, para no filtrar a ciegas. */
  private cargarCatalogoMovimientos(): void {
    if (this.materias().length > 0) return;
    this.movimientoService.getResumen().subscribe({
      next: (res) => {
        this.materias.set(res.por_materia.map((m) => m.materia).filter((m): m is string => !!m));
        this.estadosCausa.set(res.estados_causa);
      },
    });
  }

  // ── Fuente ────────────────────────────────────────────

  pedirCambioFuente(fuente: FuenteReporte): void {
    if (fuente === this.fuente()) return;
    if (this.elegidos().length === 0) {
      this.confirmarCambioFuente(fuente);
      return;
    }
    this.fuentePendiente.set(fuente);
  }

  confirmarCambioFuente(fuente: FuenteReporte): void {
    this.fuentePendiente.set(null);
    this.fuente.set(fuente);
    // Los campos y los filtros son propios de cada fuente: no se pueden traspasar.
    this.elegidos.set([]);
    this.busqueda.set('');
    this.limpiarFiltros();
    if (fuente === 'movimientos') this.cargarCatalogoMovimientos();
  }

  private limpiarFiltros(): void {
    this.filtroEstado.set('');
    this.filtroNivel.set('');
    this.filtroJurisdiccion.set(null);
    this.filtroMateria.set('');
    this.filtroEstadoCausa.set('');
    this.filtroDesde.set('');
    this.filtroHasta.set('');
  }

  // ── Selector de campos ────────────────────────────────

  agregar(clave: string): void {
    this.elegidos.update((lista) => (lista.includes(clave) ? lista : [...lista, clave]));
  }

  quitar(clave: string): void {
    this.elegidos.update((lista) => lista.filter((c) => c !== clave));
  }

  agregarTodos(): void {
    const nuevos = this.disponibles().map((c) => c.clave);
    this.elegidos.update((lista) => [...lista, ...nuevos]);
  }

  quitarTodos(): void {
    this.elegidos.set([]);
  }

  subir(indice: number): void {
    if (indice <= 0) return;
    this.intercambiar(indice, indice - 1);
  }

  bajar(indice: number): void {
    if (indice >= this.elegidos().length - 1) return;
    this.intercambiar(indice, indice + 1);
  }

  private intercambiar(a: number, b: number): void {
    this.elegidos.update((lista) => {
      const copia = [...lista];
      [copia[a], copia[b]] = [copia[b], copia[a]];
      return copia;
    });
  }

  // ── Guardar / generar ─────────────────────────────────

  private filtros(): FiltrosReporte {
    const f: FiltrosReporte = {};
    if (this.opcionesEstado().length > 0 && this.filtroEstado()) f.estado = this.filtroEstado();
    if (this.usaNivel() && this.filtroNivel()) f.nivel = this.filtroNivel();
    if (this.usaJurisdiccion() && this.filtroJurisdiccion()) {
      f.jurisdiccion_id = Number(this.filtroJurisdiccion());
    }
    if (this.usaMateria()) {
      if (this.filtroMateria()) f.materia = this.filtroMateria();
      if (this.filtroEstadoCausa()) f.estado_causa = this.filtroEstadoCausa();
    }
    if (this.filtroDesde()) f.fecha_desde = this.filtroDesde();
    if (this.filtroHasta()) f.fecha_hasta = this.filtroHasta();
    return f;
  }

  private payload(): ReportePlantillaRequest {
    return {
      nombre: this.nombre().trim(),
      descripcion: this.descripcion().trim() || null,
      fuente: this.fuente(),
      campos: this.elegidos(),
      filtros: this.filtros(),
    };
  }

  /**
   * Guardar y generar son una sola acción: enviar o descargar siempre trabaja
   * sobre lo que está en pantalla, así que primero se persiste la plantilla.
   */
  private asegurarGuardado(): Observable<ReportePlantilla> {
    const id = this.plantillaId();
    const datos = this.payload();
    const peticion = id ? this.service.actualizar(id, datos) : this.service.crear(datos);
    return peticion.pipe(tap((p) => this.plantillaId.set(p.id)));
  }

  guardar(): void {
    if (!this.puedeGenerar() || this.ocupado()) return;
    this.mensaje.set('');
    this.guardando.set(true);
    const esNuevo = this.plantillaId() === null;

    this.asegurarGuardado().subscribe({
      next: (p) => {
        this.guardando.set(false);
        this.notification.success('Informe guardado');
        // Se refleja el id en la URL para que recargar el enlace abra este mismo
        // informe en vez de crear otro. Solo se hace acá: en "enviar" y
        // "descargar" navegar destruiría el componente a mitad de la operación.
        if (esNuevo) this.router.navigate(['/informes', p.id], { replaceUrl: true });
      },
      error: (err) => {
        this.guardando.set(false);
        this.mostrarError(err.error?.detail || 'No se pudo guardar el informe');
      },
    });
  }

  enviar(): void {
    if (!this.puedeGenerar() || this.ocupado()) return;
    this.mensaje.set('');
    this.enviando.set(true);

    this.asegurarGuardado()
      .pipe(switchMap((p) => this.service.enviar(p.id)))
      .subscribe({
        next: (res) => {
          this.enviando.set(false);
          // El mensaje del backend trae la dirección de destino.
          this.mensaje.set(res.mensaje);
          this.mensajeEsError.set(false);
          this.notification.success(res.mensaje);
        },
        error: (err) => {
          this.enviando.set(false);
          this.mostrarError(
            `${err.error?.detail || 'No se pudo enviar el informe'} — mientras tanto puede usar Descargar.`
          );
        },
      });
  }

  descargar(): void {
    if (!this.puedeGenerar() || this.ocupado()) return;
    this.mensaje.set('');
    this.descargando.set(true);

    this.asegurarGuardado()
      .pipe(switchMap((p) => this.service.descargar(p.id)))
      .subscribe({
        next: (blob) => {
          this.descargando.set(false);
          // En Android abre la hoja de compartir y puede fallar o cancelarse;
          // en web resuelve al instante. Si no se atrapa, un descarte queda
          // como error no manejado en la consola.
          descargarBlob(blob, nombreArchivoSeguro(this.nombre()), this.nombre()).catch(
            () => this.mostrarError('No se pudo guardar el informe')
          );
        },
        error: (err) => {
          this.descargando.set(false);
          mensajeErrorBlob(err, 'No se pudo generar el informe').then((m) => this.mostrarError(m));
        },
      });
  }

  private mostrarError(texto: string): void {
    this.mensaje.set(texto);
    this.mensajeEsError.set(true);
  }
}
