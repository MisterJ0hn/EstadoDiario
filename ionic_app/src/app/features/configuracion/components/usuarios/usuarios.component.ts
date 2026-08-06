import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuarioService } from '../../services/usuario.service';
import { NotificationService } from '@core/services/notification.service';
import { JurisdiccionOpcion, PermisosUsuario } from '@core/models/usuario.model';

/**
 * Qué ve cada usuario del estudio.
 *
 * No es un ABM: las cuentas las crea la plataforma. Acá el administrador del
 * estudio reparte visibilidad por jurisdicción, que es el único permiso que
 * existe por ahora.
 *
 * La regla que la pantalla tiene que dejar clarísima: **sin nada marcado, la
 * persona ve todas las jurisdicciones.** Es lo contrario de lo que uno espera
 * de una lista de casillas vacías, así que se dice con todas las letras en
 * cada fila y en el modal, en vez de confiar en que se deduzca.
 */
@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Usuarios y permisos</h1>
        <p class="text-neutral-500 mt-1">
          Defina qué jurisdicciones puede ver cada integrante del estudio
        </p>
      </div>

      <div class="alert-info">
        <div class="flex-1">
          Las cuentas de acceso las administra Temposoft. Si necesita agregar o dar de baja a
          alguien, solicítelo al administrador del sistema.
        </div>
      </div>

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudo cargar la lista de usuarios.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">
            Reintentar
          </button>
        </div>
      }

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
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Jurisdicciones que ve</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (u of usuarios(); track u.usuario_id) {
                    <tr>
                      <td class="font-medium">{{ u.username }}</td>
                      <td>{{ u.nombre_completo }}</td>
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
                      <td>
                        @if (u.rol === 'admin') {
                          <span class="text-neutral-500">Todas (es administrador)</span>
                        } @else if (u.jurisdicciones.length === 0) {
                          <span class="text-neutral-500">Todas</span>
                        } @else {
                          <span class="flex flex-wrap gap-1">
                            @for (id of u.jurisdicciones; track id) {
                              <span class="badge-neutral">{{ nombreDe(id) }}</span>
                            }
                          </span>
                        }
                      </td>
                      <td>
                        @if (u.rol === 'admin') {
                          <span class="text-xs text-neutral-400">No aplica</span>
                        } @else {
                          <button type="button" class="btn-secondary btn-sm" (click)="abrir(u)">
                            Editar permisos
                          </button>
                        }
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

    @if (editando(); as u) {
      <div class="modal-backdrop animar-fondo" (click)="cerrar()">
        <div
          class="modal-content"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-permisos"
          (keydown.escape)="cerrar()"
          tabindex="-1"
        >
          <div class="modal-header">
            <h3 id="titulo-permisos" class="text-lg font-semibold">
              Permisos de {{ u.nombre_completo || u.username }}
            </h3>
            <button
              type="button"
              (click)="cerrar()"
              class="text-neutral-400 hover:text-neutral-600"
              aria-label="Cerrar"
            >
              &times;
            </button>
          </div>

          <div class="modal-body space-y-4">
            <p class="text-sm text-neutral-700">
              Marque las jurisdicciones cuyas causas puede ver. El resto no le aparecerán en
              ninguna pantalla ni en sus informes.
            </p>

            <div class="rounded-lg border border-neutral-200 divide-y divide-neutral-200">
              @for (j of jurisdicciones(); track j.id) {
                <label class="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    class="form-checkbox"
                    [checked]="seleccion().includes(j.id)"
                    (change)="alternar(j.id)"
                  />
                  <span class="text-sm text-neutral-800">{{ j.nombre }}</span>
                </label>
              }
            </div>

            <!-- El caso que se malinterpreta: nada marcado NO es "no ve nada". -->
            @if (seleccion().length === 0) {
              <div class="alert-info">
                <div class="flex-1">
                  Sin nada marcado, <strong>{{ u.username }} verá todas las jurisdicciones</strong>.
                  Para restringir el acceso, marque las que sí puede ver. Si lo que quiere es que
                  no entre al sistema, pida que se desactive su cuenta.
                </div>
              </div>
            }
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="cerrar()" [disabled]="guardando()">
              Cancelar
            </button>
            <button type="button" class="btn-primary" (click)="guardar()" [disabled]="guardando()">
              {{ guardando() ? 'Guardando...' : 'Guardar permisos' }}
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

  usuarios = signal<PermisosUsuario[]>([]);
  jurisdicciones = signal<JurisdiccionOpcion[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  editando = signal<PermisosUsuario | null>(null);
  seleccion = signal<number[]>([]);
  guardando = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.permisos().subscribe({
      next: (res) => {
        this.usuarios.set(res.usuarios);
        this.jurisdicciones.set(res.jurisdicciones);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(this.mensajeError(e));
      },
    });
  }

  nombreDe(id: number): string {
    return this.jurisdicciones().find((j) => j.id === id)?.nombre ?? `#${id}`;
  }

  abrir(u: PermisosUsuario): void {
    this.editando.set(u);
    // Copia: si cancela, la fila de la tabla no queda modificada a medias.
    this.seleccion.set([...u.jurisdicciones]);
  }

  cerrar(): void {
    this.editando.set(null);
  }

  alternar(id: number): void {
    this.seleccion.update((actual) =>
      actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]
    );
  }

  guardar(): void {
    const u = this.editando();
    if (!u) return;

    this.guardando.set(true);
    this.service.guardarPermisos(u.usuario_id, this.seleccion()).subscribe({
      next: (actualizado) => {
        this.guardando.set(false);
        this.cerrar();
        this.usuarios.update((lista) =>
          lista.map((x) => (x.usuario_id === actualizado.usuario_id ? actualizado : x))
        );
        this.notification.success(
          actualizado.jurisdicciones.length === 0
            ? `${actualizado.username} ve todas las jurisdicciones`
            : `Permisos de ${actualizado.username} actualizados`
        );
      },
      error: (e) => {
        this.guardando.set(false);
        this.notification.error(this.mensajeError(e));
      },
    });
  }

  private mensajeError(err: unknown): string {
    const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
    if (typeof detail === 'string') return detail;
    return 'No se pudo completar la operación. Intente de nuevo.';
  }
}
