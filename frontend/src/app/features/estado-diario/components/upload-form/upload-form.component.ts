import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { MovimientoService } from '@features/movimientos/services/movimiento.service';
import { AudienciaService } from '@features/audiencias/services/audiencia.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { ApiResponse, TipoOrigenCargable } from '@core/models/estado-diario.model';
import { coincideConAlguno, formatearRut } from '@core/utils/rut';

/**
 * Lo que esta pantalla necesita de una carga, sea cual sea el archivo.
 *
 * Los tres servicios devuelven tipos distintos, y suscribirse a la unión de sus
 * observables no compila: TypeScript no puede unificar las firmas de
 * `subscribe`. Se declara acá el contrato común —lo único que la pantalla
 * lee— en vez de castear en el punto de uso.
 */
interface RespuestaCarga extends ApiResponse {
  movimientos_importados?: number;
  audiencias_nuevas?: number;
  audiencias_actualizadas?: number;
  /** Solo lo traen las cargas que alimentan la cartera. */
  aviso_cartera?: string | null;
}

@Component({
  selector: 'app-upload-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Cargar Archivo</h1>
        <p class="text-neutral-500 mt-1">Suba un archivo XLS/XLSX de estado diario, movimientos o audiencias</p>
        <p class="text-xs text-neutral-400 mt-1">
          El RUT y la fecha se extraen del nombre del archivo (Ej: {{ ejemploNombre() }})
        </p>
      </div>

      <div class="card">
        <div class="card-body space-y-5">
          <!-- Tipo: son tres Excel distintos y van a endpoints distintos. Se
               autodetecta por el nombre del archivo y se puede corregir a mano. -->
          <div>
            <label class="form-label">Tipo de archivo</label>
            <select class="form-select" [(ngModel)]="tipo">
              <option value="estado_diario">Estado Diario</option>
              <option value="movimientos">Movimientos</option>
              <option value="audiencias">Audiencias</option>
            </select>
          </div>

          <!-- Archivo primero -->
          <div>
            <label class="form-label">Archivo (XLS/XLSX)</label>
            <div
              class="mt-1 border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
              (click)="fileInput.click()"
              (dragover)="$event.preventDefault()"
              (drop)="onDrop($event)"
            >
              <!-- Van los tipos MIME además de las extensiones: el selector de
                   archivos de Android filtra por MIME y, con solo la extensión,
                   deja todo en gris y no se puede elegir ningún archivo. -->
              <input
                #fileInput
                type="file"
                accept=".xls,.xlsx,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
                (change)="onFileSelect($event)"
                class="hidden"
              />
              @if (selectedFile()) {
                <div class="text-primary-600">
                  <svg class="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p class="font-medium">{{ selectedFile()!.name }}</p>
                  <p class="text-sm text-neutral-500 mt-1">{{ (selectedFile()!.size / 1024).toFixed(1) }} KB</p>
                </div>
              } @else {
                <svg class="w-10 h-10 mx-auto mb-2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p class="text-neutral-500">Haga clic o arrastre un archivo aquí</p>
                <p class="text-sm text-neutral-400 mt-1">Formato: {{ ejemploNombre() }}</p>
              }
            </div>
          </div>

          <!-- El RUT y la fecha ya no se editan: salen del nombre del archivo.
               Se muestran igual, como confirmación de lo que se va a enviar:
               sin esto la carga sería una caja negra. -->
          @if (parsedInfo()) {
            <div class="alert-info">
              Datos detectados del archivo: RUT <strong>{{ parsedInfo()!.rut }}</strong>,
              Fecha <strong>{{ parsedInfo()!.fecha }}</strong>
            </div>
          }

          @if (errorMsg()) {
            <div class="alert-danger">{{ errorMsg() }}</div>
          }

          <!-- El cruce armó la cartera solo porque falta el reporte de Causas.
               Va acá y no en un toast, y por eso la pantalla NO navega: es un
               aviso que hay que leer, y desaparecería antes de eso. -->
          @if (avisoCartera()) {
            <div class="alert-warning">
              <div class="flex-1">
                <p class="font-medium">Mis Causas se armó con lo que había</p>
                <p class="text-sm mt-1">{{ avisoCartera() }}</p>
              </div>
              <a routerLink="/causas/cargar" class="btn-warning btn-sm shrink-0">
                Cargar Causas
              </a>
            </div>
          }

          <div class="flex justify-end gap-3 pt-2">
            <button (click)="onCancel()" class="btn-secondary">Cancelar</button>
            <button (click)="onUpload()" class="btn-primary" [disabled]="uploading()">
              @if (uploading()) {
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              }
              {{ uploading() ? 'Subiendo...' : 'Subir Archivo' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- El archivo parece ser de otro estudio. No se bloquea: puede ser un
         nombre mal armado, o un archivo legítimo emitido a nombre de otro RUT.
         Se avisa y decide quien carga. -->
    @if (confirmandoRut()) {
      <div class="modal-backdrop" (click)="cancelarCarga()">
        <div class="modal-content max-w-md" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">El RUT no corresponde</h3>
            <button (click)="cancelarCarga()" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>
          <div class="modal-body space-y-4">
            <div class="flex items-start gap-3">
              <div class="shrink-0 w-10 h-10 rounded-full bg-warning-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-warning-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div class="text-sm text-neutral-700 space-y-2">
                <p>
                  El archivo es del RUT <strong>{{ rutArchivo() }}</strong>, que no está
                  entre los suyos:
                  <strong>{{ rutsRegistrados() }}</strong>.
                </p>
                @if (!tieneRutsPropios()) {
                  <p class="text-neutral-500">
                    Su cuenta no tiene RUT propios registrados, así que se comparó con el
                    del estudio. Pídale a la plataforma que le cargue los suyos.
                  </p>
                }
                <p class="text-neutral-500">
                  Si continúa, los datos se cargarán igual en su estudio. Revise que sea el
                  archivo que quería subir.
                </p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button (click)="cancelarCarga()" class="btn-secondary">Cancelar</button>
            <button (click)="continuarCarga()" class="btn-primary">Continuar de todos modos</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class UploadFormComponent {
  private service = inject(EstadoDiarioService);
  private movimientoService = inject(MovimientoService);
  private audienciaService = inject(AudienciaService);
  private notification = inject(NotificationService);
  private auth = inject(AuthService);
  private router = inject(Router);

  // Ya no se editan a mano: salen del nombre del archivo y se muestran como
  // confirmación. Siguen siendo lo que se manda al servidor.
  rut = '';
  fecha = '';

  /** Se pide confirmación porque el archivo parece de otro estudio. */
  confirmandoRut = signal(false);
  /** Los tres Excel de esta pantalla tienen formatos y endpoints distintos.
   *  El de causas no está: se carga desde "Cargar Causas". */
  tipo: TipoOrigenCargable = 'estado_diario';
  selectedFile = signal<File | null>(null);
  parsedInfo = signal<{ rut: string; fecha: string } | null>(null);
  uploading = signal(false);
  errorMsg = signal('');
  /** Lo que el cruce tenga que advertir tras una carga correcta. */
  avisoCartera = signal('');

  private readonly EJEMPLOS: Record<TipoOrigenCargable, string> = {
    estado_diario: 'estadoDiario_16952077__28072026.xls',
    movimientos: 'Movimientos_16952077__30_07_2026.xls',
    audiencias: 'Audiencias_16952077_03_08_2026_09_08_2026.xls',
  };

  ejemploNombre(): string {
    return this.EJEMPLOS[this.tipo];
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.setFile(input.files[0]);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.setFile(file);
  }

  private setFile(file: File): void {
    this.selectedFile.set(file);
    // Se limpian ANTES de parsear: `parseFilename` solo los escribe cuando el
    // nombre calza con un patrón conocido, así que sin esto un archivo que no
    // calza se subiría con el RUT y la fecha del archivo ANTERIOR. Con los
    // campos a la vista eso se notaba; ahora que están ocultos, no.
    this.rut = '';
    this.fecha = '';
    this.parseFilename(file.name);
  }

  private parseFilename(filename: string): void {
    const name = filename.replace(/\.\w+$/, ''); // quitar extensión

    // Estado diario, formato actual: estadoDiario_{RUT}_{DV}_{DDMMYYYY}.xls
    // El dígito verificador va en un campo propio que suele venir vacío (de
    // ahí el doble guion bajo) y la fecha viene pegada, sin separadores.
    const matchEdNuevo = name.match(
      /^estadoDiario_(\d+)(?:-|_)?([\dkK])?_+(\d{2})(\d{2})(\d{4})$/i
    );
    // Estado diario, formato anterior: EstadoDiario{RUT}_{DD}_{MM}_{YYYY}.xls
    const matchEdViejo = name.match(
      /^estadoDiario_?(\d+(?:-[\dkK])?)_+(\d{1,2})_(\d{1,2})_(\d{4})$/i
    );
    // Movimientos: Movimientos_{RUT}__{DD}_{MM}_{YYYY}.xls
    const matchMov = name.match(/^Movimientos_(\d+[\-kK]?\d?)_+(\d{1,2})_(\d{1,2})_(\d{4})$/i);
    // Audiencias: Audiencias_{RUT}_{DD}_{MM}_{YYYY}_{DD}_{MM}_{YYYY}.xls
    // Cubre un RANGO de fechas; se toma el inicio como fecha del archivo.
    const matchAud = name.match(
      /^Audiencias_(\d+[\-kK]?\d?)_+(\d{1,2})_(\d{1,2})_(\d{4})_+\d{1,2}_\d{1,2}_\d{4}$/i
    );

    // El tipo se decide por la PALABRA del nombre, nunca por el patrón
    // completo: el PJUD renombra sus reportes sin aviso, y con el patrón
    // completo un nombre nuevo no calzaba con nada y el selector se quedaba en
    // "Estado Diario" —el valor por omisión— sin que nadie lo notara. Así se
    // grabaron movimientos como estado diario. El servidor igual verifica las
    // columnas antes de grabar, esto es solo para no hacerle elegir al usuario.
    if (/audiencia/i.test(name)) this.tipo = 'audiencias';
    else if (/movimiento/i.test(name)) this.tipo = 'movimientos';
    else if (/estado\s*_?diario/i.test(name)) this.tipo = 'estado_diario';
    else {
      this.notification.info(
        'No se pudo deducir el tipo por el nombre del archivo: revise el selector'
      );
    }

    // El formato nuevo parte el RUT en cuerpo y dígito verificador; los otros
    // dos lo traen entero, así que se normalizan a la misma forma.
    let match: RegExpMatchArray | null = null;
    let rutDetectado = '';
    if (matchEdNuevo) {
      const [, cuerpo, dv] = matchEdNuevo;
      rutDetectado = dv ? `${cuerpo}-${dv}` : cuerpo;
      match = [matchEdNuevo[0], rutDetectado, matchEdNuevo[3], matchEdNuevo[4], matchEdNuevo[5]];
    } else if (matchEdViejo ?? matchMov ?? matchAud) {
      match = matchEdViejo ?? matchMov ?? matchAud;
      rutDetectado = match![1];
    }

    if (!match && this.tipo === 'audiencias') {
      // Nombre de audiencias que no calza con el formato conocido: no es un
      // problema. El RUT queda vacío o lo pone el usuario, y la fecha la deduce
      // el servidor de la audiencia más temprana del archivo.
      this.parsedInfo.set(null);
      this.notification.info(
        'Archivo de audiencias: la fecha se tomará del contenido del archivo'
      );
      return;
    }

    if (match) {
      const rut = rutDetectado;
      const dia = match[2].padStart(2, '0');
      const mes = match[3].padStart(2, '0');
      const anio = match[4];
      const fechaStr = `${anio}-${mes}-${dia}`;

      this.rut = rut;
      this.fecha = fechaStr;
      this.parsedInfo.set({ rut, fecha: `${dia}/${mes}/${anio}` });
      this.notification.info(`RUT y fecha extraídos del nombre del archivo`);
    } else {
      this.parsedInfo.set(null);
    }
  }

  /** RUT del archivo, para el aviso. Formateado con puntos. */
  rutArchivo(): string {
    return this.rut ? formatearRut(this.rut) : '(sin RUT en el nombre)';
  }

  /**
   * Contra qué RUT se compara el del archivo.
   *
   * Primero los del usuario: el PJUD emite cada reporte a nombre del abogado
   * que lo pide, así que el RUT del archivo es el suyo y no el del estudio.
   * Un estudio con cinco abogados recibe archivos con cinco RUT distintos, y
   * comparar contra el de la ficha del cliente dejaba a cuatro de ellos con
   * una advertencia permanente que se aprendía a ignorar.
   *
   * Si la plataforma todavía no le cargó ninguno se cae al del estudio, que es
   * lo que se hacía antes: el aviso pierde precisión pero no desaparece.
   */
  private rutsDeReferencia(): string[] {
    const usuario = this.auth.user();
    const propios = (usuario?.ruts ?? []).filter((r) => !!r);
    if (propios.length) return propios;
    return usuario?.cliente_rut ? [usuario.cliente_rut] : [];
  }

  /** Los RUT registrados, para nombrarlos en el aviso. */
  rutsRegistrados(): string {
    const referencias = this.rutsDeReferencia();
    if (!referencias.length) return '(sin RUT registrado)';
    return referencias.map((r) => formatearRut(r)).join(', ');
  }

  /** true si el aviso tiene que hablar del usuario y no del estudio. */
  tieneRutsPropios(): boolean {
    return (this.auth.user()?.ruts ?? []).some((r) => !!r);
  }

  /**
   * ¿El archivo es de otro?
   *
   * Solo se opina cuando hay las dos puntas: un RUT leído del nombre y al
   * menos uno registrado. Sin alguna de las dos no hay comparación posible y
   * advertir sería ruido — el caso más común es un nombre de archivo que no
   * calza con ningún patrón conocido, que ya se maneja aparte.
   */
  private esDeOtroEstudio(): boolean {
    return !!this.rut && !coincideConAlguno(this.rut, this.rutsDeReferencia());
  }

  onUpload(): void {
    this.errorMsg.set('');

    if (!this.selectedFile()) { this.errorMsg.set('Seleccione un archivo'); return; }

    if (this.esDeOtroEstudio()) {
      this.confirmandoRut.set(true);
      return;
    }
    this.subir();
  }

  /** El usuario decidió cargar igual un archivo de otro RUT. */
  continuarCarga(): void {
    this.confirmandoRut.set(false);
    this.subir();
  }

  cancelarCarga(): void {
    this.confirmandoRut.set(false);
  }

  private subir(): void {
    this.uploading.set(true);
    const archivo = this.selectedFile()!;
    const rut = this.rut || undefined;
    const fecha = this.fecha || undefined;

    const carga: Observable<RespuestaCarga> =
      this.tipo === 'movimientos'
        ? this.movimientoService.uploadFile(archivo, rut, fecha)
        : this.tipo === 'audiencias'
          ? this.audienciaService.uploadFile(archivo, rut, fecha)
          : this.service.uploadFile(archivo, rut, fecha);

    carga.subscribe({
      next: (res) => {
        this.uploading.set(false);
        if (res.exito) {
          this.notification.success(this.mensajeCarga(res));
          if (res.aviso_cartera) {
            // Se queda en la pantalla: el aviso explica por qué Mis Causas
            // quedó como quedó, y navegar lo haría desaparecer sin leerlo.
            this.avisoCartera.set(res.aviso_cartera);
            return;
          }
          // Vuelve a Archivos, en la pestaña del tipo que se acaba de cargar.
          this.router.navigate(['/estado-diario'], { queryParams: { tab: this.tipo } });
        } else {
          this.errorMsg.set(res.mensaje || 'Error al cargar');
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.errorMsg.set(err.error?.detail || err.error?.mensaje || 'Error al cargar el archivo');
      },
    });
  }

  /**
   * Las audiencias se deduplican contra las ya cargadas (los archivos semanales
   * se traslapan), así que el resumen distingue nuevas de actualizadas: si no,
   * cargar el archivo de la semana siguiente parecería no haber hecho nada.
   */
  private mensajeCarga(res: {
    movimientos_importados?: number;
    audiencias_nuevas?: number;
    audiencias_actualizadas?: number;
  }): string {
    if (this.tipo === 'audiencias') {
      const nuevas = res.audiencias_nuevas ?? 0;
      const actualizadas = res.audiencias_actualizadas ?? 0;
      const partes = [`${nuevas} audiencias nuevas`];
      if (actualizadas > 0) partes.push(`${actualizadas} ya conocidas, actualizadas`);
      return `Archivo cargado: ${partes.join(', ')}`;
    }
    return `Archivo cargado: ${res.movimientos_importados} registros importados`;
  }

  onCancel(): void {
    this.router.navigate(['/estado-diario']);
  }
}
