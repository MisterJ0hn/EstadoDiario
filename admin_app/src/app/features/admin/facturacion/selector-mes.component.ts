import { Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { mesCorto, nombreMes, periodoDe } from './periodo';

/**
 * Selector de período: primero el año, después el mes.
 *
 * **Por qué no un `<select>` con los últimos 12 meses.** Ese desplegable solo
 * llegaba un año atrás y obligaba a leer una lista de doce textos para ubicar
 * un mes. Acá el año se cambia con las flechas y los doce meses están a la
 * vista en una grilla, que es como se busca un mes: primero el año, después el
 * mes. De paso se puede consultar cualquier año, no solo el último.
 *
 * **Los meses futuros están apagados.** La factura de un mes se emite el día 1
 * del mes siguiente, así que un mes que todavía no termina no puede tener
 * facturas. Dejarlos elegibles solo produciría búsquedas vacías que parecen un
 * error del sistema.
 *
 * Elegir un mes **emite de inmediato**: no hay que confirmar. Es la diferencia
 * con los demás campos del panel de filtros, y es deliberada — el clic sobre un
 * mes concreto ya es la decisión completa, no hay nada más que escribir.
 */
@Component({
  selector: 'app-selector-mes',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-lg border border-neutral-200 bg-white p-3">
      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          (click)="cambiarAnio(-1)"
          [disabled]="anio() <= anioMinimo"
          class="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800
                 disabled:opacity-30 disabled:hover:bg-transparent
                 focus:outline-none focus:ring-2 focus:ring-primary-400 transition-colors"
          aria-label="Año anterior"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L9.06 10l3.71 3.71a.75.75 0
                     11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06.02z"
                  clip-rule="evenodd" />
          </svg>
        </button>

        <span class="text-base font-semibold text-neutral-800 tabular-nums" aria-live="polite">
          {{ anio() }}
        </span>

        <button
          type="button"
          (click)="cambiarAnio(1)"
          [disabled]="anio() >= anioMaximo"
          class="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800
                 disabled:opacity-30 disabled:hover:bg-transparent
                 focus:outline-none focus:ring-2 focus:ring-primary-400 transition-colors"
          aria-label="Año siguiente"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L10.94 10 7.23 6.29a.75.75 0
                     111.06-1.06l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-.02z"
                  clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <div class="mt-3 grid grid-cols-4 gap-1.5" role="group" aria-label="Mes del período">
        @for (m of meses; track m) {
          <button
            type="button"
            (click)="elegir(m)"
            [disabled]="esFuturo(m)"
            [attr.aria-pressed]="periodoDe(anio(), m) === valor()"
            [attr.aria-label]="nombreMes(periodoDe(anio(), m))"
            [title]="esFuturo(m) ? 'Todavía no termina: no puede tener facturas' : ''"
            [class]="clase(m)"
          >
            {{ mesCorto(m) }}
          </button>
        }
      </div>

      <button
        type="button"
        (click)="elegir(null)"
        [attr.aria-pressed]="!valor()"
        [class]="claseTodos()"
      >
        Los últimos 12 meses
      </button>
    </div>
  `,
})
export class SelectorMesComponent {
  /** Período aplicado, `AAAA-MM-01`. Vacío = sin acotar a un mes. */
  valor = input<string>('');
  /** El período elegido, ya en ISO. Cadena vacía si se pidieron los 12 meses. */
  cambio = output<string>();

  readonly meses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  mesCorto = mesCorto;
  nombreMes = nombreMes;
  periodoDe = periodoDe;

  private readonly hoy = new Date();
  readonly anioMaximo = this.hoy.getFullYear();
  /**
   * Diez años atrás. No hay un mínimo real en los datos, pero una flecha sin
   * tope invita a recorrer años en los que el sistema no existía.
   */
  readonly anioMinimo = this.anioMaximo - 10;

  /** El año que se está mirando, que no es necesariamente el elegido. */
  readonly anio = signal(this.hoy.getFullYear());

  constructor() {
    // El año mostrado sigue al valor que llega de afuera: si el filtro se
    // cambia desde otro lado (un badge que se quita, "ver el mes anterior"),
    // al abrir el panel tiene que verse el año de ese mes y no el de hoy.
    effect(() => {
      const v = this.valor();
      this.anio.set(v ? Number(v.split('-')[0]) : this.hoy.getFullYear());
    });
  }

  /** El mes elegido dentro del año que se mira; 0 si el elegido es de otro año. */
  private readonly mesElegido = computed(() => {
    const v = this.valor();
    if (!v) return 0;
    const [a, m] = v.split('-').map(Number);
    return a === this.anio() ? m : 0;
  });

  cambiarAnio(paso: number): void {
    this.anio.set(this.anio() + paso);
  }

  elegir(mes: number | null): void {
    this.cambio.emit(mes === null ? '' : periodoDe(this.anio(), mes));
  }

  esFuturo(mes: number): boolean {
    return (
      this.anio() > this.hoy.getFullYear() ||
      (this.anio() === this.hoy.getFullYear() && mes > this.hoy.getMonth() + 1)
    );
  }

  clase(mes: number): string {
    const base =
      'rounded-lg px-2 py-2 text-sm font-medium capitalize transition-colors ' +
      'focus:outline-none focus:ring-2 focus:ring-primary-400 ' +
      'disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent';
    return this.mesElegido() === mes
      ? `${base} bg-primary-600 text-white hover:bg-primary-700`
      : `${base} text-neutral-700 hover:bg-neutral-100`;
  }

  claseTodos(): string {
    const base =
      'mt-2 w-full rounded-lg px-2 py-2 text-sm font-medium transition-colors ' +
      'focus:outline-none focus:ring-2 focus:ring-primary-400';
    return this.valor()
      ? `${base} text-neutral-600 hover:bg-neutral-100`
      : `${base} bg-primary-50 text-primary-800 ring-1 ring-inset ring-primary-200`;
  }
}
