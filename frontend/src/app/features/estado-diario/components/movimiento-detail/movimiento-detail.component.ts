import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import { Movimiento, Agenda } from '@core/models/estado-diario.model';

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
              <button (click)="showPendienteModal.set(true)" class="btn-warning">Marcar Pendiente</button>
            }
            <button (click)="showAgendaModal.set(true)" class="btn-outline">Agendar</button>
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
                  <span class="badge-warning">Pendiente - {{ movimiento()!.nivel_pendiente }}</span>
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

        <!-- Agendas -->
        <div class="card">
          <div class="card-header flex items-center justify-between">
            <h3 class="text-lg font-semibold">Agenda</h3>
            <button (click)="showAgendaModal.set(true)" class="btn-outline btn-sm">Nueva Entrada</button>
          </div>
          @if (agendas().length > 0) {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Detalle</th>
                    <th>Fecha/Hora</th>
                    <th>Registrado</th>
                    <th>Usuario</th>
                    <th>Enviado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of agendas(); track a.id) {
                    <tr>
                      <td class="max-w-[300px] whitespace-normal">{{ a.detalle }}</td>
                      <td>{{ a.fecha_hora | date:'dd/MM/yyyy HH:mm' }}</td>
                      <td>{{ a.fecha_hora_registro | date:'dd/MM/yyyy HH:mm' }}</td>
                      <td>{{ a.usuario_registro || '-' }}</td>
                      <td>
                        @if (a.enviado) {
                          <span class="badge-success">Sí</span>
                        } @else {
                          <span class="badge-neutral">No</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="card-body text-center text-neutral-400 py-8">
              No hay entradas de agenda
            </div>
          }
        </div>
      }

      <!-- Pendiente Modal -->
      @if (showPendienteModal()) {
        <div class="modal-backdrop" (click)="showPendienteModal.set(false)">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="text-lg font-semibold">Marcar como Pendiente</h3>
              <button (click)="showPendienteModal.set(false)" class="text-neutral-400 hover:text-neutral-600">&times;</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="form-label">Nivel de prioridad</label>
                <select class="form-select" [(ngModel)]="pendienteNivel">
                  <option value="bajo">Bajo</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                </select>
              </div>
              <div>
                <label class="form-label">Mensaje (opcional, para agendar)</label>
                <textarea class="form-input" rows="3" [(ngModel)]="pendienteMensaje" placeholder="Detalles..."></textarea>
              </div>
              @if (pendienteMensaje) {
                <div>
                  <label class="form-label">Fecha/hora agenda</label>
                  <input type="datetime-local" class="form-input" [(ngModel)]="pendienteFechaHora" />
                </div>
              }
            </div>
            <div class="modal-footer">
              <button (click)="showPendienteModal.set(false)" class="btn-secondary">Cancelar</button>
              <button (click)="onMarcarPendiente()" class="btn-warning" [disabled]="saving()">Guardar</button>
            </div>
          </div>
        </div>
      }

      <!-- Agenda Modal -->
      @if (showAgendaModal()) {
        <div class="modal-backdrop" (click)="showAgendaModal.set(false)">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="text-lg font-semibold">Nueva Entrada de Agenda</h3>
              <button (click)="showAgendaModal.set(false)" class="text-neutral-400 hover:text-neutral-600">&times;</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="form-label">Detalle</label>
                <textarea class="form-input" rows="3" [(ngModel)]="agendaDetalle" placeholder="Descripción..."></textarea>
              </div>
              <div>
                <label class="form-label">Fecha y hora</label>
                <input type="datetime-local" class="form-input" [(ngModel)]="agendaFechaHora" />
              </div>
            </div>
            <div class="modal-footer">
              <button (click)="showAgendaModal.set(false)" class="btn-secondary">Cancelar</button>
              <button (click)="onCrearAgenda()" class="btn-primary" [disabled]="saving()">Guardar</button>
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

  // Pendiente modal
  showPendienteModal = signal(false);
  pendienteNivel = 'medio';
  pendienteMensaje = '';
  pendienteFechaHora = '';

  // Agenda modal
  showAgendaModal = signal(false);
  agendaDetalle = '';
  agendaFechaHora = '';

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

  onMarcarPendiente(): void {
    const id = this.movimiento()!.id;
    const user = this.auth.user();
    this.saving.set(true);

    const data: Record<string, string | undefined> = { nivel: this.pendienteNivel };
    if (this.pendienteMensaje.trim()) {
      data['mensaje'] = this.pendienteMensaje;
      data['fecha_hora'] = this.pendienteFechaHora
        ? this.pendienteFechaHora.replace('T', ' ') + ':00'
        : undefined;
      data['username'] = user?.username;
    }

    this.service.marcarPendiente(id, data as any).subscribe({
      next: () => {
        this.saving.set(false);
        this.showPendienteModal.set(false);
        this.notification.success('Marcado como pendiente');
        this.loadDetalle(id);
        this.loadAgendas(id);
        this.pendienteMensaje = '';
        this.pendienteFechaHora = '';
      },
      error: (err) => {
        this.saving.set(false);
        this.notification.error(err.error?.detail || 'Error');
      },
    });
  }

  onCrearAgenda(): void {
    if (!this.agendaDetalle.trim() || !this.agendaFechaHora) {
      this.notification.warning('Complete detalle y fecha/hora');
      return;
    }

    const id = this.movimiento()!.id;
    const user = this.auth.user();
    this.saving.set(true);

    this.service.crearAgenda(id, {
      detalle: this.agendaDetalle,
      fecha_hora: this.agendaFechaHora.replace('T', ' ') + ':00',
      username: user?.username,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showAgendaModal.set(false);
        this.notification.success('Agenda creada');
        this.loadAgendas(id);
        this.agendaDetalle = '';
        this.agendaFechaHora = '';
      },
      error: (err) => {
        this.saving.set(false);
        this.notification.error(err.error?.detail || 'Error al crear agenda');
      },
    });
  }
}
