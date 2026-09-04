import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Causa } from '@core/models/causa.model';
import { PjudBotonVariante, pjudBotonEstado, pjudBotonTitulo } from '@core/utils/pjud-estado';

/**
 * Botón "Detalle PJUD": abre el modal de `PjudMovimientosModalComponent`
 * (quien lo use debe ponerlo y escuchar `(abrir)`). El icono cuenta el último
 * estado conocido de sincronización sin tener que abrir el modal:
 *
 * - `listo`: el icono normal (el botón de siempre).
 * - nunca sincronizada / sin clave del OJV: el icono de "sincronizar", amarillo y quieto.
 * - sincronizando: el mismo icono, verde y girando.
 * - error: el mismo icono, rojo y tachado.
 *
 * No pinta nada si `causa` es null o no es Civil (lo único que expone la API
 * del PJUD). Se usa tanto en Mis Causas (que ya tiene la `Causa` completa)
 * como en pantallas que la resuelven por rol/tribunal (Estado Diario,
 * Movimientos): mismo botón, mismos íconos, en un solo lugar.
 */
@Component({
  selector: 'app-pjud-boton',
  standalone: true,
  template: `
    @if (causa && causa.materia === 'Civil') {
      <button type="button" class="btn-outline btn-sm !px-2" (click)="abrir.emit()"
              [class.text-warning-500]="variante() === 'nuevo'"
              [class.text-accent-600]="variante() === 'sincronizando'"
              [class.text-danger-600]="variante() === 'error'"
              [title]="titulo()" aria-label="Ver detalle de la causa en el Poder Judicial">
        @if (variante() === 'listo') {
          <!-- Estado normal: el botón de siempre. -->
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10.5 3H5.6c-.6 0-1.1.5-1.1 1.1v15.8c0 .6.5 1.1 1.1 1.1h12.8c.6 0 1.1-.5 1.1-1.1V11.3A8.3 8.3 0 0 0 10.5 3Z" />
            <path d="M13.5 20.3 15 21.8m-4.5-4.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z" />
          </svg>
        } @else {
          <!-- Nunca sincronizada (amarillo, quieta), sincronizando (verde,
               girando) o con error (rojo, tachada): mismo icono de
               "sincronizar", el color/animación/tache cuentan el estado. -->
          <svg class="h-4 w-4" [class.animate-spin]="variante() === 'sincronizando'"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            @if (variante() === 'error') {
              <line x1="4" y1="4" x2="20" y2="20" />
            }
          </svg>
        }
      </button>
    }
  `,
})
export class PjudBotonComponent {
  @Input() causa: Causa | null = null;
  @Output() abrir = new EventEmitter<void>();

  variante(): PjudBotonVariante {
    return pjudBotonEstado(this.causa?.pjud_estado);
  }

  titulo(): string {
    return pjudBotonTitulo(this.variante());
  }
}
