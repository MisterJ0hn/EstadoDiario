import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, switchMap, timer } from 'rxjs';

import { Cliente } from '@core/models/admin.model';
import { NotificationService } from '@core/services/notification.service';
import { formatearRut, rutPlano, rutValido } from '@core/utils/rut';
import { AdminClienteService } from '../services/admin-cliente.service';

type PasoAlta = 'datos' | 'confirmar';

@Component({
  selector: 'app-clientes-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div class="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Clientes</h1>
          <p class="text-neutral-500 mt-1">
            Todos los estudios de la plataforma, activos y suspendidos
          </p>
        </div>
        <button type="button" (click)="abrirAlta()" class="btn-primary shrink-0">Nuevo cliente</button>
      </div>

      <!-- Filtros: una sola fila arriba que acota toda la página -->
      <div class="card">
        <div class="card-body flex flex-wrap items-end gap-3">
          <div class="flex-1 min-w-[16rem]">
            <label class="form-label" for="buscar">Buscar</label>
            <input
              id="buscar"
              type="search"
              class="form-input"
              [(ngModel)]="buscar"
              (keyup.enter)="cargar(1)"
              placeholder="Nombre, RUT o casilla"
            />
          </div>
          <div>
            <label class="form-label" for="estado">Estado</label>
            <select id="estado" class="form-select w-auto" [(ngModel)]="estado" (ngModelChange)="cargar(1)">
              <option value="">Todos</option>
              <option value="activos">Activos</option>
              <option value="suspendidos">Suspendidos</option>
            </select>
          </div>
          <button type="button" class="btn-secondary" (click)="cargar(1)" [disabled]="cargando()">
            {{ cargando() ? 'Buscando...' : 'Buscar' }}
          </button>
        </div>
      </div>

      <!-- Alta en curso: la base de datos tarda, así que el avance se muestra
           en la propia lista y no en un cartel que se cierra solo. -->
      @if (enAlta(); as nuevo) {
        <div [class]="nuevo.aprovisionamiento === 'error' ? 'alert-danger' : 'alert-info'">
          @if (nuevo.aprovisionamiento === 'error') {
            <svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          } @else {
            <svg class="animate-spin w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          }
          <div class="flex-1">
            @if (nuevo.aprovisionamiento === 'error') {
              <p class="font-medium">No se pudo crear la base de datos de {{ nuevo.nombre }}</p>
              <p class="mt-0.5">
                {{ nuevo.aprovisionamiento_detalle || 'El servidor no entregó un detalle del error.' }}
                El cliente quedó creado pero sus usuarios no pueden ingresar.
              </p>
            } @else {
              <p class="font-medium">Creando la base de datos de {{ nuevo.nombre }}</p>
              <p class="mt-0.5">
                Puede tardar algunos minutos. Puede seguir trabajando: la lista se actualiza sola.
              </p>
            }
          </div>
          <a [routerLink]="['/admin/clientes', nuevo.id]"
             [class]="nuevo.aprovisionamiento === 'error' ? 'btn-danger btn-sm shrink-0' : 'btn-primary btn-sm shrink-0'">
            Ver ficha
          </a>
        </div>
      }

      <div class="card">
        <div class="card-body">
          @if (error()) {
            <div class="alert-danger">
              <div class="flex-1">
                <p class="font-medium">No se pudo cargar la lista de clientes.</p>
                <p class="text-sm mt-1">{{ error() }}</p>
              </div>
              <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar(page())">Reintentar</button>
            </div>
          } @else if (primeraCarga()) {
            <div class="flex items-center justify-center py-20">
              <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span class="sr-only">Cargando clientes</span>
            </div>
          } @else if (clientes().length === 0) {
            <div class="py-16 text-center">
              @if (hayFiltro()) {
                <p class="text-neutral-600 font-medium">Ningún cliente coincide con la búsqueda</p>
                <p class="text-neutral-500 text-sm mt-1">
                  Pruebe con parte del nombre o con el RUT sin puntos.
                </p>
                <button type="button" class="btn-secondary mt-4" (click)="limpiarFiltros()">
                  Limpiar la búsqueda
                </button>
              } @else {
                <p class="text-neutral-600 font-medium">Todavía no hay clientes</p>
                <p class="text-neutral-500 text-sm mt-1">
                  Al crear el primero, la plataforma le arma su base de datos y su casilla de ingesta.
                </p>
                <button type="button" class="btn-primary mt-4" (click)="abrirAlta()">Crear un cliente</button>
              }
            </div>
          } @else {
            <div class="transition-opacity" [class.opacity-60]="cargando()">
              <!-- Escritorio -->
              <div class="table-wrapper hidden md:block">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Cliente</th>
                      <th scope="col">RUT</th>
                      <th scope="col">Casilla de ingesta</th>
                      <th scope="col">Usuarios</th>
                      <th scope="col">Creado</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of clientes(); track c.id) {
                      <tr>
                        <td class="font-medium">
                          <a [routerLink]="['/admin/clientes', c.id]" class="text-primary-700 hover:underline">
                            {{ c.nombre }}
                          </a>
                        </td>
                        <td class="tabular-nums">{{ rutBonito(c.rut) }}</td>
                        <td class="text-neutral-600">{{ c.inbox }}</td>
                        <td class="tabular-nums">{{ c.total_usuarios }}</td>
                        <td>{{ c.fecha_creacion | date: 'dd-MM-yyyy' }}</td>
                        <td><span [class]="claseEstado(c)">{{ textoEstado(c) }}</span></td>
                        <td>
                          <div class="flex gap-2">
                            <a [routerLink]="['/admin/clientes', c.id]" class="btn-outline btn-sm">Ver ficha</a>
                            @if (c.activo) {
                              <button type="button" class="btn-secondary btn-sm" (click)="pedirSuspender(c)">
                                Suspender
                              </button>
                            } @else {
                              <button type="button" class="btn-secondary btn-sm" (click)="reactivar(c)"
                                      [disabled]="guardando()">
                                Reactivar
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Móvil: 7 columnas no caben -->
              <ul class="md:hidden space-y-3">
                @for (c of clientes(); track c.id) {
                  <li class="rounded-lg border border-neutral-200 p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <a [routerLink]="['/admin/clientes', c.id]"
                           class="font-medium text-primary-700 hover:underline break-words">
                          {{ c.nombre }}
                        </a>
                        <p class="text-xs text-neutral-500 tabular-nums">{{ rutBonito(c.rut) }}</p>
                      </div>
                      <span [class]="claseEstado(c) + ' shrink-0'">{{ textoEstado(c) }}</span>
                    </div>
                    <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <dt class="text-neutral-500">Casilla</dt>
                      <dd class="text-neutral-700 break-all">{{ c.inbox }}</dd>
                      <dt class="text-neutral-500">Usuarios</dt>
                      <dd class="text-neutral-700 tabular-nums">{{ c.total_usuarios }}</dd>
                      <dt class="text-neutral-500">Creado</dt>
                      <dd class="text-neutral-700">{{ c.fecha_creacion | date: 'dd-MM-yyyy' }}</dd>
                    </dl>
                    <div class="flex gap-2 mt-3">
                      <a [routerLink]="['/admin/clientes', c.id]" class="btn-outline btn-sm">Ver ficha</a>
                      @if (c.activo) {
                        <button type="button" class="btn-secondary btn-sm" (click)="pedirSuspender(c)">Suspender</button>
                      } @else {
                        <button type="button" class="btn-secondary btn-sm" (click)="reactivar(c)"
                                [disabled]="guardando()">Reactivar</button>
                      }
                    </div>
                  </li>
                }
              </ul>

              @if (totalPages() > 1) {
                <div class="flex items-center justify-between mt-4">
                  <span class="text-sm text-neutral-500">
                    Página {{ page() }} de {{ totalPages() }} ({{ total() }} clientes)
                  </span>
                  <div class="flex gap-2">
                    <button type="button" class="btn-secondary btn-sm" (click)="cargar(page() - 1)"
                            [disabled]="page() <= 1 || cargando()">Anterior</button>
                    <button type="button" class="btn-secondary btn-sm" (click)="cargar(page() + 1)"
                            [disabled]="page() >= totalPages() || cargando()">Siguiente</button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>

    <!-- ── Alta de cliente: dos pasos, porque el segundo no se deshace ── -->
    @if (modalAlta()) {
      <div class="modal-backdrop animar-fondo" (click)="cerrarAlta()">
        <div class="modal-content" (click)="$event.stopPropagation()" role="dialog" aria-modal="true"
             aria-labelledby="titulo-alta" (keydown.escape)="cerrarAlta()" tabindex="-1">
          <div class="modal-header">
            <h3 id="titulo-alta" class="text-lg font-semibold">
              {{ paso() === 'datos' ? 'Nuevo cliente' : 'Confirmar la creación' }}
            </h3>
            <button type="button" (click)="cerrarAlta()" class="text-neutral-400 hover:text-neutral-600"
                    aria-label="Cerrar">&times;</button>
          </div>

          @if (paso() === 'datos') {
            <div class="modal-body space-y-4">
              <div>
                <label class="form-label" for="nuevo-nombre">
                  Nombre del estudio <span class="text-danger-600">*</span>
                </label>
                <input id="nuevo-nombre" type="text" class="form-input" [(ngModel)]="modelo.nombre"
                       placeholder="Estudio Jurídico Alfaro y Cía." autocomplete="off" />
              </div>

              <div>
                <label class="form-label" for="nuevo-rut">RUT <span class="text-danger-600">*</span></label>
                <input id="nuevo-rut" type="text" class="form-input" [ngModel]="modelo.rut"
                       (ngModelChange)="alEscribirRut($event)" placeholder="12.345.678-9" autocomplete="off"
                       aria-describedby="ayuda-nuevo-rut" />
                <p id="ayuda-nuevo-rut" class="text-xs text-neutral-500 mt-1">
                  Con este RUT ingresan todos los usuarios del estudio. No se puede cambiar después.
                </p>
              </div>

              <div>
                <label class="form-label" for="nuevo-correo">
                  Correo de contacto <span class="text-danger-600">*</span>
                </label>
                <input id="nuevo-correo" type="email" class="form-input" [(ngModel)]="modelo.correo"
                       placeholder="contacto@estudio.cl" autocomplete="off" />
                <p class="text-xs text-neutral-500 mt-1">
                  Adonde se avisa de la puesta en marcha. No es la casilla desde la que se importan
                  los archivos.
                </p>
              </div>

              @if (errorAlta()) {
                <div class="alert-danger">{{ errorAlta() }}</div>
              }
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="cerrarAlta()">Cancelar</button>
              <button type="button" class="btn-primary" (click)="irAConfirmar()">Continuar</button>
            </div>
          } @else {
            <div class="modal-body space-y-4">
              <div class="alert-warning">
                <svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div class="flex-1">
                  <p class="font-medium">Se creará una base de datos nueva para este estudio</p>
                  <p class="mt-0.5">
                    La operación tarda algunos minutos y no se revierte desde el sistema: un cliente
                    creado por error solo se puede suspender, no eliminar. Revise el RUT antes de
                    continuar.
                  </p>
                </div>
              </div>

              <dl class="rounded-lg border border-neutral-200 divide-y divide-neutral-200 text-sm">
                <div class="flex justify-between gap-4 px-4 py-2">
                  <dt class="text-neutral-500">Estudio</dt>
                  <dd class="font-medium text-neutral-800 text-right">{{ modelo.nombre }}</dd>
                </div>
                <div class="flex justify-between gap-4 px-4 py-2">
                  <dt class="text-neutral-500">RUT</dt>
                  <dd class="font-medium text-neutral-800 tabular-nums">{{ modelo.rut }}</dd>
                </div>
                <div class="flex justify-between gap-4 px-4 py-2">
                  <dt class="text-neutral-500">Correo de contacto</dt>
                  <dd class="font-medium text-neutral-800 text-right break-all">{{ modelo.correo }}</dd>
                </div>
                <div class="flex justify-between gap-4 px-4 py-2">
                  <dt class="text-neutral-500">Casilla de ingesta</dt>
                  <dd class="text-neutral-600 text-right">Se asigna al crearlo (&#64;temposoft.cl)</dd>
                </div>
              </dl>

              @if (errorAlta()) {
                <div class="alert-danger">{{ errorAlta() }}</div>
              }
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="paso.set('datos')" [disabled]="guardando()">
                Volver
              </button>
              <button type="button" class="btn-primary" (click)="crear()" [disabled]="guardando()">
                {{ guardando() ? 'Creando...' : 'Crear cliente y su base de datos' }}
              </button>
            </div>
          }
        </div>
      </div>
    }

    <!-- ── Confirmación de suspensión ─────────────────────────────────── -->
    @if (aSuspender(); as cliente) {
      <div class="modal-backdrop animar-fondo" (click)="aSuspender.set(null)">
        <div class="modal-content" (click)="$event.stopPropagation()" role="dialog" aria-modal="true"
             aria-labelledby="titulo-suspender" (keydown.escape)="aSuspender.set(null)" tabindex="-1">
          <div class="modal-header">
            <h3 id="titulo-suspender" class="text-lg font-semibold">Suspender a {{ cliente.nombre }}</h3>
            <button type="button" (click)="aSuspender.set(null)" class="text-neutral-400 hover:text-neutral-600"
                    aria-label="Cerrar">&times;</button>
          </div>
          <div class="modal-body space-y-3">
            <p class="text-sm text-neutral-700">Mientras el cliente esté suspendido:</p>
            <ul class="list-disc pl-5 text-sm text-neutral-700 space-y-1">
              <li>Sus {{ cliente.total_usuarios }} usuarios no pueden iniciar sesión.</li>
              <li>La ingesta automática por correo lo salta: {{ cliente.inbox }} deja de revisarse.</li>
              <li>No se envían sus recordatorios ni sus informes.</li>
            </ul>
            <!-- Suspender no destruye nada. La advertencia fuerte se reserva
                 para el alta, que sí crea una base de datos. -->
            <div class="alert-info">
              Se conserva toda la información del estudio. Al reactivarlo vuelve a operar con
              sus datos intactos.
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="aSuspender.set(null)" [disabled]="guardando()">
              Cancelar
            </button>
            <button type="button" class="btn-primary" (click)="suspender(cliente)" [disabled]="guardando()">
              {{ guardando() ? 'Suspendiendo...' : 'Suspender cliente' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ClientesListComponent implements OnInit, OnDestroy {
  private service = inject(AdminClienteService);
  private notification = inject(NotificationService);

  buscar = '';
  estado = '';

  clientes = signal<Cliente[]>([]);
  cargando = signal(false);
  primeraCarga = signal(true);
  error = signal<string | null>(null);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

  modalAlta = signal(false);
  paso = signal<PasoAlta>('datos');
  guardando = signal(false);
  errorAlta = signal('');
  modelo = { nombre: '', rut: '', correo: '' };

  /** Cliente recién creado, mientras su base de datos se está armando. */
  enAlta = signal<Cliente | null>(null);
  aSuspender = signal<Cliente | null>(null);

  private polling?: Subscription;

  hayFiltro = computed(() => !!this.buscar.trim() || !!this.estado);

  ngOnInit(): void {
    this.cargar(1);
  }

  ngOnDestroy(): void {
    this.polling?.unsubscribe();
  }

  cargar(page: number): void {
    if (page < 1) return;
    this.cargando.set(true);
    this.error.set(null);

    this.service.list(page, 25, this.buscar.trim() || undefined, this.estado || undefined).subscribe({
      next: (res) => {
        this.clientes.set(res.clientes);
        this.page.set(res.page);
        this.totalPages.set(res.total_pages);
        this.total.set(res.total);
        this.cargando.set(false);
        this.primeraCarga.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.primeraCarga.set(false);
        this.error.set(e?.error?.detail || e?.message || 'Error de conexión con el servidor.');
      },
    });
  }

  limpiarFiltros(): void {
    this.buscar = '';
    this.estado = '';
    this.cargar(1);
  }

  rutBonito(rut: string): string {
    return formatearRut(rut);
  }

  textoEstado(c: Cliente): string {
    if (c.aprovisionamiento === 'error') return 'Base de datos con error';
    if (c.aprovisionamiento === 'creando' || c.aprovisionamiento === 'en_cola') {
      return 'Creando base de datos';
    }
    return c.activo ? 'Activo' : 'Suspendido';
  }

  claseEstado(c: Cliente): string {
    if (c.aprovisionamiento === 'error') return 'badge-danger';
    if (c.aprovisionamiento !== 'listo') return 'badge-info';
    return c.activo ? 'badge-success' : 'badge-neutral';
  }

  // ── Alta ───────────────────────────────────────────────────────────────

  abrirAlta(): void {
    this.modelo = { nombre: '', rut: '', correo: '' };
    this.paso.set('datos');
    this.errorAlta.set('');
    this.modalAlta.set(true);
  }

  cerrarAlta(): void {
    if (this.guardando()) return;
    this.modalAlta.set(false);
  }

  alEscribirRut(valor: string): void {
    this.modelo.rut = formatearRut(valor);
  }

  irAConfirmar(): void {
    const invalido = this.validar();
    if (invalido) {
      this.errorAlta.set(invalido);
      return;
    }
    this.errorAlta.set('');
    this.paso.set('confirmar');
  }

  private validar(): string | null {
    if (this.modelo.nombre.trim().length < 3) return 'Indique el nombre del estudio';
    if (!rutValido(this.modelo.rut)) return 'El RUT no es válido. Revise el dígito verificador.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.modelo.correo.trim())) {
      return 'Indique un correo de contacto válido';
    }
    return null;
  }

  crear(): void {
    this.errorAlta.set('');
    this.guardando.set(true);

    this.service
      .create({
        nombre: this.modelo.nombre.trim(),
        rut: rutPlano(this.modelo.rut),
        correo: this.modelo.correo.trim(),
      })
      .subscribe({
        next: (cliente) => {
          this.guardando.set(false);
          this.modalAlta.set(false);
          this.enAlta.set(cliente);
          this.notification.success(`Cliente ${cliente.nombre} creado. Se está armando su base de datos.`);
          this.cargar(1);
          this.seguirAprovisionamiento(cliente);
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorAlta.set(this.mensajeError(err));
        },
      });
  }

  /** Consulta el avance cada 5 segundos hasta que termina, bien o mal. */
  private seguirAprovisionamiento(cliente: Cliente): void {
    this.polling?.unsubscribe();
    this.polling = timer(5000, 5000)
      .pipe(switchMap(() => this.service.estadoAprovisionamiento(cliente.id)))
      .subscribe({
        next: (estado) => {
          const actual = this.enAlta();
          if (!actual) return;

          if (estado.estado === 'listo') {
            this.polling?.unsubscribe();
            this.enAlta.set(null);
            this.notification.success(`${actual.nombre} ya está operativo. Puede crear sus usuarios.`);
            this.cargar(this.page());
            return;
          }

          this.enAlta.set({
            ...actual,
            aprovisionamiento: estado.estado,
            aprovisionamiento_detalle: estado.detalle,
          });

          if (estado.estado === 'error') {
            this.polling?.unsubscribe();
            this.cargar(this.page());
          }
        },
        error: () => {
          this.polling?.unsubscribe();
          this.notification.warning(
            'Se perdió el seguimiento de la creación. Abra la ficha del cliente para ver en qué quedó.'
          );
        },
      });
  }

  // ── Suspender / reactivar ──────────────────────────────────────────────

  pedirSuspender(cliente: Cliente): void {
    this.aSuspender.set(cliente);
  }

  suspender(cliente: Cliente): void {
    this.guardando.set(true);
    this.service.suspender(cliente.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.aSuspender.set(null);
        this.notification.success(
          `${cliente.nombre} quedó suspendido. Puede reactivarlo cuando quiera desde esta misma lista.`
        );
        this.cargar(this.page());
      },
      error: (err) => {
        this.guardando.set(false);
        this.notification.error(this.mensajeError(err));
      },
    });
  }

  reactivar(cliente: Cliente): void {
    this.guardando.set(true);
    this.service.reactivar(cliente.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.notification.success(`${cliente.nombre} volvió a quedar activo`);
        this.cargar(this.page());
      },
      error: (err) => {
        this.guardando.set(false);
        this.notification.error(this.mensajeError(err));
      },
    });
  }

  /** FastAPI devuelve `detail` como texto, o como lista en los errores 422. */
  private mensajeError(err: unknown): string {
    const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const primero = detail[0] as { msg?: string };
      if (primero?.msg) return primero.msg;
    }
    return 'No se pudo completar la operación. Intente de nuevo.';
  }
}
