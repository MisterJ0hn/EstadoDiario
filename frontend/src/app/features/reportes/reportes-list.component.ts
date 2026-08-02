import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReporteService } from './services/reporte.service';
import { NotificationService } from '@core/services/notification.service';
import { FuenteReporte, ReportePlantilla } from '@core/models/reporte.model';
import { descargarBlob, mensajeErrorBlob, nombreArchivoSeguro } from '@core/utils/descarga';

@Component({
  selector: 'app-reportes-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Informes</h1>
          <p class="text-neutral-500 mt-1">
            Arme su informe eligiendo los campos que necesita y recíbalo en Excel por correo.
          </p>
        </div>
        <a routerLink="/informes/nuevo" class="btn-primary shrink-0">Nuevo informe</a>
      </div>

      @if (mensaje()) {
        <div class="alert-danger">
          <span class="flex-1">{{ mensaje() }}</span>
          <button (click)="mensaje.set('')" class="text-current opacity-60 hover:opacity-100">&times;</button>
        </div>
      }

      @if (cargando()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      } @else if (error()) {
        <div class="card">
          <div class="card-body space-y-3">
            <p class="text-danger-700">{{ error() }}</p>
            <button (click)="cargar()" class="btn-secondary">Reintentar</button>
          </div>
        </div>
      } @else {
        <div class="card">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Informe</th>
                  <th>Fuente de datos</th>
                  <th>Campos</th>
                  <th>Última generación</th>
                  <th>Resultado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (p of plantillas(); track p.id) {
                  <tr>
                    <td class="font-medium">
                      <a [routerLink]="['/informes', p.id]" class="hover:text-primary-600 hover:underline">
                        {{ p.nombre }}
                      </a>
                      @if (p.descripcion) {
                        <span class="block text-xs font-normal text-neutral-400 max-w-[280px] truncate"
                              [title]="p.descripcion">{{ p.descripcion }}</span>
                      }
                    </td>
                    <td><span class="badge-info">{{ etiquetaFuente(p.fuente) }}</span></td>
                    <td>{{ p.campos.length }}</td>
                    <td>{{ fmtFechaHora(p.ultima_generacion) }}</td>
                    <td class="max-w-[240px] truncate" [title]="p.ultimo_resultado || ''">
                      @if (!p.ultimo_resultado) {
                        <span class="text-neutral-400">Nunca generado</span>
                      } @else if (esError(p.ultimo_resultado)) {
                        <span class="badge-danger">{{ p.ultimo_resultado }}</span>
                      } @else {
                        <span class="badge-success">{{ p.ultimo_resultado }}</span>
                      }
                    </td>
                    <td>
                      <div class="inline-flex items-center gap-1 align-middle">
                        <button (click)="enviar(p)" class="btn-outline btn-sm" [disabled]="ocupado()"
                                title="Generar y enviar a mi correo">
                          {{ enviandoId() === p.id ? 'Enviando...' : 'Enviar' }}
                        </button>
                        <button (click)="descargar(p)" class="btn-secondary btn-sm" [disabled]="ocupado()"
                                title="Descargar el Excel">
                          {{ descargandoId() === p.id ? 'Generando...' : 'Descargar' }}
                        </button>
                        <a [routerLink]="['/informes', p.id]" class="btn-secondary btn-sm">Editar</a>
                        <button (click)="confirmarEliminar.set(p)" class="btn-danger btn-sm" [disabled]="ocupado()">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="text-center py-10 text-neutral-400">
                      Aún no tiene informes guardados.
                      <a routerLink="/informes/nuevo" class="text-primary-600 hover:underline">Cree el primero</a>.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    <!-- Confirmar eliminación -->
    @if (confirmarEliminar(); as p) {
      <div class="modal-backdrop" (click)="cancelarEliminar()">
        <div class="modal-content max-w-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">Eliminar informe</h3>
            <button (click)="cancelarEliminar()" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>
          <div class="modal-body">
            <div class="flex items-start gap-3">
              <div class="shrink-0 w-10 h-10 rounded-full bg-danger-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <p class="text-sm text-neutral-600 mt-2">
                ¿Confirma que quiere eliminar el informe <strong>{{ p.nombre }}</strong>?
                Solo se borra la plantilla; los datos del sistema no se tocan.
              </p>
            </div>
          </div>
          <div class="modal-footer">
            <button (click)="cancelarEliminar()" class="btn-secondary" [disabled]="eliminando()">Cancelar</button>
            <button (click)="eliminar()" class="btn-danger" [disabled]="eliminando()">
              {{ eliminando() ? 'Eliminando...' : 'Sí, eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ReportesListComponent implements OnInit {
  private service = inject(ReporteService);
  private notification = inject(NotificationService);

  plantillas = signal<ReportePlantilla[]>([]);
  cargando = signal(true);
  error = signal('');
  /** Mensaje del backend al enviar/descargar; se muestra tal cual (trae el destinatario o el motivo). */
  mensaje = signal('');

  enviandoId = signal<number | null>(null);
  descargandoId = signal<number | null>(null);
  confirmarEliminar = signal<ReportePlantilla | null>(null);
  eliminando = signal(false);

  private readonly etiquetasFuente: Record<FuenteReporte, string> = {
    estado_diario: 'Estado Diario',
    movimientos: 'Movimientos',
    agenda: 'Recordatorios',
  };

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.service.getPlantillas().subscribe({
      next: (res) => {
        this.plantillas.set(res.plantillas);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudieron cargar sus informes guardados');
      },
    });
  }

  /** Un solo envío/descarga a la vez: generar el Excel puede demorar. */
  ocupado(): boolean {
    return this.enviandoId() !== null || this.descargandoId() !== null || this.eliminando();
  }

  etiquetaFuente(fuente: FuenteReporte): string {
    return this.etiquetasFuente[fuente] ?? fuente;
  }

  esError(resultado: string): boolean {
    return resultado.toLowerCase().startsWith('error');
  }

  /** Fechas del backend (yyyy-MM-ddTHH:mm:ss) a dd-MM-yyyy HH:mm sin pasar por Date. */
  fmtFechaHora(valor: string | null): string {
    if (!valor) return 'Nunca';
    const [fecha, hora] = valor.split('T');
    const partes = fecha.split('-');
    if (partes.length !== 3) return valor;
    const hhmm = (hora || '').slice(0, 5);
    return `${partes[2]}-${partes[1]}-${partes[0]}${hhmm ? ' ' + hhmm : ''}`;
  }

  enviar(p: ReportePlantilla): void {
    if (this.ocupado()) return;
    this.mensaje.set('');
    this.enviandoId.set(p.id);

    this.service.enviar(p.id).subscribe({
      next: (res) => {
        this.enviandoId.set(null);
        this.notification.success(res.mensaje);
        this.cargar();
      },
      error: (err) => {
        this.enviandoId.set(null);
        // El backend explica si falta configurar el SMTP o el correo del usuario.
        this.mensaje.set(
          `${err.error?.detail || 'No se pudo enviar el informe'} — mientras tanto puede usar Descargar.`
        );
        this.cargar();
      },
    });
  }

  descargar(p: ReportePlantilla): void {
    if (this.ocupado()) return;
    this.mensaje.set('');
    this.descargandoId.set(p.id);

    this.service.descargar(p.id).subscribe({
      next: (blob) => {
        this.descargandoId.set(null);
        descargarBlob(blob, nombreArchivoSeguro(p.nombre));
      },
      error: (err) => {
        this.descargandoId.set(null);
        mensajeErrorBlob(err, 'No se pudo generar el informe').then((m) => this.mensaje.set(m));
      },
    });
  }

  cancelarEliminar(): void {
    if (this.eliminando()) return;
    this.confirmarEliminar.set(null);
  }

  eliminar(): void {
    const p = this.confirmarEliminar();
    if (!p) return;

    this.eliminando.set(true);
    this.service.eliminar(p.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.confirmarEliminar.set(null);
        this.notification.success('Informe eliminado');
        this.cargar();
      },
      error: (err) => {
        this.eliminando.set(false);
        this.notification.error(err.error?.detail || 'No se pudo eliminar el informe');
      },
    });
  }
}
