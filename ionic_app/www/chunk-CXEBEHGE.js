import {
  NotificationService
} from "./chunk-ZKUWYJUU.js";
import {
  FormsModule,
  NgControlStatus,
  NgModel,
  NgSelectOption,
  SelectControlValueAccessor,
  ɵNgSelectMultipleOption
} from "./chunk-2XI3ELAA.js";
import {
  RouterLink
} from "./chunk-O3CMZLWV.js";
import {
  CommonModule,
  Component,
  DatePipe,
  HttpClient,
  HttpParams,
  Injectable,
  environment,
  inject,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵclassMap,
  ɵɵconditional,
  ɵɵdefineComponent,
  ɵɵdefineInjectable,
  ɵɵelement,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetCurrentView,
  ɵɵlistener,
  ɵɵnamespaceSVG,
  ɵɵnextContext,
  ɵɵpipe,
  ɵɵpipeBind2,
  ɵɵproperty,
  ɵɵpureFunction1,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtemplate,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1,
  ɵɵtextInterpolate3,
  ɵɵtwoWayBindingSet,
  ɵɵtwoWayListener,
  ɵɵtwoWayProperty
} from "./chunk-WMIGZGXS.js";
import "./chunk-XWLXMCJQ.js";

// src/app/features/configuracion/services/configuracion-correo.service.ts
var ConfiguracionCorreoService = class _ConfiguracionCorreoService {
  apiUrl = `${environment.apiUrl}/configuracion-correo`;
  http = inject(HttpClient);
  get() {
    return this.http.get(this.apiUrl);
  }
  /** Comprueba que la casilla responda, con la credencial ya guardada. */
  probarConexion() {
    return this.http.post(`${this.apiUrl}/probar-conexion`, {});
  }
  revisarAhora() {
    return this.http.post(`${this.apiUrl}/revisar`, {});
  }
  getLog(page = 1, perPage = 20, resultado) {
    let params = new HttpParams().set("page", page).set("per_page", perPage);
    if (resultado) {
      params = params.set("resultado", resultado);
    }
    return this.http.get(`${this.apiUrl}/log`, { params });
  }
  static \u0275fac = function ConfiguracionCorreoService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _ConfiguracionCorreoService)();
  };
  static \u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _ConfiguracionCorreoService, factory: _ConfiguracionCorreoService.\u0275fac, providedIn: "root" });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ConfiguracionCorreoService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

// src/app/features/configuracion/components/correo-log/correo-log.component.ts
var _c0 = (a0) => ["/estado-diario/origen", a0, "movimientos"];
var _forTrack0 = ($index, $item) => $item.id;
function CorreoLogComponent_Conditional_8_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(0, "svg", 19);
    \u0275\u0275element(1, "circle", 20)(2, "path", 21);
    \u0275\u0275elementEnd();
    \u0275\u0275text(3, " Revisando... ");
  }
}
function CorreoLogComponent_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(0, "svg", 22);
    \u0275\u0275element(1, "path", 23);
    \u0275\u0275elementEnd();
    \u0275\u0275text(2, " Revisar casilla ahora ");
  }
}
function CorreoLogComponent_Conditional_10_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 5);
    \u0275\u0275text(1, " Revisando la casilla e importando lo que corresponda: estado diario, movimientos y audiencias. Puede tardar seg\xFAn cu\xE1ntos correos haya sin leer. ");
    \u0275\u0275elementEnd();
  }
}
function CorreoLogComponent_Conditional_31_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 18);
    \u0275\u0275text(1, "Cargando...");
    \u0275\u0275elementEnd();
  }
}
function CorreoLogComponent_Conditional_32_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 18);
    \u0275\u0275text(1, "No hay registros para este filtro.");
    \u0275\u0275elementEnd();
  }
}
function CorreoLogComponent_Conditional_33_For_18_Conditional_16_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "a", 38);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const r_r1 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275property("routerLink", \u0275\u0275pureFunction1(2, _c0, r_r1.estado_diario_origen_id));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" Ver ", r_r1.movimientos_importados, " mov. ");
  }
}
function CorreoLogComponent_Conditional_33_For_18_Conditional_17_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275text(0, " \u2014 ");
  }
}
function CorreoLogComponent_Conditional_33_For_18_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "tr", 28)(1, "td", 30);
    \u0275\u0275text(2);
    \u0275\u0275pipe(3, "date");
    \u0275\u0275elementStart(4, "span", 31);
    \u0275\u0275text(5);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(6, "td", 32)(7, "span", 33);
    \u0275\u0275text(8);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(9, "td", 34);
    \u0275\u0275text(10);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(11, "td", 35);
    \u0275\u0275text(12);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(13, "td", 36);
    \u0275\u0275text(14);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(15, "td", 37);
    \u0275\u0275template(16, CorreoLogComponent_Conditional_33_For_18_Conditional_16_Template, 2, 4, "a", 38)(17, CorreoLogComponent_Conditional_33_For_18_Conditional_17_Template, 1, 0);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const r_r1 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate1(" ", \u0275\u0275pipeBind2(3, 9, r_r1.fecha, "dd/MM/yy HH:mm"), " ");
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(r_r1.disparo);
    \u0275\u0275advance(2);
    \u0275\u0275classMap(ctx_r1.claseBadge(r_r1.resultado));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r1.etiqueta(r_r1.resultado), " ");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(r_r1.nombre_archivo || "\u2014");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(r_r1.remitente || "\u2014");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(r_r1.detalle || "\u2014");
    \u0275\u0275advance(2);
    \u0275\u0275conditional(r_r1.estado_diario_origen_id ? 16 : 17);
  }
}
function CorreoLogComponent_Conditional_33_Conditional_19_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 29)(1, "span", 39);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "div", 40)(4, "button", 41);
    \u0275\u0275listener("click", function CorreoLogComponent_Conditional_33_Conditional_19_Template_button_click_4_listener() {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.cargar(ctx_r1.page() - 1));
    });
    \u0275\u0275text(5, " Anterior ");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "button", 41);
    \u0275\u0275listener("click", function CorreoLogComponent_Conditional_33_Conditional_19_Template_button_click_6_listener() {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.cargar(ctx_r1.page() + 1));
    });
    \u0275\u0275text(7, " Siguiente ");
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate3(" P\xE1gina ", ctx_r1.page(), " de ", ctx_r1.totalPages(), " (", ctx_r1.total(), " registros) ");
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r1.page() <= 1);
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r1.page() >= ctx_r1.totalPages());
  }
}
function CorreoLogComponent_Conditional_33_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 24)(1, "table", 25)(2, "thead")(3, "tr", 26)(4, "th", 27);
    \u0275\u0275text(5, "Fecha");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "th", 27);
    \u0275\u0275text(7, "Resultado");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "th", 27);
    \u0275\u0275text(9, "Archivo");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(10, "th", 27);
    \u0275\u0275text(11, "Remitente");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(12, "th", 27);
    \u0275\u0275text(13, "Detalle");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(14, "th", 27);
    \u0275\u0275text(15, "Origen");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(16, "tbody");
    \u0275\u0275repeaterCreate(17, CorreoLogComponent_Conditional_33_For_18_Template, 18, 12, "tr", 28, _forTrack0);
    \u0275\u0275elementEnd()()();
    \u0275\u0275template(19, CorreoLogComponent_Conditional_33_Conditional_19_Template, 8, 5, "div", 29);
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(17);
    \u0275\u0275repeater(ctx_r1.registros());
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r1.totalPages() > 1 ? 19 : -1);
  }
}
var CorreoLogComponent = class _CorreoLogComponent {
  service = inject(ConfiguracionCorreoService);
  notification = inject(NotificationService);
  /** Por defecto solo los importados; el resto se ve cambiando el filtro. */
  filtro = "importado";
  registros = signal([]);
  cargando = signal(true);
  revisando = signal(false);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);
  ngOnInit() {
    this.cargar(1);
  }
  /**
   * Fuerza una revisión de la casilla sin esperar a la hora programada.
   *
   * No hay un botón por tipo de reporte: el tipo lo decide el asunto del
   * correo (`asunto_estado_diario` / `asunto_movimientos` /
   * `asunto_audiencias`), así que pedir "importa solo audiencias" no
   * significaría nada del lado del servidor.
   */
  revisarAhora() {
    if (this.revisando())
      return;
    this.revisando.set(true);
    this.service.revisarAhora().subscribe({
      next: (res) => {
        this.revisando.set(false);
        if (!res.exito) {
          this.notification.error(res.mensaje || "No se pudo revisar la casilla");
          this.filtro = "";
          this.cargar(1);
          return;
        }
        if (res.procesados === 0) {
          this.notification.info("No hab\xEDa correos nuevos en la casilla");
          return;
        }
        this.notification.success(`${res.importados} importados de ${res.procesados} correos (${res.duplicados} duplicados, ${res.descartados} descartados, ${res.errores} con error)`);
        if (res.importados === 0) {
          this.filtro = "";
        }
        this.cargar(1);
      },
      error: () => {
        this.revisando.set(false);
        this.notification.error("No se pudo revisar la casilla");
      }
    });
  }
  cargar(page) {
    if (page < 1)
      return;
    this.cargando.set(true);
    this.service.getLog(page, 20, this.filtro || void 0).subscribe({
      next: (res) => {
        this.registros.set(res.registros);
        this.page.set(res.page);
        this.totalPages.set(res.total_pages);
        this.total.set(res.total);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.notification.error("No se pudo cargar la bit\xE1cora");
      }
    });
  }
  etiqueta(resultado) {
    const mapa = {
      importado: "Importado",
      descartado: "Descartado",
      duplicado: "Duplicado",
      error: "Error",
      conexion: "Conexi\xF3n"
    };
    return mapa[resultado] ?? resultado;
  }
  claseBadge(resultado) {
    const mapa = {
      importado: "bg-accent-100 text-accent-700",
      descartado: "bg-neutral-100 text-neutral-600",
      duplicado: "bg-neutral-100 text-neutral-600",
      error: "bg-danger-100 text-danger-700",
      conexion: "bg-danger-100 text-danger-700"
    };
    return mapa[resultado] ?? "bg-neutral-100 text-neutral-600";
  }
  static \u0275fac = function CorreoLogComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _CorreoLogComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _CorreoLogComponent, selectors: [["app-correo-log"]], decls: 34, vars: 5, consts: [[1, "space-y-6"], [1, "flex", "items-start", "justify-between"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], ["type", "button", 1, "btn-primary", "shrink-0", "flex", "items-center", "gap-2", 3, "click", "disabled"], [1, "alert-info"], [1, "card"], [1, "card-body"], [1, "flex", "flex-wrap", "items-center", "gap-3", "mb-4"], [1, "form-label", "mb-0"], [1, "form-input", "w-auto", 3, "ngModelChange", "ngModel"], ["value", ""], ["value", "importado"], ["value", "descartado"], ["value", "duplicado"], ["value", "error"], ["value", "conexion"], [1, "btn-secondary", "text-sm", 3, "click"], [1, "text-neutral-500", "py-8", "text-center"], ["viewBox", "0 0 24 24", "aria-hidden", "true", 1, "animate-spin", "h-4", "w-4"], ["cx", "12", "cy", "12", "r", "10", "stroke", "currentColor", "stroke-width", "4", "fill", "none", 1, "opacity-25"], ["fill", "currentColor", "d", "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z", 1, "opacity-75"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", "aria-hidden", "true", 1, "h-4", "w-4"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0\n                       0a8.003 8.003 0 01-15.357-2m15.357 2H15"], [1, "overflow-x-auto"], [1, "w-full", "text-sm"], [1, "text-left", "text-neutral-500", "border-b", "border-neutral-200"], [1, "py-2", "pr-4", "font-medium"], [1, "border-b", "border-neutral-100", "align-top"], [1, "flex", "items-center", "justify-between", "mt-4"], [1, "py-2", "pr-4", "whitespace-nowrap", "text-neutral-600"], [1, "block", "text-xs", "text-neutral-400"], [1, "py-2", "pr-4"], [1, "px-2", "py-0.5", "rounded-full", "text-xs", "font-medium"], [1, "py-2", "pr-4", "text-neutral-700", "break-all"], [1, "py-2", "pr-4", "text-neutral-600", "break-all"], [1, "py-2", "pr-4", "text-neutral-600"], [1, "py-2", "pr-4", "whitespace-nowrap"], [1, "text-primary-600", "hover:underline", 3, "routerLink"], [1, "text-sm", "text-neutral-500"], [1, "flex", "gap-2"], [1, "btn-secondary", "text-sm", 3, "click", "disabled"]], template: function CorreoLogComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div", 1)(2, "div")(3, "h1", 2);
      \u0275\u0275text(4, "Bit\xE1cora de mi casilla de correo");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(5, "p", 3);
      \u0275\u0275text(6, " Importaciones hechas desde su casilla; cambie el filtro para ver descartados, duplicados y errores ");
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(7, "button", 4);
      \u0275\u0275listener("click", function CorreoLogComponent_Template_button_click_7_listener() {
        return ctx.revisarAhora();
      });
      \u0275\u0275template(8, CorreoLogComponent_Conditional_8_Template, 4, 0)(9, CorreoLogComponent_Conditional_9_Template, 3, 0);
      \u0275\u0275elementEnd()();
      \u0275\u0275template(10, CorreoLogComponent_Conditional_10_Template, 2, 0, "div", 5);
      \u0275\u0275elementStart(11, "div", 6)(12, "div", 7)(13, "div", 8)(14, "label", 9);
      \u0275\u0275text(15, "Filtrar por resultado");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(16, "select", 10);
      \u0275\u0275twoWayListener("ngModelChange", function CorreoLogComponent_Template_select_ngModelChange_16_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.filtro, $event) || (ctx.filtro = $event);
        return $event;
      });
      \u0275\u0275listener("ngModelChange", function CorreoLogComponent_Template_select_ngModelChange_16_listener() {
        return ctx.cargar(1);
      });
      \u0275\u0275elementStart(17, "option", 11);
      \u0275\u0275text(18, "Todos");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(19, "option", 12);
      \u0275\u0275text(20, "Importados");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(21, "option", 13);
      \u0275\u0275text(22, "Descartados");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(23, "option", 14);
      \u0275\u0275text(24, "Duplicados");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(25, "option", 15);
      \u0275\u0275text(26, "Errores");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(27, "option", 16);
      \u0275\u0275text(28, "Fallas de conexi\xF3n");
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(29, "button", 17);
      \u0275\u0275listener("click", function CorreoLogComponent_Template_button_click_29_listener() {
        return ctx.cargar(ctx.page());
      });
      \u0275\u0275text(30, "Actualizar");
      \u0275\u0275elementEnd()();
      \u0275\u0275template(31, CorreoLogComponent_Conditional_31_Template, 2, 0, "p", 18)(32, CorreoLogComponent_Conditional_32_Template, 2, 0, "p", 18)(33, CorreoLogComponent_Conditional_33_Template, 20, 1);
      \u0275\u0275elementEnd()()();
    }
    if (rf & 2) {
      \u0275\u0275advance(7);
      \u0275\u0275property("disabled", ctx.revisando());
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.revisando() ? 8 : 9);
      \u0275\u0275advance(2);
      \u0275\u0275conditional(ctx.revisando() ? 10 : -1);
      \u0275\u0275advance(6);
      \u0275\u0275twoWayProperty("ngModel", ctx.filtro);
      \u0275\u0275advance(15);
      \u0275\u0275conditional(ctx.cargando() ? 31 : ctx.registros().length === 0 ? 32 : 33);
    }
  }, dependencies: [CommonModule, DatePipe, FormsModule, NgSelectOption, \u0275NgSelectMultipleOption, SelectControlValueAccessor, NgControlStatus, NgModel, RouterLink], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(CorreoLogComponent, [{
    type: Component,
    args: [{
      selector: "app-correo-log",
      standalone: true,
      imports: [CommonModule, FormsModule, RouterLink],
      template: `
    <div class="space-y-6">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Bit\xE1cora de mi casilla de correo</h1>
          <p class="text-neutral-500 mt-1">
            Importaciones hechas desde su casilla; cambie el filtro para ver descartados,
            duplicados y errores
          </p>
        </div>
        <!-- Una sola revisi\xF3n cubre los tres reportes: el tipo se deduce del
             asunto de cada correo, no se elige ac\xE1. -->
        <button
          type="button"
          (click)="revisarAhora()"
          [disabled]="revisando()"
          class="btn-primary shrink-0 flex items-center gap-2"
        >
          @if (revisando()) {
            <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                      stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Revisando...
          } @else {
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                 aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0
                       0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Revisar casilla ahora
          }
        </button>
      </div>

      @if (revisando()) {
        <div class="alert-info">
          Revisando la casilla e importando lo que corresponda: estado diario, movimientos y
          audiencias. Puede tardar seg\xFAn cu\xE1ntos correos haya sin leer.
        </div>
      }

      <div class="card">
        <div class="card-body">
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <label class="form-label mb-0">Filtrar por resultado</label>
            <select class="form-input w-auto" [(ngModel)]="filtro" (ngModelChange)="cargar(1)">
              <option value="">Todos</option>
              <option value="importado">Importados</option>
              <option value="descartado">Descartados</option>
              <option value="duplicado">Duplicados</option>
              <option value="error">Errores</option>
              <option value="conexion">Fallas de conexi\xF3n</option>
            </select>
            <button (click)="cargar(page())" class="btn-secondary text-sm">Actualizar</button>
          </div>

          @if (cargando()) {
            <p class="text-neutral-500 py-8 text-center">Cargando...</p>
          } @else if (registros().length === 0) {
            <p class="text-neutral-500 py-8 text-center">No hay registros para este filtro.</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-neutral-500 border-b border-neutral-200">
                    <th class="py-2 pr-4 font-medium">Fecha</th>
                    <th class="py-2 pr-4 font-medium">Resultado</th>
                    <th class="py-2 pr-4 font-medium">Archivo</th>
                    <th class="py-2 pr-4 font-medium">Remitente</th>
                    <th class="py-2 pr-4 font-medium">Detalle</th>
                    <th class="py-2 pr-4 font-medium">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of registros(); track r.id) {
                    <tr class="border-b border-neutral-100 align-top">
                      <td class="py-2 pr-4 whitespace-nowrap text-neutral-600">
                        {{ r.fecha | date: 'dd/MM/yy HH:mm' }}
                        <span class="block text-xs text-neutral-400">{{ r.disparo }}</span>
                      </td>
                      <td class="py-2 pr-4">
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium" [class]="claseBadge(r.resultado)">
                          {{ etiqueta(r.resultado) }}
                        </span>
                      </td>
                      <td class="py-2 pr-4 text-neutral-700 break-all">{{ r.nombre_archivo || '\u2014' }}</td>
                      <td class="py-2 pr-4 text-neutral-600 break-all">{{ r.remitente || '\u2014' }}</td>
                      <td class="py-2 pr-4 text-neutral-600">{{ r.detalle || '\u2014' }}</td>
                      <td class="py-2 pr-4 whitespace-nowrap">
                        @if (r.estado_diario_origen_id) {
                          <a [routerLink]="['/estado-diario/origen', r.estado_diario_origen_id, 'movimientos']"
                             class="text-primary-600 hover:underline">
                            Ver {{ r.movimientos_importados }} mov.
                          </a>
                        } @else { \u2014 }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (totalPages() > 1) {
              <div class="flex items-center justify-between mt-4">
                <span class="text-sm text-neutral-500">
                  P\xE1gina {{ page() }} de {{ totalPages() }} ({{ total() }} registros)
                </span>
                <div class="flex gap-2">
                  <button (click)="cargar(page() - 1)" class="btn-secondary text-sm" [disabled]="page() <= 1">
                    Anterior
                  </button>
                  <button (click)="cargar(page() + 1)" class="btn-secondary text-sm" [disabled]="page() >= totalPages()">
                    Siguiente
                  </button>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(CorreoLogComponent, { className: "CorreoLogComponent", filePath: "src/app/features/configuracion/components/correo-log/correo-log.component.ts", lineNumber: 140 });
})();
export {
  CorreoLogComponent
};
//# sourceMappingURL=chunk-CXEBEHGE.js.map
