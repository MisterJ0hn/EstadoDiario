import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Cliente } from '@core/models/admin.model';
import {
  FiltroPjudLlamados,
  PjudLlamado,
  ResultadoPjud,
} from '@core/models/pjud-log.model';
import { NotificationService } from '@core/services/notification.service';
import {
  ChipFiltro,
  FiltrosPanelComponent,
} from '@shared/components/filtros-panel/filtros-panel.component';
import { AdminClienteService } from '../services/admin-cliente.service';
import { PjudLogService } from './pjud-log.service';

/**
 * Log de consultas a api-pjud.codifica.cl.
 *
 * **Para qué.** Cuando un estudio dice "aprieto Detalle PJUD y solo me dice que
 * está sincronizando", acá está qué pasó: si la causa quedó encolada en el
 * proveedor, si rechazó las credenciales, si el tribunal no estaba en el
 * catálogo, cuánto tardó.
 *
 * **Es global**, no por cliente: la credencial de api-pjud es de la plataforma
 * y las filas viven todas en la base principal. Por eso —al revés que la
 * bitácora— acá sí cuelga del menú y muestra todo de entrada; el cliente es un
 * filtro más.
 *
 * **Solo lectura.** Solo crece; se purga por antigüedad más adelante.
 */
@Component({
  selector: 'app-pjud-llamados',
  standalone: true,
  imports: [CommonModule, FormsModule, FiltrosPanelComponent],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Consultas a la API del PJUD</h1>
        <p class="text-neutral-500 mt-1">
          Cada vez que un estudio abre "Detalle PJUD" de una causa Civil.
          @if (resumenTexto()) {
            <span class="text-neutral-600">· últimos 7 días: {{ resumenTexto() }}</span>
          }
        </p>
      </div>

      <app-filtros-panel
        [chips]="chips()"
        titulo="Filtrar las consultas"
        (aplicar)="aplicar()"
        (limpiar)="limpiar()"
        (quitar)="quitarChip($event)"
      >
        <div>
          <label class="form-label" for="p-q">Buscar</label>
          <input id="p-q" type="search" class="form-input" [(ngModel)]="borrador.q"
                 (keyup.enter)="aplicar()" placeholder="rol, tribunal o mensaje…" />
        </div>

        <div>
          <label class="form-label" for="p-cliente">Cliente</label>
          <select id="p-cliente" class="form-select" [(ngModel)]="borrador.cliente_id">
            <option [ngValue]="''">Todos</option>
            @for (c of clientes(); track c.id) {
              <option [ngValue]="c.id">{{ c.nombre }}</option>
            }
          </select>
        </div>

        <div>
          <label class="form-label" for="p-resultado">Resultado</label>
          <select id="p-resultado" class="form-select" [(ngModel)]="borrador.resultado">
            <option [ngValue]="''">Todos</option>
            <option value="listo">Listo</option>
            <option value="sincronizando">Sincronizando</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label" for="p-desde">Desde</label>
            <input id="p-desde" type="date" class="form-input" [(ngModel)]="borrador.desde" />
          </div>
          <div>
            <label class="form-label" for="p-hasta">Hasta</label>
            <input id="p-hasta" type="date" class="form-input" [(ngModel)]="borrador.hasta" />
          </div>
        </div>
      </app-filtros-panel>

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudo cargar el log.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">Reintentar</button>
        </div>
      }

      <div class="card">
        <div class="card-body">
          @if (cargando()) {
            <div class="flex items-center justify-center py-16">
              <svg class="animate-spin h-8 w-8 text-primary-600" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span class="sr-only">Cargando</span>
            </div>
          } @else if (registros().length === 0) {
            <div class="py-16 text-center">
              <p class="text-neutral-600 font-medium">Sin consultas registradas</p>
              <p class="text-neutral-500 text-sm mt-1">
                @if (chips().length) {
                  Pruebe con otro filtro, o
                  <button type="button" class="text-primary-700 hover:underline" (click)="limpiar()">quítelos todos</button>.
                } @else {
                  Ningún estudio ha abierto todavía "Detalle PJUD".
                }
              </p>
            </div>
          } @else {
            <p class="text-sm text-neutral-500 mb-3">{{ total() }} consulta(s)</p>

            <p class="text-xs text-neutral-400 mb-2">Haz clic en una fila para ver el diagnóstico paso a paso.</p>
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Tribunal</th>
                    <th scope="col">Resultado</th>
                    <th scope="col">HTTP</th>
                    <th scope="col">Duración</th>
                    <th scope="col">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of registros(); track r.id) {
                    <tr class="cursor-pointer" (click)="alternar(r.id)">
                      <td class="whitespace-nowrap tabular-nums">
                        {{ r.fecha_hora | date: 'dd-MM-yyyy HH:mm:ss' }}
                      </td>
                      <td class="whitespace-nowrap">
                        {{ r.cliente_nombre || '—' }}
                      </td>
                      <td class="whitespace-nowrap">
                        {{ r.rol || '—' }}
                        @if (r.forzar) {
                          <span class="badge-neutral" title="El usuario pidió actualizar">↻</span>
                        }
                      </td>
                      <td class="max-w-[220px] truncate" [title]="r.tribunal || ''">
                        {{ r.tribunal || '—' }}
                      </td>
                      <td>
                        <span [class]="badgeResultado(r.resultado)">{{ etiqueta(r.resultado) }}</span>
                      </td>
                      <td class="tabular-nums text-neutral-500">{{ r.http_status ?? '—' }}</td>
                      <td class="tabular-nums text-neutral-500 whitespace-nowrap">
                        {{ r.duracion_ms != null ? (r.duracion_ms + ' ms') : '—' }}
                      </td>
                      <td class="max-w-[360px] truncate" [title]="r.mensaje || ''">
                        {{ r.mensaje || '—' }}
                      </td>
                    </tr>
                    @if (expandida() === r.id) {
                      <tr>
                        <td colspan="8" class="bg-neutral-50 !whitespace-normal">
                          <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 py-1 text-sm">
                            @if (r.mensaje) {
                              <dt class="text-neutral-500">Mensaje</dt>
                              <dd>{{ r.mensaje }}</dd>
                            }
                            <dt class="text-neutral-500">Diagnóstico</dt>
                            <dd class="font-mono text-xs whitespace-pre-wrap break-words">
                              {{ r.diagnostico || 'Sin diagnóstico registrado.' }}
                            </dd>
                          </dl>
                          @if (r.resultado === 'sincronizando' || r.resultado === 'error') {
                            <p class="text-xs text-neutral-500 mt-1">
                              Si el diagnóstico dice <code>consultar_civil: 404</code> tras varios intentos,
                              api-pjud nunca llegó a crear la causa: revisar <code>worker.log</code> y la tabla
                              <code>sync_job</code> en el servidor de api-pjud (login al OJV, CAPTCHA, worker caído).
                            </p>
                          }
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>

            @if (totalPaginas() > 1) {
              <div class="flex items-center justify-between mt-4">
                <span class="text-sm text-neutral-500">Página {{ pagina() }} de {{ totalPaginas() }}</span>
                <div class="flex gap-2">
                  <button type="button" class="btn-secondary btn-sm"
                          (click)="irA(pagina() - 1)" [disabled]="pagina() <= 1">Anterior</button>
                  <button type="button" class="btn-secondary btn-sm"
                          (click)="irA(pagina() + 1)" [disabled]="pagina() >= totalPaginas()">Siguiente</button>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class PjudLlamadosComponent implements OnInit {
  private service = inject(PjudLogService);
  private clienteService = inject(AdminClienteService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  clientes = signal<Cliente[]>([]);
  registros = signal<PjudLlamado[]>([]);
  resumen = signal<Partial<Record<ResultadoPjud, number>>>({});
  total = signal(0);
  pagina = signal(1);
  totalPaginas = signal(1);
  cargando = signal(false);
  error = signal<string | null>(null);
  /** Id de la fila cuyo diagnóstico está desplegado; null = ninguna. */
  expandida = signal<number | null>(null);

  borrador: Borrador = vacio();
  private aplicado = signal<Borrador>(vacio());

  resumenTexto = computed(() => {
    const r = this.resumen();
    const partes: string[] = [];
    if (r.listo) partes.push(`${r.listo} ok`);
    if (r.sincronizando) partes.push(`${r.sincronizando} sincronizando`);
    if (r.sin_credenciales) partes.push(`${r.sin_credenciales} sin clave`);
    if (r.error) partes.push(`${r.error} con error`);
    return partes.join(', ');
  });

  chips = computed<ChipFiltro[]>(() => {
    const f = this.aplicado();
    const lista: ChipFiltro[] = [];
    if (f.q) lista.push({ clave: 'q', etiqueta: 'Texto', valor: f.q });
    if (f.cliente_id) {
      const nombre = this.clientes().find((c) => c.id === Number(f.cliente_id))?.nombre;
      lista.push({ clave: 'cliente_id', etiqueta: 'Cliente', valor: nombre ?? String(f.cliente_id) });
    }
    if (f.resultado) lista.push({ clave: 'resultado', etiqueta: 'Resultado', valor: f.resultado });
    if (f.desde) lista.push({ clave: 'desde', etiqueta: 'Desde', valor: legible(f.desde) });
    if (f.hasta) lista.push({ clave: 'hasta', etiqueta: 'Hasta', valor: legible(f.hasta) });
    return lista;
  });

  ngOnInit(): void {
    this.clienteService.list(1, 200).subscribe({
      next: (r) => this.clientes.set(r.clientes),
      error: () => this.notification.error('No se pudo cargar la lista de clientes'),
    });

    // El cliente puede llegar por query param, para poder abrir el log ya
    // acotado a un estudio desde su ficha.
    this.route.queryParamMap.subscribe((params) => {
      const cliente = params.get('cliente');
      this.borrador.cliente_id = cliente ? Number(cliente) : '';
      this.aplicado.set({ ...this.borrador });
      this.pagina.set(1);
      this.cargar();
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    const f = this.aplicado();
    const filtro: FiltroPjudLlamados = {
      q: f.q || null,
      cliente_id: f.cliente_id === '' ? null : Number(f.cliente_id),
      resultado: f.resultado || null,
      desde: f.desde || null,
      hasta: f.hasta || null,
      page: this.pagina(),
      per_page: 50,
    };
    this.service.listar(filtro).subscribe({
      next: (r) => {
        this.registros.set(r.registros);
        this.total.set(r.total);
        this.pagina.set(r.page);
        this.totalPaginas.set(r.total_pages);
        this.resumen.set(r.resumen);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.registros.set([]);
        const detalle = (e as { error?: { detail?: unknown } })?.error?.detail;
        this.error.set(
          typeof detalle === 'string' ? detalle : 'Intente de nuevo en unos momentos.',
        );
      },
    });
  }

  aplicar(): void {
    this.aplicado.set({ ...this.borrador });
    this.pagina.set(1);
    this.cargar();
  }

  limpiar(): void {
    this.borrador = vacio();
    this.aplicado.set(vacio());
    this.pagina.set(1);
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    this.cargar();
  }

  quitarChip(clave: string): void {
    this.borrador = { ...this.borrador, [clave]: '' };
    this.aplicar();
  }

  irA(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) return;
    this.pagina.set(pagina);
    this.cargar();
  }

  alternar(id: number): void {
    this.expandida.set(this.expandida() === id ? null : id);
  }

  etiqueta(r: ResultadoPjud): string {
    return {
      listo: 'Listo',
      sincronizando: 'Sincronizando',
      sin_credenciales: 'Sin clave',
      error: 'Error',
    }[r];
  }

  badgeResultado(r: ResultadoPjud): string {
    return {
      listo: 'badge-success',
      sincronizando: 'badge-warning',
      sin_credenciales: 'badge-neutral',
      error: 'badge-danger',
    }[r];
  }
}

interface Borrador {
  q: string;
  cliente_id: number | '';
  resultado: ResultadoPjud | '';
  desde: string;
  hasta: string;
}

function vacio(): Borrador {
  return { q: '', cliente_id: '', resultado: '', desde: '', hasta: '' };
}

/** `2026-08-12` → `12-08-2026`, sin pasar por Date (que desplaza el día). */
function legible(iso: string): string {
  const [a, m, d] = iso.split('-');
  return d ? `${d}-${m}-${a}` : iso;
}
