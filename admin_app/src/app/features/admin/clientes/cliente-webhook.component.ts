import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  EstadoEnvio,
  WebhookConfig,
  WebhookConfigUpdate,
  WebhookEnvio,
} from '@core/models/webhook.model';
import { NotificationService } from '@core/services/notification.service';
import { AdminWebhookService } from '../services/admin-webhook.service';

/**
 * Pestaña "Webhook" de la ficha del cliente.
 *
 * Configura a dónde avisa la plataforma cuando termina de importar un archivo
 * que llegó por correo, y deja ver qué se entregó y qué no. El backend está en
 * `backend/app/services/webhook_service.py`.
 *
 * Tres cosas que esta pantalla cuida a propósito:
 *  - **El secreto se ve una sola vez.** Llega al guardar por primera vez o al
 *    generar uno nuevo, y se queda en pantalla solo mientras no se cambie de
 *    pestaña: el servidor no lo vuelve a entregar.
 *  - **Generar un secreto nuevo corta al receptor** hasta que lo actualice, así
 *    que pide confirmación y lo dice.
 *  - **La prueba usa lo guardado**, no lo que hay en el formulario; si hay
 *    cambios sin guardar se avisa, porque probar la URL vieja es engañoso.
 */
@Component({
  selector: 'app-cliente-webhook',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (!listo()) {
      <div class="card max-w-3xl">
        <div class="card-body">
          <p class="text-neutral-600 py-8 text-center">
            El webhook se puede configurar una vez que la base de datos del cliente esté lista.
          </p>
        </div>
      </div>
    } @else if (error()) {
      <div class="alert-danger">
        <div class="flex-1">
          <p class="font-medium">No se pudo cargar el webhook de este cliente.</p>
          <p class="text-sm mt-1">{{ error() }}</p>
        </div>
        <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">Reintentar</button>
      </div>
    } @else if (!config()) {
      <div class="card max-w-3xl animate-pulse">
        <div class="card-body h-64 bg-neutral-100 rounded-b-xl"></div>
      </div>
    } @else {
      @if (config(); as cfg) {
        <div class="space-y-6">
          <!-- ── Configuración ──────────────────────────────────── -->
          <div class="card max-w-3xl">
            <div class="card-body space-y-5">
              <div class="alert-info">
                <div class="flex-1">
                  <p class="font-medium">Aviso al sistema del estudio</p>
                  <p class="mt-0.5">
                    Cada vez que termina de importarse un archivo que llegó por correo, la
                    plataforma envía a esta dirección los datos importados. La entrega se
                    reintenta sola si el destino no responde.
                  </p>
                </div>
              </div>

              <label class="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" class="mt-1" [(ngModel)]="modelo.activo" />
                <span>
                  <span class="font-medium text-neutral-800">Webhook activo</span>
                  <span class="block text-sm text-neutral-500">
                    Apagado, no se envía nada. Lo que quede pendiente se conserva y sale al
                    volver a encenderlo.
                  </span>
                </span>
              </label>

              <div>
                <label class="form-label" for="webhook-url">URL de destino</label>
                <input id="webhook-url" type="url" class="form-input" [(ngModel)]="modelo.url"
                       placeholder="https://sistema.estudio.cl/webhooks/estado-diario"
                       autocomplete="off" spellcheck="false" />
                <p class="text-xs text-neutral-500 mt-1">
                  Debe ser https y una dirección pública: no se aceptan redes internas ni
                  localhost.
                </p>
              </div>

              <fieldset>
                <legend class="form-label">Qué reportes se envían</legend>
                <div class="flex flex-wrap gap-x-6 gap-y-2">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="modelo.enviar_estado_diario" />
                    <span class="text-sm text-neutral-700">Estado diario</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="modelo.enviar_movimientos" />
                    <span class="text-sm text-neutral-700">Movimientos</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="modelo.enviar_audiencias" />
                    <span class="text-sm text-neutral-700">Audiencias</span>
                  </label>
                </div>
              </fieldset>

              <hr class="border-neutral-200" />

              <!-- Secreto de firma -->
              <div class="space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p class="font-medium text-neutral-800">Secreto de firma</p>
                    <p class="text-sm text-neutral-500">
                      Con él, el sistema receptor comprueba que cada aviso viene de la plataforma.
                    </p>
                  </div>
                  @if (cfg.tiene_secreto) {
                    <button type="button" class="btn-secondary btn-sm"
                            (click)="confirmarRotar.set(true)" [disabled]="ocupado()">
                      Generar uno nuevo
                    </button>
                  }
                </div>

                @if (secretoNuevo(); as secreto) {
                  <div class="alert-warning">
                    <div class="flex-1 min-w-0">
                      <p class="font-medium">Copie el secreto ahora</p>
                      <p class="mt-0.5">
                        Es la única vez que se muestra. Si se pierde, hay que generar otro.
                      </p>
                      <div class="flex flex-wrap items-center gap-2 mt-2">
                        <code class="text-sm font-medium break-all">{{ secreto }}</code>
                        <button type="button" class="btn-secondary btn-sm shrink-0"
                                (click)="copiar(secreto)" aria-label="Copiar el secreto">
                          Copiar
                        </button>
                      </div>
                    </div>
                  </div>
                } @else if (cfg.tiene_secreto) {
                  <p class="text-sm text-neutral-600">
                    Hay un secreto guardado. No se puede volver a ver; para cambiarlo, genere uno
                    nuevo.
                  </p>
                } @else {
                  <p class="text-sm text-neutral-600">
                    Se genera automáticamente al guardar por primera vez.
                  </p>
                }
              </div>

              <details class="text-sm text-neutral-700">
                <summary class="cursor-pointer font-medium text-primary-700">
                  Cómo verifica la firma el sistema receptor
                </summary>
                <div class="mt-2 space-y-2 text-neutral-600">
                  <p>Cada petición es un POST con cuerpo JSON y estos encabezados:</p>
                  <ul class="list-disc pl-5 space-y-0.5">
                    <li><code>X-Webhook-Evento</code>: <code>estado_diario.importado</code>,
                      <code>movimientos.importado</code> o <code>audiencias.importado</code></li>
                    <li><code>X-Webhook-Id</code> y <code>X-Webhook-Lote</code> (<code>1/3</code>):
                      identifican el aviso. Se entrega <strong>al menos una vez</strong>: descarte
                      los repetidos con esta pareja.</li>
                    <li><code>X-Webhook-Timestamp</code>: segundos Unix del envío.</li>
                    <li><code>X-Webhook-Signature</code>: <code>sha256=</code> + HMAC-SHA256 del
                      texto <code>&lt;timestamp&gt;.&lt;cuerpo exacto&gt;</code> con el secreto.</li>
                  </ul>
                  <p>
                    Responda con un código 2xx para confirmar. Cualquier otro se reintenta. Un
                    archivo grande llega en varios lotes; conviene rechazar timestamps de hace más
                    de unos minutos.
                  </p>
                </div>
              </details>

              @if (cfg.ultimo_envio) {
                <div class="alert-info">
                  Último envío: {{ cfg.ultimo_envio | date: 'dd-MM-yyyy HH:mm' }}
                  @if (cfg.ultimo_resultado) { — {{ cfg.ultimo_resultado }} }
                </div>
              }

              @if (cfg.fallidos > 0) {
                <div class="alert-warning">
                  <div class="flex-1">
                    <p class="font-medium">
                      {{ cfg.fallidos }}
                      {{ cfg.fallidos === 1 ? 'entrega agotó' : 'entregas agotaron' }} sus intentos
                    </p>
                    <p class="mt-0.5">
                      Revise el destino y luego reintente: no se vuelven a enviar solas.
                    </p>
                  </div>
                  <button type="button" class="btn-secondary btn-sm shrink-0"
                          (click)="reintentarTodas()" [disabled]="ocupado()">
                    Reintentar fallidas
                  </button>
                </div>
              }

              @if (mensaje()) {
                <div [class]="mensajeEsError() ? 'alert-danger' : 'alert-success'">{{ mensaje() }}</div>
              }

              @if (hayCambios()) {
                <p class="text-xs text-warning-700">
                  Hay cambios sin guardar. «Enviar prueba» usa la configuración ya guardada.
                </p>
              }

              <div class="flex flex-wrap justify-end gap-3 pt-2">
                <button type="button" class="btn-secondary" (click)="probar()"
                        [disabled]="ocupado() || !cfg.url || !cfg.tiene_secreto">
                  {{ probando() ? 'Enviando...' : 'Enviar prueba' }}
                </button>
                <button type="button" class="btn-primary" (click)="guardar()" [disabled]="ocupado()">
                  {{ guardando() ? 'Guardando...' : 'Guardar webhook' }}
                </button>
              </div>
            </div>
          </div>

          <!-- ── Entregas ───────────────────────────────────────── -->
          <div class="card">
            <div class="card-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="font-semibold text-neutral-800">Entregas recientes</h2>
                <p class="text-sm text-neutral-500">
                  Un archivo grande genera varias filas, una por lote.
                </p>
              </div>
              <div class="flex items-center gap-2">
                <label class="sr-only" for="filtro-envios">Filtrar por estado</label>
                <select id="filtro-envios" class="form-select" [ngModel]="filtro()"
                        (ngModelChange)="cambiarFiltro($event)">
                  <option value="">Todas</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="enviado">Enviadas</option>
                  <option value="fallido">Fallidas</option>
                </select>
                <button type="button" class="btn-secondary btn-sm" (click)="cargarEnvios()"
                        [disabled]="cargandoEnvios()">
                  {{ cargandoEnvios() ? 'Actualizando...' : 'Actualizar' }}
                </button>
              </div>
            </div>
            <div class="card-body">
              @if (errorEnvios()) {
                <div class="alert-danger">
                  <div class="flex-1">
                    <p class="font-medium">No se pudo cargar las entregas.</p>
                    <p class="text-sm mt-1">{{ errorEnvios() }}</p>
                  </div>
                  <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargarEnvios()">
                    Reintentar
                  </button>
                </div>
              } @else if (envios().length === 0) {
                <div class="py-12 text-center">
                  <p class="text-neutral-600 font-medium">
                    {{ filtro() ? 'No hay entregas con ese estado' : 'Todavía no hay entregas' }}
                  </p>
                  @if (!filtro()) {
                    <p class="text-neutral-500 text-sm mt-1">
                      Aparecen cuando se importa un archivo desde el correo con el webhook activo.
                    </p>
                  }
                </div>
              } @else {
                <div class="table-wrapper">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Fecha</th>
                        <th scope="col">Reporte</th>
                        <th scope="col">Archivo</th>
                        <th scope="col">Lote</th>
                        <th scope="col">Filas</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Intentos</th>
                        <th scope="col">Detalle</th>
                        <th scope="col"><span class="sr-only">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (e of envios(); track e.id) {
                        <tr>
                          <td class="whitespace-nowrap">{{ e.fecha_creacion | date: 'dd-MM-yyyy HH:mm' }}</td>
                          <td class="whitespace-nowrap">{{ etiquetaTipo(e.tipo) }}</td>
                          <td class="whitespace-nowrap">{{ e.origen_id ? '#' + e.origen_id : '—' }}</td>
                          <td class="whitespace-nowrap">{{ e.lote }}/{{ e.total_lotes }}</td>
                          <td class="whitespace-nowrap">{{ e.total_registros }}</td>
                          <td><span [class]="claseEstado(e)">{{ textoEstado(e) }}</span></td>
                          <td>{{ e.intentos }}</td>
                          <td class="text-sm">
                            @if (e.estado === 'enviado') {
                              <span class="text-neutral-500">
                                {{ e.fecha_envio | date: 'dd-MM-yyyy HH:mm' }}
                              </span>
                            } @else if (e.ultimo_error) {
                              <span class="text-danger-700 break-words">{{ e.ultimo_error }}</span>
                              @if (e.estado === 'pendiente') {
                                <span class="block text-neutral-500">
                                  Próximo intento {{ e.proximo_intento | date: 'dd-MM HH:mm' }}
                                </span>
                              }
                            } @else {
                              <span class="text-neutral-500">Esperando el próximo despacho</span>
                            }
                          </td>
                          <td>
                            @if (e.estado === 'fallido') {
                              <button type="button" class="btn-secondary btn-sm"
                                      (click)="reintentar(e)" [disabled]="ocupado()">
                                Reintentar
                              </button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                @if (totalEnvios() > envios().length) {
                  <p class="text-xs text-neutral-500 mt-3">
                    Se muestran las {{ envios().length }} más recientes de {{ totalEnvios() }}.
                  </p>
                }
              }
            </div>
          </div>
        </div>
      }
    }

    <!-- Cambiar el secreto corta al receptor: nunca directo. -->
    @if (confirmarRotar()) {
      <div class="modal-backdrop animar-fondo" (click)="confirmarRotar.set(false)">
        <div class="modal-content" (click)="$event.stopPropagation()" role="dialog" aria-modal="true"
             aria-labelledby="titulo-rotar" (keydown.escape)="confirmarRotar.set(false)" tabindex="-1">
          <div class="modal-header">
            <h3 id="titulo-rotar" class="text-lg font-semibold">Generar un secreto nuevo</h3>
            <button type="button" (click)="confirmarRotar.set(false)"
                    class="text-neutral-400 hover:text-neutral-600" aria-label="Cerrar">&times;</button>
          </div>
          <div class="modal-body space-y-3">
            <p class="text-sm text-neutral-700">
              El secreto actual deja de servir <strong>de inmediato</strong>. Mientras el sistema
              receptor no use el nuevo, rechazará las firmas y los avisos quedarán sin entregar.
            </p>
            <p class="text-sm text-neutral-700">
              El nuevo se mostrará una sola vez: tenga a mano a quien administra el receptor.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="confirmarRotar.set(false)"
                    [disabled]="rotando()">Cancelar</button>
            <button type="button" class="btn-danger" (click)="rotar()" [disabled]="rotando()">
              {{ rotando() ? 'Generando...' : 'Generar secreto nuevo' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ClienteWebhookComponent implements OnInit {
  private service = inject(AdminWebhookService);
  private notification = inject(NotificationService);

  clienteId = input.required<number>();
  /** La base del cliente está lista: sin ella no hay dónde guardar entregas. */
  listo = input(true);

  config = signal<WebhookConfig | null>(null);
  error = signal<string | null>(null);
  modelo: WebhookConfigUpdate = this.vacio();

  guardando = signal(false);
  probando = signal(false);
  rotando = signal(false);
  confirmarRotar = signal(false);
  mensaje = signal('');
  mensajeEsError = signal(false);
  /** El secreto recién generado. Vive solo en memoria y se pierde al salir. */
  secretoNuevo = signal<string | null>(null);

  envios = signal<WebhookEnvio[]>([]);
  totalEnvios = signal(0);
  cargandoEnvios = signal(false);
  errorEnvios = signal<string | null>(null);
  filtro = signal<EstadoEnvio | ''>('');

  ocupado = computed(() => this.guardando() || this.probando() || this.rotando());

  ngOnInit(): void {
    if (!this.listo()) return;
    this.cargar();
  }

  private vacio(): WebhookConfigUpdate {
    return {
      url: '',
      activo: false,
      enviar_estado_diario: true,
      enviar_movimientos: true,
      enviar_audiencias: true,
    };
  }

  cargar(): void {
    this.error.set(null);
    this.service.get(this.clienteId()).subscribe({
      next: (c) => {
        this.aplicar(c);
        this.cargarEnvios();
      },
      error: (e) => this.error.set(this.mensajeError(e)),
    });
  }

  private aplicar(c: WebhookConfig): void {
    this.config.set(c);
    this.modelo = {
      url: c.url ?? '',
      activo: c.activo,
      enviar_estado_diario: c.enviar_estado_diario,
      enviar_movimientos: c.enviar_movimientos,
      enviar_audiencias: c.enviar_audiencias,
    };
  }

  /** ¿El formulario difiere de lo guardado? */
  hayCambios(): boolean {
    const c = this.config();
    if (!c) return false;
    const m = this.modelo;
    return (
      (m.url ?? '').trim() !== (c.url ?? '') ||
      m.activo !== c.activo ||
      m.enviar_estado_diario !== c.enviar_estado_diario ||
      m.enviar_movimientos !== c.enviar_movimientos ||
      m.enviar_audiencias !== c.enviar_audiencias
    );
  }

  guardar(): void {
    const url = (this.modelo.url ?? '').trim();
    if (this.modelo.activo && !url) {
      this.mostrar('Para activar el webhook indique la URL de destino', true);
      return;
    }
    if (url && !/^https:\/\//i.test(url)) {
      this.mostrar('La URL debe empezar con https://', true);
      return;
    }
    if (
      this.modelo.activo &&
      !this.modelo.enviar_estado_diario &&
      !this.modelo.enviar_movimientos &&
      !this.modelo.enviar_audiencias
    ) {
      this.mostrar('Elija al menos un reporte para enviar', true);
      return;
    }

    this.guardando.set(true);
    this.mensaje.set('');
    this.service.guardar(this.clienteId(), { ...this.modelo, url: url || null }).subscribe({
      next: (r) => {
        this.guardando.set(false);
        const { secreto, ...cfg } = r;
        this.aplicar(cfg);
        if (secreto) this.secretoNuevo.set(secreto);
        this.mostrar('Webhook guardado', false);
        this.notification.success('Webhook guardado');
      },
      error: (e) => {
        this.guardando.set(false);
        this.mostrar(this.mensajeError(e), true);
      },
    });
  }

  probar(): void {
    this.probando.set(true);
    this.mensaje.set('');
    this.service.probar(this.clienteId()).subscribe({
      next: (r) => {
        this.probando.set(false);
        this.mostrar(
          r.exito ? `Prueba enviada. ${r.mensaje}.` : `La prueba falló: ${r.mensaje}.`,
          !r.exito
        );
      },
      error: (e) => {
        this.probando.set(false);
        this.mostrar(this.mensajeError(e), true);
      },
    });
  }

  rotar(): void {
    this.rotando.set(true);
    this.service.rotarSecreto(this.clienteId()).subscribe({
      next: (r) => {
        this.rotando.set(false);
        this.confirmarRotar.set(false);
        this.secretoNuevo.set(r.secreto);
        this.mostrar('Secreto nuevo generado. Cópielo antes de salir de esta pantalla.', false);
      },
      error: (e) => {
        this.rotando.set(false);
        this.confirmarRotar.set(false);
        this.mostrar(this.mensajeError(e), true);
      },
    });
  }

  // ── Entregas ───────────────────────────────────────────────────────────

  cargarEnvios(): void {
    this.errorEnvios.set(null);
    this.cargandoEnvios.set(true);
    this.service.envios(this.clienteId(), this.filtro() || undefined).subscribe({
      next: (r) => {
        this.cargandoEnvios.set(false);
        this.envios.set(r.envios);
        this.totalEnvios.set(r.total);
      },
      error: (e) => {
        this.cargandoEnvios.set(false);
        this.errorEnvios.set(this.mensajeError(e));
      },
    });
  }

  cambiarFiltro(valor: EstadoEnvio | ''): void {
    this.filtro.set(valor);
    this.cargarEnvios();
  }

  reintentar(e: WebhookEnvio): void {
    this.service.reintentarEnvio(this.clienteId(), e.id).subscribe({
      next: () => this.tras('La entrega volvió a la cola'),
      error: (err) => this.notification.error(this.mensajeError(err)),
    });
  }

  reintentarTodas(): void {
    this.service.reintentarFallidos(this.clienteId()).subscribe({
      next: (r) => this.tras(`${r.reencolados} entregas volvieron a la cola`),
      error: (err) => this.notification.error(this.mensajeError(err)),
    });
  }

  /** Reencolar no envía nada: sale en el próximo despacho (cada ~15 min). */
  private tras(mensaje: string): void {
    this.notification.success(`${mensaje}. Saldrán en el próximo despacho.`);
    this.service.get(this.clienteId()).subscribe({ next: (c) => this.config.set(c) });
    this.cargarEnvios();
  }

  // ── Presentación ───────────────────────────────────────────────────────

  etiquetaTipo(tipo: string): string {
    switch (tipo) {
      case 'estado_diario':
        return 'Estado diario';
      case 'movimientos':
        return 'Movimientos';
      case 'audiencias':
        return 'Audiencias';
      default:
        return tipo;
    }
  }

  claseEstado(e: WebhookEnvio): string {
    switch (e.estado) {
      case 'enviado':
        return 'badge-success';
      case 'fallido':
        return 'badge-danger';
      default:
        return 'badge-warning';
    }
  }

  textoEstado(e: WebhookEnvio): string {
    switch (e.estado) {
      case 'enviado':
        return 'Enviada';
      case 'fallido':
        return 'Fallida';
      default:
        return 'Pendiente';
    }
  }

  copiar(texto: string): void {
    navigator.clipboard?.writeText(texto).then(
      () => this.notification.success('Copiado al portapapeles'),
      () => this.notification.error('El navegador no permitió copiar. Selecciónelo a mano.')
    );
  }

  private mostrar(texto: string, esError: boolean): void {
    this.mensaje.set(texto);
    this.mensajeEsError.set(esError);
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
