import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject, signal } from '@angular/core';

import { Causa, PjudMovimientosResponse } from '@core/models/causa.model';
import { PjudBotonVariante, pjudBotonEstado, pjudBotonTitulo } from '@core/utils/pjud-estado';
import { CausaService } from '../../services/causa.service';

/** Cada cuánto se pregunta si una sincronización en curso ya terminó. */
const INTERVALO_POLL_MS = 5000;

/**
 * `martillo_2.png` (carpeta `datos/` del repo): el ícono del estado `listo`.
 * Va inline en base64 —no como asset servido por ruta— porque este mismo
 * componente lo comparten dos apps Angular con configuraciones de `assets`
 * distintas (`frontend` e `ionic_app`); así queda autocontenido en el .ts y
 * no hay que mantener el archivo copiado y declarado en ambas.
 */
const MARTILLO_PJUD_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAcmSURBVFhHxZcLTJbXGcc/BBRB5CYiCMj9ruBArh9UgUjkKiB+gtwcV9GiaKFqKSgY0rVWm60QWxu3pTGSAVWcrNpl1jmdqXWaWuOSOTVuKl6wMhHqEP3tnNeXGhT0o1uyf/LkvN/3nvOc/znnef7PeTX8n/FfEdi1axenTp1Sf/04/CgCg4ODVFVV8XZUKPtKCvn6q6/UN+PHuAncvXuXzMxMsv28oXEjbemJbN2yWX07foyLwNWrV4mKiiJ2lhNDb1XRtECLnZkpjZvrlXenT59We+oPvQlcvHgRf39/gu3t6FlfQVXoT5huNpm/rSoi38cXe3t7wgJs2L9/vzpCP+hF4MKFC3h5eeFtYcHXuiyKggIwnWjMX0vyuJC3HLdJ5qwrCODutxuoLgzh7Nmz6shX45UEzpw5g4uLC7OtrTmUmEiK0yw0Gg1HdemcylqCuWYiyxJn8uT8GwweT4U/vsbuLbEKaX3wSgL19fXKhOV+fiwWREwMDWmNi+PQokQmaYxIirbg3yeXMfDFa9zdN5f+zyPgT9E0rAzlyJEjqpex8UoC3d3dxIkJJQlp6Z6e7ImNxVBjSFyoBX2HI/n+cATfHQjl3m/DRRtO/6FIho5qyUtypaOjQ/U0OvSKAZl6q1evprW1ldycHIVI3DwLersiGPx9lCAQqbQPv4hUSPCllqvt8wgNMKOlpUX1Mjr0IjCM27dvY2tri6+rKffFpE/ERP2i/cP7Aeyt9eLEh4HKyr/5ZRAejib4WNrws61bOXHiBOfOnVO9jMS4CPT19ZEjdsDUxJCPazzhzzG01nuze+0sjr7jwe+2ePCrjW5Ms5lAWUCQCKBqkrw9iPVwZVeOjm9EQD+PcRGQ2LZtG5ZTjJhgoGFlmj2HGt25stufO61zaN3ggvFEDakOrgyUl1AXHc5su2ncqijiLyJjlqelqV6eQW8Cvb29FBcXE+w5hW/3hODvZqbEwvslM3nwWRA7X3dCY6ghceYsrucup1DohrHGgGOL0ziclESQkzMnT55UvT2D3gS2b9/ORGMDvmwO5HjLHGW757pPxsjQgPw4a0wmGZDk6MLl7GyWurkp5PYtXMieBQuwNjWls7NT9TQSehP4aV4eJsZGxM+z4kC9OzvEyhPjw0lISFAm8/DwoDIkhExXV+X3r8XEzVothgYGL82EVxIYGBhgzcqVdOVkkhvgpzif7WLClClTFMmV7/fu3cv58+cJDAxk4oQJ7IyO5p2wMKVvQ0OD6ml0vJTArVu3SBbn90lqAp1LF7MhaC7BYoULxOra2trUXk/R3t6uTLjU3Z0GsRPyuaamRn07NsYkcOnSJUKEo8bYaDqyUlnl60esmzvHjx3jyZMnaq9nuHHjBrFCIaVUy8mlcOmDUQnIQuLj48O68GDaM1Io8fbGz9pGUcKXoaenh6ysLNasWTMqydHwAgF5x5PVL3e2L58tSWGFmNzZzIwdO3aoPf63GEFAVq8ZM2ag8/XifFk+ef4+OIgbT21trdrjRcj74YMHD7hz545yK7py5QqXL19W7Nq1a9y7d08J1EePHqkjRuIHAl1dXVhZWRHv4gR1b4itT2KykdGYZynrgtzu4OBgvMUuOTo6Yi3uDFOnTlXM0tJSqRtyN+VNKkxkxWgZoRCQIiEHaR3t+X7jWj7PzsDKZBJ5IveHhoaUjsN4/Pix0h48eJDVOge6mufwaZ0XH1e707jCgfVLplGVOY0anS31uTN4r9iBjyqd6Kh1JUnrzP3795Xxw340Uh5lToc52NG3oZJOEfFy5enp6crWDUNuYXl5OdEix9OEpsuVJ0ZZU5XtyFu5zrxX5sYHpS7srnCjbb0XO8tc2bp8JtUZM1iVZEt54jQCRBWNj49n0aJFaIVISf3Q6HQ6PKws6a1ZTbsIOikkycnJPzAdRn9/P87OzqwVl9G2Jal0ZCTzm5RkOpLTOJiWwZEsHQcSUmiLTuBgbCJtMQl8GhXPJ+GxtMyL4YNgLR9GaIU6RvFRTAyRdnZUVlaiKS0txVlsf3nwUxVbKPRbFp7nIQl5ittQpyDJ2+t4XFXG0LpyhqpX8ejN1xkUC/hXZRn/LMrnH0UFXCsu5Iaw7pIV3CpdQXdRIRfFYv+uW0ZPQQHZQrplumpk1EZERCjHIINK3n5Gg4xmV6GCMjj5xbvQvB1+Ltp6oXZvVsLGNbBpLdRWvWjiG0KS/q68SCHRk19AlihYFRUVT4Pw4cOHSvq8DDdv3lSyJDfAl2ZdBu9mL6UpK4MtcTHURc6jNjKUTaLdFKGafBYmP9/qhDXERNCgDaNa1IvNwSHMERlTIHbiBSEaC/II5s+fj504O6kVMsVk2sl0sxDfC8PpZ25uPsLkf/K9JG9jY8P06dOVjxjpp6mpSX8CElJ0ZHzI45DCI4uVvDVfv35dMSk8z5v8X9YJ2U/2l3Itxz+NM/gPiniCByqm9GYAAAAASUVORK5CYII=';

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
 *
 * El ícono no espera a que el padre vuelva a pedir la lista:
 * - Al hacer clic en una causa `nuevo`, pasa a `sincronizando` al toque (antes
 *   de que responda nada), porque abrir el modal es lo que dispara el scrape.
 * - Mientras está `sincronizando` (por ese clic, porque ya venía así desde el
 *   padre, o porque el modal de detalle disparó un Reintentar/Actualizar y
 *   avisó por `(estadoPjud)`), se pregunta por Ajax cada 5 segundos si
 *   terminó. Al quedar `listo` o `error` se pinta de inmediato, se deja de
 *   preguntar y se avisa por `(estadoPjud)` para que quien lo use actualice
 *   lo que tenga (p.ej. la columna "Ult. Sync. Pjud") sin recargar la lista.
 */
@Component({
  selector: 'app-pjud-boton',
  standalone: true,
  template: `
    @if (causa && causa.materia === 'Civil') {
      <button type="button" class="btn-outline btn-sm !px-2" (click)="onClick()"
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
export class PjudBotonComponent implements OnChanges, OnDestroy {
  private causaService = inject(CausaService);

  @Input() causa: Causa | null = null;
  @Output() abrir = new EventEmitter<void>();
  /** Se dispara cuando este componente, por su cuenta, se entera de que una
   *  sincronización terminó (`listo`/`error`/`sin_credenciales`). Quien lo use
   *  puede refrescar con esto lo que tenga de esa causa (p.ej. la columna
   *  "Ult. Sync. Pjud") sin esperar a recargar toda la lista. */
  @Output() estadoPjud = new EventEmitter<{ causaId: number; estado: PjudMovimientosResponse['estado'] }>();

  readonly martillo = MARTILLO_PJUD_PNG;

  /** Pisa el estado de `causa` mientras este componente sincroniza por su
   *  cuenta (clic optimista o polling en curso); null = mostrar el de `causa`. */
  private estadoLocal = signal<PjudBotonVariante | null>(null);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private causaIdPolling: number | null = null;
  /** Último `pjud_estado` visto en `causa`, para distinguir un cambio real
   *  (p.ej. el modal de detalle disparó un Reintentar/Actualizar) de que el
   *  padre simplemente pasó un objeto nuevo con el mismo valor. `undefined`
   *  = todavía no se miró ninguno. */
  private ultimoPjudEstado: string | null | undefined = undefined;

  ngOnChanges(changes: SimpleChanges): void {
    if (!('causa' in changes)) return;

    const causaId = this.causa?.id ?? null;
    if (causaId !== this.causaIdPolling && this.pollTimer) {
      this.detenerPolling();
    }

    const nuevoEstado = this.causa?.pjud_estado ?? null;
    if (nuevoEstado === this.ultimoPjudEstado) return;
    this.ultimoPjudEstado = nuevoEstado;

    // El estado que trae el padre cambió de verdad: manda ese (típicamente
    // porque el modal de detalle disparó un Reintentar/Actualizar), no lo que
    // supiera este botón por su propio polling.
    this.estadoLocal.set(null);
    if (causaId != null && pjudBotonEstado(nuevoEstado) === 'sincronizando') {
      this.iniciarPolling(causaId);
    } else {
      this.detenerPolling();
    }
  }

  ngOnDestroy(): void {
    this.detenerPolling();
  }

  variante(): PjudBotonVariante {
    return this.estadoLocal() ?? pjudBotonEstado(this.causa?.pjud_estado);
  }

  titulo(): string {
    return pjudBotonTitulo(this.variante());
  }

  onClick(): void {
    // Optimista: si nunca se sincronizó, se ve "sincronizando" al toque, sin
    // esperar la respuesta — abrir el modal es lo que dispara el scrape.
    if (this.variante() === 'nuevo' && this.causa) {
      this.estadoLocal.set('sincronizando');
      this.iniciarPolling(this.causa.id);
    }
    this.abrir.emit();
  }

  private iniciarPolling(causaId: number): void {
    if (this.pollTimer && this.causaIdPolling === causaId) return;
    this.detenerPolling();
    this.causaIdPolling = causaId;
    this.pollTimer = setInterval(() => this.consultarEstado(causaId), INTERVALO_POLL_MS);
  }

  private detenerPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.causaIdPolling = null;
  }

  /** Mismo GET que usa el modal para consultar (sin `forzar`): solo pregunta
   *  el estado actual, no dispara un scrape nuevo. Cualquier resultado que no
   *  sea "sincronizando" es terminal — incluido "sin_credenciales", que si no
   *  se corta acá dejaría preguntando para siempre a quien no cargó su clave. */
  private consultarEstado(causaId: number): void {
    this.causaService.pjudMovimientos(causaId).subscribe({
      next: (res) => {
        if (res.estado === 'sincronizando') return;
        this.estadoLocal.set(pjudBotonEstado(res.estado));
        this.detenerPolling();
        this.estadoPjud.emit({ causaId, estado: res.estado });
      },
      // Error de red al consultar: no se sabe nada nuevo, se sigue intentando
      // en el próximo tick en vez de mostrar una falla que no es tal.
      error: () => {},
    });
  }
}
