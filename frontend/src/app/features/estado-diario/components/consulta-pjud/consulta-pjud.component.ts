import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '@core/services/notification.service';
import { Movimiento } from '@core/models/estado-diario.model';
import { CampoConsulta, URL_OJV, camposConsulta, desglosarRol } from '@core/utils/consulta-pjud';

/**
 * Botón para abrir la Oficina Judicial Virtual más los datos de la causa
 * listos para copiar en su formulario de búsqueda.
 *
 * Va en la ficha del movimiento y en el modal de la lupa del listado, de ahí
 * que sea un componente aparte. El porqué de "abrir en ventana" en vez de
 * embeber está explicado en @core/utils/consulta-pjud.
 */
@Component({
  selector: 'app-consulta-pjud',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <p class="text-sm text-neutral-500 max-w-xl">
          La Oficina Judicial Virtual no permite mostrarse dentro de otro sitio, así que se abre
          en una ventana aparte. Copie estos datos en su formulario de búsqueda.
        </p>
        <button (click)="abrirOjv()" class="btn-primary whitespace-nowrap inline-flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Abrir Oficina Judicial Virtual
        </button>
      </div>

      @if (campos().length > 0) {
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          @for (campo of campos(); track campo.etiqueta) {
            <div class="flex items-center justify-between gap-2 rounded border border-neutral-200 px-3 py-2">
              <div class="min-w-0">
                <dt class="text-xs text-neutral-500 uppercase">{{ campo.etiqueta }}</dt>
                <dd class="font-medium mt-0.5 truncate" [title]="campo.valor">{{ campo.valor }}</dd>
              </div>
              <button (click)="copiar(campo)" class="btn-outline btn-sm shrink-0"
                      [attr.aria-label]="'Copiar ' + campo.etiqueta">
                {{ copiado() === campo.etiqueta ? 'Copiado' : 'Copiar' }}
              </button>
            </div>
          }
        </dl>
        @if (!rolDesglosado() && movimiento().rol) {
          <p class="text-xs text-neutral-400">
            El rol «{{ movimiento().rol }}» no tiene el formato tipo-número-año, así que no se pudo
            separar en tipo de libro, rol y año.
          </p>
        }
      } @else {
        <p class="text-neutral-400 text-sm">
          Este movimiento no trae datos suficientes para armar la búsqueda.
        </p>
      }
    </div>
  `,
})
export class ConsultaPjudComponent {
  private notification = inject(NotificationService);

  movimiento = input.required<Movimiento>();

  /** Etiqueta del último campo copiado, para el feedback del botón */
  copiado = signal<string | null>(null);
  private copiadoTimer?: ReturnType<typeof setTimeout>;

  campos = computed(() => camposConsulta(this.movimiento()));

  /** true si el rol pudo separarse en tipo de libro / número / año */
  rolDesglosado = computed(() => {
    const m = this.movimiento();
    return desglosarRol(m.rol, m.fecha_ingreso).numero !== null;
  });

  abrirOjv(): void {
    // Ventana aparte (no iframe): el PJUD manda frame-ancestors *.pjud.cl y el
    // navegador bloquea cualquier intento de embeberlo.
    const alto = Math.min(900, Math.round(window.screen.availHeight * 0.9));
    const ancho = Math.min(1280, Math.round(window.screen.availWidth * 0.9));
    const ventana = window.open(
      URL_OJV,
      'ojv_pjud',
      `width=${ancho},height=${alto},resizable=yes,scrollbars=yes`,
    );
    if (ventana) {
      ventana.focus();
    } else {
      this.notification.error('El navegador bloqueó la ventana emergente; permítala para este sitio');
    }
  }

  async copiar(campo: CampoConsulta): Promise<void> {
    const ok = await this.alPortapapeles(campo.valor);
    if (!ok) {
      this.notification.error('No se pudo copiar; seleccione el texto y use Ctrl+C');
      return;
    }
    this.copiado.set(campo.etiqueta);
    clearTimeout(this.copiadoTimer);
    this.copiadoTimer = setTimeout(() => this.copiado.set(null), 1500);
  }

  /** navigator.clipboard solo existe en contexto seguro (https o localhost);
   *  en un despliegue por http plano hay que caer al textarea + execCommand. */
  private async alPortapapeles(texto: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
        return true;
      }
    } catch {
      // Cae al método antiguo
    }

    try {
      const area = document.createElement('textarea');
      area.value = texto;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}
