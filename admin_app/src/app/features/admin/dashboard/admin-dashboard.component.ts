import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AdminDashboard, ClienteActividad } from '@core/models/admin.model';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { formatearRut } from '@core/utils/rut';

/**
 * Inicio de la consola: qué estudios están operando hoy y cuáles dejaron de
 * recibir archivos.
 *
 * No lleva gráficos a propósito. El trabajo del dato acá es "identificar al
 * cliente que se cayó", no "leer una tendencia": con decenas de clientes, una
 * tabla ordenable responde eso de una mirada y un gráfico solo agregaría un
 * paso intermedio.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Encabezado + filtros en una sola fila que acota toda la página -->
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Clientes activos</h1>
          <p class="text-neutral-500 mt-1">
            @if (datos(); as d) {
              Actividad del {{ fechaLarga(d.desde) }} al {{ fechaLarga(d.hasta) }}
            } @else {
              Estado de los estudios que operan en la plataforma
            }
          </p>
        </div>
        <div class="flex items-end gap-3">
          <div>
            <label class="form-label" for="periodo">Período</label>
            <select
              id="periodo"
              class="form-select w-auto"
              [ngModel]="dias()"
              (ngModelChange)="cambiarPeriodo($event)"
            >
              @for (opcion of opcionesPeriodo; track opcion) {
                <option [ngValue]="opcion">Últimos {{ opcion }} días</option>
              }
            </select>
          </div>
          <button type="button" class="btn-secondary" (click)="cargar()" [disabled]="cargando()">
            {{ cargando() ? 'Actualizando...' : 'Actualizar' }}
          </button>
          <a routerLink="/clientes" class="btn-primary">Nuevo cliente</a>
        </div>
      </div>

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudo cargar el estado de los clientes.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">Reintentar</button>
        </div>
      } @else if (datos()) {
        <!-- En refetch se atenúa el contenido en vez de volver al esqueleto. -->
        <div class="space-y-6 transition-opacity" [class.opacity-60]="cargando()">
          @if (datos(); as d) {
          <!-- Altas que quedaron a medias: es lo primero que el administrador
               tiene que resolver, va sobre los KPIs. -->
          @if (d.aprovisionamientos_con_error.length > 0) {
            <div class="alert-danger">
              <svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div class="flex-1">
                <p class="font-medium">
                  {{ d.aprovisionamientos_con_error.length === 1
                      ? 'Un cliente quedó sin su base de datos'
                      : d.aprovisionamientos_con_error.length + ' clientes quedaron sin su base de datos' }}
                </p>
                <ul class="mt-1 space-y-0.5 text-sm">
                  @for (c of d.aprovisionamientos_con_error; track c.id) {
                    <li>
                      <a [routerLink]="['/clientes', c.id]" class="font-medium underline">{{ c.nombre }}</a>
                      @if (c.detalle) { — {{ c.detalle }} }
                    </li>
                  }
                </ul>
                <p class="text-sm mt-1">
                  Sus usuarios no pueden ingresar hasta que la creación se reintente desde la ficha.
                </p>
              </div>
            </div>
          }

          @if (d.aprovisionamientos_en_curso > 0) {
            <div class="alert-info">
              <svg class="animate-spin w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <div class="flex-1">
                {{ d.aprovisionamientos_en_curso === 1
                    ? 'Se está creando la base de datos de un cliente.'
                    : 'Se están creando las bases de datos de ' + d.aprovisionamientos_en_curso + ' clientes.' }}
                Puede tardar algunos minutos.
              </div>
            </div>
          }

          <!-- ── KPIs ─────────────────────────────────────────────── -->
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div class="card">
              <div class="card-body">
                <p class="text-sm text-neutral-500">Clientes activos</p>
                <p class="text-3xl font-semibold text-neutral-800 mt-1">{{ miles(d.kpis.clientes_activos) }}</p>
                <p class="text-xs text-neutral-500 mt-1">Con acceso habilitado</p>
              </div>
            </div>
            <div class="card">
              <div class="card-body">
                <p class="text-sm text-neutral-500">Clientes suspendidos</p>
                <p class="text-3xl font-semibold text-neutral-800 mt-1">{{ miles(d.kpis.clientes_suspendidos) }}</p>
                <p class="text-xs text-neutral-500 mt-1">Reversible, sin pérdida de datos</p>
              </div>
            </div>
            <div class="card">
              <div class="card-body">
                <p class="text-sm text-neutral-500">Usuarios habilitados</p>
                <p class="text-3xl font-semibold text-neutral-800 mt-1">{{ miles(d.kpis.usuarios_habilitados) }}</p>
                <p class="text-xs text-neutral-500 mt-1">En todos los clientes activos</p>
              </div>
            </div>
            <div
              class="card"
              [class.border-danger-300]="d.kpis.clientes_sin_importar > 0"
              [class.bg-danger-50]="d.kpis.clientes_sin_importar > 0"
            >
              <div class="card-body">
                <p class="text-sm text-neutral-500 flex items-center gap-1.5">
                  @if (d.kpis.clientes_sin_importar > 0) {
                    <svg class="w-4 h-4 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  }
                  Sin recibir archivos
                </p>
                <p class="text-3xl font-semibold mt-1"
                   [class]="d.kpis.clientes_sin_importar > 0 ? 'text-danger-700' : 'text-neutral-800'">
                  {{ miles(d.kpis.clientes_sin_importar) }}
                </p>
                <p class="text-xs text-neutral-500 mt-1">
                  Activos, hace más de {{ d.umbral_sin_importar }} días
                </p>
              </div>
            </div>
          </div>

          <!-- ── Tabla de clientes activos ────────────────────────── -->
          <div class="card">
            <div class="card-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="font-semibold text-neutral-800">Actividad por cliente</h2>
                <p class="text-sm text-neutral-500">
                  Ordenados por tiempo sin recibir archivos: primero los que necesitan atención
                </p>
              </div>
              <a routerLink="/clientes" class="btn-secondary btn-sm">Ver todos los clientes</a>
            </div>
            <div class="card-body">
              @if (d.clientes.length === 0) {
                <div class="py-16 text-center">
                  <p class="text-neutral-600 font-medium">Todavía no hay clientes activos</p>
                  <p class="text-neutral-500 text-sm mt-1">
                    Cree el primer estudio para que sus usuarios puedan ingresar.
                  </p>
                  <a routerLink="/clientes" class="btn-primary mt-4">Crear un cliente</a>
                </div>
              } @else {
                <!-- Escritorio: 6 columnas, densidad alta -->
                <div class="table-wrapper hidden md:block">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Cliente</th>
                        <th scope="col">Casilla de ingesta</th>
                        <th scope="col">CAL</th>
                        <th scope="col">Última importación</th>
                        <th scope="col">Movimientos ({{ d.dias }} d)</th>
                        <th scope="col">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of clientesOrdenados(); track c.id) {
                        <tr>
                          <td class="font-medium">
                            <a [routerLink]="['/clientes', c.id]" class="text-primary-700 hover:underline">
                              {{ c.nombre }}
                            </a>
                            <span class="block text-xs text-neutral-500">{{ rutBonito(c.rut) }}</span>
                          </td>
                          <td class="text-neutral-600">{{ c.inbox }}</td>
                          <td class="tabular-nums">{{ miles(c.total_usuarios) }}</td>
                          <td>
                            @if (c.ultima_importacion) {
                              {{ c.ultima_importacion | date: 'dd-MM-yyyy HH:mm' }}
                            } @else {
                              <span class="text-neutral-500">Nunca</span>
                            }
                          </td>
                          <td class="tabular-nums">{{ miles(c.movimientos_periodo) }}</td>
                          <td><span [class]="claseEstado(c)">{{ textoEstado(c, d.umbral_sin_importar) }}</span></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Móvil: 6 columnas no caben, se leen como tarjetas -->
                <ul class="md:hidden space-y-3">
                  @for (c of clientesOrdenados(); track c.id) {
                    <li class="rounded-lg border border-neutral-200 p-3">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <a [routerLink]="['/clientes', c.id]"
                             class="font-medium text-primary-700 hover:underline break-words">
                            {{ c.nombre }}
                          </a>
                          <p class="text-xs text-neutral-500">{{ rutBonito(c.rut) }}</p>
                        </div>
                        <span [class]="claseEstado(c) + ' shrink-0'">
                          {{ textoEstado(c, d.umbral_sin_importar) }}
                        </span>
                      </div>
                      <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                        <dt class="text-neutral-500">Casilla</dt>
                        <dd class="text-neutral-700 break-all">{{ c.inbox }}</dd>
                        <dt class="text-neutral-500">Usuarios</dt>
                        <dd class="text-neutral-700 tabular-nums">{{ miles(c.total_usuarios) }}</dd>
                        <dt class="text-neutral-500">Última importación</dt>
                        <dd class="text-neutral-700">
                          {{ c.ultima_importacion ? (c.ultima_importacion | date: 'dd-MM-yyyy HH:mm') : 'Nunca' }}
                        </dd>
                        <dt class="text-neutral-500">Movimientos ({{ d.dias }} d)</dt>
                        <dd class="text-neutral-700 tabular-nums">{{ miles(c.movimientos_periodo) }}</dd>
                      </dl>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
          }
        </div>
      } @else {
        <!-- Primera carga: esqueleto, nunca una pantalla en blanco. -->
        <div class="space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="card animate-pulse">
                <div class="card-body space-y-3">
                  <div class="h-3 w-32 bg-neutral-200 rounded"></div>
                  <div class="h-8 w-20 bg-neutral-200 rounded"></div>
                </div>
              </div>
            }
          </div>
          <div class="card animate-pulse">
            <div class="card-body h-64 bg-neutral-100 rounded-b-xl"></div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminDashboardComponent implements OnInit {
  private readonly service = inject(AdminDashboardService);

  readonly opcionesPeriodo = [7, 15, 30, 90] as const;

  dias = signal<number>(30);
  datos = signal<AdminDashboard | null>(null);
  cargando = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cambiarPeriodo(dias: number): void {
    this.dias.set(dias);
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.getDashboard(this.dias()).subscribe({
      next: (r) => {
        this.datos.set(r);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.detail || e?.message || 'Error de conexión con el servidor.');
        this.cargando.set(false);
      },
    });
  }

  /** Lo urgente arriba: primero el que lleva más tiempo sin recibir archivos,
   *  y los que nunca importaron por delante de todos. */
  clientesOrdenados = computed<ClienteActividad[]>(() => {
    const lista = [...(this.datos()?.clientes ?? [])];
    return lista.sort((a, b) => {
      const da = a.dias_sin_importar ?? Number.MAX_SAFE_INTEGER;
      const db = b.dias_sin_importar ?? Number.MAX_SAFE_INTEGER;
      if (da !== db) return db - da;
      return a.nombre.localeCompare(b.nombre, 'es');
    });
  });

  miles(valor: number | null | undefined): string {
    return (valor ?? 0).toLocaleString('es-CL');
  }

  /** 'YYYY-MM-DD' → 'dd-MM-yyyy' sin pasar por Date (que corre el día en Chile). */
  fechaLarga(iso: string): string {
    const [a, m, d] = iso.split('-');
    return `${d}-${m}-${a}`;
  }

  rutBonito(rut: string): string {
    return formatearRut(rut);
  }

  /** El estado nunca depende solo del color: el badge siempre lleva texto. */
  textoEstado(c: ClienteActividad, umbral: number): string {
    if (c.aprovisionamiento === 'error') return 'Base de datos con error';
    if (c.aprovisionamiento === 'creando' || c.aprovisionamiento === 'en_cola') {
      return 'Creando base de datos';
    }
    if (c.dias_sin_importar === null) return 'Sin importaciones';
    if (c.dias_sin_importar > umbral) return `${c.dias_sin_importar} días sin recibir`;
    return 'Al día';
  }

  claseEstado(c: ClienteActividad): string {
    if (c.aprovisionamiento === 'error') return 'badge-danger';
    if (c.aprovisionamiento !== 'listo') return 'badge-info';
    if (c.dias_sin_importar === null) return 'badge-neutral';
    const umbral = this.datos()?.umbral_sin_importar ?? 3;
    return c.dias_sin_importar > umbral ? 'badge-danger' : 'badge-success';
  }
}
