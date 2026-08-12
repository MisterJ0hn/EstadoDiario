import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { FacturaCliente } from '@core/models/factura.model';
import { ResultadoPago } from '@core/models/pago.model';
import { NotificationService } from '@core/services/notification.service';
import { FacturaService } from './factura.service';
import { PagoService } from './pago.service';

/**
 * Mis Facturas: lo que la plataforma le cobra a este estudio.
 *
 * **De solo lectura.** Generar, anular y marcar pagada viven en la consola de
 * administración y no tienen equivalente acá: el estudio es el destinatario del
 * documento, no quien lo emite.
 *
 * **Las últimas 12**, que es un año. El tope lo pone el backend; más atrás se
 * consulta puntualmente y no hojeando una tabla, así que no hay paginación.
 *
 * El detalle se abre por fila en vez de en otra pantalla: son siete líneas y la
 * pregunta ("¿por qué me cobraron esto?") se responde justo al lado del monto
 * que la disparó.
 *
 * **Lo único que el estudio sí puede hacer es pagar.** El botón aparece solo si
 * la plataforma tiene Webpay encendido y solo en las facturas emitidas. Al
 * volver de Transbank se llega a esta misma pantalla con el resultado en la
 * URL: la factura ya viene marcada pagada desde el backend, así que el aviso
 * se muestra y la lista se recarga.
 */
/** El aviso que se muestra al volver de Webpay, ya resuelto a clase y textos. */
interface AvisoPago {
  clase: string;
  titulo: string;
  mensaje: string;
}

@Component({
  selector: 'app-facturas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Mis Facturas</h1>
        <p class="text-neutral-500 mt-1">
          Orden de compra
        </p>
      </div>

      <!-- Resultado del pago, al volver de Webpay. Va arriba de todo: el
           usuario viene de otro sitio y lo primero que necesita saber es si
           le cobraron. -->
      @if (avisoPago(); as aviso) {
        <div [class]="aviso.clase">
          <div class="flex-1">
            <p class="font-medium">{{ aviso.titulo }}</p>
            <p class="text-sm mt-1">{{ aviso.mensaje }}</p>
          </div>
          <button type="button" class="btn-outline btn-sm shrink-0" (click)="cerrarAviso()">
            Cerrar
          </button>
        </div>
      }

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudieron cargar sus facturas.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">
            Reintentar
          </button>
        </div>
      } @else if (cargando()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span class="sr-only">Cargando facturas</span>
        </div>
      } @else if (facturas().length === 0) {
        <div class="card">
          <div class="card-body py-16 text-center">
            <p class="text-neutral-600 font-medium">Todavía no hay facturas emitidas</p>
            <p class="text-neutral-500 text-sm mt-1">
              La facturación se genera el día 1 de cada mes.
            </p>
          </div>
        </div>
      } @else {
        <div class="card">
          <div class="card-body">
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 class="text-sm font-semibold text-neutral-800">
                {{ facturas().length }} factura(s)
              </h2>
              <p class="text-sm text-neutral-500">
                Total cobrable:
                <strong class="text-neutral-800">
                  {{ totalMonto() | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                </strong>
              </p>
            </div>

            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col"><span class="sr-only">Detalle</span></th>
                    <th scope="col">N°</th>
                    <th scope="col">Período</th>
                    <th scope="col">Emitida</th>
                    <th scope="col" style="text-align:right!important">Causas</th>
                    <th scope="col" style="text-align:right!important">Total</th>
                    <th scope="col">Estado</th>
                    <th scope="col"><span class="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of facturas(); track f.id) {
                    <tr [class.opacity-60]="f.anulada">
                      <td>
                        <button type="button"
                                class="text-neutral-500 hover:text-neutral-800 px-1"
                                (click)="alternar(f.id)"
                                [attr.aria-expanded]="abierta() === f.id"
                                [attr.aria-label]="'Ver el detalle de la factura ' + f.numero">
                          {{ abierta() === f.id ? '▾' : '▸' }}
                        </button>
                      </td>
                      <td class="font-medium tabular-nums">{{ f.numero }}</td>
                      <td class="whitespace-nowrap">{{ nombreMes(f.periodo) }}</td>
                      <td class="whitespace-nowrap text-neutral-600">
                        {{ f.fecha_emision | date: 'dd-MM-yyyy' }}
                      </td>
                      <td class="tabular-nums" style="text-align:right!important">{{ f.total_causas }}</td>
                      <td class="tabular-nums font-semibold" style="text-align:right!important">
                        {{ f.total | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                      </td>
                      <td>
                        <span [class]="claseEstado(f.estado)"
                              [title]="f.motivo_anulacion || ''">
                          {{ etiquetaEstado(f.estado) }}
                        </span>
                      </td>
                      <td>
                        <div class="flex justify-end gap-2">
                          @if (puedePagar(f)) {
                            <button type="button" class="btn-primary btn-sm"
                                    (click)="pagar(f)" [disabled]="pagando() !== null">
                              {{ pagando() === f.id ? 'Redirigiendo...' : 'Pagar' }}
                            </button>
                          }
                          <button type="button" class="btn-outline btn-sm"
                                  (click)="descargar(f)" [disabled]="descargando() === f.id">
                            {{ descargando() === f.id ? '...' : 'PDF' }}
                          </button>
                        </div>
                      </td>
                    </tr>

                    @if (abierta() === f.id) {
                      <tr>
                        <td colspan="8" class="bg-neutral-50">
                          @if (f.detalles.length === 0) {
                            <p class="text-sm text-neutral-500 py-2">
                              Sin causas en la cartera de este período.
                            </p>
                          } @else {
                            <table class="w-full text-sm my-2">
                              <thead>
                                <tr class="text-neutral-500">
                                  <th scope="col" class="text-left font-medium py-1">Concepto</th>
                                  <th scope="col" class="font-medium py-1" style="text-align:right!important">Cantidad</th>
                                  <th scope="col" class="font-medium py-1" style="text-align:right!important">Valor U.</th>
                                  <th scope="col" class="font-medium py-1" style="text-align:right!important">Valor total</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (d of f.detalles; track d.concepto) {
                                  <tr>
                                    <td class="py-1">{{ d.concepto }}</td>
                                    <td class="py-1 tabular-nums" style="text-align:right!important">{{ d.cantidad }}</td>
                                    <td class="py-1 tabular-nums" style="text-align:right!important">
                                      {{ d.valor_unitario | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                                    </td>
                                    <td class="py-1 tabular-nums font-medium" style="text-align:right!important">
                                      {{ d.valor_total | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                                    </td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                            <p class="text-xs text-neutral-500 pb-2">
                              Los valores son los que estaban vigentes cuando se emitió la
                              factura.
                            </p>
                          }
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>

            <p class="text-xs text-neutral-500 mt-3">
              El PDF se descarga tal como se emitió. No constituye documento tributario
              del SII.
              @if (pagoHabilitado()) {
                El pago se procesa en Webpay: los datos de su tarjeta no pasan por
                este sitio.
              }
            </p>
          </div>
        </div>
      }
    </div>
  `,
})
export class FacturasComponent implements OnInit {
  private service = inject(FacturaService);
  private pagoService = inject(PagoService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  facturas = signal<FacturaCliente[]>([]);
  totalMonto = signal(0);
  cargando = signal(true);
  error = signal<string | null>(null);
  descargando = signal<number | null>(null);
  /** Qué fila tiene el detalle abierto. Una sola: son largas. */
  abierta = signal<number | null>(null);

  /** Si la plataforma tiene el pago en línea encendido. Lo dice el backend. */
  pagoHabilitado = signal(false);
  /** Qué factura se está mandando a Webpay, para no disparar dos veces. */
  pagando = signal<number | null>(null);
  avisoPago = signal<AvisoPago | null>(null);

  private readonly MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  ngOnInit(): void {
    this.leerResultadoDePago();
    this.cargar();
    // Si falla, el botón no aparece: es preferible a mostrarlo y que dé error
    // al apretarlo.
    this.pagoService.disponible().subscribe({
      next: (r) => this.pagoHabilitado.set(r.habilitado),
      error: () => this.pagoHabilitado.set(false),
    });
  }

  /**
   * Lee el desenlace que dejó el backend en la URL al volver de Webpay y la
   * limpia.
   *
   * Se limpia con `replaceUrl` para que recargar la página no vuelva a mostrar
   * el aviso de un pago que ya pasó, y para que la URL no quede con un
   * resultado viejo si el usuario la comparte o la deja en favoritos.
   */
  private leerResultadoDePago(): void {
    const params = this.route.snapshot.queryParamMap;
    const resultado = params.get('pago') as ResultadoPago | null;
    if (!resultado) return;

    const numero = params.get('factura');
    const mensaje = params.get('mensaje') || '';
    const reactivado = params.get('reactivado') === '1';

    const titulos: Record<ResultadoPago, string> = {
      exito: numero ? `Factura ${numero} pagada` : 'Pago recibido',
      rechazado: 'El pago fue rechazado',
      anulado: 'El pago no se completó',
      error: 'No pudimos confirmar el pago',
    };
    const clases: Record<ResultadoPago, string> = {
      exito: 'alert-success',
      rechazado: 'alert-danger',
      anulado: 'alert-info',
      error: 'alert-danger',
    };

    this.avisoPago.set({
      clase: clases[resultado] ?? 'alert-info',
      titulo: titulos[resultado] ?? 'Resultado del pago',
      mensaje: reactivado
        ? `${mensaje} Su cuenta quedó activa de nuevo.`
        : mensaje,
    });

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  cerrarAviso(): void {
    this.avisoPago.set(null);
  }

  /** Solo las emitidas y no anuladas se pueden pagar, y solo con Webpay encendido. */
  puedePagar(factura: FacturaCliente): boolean {
    return this.pagoHabilitado() && factura.estado === 'emitida' && !factura.anulada;
  }

  /**
   * Pide la transacción y manda al usuario a Webpay.
   *
   * A partir del `irAWebpay` la página se reemplaza por la de Transbank, así
   * que no hay nada que hacer después: el resultado vuelve por la URL de
   * retorno, que atiende el backend.
   */
  pagar(factura: FacturaCliente): void {
    this.pagando.set(factura.id);
    this.avisoPago.set(null);
    this.pagoService.iniciar(factura.id).subscribe({
      next: (pago) => this.pagoService.irAWebpay(pago),
      error: (e) => {
        this.pagando.set(null);
        this.notification.error(
          e.error?.detail || 'No se pudo iniciar el pago. Intente más tarde.'
        );
      },
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.listar().subscribe({
      next: (r) => {
        this.facturas.set(r.facturas);
        this.totalMonto.set(r.total_monto);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('Intente de nuevo en unos momentos.');
      },
    });
  }

  alternar(id: number): void {
    this.abierta.set(this.abierta() === id ? null : id);
  }

  descargar(factura: FacturaCliente): void {
    this.descargando.set(factura.id);
    this.service.descargarPdf(factura.id).subscribe({
      next: (blob) => {
        this.descargando.set(null);
        // Se revoca la URL: sin eso el navegador conserva el PDF entero en
        // memoria hasta recargar la página.
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `factura-${factura.numero}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.descargando.set(null);
        this.notification.error('No se pudo descargar el PDF');
      },
    });
  }

  /** `2026-07-01` → `julio 2026`. Sin pasar por Date, que desplaza el día. */
  nombreMes(periodo: string | null): string {
    if (!periodo) return '—';
    const [anio, mes] = periodo.split('-');
    return `${this.MESES[Number(mes) - 1] ?? mes} ${anio}`;
  }

  etiquetaEstado(estado: string): string {
    return { emitida: 'Emitida', pagada: 'Pagada', anulada: 'Anulada' }[estado] ?? estado;
  }

  claseEstado(estado: string): string {
    return (
      { emitida: 'badge-info', pagada: 'badge-success', anulada: 'badge-danger' }[estado] ??
      'badge-neutral'
    );
  }
}
