import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EstadoDiarioService } from '../../services/estado-diario.service';
import { NotificationService } from '@core/services/notification.service';

@Component({
  selector: 'app-upload-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Cargar Archivo</h1>
        <p class="text-neutral-500 mt-1">Suba un archivo XLS/XLSX de estado diario</p>
        <p class="text-xs text-neutral-400 mt-1">
          El RUT y la fecha se extraen del nombre del archivo (Ej: EstadoDiario17314741-4_15_07_2026.xls)
        </p>
      </div>

      <div class="card">
        <div class="card-body space-y-5">
          <!-- Archivo primero -->
          <div>
            <label class="form-label">Archivo (XLS/XLSX)</label>
            <div
              class="mt-1 border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
              (click)="fileInput.click()"
              (dragover)="$event.preventDefault()"
              (drop)="onDrop($event)"
            >
              <input #fileInput type="file" accept=".xls,.xlsx,.xlsm" (change)="onFileSelect($event)" class="hidden" />
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
                <p class="text-sm text-neutral-400 mt-1">Formato: EstadoDiarioRUT_DD_MM_YYYY.xls</p>
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
              <label class="form-label">Fecha del Estado Diario</label>
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
  private notification = inject(NotificationService);
  private router = inject(Router);

  rut = '';
  fecha = '';
  selectedFile = signal<File | null>(null);
  parsedInfo = signal<{ rut: string; fecha: string } | null>(null);
  uploading = signal(false);
  errorMsg = signal('');

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
    // Formato: EstadoDiario{RUT}_{DD}_{MM}_{YYYY}.xls
    const name = filename.replace(/\.\w+$/, ''); // quitar extensión
    const match = name.match(/^EstadoDiario(\d+[\-kK]\d?)_(\d{1,2})_(\d{1,2})_(\d{4})$/);

    if (match) {
      const rut = match[1];
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
    this.service.uploadFile(this.selectedFile()!, this.rut || undefined, this.fecha || undefined).subscribe({
      next: (res) => {
        this.uploading.set(false);
        if (res.exito) {
          this.notification.success(
            `Archivo cargado: ${res.movimientos_importados} movimientos importados`
          );
          this.router.navigate(['/estado-diario']);
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

  onCancel(): void {
    this.router.navigate(['/estado-diario']);
  }
}
