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
 */
@Component({
  selector: 'app-cargar-causas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 max-w-2xl">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Cargar Causas</h1>
        <p class="text-neutral-500 mt-1">
          Importa la cartera completa del estudio desde el Excel del PJUD
        </p>
      </div>

      <div class="card">
        <div class="card-body space-y-5">
          <div>
            <label class="form-label" for="archivo">Archivo</label>
            <input
              id="archivo"
              type="file"
              class="form-input"
              accept=".xls,.xlsx,.xlsm"
              (change)="elegirArchivo($event)"
            />
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

  archivo = signal<File | null>(null);
  cargando = signal(false);
  resultado = signal<CargarCausasResponse | null>(null);

  rut = '';
  fecha = '';

  elegirArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.archivo.set(input.files?.[0] ?? null);
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
