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
// ── Documentación del contrato ───────────────────────────────────────────
// Refleja lo que arma `construir_cuerpo` en backend/app/services/webhook_service.py.
// Si se agrega o quita un campo allá, se actualiza acá: esta tabla es lo que lee
// quien programa el receptor.

type PestanaDoc = 'mensaje' | 'estado_diario' | 'movimientos' | 'audiencias' | 'firma';

interface CampoDoc {
  campo: string;
  tipo: string;
  descripcion: string;
}

interface DocReporte {
  intro: string;
  campos: CampoDoc[];
  nota?: string;
  tituloEjemplo: string;
  ejemplo: string;
}

const json = (valor: unknown): string => JSON.stringify(valor, null, 2);

/** Campos que llevan todos los registros, sea cual sea el reporte. */
const CAMPOS_BASE: CampoDoc[] = [
  { campo: 'id', tipo: 'número', descripcion: 'Identificador interno del registro en la plataforma.' },
  {
    campo: 'jurisdiccion',
    tipo: 'texto | null',
    descripcion: 'Nombre de la jurisdicción de la causa (por ejemplo, Santiago).',
  },
];

const REGISTRO_ESTADO_DIARIO = {
  id: 9001,
  jurisdiccion: 'Santiago',
  rol: 'C-1234-2025',
  rol_unico: '1234-2025',
  fecha_ingreso: '2025-03-10',
  caratulado: 'PEREZ / GOMEZ',
  tribunal: '1º Juzgado Civil de Santiago',
  estado: 'Fallo',
  tipo_causa: 'Ordinaria',
  ubicacion: 'Archivo',
  fecha_ubicacion: '2026-09-29',
  corte: 'C.A. de Santiago',
};

const REGISTRO_MOVIMIENTOS = {
  id: 9002,
  jurisdiccion: 'Santiago',
  materia: 'Civil',
  rol: 'C-1234-2025',
  era: null,
  tribunal: '1º Juzgado Civil de Santiago',
  corte: 'C.A. de Santiago',
  caratulado: 'PEREZ / GOMEZ',
  fecha_ingreso: '2025-03-10',
  estado_causa: 'Tramitación',
  institucion: 'Estudio Uno',
  ubicacion: 'Mesón',
  fecha_ubicacion: '2026-09-29',
};

const REGISTRO_AUDIENCIAS = {
  id: 9003,
  jurisdiccion: 'Santiago',
  materia: 'Familia',
  rol: 'C-55-2026',
  ruc: null,
  caratulado: 'LOPEZ / DIAZ',
  tribunal: '2º Juzgado de Familia de Santiago',
  sala: 'Sala 3',
  tipo_audiencia: 'Preparatoria',
  juez: 'María Rojas',
  estado: null,
  fecha_audiencia: '2026-10-05',
  hora: '10:30:00',
  clave_natural: '9f2c6a1b0e3d4c5b8a7f6e5d4c3b2a1908f7e6d5',
};

const DOC: Record<Exclude<PestanaDoc, 'firma'>, DocReporte> = {
  mensaje: {
    intro:
      'Todos los avisos tienen la misma envoltura: qué ocurrió, de qué cliente y archivo, en qué ' +
      'parte del envío va, y las filas importadas. Lo que cambia según el reporte está en las ' +
      'otras pestañas.',
    campos: [
      {
        campo: 'evento',
        tipo: 'texto',
        descripcion:
          'Qué ocurrió: estado_diario.importado, movimientos.importado o audiencias.importado ' +
          '(webhook.prueba en el envío de prueba).',
      },
      {
        campo: 'evento_id',
        tipo: 'texto (UUID)',
        descripcion:
          'Identifica la importación. Es el mismo en todos los lotes de un archivo y en sus ' +
          'reintentos: úselo, junto con el lote, para no procesar dos veces el mismo aviso.',
      },
      {
        campo: 'enviado_en',
        tipo: 'fecha y hora (UTC)',
        descripcion: 'Momento en que se armó este envío. En un reintento cambia.',
      },
      { campo: 'cliente.guid', tipo: 'texto', descripcion: 'Identificador del estudio en la plataforma.' },
      { campo: 'cliente.nombre', tipo: 'texto', descripcion: 'Nombre del estudio.' },
      {
        campo: 'archivo.origen_id',
        tipo: 'número',
        descripcion: 'Identificador del archivo importado en la plataforma.',
      },
      {
        campo: 'archivo.tipo',
        tipo: 'texto',
        descripcion: 'Reporte al que corresponde: estado_diario, movimientos o audiencias.',
      },
      {
        campo: 'archivo.nombre',
        tipo: 'texto',
        descripcion: 'Nombre del adjunto que llegó por correo.',
      },
      {
        campo: 'archivo.rut',
        tipo: 'texto',
        descripcion: 'RUT del abogado dueño del reporte, con guion (12345678-9).',
      },
      {
        campo: 'archivo.fecha',
        tipo: 'fecha (AAAA-MM-DD)',
        descripcion: 'Fecha del reporte. En audiencias es el inicio del rango que cubre el archivo.',
      },
      {
        campo: 'archivo.fecha_carga',
        tipo: 'fecha y hora (UTC)',
        descripcion: 'Cuándo se importó el archivo en la plataforma.',
      },
      {
        campo: 'lote',
        tipo: 'número',
        descripcion:
          'Un archivo grande se envía en partes de hasta 500 registros. Este es el número de la parte, desde 1.',
      },
      { campo: 'total_lotes', tipo: 'número', descripcion: 'Cuántas partes tiene el archivo en total.' },
      {
        campo: 'total_registros',
        tipo: 'número',
        descripcion: 'Filas del archivo completo, no solo de este lote.',
      },
      {
        campo: 'registros',
        tipo: 'lista',
        descripcion:
          'Las filas de este lote. Su contenido depende del reporte (ver las otras pestañas). ' +
          'Va vacía en el envío de prueba.',
      },
    ],
    nota: 'Las fechas van en formato ISO 8601. Los datos que el reporte no trae llegan como null.',
    tituloEjemplo: 'Ejemplo de un aviso completo',
    ejemplo: json({
      evento: 'audiencias.importado',
      evento_id: '0b7c1c0e-5d0a-4a43-9a3e-2f6f3f6f9a11',
      enviado_en: '2026-09-30T14:05:12.345678+00:00',
      cliente: { guid: 'a1b2c3', nombre: 'Estudio Uno' },
      archivo: {
        origen_id: 57,
        tipo: 'audiencias',
        nombre: 'audiencias_2026-10-05.xlsx',
        rut: '12345678-9',
        fecha: '2026-10-05',
        fecha_carga: '2026-09-30T14:05:10.120000+00:00',
      },
      lote: 1,
      total_lotes: 3,
      total_registros: 1200,
      registros: [REGISTRO_AUDIENCIAS],
    }),
  },

  estado_diario: {
    intro:
      'Las causas con novedad en el día, tal como las informa el Poder Judicial. Cada elemento de ' +
      '«registros» es una causa, con estos campos:',
    campos: [
      ...CAMPOS_BASE,
      { campo: 'rol', tipo: 'texto | null', descripcion: 'Rol de la causa (por ejemplo, C-1234-2025).' },
      { campo: 'rol_unico', tipo: 'texto | null', descripcion: 'Rol único nacional de la causa.' },
      { campo: 'fecha_ingreso', tipo: 'fecha | null', descripcion: 'Fecha en que ingresó la causa al tribunal.' },
      { campo: 'caratulado', tipo: 'texto | null', descripcion: 'Nombre de la causa: las partes (demandante / demandado).' },
      { campo: 'tribunal', tipo: 'texto | null', descripcion: 'Tribunal donde se tramita.' },
      { campo: 'estado', tipo: 'texto | null', descripcion: 'Estado de la causa según el reporte.' },
      { campo: 'tipo_causa', tipo: 'texto | null', descripcion: 'Tipo de causa (por ejemplo, Ordinaria).' },
      { campo: 'ubicacion', tipo: 'texto | null', descripcion: 'Dónde se encuentra la causa en su tramitación.' },
      { campo: 'fecha_ubicacion', tipo: 'fecha | null', descripcion: 'Desde cuándo está en esa ubicación.' },
      { campo: 'corte', tipo: 'texto | null', descripcion: 'Corte de Apelaciones a la que corresponde.' },
    ],
    tituloEjemplo: 'Ejemplo de un elemento de «registros»',
    ejemplo: json(REGISTRO_ESTADO_DIARIO),
  },

  movimientos: {
    intro:
      'El universo de causas vigentes del abogado con su estado procesal. Cada elemento de ' +
      '«registros» es una causa, con estos campos:',
    campos: [
      ...CAMPOS_BASE,
      {
        campo: 'materia',
        tipo: 'texto | null',
        descripcion:
          'Materia de la causa: Civil, Familia, Laboral, Cobranza, Penal, Corte de Apelaciones o Corte Suprema.',
      },
      { campo: 'rol', tipo: 'texto | null', descripcion: 'Rol de la causa (RIT en primera instancia).' },
      { campo: 'era', tipo: 'texto | null', descripcion: 'Solo en causas de Corte. En el resto llega null.' },
      { campo: 'tribunal', tipo: 'texto | null', descripcion: 'Tribunal donde se tramita.' },
      { campo: 'corte', tipo: 'texto | null', descripcion: 'Corte de Apelaciones a la que corresponde.' },
      { campo: 'caratulado', tipo: 'texto | null', descripcion: 'Nombre de la causa: las partes.' },
      { campo: 'fecha_ingreso', tipo: 'fecha | null', descripcion: 'Fecha en que ingresó la causa.' },
      {
        campo: 'estado_causa',
        tipo: 'texto | null',
        descripcion: 'Estado procesal: Tramitación, Concluido, Con sentencia, etc.',
      },
      {
        campo: 'institucion',
        tipo: 'texto | null',
        descripcion: 'Identificador del cliente o gestión en el Poder Judicial.',
      },
      { campo: 'ubicacion', tipo: 'texto | null', descripcion: 'Dónde se encuentra la causa en su tramitación.' },
      { campo: 'fecha_ubicacion', tipo: 'fecha | null', descripcion: 'Desde cuándo está en esa ubicación.' },
    ],
    tituloEjemplo: 'Ejemplo de un elemento de «registros»',
    ejemplo: json(REGISTRO_MOVIMIENTOS),
  },

  audiencias: {
    intro:
      'Las audiencias que el tribunal agendó para el rango de fechas del archivo. Cada elemento de ' +
      '«registros» es una audiencia, con estos campos:',
    campos: [
      ...CAMPOS_BASE,
      { campo: 'materia', tipo: 'texto | null', descripcion: 'Materia: Familia, Laboral o Penal.' },
      {
        campo: 'rol',
        tipo: 'texto | null',
        descripcion: 'RIT de la causa. Las audiencias penales no lo traen: se identifican por RUC.',
      },
      { campo: 'ruc', tipo: 'texto | null', descripcion: 'RUC de la causa (Rol Único de Causa, propio del ámbito penal).' },
      { campo: 'caratulado', tipo: 'texto | null', descripcion: 'Nombre de la causa: las partes.' },
      { campo: 'tribunal', tipo: 'texto | null', descripcion: 'Tribunal donde se realiza.' },
      { campo: 'sala', tipo: 'texto | null', descripcion: 'Sala de la audiencia.' },
      { campo: 'tipo_audiencia', tipo: 'texto | null', descripcion: 'Clase de audiencia (por ejemplo, Preparatoria).' },
      { campo: 'juez', tipo: 'texto | null', descripcion: 'Juez a cargo.' },
      {
        campo: 'estado',
        tipo: 'texto | null',
        descripcion: 'Estado de la audiencia (agendada, realizada…). Solo lo informan las audiencias penales.',
      },
      { campo: 'fecha_audiencia', tipo: 'fecha', descripcion: 'Día en que se realiza. Siempre viene.' },
      {
        campo: 'hora',
        tipo: 'hora (HH:MM:SS) | null',
        descripcion: 'Hora de inicio, en hora local del tribunal (Chile). Puede no venir.',
      },
      {
        campo: 'clave_natural',
        tipo: 'texto',
        descripcion:
          'Huella (SHA-1) que identifica la audiencia. La misma clave en archivos distintos es la ' +
          'misma audiencia.',
      },
    ],
    nota:
      'Los archivos de audiencias se traslapan entre semanas, así que una misma audiencia puede ' +
      'llegar en avisos distintos. Use clave_natural para actualizar la que ya tiene en lugar de ' +
      'crear una repetida.',
    tituloEjemplo: 'Ejemplo de un elemento de «registros»',
    ejemplo: json(REGISTRO_AUDIENCIAS),
  },
};

const ENCABEZADOS: { nombre: string; descripcion: string }[] = [
  {
    nombre: 'X-Webhook-Evento',
    descripcion: 'El tipo de evento; es el mismo valor que el campo «evento» del cuerpo.',
  },
  {
    nombre: 'X-Webhook-Id',
    descripcion: 'Identificador del aviso (igual a «evento_id»). Sirve para descartar repetidos.',
  },
  {
    nombre: 'X-Webhook-Lote',
    descripcion: 'Parte del envío en formato lote/total, por ejemplo 2/3.',
  },
  {
    nombre: 'X-Webhook-Timestamp',
    descripcion: 'Momento del envío en segundos Unix. Forma parte de lo que se firma.',
  },
  {
    nombre: 'X-Webhook-Signature',
    descripcion: 'sha256= seguido de la firma HMAC-SHA256 hexadecimal.',
  },
];

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

          <!-- ── Estructura de los datos ────────────────────────── -->
          <div class="card max-w-3xl">
            <div class="card-header">
              <h2 class="font-semibold text-neutral-800">Estructura de los datos</h2>
              <p class="text-sm text-neutral-500">
                Así viajan los avisos hacia el sistema receptor. Conviene compartir esta sección
                con quien lo programa.
              </p>
            </div>
            <div class="border-b border-neutral-200 px-4">
              <nav class="tabs-nav" role="tablist" aria-label="Estructura del aviso">
                @for (t of pestanasDoc; track t.clave) {
                  <button type="button" role="tab" class="tab-link"
                          [attr.aria-selected]="tabDoc() === t.clave"
                          [class.tab-link-activo]="tabDoc() === t.clave"
                          (click)="tabDoc.set(t.clave)">
                    {{ t.etiqueta }}
                  </button>
                }
              </nav>
            </div>
            <div class="card-body space-y-4">
              @if (tabDoc() === 'firma') {
                <div class="space-y-3 text-sm text-neutral-700">
                  <p>
                    Cada aviso es una petición <code>POST</code> con cuerpo JSON (UTF-8) y estos
                    encabezados:
                  </p>
                  <div class="table-wrapper">
                    <table class="data-table">
                      <thead>
                        <tr><th scope="col">Encabezado</th><th scope="col">Qué contiene</th></tr>
                      </thead>
                      <tbody>
                        @for (h of encabezados; track h.nombre) {
                          <tr>
                            <td class="whitespace-nowrap"><code>{{ h.nombre }}</code></td>
                            <td>{{ h.descripcion }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <p class="font-medium text-neutral-800">Cómo verificar la firma</p>
                  <ol class="list-decimal pl-5 space-y-1">
                    <li>Tome el cuerpo <strong>tal como llegó</strong>, antes de interpretarlo como JSON.</li>
                    <li>Arme el texto <code>&lt;X-Webhook-Timestamp&gt;.&lt;cuerpo&gt;</code>.</li>
                    <li>Calcule su HMAC-SHA256 con el secreto de firma y compárelo con el valor que
                      viene después de <code>sha256=</code>.</li>
                    <li>Rechace el aviso si la firma no calza o si el timestamp tiene más de unos
                      minutos de antigüedad.</li>
                  </ol>
                  <p class="font-medium text-neutral-800">Qué responder y qué pasa si falla</p>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Un código <strong>2xx</strong> confirma la recepción. Cualquier otro se
                      reintenta, con esperas crecientes, hasta 6 veces. Después queda como fallida
                      hasta que se reintente a mano.</li>
                    <li>La entrega es <strong>al menos una vez</strong>: un mismo aviso puede llegar
                      repetido. Descártelo usando <code>X-Webhook-Id</code> junto con
                      <code>X-Webhook-Lote</code>.</li>
                    <li>No se siguen redirecciones: la URL configurada debe responder directamente.</li>
                  </ul>
                </div>
              } @else {
                <p class="text-sm text-neutral-700">{{ docActual().intro }}</p>

                <div class="table-wrapper">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Campo</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">Qué es</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of docActual().campos; track c.campo) {
                        <tr>
                          <td class="whitespace-nowrap font-medium"><code>{{ c.campo }}</code></td>
                          <td class="whitespace-nowrap text-neutral-500">{{ c.tipo }}</td>
                          <td class="text-sm">{{ c.descripcion }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                @if (docActual().nota) {
                  <p class="text-sm text-neutral-600">{{ docActual().nota }}</p>
                }

                <div>
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <p class="text-sm font-medium text-neutral-800">{{ docActual().tituloEjemplo }}</p>
                    <button type="button" class="btn-secondary btn-sm"
                            (click)="copiar(docActual().ejemplo)">Copiar ejemplo</button>
                  </div>
                  <pre class="text-xs bg-neutral-50 border border-neutral-200 rounded-lg p-4 overflow-x-auto"><code>{{ docActual().ejemplo }}</code></pre>
                </div>
              }
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

  readonly pestanasDoc: { clave: PestanaDoc; etiqueta: string }[] = [
    { clave: 'mensaje', etiqueta: 'El aviso' },
    { clave: 'estado_diario', etiqueta: 'Estado diario' },
    { clave: 'movimientos', etiqueta: 'Movimientos' },
    { clave: 'audiencias', etiqueta: 'Audiencias' },
    { clave: 'firma', etiqueta: 'Firma y entrega' },
  ];
  readonly encabezados = ENCABEZADOS;
  tabDoc = signal<PestanaDoc>('mensaje');
  docActual = computed<DocReporte>(() => {
    const t = this.tabDoc();
    return DOC[t === 'firma' ? 'mensaje' : t];
  });

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
