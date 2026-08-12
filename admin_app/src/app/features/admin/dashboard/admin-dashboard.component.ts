import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { EChartsCoreOption } from 'echarts/core';

import { AdminDashboard, ClienteActividad } from '@core/models/admin.model';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { GraficoComponent } from '@shared/grafico/grafico.component';
import { formatearRut } from '@core/utils/rut';

/** Los mismos tokens que usa el resto de la consola: el gráfico no inventa
 *  colores propios ni una tipografía distinta a la de la página. */
const COLOR = {
  activos: '#16a34a', // accent-600
  suspendidos: '#d97706', // warning-600
  texto: '#525252', // neutral-600
  linea: '#e5e5e5', // neutral-200
};
const FUENTE = 'Inter, system-ui, -apple-system, sans-serif';

const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * Inicio de la consola: qué estudios están operando hoy y cuáles dejaron de
 * recibir archivos.
 *
 * **Tres cosas y solo una mira un período.** Los KPIs y el gráfico de clientes
 * por mes son del estado de la plataforma —desde que existe— y no se acotan a
 * los últimos N días: preguntar "cuántos clientes hay en los últimos 30 días"
 * no significa nada. El filtro de período acota la tabla de actividad y por eso
 * vive dentro de esa tarjeta, no en el encabezado de la página.
 *
 * El gráfico responde una pregunta que la tabla no puede: cómo viene la cartera
 * mes a mes. Identificar al cliente que se cayó sigue siendo trabajo de la
 * tabla.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GraficoComponent],
  template: `
    <div class="space-y-6">
      <!-- Encabezado. El filtro de período NO va acá: solo acota la tabla de
           actividad y vive en su tarjeta, para que no parezca que gobierna los
           KPIs ni el gráfico. -->
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Dashboard</h1>
          <p class="text-neutral-500 mt-1">
            Estadísticos de nuestros clientes
          </p>
        </div>
        <div class="flex items-end gap-3">
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

          <!-- ── KPIs ─────────────────────────────────────────────────
               Los cuatro son del estado de HOY, no del período: cuántos
               clientes hay y en qué estado están no se acota a 30 días. -->
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <!-- Verde suave: es el único KPI donde un número alto es una buena
                 noticia, y se lee de una pasada frente a los otros tres. -->
            <div class="card bg-accent-50 border-accent-200">
              <div class="card-body">
                <p class="text-sm text-accent-800">Clientes activos</p>
                <p class="text-3xl font-semibold text-accent-900 mt-1">{{ miles(d.kpis.clientes_activos) }}</p>
                <p class="text-xs text-accent-700 mt-1">Con acceso habilitado</p>
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
                <p class="text-sm text-neutral-500">Usuarios activos</p>
                <p class="text-3xl font-semibold text-neutral-800 mt-1">{{ miles(d.kpis.usuarios_activos) }}</p>
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

          <!-- ── Evolución de la cartera ──────────────────────────── -->
          <div class="card">
            <div class="card-header">
              <h2 class="font-semibold text-neutral-800">Clientes por mes</h2>
              <p class="text-sm text-neutral-500">
                Cuántos había activos y suspendidos al cerrar cada uno de los últimos 12 meses
              </p>
            </div>
            <div class="card-body">
              @if (hayEvolucion()) {
                <app-grafico [opciones]="opcionesEvolucion()" [alto]="300" />
                @if (d.historial_desde) {
                  <p class="text-xs text-neutral-500 mt-2">
                    Las suspensiones se registran desde el {{ fechaLarga(d.historial_desde) }}.
                    Antes de esa fecha el gráfico solo conoce las altas.
                  </p>
                } @else {
                  <p class="text-xs text-neutral-500 mt-2">
                    Todavía no se ha registrado ninguna suspensión: la línea empieza a
                    dibujarse cuando ocurra la primera.
                  </p>
                }

                <!-- La misma serie en texto: un gráfico en canvas no lo lee un
                     lector de pantalla, y acá los números son pocos. -->
                <details class="mt-3">
                  <summary class="text-sm text-primary-700 cursor-pointer">Ver los datos en tabla</summary>
                  <div class="table-wrapper mt-2">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Mes</th>
                          <th scope="col" style="text-align:right!important">Activos</th>
                          <th scope="col" style="text-align:right!important">Suspendidos</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (p of d.evolucion_clientes; track p.mes) {
                          <tr>
                            <td>{{ etiquetaMes(p.mes) }}</td>
                            <td class="tabular-nums" style="text-align:right!important">{{ miles(p.activos) }}</td>
                            <td class="tabular-nums" style="text-align:right!important">{{ miles(p.suspendidos) }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </details>
              } @else {
                <div class="py-12 text-center">
                  <p class="text-neutral-600 font-medium">Todavía no hay clientes que graficar</p>
                  <p class="text-neutral-500 text-sm mt-1">
                    La serie aparece en cuanto exista el primer estudio.
                  </p>
                </div>
              }
            </div>
          </div>

          <!-- ── Tabla de clientes activos ──────────────────────────
               Es la ÚNICA parte de la pantalla que mira un período, y por eso
               el filtro vive acá dentro y no en el encabezado. -->
          <div class="card">
            <div class="card-header flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 class="font-semibold text-neutral-800">Actividad por cliente</h2>
                <p class="text-sm text-neutral-500">
                  Ordenados por tiempo sin recibir archivos: primero los que necesitan atención
                  — del {{ fechaLarga(d.desde) }} al {{ fechaLarga(d.hasta) }}
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
                <a routerLink="/clientes" class="btn-secondary btn-sm">Ver todos los clientes</a>
              </div>
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
                        <th scope="col">Casilla PJUD</th>
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

  /** Sin un solo cliente no hay nada que graficar: se muestra el vacío. */
  hayEvolucion = computed(() =>
    (this.datos()?.evolucion_clientes ?? []).some((p) => p.activos + p.suspendidos > 0)
  );

  /**
   * Área de dos series, igual que "Recibidos vs resueltos" de la app de los
   * estudios.
   *
   * `smooth: false` a propósito: los puntos son conteos de fin de mes, no una
   * señal continua, y una curva suavizada inventa valores intermedios que
   * nunca existieron. El área va con opacidad baja solo en la línea de activos:
   * dos áreas superpuestas se leen como una tercera zona de color que no
   * significa nada.
   */
  opcionesEvolucion = computed<EChartsCoreOption>(() => {
    const puntos = this.datos()?.evolucion_clientes ?? [];
    const ejeBase = {
      axisLabel: { color: COLOR.texto, fontSize: 11, fontFamily: FUENTE },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: COLOR.linea } },
    };
    return {
      color: [COLOR.activos, COLOR.suspendidos],
      tooltip: {
        trigger: 'axis',
        textStyle: { fontFamily: FUENTE, fontSize: 12 },
      },
      legend: {
        data: ['Activos', 'Suspendidos'],
        bottom: 0,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: COLOR.texto, fontSize: 12, fontFamily: FUENTE },
      },
      grid: { left: 8, right: 16, top: 16, bottom: 34, containLabel: true },
      xAxis: {
        type: 'category',
        data: puntos.map((p) => this.etiquetaMes(p.mes)),
        boundaryGap: false,
        ...ejeBase,
      },
      yAxis: {
        type: 'value',
        // Sin esto ECharts inventa medios clientes en el eje cuando los
        // números son chicos.
        minInterval: 1,
        ...ejeBase,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: COLOR.linea, type: 'dashed' } },
      },
      series: [
        {
          name: 'Activos',
          type: 'line',
          data: puntos.map((p) => p.activos),
          smooth: false,
          showSymbol: false,
          lineStyle: { width: 2, cap: 'round', join: 'round' },
          areaStyle: { opacity: 0.1 },
        },
        {
          name: 'Suspendidos',
          type: 'line',
          data: puntos.map((p) => p.suspendidos),
          smooth: false,
          showSymbol: false,
          lineStyle: { width: 2, cap: 'round', join: 'round' },
        },
      ],
    };
  });

  /** `2026-07` → `jul 2026`. Sin pasar por Date, que corre el mes por zona. */
  etiquetaMes(mes: string): string {
    const [anio, m] = mes.split('-');
    return `${MESES_CORTOS[Number(m) - 1] ?? m} ${anio}`;
  }

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
