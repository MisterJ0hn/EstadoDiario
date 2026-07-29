import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EstadoDiarioService } from '../estado-diario/services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';
import { RecordatorioVigente } from '@core/models/estado-diario.model';

interface DiaCalendario {
  fecha: Date;
  key: string;
  delMes: boolean;
  esHoy: boolean;
  recordatorios: RecordatorioVigente[];
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function claveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Calendario</h1>
          <p class="text-neutral-500 mt-1">Recordatorios vigentes (no finalizados)</p>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="mesAnterior()" class="btn-secondary btn-sm" title="Mes anterior">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button (click)="irAHoy()" class="btn-secondary btn-sm">Hoy</button>
          <button (click)="mesSiguiente()" class="btn-secondary btn-sm" title="Mes siguiente">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span class="font-semibold text-neutral-800 ml-2 min-w-[160px]">
            {{ nombreMes() }} {{ mesActual().getFullYear() }}
          </span>
        </div>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      } @else {
        <div class="card overflow-hidden">
          <div class="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
            @for (d of diasSemana; track d) {
              <div class="px-2 py-2 text-center text-xs font-semibold text-neutral-500 uppercase">{{ d }}</div>
            }
          </div>
          <div class="grid grid-cols-7">
            @for (dia of dias(); track dia.key) {
              <div
                class="min-h-[110px] border-b border-r border-neutral-100 p-1.5 last:border-r-0"
                [class.bg-neutral-50]="!dia.delMes"
              >
                <div class="flex items-center justify-between mb-1">
                  <span
                    class="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full"
                    [class]="dia.esHoy ? 'bg-primary-600 text-white' : dia.delMes ? 'text-neutral-700' : 'text-neutral-400'"
                  >{{ dia.fecha.getDate() }}</span>
                </div>
                <div class="space-y-1">
                  @for (r of dia.recordatorios; track r.id) {
                    <button
                      (click)="abrirDetalle(r)"
                      class="w-full text-left truncate rounded px-1.5 py-0.5 text-xs font-medium"
                      [class]="claseChip(r.nivel)"
                      [title]="r.movimiento_caratulado || r.detalle"
                    >{{ r.movimiento_rol || r.movimiento_caratulado || r.detalle }}</button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>

    <!-- Detalle / Finalizar -->
    @if (seleccionado(); as r) {
      <div class="modal-backdrop" (click)="cerrarDetalle()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">Recordatorio</h3>
            <button (click)="cerrarDetalle()" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>
          <div class="modal-body space-y-4">
            <div class="flex items-center gap-2">
              <span [class]="claseChip(r.nivel)" class="px-2 py-0.5 rounded-full text-xs font-medium">{{ r.nivel }}</span>
              <span class="text-sm text-neutral-500">{{ r.fecha_hora | date:'dd/MM/yyyy' }}</span>
            </div>

            <div>
              <span class="text-xs text-neutral-500 uppercase">Detalle</span>
              <p class="text-sm mt-0.5">{{ r.detalle }}</p>
            </div>

            <hr class="border-neutral-200" />

            <div>
              <span class="text-xs text-neutral-500 uppercase">Movimiento</span>
              <p class="font-medium mt-0.5">{{ r.movimiento_caratulado || '-' }}</p>
              <p class="text-sm text-neutral-500">{{ r.movimiento_rol || '-' }} · {{ r.movimiento_tribunal || '-' }}</p>
              <button (click)="verMovimiento(r)" class="text-primary-600 hover:underline text-sm mt-1">
                Ver detalle del movimiento →
              </button>
            </div>

            @if (r.usuario_registro) {
              <div>
                <span class="text-xs text-neutral-500">Registrado por:</span>
                <span class="text-sm ml-1">{{ r.usuario_registro }}</span>
              </div>
            }

            @if (!confirmandoFinalizar()) {
              <div class="pt-2">
                <button (click)="confirmandoFinalizar.set(true)" class="btn-warning w-full">Finalizar recordatorio</button>
              </div>
            } @else {
              <div class="rounded-lg border border-warning-200 bg-warning-50 p-3 space-y-3">
                <p class="text-sm text-neutral-700">¿Marcar también el movimiento como resuelto?</p>
                <div class="flex flex-col gap-2">
                  <button (click)="finalizar(true)" class="btn-success btn-sm" [disabled]="finalizando()">
                    Sí, marcar como resuelto
                  </button>
                  <button (click)="finalizar(false)" class="btn-secondary btn-sm" [disabled]="finalizando()">
                    No, solo finalizar el recordatorio
                  </button>
                  <button (click)="confirmandoFinalizar.set(false)" class="text-xs text-neutral-400 hover:text-neutral-600" [disabled]="finalizando()">
                    Cancelar
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class CalendarioComponent implements OnInit {
  private service = inject(EstadoDiarioService);
  private notification = inject(NotificationService);
  private router = inject(Router);

  readonly diasSemana = DIAS_SEMANA;

  loading = signal(true);
  recordatorios = signal<RecordatorioVigente[]>([]);
  mesActual = signal(this.primerDiaDelMes(new Date()));

  seleccionado = signal<RecordatorioVigente | null>(null);
  confirmandoFinalizar = signal(false);
  finalizando = signal(false);

  private porDia = computed(() => {
    const mapa = new Map<string, RecordatorioVigente[]>();
    for (const r of this.recordatorios()) {
      const key = r.fecha_hora.slice(0, 10);
      const lista = mapa.get(key) ?? [];
      lista.push(r);
      mapa.set(key, lista);
    }
    return mapa;
  });

  nombreMes = computed(() => MESES[this.mesActual().getMonth()]);

  dias = computed<DiaCalendario[]>(() => {
    const mes = this.mesActual();
    const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1);
    // Lunes=0 ... Domingo=6
    const offset = (primerDia.getDay() + 6) % 7;
    const inicio = new Date(primerDia);
    inicio.setDate(inicio.getDate() - offset);

    const hoy = claveDia(new Date());
    const mapa = this.porDia();
    const celdas: DiaCalendario[] = [];

    for (let i = 0; i < 42; i++) {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + i);
      const key = claveDia(fecha);
      celdas.push({
        fecha,
        key,
        delMes: fecha.getMonth() === mes.getMonth(),
        esHoy: key === hoy,
        recordatorios: mapa.get(key) ?? [],
      });
    }
    return celdas;
  });

  ngOnInit(): void {
    this.cargar();
  }

  private primerDiaDelMes(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  cargar(): void {
    this.loading.set(true);
    this.service.getCalendario().subscribe({
      next: (res) => {
        this.recordatorios.set(res.recordatorios);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error('No se pudo cargar el calendario');
      },
    });
  }

  mesAnterior(): void {
    const m = this.mesActual();
    this.mesActual.set(new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  mesSiguiente(): void {
    const m = this.mesActual();
    this.mesActual.set(new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  irAHoy(): void {
    this.mesActual.set(this.primerDiaDelMes(new Date()));
  }

  claseChip(nivel: string): string {
    if (nivel === 'alto') return 'badge-danger';
    if (nivel === 'medio') return 'badge-yellow';
    return 'badge-orange';
  }

  abrirDetalle(r: RecordatorioVigente): void {
    this.seleccionado.set(r);
    this.confirmandoFinalizar.set(false);
  }

  cerrarDetalle(): void {
    if (this.finalizando()) return;
    this.seleccionado.set(null);
    this.confirmandoFinalizar.set(false);
  }

  verMovimiento(r: RecordatorioVigente): void {
    this.router.navigate(['/estado-diario', r.estado_diario_id]);
  }

  finalizar(marcarResuelto: boolean): void {
    const r = this.seleccionado();
    if (!r) return;

    this.finalizando.set(true);
    this.service.finalizarAgenda(r.id, { marcar_resuelto: marcarResuelto }).subscribe({
      next: () => {
        this.finalizando.set(false);
        this.notification.success(
          marcarResuelto ? 'Recordatorio finalizado y movimiento marcado como resuelto' : 'Recordatorio finalizado'
        );
        this.recordatorios.set(this.recordatorios().filter((x) => x.id !== r.id));
        this.seleccionado.set(null);
        this.confirmandoFinalizar.set(false);
      },
      error: (err) => {
        this.finalizando.set(false);
        this.notification.error(err.error?.detail || 'No se pudo finalizar el recordatorio');
      },
    });
  }
}
