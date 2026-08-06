import {
  AudienciaService
} from "./chunk-IYRFMHMF.js";
import {
  EstadoDiarioService
} from "./chunk-FLTDD2QG.js";
import {
  MovimientoService
} from "./chunk-MAUBW23E.js";
import {
  NotificationService
} from "./chunk-ZKUWYJUU.js";
import {
  DefaultValueAccessor,
  FormsModule,
  NgControlStatus,
  NgModel,
  NgSelectOption,
  SelectControlValueAccessor,
  ɵNgSelectMultipleOption
} from "./chunk-2XI3ELAA.js";
import {
  Router
} from "./chunk-O3CMZLWV.js";
import {
  CommonModule,
  Component,
  inject,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵclassProp,
  ɵɵconditional,
  ɵɵdefineComponent,
  ɵɵelement,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetCurrentView,
  ɵɵlistener,
  ɵɵnamespaceHTML,
  ɵɵnamespaceSVG,
  ɵɵnextContext,
  ɵɵproperty,
  ɵɵreference,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtemplate,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1,
  ɵɵtwoWayBindingSet,
  ɵɵtwoWayListener,
  ɵɵtwoWayProperty
} from "./chunk-WMIGZGXS.js";
import "./chunk-XWLXMCJQ.js";

// src/app/features/estado-diario/components/upload-form/upload-form.component.ts
function UploadFormComponent_Conditional_26_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 14);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(1, "svg", 24);
    \u0275\u0275element(2, "path", 25);
    \u0275\u0275elementEnd();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(3, "p", 26);
    \u0275\u0275text(4);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "p", 27);
    \u0275\u0275text(6);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r2.selectedFile().name);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate1("", (ctx_r2.selectedFile().size / 1024).toFixed(1), " KB");
  }
}
function UploadFormComponent_Conditional_27_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(0, "svg", 28);
    \u0275\u0275element(1, "path", 29);
    \u0275\u0275elementEnd();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(2, "p", 30);
    \u0275\u0275text(3, "Haga clic o arrastre un archivo aqu\xED");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(4, "p", 31);
    \u0275\u0275text(5);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate1("Formato: ", ctx_r2.ejemploNombre(), "");
  }
}
function UploadFormComponent_Conditional_28_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 15);
    \u0275\u0275text(1, " Datos detectados del archivo: RUT ");
    \u0275\u0275elementStart(2, "strong");
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
    \u0275\u0275text(4, ", Fecha ");
    \u0275\u0275elementStart(5, "strong");
    \u0275\u0275text(6);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r2.parsedInfo().rut);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r2.parsedInfo().fecha);
  }
}
function UploadFormComponent_Conditional_38_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 19);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r2.errorMsg());
  }
}
function UploadFormComponent_Conditional_43_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(0, "svg", 23);
    \u0275\u0275element(1, "circle", 32)(2, "path", 33);
    \u0275\u0275elementEnd();
  }
}
var UploadFormComponent = class _UploadFormComponent {
  service = inject(EstadoDiarioService);
  movimientoService = inject(MovimientoService);
  audienciaService = inject(AudienciaService);
  notification = inject(NotificationService);
  router = inject(Router);
  rut = "";
  fecha = "";
  /** Los tres Excel del sistema tienen formatos y endpoints distintos. */
  tipo = "estado_diario";
  selectedFile = signal(null);
  parsedInfo = signal(null);
  uploading = signal(false);
  errorMsg = signal("");
  EJEMPLOS = {
    estado_diario: "estadoDiario_16952077__28072026.xls",
    movimientos: "Movimientos_16952077__30_07_2026.xls",
    audiencias: "Audiencias_16952077_03_08_2026_09_08_2026.xls"
  };
  ejemploNombre() {
    return this.EJEMPLOS[this.tipo];
  }
  onFileSelect(event) {
    const input = event.target;
    if (input.files?.length) {
      this.setFile(input.files[0]);
    }
  }
  onDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file)
      this.setFile(file);
  }
  setFile(file) {
    this.selectedFile.set(file);
    this.parseFilename(file.name);
  }
  parseFilename(filename) {
    const name = filename.replace(/\.\w+$/, "");
    const matchEdNuevo = name.match(/^estadoDiario_(\d+)(?:-|_)?([\dkK])?_+(\d{2})(\d{2})(\d{4})$/i);
    const matchEdViejo = name.match(/^estadoDiario_?(\d+(?:-[\dkK])?)_+(\d{1,2})_(\d{1,2})_(\d{4})$/i);
    const matchMov = name.match(/^Movimientos_(\d+[\-kK]?\d?)_+(\d{1,2})_(\d{1,2})_(\d{4})$/i);
    const matchAud = name.match(/^Audiencias_(\d+[\-kK]?\d?)_+(\d{1,2})_(\d{1,2})_(\d{4})_+\d{1,2}_\d{1,2}_\d{4}$/i);
    if (/audiencia/i.test(name))
      this.tipo = "audiencias";
    else if (/movimiento/i.test(name))
      this.tipo = "movimientos";
    else if (/estado\s*_?diario/i.test(name))
      this.tipo = "estado_diario";
    else {
      this.notification.info("No se pudo deducir el tipo por el nombre del archivo: revise el selector");
    }
    let match = null;
    let rutDetectado = "";
    if (matchEdNuevo) {
      const [, cuerpo, dv] = matchEdNuevo;
      rutDetectado = dv ? `${cuerpo}-${dv}` : cuerpo;
      match = [matchEdNuevo[0], rutDetectado, matchEdNuevo[3], matchEdNuevo[4], matchEdNuevo[5]];
    } else if (matchEdViejo ?? matchMov ?? matchAud) {
      match = matchEdViejo ?? matchMov ?? matchAud;
      rutDetectado = match[1];
    }
    if (!match && this.tipo === "audiencias") {
      this.parsedInfo.set(null);
      this.notification.info("Archivo de audiencias: la fecha se tomar\xE1 del contenido del archivo");
      return;
    }
    if (match) {
      const rut = rutDetectado;
      const dia = match[2].padStart(2, "0");
      const mes = match[3].padStart(2, "0");
      const anio = match[4];
      const fechaStr = `${anio}-${mes}-${dia}`;
      this.rut = rut;
      this.fecha = fechaStr;
      this.parsedInfo.set({ rut, fecha: `${dia}/${mes}/${anio}` });
      this.notification.info(`RUT y fecha extra\xEDdos del nombre del archivo`);
    } else {
      this.parsedInfo.set(null);
    }
  }
  onUpload() {
    this.errorMsg.set("");
    if (!this.selectedFile()) {
      this.errorMsg.set("Seleccione un archivo");
      return;
    }
    this.uploading.set(true);
    const archivo = this.selectedFile();
    const rut = this.rut || void 0;
    const fecha = this.fecha || void 0;
    const carga = this.tipo === "movimientos" ? this.movimientoService.uploadFile(archivo, rut, fecha) : this.tipo === "audiencias" ? this.audienciaService.uploadFile(archivo, rut, fecha) : this.service.uploadFile(archivo, rut, fecha);
    carga.subscribe({
      next: (res) => {
        this.uploading.set(false);
        if (res.exito) {
          this.notification.success(this.mensajeCarga(res));
          this.router.navigate(["/estado-diario"], { queryParams: { tab: this.tipo } });
        } else {
          this.errorMsg.set(res.mensaje || "Error al cargar");
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.errorMsg.set(err.error?.detail || err.error?.mensaje || "Error al cargar el archivo");
      }
    });
  }
  /**
   * Las audiencias se deduplican contra las ya cargadas (los archivos semanales
   * se traslapan), así que el resumen distingue nuevas de actualizadas: si no,
   * cargar el archivo de la semana siguiente parecería no haber hecho nada.
   */
  mensajeCarga(res) {
    if (this.tipo === "audiencias") {
      const nuevas = res.audiencias_nuevas ?? 0;
      const actualizadas = res.audiencias_actualizadas ?? 0;
      const partes = [`${nuevas} audiencias nuevas`];
      if (actualizadas > 0)
        partes.push(`${actualizadas} ya conocidas, actualizadas`);
      return `Archivo cargado: ${partes.join(", ")}`;
    }
    return `Archivo cargado: ${res.movimientos_importados} registros importados`;
  }
  onCancel() {
    this.router.navigate(["/estado-diario"]);
  }
  static \u0275fac = function UploadFormComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _UploadFormComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _UploadFormComponent, selectors: [["app-upload-form"]], decls: 45, vars: 14, consts: [["fileInput", ""], [1, "max-w-2xl", "mx-auto", "space-y-6"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], [1, "text-xs", "text-neutral-400", "mt-1"], [1, "card"], [1, "card-body", "space-y-5"], [1, "form-label"], [1, "form-select", 3, "ngModelChange", "ngModel"], ["value", "estado_diario"], ["value", "movimientos"], ["value", "audiencias"], [1, "mt-1", "border-2", "border-dashed", "border-neutral-300", "rounded-lg", "p-8", "text-center", "hover:border-primary-400", "transition-colors", "cursor-pointer", 3, "click", "dragover", "drop"], ["type", "file", "accept", ".xls,.xlsx,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12", 1, "hidden", 3, "change"], [1, "text-primary-600"], [1, "alert-info"], [1, "grid", "grid-cols-1", "md:grid-cols-2", "gap-4"], ["type", "text", "placeholder", "Se extrae del archivo", 1, "form-input", 3, "ngModelChange", "ngModel"], ["type", "date", 1, "form-input", 3, "ngModelChange", "ngModel"], [1, "alert-danger"], [1, "flex", "justify-end", "gap-3", "pt-2"], [1, "btn-secondary", 3, "click"], [1, "btn-primary", 3, "click", "disabled"], ["viewBox", "0 0 24 24", 1, "animate-spin", "h-5", "w-5"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-10", "h-10", "mx-auto", "mb-2"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"], [1, "font-medium"], [1, "text-sm", "text-neutral-500", "mt-1"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-10", "h-10", "mx-auto", "mb-2", "text-neutral-400"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"], [1, "text-neutral-500"], [1, "text-sm", "text-neutral-400", "mt-1"], ["cx", "12", "cy", "12", "r", "10", "stroke", "currentColor", "stroke-width", "4", "fill", "none", 1, "opacity-25"], ["fill", "currentColor", "d", "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z", 1, "opacity-75"]], template: function UploadFormComponent_Template(rf, ctx) {
    if (rf & 1) {
      const _r1 = \u0275\u0275getCurrentView();
      \u0275\u0275elementStart(0, "div", 1)(1, "div")(2, "h1", 2);
      \u0275\u0275text(3, "Cargar Archivo");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(4, "p", 3);
      \u0275\u0275text(5, "Suba un archivo XLS/XLSX de estado diario, movimientos o audiencias");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(6, "p", 4);
      \u0275\u0275text(7);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(8, "div", 5)(9, "div", 6)(10, "div")(11, "label", 7);
      \u0275\u0275text(12, "Tipo de archivo");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(13, "select", 8);
      \u0275\u0275twoWayListener("ngModelChange", function UploadFormComponent_Template_select_ngModelChange_13_listener($event) {
        \u0275\u0275restoreView(_r1);
        \u0275\u0275twoWayBindingSet(ctx.tipo, $event) || (ctx.tipo = $event);
        return \u0275\u0275resetView($event);
      });
      \u0275\u0275elementStart(14, "option", 9);
      \u0275\u0275text(15, "Estado Diario");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(16, "option", 10);
      \u0275\u0275text(17, "Movimientos");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(18, "option", 11);
      \u0275\u0275text(19, "Audiencias");
      \u0275\u0275elementEnd()()();
      \u0275\u0275elementStart(20, "div")(21, "label", 7);
      \u0275\u0275text(22, "Archivo (XLS/XLSX)");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(23, "div", 12);
      \u0275\u0275listener("click", function UploadFormComponent_Template_div_click_23_listener() {
        \u0275\u0275restoreView(_r1);
        const fileInput_r2 = \u0275\u0275reference(25);
        return \u0275\u0275resetView(fileInput_r2.click());
      })("dragover", function UploadFormComponent_Template_div_dragover_23_listener($event) {
        \u0275\u0275restoreView(_r1);
        return \u0275\u0275resetView($event.preventDefault());
      })("drop", function UploadFormComponent_Template_div_drop_23_listener($event) {
        \u0275\u0275restoreView(_r1);
        return \u0275\u0275resetView(ctx.onDrop($event));
      });
      \u0275\u0275elementStart(24, "input", 13, 0);
      \u0275\u0275listener("change", function UploadFormComponent_Template_input_change_24_listener($event) {
        \u0275\u0275restoreView(_r1);
        return \u0275\u0275resetView(ctx.onFileSelect($event));
      });
      \u0275\u0275elementEnd();
      \u0275\u0275template(26, UploadFormComponent_Conditional_26_Template, 7, 2, "div", 14)(27, UploadFormComponent_Conditional_27_Template, 6, 1);
      \u0275\u0275elementEnd()();
      \u0275\u0275template(28, UploadFormComponent_Conditional_28_Template, 7, 2, "div", 15);
      \u0275\u0275elementStart(29, "div", 16)(30, "div")(31, "label", 7);
      \u0275\u0275text(32, "RUT");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(33, "input", 17);
      \u0275\u0275twoWayListener("ngModelChange", function UploadFormComponent_Template_input_ngModelChange_33_listener($event) {
        \u0275\u0275restoreView(_r1);
        \u0275\u0275twoWayBindingSet(ctx.rut, $event) || (ctx.rut = $event);
        return \u0275\u0275resetView($event);
      });
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(34, "div")(35, "label", 7);
      \u0275\u0275text(36, "Fecha del archivo");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(37, "input", 18);
      \u0275\u0275twoWayListener("ngModelChange", function UploadFormComponent_Template_input_ngModelChange_37_listener($event) {
        \u0275\u0275restoreView(_r1);
        \u0275\u0275twoWayBindingSet(ctx.fecha, $event) || (ctx.fecha = $event);
        return \u0275\u0275resetView($event);
      });
      \u0275\u0275elementEnd()()();
      \u0275\u0275template(38, UploadFormComponent_Conditional_38_Template, 2, 1, "div", 19);
      \u0275\u0275elementStart(39, "div", 20)(40, "button", 21);
      \u0275\u0275listener("click", function UploadFormComponent_Template_button_click_40_listener() {
        \u0275\u0275restoreView(_r1);
        return \u0275\u0275resetView(ctx.onCancel());
      });
      \u0275\u0275text(41, "Cancelar");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(42, "button", 22);
      \u0275\u0275listener("click", function UploadFormComponent_Template_button_click_42_listener() {
        \u0275\u0275restoreView(_r1);
        return \u0275\u0275resetView(ctx.onUpload());
      });
      \u0275\u0275template(43, UploadFormComponent_Conditional_43_Template, 3, 0, ":svg:svg", 23);
      \u0275\u0275text(44);
      \u0275\u0275elementEnd()()()()();
    }
    if (rf & 2) {
      let tmp_5_0;
      let tmp_7_0;
      \u0275\u0275advance(7);
      \u0275\u0275textInterpolate1(" El RUT y la fecha se extraen del nombre del archivo (Ej: ", ctx.ejemploNombre(), ") ");
      \u0275\u0275advance(6);
      \u0275\u0275twoWayProperty("ngModel", ctx.tipo);
      \u0275\u0275advance(13);
      \u0275\u0275conditional(ctx.selectedFile() ? 26 : 27);
      \u0275\u0275advance(2);
      \u0275\u0275conditional(ctx.parsedInfo() ? 28 : -1);
      \u0275\u0275advance(5);
      \u0275\u0275classProp("bg-accent-50", (tmp_5_0 = ctx.parsedInfo()) == null ? null : tmp_5_0.rut);
      \u0275\u0275twoWayProperty("ngModel", ctx.rut);
      \u0275\u0275advance(4);
      \u0275\u0275classProp("bg-accent-50", (tmp_7_0 = ctx.parsedInfo()) == null ? null : tmp_7_0.fecha);
      \u0275\u0275twoWayProperty("ngModel", ctx.fecha);
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.errorMsg() ? 38 : -1);
      \u0275\u0275advance(4);
      \u0275\u0275property("disabled", ctx.uploading());
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.uploading() ? 43 : -1);
      \u0275\u0275advance();
      \u0275\u0275textInterpolate1(" ", ctx.uploading() ? "Subiendo..." : "Subir Archivo", " ");
    }
  }, dependencies: [CommonModule, FormsModule, NgSelectOption, \u0275NgSelectMultipleOption, DefaultValueAccessor, SelectControlValueAccessor, NgControlStatus, NgModel], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(UploadFormComponent, [{
    type: Component,
    args: [{
      selector: "app-upload-form",
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
              <!-- Van los tipos MIME adem\xE1s de las extensiones: el selector de
                   archivos de Android filtra por MIME y, con solo la extensi\xF3n,
                   deja todo en gris y no se puede elegir ning\xFAn archivo. -->
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
                <p class="text-neutral-500">Haga clic o arrastre un archivo aqu\xED</p>
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
  `
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(UploadFormComponent, { className: "UploadFormComponent", filePath: "src/app/features/estado-diario/components/upload-form/upload-form.component.ts", lineNumber: 117 });
})();
export {
  UploadFormComponent
};
//# sourceMappingURL=chunk-OLWWA35U.js.map
