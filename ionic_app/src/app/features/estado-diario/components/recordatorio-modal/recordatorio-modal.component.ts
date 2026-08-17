import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import { NivelRecordatorio } from '@core/models/estado-diario.model';

/** Hora sugerida del WhatsApp: media mañana, dentro del horario de tribunales.
 *  Se propone para que el campo no arranque vacío y haya que llenarlo siempre. */
const HORA_WHATSAPP_POR_DEFECTO = '09:00';

/**
 * Modal "Marcar como pendiente", compartido entre el detalle de un registro
 * y el listado (acción "Pendiente" del menú). Marcar pendiente y agendar son
 * una sola acción: aquí se elige el nivel de urgencia, que queda guardado tanto
 * en el registro como en el recordatorio. El padre controla la apertura pasando
 * el id del registro; null = cerrado.
 */
@Component({
  selector: 'app-recordatorio-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (movimientoId !== null) {
      <div class="modal-backdrop" (click)="cerrar()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">Marcar como pendiente</h3>
            <button (click)="cerrar()" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>
          <div class="modal-body space-y-4">
            <p class="text-sm text-neutral-500">
              El registro queda pendiente con el nivel de urgencia indicado y se agenda el recordatorio.
            </p>
            <div>
              <label class="form-label">Nivel de urgencia</label>
              <select class="form-select" [(ngModel)]="nivel" (ngModelChange)="onNivelChange()">
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
              </select>
            </div>
            <div>
              <label class="form-label">Detalle</label>
              <textarea class="form-input" rows="3" [(ngModel)]="detalle" placeholder="Descripción del recordatorio..."></textarea>
            </div>
            <div>
              <label class="form-label">Fecha del recordatorio</label>
              <input type="date" class="form-input" [(ngModel)]="fecha" />
              <p class="text-xs text-neutral-400 mt-1">
                Se agrega como evento de todo el día en tu Google Calendar (si está conectado).
              </p>
            </div>

            <hr class="border-neutral-200" />

            <!-- El WhatsApp es solo para los pendientes de nivel alto: tiene
                 costo por mensaje y, sobre todo, si llega para todo deja de
                 significar algo. En los otros niveles se dice la regla en vez
                 de esconder la opción sin más, para que no se lea como que
                 falta algo en la pantalla. -->
            @if (nivel === 'alto') {
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" [(ngModel)]="notificarWhatsapp" />
                <span class="text-sm text-neutral-700">Notificar por WhatsApp</span>
              </label>

              @if (notificarWhatsapp) {
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="form-label" for="wa-telefono">Teléfono</label>
                    <input id="wa-telefono" type="text" class="form-input" [(ngModel)]="telefono"
                           placeholder="+56912345678" />
                  </div>
                  <div>
                    <!-- Solo la hora: el WhatsApp se envía el mismo día del
                         recordatorio, así que la fecha se toma de ahí y no se
                         vuelve a pedir. -->
                    <label class="form-label" for="wa-hora">Hora de envío</label>
                    <input id="wa-hora" type="time" class="form-input" [(ngModel)]="horaWhatsapp" />
                    <p class="text-xs text-neutral-400 mt-1">
                      Se enviará el {{ fechaLegible() }}.
                    </p>
                  </div>
                </div>
              }
            } @else {
              <p class="text-sm text-neutral-500">
                El aviso por WhatsApp está disponible solo en los pendientes de
                nivel <strong>alto</strong>.
              </p>
            }
          </div>
          <div class="modal-footer">
            <button (click)="cerrar()" class="btn-secondary">Cancelar</button>
            <button (click)="guardar()" class="btn-primary" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class RecordatorioModalComponent {
  private service = inject(EstadoDiarioService);
  private notification = inject(NotificationService);
  private auth = inject(AuthService);

  private _movimientoId: number | null = null;

  @Input()
  set movimientoId(id: number | null) {
    this._movimientoId = id;
    if (id !== null) this.resetForm();
  }
  get movimientoId(): number | null {
    return this._movimientoId;
  }

  /** Emitido al cancelar o cerrar el modal (con o sin éxito). */
  @Output() cerrado = new EventEmitter<void>();
  /** Emitido solo cuando el recordatorio se creó correctamente. */
  @Output() guardado = new EventEmitter<void>();

  saving = signal(false);

  nivel: NivelRecordatorio = 'medio';
  detalle = '';
  fecha = '';
  notificarWhatsapp = false;
  telefono = '';
  /** Solo la hora (HH:mm). La fecha de envío es siempre la del recordatorio. */
  horaWhatsapp = HORA_WHATSAPP_POR_DEFECTO;

  private resetForm(): void {
    this.nivel = 'medio';
    this.detalle = '';
    this.fecha = '';
    this.notificarWhatsapp = false;
    this.telefono = this.auth.user()?.telefono ?? '';
    this.horaWhatsapp = HORA_WHATSAPP_POR_DEFECTO;
  }

  /**
   * Bajar de nivel apaga el WhatsApp, no solo lo esconde.
   *
   * Sin esto queda un agujero silencioso: se elige *alto*, se marca la casilla,
   * se escribe un teléfono, se baja a *medio* — el bloque desaparece de la
   * pantalla pero `notificarWhatsapp` sigue en true, y `guardar()` manda igual
   * el aviso con un dato que el usuario ya no ve. El backend ahora lo rechaza,
   * pero el usuario merecía no llegar a ese error.
   */
  onNivelChange(): void {
    if (this.nivel !== 'alto') this.notificarWhatsapp = false;
  }

  /** Fecha del recordatorio en formato chileno, para el texto de ayuda. */
  fechaLegible(): string {
    if (!this.fecha) return 'el día del recordatorio';
    const [anio, mes, dia] = this.fecha.split('-');
    return dia && mes && anio ? `${dia}-${mes}-${anio}` : this.fecha;
  }

  cerrar(): void {
    if (this.saving()) return;
    this.cerrado.emit();
  }

  guardar(): void {
    if (!this.detalle.trim() || !this.fecha) {
      this.notification.warning('Complete el detalle y la fecha del recordatorio');
      return;
    }
    if (this.notificarWhatsapp && (!this.telefono.trim() || !this.horaWhatsapp)) {
      this.notification.warning('Para notificar por WhatsApp indique teléfono y hora de envío');
      return;
    }

    const id = this.movimientoId;
    if (id === null) return;
    const user = this.auth.user();
    this.saving.set(true);

    this.service.marcarPendiente(id, {
      nivel: this.nivel,
      username: user?.username,
      mensaje: this.detalle,
      fecha_hora: `${this.fecha} 00:00:00`,
      notificar_whatsapp: this.notificarWhatsapp,
      whatsapp_telefono: this.notificarWhatsapp ? this.telefono.trim() : undefined,
      // El backend sigue esperando fecha y hora completas; se arma juntando la
      // fecha del recordatorio con la hora que eligió el usuario.
      fecha_hora_whatsapp: this.notificarWhatsapp
        ? `${this.fecha} ${this.horaWhatsapp}:00`
        : undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.notification.success('Marcado como pendiente');
        this.guardado.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.notification.error(err.error?.detail || 'Error al marcar como pendiente');
      },
    });
  }
}
