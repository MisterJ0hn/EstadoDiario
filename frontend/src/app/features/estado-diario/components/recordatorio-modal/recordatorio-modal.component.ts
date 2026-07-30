import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import { NivelRecordatorio } from '@core/models/estado-diario.model';

/**
 * Modal "Crear Recordatorio", compartido entre el detalle de un movimiento
 * y el listado (acción "Agendar" del menú). El padre controla la apertura
 * pasando el id del movimiento; null = cerrado.
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
            <h3 class="text-lg font-semibold">Crear Recordatorio</h3>
            <button (click)="cerrar()" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>
          <div class="modal-body space-y-4">
            <div>
              <label class="form-label">Nivel de urgencia</label>
              <select class="form-select" [(ngModel)]="nivel">
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

            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" [(ngModel)]="notificarWhatsapp" />
              <span class="text-sm text-neutral-700">Notificar por WhatsApp</span>
            </label>

            @if (notificarWhatsapp) {
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="form-label">Teléfono</label>
                  <input type="text" class="form-input" [(ngModel)]="telefono" placeholder="+56912345678" />
                </div>
                <div>
                  <label class="form-label">Fecha y hora de envío</label>
                  <input type="datetime-local" class="form-input" [(ngModel)]="fechaHoraWhatsapp" />
                </div>
              </div>
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
  fechaHoraWhatsapp = '';

  private resetForm(): void {
    this.nivel = 'medio';
    this.detalle = '';
    this.fecha = '';
    this.notificarWhatsapp = false;
    this.telefono = this.auth.user()?.telefono ?? '';
    this.fechaHoraWhatsapp = '';
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
    if (this.notificarWhatsapp && (!this.telefono.trim() || !this.fechaHoraWhatsapp)) {
      this.notification.warning('Para notificar por WhatsApp indique teléfono y fecha/hora de envío');
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
      fecha_hora_whatsapp: this.notificarWhatsapp
        ? this.fechaHoraWhatsapp.replace('T', ' ') + ':00'
        : undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.notification.success('Recordatorio creado');
        this.guardado.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.notification.error(err.error?.detail || 'Error al crear el recordatorio');
      },
    });
  }
}
