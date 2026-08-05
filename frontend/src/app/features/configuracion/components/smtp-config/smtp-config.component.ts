import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfiguracionSmtpService } from '../../services/configuracion-smtp.service';
import { NotificationService } from '@core/services/notification.service';
import { ConfiguracionSmtpUpdate } from '@core/models/configuracion-smtp.model';

@Component({
  selector: 'app-smtp-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Correo de salida (SMTP)</h1>
        <p class="text-neutral-500 mt-1">
          Cuenta desde la que el sistema despacha los informes en Excel
        </p>
      </div>

      <!-- Se confunde con la casilla IMAP de cada usuario: conviene dejarlo claro arriba. -->
      <div class="alert-info">
        Esta es la cuenta <strong>de salida del sistema</strong>, una sola para todos los
        clientes. No tiene relación con la casilla de correo desde la que cada estudio importa
        sus estados diarios.
        <span class="block mt-1">
          Cada informe se envía siempre al correo del usuario que lo genera; nunca a una dirección
          escrita a mano.
        </span>
      </div>

      @if (cargando()) {
        <div class="card"><div class="card-body text-neutral-500">Cargando configuración...</div></div>
      } @else {
        <div class="card">
          <div class="card-body space-y-5">
            <label class="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" class="mt-1" [(ngModel)]="modelo.activo" />
              <span>
                <span class="font-medium text-neutral-800">Activar el envío de informes por correo</span>
                <span class="block text-sm text-neutral-500">
                  Desactivado, los usuarios igual pueden descargar sus informes desde el sistema.
                </span>
              </span>
            </label>

            <hr class="border-neutral-200" />

            <div>
              <label class="form-label">Proveedor</label>
              <div class="flex flex-wrap gap-2 mt-1">
                <button type="button" (click)="usarPreset('gmail')" class="btn-secondary text-sm">Gmail</button>
                <button type="button" (click)="usarPreset('outlook')" class="btn-secondary text-sm">Outlook</button>
                <button type="button" (click)="usarPreset('otro')" class="btn-secondary text-sm">Otro SMTP</button>
              </div>
              <p class="text-xs text-neutral-400 mt-2">
                Gmail requiere una <strong>contraseña de aplicación</strong> (no la contraseña normal de la
                cuenta) y tener activada la verificación en dos pasos.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="md:col-span-2">
                <label class="form-label">Servidor SMTP</label>
                <input type="text" class="form-input" [(ngModel)]="modelo.host" placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label class="form-label">Puerto</label>
                <input type="number" class="form-input" [(ngModel)]="modelo.puerto" />
              </div>
            </div>

            <div class="flex flex-wrap gap-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" [(ngModel)]="modelo.usar_tls" (ngModelChange)="alCambiarTls()" />
                <span class="text-sm text-neutral-700">STARTTLS (puerto 587)</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" [(ngModel)]="modelo.usar_ssl" (ngModelChange)="alCambiarSsl()" />
                <span class="text-sm text-neutral-700">SSL directo (puerto 465)</span>
              </label>
            </div>
            <p class="text-xs text-neutral-400 -mt-3">
              Son excluyentes: la mayoría de los servidores usa STARTTLS en el 587.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">Usuario</label>
                <input type="email" class="form-input" [(ngModel)]="modelo.usuario"
                       placeholder="informes@estudio.cl" autocomplete="username" />
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

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">Correo del remitente</label>
                <input type="email" class="form-input" [(ngModel)]="modelo.remitente_email"
                       placeholder="informes@estudio.cl" />
                <p class="text-xs text-neutral-400 mt-1">Vacío = se usa el usuario de la cuenta.</p>
              </div>
              <div>
                <label class="form-label">Nombre del remitente</label>
                <input type="text" class="form-input" [(ngModel)]="modelo.remitente_nombre"
                       placeholder="Estado Diario" />
              </div>
            </div>

            @if (ultimoEnvio()) {
              <div class="alert-info">
                Último envío: {{ fmtFechaHora(ultimoEnvio()) }}
                @if (ultimoResultado()) { — {{ ultimoResultado() }} }
              </div>
            }

            @if (mensaje()) {
              <div [class]="mensajeEsError() ? 'alert-danger' : 'alert-success'">{{ mensaje() }}</div>
            }

            <div class="flex flex-wrap items-center justify-end gap-3 pt-2">
              <p class="text-xs text-neutral-400 mr-auto">
                "Probar conexión" usa el servidor y el puerto ya guardados (la contraseña sí se toma de
                lo escrito). Si cambió el servidor o el puerto, guarde antes de probar.
              </p>
              <button (click)="probar()" class="btn-secondary" [disabled]="ocupado()">
                {{ probando() ? 'Probando...' : 'Probar conexión' }}
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
export class SmtpConfigComponent implements OnInit {
  private service = inject(ConfiguracionSmtpService);
  private notification = inject(NotificationService);

  modelo: ConfiguracionSmtpUpdate = {
    activo: false,
    host: 'smtp.gmail.com',
    puerto: 587,
    usar_tls: true,
    usar_ssl: false,
    usuario: '',
    password: '',
    remitente_email: '',
    remitente_nombre: 'Estado Diario',
  };

  cargando = signal(true);
  guardando = signal(false);
  probando = signal(false);
  tienePassword = signal(false);
  ultimoEnvio = signal<string | null>(null);
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
          usar_tls: config.usar_tls,
          usar_ssl: config.usar_ssl,
          usuario: config.usuario ?? '',
          // La contraseña nunca vuelve del backend: el campo parte vacío y
          // vacío significa "no cambiar la que ya está guardada".
          password: '',
          remitente_email: config.remitente_email ?? '',
          remitente_nombre: config.remitente_nombre ?? 'Estado Diario',
        };
        this.tienePassword.set(config.tiene_password);
        this.ultimoEnvio.set(config.ultimo_envio);
        this.ultimoResultado.set(config.ultimo_resultado);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.notification.error('No se pudo cargar la configuración de correo de salida');
      },
    });
  }

  usarPreset(proveedor: 'gmail' | 'outlook' | 'otro'): void {
    if (proveedor === 'gmail') {
      this.modelo.host = 'smtp.gmail.com';
    } else if (proveedor === 'outlook') {
      this.modelo.host = 'smtp.office365.com';
    } else {
      this.modelo.host = '';
    }
    this.modelo.puerto = 587;
    this.modelo.usar_tls = true;
    this.modelo.usar_ssl = false;
  }

  /** STARTTLS y SSL directo no conviven: marcar uno apaga el otro. */
  alCambiarTls(): void {
    if (this.modelo.usar_tls) {
      this.modelo.usar_ssl = false;
      if (this.modelo.puerto === 465) this.modelo.puerto = 587;
    }
  }

  alCambiarSsl(): void {
    if (this.modelo.usar_ssl) {
      this.modelo.usar_tls = false;
      if (this.modelo.puerto === 587) this.modelo.puerto = 465;
    }
  }

  /** Fechas del backend (yyyy-MM-ddTHH:mm:ss) a dd-MM-yyyy HH:mm sin pasar por Date. */
  fmtFechaHora(valor: string | null): string {
    if (!valor) return '-';
    const [fecha, hora] = valor.split('T');
    const partes = fecha.split('-');
    if (partes.length !== 3) return valor;
    const hhmm = (hora || '').slice(0, 5);
    return `${partes[2]}-${partes[1]}-${partes[0]}${hhmm ? ' ' + hhmm : ''}`;
  }

  private payload(): ConfiguracionSmtpUpdate {
    return {
      ...this.modelo,
      usuario: this.modelo.usuario || null,
      password: this.modelo.password || null,
      remitente_email: this.modelo.remitente_email || null,
      remitente_nombre: this.modelo.remitente_nombre || null,
    };
  }

  private validar(): string | null {
    if (!this.modelo.host) return 'Indique el servidor SMTP';
    if (!this.modelo.usuario) return 'Indique el usuario de la cuenta de envío';
    if (!this.modelo.password && !this.tienePassword()) return 'Indique la contraseña';
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
    this.service.probarConexion(this.payload()).subscribe({
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
}
