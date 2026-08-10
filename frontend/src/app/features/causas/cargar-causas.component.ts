import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CargarCausasResponse } from '@core/models/causa.model';
import { NotificationService } from '@core/services/notification.service';
import { CausaService } from './services/causa.service';

/**
 * Carga del Excel de causas (menú **Cargar Causas**).
 *
 * Va aparte de "Cargar Archivo" —que sube estado diario, movimientos y
 * audiencias— porque este reporte se comporta distinto: **no trae fecha**, ni
 * en el nombre ni adentro. Es una foto de la cartera al momento de emitirlo,
 * así que la fecha la pone quien carga y por defecto es hoy.
 *
 * La pantalla es deliberadamente igual a la de "Cargar Archivo": misma tarjeta
 * centrada y la misma zona de arrastre. Son dos cargas de Excel y no había
 * ninguna razón para que se vieran distinto; la única diferencia real es que
 * acá no se elige el tipo, porque solo hay uno.
 */
@Component({
  selector: 'app-cargar-causas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Cargar Causas</h1>
        <p class="text-neutral-500 mt-1">
          Importa la cartera completa del estudio desde el Excel del PJUD
        </p>
        <p class="text-xs text-neutral-400 mt-1">
          El RUT se extrae del nombre del archivo (Ej: {{ EJEMPLO_NOMBRE }})
        </p>
      </div>

      <div class="card">
        <div class="card-body space-y-5">
          <div>
            <label class="form-label">Archivo (XLS/XLSX)</label>
            <div
              class="mt-1 border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
              (click)="fileInput.click()"
              (dragover)="$event.preventDefault()"
              (drop)="alSoltar($event)"
            >
              <!-- Van los tipos MIME además de las extensiones: el selector de
                   archivos de Android filtra por MIME y, con solo la extensión,
                   deja todo en gris y no se puede elegir ningún archivo. -->
              <input
                #fileInput
                type="file"
                accept=".xls,.xlsx,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
                (change)="elegirArchivo($event)"
                class="hidden"
              />
              @if (archivo()) {
                <div class="text-primary-600">
                  <svg class="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p class="font-medium">{{ archivo()!.name }}</p>
                  <p class="text-sm text-neutral-500 mt-1">{{ (archivo()!.size / 1024).toFixed(1) }} KB</p>
                </div>
              } @else {
                <svg class="w-10 h-10 mx-auto mb-2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p class="text-neutral-500">Haga clic o arrastre un archivo aquí</p>
                <p class="text-sm text-neutral-400 mt-1">Formato: {{ EJEMPLO_NOMBRE }}</p>
              }
            </div>
            <p class="text-xs text-neutral-500 mt-1">
              El archivo que entrega el PJUD, con las hojas Civil, Laboral, Penal, Cobranza,
              Familia y las dos de Corte.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="form-label" for="rut">RUT (opcional)</label>
              <input id="rut" type="text" class="form-input" [(ngModel)]="rut"
                     placeholder="Se toma del nombre del archivo" />
              <p class="text-xs text-neutral-500 mt-1">
                Solo si el nombre no sigue el formato Causas_RUT.xlsx
              </p>
            </div>
            <div>
              <label class="form-label" for="fecha">Fecha del reporte</label>
              <input id="fecha" type="date" class="form-input" [(ngModel)]="fecha" />
              <p class="text-xs text-neutral-500 mt-1">
                Este reporte no trae fecha; si la deja vacía se usa hoy.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button type="button" class="btn-primary" [disabled]="!archivo() || cargando()"
                    (click)="cargar()">
              @if (cargando()) {
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              }
              {{ cargando() ? 'Importando...' : 'Importar causas' }}
            </button>
            @if (cargando()) {
              <span class="text-sm text-neutral-500">
                Puede tardar: el archivo suele traer miles de filas.
              </span>
            }
          </div>

          @if (resultado(); as r) {
            @if (r.exito) {
              <div class="alert-success block">
                <p class="font-medium">{{ r.mensaje }}</p>
                @if (objetoAKeys(r.por_materia).length) {
                  <ul class="mt-2 text-sm space-y-0.5">
                    @for (m of objetoAKeys(r.por_materia); track m) {
                      <li>{{ m }}: {{ r.por_materia[m] }}</li>
                    }
                  </ul>
                }
                <div class="mt-3 flex gap-2">
                  <button type="button" class="btn-secondary btn-sm" (click)="verCausas(r)">
                    Ver las causas
                  </button>
                </div>
              </div>
            } @else {
              <div class="alert-danger">
                <div class="flex-1">{{ r.mensaje }}</div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class CargarCausasComponent {
  private service = inject(CausaService);
  private notification = inject(NotificationService);
  private router = inject(Router);

  /** Nombre de ejemplo, del que el servidor saca el RUT si no se indica. */
  readonly EJEMPLO_NOMBRE = 'Causas_16952077.xlsx';

  archivo = signal<File | null>(null);
  cargando = signal(false);
  resultado = signal<CargarCausasResponse | null>(null);

  rut = '';
  fecha = '';

  elegirArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    if (input.files?.length) {
      this.ponerArchivo(input.files[0]);
    }
  }

  alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    const archivo = evento.dataTransfer?.files?.[0];
    if (archivo) this.ponerArchivo(archivo);
  }

  private ponerArchivo(archivo: File): void {
    this.archivo.set(archivo);
    // Un resultado anterior junto a un archivo nuevo se lee como si fuera de
    // ese archivo.
    this.resultado.set(null);
  }

  cargar(): void {
    const archivo = this.archivo();
    if (!archivo || this.cargando()) return;

    this.cargando.set(true);
    this.resultado.set(null);

    this.service.cargar(archivo, this.rut.trim() || undefined, this.fecha || undefined).subscribe({
      next: (r) => {
        this.cargando.set(false);
        this.resultado.set(r);
        if (r.exito) {
          this.notification.success(r.mensaje);
        } else {
          this.notification.error(r.mensaje);
        }
      },
      error: () => {
        this.cargando.set(false);
        this.notification.error('No se pudo importar el archivo');
      },
    });
  }

  verCausas(r: CargarCausasResponse): void {
    this.router.navigate(['/causas'], { queryParams: { origen_id: r.origen_id } });
  }

  objetoAKeys(obj: Record<string, number> | undefined): string[] {
    return Object.keys(obj ?? {});
  }
}
