import { Component, OnInit, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiKey, ApiKeyCreada } from '@core/models/api-key.model';
import { NotificationService } from '@core/services/notification.service';
import { AdminApiKeyService } from '../services/admin-api-key.service';

type EstadoKey = 'activa' | 'vencida' | 'revocada';

/**
 * Pestaña "API keys" de la ficha del cliente.
 *
 * Una API key le da a OTRO SISTEMA acceso a la API de este estudio sin pasar por
 * el login de personas, que exige reCAPTCHA y un servidor no puede resolver. El
 * backend está en `backend/app/core/api_key.py`.
 *
 * Lo que esta pantalla cuida a propósito:
 *  - **La key se ve una sola vez**, al crearla. En la base solo queda su hash.
 *  - **Revocar es inmediato e irreversible**, así que pide confirmación.
 *  - **Escritura es la excepción**: una key nace de solo lectura y marcar
 *    escritura la limita a cargar causas; no abre el resto del sistema.
 */
@Component({
  selector: 'app-cliente-api-keys',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (!listo()) {
      <div class="card max-w-3xl">
        <div class="card-body">
          <p class="text-neutral-600 py-8 text-center">
            Las API keys se pueden emitir una vez que la base de datos del cliente esté lista.
          </p>
        </div>
      </div>
    } @else {
      <div class="space-y-6">
        <div class="alert-info max-w-3xl">
          <div class="flex-1">
            <p class="font-medium">Acceso de otros sistemas a la API del estudio</p>
            <p class="mt-0.5">
              Una API key deja que un sistema externo consulte los datos de este cliente sin iniciar
              sesión ni resolver el reCAPTCHA. El sistema la envía en el encabezado
              <code>X-API-Key</code> de cada petición.
            </p>
          </div>
        </div>

        <div class="card">
          <div class="card-header flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="font-semibold text-neutral-800">API keys</h2>
              <p class="text-sm text-neutral-500">
                Cada key es de un sistema y se puede revocar sin afectar a las demás.
              </p>
            </div>
            <button type="button" class="btn-primary btn-sm" (click)="abrirNueva()">Nueva API key</button>
          </div>
          <div class="card-body">
            @if (error()) {
              <div class="alert-danger">
                <div class="flex-1">
                  <p class="font-medium">No se pudo cargar las API keys.</p>
                  <p class="text-sm mt-1">{{ error() }}</p>
                </div>
                <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">Reintentar</button>
              </div>
            } @else if (cargando()) {
              <div class="flex items-center justify-center py-16">
                <svg class="animate-spin h-8 w-8 text-primary-600" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span class="sr-only">Cargando API keys</span>
              </div>
            } @else if (keys().length === 0) {
              <div class="py-16 text-center">
                <p class="text-neutral-600 font-medium">Este cliente todavía no tiene API keys</p>
                <p class="text-neutral-500 text-sm mt-1">
                  Emita una para el sistema que va a conectarse a su información.
                </p>
                <button type="button" class="btn-primary mt-4" (click)="abrirNueva()">Emitir la primera</button>
              </div>
            } @else {
              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Sistema</th>
                      <th scope="col">Key</th>
                      <th scope="col">Permisos</th>
                      <th scope="col">Límite</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Último uso</th>
                      <th scope="col"><span class="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (k of keys(); track k.id) {
                      <tr>
                        <td>
                          <span class="font-medium">{{ k.nombre }}</span>
                          <span class="block text-xs text-neutral-500">
                            Creada el {{ k.fecha_creacion | date: 'dd-MM-yyyy' }}
                          </span>
                        </td>
                        <td class="whitespace-nowrap"><code>{{ k.prefijo }}…</code></td>
                        <td class="text-sm">
                          @if (k.permite_escritura) {
                            Lee y carga causas
                          } @else {
                            Solo lectura
                          }
                        </td>
                        <td class="whitespace-nowrap">{{ k.limite_por_minuto }} / min</td>
                        <td>
                          <span [class]="claseEstado(k)">{{ textoEstado(k) }}</span>
                          @if (estado(k) === 'activa' && k.expira_en) {
                            <span class="block text-xs text-neutral-500">
                              Vence el {{ k.expira_en | date: 'dd-MM-yyyy' }}
                            </span>
                          } @else if (estado(k) === 'vencida') {
                            <span class="block text-xs text-neutral-500">
                              Venció el {{ k.expira_en | date: 'dd-MM-yyyy' }}
                            </span>
                          } @else if (k.revocada_en) {
                            <span class="block text-xs text-neutral-500">
                              El {{ k.revocada_en | date: 'dd-MM-yyyy' }}
                            </span>
                          }
                        </td>
                        <td class="text-sm whitespace-nowrap">
                          @if (k.ultimo_uso) {
                            {{ k.ultimo_uso | date: 'dd-MM-yyyy HH:mm' }}
                            @if (k.ultimo_ip) {
                              <span class="block text-xs text-neutral-500">{{ k.ultimo_ip }}</span>
                            }
                          } @else {
                            <span class="text-neutral-500">Nunca</span>
                          }
                        </td>
                        <td class="whitespace-nowrap">
                          @if (estado(k) !== 'revocada') {
                            <button type="button" class="btn-secondary btn-sm" (click)="abrirEditar(k)">Editar</button>
                            <button type="button" class="btn-danger btn-sm ml-1" (click)="pedirRevocar(k)">Revocar</button>
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

        <!-- Qué puede hacer una key y cómo se usa -->
        <div class="card max-w-3xl">
          <div class="card-header">
            <h2 class="font-semibold text-neutral-800">Qué puede hacer una key</h2>
            <p class="text-sm text-neutral-500">Para quien programa el sistema que la usa.</p>
          </div>
          <div class="card-body space-y-3 text-sm text-neutral-700">
            <ul class="list-disc pl-5 space-y-1">
              <li>
                <strong>Lectura</strong> (peticiones GET) de causas, estado diario, movimientos,
                audiencias, reportes, dashboard y jurisdicciones.
              </li>
              <li>
                <strong>Escritura</strong> solo si la key la tiene habilitada, y únicamente en
                <code>/api/v1/causas</code> (por ejemplo, cargar el archivo de causas).
              </li>
              <li>
                No puede iniciar sesión, cambiar contraseñas, ver facturas, hacer pagos ni tocar la
                configuración del estudio.
              </li>
              <li>
                Si supera el límite por minuto, recibe <code>429</code> con un encabezado
                <code>Retry-After</code>. Con la key revocada, vencida o de un cliente suspendido
                recibe <code>401</code>.
              </li>
              <li>
                Las escrituras, los accesos denegados y los excesos de límite quedan en el log del
                cliente (módulo <em>auth</em>), con la IP y el prefijo de la key.
              </li>
            </ul>
            <div>
              <div class="flex items-center justify-between gap-2 mb-1">
                <p class="font-medium text-neutral-800">Ejemplo de uso</p>
                <button type="button" class="btn-secondary btn-sm" (click)="copiar(ejemploUso)">Copiar</button>
              </div>
              <pre class="text-xs bg-neutral-50 border border-neutral-200 rounded-lg p-4 overflow-x-auto"><code>{{ ejemploUso }}</code></pre>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- ── Nueva key ───────────────────────────────────────────── -->
    @if (modalNueva()) {
      <div class="modal-backdrop animar-fondo" (click)="cerrarNueva()">
        <div class="modal-content" (click)="$event.stopPropagation()" role="dialog" aria-modal="true"
             aria-labelledby="titulo-nueva" (keydown.escape)="cerrarNueva()" tabindex="-1">
          <div class="modal-header">
            <h3 id="titulo-nueva" class="text-lg font-semibold">Nueva API key</h3>
            <button type="button" (click)="cerrarNueva()" class="text-neutral-400 hover:text-neutral-600"
                    aria-label="Cerrar">&times;</button>
          </div>
          <div class="modal-body space-y-4">
            <div>
              <label class="form-label" for="key-nombre">Sistema que la usará</label>
              <input id="key-nombre" type="text" class="form-input" [(ngModel)]="nueva.nombre"
                     maxlength="100" placeholder="Sistema de gestión del estudio" autocomplete="off" />
              <p class="text-xs text-neutral-500 mt-1">
                Es el nombre que se ve en el log del cliente: elíjalo para reconocerla después.
              </p>
            </div>

            <label class="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" class="mt-1" [(ngModel)]="nueva.permite_escritura" />
              <span>
                <span class="font-medium text-neutral-800">Permitir cargar causas</span>
                <span class="block text-sm text-neutral-500">
                  Sin esto la key solo lee. Con esto puede escribir únicamente en causas; el resto
                  del sistema sigue de solo lectura.
                </span>
              </span>
            </label>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="form-label" for="key-limite">Límite por minuto</label>
                <input id="key-limite" type="number" min="1" max="10000" class="form-input"
                       [(ngModel)]="nueva.limite" placeholder="60" />
                <p class="text-xs text-neutral-500 mt-1">Vacío = el valor por defecto (60).</p>
              </div>
              <div>
                <label class="form-label" for="key-vence">Vence el</label>
                <input id="key-vence" type="date" class="form-input" [min]="hoy()"
                       [(ngModel)]="nueva.vence" />
                <p class="text-xs text-neutral-500 mt-1">Vacío = no vence.</p>
              </div>
            </div>

            @if (errorModal()) {
              <div class="alert-danger">{{ errorModal() }}</div>
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="cerrarNueva()" [disabled]="guardando()">Cancelar</button>
            <button type="button" class="btn-primary" (click)="crear()" [disabled]="guardando()">
              {{ guardando() ? 'Emitiendo...' : 'Emitir API key' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── La key recién emitida: se ve una sola vez ───────────── -->
    @if (creada(); as c) {
      <div class="modal-backdrop animar-fondo">
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="titulo-creada"
             (keydown.escape)="creada.set(null)" tabindex="-1">
          <div class="modal-header">
            <h3 id="titulo-creada" class="text-lg font-semibold">API key emitida</h3>
          </div>
          <div class="modal-body space-y-3">
            <div class="alert-warning">
              <div class="flex-1 min-w-0">
                <p class="font-medium">Copie la key ahora</p>
                <p class="mt-0.5">
                  Es la única vez que se muestra: en el sistema solo queda una huella. Si se pierde,
                  hay que revocarla y emitir otra.
                </p>
              </div>
            </div>
            <div>
              <p class="text-sm text-neutral-600 mb-1">Key de «{{ c.nombre }}»</p>
              <div class="flex flex-wrap items-center gap-2">
                <code class="text-sm font-medium break-all">{{ c.key }}</code>
                <button type="button" class="btn-secondary btn-sm shrink-0" (click)="copiar(c.key)"
                        aria-label="Copiar la API key">Copiar</button>
              </div>
            </div>
            <p class="text-sm text-neutral-600">
              Debe enviarla en el encabezado <code>X-API-Key</code> de cada petición.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-primary" (click)="creada.set(null)">Ya la copié</button>
          </div>
        </div>
      </div>
    }

    <!-- ── Editar ──────────────────────────────────────────────── -->
    @if (editando(); as k) {
      <div class="modal-backdrop animar-fondo" (click)="editando.set(null)">
        <div class="modal-content" (click)="$event.stopPropagation()" role="dialog" aria-modal="true"
             aria-labelledby="titulo-editar" (keydown.escape)="editando.set(null)" tabindex="-1">
          <div class="modal-header">
            <h3 id="titulo-editar" class="text-lg font-semibold">Editar {{ k.prefijo }}…</h3>
            <button type="button" (click)="editando.set(null)" class="text-neutral-400 hover:text-neutral-600"
                    aria-label="Cerrar">&times;</button>
          </div>
          <div class="modal-body space-y-4">
            <div>
              <label class="form-label" for="edit-nombre">Sistema</label>
              <input id="edit-nombre" type="text" class="form-input" [(ngModel)]="edicion.nombre"
                     maxlength="100" autocomplete="off" />
            </div>
            <div>
              <label class="form-label" for="edit-limite">Límite por minuto</label>
              <input id="edit-limite" type="number" min="1" max="10000" class="form-input"
                     [(ngModel)]="edicion.limite" />
            </div>
            <p class="text-xs text-neutral-500">
              Los permisos y el vencimiento no se cambian: para otros permisos, emita una key nueva y
              revoque esta.
            </p>
            @if (errorModal()) {
              <div class="alert-danger">{{ errorModal() }}</div>
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="editando.set(null)" [disabled]="guardando()">Cancelar</button>
            <button type="button" class="btn-primary" (click)="guardarEdicion()" [disabled]="guardando()">
              {{ guardando() ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Revocar: irreversible, nunca directo ────────────────── -->
    @if (revocando(); as k) {
      <div class="modal-backdrop animar-fondo" (click)="revocando.set(null)">
        <div class="modal-content" (click)="$event.stopPropagation()" role="dialog" aria-modal="true"
             aria-labelledby="titulo-revocar" (keydown.escape)="revocando.set(null)" tabindex="-1">
          <div class="modal-header">
            <h3 id="titulo-revocar" class="text-lg font-semibold">Revocar la API key</h3>
            <button type="button" (click)="revocando.set(null)" class="text-neutral-400 hover:text-neutral-600"
                    aria-label="Cerrar">&times;</button>
          </div>
          <div class="modal-body space-y-3">
            <p class="text-sm text-neutral-700">
              «{{ k.nombre }}» ({{ k.prefijo }}…) deja de funcionar <strong>de inmediato</strong>: el
              sistema que la usa recibirá un error 401 en su próxima petición.
            </p>
            <p class="text-sm text-neutral-700">
              No se puede deshacer. Para volver a darle acceso hay que emitir una key nueva. Lo que
              ya cargó con ella se conserva.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="revocando.set(null)" [disabled]="guardando()">Cancelar</button>
            <button type="button" class="btn-danger" (click)="revocar()" [disabled]="guardando()">
              {{ guardando() ? 'Revocando...' : 'Revocar la key' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ClienteApiKeysComponent implements OnInit {
  private service = inject(AdminApiKeyService);
  private notification = inject(NotificationService);

  clienteId = input.required<number>();
  /** La base del cliente está lista: sin ella no hay dónde crear el usuario de la key. */
  listo = input(true);

  readonly ejemploUso =
    'curl https://<servidor>/api/v1/causas \\\n' + '  -H "X-API-Key: ed_xxxxxxxxxxxxxxxx"';

  keys = signal<ApiKey[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);

  guardando = signal(false);
  errorModal = signal('');

  modalNueva = signal(false);
  nueva = this.nuevaVacia();
  /** La key recién emitida. Vive solo en memoria y se pierde al cerrar el aviso. */
  creada = signal<ApiKeyCreada | null>(null);

  editando = signal<ApiKey | null>(null);
  edicion = { nombre: '', limite: null as number | null };

  revocando = signal<ApiKey | null>(null);

  ngOnInit(): void {
    if (this.listo()) this.cargar();
  }

  private nuevaVacia() {
    return {
      nombre: '',
      permite_escritura: false,
      limite: null as number | null,
      vence: '',
    };
  }

  cargar(): void {
    this.error.set(null);
    this.cargando.set(true);
    this.service.list(this.clienteId()).subscribe({
      next: (r) => {
        this.cargando.set(false);
        this.keys.set(r.api_keys);
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(this.mensajeError(e));
      },
    });
  }

  // ── Crear ──────────────────────────────────────────────────────────────

  hoy(): string {
    return new Date().toISOString().slice(0, 10);
  }

  abrirNueva(): void {
    this.nueva = this.nuevaVacia();
    this.errorModal.set('');
    this.modalNueva.set(true);
  }

  cerrarNueva(): void {
    if (!this.guardando()) this.modalNueva.set(false);
  }

  crear(): void {
    const nombre = this.nueva.nombre.trim();
    if (!nombre) {
      this.errorModal.set('Indique qué sistema usará la key');
      return;
    }
    const limite = this.nueva.limite;
    if (limite !== null && (!Number.isInteger(limite) || limite < 1 || limite > 10000)) {
      this.errorModal.set('El límite debe ser un número entero entre 1 y 10.000');
      return;
    }
    // Fin del día elegido, en hora local: «vence el 30» significa que sirve todo el 30.
    const vence = this.nueva.vence ? new Date(`${this.nueva.vence}T23:59:59`).toISOString() : null;

    this.guardando.set(true);
    this.errorModal.set('');
    this.service
      .create(this.clienteId(), {
        nombre,
        permite_escritura: this.nueva.permite_escritura,
        limite_por_minuto: limite,
        expira_en: vence,
      })
      .subscribe({
        next: (r) => {
          this.guardando.set(false);
          this.modalNueva.set(false);
          this.creada.set(r);
          this.cargar();
        },
        error: (e) => {
          this.guardando.set(false);
          this.errorModal.set(this.mensajeError(e));
        },
      });
  }

  // ── Editar ─────────────────────────────────────────────────────────────

  abrirEditar(k: ApiKey): void {
    this.edicion = { nombre: k.nombre, limite: k.limite_por_minuto };
    this.errorModal.set('');
    this.editando.set(k);
  }

  guardarEdicion(): void {
    const k = this.editando();
    if (!k) return;
    const nombre = this.edicion.nombre.trim();
    const limite = this.edicion.limite;
    if (!nombre) {
      this.errorModal.set('El nombre no puede quedar vacío');
      return;
    }
    if (limite === null || !Number.isInteger(limite) || limite < 1 || limite > 10000) {
      this.errorModal.set('El límite debe ser un número entero entre 1 y 10.000');
      return;
    }

    this.guardando.set(true);
    this.errorModal.set('');
    this.service.update(this.clienteId(), k.id, { nombre, limite_por_minuto: limite }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(null);
        this.notification.success('API key actualizada');
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.errorModal.set(this.mensajeError(e));
      },
    });
  }

  // ── Revocar ────────────────────────────────────────────────────────────

  pedirRevocar(k: ApiKey): void {
    this.revocando.set(k);
  }

  revocar(): void {
    const k = this.revocando();
    if (!k) return;
    this.guardando.set(true);
    this.service.revocar(this.clienteId(), k.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.revocando.set(null);
        this.notification.success('API key revocada');
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.revocando.set(null);
        this.notification.error(this.mensajeError(e));
      },
    });
  }

  // ── Presentación ───────────────────────────────────────────────────────

  estado(k: ApiKey): EstadoKey {
    if (!k.activa || k.revocada_en) return 'revocada';
    if (k.expira_en && new Date(k.expira_en).getTime() <= Date.now()) return 'vencida';
    return 'activa';
  }

  claseEstado(k: ApiKey): string {
    switch (this.estado(k)) {
      case 'activa':
        return 'badge-success';
      case 'vencida':
        return 'badge-warning';
      default:
        return 'badge-neutral';
    }
  }

  textoEstado(k: ApiKey): string {
    switch (this.estado(k)) {
      case 'activa':
        return 'Activa';
      case 'vencida':
        return 'Vencida';
      default:
        return 'Revocada';
    }
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
