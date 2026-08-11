import {
  Component,
  ElementRef,
  HostListener,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/** Un filtro aplicado, tal como se muestra en la barra de badges. */
export interface ChipFiltro {
  /** Identifica el campo para poder quitarlo solo a él. */
  clave: string;
  /** Nombre del campo: "Jurisdicción", "RUT". */
  etiqueta: string;
  /** Valor legible, ya formateado (fechas en dd-MM-yyyy, no ISO). */
  valor: string;
}

/**
 * Barra de filtros compacta: los campos viven en un panel lateral que se abre
 * desde la derecha, y lo único que queda permanentemente en pantalla son los
 * badges de lo que está aplicado.
 *
 * Sustituye a la tarjeta de filtros siempre visible que ocupaba una franja
 * completa sobre la tabla.
 *
 * Los campos se proyectan con <ng-content>, así cada listado define los suyos
 * y este componente solo se encarga de la interacción y el aspecto.
 *
 * Importante: los badges reflejan los filtros **aplicados**, no lo que el
 * usuario está escribiendo. Por eso el padre construye la lista dentro de su
 * método de aplicar, y no desde el ngModel de cada campo.
 */
@Component({
  selector: 'app-filtros-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center gap-2 flex-wrap">
      @for (c of chips(); track c.clave) {
        <span class="badge-info gap-1 pl-2.5 pr-1 py-1">
          <span class="font-normal opacity-70">{{ c.etiqueta }}:</span>
          <span class="font-semibold">{{ c.valor }}</span>
          <button
            type="button"
            (click)="quitar.emit(c.clave)"
            [attr.aria-label]="'Quitar el filtro ' + c.etiqueta"
            class="ml-0.5 rounded-full p-0.5 text-primary-700/60 hover:bg-primary-200 hover:text-primary-900
                   focus:outline-none focus:ring-2 focus:ring-primary-400 transition-colors"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72
                       3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </span>
      }

      @if (chips().length > 1) {
        <button
          type="button"
          (click)="limpiar.emit()"
          class="text-xs font-medium text-neutral-500 hover:text-danger-600 underline underline-offset-2
                 focus:outline-none focus:ring-2 focus:ring-neutral-300 rounded px-1 transition-colors"
        >
          Limpiar todo
        </button>
      }

      <!-- ml-auto empuja el botón a la derecha aunque no haya ningún badge -->
      <button type="button" (click)="abrir()" class="btn-secondary btn-sm ml-auto shrink-0">
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0
                   01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0
                   .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0
                   00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z"
                clip-rule="evenodd" />
        </svg>
        Filtrar
        @if (chips().length) {
          <span class="ml-1 rounded-full bg-primary-600 px-1.5 py-0.5 text-xs font-semibold text-white">
            {{ chips().length }}
          </span>
        }
      </button>
    </div>

    @if (abierto()) {
      <div
        class="fixed inset-0 z-40 bg-black/40 animar-fondo"
        (click)="cerrar()"
        aria-hidden="true"
      ></div>

      <aside
        #panel
        tabindex="-1"
        class="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl
               outline-none animar-panel-derecha"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="titulo()"
      >
        <header class="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 class="text-lg font-semibold text-neutral-800">{{ titulo() }}</h2>
          <button
            type="button"
            (click)="cerrar()"
            aria-label="Cerrar el panel de filtros"
            class="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600
                   focus:outline-none focus:ring-2 focus:ring-primary-400 transition-colors"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72
                       3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </header>

        <div class="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <ng-content />
        </div>

        <footer class="flex items-center justify-end gap-3 border-t border-neutral-200 px-5 py-4">
          <button type="button" (click)="onLimpiar()" class="btn-secondary">Limpiar</button>
          <button type="button" (click)="onAplicar()" class="btn-primary">Aplicar filtros</button>
        </footer>
      </aside>
    }
  `,
})
export class FiltrosPanelComponent {
  chips = input<ChipFiltro[]>([]);
  titulo = input('Filtros');

  /** Se emite al pulsar "Aplicar filtros"; el panel ya se cerró. */
  aplicar = output<void>();
  /** "Limpiar" dentro del panel y "Limpiar todo" en la barra de badges. */
  limpiar = output<void>();
  /** Clave del chip que el usuario quitó con la ✕. */
  quitar = output<string>();

  readonly abierto = signal(false);

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  /** Quién abrió el panel, para devolverle el foco al cerrar. */
  private disparador: HTMLElement | null = null;

  constructor() {
    // El panel se anuncia como diálogo modal, así que el foco tiene que entrar
    // en él: si no, el lector de pantalla dice "diálogo" y el usuario sigue
    // tabulando por la tabla que quedó detrás.
    effect(() => {
      this.panel()?.nativeElement.focus();
    });
  }

  abrir(): void {
    this.disparador = document.activeElement as HTMLElement | null;
    this.abierto.set(true);
  }

  cerrar(): void {
    if (!this.abierto()) {
      return;
    }
    this.abierto.set(false);
    // Volver al botón que lo abrió; si no, el foco cae al <body> y quien
    // navega con teclado tiene que recorrer la página entera de nuevo.
    this.disparador?.focus();
    this.disparador = null;
  }

  onAplicar(): void {
    // Cerrar primero: el usuario pidió que al filtrar el panel desaparezca y
    // quede a la vista el resultado con sus badges.
    this.cerrar();
    this.aplicar.emit();
  }

  onLimpiar(): void {
    this.cerrar();
    this.limpiar.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.abierto()) {
      this.cerrar();
    }
  }
}
