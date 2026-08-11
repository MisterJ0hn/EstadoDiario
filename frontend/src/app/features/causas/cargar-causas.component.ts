import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CargarCausasResponse } from '@core/models/causa.model';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { coincideConAlguno, formatearRut } from '@core/utils/rut';
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

          <!-- El RUT y la fecha ya no se editan. El RUT sale del nombre del
               archivo y la fecha es hoy: este reporte no trae fecha, es una
               foto de la cartera al momento de emitirlo. Se muestran igual,
               como confirmación de lo que se va a enviar. -->
          @if (archivo()) {
            <div class="alert-info">
              @if (rutDetectado()) {
                RUT detectado del archivo: <strong>{{ rutArchivo() }}</strong>.
              } @else {
                El nombre no sigue el formato <strong>{{ EJEMPLO_NOMBRE }}</strong>: el RUT lo
                deducirá el servidor.
              }
              La fecha del reporte será <strong>hoy</strong>.
            </div>
          }

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
                  Si continúa, la cartera se cargará igual en su estudio. Revise que sea el
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
export class CargarCausasComponent {
  private service = inject(CausaService);
  private notification = inject(NotificationService);
  private auth = inject(AuthService);
  private router = inject(Router);

  /** Nombre de ejemplo, del que el servidor saca el RUT si no se indica. */
  readonly EJEMPLO_NOMBRE = 'Causas_16952077.xlsx';

  archivo = signal<File | null>(null);
  cargando = signal(false);
  resultado = signal<CargarCausasResponse | null>(null);

  /** RUT leído del nombre del archivo. Solo se usa para avisar si es de otro
   *  estudio: al servidor no se le manda, lo saca del mismo nombre. */
  rutDetectado = signal('');
  /** Se pide confirmación porque el archivo parece de otro estudio. */
  confirmandoRut = signal(false);

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
    this.rutDetectado.set(this.rutDelNombre(archivo.name));
    // Un resultado anterior junto a un archivo nuevo se lee como si fuera de
    // ese archivo.
    this.resultado.set(null);
  }

  /**
   * `Causas_16952077-1.xlsx` → `16952077-1`.
   *
   * Es el mismo patrón que aplica el servidor en
   * `causa_import_service.parse_nombre_archivo`. Acá se repite solo para poder
   * avisar ANTES de subir; el RUT que se usa de verdad lo sigue sacando el
   * servidor del mismo nombre, así que no hay dos fuentes que puedan divergir.
   */
  private rutDelNombre(nombreArchivo: string): string {
    const sinExtension = nombreArchivo.replace(/\.[^.]+$/, '');
    const m = sinExtension.match(/^Causas_(\d+(?:-?[0-9kK])?)_*$/i);
    return m ? m[1] : '';
  }

  /** RUT del archivo y del estudio, para el aviso. Formateados con puntos. */
  rutArchivo(): string {
    const detectado = this.rutDetectado();
    return detectado ? formatearRut(detectado) : '(sin RUT en el nombre)';
  }

  /**
   * Contra qué RUT se compara el del archivo.
   *
   * Primero los del usuario: el PJUD emite cada reporte a nombre del abogado
   * que lo pide, así que el RUT del archivo es el suyo y no el del estudio. Si
   * la plataforma todavía no le cargó ninguno se cae al del estudio, que es lo
   * que se hacía antes. Ver el mismo método en `upload-form`.
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

  /** Solo se opina con las dos puntas: sin alguna, advertir sería ruido. */
  private esDeOtroEstudio(): boolean {
    const detectado = this.rutDetectado();
    return !!detectado && !coincideConAlguno(detectado, this.rutsDeReferencia());
  }

  cargar(): void {
    const archivo = this.archivo();
    if (!archivo || this.cargando()) return;

    if (this.esDeOtroEstudio()) {
      this.confirmandoRut.set(true);
      return;
    }
    this.importar();
  }

  /** El usuario decidió cargar igual un archivo de otro RUT. */
  continuarCarga(): void {
    this.confirmandoRut.set(false);
    this.importar();
  }

  cancelarCarga(): void {
    this.confirmandoRut.set(false);
  }

  private importar(): void {
    const archivo = this.archivo();
    if (!archivo) return;

    this.cargando.set(true);
    this.resultado.set(null);

    // Ni RUT ni fecha: los dos campos se ocultaron y el servidor ya tiene el
    // mismo criterio por omisión — el RUT sale del nombre y la fecha es hoy.
    this.service.cargar(archivo).subscribe({
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
