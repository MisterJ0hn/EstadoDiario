import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import { Movimiento, Agenda, NivelRecordatorio } from '@core/models/estado-diario.model';

@Component({
  selector: 'app-movimiento-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      } @else if (movimiento()) {
        <!-- Header -->
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <button (click)="goBack()" class="text-primary-600 hover:text-primary-800 text-sm mb-2 inline-flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <h1 class="text-2xl font-bold text-neutral-800">Detalle del Movimiento #{{ movimiento()!.id }}</h1>
          </div>
          <div class="flex gap-2">
            @if (!movimiento()!.leido) {
              <button (click)="onMarcarLeido()" class="btn-success">Marcar como Resuelto</button>
            }
            <button (click)="abrirRecordatorioModal()" class="btn-warning">Crear Recordatorio</button>
          </div>
        </div>

        <!-- Detail Card -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card">
            <div class="card-header">
              <h3 class="text-lg font-semibold">Información General</h3>
            </div>
            <div class="card-body">
              <dl class="grid grid-cols-2 gap-4">
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Rol</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.rol || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Rol Único</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.rol_unico || '-' }}</dd>
                </div>
                <div class="col-span-2">
                  <dt class="text-xs text-neutral-500 uppercase">Caratulado</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.caratulado || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Tribunal</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.tribunal || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Jurisdicción</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.jurisdiccion || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Tipo Causa</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.tipo_causa || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Fecha Ingreso</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.fecha_ingreso || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Ubicación</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.ubicacion || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Corte</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.corte || '-' }}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="text-lg font-semibold">Estado</h3>
            </div>
            <div class="card-body space-y-4">
              <div class="flex items-center gap-3">
                <span class="text-sm text-neutral-500">Estado:</span>
                @if (movimiento()!.leido) {
                  <span class="badge-success">Resuelto</span>
                } @else if (movimiento()!.pendiente) {
                  <span [class]="claseNivel(movimiento()!.nivel_pendiente)">Pendiente - {{ movimiento()!.nivel_pendiente }}</span>
                } @else {
                  <span class="badge-neutral">No leído</span>
                }
              </div>

              @if (movimiento()!.leido && movimiento()!.fecha_leido) {
                <div>
                  <span class="text-xs text-neutral-500">Fecha resolución:</span>
                  <span class="text-sm ml-2">{{ movimiento()!.fecha_leido | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
              }

              @if (movimiento()!.pendiente) {
                <div>
                  <span class="text-xs text-neutral-500">Nivel:</span>
                  <span class="text-sm ml-2 font-medium">{{ movimiento()!.nivel_pendiente }}</span>
                </div>
                @if (movimiento()!.usuario_pendiente) {
                  <div>
                    <span class="text-xs text-neutral-500">Asignado a:</span>
                    <span class="text-sm ml-2">{{ movimiento()!.usuario_pendiente }}</span>
                  </div>
                }
              }

              <div>
                <span class="text-xs text-neutral-500">RUT:</span>
                <span class="text-sm ml-2">{{ movimiento()!.rut || '-' }}</span>
              </div>
              <div>
                <span class="text-xs text-neutral-500">Fecha Estado Diario:</span>
                <span class="text-sm ml-2">{{ movimiento()!.fecha_estado_diario || '-' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Recordatorios -->
        <div class="card">
          <div class="card-header flex items-center justify-between">
            <h3 class="text-lg font-semibold">Recordatorios</h3>
            <button (click)="abrirRecordatorioModal()" class="btn-outline btn-sm">Nuevo Recordatorio</button>
          </div>
          @if (agendas().length > 0) {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Detalle</th>
                    <th>Fecha</th>
                    <th>Nivel</th>
                    <th>WhatsApp</th>
                    <th>Google</th>
                    <th>Estado</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of agendas(); track a.id) {
                    <tr>
                      <td class="max-w-[250px] whitespace-normal">{{ a.detalle }}</td>
                      <td>{{ a.fecha_hora | date:'dd/MM/yyyy' }}</td>
                      <td><span [class]="claseNivel(a.nivel)">{{ a.nivel }}</span></td>
                      <td>
                        @if (a.notificar_whatsapp) {
                          <span [class]="a.enviado ? 'badge-success' : 'badge-neutral'">
                            {{ a.enviado ? 'Enviado' : 'Programado' }}
                          </span>
                        } @else { — }
                      </td>
                      <td>
                        @if (a.google_event_id) {
                          <span class="badge-success">Sincronizado</span>
                        } @else if (a.google_sync_error) {
                          <span class="badge-danger" [title]="a.google_sync_error">Error</span>
                        } @else { — }
                      </td>
                      <td>
                        @if (a.finalizado) {
                          <span class="badge-neutral">Finalizado</span>
                        } @else {
                          <span class="badge-info">Vigente</span>
                        }
                      </td>
                      <td>{{ a.usuario_registro || '-' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="card-body text-center text-neutral-400 py-8">
              No hay recordatorios
            </div>
          }
        </div>
      }

      <!-- Crear Recordatorio -->
      @if (showRecordatorioModal()) {
        <div class="modal-backdrop" (click)="showRecordatorioModal.set(false)">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="text-lg font-semibold">Crear Recordatorio</h3>
              <button (click)="showRecordatorioModal.set(false)" class="text-neutral-400 hover:text-neutral-600">&times;</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="form-label">Nivel de urgencia</label>
                <select class="form-select" [(ngModel)]="recNivel">
                  <option value="bajo">Bajo</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                </select>
              </div>
              <div>
                <label class="form-label">Detalle</label>
                <textarea class="form-input" rows="3" [(ngModel)]="recDetalle" placeholder="Descripción del recordatorio..."></textarea>
              </div>
              <div>
                <label class="form-label">Fecha del recordatorio</label>
                <input type="date" class="form-input" [(ngModel)]="recFecha" />
                <p class="text-xs text-neutral-400 mt-1">
                  Se agrega como evento de todo el día en tu Google Calendar (si está conectado).
                </p>
              </div>

              <hr class="border-neutral-200" />

              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" [(ngModel)]="recNotificarWhatsapp" />
                <span class="text-sm text-neutral-700">Notificar por WhatsApp</span>
              </label>

              @if (recNotificarWhatsapp) {
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="form-label">Teléfono</label>
                    <input type="text" class="form-input" [(ngModel)]="recTelefono" placeholder="+56912345678" />
                  </div>
                  <div>
                    <label class="form-label">Fecha y hora de envío</label>
                    <input type="datetime-local" class="form-input" [(ngModel)]="recFechaHoraWhatsapp" />
                  </div>
                </div>
              }
            </div>
            <div class="modal-footer">
              <button (click)="showRecordatorioModal.set(false)" class="btn-secondary">Cancelar</button>
              <button (click)="onCrearRecordatorio()" class="btn-primary" [disabled]="saving()">
                {{ saving() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class MovimientoDetailComponent implements OnInit {
  private service = inject(EstadoDiarioService);
  private notification = inject(NotificationService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  movimiento = signal<Movimiento | null>(null);
  agendas = signal<Agenda[]>([]);
  loading = signal(true);
  saving = signal(false);

  // Modal "Crear Recordatorio"
  showRecordatorioModal = signal(false);
  recNivel: NivelRecordatorio = 'medio';
  recDetalle = '';
  recFecha = '';
  recNotificarWhatsapp = false;
  recTelefono = '';
  recFechaHoraWhatsapp = '';

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadDetalle(id);
    this.loadAgendas(id);
  }

  private loadDetalle(id: number): void {
    this.service.getMovimientoDetalle(id).subscribe({
      next: (res) => {
        this.movimiento.set(res.movimiento);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error('Error al cargar detalle');
      },
    });
  }

  private loadAgendas(id: number): void {
    this.service.getAgendas(id).subscribe({
      next: (res) => this.agendas.set(res.agendas),
    });
  }

  goBack(): void {
    this.router.navigate(['/estado-diario/movimientos']);
  }

  claseNivel(nivel: string | null): string {
    if (nivel === 'alto') return 'badge-danger';
    if (nivel === 'medio') return 'badge-yellow';
    return 'badge-orange';
  }

  onMarcarLeido(): void {
    const id = this.movimiento()!.id;
    this.service.marcarLeido(id).subscribe({
      next: () => {
        this.notification.success('Marcado como resuelto');
        this.loadDetalle(id);
      },
      error: () => this.notification.error('Error al marcar como resuelto'),
    });
  }

  abrirRecordatorioModal(): void {
    this.recNivel = 'medio';
    this.recDetalle = '';
    this.recFecha = '';
    this.recNotificarWhatsapp = false;
    this.recTelefono = this.auth.user()?.telefono ?? '';
    this.recFechaHoraWhatsapp = '';
    this.showRecordatorioModal.set(true);
  }

  onCrearRecordatorio(): void {
    if (!this.recDetalle.trim() || !this.recFecha) {
      this.notification.warning('Complete el detalle y la fecha del recordatorio');
      return;
    }
    if (this.recNotificarWhatsapp && (!this.recTelefono.trim() || !this.recFechaHoraWhatsapp)) {
      this.notification.warning('Para notificar por WhatsApp indique teléfono y fecha/hora de envío');
      return;
    }

    const id = this.movimiento()!.id;
    const user = this.auth.user();
    this.saving.set(true);

    this.service.marcarPendiente(id, {
      nivel: this.recNivel,
      username: user?.username,
      mensaje: this.recDetalle,
      fecha_hora: `${this.recFecha} 00:00:00`,
      notificar_whatsapp: this.recNotificarWhatsapp,
      whatsapp_telefono: this.recNotificarWhatsapp ? this.recTelefono.trim() : undefined,
      fecha_hora_whatsapp: this.recNotificarWhatsapp
        ? this.recFechaHoraWhatsapp.replace('T', ' ') + ':00'
        : undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showRecordatorioModal.set(false);
        this.notification.success('Recordatorio creado');
        this.loadDetalle(id);
        this.loadAgendas(id);
      },
      error: (err) => {
        this.saving.set(false);
        this.notification.error(err.error?.detail || 'Error al crear el recordatorio');
      },
    });
  }
}
