import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Causa } from '@core/models/causa.model';
import { PjudBotonVariante, pjudBotonEstado, pjudBotonTitulo } from '@core/utils/pjud-estado';

/**
 * `martillo_2.png` (carpeta `datos/` del repo): el ícono del estado `listo`.
 * Va inline en base64 —no como asset servido por ruta— porque este mismo
 * componente lo comparten dos apps Angular con configuraciones de `assets`
 * distintas (`frontend` e `ionic_app`); así queda autocontenido en el .ts y
 * no hay que mantener el archivo copiado y declarado en ambas.
 */
const MARTILLO_PJUD_PNG =
  'data:image/png;base64,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';

/**
 * Botón "Detalle PJUD": abre el modal de `PjudMovimientosModalComponent`
 * (quien lo use debe ponerlo y escuchar `(abrir)`). El icono cuenta el último
 * estado conocido de sincronización sin tener que abrir el modal:
 *
 * - `listo`: el martillo del Poder Judicial (`martillo_2.png`, el icono normal).
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
          <!-- Estado normal: el martillo del Poder Judicial (martillo_2.png). -->
          <img [src]="martillo" class="h-4 w-4" alt="" aria-hidden="true" />
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

  readonly martillo = MARTILLO_PJUD_PNG;

  variante(): PjudBotonVariante {
    return pjudBotonEstado(this.causa?.pjud_estado);
  }

  titulo(): string {
    return pjudBotonTitulo(this.variante());
  }
}
