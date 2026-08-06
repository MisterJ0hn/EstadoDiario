import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Registro único de los módulos que usa el dashboard. Se importa desde
// `echarts/core` (no desde `echarts`) para que el bundle no arrastre mapas,
// gráficos 3D ni el resto del catálogo que acá no se usa.
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

@Component({
  selector: 'app-grafico',
  standalone: true,
  template: `<div #host class="w-full" [style.height.px]="alto()"></div>`,
})
export class GraficoComponent implements AfterViewInit, OnDestroy {
  /** Opciones ECharts. Cada cambio del signal repinta el gráfico. */
  opciones = input.required<echarts.EChartsCoreOption>();
  alto = input(280);

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  /** La instancia vive en un signal para que el `effect` de abajo reaccione
   * tanto a que llegue la instancia como a que cambien los datos. */
  private readonly chart = signal<echarts.ECharts | null>(null);
  private observer?: ResizeObserver;

  constructor() {
    effect(() => {
      const instancia = this.chart();
      const opciones = this.opciones();
      if (!instancia) return;
      // `true` = no fusionar con la opción anterior: al cambiar el período las
      // series viejas más largas quedarían pegadas al final del eje.
      instancia.setOption(opciones, true);
    });
  }

  ngAfterViewInit(): void {
    const el = this.host().nativeElement;
    const instancia = echarts.init(el, undefined, { renderer: 'canvas' });
    this.chart.set(instancia);

    // ResizeObserver y no `window.resize`: el ancho también cambia al contraer
    // el menú lateral, que no dispara ningún evento de ventana.
    this.observer = new ResizeObserver(() => instancia.resize());
    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    // Sin esto queda una fuga: ECharts retiene el canvas y sus listeners al
    // navegar fuera del dashboard.
    this.observer?.disconnect();
    this.observer = undefined;
    this.chart()?.dispose();
    this.chart.set(null);
  }
}
