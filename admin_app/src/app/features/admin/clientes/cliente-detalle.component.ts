import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Cliente, ClienteInbox, ClienteInboxUpdate } from '@core/models/admin.model';
import { Usuario } from '@core/models/usuario.model';
import { NotificationService } from '@core/services/notification.service';
import { passwordCumplePolitica, reglasPassword } from '@core/utils/password';
import { formatearRut, rutPlano, rutValido } from '@core/utils/rut';
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
          <a routerLink="/clientes"
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
              Datos, correo PJUD y usuarios del estudio
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
                <label class="form-label" for="rut">RUT</label>
                <input id="rut" type="text" class="form-input tabular-nums" [(ngModel)]="datos.rut"
                       placeholder="76.543.210-K" />
                <p class="text-xs text-warning-700 mt-1">
                  Es la credencial con la que entra el estudio. Si lo cambia, todos sus usuarios
                  deben iniciar sesión con el RUT nuevo desde ese momento.
                </p>
              </div>

              <div>
                <label class="form-label" for="correo">Correo de contacto</label>
                <input id="correo" type="email" class="form-input" [(ngModel)]="datos.correo" />
                <p class="text-xs text-neutral-500 mt-1">
                  Para avisos administrativos. No recibe los estados diarios.
                </p>
              </div>

              <!-- Logo: se guarda al elegir el archivo, no con el botón de
                   abajo. Es su propio endpoint, y mezclarlo con el resto haría
                   que cambiar el nombre del estudio subiera la imagen de
                   nuevo. -->
              <div>
                <span class="form-label">Logo del estudio</span>
                <div class="flex items-center gap-4 mt-1">
                  <div
                    class="flex h-16 w-32 shrink-0 items-center justify-center rounded-lg border
                           border-dashed border-neutral-300 bg-neutral-50 overflow-hidden"
                  >
                    @if (cliente()?.logo; as src) {
                      <img [src]="src" alt="Logo actual" class="max-h-14 max-w-28 object-contain" />
                    } @else {
                      <span class="text-xs text-neutral-400">Sin logo</span>
                    }
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap gap-2">
                      <label class="btn-secondary btn-sm cursor-pointer mb-0">
                        {{ cliente()?.logo ? 'Cambiar' : 'Subir imagen' }}
                        <input
                          type="file"
                          class="hidden"
                          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                          (change)="elegirLogo($event)"
                        />
                      </label>
                      @if (cliente()?.logo) {
                        <button type="button" class="btn-danger btn-sm" [disabled]="subiendoLogo()"
                                (click)="quitarLogo()">
                          Quitar
                        </button>
                      }
                    </div>
                    <p class="text-xs text-neutral-500 mt-1">
                      @if (subiendoLogo()) {
                        Guardando...
                      } @else {
                        PNG, JPG, GIF, WEBP o SVG, hasta 300 KB. Se ve en la barra lateral del
                        estudio y encabeza los correos que le envía el sistema.
                      }
                    </p>
                  </div>
                </div>
              </div>

              <hr class="border-neutral-200" />

              <!-- Datos comerciales. Van en la cabecera de la factura y en
                   ningún otro lado: sin ellos el sistema funciona igual, y por
                   eso ninguno es obligatorio. -->
              <div>
                <div class="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <h3 class="text-sm font-semibold text-neutral-800">Datos de facturación</h3>
                    <p class="text-xs text-neutral-500 mt-0.5">
                      Encabezan la factura. Lo que se deje vacío no se imprime.
                    </p>
                  </div>
                  <!-- Las dos puertas a facturación desde la ficha: lo que se
                       le cobró y lo que se le va a cobrar. Van acá, junto a los
                       datos que salen impresos, y no en la cabecera de la
                       pantalla, donde competirían con guardar y suspender. -->
                  <div class="flex items-center gap-2 shrink-0">
                    <a routerLink="/facturacion" [queryParams]="{ cliente: c.id }"
                       class="btn-outline btn-sm">Facturas</a>
                    <a [routerLink]="['/clientes', c.id, 'tarifas']"
                       class="btn-secondary btn-sm">Tarifas</a>
                    <a routerLink="/bitacora" [queryParams]="{ cliente: c.id }"
                       class="btn-secondary btn-sm">Bitácora</a>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div>
                    <label class="form-label" for="c-giro">Giro</label>
                    <input id="c-giro" type="text" class="form-input" [(ngModel)]="datos.giro"
                           placeholder="Servicios jurídicos" autocomplete="off" />
                  </div>
                  <div>
                    <label class="form-label" for="c-direccion">Dirección</label>
                    <input id="c-direccion" type="text" class="form-input" [(ngModel)]="datos.direccion"
                           placeholder="Av. Providencia 1234, of. 501" autocomplete="off" />
                  </div>
                  <div>
                    <label class="form-label" for="c-comuna">Comuna</label>
                    <input id="c-comuna" type="text" class="form-input" [(ngModel)]="datos.comuna"
                           placeholder="Providencia" autocomplete="off" />
                  </div>
                  <div>
                    <label class="form-label" for="c-ciudad">Ciudad</label>
                    <input id="c-ciudad" type="text" class="form-input" [(ngModel)]="datos.ciudad"
                           placeholder="Santiago" autocomplete="off" />
                  </div>
                </div>
              </div>

              <hr class="border-neutral-200" />

              <!-- Identificadores: se muestran porque el administrador los
                   necesita para soporte, pero no se editan: cambiarlos
                   dejaría la base de datos huérfana. -->
              <dl class="rounded-lg border border-neutral-200 divide-y divide-neutral-200 text-sm">
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
                      <label class="form-label" for="imap-hora">Revisar desde las</label>
                      <input id="imap-hora" type="time" class="form-input" [(ngModel)]="inboxModelo.hora_ejecucion" />
                      <p class="text-xs text-neutral-500 mt-1">
                        La casilla se revisa <strong>cada 15 minutos</strong>, no una vez al día.
                        Esta hora es un piso: antes de ella no se revisa. Vacío = se revisa todo
                        el día.
                      </p>
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
                @if (esPatrocinador(c)) {
                  <p class="text-sm text-neutral-500 mt-0.5">
                    Es un abogado patrocinador: tiene una sola cuenta y no admite más.
                  </p>
                } @else if (c.cal) {
                  <p class="text-sm text-neutral-500 mt-0.5">
                    {{ activos() }} de {{ c.cal }} usuarios contratados (CAL).
                    @if (!hayCupo(c)) {
                      Para agregar otro, amplíe el CAL en la pestaña Datos o desactive a alguien.
                    }
                  </p>
                }
              </div>
              <!-- El botón desaparece sin cupo en vez de quedar deshabilitado:
                   deshabilitado no dice POR QUÉ, y el motivo está justo arriba. -->
              @if (hayCupo(c)) {
                <button type="button" class="btn-primary btn-sm" (click)="abrirNuevoUsuario()"
                        [disabled]="c.aprovisionamiento !== 'listo'">
                  Nuevo usuario
                </button>
              }
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
                    @if (esPatrocinador(c)) {
                      Cree su cuenta de acceso.
                    } @else {
                      Cree las cuentas del estudio: dentro de un estudio todos hacen lo mismo.
                    }
                  </p>
                  @if (hayCupo(c)) {
                    <button type="button" class="btn-primary mt-4" (click)="abrirNuevoUsuario()">
                      Crear el primer usuario
                    </button>
                  }
                </div>
              } @else {
                <div class="table-wrapper">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Usuario</th>
                        <th scope="col">Nombre</th>
                        <th scope="col">Correo</th>
                        <th scope="col">RUT PJUD</th>
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
                          <td class="whitespace-nowrap">
                            @if (u.ruts.length) {
                              {{ rutsBonitos(u) }}
                            } @else {
                              <span class="text-neutral-400"
                                    title="Sin RUT propios: al importar se compara con el del estudio">—</span>
                            }
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
                     placeholder="jperez" autocomplete="off" />
              <p class="text-xs text-neutral-500 mt-1">
                Mínimo 3 caracteres. Solo letras, números, punto, guion y guion bajo.
                @if (editandoUsuario()) {
                  <br />Al cambiarlo, la persona entra con el nombre nuevo. Su historial no se
                  pierde: los registros apuntan al usuario, no a su nombre.
                }
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label" for="u-nombre">Nombre</label>
                <input id="u-nombre" type="text" class="form-input" [ngModel]="usuarioModelo.nombre"
                       (ngModelChange)="alEscribirNombre('nombre', $event)" placeholder="Juan" />
                <p class="text-xs text-neutral-500 mt-1">Solo el primer nombre.</p>
              </div>
              <div>
                <label class="form-label" for="u-apellido">Apellido</label>
                <input id="u-apellido" type="text" class="form-input" [ngModel]="usuarioModelo.apellido"
                       (ngModelChange)="alEscribirNombre('apellido', $event)" placeholder="Pérez" />
                <p class="text-xs text-neutral-500 mt-1">Solo el primer apellido.</p>
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

            <!-- RUT con los que esta persona recibe archivos del PJUD. Es lo
                 que decide si al importar se le advierte que el archivo es de
                 otro: el reporte se emite a nombre del abogado que lo pide, no
                 del estudio. -->
            <div>
              <label class="form-label" for="u-rut">RUT que recibe del PJUD</label>
              <div class="flex gap-2">
                <input
                  id="u-rut"
                  type="text"
                  class="form-input"
                  [(ngModel)]="rutBorrador"
                  (keydown.enter)="$event.preventDefault(); agregarRut()"
                  placeholder="16.952.077-1"
                  autocomplete="off"
                  aria-describedby="u-rut-ayuda"
                />
                <button type="button" class="btn-secondary shrink-0" (click)="agregarRut()"
                        [disabled]="!rutBorrador.trim()">
                  Agregar
                </button>
              </div>
              @if (errorRut()) {
                <p class="text-xs text-danger-600 mt-1">{{ errorRut() }}</p>
              }
              <p id="u-rut-ayuda" class="text-xs text-neutral-500 mt-1">
                Pueden ser varios: un abogado puede litigar además a nombre de una
                sociedad. Sin ninguno, la advertencia al importar se compara con el RUT
                del estudio.
              </p>

              @if (usuarioModelo.ruts.length) {
                <ul class="flex flex-wrap gap-2 mt-2">
                  @for (r of usuarioModelo.ruts; track r) {
                    <li class="inline-flex items-center gap-2 rounded-full bg-neutral-100
                               px-3 py-1 text-sm text-neutral-700">
                      {{ rutBonito(r) }}
                      <button type="button" (click)="quitarRut(r)"
                              class="text-neutral-400 hover:text-danger-600"
                              [attr.aria-label]="'Quitar el RUT ' + rutBonito(r)">&times;</button>
                    </li>
                  }
                </ul>
              }
            </div>

            <div>
              <label class="form-label" for="u-password">
                Contraseña
                @if (!editandoUsuario()) { <span class="text-danger-600">*</span> }
              </label>
              <input id="u-password" type="password" class="form-input" [(ngModel)]="usuarioModelo.password"
                     autocomplete="new-password"
                     aria-describedby="u-password-ayuda"
                     [placeholder]="editandoUsuario() ? 'Dejar vacío para no cambiarla' : 'Mínimo 8 caracteres'" />
              <!-- La clave provisoria cumple la misma política que la
                   definitiva: el backend la rechaza igual, y decirlo acá evita
                   perder lo escrito en el resto del formulario. -->
              <p id="u-password-ayuda" class="text-xs text-neutral-500 mt-1">
                Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número.
                El usuario deberá cambiarla la primera vez que ingrese.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    { clave: 'inbox', etiqueta: 'Correo PJUD' },
    { clave: 'usuarios', etiqueta: 'Usuarios' },
  ];

  clienteId = 0;
  seccion = signal<Seccion>('datos');

  cliente = signal<Cliente | null>(null);
  errorCliente = signal<string | null>(null);
  guardando = signal(false);
  datos = { nombre: '', rut: '', correo: '', giro: '', direccion: '', comuna: '', ciudad: '' };

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
        this.datos = {
          nombre: c.nombre,
          rut: formatearRut(c.rut),
          correo: c.correo,
          giro: c.giro ?? '',
          direccion: c.direccion ?? '',
          comuna: c.comuna ?? '',
          ciudad: c.ciudad ?? '',
        };
      },
      error: (e) => this.errorCliente.set(this.mensajeError(e)),
    });
  }

  subiendoLogo = signal(false);

  /** Tope del ARCHIVO. El base64 pesa ~4/3, y el backend corta en 400 KB de
   *  base64: se avisa acá con el tamaño real para que el mensaje se entienda. */
  private readonly MAX_LOGO_BYTES = 300 * 1024;

  elegirLogo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    // Se limpia siempre: si no, elegir el mismo archivo dos veces seguidas no
    // dispara el evento y parece que el botón dejó de funcionar.
    input.value = '';
    if (!archivo) return;

    if (archivo.size > this.MAX_LOGO_BYTES) {
      this.notification.error('La imagen supera los 300 KB. Use una más liviana.');
      return;
    }

    const lector = new FileReader();
    lector.onerror = () => this.notification.error('No se pudo leer la imagen');
    lector.onload = () => {
      // FileReader entrega `data:<mime>;base64,<...>`. Se manda solo la parte
      // de después de la coma: el backend guarda el base64 puro.
      const resultado = String(lector.result ?? '');
      const coma = resultado.indexOf(',');
      if (coma < 0) {
        this.notification.error('No se pudo leer la imagen');
        return;
      }
      this.guardarLogo(resultado.slice(coma + 1), archivo.type || 'image/png');
    };
    lector.readAsDataURL(archivo);
  }

  quitarLogo(): void {
    this.guardarLogo(null, null);
  }

  private guardarLogo(base64: string | null, mime: string | null): void {
    this.subiendoLogo.set(true);
    this.service.guardarLogo(this.clienteId, base64, mime).subscribe({
      next: (c) => {
        this.subiendoLogo.set(false);
        this.cliente.set(c);
        this.notification.success(base64 ? 'Logo actualizado' : 'Logo quitado');
      },
      error: (e) => {
        this.subiendoLogo.set(false);
        this.notification.error(this.mensajeError(e));
      },
    });
  }

  guardarDatos(): void {
    const actual = this.cliente();
    if (!actual) return;
    if (this.datos.nombre.trim().length < 3) {
      this.notification.error('Indique el nombre del estudio');
      return;
    }
    // Se valida acá y no solo en el backend porque un RUT con dígito
    // verificador malo dejaría al estudio sin poder entrar, y el error
    // aparecería recién en el próximo login de otra persona.
    if (!rutValido(this.datos.rut)) {
      this.notification.error('El RUT no es válido: revise el dígito verificador');
      return;
    }

    this.guardando.set(true);
    this.service
      .update(this.clienteId, {
        nombre: this.datos.nombre.trim(),
        rut: this.datos.rut.trim(),
        correo: this.datos.correo.trim(),
        // Vacío viaja como null: el backend distingue "sin dato" de cadena
        // vacía y la factura omite las líneas que no tienen valor.
        giro: this.datos.giro.trim() || null,
        direccion: this.datos.direccion.trim() || null,
        comuna: this.datos.comuna.trim() || null,
        ciudad: this.datos.ciudad.trim() || null,
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

  /** Lo que se está escribiendo en el campo de RUT, antes de "Agregar". */
  rutBorrador = '';
  errorRut = signal('');

  private usuarioVacio() {
    return {
      username: '',
      email: '',
      password: '',
      nombre: '',
      apellido: '',
      telefono: '',
      ruts: [] as string[],
      activo: true,
    };
  }

  /**
   * Agrega el RUT escrito a la lista del usuario.
   *
   * Se valida el dígito verificador acá y no solo en el servidor porque un RUT
   * mal tipeado no falla nunca: hace que la advertencia al importar no aparezca
   * cuando debería, que es un error que nadie nota hasta que se cargó el
   * archivo del abogado equivocado.
   */
  agregarRut(): void {
    const escrito = this.rutBorrador.trim();
    if (!escrito) return;

    if (!rutValido(escrito)) {
      this.errorRut.set('El RUT no es válido: revise el dígito verificador');
      return;
    }
    // Se guarda normalizado (`12345678-9`) para que `16.952.077-1` y
    // `169520771` no entren como dos RUT distintos.
    const canonico = rutPlano(escrito);
    if (this.usuarioModelo.ruts.includes(canonico)) {
      this.errorRut.set('Ese RUT ya está en la lista');
      return;
    }

    this.usuarioModelo.ruts = [...this.usuarioModelo.ruts, canonico];
    this.rutBorrador = '';
    this.errorRut.set('');
  }

  quitarRut(rut: string): void {
    this.usuarioModelo.ruts = this.usuarioModelo.ruts.filter((r) => r !== rut);
    this.errorRut.set('');
  }

  /** Los RUT de un usuario para la tabla, formateados y separados por coma. */
  rutsBonitos(u: Usuario): string {
    return u.ruts.map((r) => formatearRut(r)).join(', ');
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

  esPatrocinador(c: Cliente): boolean {
    return c.tipo === 'patrocinador';
  }

  /** Usuarios ACTIVOS. Los desactivados no ocupan cupo: es lo que pasa cuando
   *  alguien deja el estudio y entra otro en su lugar. */
  activos(): number {
    return this.usuarios().filter((u) => u.activo).length;
  }

  /**
   * Cuántas cuentas admite el cliente. Un patrocinador es un abogado solo, así
   * que siempre una; un estudio, las que dice su CAL.
   *
   * `0` = sin tope declarado. Son los clientes anteriores al CAL: no se les
   * puede inventar un límite retroactivo, así que siguen sin restricción hasta
   * que alguien les fije uno.
   */
  cupos(c: Cliente): number {
    if (this.esPatrocinador(c)) return 1;
    return c.cal ?? 0;
  }

  /**
   * Si se puede agregar otra cuenta.
   *
   * Es la MISMA regla que aplica el backend (`crear_usuario` la revisa contra
   * la base). Acá solo se adelanta para no ofrecer un botón que va a fallar:
   * la decisión sigue siendo del servidor, porque este conteo es de la lista
   * cargada en pantalla y puede estar desactualizado.
   */
  hayCupo(c: Cliente): boolean {
    const tope = this.cupos(c);
    return tope === 0 || this.activos() < tope;
  }

  abrirNuevoUsuario(): void {
    this.usuarioModelo = this.usuarioVacio();
    this.rutBorrador = '';
    this.errorRut.set('');
    // El primer usuario del estudio tiene que poder administrar al resto.
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
      // Copia, no la misma referencia: cancelar el modal no puede dejar
      // modificada la lista que se está mostrando en la tabla.
      ruts: [...u.ruts],
      activo: u.activo,
    };
    this.rutBorrador = '';
    this.errorRut.set('');
    this.editandoUsuario.set(u.id);
    this.errorUsuario.set('');
    this.modalUsuario.set(true);
  }

  cerrarUsuario(): void {
    if (this.guardandoUsuario()) return;
    this.modalUsuario.set(false);
  }

  /** Quita los espacios al escribir: nombre y apellido son de UNA palabra.
   *  Impedirlo al teclear es más claro que avisarlo recién al guardar. */
  alEscribirNombre(campo: 'nombre' | 'apellido', valor: string): void {
    this.usuarioModelo[campo] = valor.replace(/\s+/g, '');
  }

  private validarUsuario(): string | null {
    // El nombre de usuario se valida SIEMPRE, no solo al crear: ahora también
    // se puede cambiar.
    if (this.usuarioModelo.username.trim().length < 3) {
      return 'El nombre de usuario debe tener al menos 3 caracteres';
    }
    if (!/^[A-Za-z0-9._-]+$/.test(this.usuarioModelo.username.trim())) {
      return 'El nombre de usuario solo admite letras, números, punto, guion y guion bajo';
    }
    if (!this.editandoUsuario() && !this.usuarioModelo.password) {
      return 'Indique una contraseña';
    }

    // Un nombre y un apellido: el backend lo rechaza igual, pero avisarlo acá
    // evita perder lo escrito en el resto del formulario.
    if (/\s/.test(this.usuarioModelo.nombre.trim())) {
      return 'El nombre debe ser una sola palabra. Indique solo el primer nombre.';
    }
    if (/\s/.test(this.usuarioModelo.apellido.trim())) {
      return 'El apellido debe ser una sola palabra. Indique solo el primer apellido.';
    }
    if (!this.usuarioModelo.email.trim()) return 'Indique el correo electrónico';
    // Guardar con algo escrito en el campo de RUT lo tiraría sin decir nada, y
    // quien lo escribió se va convencido de que lo dejó cargado.
    if (this.rutBorrador.trim()) {
      return 'Agregue el RUT que escribió con el botón «Agregar», o borre el campo.';
    }
    if (this.usuarioModelo.password && !passwordCumplePolitica(this.usuarioModelo.password)) {
      const faltan = reglasPassword(this.usuarioModelo.password)
        .filter((r) => !r.cumple)
        .map((r) => r.texto.toLowerCase());
      return `La contraseña debe tener ${faltan.join(', ')}`;
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
      username: this.usuarioModelo.username.trim(),
      email: this.usuarioModelo.email.trim(),
      nombre: this.usuarioModelo.nombre.trim() || null,
      apellido: this.usuarioModelo.apellido.trim() || null,
      telefono: this.usuarioModelo.telefono.trim() || null,
      ruts: this.usuarioModelo.ruts,
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
