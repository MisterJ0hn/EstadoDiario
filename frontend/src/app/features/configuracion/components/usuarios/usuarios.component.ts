import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuarioService } from '../../services/usuario.service';
import { NotificationService } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import { RolUsuario, Usuario } from '@core/models/usuario.model';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Usuarios</h1>
          <p class="text-neutral-500 mt-1">
            Cree las cuentas de acceso al sistema y administre sus roles
          </p>
        </div>
        <button (click)="abrirNuevo()" class="btn-primary shrink-0">Nuevo usuario</button>
      </div>

      <div class="card">
        <div class="card-body">
          @if (cargando()) {
            <p class="text-neutral-500 py-8 text-center">Cargando...</p>
          } @else if (usuarios().length === 0) {
            <p class="text-neutral-500 py-8 text-center">Todavía no hay usuarios.</p>
          } @else {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Creado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (u of usuarios(); track u.id) {
                    <tr>
                      <td class="font-medium">
                        {{ u.username }}
                        @if (u.id === usuarioActualId()) {
                          <span class="text-xs text-neutral-400">(usted)</span>
                        }
                      </td>
                      <td>{{ (u.nombre || '') + ' ' + (u.apellido || '') | titlecase }}</td>
                      <td class="break-all">{{ u.email }}</td>
                      <td>
                        <span [class]="u.rol === 'admin' ? 'badge-info' : 'badge-neutral'">
                          {{ u.rol === 'admin' ? 'Administrador' : 'Usuario' }}
                        </span>
                      </td>
                      <td>
                        <span [class]="u.activo ? 'badge-success' : 'badge-neutral'">
                          {{ u.activo ? 'Activo' : 'Inactivo' }}
                        </span>
                      </td>
                      <td>{{ u.fecha_creacion | date: 'dd/MM/yyyy' }}</td>
                      <td>
                        <button (click)="abrirEdicion(u)" class="btn-outline btn-sm">Editar</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Modal alta / edición -->
    @if (modalAbierto()) {
      <div class="modal-backdrop" (click)="cerrar()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">
              {{ esEdicion() ? 'Editar usuario' : 'Nuevo usuario' }}
            </h3>
            <button (click)="cerrar()" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>

          <div class="modal-body space-y-4">
            <div>
              <label class="form-label">Nombre de usuario <span class="text-danger-600">*</span></label>
              <input type="text" class="form-input" [(ngModel)]="modelo.username"
                     [disabled]="esEdicion()" autocomplete="off"
                     placeholder="jperez" />
              @if (esEdicion()) {
                <p class="text-xs text-neutral-400 mt-1">
                  El nombre de usuario no se puede cambiar: identifica al usuario en los registros.
                </p>
              } @else {
                <p class="text-xs text-neutral-400 mt-1">
                  Mínimo 3 caracteres. Solo letras, números, punto, guion y guion bajo.
                </p>
              }
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">Nombre</label>
                <input type="text" class="form-input" [(ngModel)]="modelo.nombre" />
              </div>
              <div>
                <label class="form-label">Apellido</label>
                <input type="text" class="form-input" [(ngModel)]="modelo.apellido" />
              </div>
            </div>

            <div>
              <label class="form-label">Correo electrónico <span class="text-danger-600">*</span></label>
              <input type="email" class="form-input" [(ngModel)]="modelo.email" autocomplete="off" />
            </div>

            <div>
              <label class="form-label">
                Contraseña
                @if (!esEdicion()) { <span class="text-danger-600">*</span> }
              </label>
              <input type="password" class="form-input" [(ngModel)]="modelo.password"
                     autocomplete="new-password"
                     [placeholder]="esEdicion() ? 'Dejar vacío para no cambiarla' : 'Mínimo 8 caracteres'" />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">Rol</label>
                <select class="form-select" [(ngModel)]="modelo.rol">
                  <option value="usuario">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
                <p class="text-xs text-neutral-400 mt-1">
                  El administrador además configura el correo y gestiona usuarios.
                </p>
              </div>
              <div class="flex items-end pb-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="modelo.activo" />
                  <span class="text-sm text-neutral-700">Cuenta activa</span>
                </label>
              </div>
            </div>

            @if (error()) {
              <div class="alert-danger">{{ error() }}</div>
            }
          </div>

          <div class="modal-footer">
            <button (click)="cerrar()" class="btn-secondary" [disabled]="guardando()">Cancelar</button>
            <button (click)="guardar()" class="btn-primary" [disabled]="guardando()">
              {{ guardando() ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class UsuariosComponent implements OnInit {
  private service = inject(UsuarioService);
  private notification = inject(NotificationService);
  private auth = inject(AuthService);

  usuarios = signal<Usuario[]>([]);
  cargando = signal(true);
  modalAbierto = signal(false);
  guardando = signal(false);
  error = signal('');
  /** id del usuario en edición; null = alta */
  editando = signal<number | null>(null);
  esEdicion = computed(() => this.editando() !== null);

  modelo = this.modeloVacio();

  usuarioActualId = () => this.auth.user()?.id ?? null;

  ngOnInit(): void {
    this.cargar();
  }

  private modeloVacio() {
    return {
      username: '',
      email: '',
      password: '',
      nombre: '',
      apellido: '',
      rol: 'usuario' as RolUsuario,
      activo: true,
    };
  }

  cargar(): void {
    this.cargando.set(true);
    this.service.list().subscribe({
      next: (res) => {
        this.usuarios.set(res.usuarios);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.notification.error('No se pudo cargar la lista de usuarios');
      },
    });
  }

  abrirNuevo(): void {
    this.modelo = this.modeloVacio();
    this.editando.set(null);
    this.error.set('');
    this.modalAbierto.set(true);
  }

  abrirEdicion(u: Usuario): void {
    this.modelo = {
      username: u.username,
      email: u.email,
      password: '',
      nombre: u.nombre ?? '',
      apellido: u.apellido ?? '',
      rol: u.rol,
      activo: u.activo,
    };
    this.editando.set(u.id);
    this.error.set('');
    this.modalAbierto.set(true);
  }

  cerrar(): void {
    if (this.guardando()) return;
    this.modalAbierto.set(false);
  }

  private validar(): string | null {
    if (!this.editando()) {
      if (this.modelo.username.trim().length < 3) return 'El nombre de usuario debe tener al menos 3 caracteres';
      if (!/^[A-Za-z0-9._-]+$/.test(this.modelo.username.trim())) {
        return 'El nombre de usuario solo admite letras, números, punto, guion y guion bajo';
      }
      if (!this.modelo.password) return 'Indique una contraseña';
    }
    if (!this.modelo.email.trim()) return 'Indique el correo electrónico';
    if (this.modelo.password && this.modelo.password.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }
    return null;
  }

  guardar(): void {
    const invalido = this.validar();
    if (invalido) {
      this.error.set(invalido);
      return;
    }

    this.error.set('');
    this.guardando.set(true);

    const id = this.editando();
    const base = {
      email: this.modelo.email.trim(),
      nombre: this.modelo.nombre.trim() || null,
      apellido: this.modelo.apellido.trim() || null,
      rol: this.modelo.rol,
      activo: this.modelo.activo,
    };

    const peticion = id
      ? this.service.update(id, { ...base, password: this.modelo.password || null })
      : this.service.create({
          ...base,
          username: this.modelo.username.trim(),
          password: this.modelo.password,
        });

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalAbierto.set(false);
        this.notification.success(id ? 'Usuario actualizado' : 'Usuario creado');
        this.cargar();
        // El propio admin pudo cambiar su rol o sus datos: refresca la sesión.
        if (id && id === this.usuarioActualId()) this.auth.loadProfile();
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(this.mensajeError(err));
      },
    });
  }

  /** FastAPI devuelve `detail` como texto, o como lista en los errores 422. */
  private mensajeError(err: unknown): string {
    const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const primero = detail[0] as { msg?: string };
      if (primero?.msg) return primero.msg;
    }
    return 'No se pudo guardar el usuario';
  }
}
