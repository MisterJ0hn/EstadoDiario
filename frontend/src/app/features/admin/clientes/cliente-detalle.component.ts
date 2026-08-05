import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Cliente, ClienteInbox, ClienteInboxUpdate } from '@core/models/admin.model';
import { RolUsuario, Usuario } from '@core/models/usuario.model';
import { NotificationService } from '@core/services/notification.service';
import { formatearRut } from '@core/utils/rut';
import { AdminClienteService } from '../services/admin-cliente.service';

type Seccion = 'datos' | 'inbox' | 'usuarios';

@Component({
  selector: 'app-cliente-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Encabezado -->
      <div class="flex items-start justify-between flex-wrap gap-3">
        <div class="min-w-0">
          <a routerLink="/admin/clientes"
             class="text-sm text-neutral-500 hover:text-primary-700 hover:underline inline-flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Clientes
          </a>
          <h1 class="text-2xl font-bold text-neutral-800 mt-1 break-words">
            {{ cliente()?.nombre || 'Ficha del cliente' }}
          </h1>
          <p class="text-neutral-500 mt-1">
            @if (cliente(); as c) {
              RUT {{ rutBonito(c.rut) }} · cliente desde el {{ c.fecha_creacion | date: 'dd-MM-yyyy' }}
            } @else {
              Datos, casilla de ingesta y usuarios del estudio
            }
          </p>
        </div>
        @if (cliente(); as c) {
          <span [class]="claseEstado(c) + ' shrink-0'">{{ textoEstado(c) }}</span>
        }
      </div>

      @if (errorCliente()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudo cargar la ficha del cliente.</p>
            <p class="text-sm mt-1">{{ errorCliente() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargarCliente()">Reintentar</button>
        </div>
      } @else if (!cliente()) {
        <div class="card animate-pulse">
          <div class="card-body space-y-3">
            <div class="h-3 w-40 bg-neutral-200 rounded"></div>
            <div class="h-64 bg-neutral-100 rounded"></div>
          </div>
        </div>
      } @else {
        @if (cliente(); as c) {
        <!-- La base de datos aún no existe: el resto de la ficha no tiene
             dónde escribir, así que se dice y se ofrece la salida. -->
        @if (c.aprovisionamiento === 'error') {
          <div class="alert-danger">
            <svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div class="flex-1">
              <p class="font-medium">La base de datos de este cliente no se creó</p>
              <p class="mt-0.5">
                {{ c.aprovisionamiento_detalle || 'El servidor no entregó un detalle del error.' }}
                Mientras tanto no se pueden crear usuarios ni importar archivos.
              </p>
            </div>
            <button type="button" class="btn-danger btn-sm shrink-0" (click)="reintentar()" [disabled]="guardando()">
              {{ guardando() ? 'Reintentando...' : 'Reintentar creación' }}
            </button>
          </div>
        } @else if (c.aprovisionamiento !== 'listo') {
          <div class="alert-info">
            <svg class="animate-spin w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div class="flex-1">
              Se está creando la base de datos de este cliente. Puede tardar algunos minutos;
              hasta que termine, sus usuarios no pueden ingresar.
            </div>
            <button type="button" class="btn-secondary btn-sm shrink-0" (click)="cargarCliente()">Actualizar</button>
          </div>
        } @else if (!c.activo) {
          <!-- Suspensión: es un estado, no una pérdida. Va en tono informativo
               y no de advertencia, y dice explícitamente que se revierte. -->
          <div class="alert-info">
            <svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="flex-1">
              <p class="font-medium">Este cliente está suspendido</p>
              <p class="mt-0.5">
                Sus usuarios no pueden iniciar sesión, la ingesta automática por correo lo salta y
                no se envían sus recordatorios ni informes. Toda su información se conserva: al
                reactivarlo vuelve a operar con los datos intactos.
              </p>
            </div>
          </div>
        }

        <!-- Secciones -->
        <div class="border-b border-neutral-200">
          <nav class="tabs-nav" role="tablist" aria-label="Secciones del cliente">
            @for (s of secciones; track s.clave) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="seccion() === s.clave"
                (click)="seccion.set(s.clave)"
                class="tab-link"
                [class.tab-link-activo]="seccion() === s.clave"
              >
                {{ s.etiqueta }}
                @if (s.clave === 'usuarios' && usuarios().length > 0) {
                  <span class="tab-contador">{{ usuarios().length }}</span>
                }
              </button>
            }
          </nav>
        </div>

        <!-- ── Datos ──────────────────────────────────────────────── -->
        @if (seccion() === 'datos') {
          <div class="card max-w-3xl">
            <div class="card-body space-y-5">
              <div>
                <label class="form-label" for="nombre">Nombre del estudio</label>
                <input id="nombre" type="text" class="form-input" [(ngModel)]="datos.nombre" />
              </div>

              <div>
                <label class="form-label" for="correo">Correo de contacto</label>
                <input id="correo" type="email" class="form-input" [(ngModel)]="datos.correo" />
                <p class="text-xs text-neutral-500 mt-1">
                  Para avisos administrativos. No recibe los estados diarios.
                </p>
              </div>

              <hr class="border-neutral-200" />

              <!-- Identificadores: se muestran porque el administrador los
                   necesita para soporte, pero no se editan: cambiarlos
                   dejaría la base de datos huérfana. -->
              <dl class="rounded-lg border border-neutral-200 divide-y divide-neutral-200 text-sm">
                <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <dt class="text-neutral-500">RUT</dt>
                  <dd class="font-medium text-neutral-800 tabular-nums">{{ rutBonito(c.rut) }}</dd>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <dt class="text-neutral-500">Identificador (guid)</dt>
                  <dd class="flex items-center gap-2 min-w-0">
                    <code class="text-xs text-neutral-700 break-all">{{ c.guid }}</code>
                    <button type="button" class="btn-secondary btn-sm shrink-0" (click)="copiar(c.guid)"
                            [attr.aria-label]="'Copiar el identificador ' + c.guid">Copiar</button>
                  </dd>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <dt class="text-neutral-500">Base de datos</dt>
                  <dd><span [class]="claseAprovisionamiento(c)">{{ textoAprovisionamiento(c) }}</span></dd>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <dt class="text-neutral-500">Creado el</dt>
                  <dd class="text-neutral-800">{{ c.fecha_creacion | date: 'dd-MM-yyyy HH:mm' }}</dd>
                </div>
              </dl>

              <div class="flex flex-wrap items-center justify-end gap-3 pt-2">
                <p class="text-xs text-neutral-500 mr-auto">
                  El RUT y el identificador no se pueden cambiar: son la llave de la base de datos.
                </p>
                <button type="button" class="btn-primary" (click)="guardarDatos()" [disabled]="guardando()">
                  {{ guardando() ? 'Guardando...' : 'Guardar cambios' }}
                </button>
              </div>
            </div>
          </div>
        }

        <!-- ── Casilla de ingesta ─────────────────────────────────── -->
        @if (seccion() === 'inbox') {
          @if (errorInbox()) {
            <div class="alert-danger">
              <div class="flex-1">
                <p class="font-medium">No se pudo cargar la casilla de este cliente.</p>
                <p class="text-sm mt-1">{{ errorInbox() }}</p>
              </div>
              <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargarInbox()">Reintentar</button>
            </div>
          } @else if (!inbox()) {
            <div class="card max-w-3xl animate-pulse">
              <div class="card-body h-64 bg-neutral-100 rounded-b-xl"></div>
            </div>
          } @else {
            @if (inbox(); as box) {
            <div class="card max-w-3xl">
              <div class="card-body space-y-5">
                <div class="alert-info">
                  <div class="flex-1">
                    <p class="font-medium">Casilla del sistema</p>
                    <p class="mt-0.5">
                      El estudio reenvía los correos del Poder Judicial a esta dirección y la
                      plataforma importa los archivos sola.
                    </p>
                    <div class="flex flex-wrap items-center gap-2 mt-2">
                      <code class="text-sm font-medium break-all">{{ box.direccion_por_defecto }}</code>
                      <button type="button" class="btn-secondary btn-sm"
                              (click)="copiar(box.direccion_por_defecto)"
                              [attr.aria-label]="'Copiar la dirección ' + box.direccion_por_defecto">
                        Copiar
                      </button>
                    </div>
                  </div>
                </div>

                <label class="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" class="mt-1" [(ngModel)]="inboxModelo.usar_casilla_propia" />
                  <span>
                    <span class="font-medium text-neutral-800">Leer desde una casilla propia del estudio</span>
                    <span class="block text-sm text-neutral-500">
                      Solo si el estudio prefiere no reenviar y entregar el acceso a su propio buzón.
                      La plataforma se conecta por IMAP y deja los correos donde están.
                    </span>
                  </span>
                </label>

                @if (inboxModelo.usar_casilla_propia) {
                  <hr class="border-neutral-200" />

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="md:col-span-2">
                      <label class="form-label" for="imap-host">Servidor IMAP</label>
                      <input id="imap-host" type="text" class="form-input" [(ngModel)]="inboxModelo.host"
                             placeholder="imap.gmail.com" autocomplete="off" />
                    </div>
                    <div>
                      <label class="form-label" for="imap-puerto">Puerto</label>
                      <input id="imap-puerto" type="number" class="form-input" [(ngModel)]="inboxModelo.puerto" />
                    </div>
                  </div>

                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="inboxModelo.usar_ssl" />
                    <span class="text-sm text-neutral-700">Conexión SSL (puerto 993)</span>
                  </label>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="form-label" for="imap-usuario">Usuario</label>
                      <input id="imap-usuario" type="email" class="form-input" [(ngModel)]="inboxModelo.usuario"
                             placeholder="causas@estudio.cl" autocomplete="off" />
                    </div>
                    <div>
                      <label class="form-label" for="imap-password">
                        Contraseña
                        @if (box.tiene_password) {
                          <span class="text-xs font-normal text-accent-700">(hay una guardada)</span>
                        }
                      </label>
                      <input id="imap-password" type="password" class="form-input"
                             [(ngModel)]="inboxModelo.password" autocomplete="new-password"
                             [placeholder]="box.tiene_password ? 'Dejar vacío para no cambiarla' : 'Contraseña de aplicación'" />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="form-label" for="imap-carpeta">Carpeta</label>
                      <input id="imap-carpeta" type="text" class="form-input" [(ngModel)]="inboxModelo.carpeta"
                             placeholder="INBOX" autocomplete="off" />
                    </div>
                    <div>
                      <label class="form-label" for="imap-hora">Hora de revisión</label>
                      <input id="imap-hora" type="time" class="form-input" [(ngModel)]="inboxModelo.hora_ejecucion" />
                      <p class="text-xs text-neutral-500 mt-1">Vacío = se revisa varias veces al día.</p>
                    </div>
                  </div>

                  <div>
                    <label class="form-label" for="imap-remitentes">Remitentes permitidos</label>
                    <input id="imap-remitentes" type="text" class="form-input"
                           [(ngModel)]="inboxModelo.remitentes_permitidos"
                           placeholder="&#64;pjud.cl, notificaciones..." autocomplete="off" />
                    <p class="text-xs text-neutral-500 mt-1">
                      Separados por coma. Vacío = se acepta cualquier remitente.
                    </p>
                  </div>

                  <hr class="border-neutral-200" />

                  <div>
                    <p class="font-medium text-neutral-800">Identificación por asunto</p>
                    <p class="text-sm text-neutral-500 mt-0.5">
                      Con qué texto del asunto se reconoce cada reporte. Reemplaza al nombre del
                      archivo, que el Poder Judicial cambia sin aviso.
                    </p>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label class="form-label" for="asunto-ed">Estado diario</label>
                      <input id="asunto-ed" type="text" class="form-input"
                             [(ngModel)]="inboxModelo.asunto_estado_diario" autocomplete="off" />
                    </div>
                    <div>
                      <label class="form-label" for="asunto-mov">Movimientos</label>
                      <input id="asunto-mov" type="text" class="form-input"
                             [(ngModel)]="inboxModelo.asunto_movimientos" autocomplete="off" />
                    </div>
                    <div>
                      <label class="form-label" for="asunto-aud">Audiencias</label>
                      <input id="asunto-aud" type="text" class="form-input"
                             [(ngModel)]="inboxModelo.asunto_audiencias" autocomplete="off" />
                    </div>
                  </div>
                }

                @if (box.ultima_ejecucion) {
                  <div class="alert-info">
                    Última revisión: {{ box.ultima_ejecucion | date: 'dd-MM-yyyy HH:mm' }}
                    @if (box.ultimo_resultado) { — {{ box.ultimo_resultado }} }
                  </div>
                }

                @if (mensajeInbox()) {
                  <div [class]="inboxEsError() ? 'alert-danger' : 'alert-success'">{{ mensajeInbox() }}</div>
                }

                <div class="flex flex-wrap justify-end gap-3 pt-2">
                  @if (inboxModelo.usar_casilla_propia) {
                    <button type="button" class="btn-secondary" (click)="probarInbox()" [disabled]="ocupado()">
                      {{ probando() ? 'Probando...' : 'Probar conexión' }}
                    </button>
                  }
                  <button type="button" class="btn-primary" (click)="guardarInbox()" [disabled]="ocupado()">
                    {{ guardandoInbox() ? 'Guardando...' : 'Guardar casilla' }}
                  </button>
                </div>
              </div>
            </div>
            }
          }
        }

        <!-- ── Usuarios ───────────────────────────────────────────── -->
        @if (seccion() === 'usuarios') {
          <div class="card">
            <div class="card-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="font-semibold text-neutral-800">Usuarios de {{ c.nombre }}</h2>
                <p class="text-sm text-neutral-500">
                  Ingresan con el RUT {{ rutBonito(c.rut) }} más su usuario y contraseña
                </p>
              </div>
              <button type="button" class="btn-primary btn-sm" (click)="abrirNuevoUsuario()"
                      [disabled]="c.aprovisionamiento !== 'listo'">
                Nuevo usuario
              </button>
            </div>
            <div class="card-body">
              @if (c.aprovisionamiento !== 'listo') {
                <p class="text-neutral-600 py-8 text-center">
                  Los usuarios se pueden crear una vez que la base de datos del cliente esté lista.
                </p>
              } @else if (errorUsuarios()) {
                <div class="alert-danger">
                  <div class="flex-1">
                    <p class="font-medium">No se pudo cargar la lista de usuarios.</p>
                    <p class="text-sm mt-1">{{ errorUsuarios() }}</p>
                  </div>
                  <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargarUsuarios()">
                    Reintentar
                  </button>
                </div>
              } @else if (cargandoUsuarios()) {
                <div class="flex items-center justify-center py-16">
                  <svg class="animate-spin h-8 w-8 text-primary-600" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span class="sr-only">Cargando usuarios</span>
                </div>
              } @else if (usuarios().length === 0) {
                <div class="py-16 text-center">
                  <p class="text-neutral-600 font-medium">Este cliente todavía no tiene usuarios</p>
                  <p class="text-neutral-500 text-sm mt-1">
                    Cree al menos uno con rol de administrador: será quien gestione al resto del estudio.
                  </p>
                  <button type="button" class="btn-primary mt-4" (click)="abrirNuevoUsuario()">
                    Crear el primer usuario
                  </button>
                </div>
              } @else {
                <div class="table-wrapper">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Usuario</th>
                        <th scope="col">Nombre</th>
                        <th scope="col">Correo</th>
                        <th scope="col">Rol</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (u of usuarios(); track u.id) {
                        <tr>
                          <td class="font-medium">{{ u.username }}</td>
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
                          <td>
                            <button type="button" class="btn-outline btn-sm" (click)="abrirEdicionUsuario(u)">
                              Editar
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        }
        }
      }
    </div>

    <!-- Alta / edición de usuario del cliente -->
    @if (modalUsuario()) {
      <div class="modal-backdrop animar-fondo" (click)="cerrarUsuario()">
        <div class="modal-content" (click)="$event.stopPropagation()" role="dialog" aria-modal="true"
             aria-labelledby="titulo-usuario" (keydown.escape)="cerrarUsuario()" tabindex="-1">
          <div class="modal-header">
            <h3 id="titulo-usuario" class="text-lg font-semibold">
              {{ editandoUsuario() ? 'Editar usuario' : 'Nuevo usuario' }}
            </h3>
            <button type="button" (click)="cerrarUsuario()" class="text-neutral-400 hover:text-neutral-600"
                    aria-label="Cerrar">&times;</button>
          </div>

          <div class="modal-body space-y-4">
            <div>
              <label class="form-label" for="u-username">
                Nombre de usuario <span class="text-danger-600">*</span>
              </label>
              <input id="u-username" type="text" class="form-input" [(ngModel)]="usuarioModelo.username"
                     [disabled]="!!editandoUsuario()" placeholder="jperez" autocomplete="off" />
              <p class="text-xs text-neutral-500 mt-1">
                @if (editandoUsuario()) {
                  El nombre de usuario no se puede cambiar: identifica al usuario en los registros.
                } @else {
                  Mínimo 3 caracteres. Solo letras, números, punto, guion y guion bajo.
                }
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label" for="u-nombre">Nombre</label>
                <input id="u-nombre" type="text" class="form-input" [(ngModel)]="usuarioModelo.nombre" />
              </div>
              <div>
                <label class="form-label" for="u-apellido">Apellido</label>
                <input id="u-apellido" type="text" class="form-input" [(ngModel)]="usuarioModelo.apellido" />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label" for="u-email">
                  Correo electrónico <span class="text-danger-600">*</span>
                </label>
                <input id="u-email" type="email" class="form-input" [(ngModel)]="usuarioModelo.email"
                       autocomplete="off" />
              </div>
              <div>
                <label class="form-label" for="u-telefono">Teléfono</label>
                <input id="u-telefono" type="text" class="form-input" [(ngModel)]="usuarioModelo.telefono"
                       placeholder="+56912345678" autocomplete="off" />
                <p class="text-xs text-neutral-500 mt-1">Para los recordatorios por WhatsApp.</p>
              </div>
            </div>

            <div>
              <label class="form-label" for="u-password">
                Contraseña
                @if (!editandoUsuario()) { <span class="text-danger-600">*</span> }
              </label>
              <input id="u-password" type="password" class="form-input" [(ngModel)]="usuarioModelo.password"
                     autocomplete="new-password"
                     [placeholder]="editandoUsuario() ? 'Dejar vacío para no cambiarla' : 'Mínimo 8 caracteres'" />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label" for="u-rol">Rol</label>
                <select id="u-rol" class="form-select" [(ngModel)]="usuarioModelo.rol">
                  <option value="usuario">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
                <p class="text-xs text-neutral-500 mt-1">
                  El administrador del estudio gestiona los usuarios de su propio cliente.
                </p>
              </div>
              <div class="flex items-end pb-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="usuarioModelo.activo" />
                  <span class="text-sm text-neutral-700">Cuenta activa</span>
                </label>
              </div>
            </div>

            @if (errorUsuario()) {
              <div class="alert-danger">{{ errorUsuario() }}</div>
            }
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="cerrarUsuario()" [disabled]="guardandoUsuario()">
              Cancelar
            </button>
            <button type="button" class="btn-primary" (click)="guardarUsuario()" [disabled]="guardandoUsuario()">
              {{ guardandoUsuario() ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ClienteDetalleComponent implements OnInit {
  private service = inject(AdminClienteService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);

  readonly secciones: { clave: Seccion; etiqueta: string }[] = [
    { clave: 'datos', etiqueta: 'Datos del cliente' },
    { clave: 'inbox', etiqueta: 'Casilla de ingesta' },
    { clave: 'usuarios', etiqueta: 'Usuarios' },
  ];

  clienteId = 0;
  seccion = signal<Seccion>('datos');

  cliente = signal<Cliente | null>(null);
  errorCliente = signal<string | null>(null);
  guardando = signal(false);
  datos = { nombre: '', correo: '' };

  inbox = signal<ClienteInbox | null>(null);
  errorInbox = signal<string | null>(null);
  guardandoInbox = signal(false);
  probando = signal(false);
  mensajeInbox = signal('');
  inboxEsError = signal(false);
  inboxModelo: ClienteInboxUpdate = this.inboxVacio();

  usuarios = signal<Usuario[]>([]);
  cargandoUsuarios = signal(false);
  errorUsuarios = signal<string | null>(null);
  modalUsuario = signal(false);
  guardandoUsuario = signal(false);
  errorUsuario = signal('');
  editandoUsuario = signal<number | null>(null);
  usuarioModelo = this.usuarioVacio();

  ocupado = computed(() => this.guardandoInbox() || this.probando());

  ngOnInit(): void {
    this.clienteId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
    this.cargarCliente();
    this.cargarInbox();
    this.cargarUsuarios();
  }

  // ── Cliente ────────────────────────────────────────────────────────────

  cargarCliente(): void {
    this.errorCliente.set(null);
    this.service.get(this.clienteId).subscribe({
      next: (c) => {
        this.cliente.set(c);
        this.datos = { nombre: c.nombre, correo: c.correo };
      },
      error: (e) => this.errorCliente.set(this.mensajeError(e)),
    });
  }

  guardarDatos(): void {
    const actual = this.cliente();
    if (!actual) return;
    if (this.datos.nombre.trim().length < 3) {
      this.notification.error('Indique el nombre del estudio');
      return;
    }

    this.guardando.set(true);
    this.service
      .update(this.clienteId, {
        nombre: this.datos.nombre.trim(),
        correo: this.datos.correo.trim(),
        activo: actual.activo,
      })
      .subscribe({
        next: (c) => {
          this.guardando.set(false);
          this.cliente.set(c);
          this.notification.success('Datos del cliente guardados');
        },
        error: (e) => {
          this.guardando.set(false);
          this.notification.error(this.mensajeError(e));
        },
      });
  }

  reintentar(): void {
    this.guardando.set(true);
    this.service.reintentarAprovisionamiento(this.clienteId).subscribe({
      next: () => {
        this.guardando.set(false);
        this.notification.info('Se volvió a pedir la creación de la base de datos.');
        this.cargarCliente();
      },
      error: (e) => {
        this.guardando.set(false);
        this.notification.error(this.mensajeError(e));
      },
    });
  }

  // ── Casilla ────────────────────────────────────────────────────────────

  private inboxVacio(): ClienteInboxUpdate {
    return {
      usar_casilla_propia: false,
      host: 'imap.gmail.com',
      puerto: 993,
      usar_ssl: true,
      usuario: '',
      password: '',
      carpeta: 'INBOX',
      remitentes_permitidos: '',
      asunto_estado_diario: '',
      asunto_movimientos: '',
      asunto_audiencias: '',
      hora_ejecucion: '',
    };
  }

  cargarInbox(): void {
    this.errorInbox.set(null);
    this.service.getInbox(this.clienteId).subscribe({
      next: (box) => {
        this.inbox.set(box);
        this.inboxModelo = {
          usar_casilla_propia: box.usar_casilla_propia,
          host: box.host,
          puerto: box.puerto,
          usar_ssl: box.usar_ssl,
          usuario: box.usuario ?? '',
          // La contraseña nunca vuelve del backend: vacío = no cambiarla.
          password: '',
          carpeta: box.carpeta,
          remitentes_permitidos: box.remitentes_permitidos ?? '',
          asunto_estado_diario: box.asunto_estado_diario ?? '',
          asunto_movimientos: box.asunto_movimientos ?? '',
          asunto_audiencias: box.asunto_audiencias ?? '',
          hora_ejecucion: box.hora_ejecucion ?? '',
        };
      },
      error: (e) => this.errorInbox.set(this.mensajeError(e)),
    });
  }

  private inboxPayload(): ClienteInboxUpdate {
    return {
      ...this.inboxModelo,
      usuario: this.inboxModelo.usuario || null,
      password: this.inboxModelo.password || null,
      remitentes_permitidos: this.inboxModelo.remitentes_permitidos || null,
      asunto_estado_diario: this.inboxModelo.asunto_estado_diario || null,
      asunto_movimientos: this.inboxModelo.asunto_movimientos || null,
      asunto_audiencias: this.inboxModelo.asunto_audiencias || null,
      hora_ejecucion: this.inboxModelo.hora_ejecucion || null,
    };
  }

  guardarInbox(): void {
    const box = this.inbox();
    if (this.inboxModelo.usar_casilla_propia) {
      if (!this.inboxModelo.host) {
        this.mostrarMensajeInbox('Indique el servidor IMAP', true);
        return;
      }
      if (!this.inboxModelo.usuario) {
        this.mostrarMensajeInbox('Indique el usuario de la casilla', true);
        return;
      }
      if (!this.inboxModelo.password && !box?.tiene_password) {
        this.mostrarMensajeInbox('Indique la contraseña de la casilla', true);
        return;
      }
    }

    this.mensajeInbox.set('');
    this.guardandoInbox.set(true);

    this.service.saveInbox(this.clienteId, this.inboxPayload()).subscribe({
      next: (actualizado) => {
        this.guardandoInbox.set(false);
        this.inbox.set(actualizado);
        this.inboxModelo.password = '';
        this.notification.success('Casilla de ingesta guardada');
      },
      error: (e) => {
        this.guardandoInbox.set(false);
        this.mostrarMensajeInbox(this.mensajeError(e), true);
      },
    });
  }

  probarInbox(): void {
    this.mensajeInbox.set('');
    this.probando.set(true);

    this.service.probarInbox(this.clienteId, this.inboxPayload()).subscribe({
      next: (res) => {
        this.probando.set(false);
        this.mostrarMensajeInbox(res.mensaje, !res.exito);
      },
      error: (e) => {
        this.probando.set(false);
        this.mostrarMensajeInbox(this.mensajeError(e), true);
      },
    });
  }

  private mostrarMensajeInbox(texto: string, esError: boolean): void {
    this.mensajeInbox.set(texto);
    this.inboxEsError.set(esError);
  }

  // ── Usuarios ───────────────────────────────────────────────────────────

  private usuarioVacio() {
    return {
      username: '',
      email: '',
      password: '',
      nombre: '',
      apellido: '',
      telefono: '',
      rol: 'usuario' as RolUsuario,
      activo: true,
    };
  }

  cargarUsuarios(): void {
    this.cargandoUsuarios.set(true);
    this.errorUsuarios.set(null);
    this.service.listUsuarios(this.clienteId).subscribe({
      next: (res) => {
        this.usuarios.set(res.usuarios);
        this.cargandoUsuarios.set(false);
      },
      error: (e) => {
        this.cargandoUsuarios.set(false);
        this.errorUsuarios.set(this.mensajeError(e));
      },
    });
  }

  abrirNuevoUsuario(): void {
    this.usuarioModelo = this.usuarioVacio();
    // El primer usuario del estudio tiene que poder administrar al resto.
    if (this.usuarios().length === 0) this.usuarioModelo.rol = 'admin';
    this.editandoUsuario.set(null);
    this.errorUsuario.set('');
    this.modalUsuario.set(true);
  }

  abrirEdicionUsuario(u: Usuario): void {
    this.usuarioModelo = {
      username: u.username,
      email: u.email,
      password: '',
      nombre: u.nombre ?? '',
      apellido: u.apellido ?? '',
      telefono: u.telefono ?? '',
      rol: u.rol,
      activo: u.activo,
    };
    this.editandoUsuario.set(u.id);
    this.errorUsuario.set('');
    this.modalUsuario.set(true);
  }

  cerrarUsuario(): void {
    if (this.guardandoUsuario()) return;
    this.modalUsuario.set(false);
  }

  private validarUsuario(): string | null {
    if (!this.editandoUsuario()) {
      if (this.usuarioModelo.username.trim().length < 3) {
        return 'El nombre de usuario debe tener al menos 3 caracteres';
      }
      if (!/^[A-Za-z0-9._-]+$/.test(this.usuarioModelo.username.trim())) {
        return 'El nombre de usuario solo admite letras, números, punto, guion y guion bajo';
      }
      if (!this.usuarioModelo.password) return 'Indique una contraseña';
    }
    if (!this.usuarioModelo.email.trim()) return 'Indique el correo electrónico';
    if (this.usuarioModelo.password && this.usuarioModelo.password.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }
    return null;
  }

  guardarUsuario(): void {
    const invalido = this.validarUsuario();
    if (invalido) {
      this.errorUsuario.set(invalido);
      return;
    }

    this.errorUsuario.set('');
    this.guardandoUsuario.set(true);

    const id = this.editandoUsuario();
    const base = {
      email: this.usuarioModelo.email.trim(),
      nombre: this.usuarioModelo.nombre.trim() || null,
      apellido: this.usuarioModelo.apellido.trim() || null,
      telefono: this.usuarioModelo.telefono.trim() || null,
      rol: this.usuarioModelo.rol,
      activo: this.usuarioModelo.activo,
    };

    const peticion = id
      ? this.service.updateUsuario(this.clienteId, id, {
          ...base,
          password: this.usuarioModelo.password || null,
        })
      : this.service.createUsuario(this.clienteId, {
          ...base,
          username: this.usuarioModelo.username.trim(),
          password: this.usuarioModelo.password,
        });

    peticion.subscribe({
      next: () => {
        this.guardandoUsuario.set(false);
        this.modalUsuario.set(false);
        this.notification.success(id ? 'Usuario actualizado' : 'Usuario creado');
        this.cargarUsuarios();
      },
      error: (e) => {
        this.guardandoUsuario.set(false);
        this.errorUsuario.set(this.mensajeError(e));
      },
    });
  }

  // ── Presentación ───────────────────────────────────────────────────────

  rutBonito(rut: string): string {
    return formatearRut(rut);
  }

  textoEstado(c: Cliente): string {
    if (c.aprovisionamiento === 'error') return 'Base de datos con error';
    if (c.aprovisionamiento !== 'listo') return 'Creando base de datos';
    return c.activo ? 'Activo' : 'Suspendido';
  }

  claseEstado(c: Cliente): string {
    if (c.aprovisionamiento === 'error') return 'badge-danger';
    if (c.aprovisionamiento !== 'listo') return 'badge-info';
    return c.activo ? 'badge-success' : 'badge-neutral';
  }

  textoAprovisionamiento(c: Cliente): string {
    const mapa = {
      en_cola: 'En cola',
      creando: 'Creándose',
      listo: 'Operativa',
      error: 'Con error',
    };
    return mapa[c.aprovisionamiento];
  }

  claseAprovisionamiento(c: Cliente): string {
    if (c.aprovisionamiento === 'error') return 'badge-danger';
    if (c.aprovisionamiento === 'listo') return 'badge-success';
    return 'badge-info';
  }

  copiar(texto: string): void {
    navigator.clipboard?.writeText(texto).then(
      () => this.notification.success('Copiado al portapapeles'),
      () => this.notification.error('El navegador no permitió copiar. Selecciónelo a mano.')
    );
  }

  /** FastAPI devuelve `detail` como texto, o como lista en los errores 422. */
  private mensajeError(err: unknown): string {
    const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const primero = detail[0] as { msg?: string };
      if (primero?.msg) return primero.msg;
    }
    return 'No se pudo completar la operación. Intente de nuevo.';
  }
}
