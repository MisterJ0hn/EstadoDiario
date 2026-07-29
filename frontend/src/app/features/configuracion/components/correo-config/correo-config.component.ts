import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfiguracionCorreoService } from '../../services/configuracion-correo.service';
import { NotificationService } from '@core/services/notification.service';
import { ConfiguracionCorreoUpdate } from '@core/models/configuracion-correo.model';

@Component({
  selector: 'app-correo-config',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Importación por Correo</h1>
          <p class="text-neutral-500 mt-1">
            Descarga automáticamente los adjuntos de estado diario desde una casilla IMAP
          </p>
        </div>
        <a routerLink="/configuracion/correo/log" class="btn-secondary shrink-0">Ver bitácora</a>
      </div>

      @if (cargando()) {
        <div class="card"><div class="card-body text-neutral-500">Cargando configuración...</div></div>
      } @else {
        <div class="card">
          <div class="card-body space-y-5">
            <!-- Activación -->
            <label class="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" class="mt-1" [(ngModel)]="modelo.activo" />
              <span>
                <span class="font-medium text-neutral-800">Activar importación por correo</span>
                <span class="block text-sm text-neutral-500">
                  Mientras esté desactivada no se revisa la casilla, ni manual ni automáticamente.
                </span>
              </span>
            </label>

            <hr class="border-neutral-200" />

            <!-- Presets -->
            <div>
              <label class="form-label">Proveedor</label>
              <div class="flex gap-2 mt-1">
                <button type="button" (click)="usarPreset('gmail')" class="btn-secondary text-sm">Gmail</button>
                <button type="button" (click)="usarPreset('outlook')" class="btn-secondary text-sm">Outlook</button>
                <button type="button" (click)="usarPreset('otro')" class="btn-secondary text-sm">Otro IMAP</button>
              </div>
              <p class="text-xs text-neutral-400 mt-2">
                Gmail requiere una <strong>contraseña de aplicación</strong> (no la contraseña normal de la
                cuenta) y tener activada la verificación en dos pasos.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="md:col-span-2">
                <label class="form-label">Servidor IMAP</label>
                <input type="text" class="form-input" [(ngModel)]="modelo.host" placeholder="imap.gmail.com" />
              </div>
              <div>
                <label class="form-label">Puerto</label>
                <input type="number" class="form-input" [(ngModel)]="modelo.puerto" />
              </div>
            </div>

            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" [(ngModel)]="modelo.usar_ssl" />
              <span class="text-sm text-neutral-700">Usar SSL/TLS</span>
            </label>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">Usuario / dirección de correo</label>
                <input type="email" class="form-input" [(ngModel)]="modelo.usuario"
                       placeholder="estadodiario@estudio.cl" autocomplete="username" />
              </div>
              <div>
                <label class="form-label">
                  Contraseña
                  @if (tienePassword()) {
                    <span class="text-xs font-normal text-accent-600">(hay una guardada)</span>
                  }
                </label>
                <input type="password" class="form-input" [(ngModel)]="modelo.password"
                       [placeholder]="tienePassword() ? 'Dejar vacío para no cambiarla' : 'Contraseña de aplicación'"
                       autocomplete="new-password" />
              </div>
            </div>

            <div>
              <label class="form-label">Carpeta</label>
              <input type="text" class="form-input" [(ngModel)]="modelo.carpeta" placeholder="INBOX" />
            </div>

            <hr class="border-neutral-200" />

            <!-- Filtros -->
            <div>
              <h2 class="font-semibold text-neutral-800">Filtros de seguridad</h2>
              <p class="text-sm text-neutral-500 mb-3">
                Una casilla es una entrada abierta: cualquiera que conozca la dirección puede enviar un
                adjunto. La lista de remitentes es obligatoria.
              </p>

              <label class="form-label">Remitentes permitidos <span class="text-danger-600">*</span></label>
              <input type="text" class="form-input" [(ngModel)]="modelo.remitentes_permitidos"
                     placeholder="notificaciones@pjud.cl, otro@dominio.cl" />
              <p class="text-xs text-neutral-400 mt-1">Separados por coma. Solo se procesan correos de estas direcciones.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">El asunto debe contener</label>
                <input type="text" class="form-input" [(ngModel)]="modelo.asunto_contiene"
                       placeholder="Opcional. Ej: Estado Diario" />
              </div>
              <div>
                <label class="form-label">Tamaño máximo del adjunto (MB)</label>
                <input type="number" class="form-input" [(ngModel)]="modelo.max_tamano_mb" min="1" max="100" />
              </div>
            </div>

            <hr class="border-neutral-200" />

            <!-- Programación -->
            <div>
              <h2 class="font-semibold text-neutral-800">Revisión diaria</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <label class="form-label">Hora de revisión</label>
                  <input type="time" class="form-input" [(ngModel)]="modelo.hora_ejecucion" />
                  <p class="text-xs text-neutral-400 mt-1">
                    Se revisa una vez al día a partir de esta hora. Vacío = solo revisión manual.
                  </p>
                </div>
                <div class="flex items-end">
                  <label class="flex items-center gap-2 cursor-pointer pb-2">
                    <input type="checkbox" [(ngModel)]="modelo.marcar_como_leido" />
                    <span class="text-sm text-neutral-700">Marcar los correos como leídos</span>
                  </label>
                </div>
              </div>
            </div>

            @if (ultimaEjecucion()) {
              <div class="alert-info">
                Última revisión: {{ ultimaEjecucion() | date: 'dd/MM/yyyy HH:mm' }}
                @if (ultimoResultado()) { — {{ ultimoResultado() }} }
              </div>
            }

            @if (mensaje()) {
              <div [class]="mensajeEsError() ? 'alert-danger' : 'alert-info'">{{ mensaje() }}</div>
            }

            <div class="flex flex-wrap justify-end gap-3 pt-2">
              <button (click)="probar()" class="btn-secondary" [disabled]="ocupado()">
                Probar conexión
              </button>
              <button (click)="revisar()" class="btn-secondary" [disabled]="ocupado()">
                Revisar ahora
              </button>
              <button (click)="guardar()" class="btn-primary" [disabled]="ocupado()">
                {{ guardando() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class CorreoConfigComponent implements OnInit {
  private service = inject(ConfiguracionCorreoService);
  private notification = inject(NotificationService);

  modelo: ConfiguracionCorreoUpdate = {
    activo: false,
    host: 'imap.gmail.com',
    puerto: 993,
    usar_ssl: true,
    usuario: '',
    password: '',
    carpeta: 'INBOX',
    remitentes_permitidos: '',
    asunto_contiene: '',
    max_tamano_mb: 25,
    hora_ejecucion: '',
    marcar_como_leido: true,
  };

  cargando = signal(true);
  guardando = signal(false);
  probando = signal(false);
  tienePassword = signal(false);
  ultimaEjecucion = signal<string | null>(null);
  ultimoResultado = signal<string | null>(null);
  mensaje = signal('');
  mensajeEsError = signal(false);

  ocupado = signal(false);

  ngOnInit(): void {
    this.service.get().subscribe({
      next: (config) => {
        this.modelo = {
          activo: config.activo,
          host: config.host,
          puerto: config.puerto,
          usar_ssl: config.usar_ssl,
          usuario: config.usuario ?? '',
          password: '',
          carpeta: config.carpeta,
          remitentes_permitidos: config.remitentes_permitidos ?? '',
          asunto_contiene: config.asunto_contiene ?? '',
          max_tamano_mb: config.max_tamano_mb,
          // El backend entrega HH:MM:SS y el input type=time espera HH:MM
          hora_ejecucion: config.hora_ejecucion ? config.hora_ejecucion.slice(0, 5) : '',
          marcar_como_leido: config.marcar_como_leido,
        };
        this.tienePassword.set(config.tiene_password);
        this.ultimaEjecucion.set(config.ultima_ejecucion);
        this.ultimoResultado.set(config.ultimo_resultado);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.notification.error('No se pudo cargar la configuración');
      },
    });
  }

  usarPreset(proveedor: 'gmail' | 'outlook' | 'otro'): void {
    if (proveedor === 'gmail') {
      this.modelo.host = 'imap.gmail.com';
      this.modelo.puerto = 993;
      this.modelo.usar_ssl = true;
    } else if (proveedor === 'outlook') {
      this.modelo.host = 'outlook.office365.com';
      this.modelo.puerto = 993;
      this.modelo.usar_ssl = true;
    } else {
      this.modelo.host = '';
      this.modelo.puerto = 993;
      this.modelo.usar_ssl = true;
    }
  }

  private payload(): ConfiguracionCorreoUpdate {
    return {
      ...this.modelo,
      usuario: this.modelo.usuario || null,
      password: this.modelo.password || null,
      remitentes_permitidos: this.modelo.remitentes_permitidos || null,
      asunto_contiene: this.modelo.asunto_contiene || null,
      hora_ejecucion: this.modelo.hora_ejecucion || null,
    };
  }

  private validar(): string | null {
    if (!this.modelo.host) return 'Indique el servidor IMAP';
    if (!this.modelo.usuario) return 'Indique el usuario de la casilla';
    if (!this.modelo.password && !this.tienePassword()) return 'Indique la contraseña';
    if (this.modelo.activo && !this.modelo.remitentes_permitidos) {
      return 'Debe indicar al menos un remitente permitido para activar la ingesta';
    }
    return null;
  }

  guardar(): void {
    const error = this.validar();
    if (error) {
      this.mensaje.set(error);
      this.mensajeEsError.set(true);
      return;
    }

    this.mensaje.set('');
    this.guardando.set(true);
    this.ocupado.set(true);

    this.service.save(this.payload()).subscribe({
      next: (config) => {
        this.guardando.set(false);
        this.ocupado.set(false);
        this.tienePassword.set(config.tiene_password);
        this.modelo.password = '';
        this.notification.success('Configuración guardada');
      },
      error: (err) => {
        this.guardando.set(false);
        this.ocupado.set(false);
        this.mensaje.set(err.error?.detail || 'No se pudo guardar la configuración');
        this.mensajeEsError.set(true);
      },
    });
  }

  probar(): void {
    this.mensaje.set('');
    this.probando.set(true);
    this.ocupado.set(true);

    // Se manda la contraseña escrita (si la hay) para poder probarla antes de guardar
    this.service.probarConexion(this.modelo.password).subscribe({
      next: (res) => {
        this.probando.set(false);
        this.ocupado.set(false);
        this.mensaje.set(res.mensaje);
        this.mensajeEsError.set(!res.exito);
      },
      error: (err) => {
        this.probando.set(false);
        this.ocupado.set(false);
        this.mensaje.set(err.error?.detail || 'No se pudo probar la conexión');
        this.mensajeEsError.set(true);
      },
    });
  }

  revisar(): void {
    this.mensaje.set('');
    this.ocupado.set(true);

    this.service.revisarAhora().subscribe({
      next: (res) => {
        this.ocupado.set(false);
        this.mensaje.set(res.mensaje);
        this.mensajeEsError.set(!res.exito);
        if (res.exito) {
          this.notification.success(`Revisión completada: ${res.importados} archivos importados`);
        }
      },
      error: (err) => {
        this.ocupado.set(false);
        this.mensaje.set(err.error?.detail || 'No se pudo revisar la casilla');
        this.mensajeEsError.set(true);
      },
    });
  }
}
