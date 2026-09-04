import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import { Movimiento, Agenda } from '@core/models/estado-diario.model';
import { Causa } from '@core/models/causa.model';
import { PjudBotonComponent } from '@features/causas/components/pjud-boton/pjud-boton.component';
import { PjudMovimientosModalComponent } from '@features/causas/components/pjud-movimientos-modal/pjud-movimientos-modal.component';
import { CausaService } from '@features/causas/services/causa.service';
import { RecordatorioModalComponent } from '../recordatorio-modal/recordatorio-modal.component';

@Component({
  selector: 'app-movimiento-detail',
  standalone: true,
  imports: [
    CommonModule, RecordatorioModalComponent,
    PjudBotonComponent, PjudMovimientosModalComponent,
  ],
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
            <h1 class="text-2xl font-bold text-neutral-800">Detalle del Estado Diario #{{ movimiento()!.id }}</h1>
          </div>
          <div class="flex items-center gap-2">
            @if (pjudDisponible()) {
              <!-- Mismo botón que Mis Causas: solo se pinta si la causa
                   resultó Civil (lo único que expone la API del PJUD). -->
              PJUD: 
              <app-pjud-boton [causa]="pjudCausa()" (abrir)="pjudModal.set(pjudCausa())" />
            }
            @if (!movimiento()!.leido) {
              <!-- Sin confirmación: marca resuelto de inmediato. -->
              <button (click)="onMarcarLeido()" class="btn-success" [disabled]="marcandoLeido()">
                {{ marcandoLeido() ? 'Guardando...' : 'Marcar como Resuelto' }}
              </button>
              <!-- Marcar pendiente y agendar son una sola acción: el modal de
                   recordatorio deja el registro pendiente con el nivel elegido ahí. -->
              <button (click)="recordatorioMovimientoId.set(movimiento()!.id)" class="btn-warning">Marcar como Pendiente</button>
            } @else {
              <!-- Deshace el "resuelto": vuelve el registro a No Leído. -->
              <button (click)="onMarcarNoLeido()" class="btn-outline" [disabled]="marcandoLeido()">
                {{ marcandoLeido() ? 'Guardando...' : 'No resuelto' }}
              </button>
            }
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

              @if (movimiento()!.observacion_resuelto) {
                <div>
                  <span class="text-xs text-neutral-500 uppercase">Observación</span>
                  <p class="text-sm text-neutral-700 mt-1 whitespace-pre-line">{{ movimiento()!.observacion_resuelto }}</p>
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
            @if (!movimiento()!.leido) {
              <button (click)="recordatorioMovimientoId.set(movimiento()!.id)" class="btn-outline btn-sm">Nuevo Recordatorio</button>
            }
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

      <app-recordatorio-modal
        [movimientoId]="recordatorioMovimientoId()"
        (cerrado)="recordatorioMovimientoId.set(null)"
        (guardado)="onRecordatorioGuardado()"
      />

      <app-pjud-movimientos-modal [causa]="pjudModal()" (cerrado)="pjudModal.set(null)" />
    </div>
  `,
})
export class MovimientoDetailComponent implements OnInit {
  private service = inject(EstadoDiarioService);
  private causaService = inject(CausaService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  movimiento = signal<Movimiento | null>(null);
  agendas = signal<Agenda[]>([]);
  loading = signal(true);

  /** Si api-pjud.codifica.cl está configurada; sin esto el botón "Detalle
   *  PJUD" no tiene sentido y no se muestra (mismo criterio que Mis Causas). */
  pjudDisponible = signal(false);
  /** La Causa Civil de la cartera que calza con el rol/tribunal de este
   *  registro, resuelta por `/causas/pjud/por-rol`; null = no hay cartera
   *  cargada, no calza ninguna, o no es Civil (ahí no se muestra el botón). */
  pjudCausa = signal<Causa | null>(null);
  /** Causa para la que está abierto el modal de detalle PJUD; null = cerrado. */
  pjudModal = signal<Causa | null>(null);

  /** id del registro para el que se abre el modal "Marcar como pendiente"; null = cerrado */
  recordatorioMovimientoId = signal<number | null>(null);

  marcandoLeido = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadDetalle(id);
    this.loadAgendas(id);

    this.causaService.pjudDisponible().subscribe({
      next: (res) => this.pjudDisponible.set(res.disponible),
      error: () => this.pjudDisponible.set(false),
    });
  }

  private loadDetalle(id: number): void {
    this.service.getMovimientoDetalle(id).subscribe({
      next: (res) => {
        this.movimiento.set(res.movimiento);
        this.loading.set(false);
        this.resolverPjud(res.movimiento);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error('Error al cargar detalle');
      },
    });
  }

  /** Busca la Causa Civil que corresponde a este registro por rol/tribunal,
   *  para el botón "Detalle PJUD". Sin rol o tribunal, o si no calza ninguna,
   *  simplemente no se ofrece el botón. */
  private resolverPjud(m: Movimiento): void {
    if (!m.rol || !m.tribunal) {
      this.pjudCausa.set(null);
      return;
    }
    this.causaService.pjudPorRol(m.rol, m.tribunal).subscribe({
      next: (res) => this.pjudCausa.set(res.causa),
      error: () => this.pjudCausa.set(null),
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

  /** Sin confirmación: marca resuelto de inmediato al apretar el botón. */
  onMarcarLeido(): void {
    const id = this.movimiento()!.id;
    this.marcandoLeido.set(true);
    this.service.marcarLeido(id).subscribe({
      next: () => {
        this.marcandoLeido.set(false);
        this.notification.success('Marcado como resuelto');
        this.loadDetalle(id);
      },
      error: () => {
        this.marcandoLeido.set(false);
        this.notification.error('Error al marcar como resuelto');
      },
    });
  }

  /** Deshace un "resuelto": vuelve el registro a No Leído. */
  onMarcarNoLeido(): void {
    const id = this.movimiento()!.id;
    this.marcandoLeido.set(true);
    this.service.marcarNoLeido(id).subscribe({
      next: () => {
        this.marcandoLeido.set(false);
        this.notification.success('Vuelto a No Leído');
        this.loadDetalle(id);
      },
      error: () => {
        this.marcandoLeido.set(false);
        this.notification.error('Error al deshacer el resuelto');
      },
    });
  }

  onRecordatorioGuardado(): void {
    const id = this.movimiento()!.id;
    this.recordatorioMovimientoId.set(null);
    this.loadDetalle(id);
    this.loadAgendas(id);
  }
}
