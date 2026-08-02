import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { EChartsCoreOption } from 'echarts/core';

import { DashboardResponse } from '@core/models/dashboard.model';
import { GraficoComponent } from './components/grafico/grafico.component';
import { DashboardService } from './services/dashboard.service';

/** Colores de marca de los gráficos.
 *
 * NIVEL_* son colores fijos del negocio (bajo=naranjo, medio=amarillo,
 * alto=rojo) y son los mismos de las clases `.badge-orange` / `.badge-yellow` /
 * `.badge-danger`. No se cambian: el abogado ya asocia el color al nivel.
 * El resto sale de la paleta semántica de tailwind.config.js.
 */
const COLOR = {
  primario: '#2563eb', // primary-600
  exito: '#16a34a', // accent-600
  ambar: '#d97706', // warning-600
  peligro: '#dc2626', // danger-600
  nivelBajo: '#f97316', // orange-500
  nivelMedio: '#eab308', // yellow-500
  nivelAlto: '#dc2626', // danger-600
  eje: '#e5e5e5', // neutral-200
  texto: '#525252', // neutral-600
  textoTenue: '#737373', // neutral-500
} as const;

const FUENTE = 'Inter, system-ui, -apple-system, sans-serif';

/** Chrome común: rejilla fina y sólida, ejes recesivos, sin ruido. */
const EJE_BASE = {
  axisLine: { lineStyle: { color: COLOR.eje, width: 1 } },
  axisTick: { show: false },
  axisLabel: { color: COLOR.textoTenue, fontSize: 11, fontFamily: FUENTE },
};

const SPLIT_LINE = { lineStyle: { color: COLOR.eje, width: 1, type: 'solid' } };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, GraficoComponent],
  template: `
    <div class="space-y-6">
      <!-- Encabezado + fila de filtros: una sola fila arriba que acota TODA la
           página; no hay filtros dentro de cada tarjeta. -->
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Dashboard de gestión</h1>
          <p class="text-neutral-500 mt-1">
            @if (datos(); as d) {
              Período del {{ fechaLarga(d.desde) }} al {{ fechaLarga(d.hasta) }}
            } @else {
              Resumen del trabajo del estudio
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
        </div>
      </div>

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudieron cargar las métricas.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">
            Reintentar
          </button>
        </div>
      } @else if (datos()) {
        <!-- En refetch se atenúa el contenido en vez de volver al esqueleto:
             sin salto de layout ni parpadeo. -->
        <div class="space-y-6 transition-opacity" [class.opacity-60]="cargando()">
          @if (datos(); as d) {
          @if (d.aviso_carga.sin_carga_reciente) {
            <div class="alert-warning">
              <svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div class="flex-1">
                <p class="font-medium">Puede que falten archivos por cargar</p>
                <p class="mt-0.5">{{ d.aviso_carga.mensaje }}</p>
              </div>
              <a routerLink="/estado-diario/upload" class="btn-warning btn-sm shrink-0">Cargar archivo</a>
            </div>
          }

          <!-- ── KPIs ─────────────────────────────────────────────── -->
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div class="card">
              <div class="card-body">
                <p class="text-sm text-neutral-500">Estados diarios sin revisar</p>
                <p class="text-3xl font-semibold text-neutral-800 mt-1">
                  {{ miles(d.kpis.sin_revisar) }}
                </p>
                <p class="text-xs text-neutral-400 mt-1">Acumulado, no solo del período</p>
              </div>
            </div>
            <div class="card">
              <div class="card-body">
                <p class="text-sm text-neutral-500">Resueltos en el período</p>
                <p class="text-3xl font-semibold text-accent-700 mt-1">
                  {{ miles(d.kpis.resueltos_periodo) }}
                </p>
                <p class="text-xs text-neutral-400 mt-1">
                  De {{ miles(d.kpis.recibidos_periodo) }} recibidos
                </p>
              </div>
            </div>
            <div class="card">
              <div class="card-body">
                <p class="text-sm text-neutral-500">Recordatorios vigentes</p>
                <p class="text-3xl font-semibold text-neutral-800 mt-1">
                  {{ miles(d.kpis.recordatorios_vigentes) }}
                </p>
                <p class="text-xs text-neutral-400 mt-1">Sin finalizar</p>
              </div>
            </div>
            <div
              class="card"
              [class.border-danger-300]="d.kpis.recordatorios_atrasados > 0"
              [class.bg-danger-50]="d.kpis.recordatorios_atrasados > 0"
            >
              <div class="card-body">
                <p class="text-sm text-neutral-500 flex items-center gap-1.5">
                  @if (d.kpis.recordatorios_atrasados > 0) {
                    <svg class="w-4 h-4 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  }
                  Recordatorios atrasados
                </p>
                <p
                  class="text-3xl font-semibold mt-1"
                  [class]="d.kpis.recordatorios_atrasados > 0 ? 'text-danger-700' : 'text-neutral-800'"
                >
                  {{ miles(d.kpis.recordatorios_atrasados) }}
                </p>
                <p class="text-xs text-neutral-400 mt-1">Vencidos y sin finalizar</p>
              </div>
            </div>
          </div>

          @if (sinDatos()) {
            <div class="card">
              <div class="card-body py-16 text-center">
                <p class="text-neutral-600 font-medium">Sin datos para este período</p>
                <p class="text-neutral-500 text-sm mt-1">
                  No hay estados diarios ni recordatorios en los últimos {{ d.dias }} días.
                  Pruebe con un período más largo o cargue un archivo.
                </p>
                <a routerLink="/estado-diario/upload" class="btn-primary mt-4">Cargar archivo</a>
              </div>
            </div>
          } @else {
            <!-- ── Gráficos ───────────────────────────────────────── -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Evolución diaria (ocupa el ancho completo: es la serie larga) -->
              <div class="card lg:col-span-2">
                <div class="card-header flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 class="font-semibold text-neutral-800">Recibidos vs resueltos por día</h2>
                    <p class="text-sm text-neutral-500">
                      Recibidos según la fecha del archivo; resueltos según la fecha en que se marcaron
                    </p>
                  </div>
                  <button type="button" class="btn-secondary btn-sm" (click)="verTabla.set(!verTabla())">
                    {{ verTabla() ? 'Ver gráfico' : 'Ver tabla' }}
                  </button>
                </div>
                <div class="card-body">
                  @if (verTabla()) {
                    <div class="table-wrapper max-h-80 overflow-y-auto">
                      <table class="data-table">
                        <thead>
                          <tr><th>Día</th><th>Recibidos</th><th>Resueltos</th></tr>
                        </thead>
                        <tbody>
                          @for (p of d.evolucion_diaria; track p.dia) {
                            <tr>
                              <td>{{ fechaCorta(p.dia) }}</td>
                              <td class="tabular-nums">{{ miles(p.recibidos) }}</td>
                              <td class="tabular-nums">{{ miles(p.resueltos) }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <app-grafico [opciones]="opcionesEvolucion()" [alto]="300" />
                  }
                </div>
              </div>

              <!-- Recordatorios atrasados por nivel -->
              <div class="card">
                <div class="card-header">
                  <h2 class="font-semibold text-neutral-800">Recordatorios atrasados por nivel</h2>
                  <p class="text-sm text-neutral-500">Vencidos y sin finalizar, por urgencia</p>
                </div>
                <div class="card-body">
                  @if (totalNiveles() === 0) {
                    <p class="text-neutral-500 text-center py-16">
                      No hay recordatorios atrasados. Al día.
                    </p>
                  } @else {
                    <app-grafico [opciones]="opcionesNiveles()" [alto]="260" />
                  }
                </div>
              </div>

              <!-- Composición del trabajo -->
              <div class="card">
                <div class="card-header">
                  <h2 class="font-semibold text-neutral-800">Composición del trabajo</h2>
                  <p class="text-sm text-neutral-500">
                    Estados diarios recibidos en el período, por estado actual
                  </p>
                </div>
                <div class="card-body">
                  @if (totalComposicion() === 0) {
                    <p class="text-neutral-500 text-center py-16">Sin datos para este período</p>
                  } @else {
                    <app-grafico [opciones]="opcionesComposicion()" [alto]="260" />
                  }
                </div>
              </div>

              <!-- Carga por tribunal -->
              <div class="card">
                <div class="card-header">
                  <h2 class="font-semibold text-neutral-800">Carga por tribunal</h2>
                  <p class="text-sm text-neutral-500">Los 10 con más movimientos en el período</p>
                </div>
                <div class="card-body">
                  @if (d.por_tribunal.length === 0) {
                    <p class="text-neutral-500 text-center py-16">Sin datos para este período</p>
                  } @else {
                    <app-grafico [opciones]="opcionesTribunales()" [alto]="altoTribunales()" />
                  }
                </div>
              </div>

              <!-- Distribución por jurisdicción -->
              <div class="card">
                <div class="card-header">
                  <h2 class="font-semibold text-neutral-800">Distribución por jurisdicción</h2>
                  <p class="text-sm text-neutral-500">Movimientos del período por materia</p>
                </div>
                <div class="card-body">
                  @if (d.por_jurisdiccion.length === 0) {
                    <p class="text-neutral-500 text-center py-16">Sin datos para este período</p>
                  } @else {
                    <app-grafico [opciones]="opcionesJurisdicciones()" [alto]="altoJurisdicciones()" />
                  }
                </div>
              </div>

              <!-- Tiempo promedio de resolución -->
              <div class="card">
                <div class="card-header">
                  <h2 class="font-semibold text-neutral-800">Tiempo promedio de resolución</h2>
                  <p class="text-sm text-neutral-500">
                    Días entre la fecha del estado diario y su resolución
                  </p>
                </div>
                <div class="card-body">
                  @if (d.kpis.promedio_resolucion_dias === null) {
                    <p class="text-neutral-500 text-center py-16">
                      No hubo resoluciones en este período
                    </p>
                  } @else {
                    <p class="text-3xl font-semibold text-neutral-800">
                      {{ d.kpis.promedio_resolucion_dias }}
                      <span class="text-base font-normal text-neutral-500">días en promedio</span>
                    </p>
                    <app-grafico [opciones]="opcionesResolucion()" [alto]="200" />
                  }
                </div>
              </div>

              <!-- Cumplimiento de recordatorios -->
              <div class="card">
                <div class="card-header">
                  <h2 class="font-semibold text-neutral-800">Cumplimiento de recordatorios</h2>
                  <p class="text-sm text-neutral-500">
                    Finalizados en el período, según si se cerraron antes de su fecha
                  </p>
                </div>
                <div class="card-body">
                  @if (totalCumplimiento() === 0) {
                    <p class="text-neutral-500 text-center py-16">
                      No se finalizó ningún recordatorio en este período
                    </p>
                  } @else {
                    <app-grafico [opciones]="opcionesCumplimiento()" [alto]="240" />
                    <p class="text-sm text-neutral-500 mt-2">
                      {{ porcentajeATiempo() }}% de {{ miles(totalCumplimiento()) }} recordatorios se
                      cerró a tiempo.
                    </p>
                  }
                </div>
              </div>
            </div>
          }
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
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="card animate-pulse">
                <div class="card-body h-64 bg-neutral-100 rounded-b-xl"></div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly service = inject(DashboardService);

  readonly opcionesPeriodo = [7, 15, 30, 90] as const;

  dias = signal<number>(30);
  datos = signal<DashboardResponse | null>(null);
  cargando = signal(false);
  error = signal<string | null>(null);
  verTabla = signal(false);

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

  // ── Formato es-CL ────────────────────────────────────────────────────
  /** Miles con punto. */
  miles(valor: number | null | undefined): string {
    return (valor ?? 0).toLocaleString('es-CL');
  }

  /** 'YYYY-MM-DD' → 'dd-MM-yyyy'. Se parte el string en vez de usar `new Date`:
   * el constructor interpreta la fecha ISO como UTC y corre el día en Chile. */
  fechaLarga(iso: string): string {
    const [a, m, d] = iso.split('-');
    return `${d}-${m}-${a}`;
  }

  /** 'YYYY-MM-DD' → 'dd-MM' (etiquetas de eje). */
  fechaCorta(iso: string): string {
    const [, m, d] = iso.split('-');
    return `${d}-${m}`;
  }

  // ── Totales / estados vacíos ─────────────────────────────────────────
  totalNiveles = computed(() =>
    (this.datos()?.atrasados_por_nivel ?? []).reduce((s, n) => s + n.total, 0)
  );

  totalComposicion = computed(() => {
    const c = this.datos()?.composicion;
    return c ? c.no_leidos + c.pendientes + c.resueltos : 0;
  });

  totalCumplimiento = computed(() => {
    const c = this.datos()?.cumplimiento;
    return c ? c.a_tiempo + c.atrasados : 0;
  });

  porcentajeATiempo = computed(() => {
    const c = this.datos()?.cumplimiento;
    const total = this.totalCumplimiento();
    if (!c || total === 0) return 0;
    return Math.round((c.a_tiempo / total) * 100);
  });

  sinDatos = computed(() => {
    const d = this.datos();
    if (!d) return false;
    return (
      d.kpis.sin_revisar === 0 &&
      d.kpis.recibidos_periodo === 0 &&
      d.kpis.resueltos_periodo === 0 &&
      d.kpis.recordatorios_vigentes === 0 &&
      this.totalCumplimiento() === 0
    );
  });

  altoTribunales = computed(() =>
    Math.max(200, (this.datos()?.por_tribunal.length ?? 0) * 30 + 50)
  );

  altoJurisdicciones = computed(() =>
    Math.max(200, (this.datos()?.por_jurisdiccion.length ?? 0) * 30 + 50)
  );

  // ── Opciones de los gráficos ─────────────────────────────────────────
  private tooltipBase(trigger: 'axis' | 'item') {
    return {
      trigger,
      backgroundColor: '#ffffff',
      borderColor: COLOR.eje,
      borderWidth: 1,
      textStyle: { color: COLOR.texto, fontSize: 12, fontFamily: FUENTE },
      axisPointer: { type: 'line', lineStyle: { color: COLOR.eje, width: 1 } },
    };
  }

  /** Etiqueta de valor sobre/junto a la marca. Los rankings tienen pocas
   * barras, así que el número directo evita depender del hover. */
  private etiquetaValor(posicion: 'top' | 'right') {
    return {
      show: true,
      position: posicion,
      color: COLOR.texto,
      fontSize: 11,
      fontFamily: FUENTE,
      formatter: (p: { value: number }) => this.miles(p.value),
    };
  }

  opcionesEvolucion = computed<EChartsCoreOption>(() => {
    const puntos = this.datos()?.evolucion_diaria ?? [];
    return {
      color: [COLOR.primario, COLOR.exito],
      tooltip: this.tooltipBase('axis'),
      legend: {
        data: ['Recibidos', 'Resueltos'],
        bottom: 0,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: COLOR.texto, fontSize: 12, fontFamily: FUENTE },
      },
      grid: { left: 8, right: 16, top: 16, bottom: 34, containLabel: true },
      xAxis: {
        type: 'category',
        data: puntos.map((p) => this.fechaCorta(p.dia)),
        boundaryGap: false,
        ...EJE_BASE,
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        ...EJE_BASE,
        axisLine: { show: false },
        splitLine: SPLIT_LINE,
      },
      series: [
        {
          name: 'Recibidos',
          type: 'line',
          data: puntos.map((p) => p.recibidos),
          smooth: false,
          showSymbol: false,
          symbolSize: 8,
          lineStyle: { width: 2, cap: 'round', join: 'round' },
          areaStyle: { opacity: 0.1 },
        },
        {
          name: 'Resueltos',
          type: 'line',
          data: puntos.map((p) => p.resueltos),
          smooth: false,
          showSymbol: false,
          symbolSize: 8,
          lineStyle: { width: 2, cap: 'round', join: 'round' },
        },
      ],
    };
  });

  opcionesNiveles = computed<EChartsCoreOption>(() => {
    const niveles = this.datos()?.atrasados_por_nivel ?? [];
    const colores: Record<string, string> = {
      bajo: COLOR.nivelBajo,
      medio: COLOR.nivelMedio,
      alto: COLOR.nivelAlto,
    };
    return {
      tooltip: this.tooltipBase('item'),
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: niveles.map((n) => this.capitalizar(n.nivel)),
        ...EJE_BASE,
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        ...EJE_BASE,
        axisLine: { show: false },
        splitLine: SPLIT_LINE,
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 24,
          label: this.etiquetaValor('top'),
          data: niveles.map((n) => ({
            value: n.total,
            itemStyle: {
              color: colores[n.nivel] ?? COLOR.nivelMedio,
              borderRadius: [4, 4, 0, 0],
            },
          })),
        },
      ],
    };
  });

  opcionesComposicion = computed<EChartsCoreOption>(() => {
    const c = this.datos()?.composicion;
    return {
      tooltip: this.tooltipBase('item'),
      legend: {
        bottom: 0,
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: COLOR.texto, fontSize: 12, fontFamily: FUENTE },
      },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          // 2px del color de la superficie separan los segmentos: es el hueco
          // el que separa, no un borde dibujado.
          itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
          label: {
            show: true,
            color: COLOR.texto,
            fontSize: 11,
            fontFamily: FUENTE,
            formatter: (p: { name: string; value: number }) =>
              `${p.name}\n${this.miles(p.value)}`,
          },
          labelLine: { lineStyle: { color: COLOR.eje } },
          data: [
            { name: 'No leídos', value: c?.no_leidos ?? 0, itemStyle: { color: COLOR.primario } },
            { name: 'Pendientes', value: c?.pendientes ?? 0, itemStyle: { color: COLOR.ambar } },
            { name: 'Resueltos', value: c?.resueltos ?? 0, itemStyle: { color: COLOR.exito } },
          ].filter((s) => s.value > 0),
        },
      ],
    };
  });

  opcionesTribunales = computed<EChartsCoreOption>(() => {
    // ECharts dibuja el eje de categorías de abajo hacia arriba: se invierte
    // para que el tribunal con más carga quede arriba.
    const filas = [...(this.datos()?.por_tribunal ?? [])].reverse();
    return {
      tooltip: this.tooltipBase('item'),
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        ...EJE_BASE,
        axisLine: { show: false },
        splitLine: SPLIT_LINE,
      },
      yAxis: {
        type: 'category',
        data: filas.map((f) => f.etiqueta),
        ...EJE_BASE,
        axisLabel: {
          ...EJE_BASE.axisLabel,
          width: 180,
          overflow: 'truncate',
        },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 18,
          // Serie única: un solo color para todas las barras. Colorear cada
          // barra distinto duplicaría el largo como matiz sin aportar nada.
          itemStyle: { color: COLOR.primario, borderRadius: [0, 4, 4, 0] },
          label: this.etiquetaValor('right'),
          data: filas.map((f) => f.total),
        },
      ],
    };
  });

  opcionesJurisdicciones = computed<EChartsCoreOption>(() => {
    const filas = [...(this.datos()?.por_jurisdiccion ?? [])].reverse();
    return {
      tooltip: this.tooltipBase('item'),
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        ...EJE_BASE,
        axisLine: { show: false },
        splitLine: SPLIT_LINE,
      },
      yAxis: {
        type: 'category',
        data: filas.map((f) => f.etiqueta),
        ...EJE_BASE,
        axisLabel: { ...EJE_BASE.axisLabel, width: 140, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 18,
          itemStyle: { color: COLOR.primario, borderRadius: [0, 4, 4, 0] },
          label: this.etiquetaValor('right'),
          data: filas.map((f) => f.total),
        },
      ],
    };
  });

  opcionesResolucion = computed<EChartsCoreOption>(() => {
    const puntos = this.datos()?.evolucion_resolucion ?? [];
    return {
      // Serie única: sin leyenda, el título de la tarjeta ya dice qué es.
      tooltip: {
        ...this.tooltipBase('axis'),
        valueFormatter: (v: number) => `${v} días`,
      },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: puntos.map((p) => this.fechaCorta(p.dia)),
        boundaryGap: false,
        ...EJE_BASE,
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        ...EJE_BASE,
        axisLine: { show: false },
        splitLine: SPLIT_LINE,
      },
      series: [
        {
          name: 'Días promedio',
          type: 'line',
          // `connectNulls: false` a propósito: un día sin resoluciones no es
          // "se resolvió en 0 días", es un día sin dato. La línea se corta.
          connectNulls: false,
          data: puntos.map((p) => p.dias_promedio),
          showSymbol: true,
          symbolSize: 8,
          itemStyle: { color: COLOR.primario, borderColor: '#ffffff', borderWidth: 2 },
          lineStyle: { width: 2, color: COLOR.primario, cap: 'round', join: 'round' },
        },
      ],
    };
  });

  opcionesCumplimiento = computed<EChartsCoreOption>(() => {
    const c = this.datos()?.cumplimiento;
    return {
      tooltip: this.tooltipBase('item'),
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: ['A tiempo', 'Atrasados'], ...EJE_BASE },
      yAxis: {
        type: 'value',
        minInterval: 1,
        ...EJE_BASE,
        axisLine: { show: false },
        splitLine: SPLIT_LINE,
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 40,
          label: this.etiquetaValor('top'),
          data: [
            {
              value: c?.a_tiempo ?? 0,
              itemStyle: { color: COLOR.exito, borderRadius: [4, 4, 0, 0] },
            },
            {
              value: c?.atrasados ?? 0,
              itemStyle: { color: COLOR.peligro, borderRadius: [4, 4, 0, 0] },
            },
          ],
        },
      ],
    };
  });

  private capitalizar(texto: string): string {
    return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
  }
}
