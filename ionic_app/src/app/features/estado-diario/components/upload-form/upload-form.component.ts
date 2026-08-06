import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { MovimientoService } from '@features/movimientos/services/movimiento.service';
import { AudienciaService } from '@features/audiencias/services/audiencia.service';
import { NotificationService } from '@core/services/notification.service';
import { TipoOrigen } from '@core/models/estado-diario.model';

@Component({
  selector: 'app-upload-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

          @if (parsedInfo()) {
            <div class="alert-info">
              Datos detectados del archivo: RUT <strong>{{ parsedInfo()!.rut }}</strong>,
              Fecha <strong>{{ parsedInfo()!.fecha }}</strong>
            </div>
          }

          <!-- RUT y Fecha auto-completados -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="form-label">RUT</label>
              <input type="text" class="form-input" [(ngModel)]="rut" placeholder="Se extrae del archivo"
                     [class.bg-accent-50]="parsedInfo()?.rut" />
            </div>
            <div>
              <label class="form-label">Fecha del archivo</label>
              <input type="date" class="form-input" [(ngModel)]="fecha"
                     [class.bg-accent-50]="parsedInfo()?.fecha" />
            </div>
          </div>

          @if (errorMsg()) {
            <div class="alert-danger">{{ errorMsg() }}</div>
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
  `,
})
export class UploadFormComponent {
  private service = inject(EstadoDiarioService);
  private movimientoService = inject(MovimientoService);
  private audienciaService = inject(AudienciaService);
  private notification = inject(NotificationService);
  private router = inject(Router);

  rut = '';
  fecha = '';
  /** Los tres Excel del sistema tienen formatos y endpoints distintos. */
  tipo: TipoOrigen = 'estado_diario';
  selectedFile = signal<File | null>(null);
  parsedInfo = signal<{ rut: string; fecha: string } | null>(null);
  uploading = signal(false);
  errorMsg = signal('');

  private readonly EJEMPLOS: Record<TipoOrigen, string> = {
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

  onUpload(): void {
    this.errorMsg.set('');

    if (!this.selectedFile()) { this.errorMsg.set('Seleccione un archivo'); return; }

    this.uploading.set(true);
    const archivo = this.selectedFile()!;
    const rut = this.rut || undefined;
    const fecha = this.fecha || undefined;

    const carga =
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
