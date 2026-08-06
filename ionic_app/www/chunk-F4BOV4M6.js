import {
  ReporteService,
  descargarBlob,
  mensajeErrorBlob,
  nombreArchivoSeguro
} from "./chunk-2OY4HAWA.js";
import "./chunk-NEYQRVBS.js";
import "./chunk-GTR5QLCS.js";
import {
  NotificationService
} from "./chunk-ZKUWYJUU.js";
import {
  RouterLink
} from "./chunk-O3CMZLWV.js";
import {
  CommonModule,
  Component,
  inject,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵadvance,
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
  ɵɵpureFunction1,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtemplate,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1
} from "./chunk-WMIGZGXS.js";
import "./chunk-XWLXMCJQ.js";

// src/app/features/reportes/reportes-list.component.ts
var _c0 = (a0) => ["/informes", a0];
var _forTrack0 = ($index, $item) => $item.id;
function ReportesListComponent_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 5)(1, "span", 9);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "button", 10);
    \u0275\u0275listener("click", function ReportesListComponent_Conditional_9_Template_button_click_3_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.mensaje.set(""));
    });
    \u0275\u0275text(4, "\xD7");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r1.mensaje());
  }
}
function ReportesListComponent_Conditional_10_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 6);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(1, "svg", 11);
    \u0275\u0275element(2, "circle", 12)(3, "path", 13);
    \u0275\u0275elementEnd()();
  }
}
function ReportesListComponent_Conditional_11_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 7)(1, "div", 14)(2, "p", 15);
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(4, "button", 16);
    \u0275\u0275listener("click", function ReportesListComponent_Conditional_11_Template_button_click_4_listener() {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cargar());
    });
    \u0275\u0275text(5, "Reintentar");
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r1.error());
  }
}
function ReportesListComponent_Conditional_12_For_19_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 21);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r5 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275property("title", p_r5.descripcion);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(p_r5.descripcion);
  }
}
function ReportesListComponent_Conditional_12_For_19_Conditional_13_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 24);
    \u0275\u0275text(1, "Nunca generado");
    \u0275\u0275elementEnd();
  }
}
function ReportesListComponent_Conditional_12_For_19_Conditional_14_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 25);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r5 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(p_r5.ultimo_resultado);
  }
}
function ReportesListComponent_Conditional_12_For_19_Conditional_15_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 26);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r5 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(p_r5.ultimo_resultado);
  }
}
function ReportesListComponent_Conditional_12_For_19_Template(rf, ctx) {
  if (rf & 1) {
    const _r4 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "tr")(1, "td", 19)(2, "a", 20);
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
    \u0275\u0275template(4, ReportesListComponent_Conditional_12_For_19_Conditional_4_Template, 2, 2, "span", 21);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "td")(6, "span", 22);
    \u0275\u0275text(7);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(8, "td");
    \u0275\u0275text(9);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(10, "td");
    \u0275\u0275text(11);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(12, "td", 23);
    \u0275\u0275template(13, ReportesListComponent_Conditional_12_For_19_Conditional_13_Template, 2, 0, "span", 24)(14, ReportesListComponent_Conditional_12_For_19_Conditional_14_Template, 2, 1, "span", 25)(15, ReportesListComponent_Conditional_12_For_19_Conditional_15_Template, 2, 1, "span", 26);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(16, "td")(17, "div", 27)(18, "button", 28);
    \u0275\u0275listener("click", function ReportesListComponent_Conditional_12_For_19_Template_button_click_18_listener() {
      const p_r5 = \u0275\u0275restoreView(_r4).$implicit;
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.enviar(p_r5));
    });
    \u0275\u0275text(19);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(20, "button", 29);
    \u0275\u0275listener("click", function ReportesListComponent_Conditional_12_For_19_Template_button_click_20_listener() {
      const p_r5 = \u0275\u0275restoreView(_r4).$implicit;
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.descargar(p_r5));
    });
    \u0275\u0275text(21);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(22, "a", 30);
    \u0275\u0275text(23, "Editar");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(24, "button", 31);
    \u0275\u0275listener("click", function ReportesListComponent_Conditional_12_For_19_Template_button_click_24_listener() {
      const p_r5 = \u0275\u0275restoreView(_r4).$implicit;
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.confirmarEliminar.set(p_r5));
    });
    \u0275\u0275text(25, " Eliminar ");
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const p_r5 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275property("routerLink", \u0275\u0275pureFunction1(14, _c0, p_r5.id));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", p_r5.nombre, " ");
    \u0275\u0275advance();
    \u0275\u0275conditional(p_r5.descripcion ? 4 : -1);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r1.etiquetaFuente(p_r5.fuente));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(p_r5.campos.length);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r1.fmtFechaHora(p_r5.ultima_generacion));
    \u0275\u0275advance();
    \u0275\u0275property("title", p_r5.ultimo_resultado || "");
    \u0275\u0275advance();
    \u0275\u0275conditional(!p_r5.ultimo_resultado ? 13 : ctx_r1.esError(p_r5.ultimo_resultado) ? 14 : 15);
    \u0275\u0275advance(5);
    \u0275\u0275property("disabled", ctx_r1.ocupado());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r1.enviandoId() === p_r5.id ? "Enviando..." : "Enviar", " ");
    \u0275\u0275advance();
    \u0275\u0275property("disabled", ctx_r1.ocupado());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r1.descargandoId() === p_r5.id ? "Generando..." : "Descargar", " ");
    \u0275\u0275advance();
    \u0275\u0275property("routerLink", \u0275\u0275pureFunction1(16, _c0, p_r5.id));
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r1.ocupado());
  }
}
function ReportesListComponent_Conditional_12_ForEmpty_20_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "tr")(1, "td", 32);
    \u0275\u0275text(2, " A\xFAn no tiene informes guardados. ");
    \u0275\u0275elementStart(3, "a", 33);
    \u0275\u0275text(4, "Cree el primero");
    \u0275\u0275elementEnd();
    \u0275\u0275text(5, ". ");
    \u0275\u0275elementEnd()();
  }
}
function ReportesListComponent_Conditional_12_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 7)(1, "div", 17)(2, "table", 18)(3, "thead")(4, "tr")(5, "th");
    \u0275\u0275text(6, "Informe");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(7, "th");
    \u0275\u0275text(8, "Fuente de datos");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(9, "th");
    \u0275\u0275text(10, "Campos");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(11, "th");
    \u0275\u0275text(12, "\xDAltima generaci\xF3n");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(13, "th");
    \u0275\u0275text(14, "Resultado");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(15, "th");
    \u0275\u0275text(16, "Acciones");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(17, "tbody");
    \u0275\u0275repeaterCreate(18, ReportesListComponent_Conditional_12_For_19_Template, 26, 18, "tr", null, _forTrack0, false, ReportesListComponent_Conditional_12_ForEmpty_20_Template, 6, 0, "tr");
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(18);
    \u0275\u0275repeater(ctx_r1.plantillas());
  }
}
function ReportesListComponent_Conditional_13_Template(rf, ctx) {
  if (rf & 1) {
    const _r6 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 34);
    \u0275\u0275listener("click", function ReportesListComponent_Conditional_13_Template_div_click_0_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cancelarEliminar());
    });
    \u0275\u0275elementStart(1, "div", 35);
    \u0275\u0275listener("click", function ReportesListComponent_Conditional_13_Template_div_click_1_listener($event) {
      \u0275\u0275restoreView(_r6);
      return \u0275\u0275resetView($event.stopPropagation());
    });
    \u0275\u0275elementStart(2, "div", 36)(3, "h3", 37);
    \u0275\u0275text(4, "Eliminar informe");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "button", 38);
    \u0275\u0275listener("click", function ReportesListComponent_Conditional_13_Template_button_click_5_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cancelarEliminar());
    });
    \u0275\u0275text(6, "\xD7");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(7, "div", 39)(8, "div", 40)(9, "div", 41);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(10, "svg", 42);
    \u0275\u0275element(11, "path", 43);
    \u0275\u0275elementEnd()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(12, "p", 44);
    \u0275\u0275text(13, " \xBFConfirma que quiere eliminar el informe ");
    \u0275\u0275elementStart(14, "strong");
    \u0275\u0275text(15);
    \u0275\u0275elementEnd();
    \u0275\u0275text(16, "? Solo se borra la plantilla; los datos del sistema no se tocan. ");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(17, "div", 45)(18, "button", 46);
    \u0275\u0275listener("click", function ReportesListComponent_Conditional_13_Template_button_click_18_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cancelarEliminar());
    });
    \u0275\u0275text(19, "Cancelar");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(20, "button", 47);
    \u0275\u0275listener("click", function ReportesListComponent_Conditional_13_Template_button_click_20_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.eliminar());
    });
    \u0275\u0275text(21);
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(15);
    \u0275\u0275textInterpolate(ctx.nombre);
    \u0275\u0275advance(3);
    \u0275\u0275property("disabled", ctx_r1.eliminando());
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r1.eliminando());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r1.eliminando() ? "Eliminando..." : "S\xED, eliminar", " ");
  }
}
var ReportesListComponent = class _ReportesListComponent {
  service = inject(ReporteService);
  notification = inject(NotificationService);
  plantillas = signal([]);
  cargando = signal(true);
  error = signal("");
  /** Mensaje del backend al enviar/descargar; se muestra tal cual (trae el destinatario o el motivo). */
  mensaje = signal("");
  enviandoId = signal(null);
  descargandoId = signal(null);
  confirmarEliminar = signal(null);
  eliminando = signal(false);
  etiquetasFuente = {
    estado_diario: "Estado Diario",
    movimientos: "Movimientos",
    agenda: "Recordatorios"
  };
  ngOnInit() {
    this.cargar();
  }
  cargar() {
    this.cargando.set(true);
    this.error.set("");
    this.service.getPlantillas().subscribe({
      next: (res) => {
        this.plantillas.set(res.plantillas);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set("No se pudieron cargar sus informes guardados");
      }
    });
  }
  /** Un solo envío/descarga a la vez: generar el Excel puede demorar. */
  ocupado() {
    return this.enviandoId() !== null || this.descargandoId() !== null || this.eliminando();
  }
  etiquetaFuente(fuente) {
    return this.etiquetasFuente[fuente] ?? fuente;
  }
  esError(resultado) {
    return resultado.toLowerCase().startsWith("error");
  }
  /** Fechas del backend (yyyy-MM-ddTHH:mm:ss) a dd-MM-yyyy HH:mm sin pasar por Date. */
  fmtFechaHora(valor) {
    if (!valor)
      return "Nunca";
    const [fecha, hora] = valor.split("T");
    const partes = fecha.split("-");
    if (partes.length !== 3)
      return valor;
    const hhmm = (hora || "").slice(0, 5);
    return `${partes[2]}-${partes[1]}-${partes[0]}${hhmm ? " " + hhmm : ""}`;
  }
  enviar(p) {
    if (this.ocupado())
      return;
    this.mensaje.set("");
    this.enviandoId.set(p.id);
    this.service.enviar(p.id).subscribe({
      next: (res) => {
        this.enviandoId.set(null);
        this.notification.success(res.mensaje);
        this.cargar();
      },
      error: (err) => {
        this.enviandoId.set(null);
        this.mensaje.set(`${err.error?.detail || "No se pudo enviar el informe"} \u2014 mientras tanto puede usar Descargar.`);
        this.cargar();
      }
    });
  }
  descargar(p) {
    if (this.ocupado())
      return;
    this.mensaje.set("");
    this.descargandoId.set(p.id);
    this.service.descargar(p.id).subscribe({
      next: (blob) => {
        this.descargandoId.set(null);
        descargarBlob(blob, nombreArchivoSeguro(p.nombre), p.nombre).catch(() => this.mensaje.set("No se pudo guardar el informe"));
      },
      error: (err) => {
        this.descargandoId.set(null);
        mensajeErrorBlob(err, "No se pudo generar el informe").then((m) => this.mensaje.set(m));
      }
    });
  }
  cancelarEliminar() {
    if (this.eliminando())
      return;
    this.confirmarEliminar.set(null);
  }
  eliminar() {
    const p = this.confirmarEliminar();
    if (!p)
      return;
    this.eliminando.set(true);
    this.service.eliminar(p.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.confirmarEliminar.set(null);
        this.notification.success("Informe eliminado");
        this.cargar();
      },
      error: (err) => {
        this.eliminando.set(false);
        this.notification.error(err.error?.detail || "No se pudo eliminar el informe");
      }
    });
  }
  static \u0275fac = function ReportesListComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _ReportesListComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _ReportesListComponent, selectors: [["app-reportes-list"]], decls: 14, vars: 3, consts: [[1, "space-y-6"], [1, "flex", "items-start", "justify-between", "flex-wrap", "gap-4"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], ["routerLink", "/informes/nuevo", 1, "btn-primary", "shrink-0"], [1, "alert-danger"], [1, "flex", "items-center", "justify-center", "py-20"], [1, "card"], [1, "modal-backdrop"], [1, "flex-1"], [1, "text-current", "opacity-60", "hover:opacity-100", 3, "click"], ["viewBox", "0 0 24 24", 1, "animate-spin", "h-10", "w-10", "text-primary-600"], ["cx", "12", "cy", "12", "r", "10", "stroke", "currentColor", "stroke-width", "4", "fill", "none", 1, "opacity-25"], ["fill", "currentColor", "d", "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z", 1, "opacity-75"], [1, "card-body", "space-y-3"], [1, "text-danger-700"], [1, "btn-secondary", 3, "click"], [1, "table-wrapper"], [1, "data-table"], [1, "font-medium"], [1, "hover:text-primary-600", "hover:underline", 3, "routerLink"], [1, "block", "text-xs", "font-normal", "text-neutral-400", "max-w-[280px]", "truncate", 3, "title"], [1, "badge-info"], [1, "max-w-[240px]", "truncate", 3, "title"], [1, "text-neutral-400"], [1, "badge-danger"], [1, "badge-success"], [1, "inline-flex", "items-center", "gap-1", "align-middle"], ["title", "Generar y enviar a mi correo", 1, "btn-outline", "btn-sm", 3, "click", "disabled"], ["title", "Descargar el Excel", 1, "btn-secondary", "btn-sm", 3, "click", "disabled"], [1, "btn-secondary", "btn-sm", 3, "routerLink"], [1, "btn-danger", "btn-sm", 3, "click", "disabled"], ["colspan", "6", 1, "text-center", "py-10", "text-neutral-400"], ["routerLink", "/informes/nuevo", 1, "text-primary-600", "hover:underline"], [1, "modal-backdrop", 3, "click"], [1, "modal-content", "max-w-sm", 3, "click"], [1, "modal-header"], [1, "text-lg", "font-semibold"], [1, "text-neutral-400", "hover:text-neutral-600", 3, "click"], [1, "modal-body"], [1, "flex", "items-start", "gap-3"], [1, "shrink-0", "w-10", "h-10", "rounded-full", "bg-danger-100", "flex", "items-center", "justify-center"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-5", "h-5", "text-danger-600"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"], [1, "text-sm", "text-neutral-600", "mt-2"], [1, "modal-footer"], [1, "btn-secondary", 3, "click", "disabled"], [1, "btn-danger", 3, "click", "disabled"]], template: function ReportesListComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div", 1)(2, "div")(3, "h1", 2);
      \u0275\u0275text(4, "Reportes");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(5, "p", 3);
      \u0275\u0275text(6, " Arme su informe eligiendo los campos que necesita y rec\xEDbalo en Excel por correo. ");
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(7, "a", 4);
      \u0275\u0275text(8, "Nuevo informe");
      \u0275\u0275elementEnd()();
      \u0275\u0275template(9, ReportesListComponent_Conditional_9_Template, 5, 1, "div", 5)(10, ReportesListComponent_Conditional_10_Template, 4, 0, "div", 6)(11, ReportesListComponent_Conditional_11_Template, 6, 1, "div", 7)(12, ReportesListComponent_Conditional_12_Template, 21, 1, "div", 7);
      \u0275\u0275elementEnd();
      \u0275\u0275template(13, ReportesListComponent_Conditional_13_Template, 22, 4, "div", 8);
    }
    if (rf & 2) {
      let tmp_2_0;
      \u0275\u0275advance(9);
      \u0275\u0275conditional(ctx.mensaje() ? 9 : -1);
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.cargando() ? 10 : ctx.error() ? 11 : 12);
      \u0275\u0275advance(3);
      \u0275\u0275conditional((tmp_2_0 = ctx.confirmarEliminar()) ? 13 : -1, tmp_2_0);
    }
  }, dependencies: [CommonModule, RouterLink], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ReportesListComponent, [{
    type: Component,
    args: [{
      selector: "app-reportes-list",
      standalone: true,
      imports: [CommonModule, RouterLink],
      template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Reportes</h1>
          <p class="text-neutral-500 mt-1">
            Arme su informe eligiendo los campos que necesita y rec\xEDbalo en Excel por correo.
          </p>
        </div>
        <a routerLink="/informes/nuevo" class="btn-primary shrink-0">Nuevo informe</a>
      </div>

      @if (mensaje()) {
        <div class="alert-danger">
          <span class="flex-1">{{ mensaje() }}</span>
          <button (click)="mensaje.set('')" class="text-current opacity-60 hover:opacity-100">&times;</button>
        </div>
      }

      @if (cargando()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      } @else if (error()) {
        <div class="card">
          <div class="card-body space-y-3">
            <p class="text-danger-700">{{ error() }}</p>
            <button (click)="cargar()" class="btn-secondary">Reintentar</button>
          </div>
        </div>
      } @else {
        <div class="card">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Informe</th>
                  <th>Fuente de datos</th>
                  <th>Campos</th>
                  <th>\xDAltima generaci\xF3n</th>
                  <th>Resultado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (p of plantillas(); track p.id) {
                  <tr>
                    <td class="font-medium">
                      <a [routerLink]="['/informes', p.id]" class="hover:text-primary-600 hover:underline">
                        {{ p.nombre }}
                      </a>
                      @if (p.descripcion) {
                        <span class="block text-xs font-normal text-neutral-400 max-w-[280px] truncate"
                              [title]="p.descripcion">{{ p.descripcion }}</span>
                      }
                    </td>
                    <td><span class="badge-info">{{ etiquetaFuente(p.fuente) }}</span></td>
                    <td>{{ p.campos.length }}</td>
                    <td>{{ fmtFechaHora(p.ultima_generacion) }}</td>
                    <td class="max-w-[240px] truncate" [title]="p.ultimo_resultado || ''">
                      @if (!p.ultimo_resultado) {
                        <span class="text-neutral-400">Nunca generado</span>
                      } @else if (esError(p.ultimo_resultado)) {
                        <span class="badge-danger">{{ p.ultimo_resultado }}</span>
                      } @else {
                        <span class="badge-success">{{ p.ultimo_resultado }}</span>
                      }
                    </td>
                    <td>
                      <div class="inline-flex items-center gap-1 align-middle">
                        <button (click)="enviar(p)" class="btn-outline btn-sm" [disabled]="ocupado()"
                                title="Generar y enviar a mi correo">
                          {{ enviandoId() === p.id ? 'Enviando...' : 'Enviar' }}
                        </button>
                        <button (click)="descargar(p)" class="btn-secondary btn-sm" [disabled]="ocupado()"
                                title="Descargar el Excel">
                          {{ descargandoId() === p.id ? 'Generando...' : 'Descargar' }}
                        </button>
                        <a [routerLink]="['/informes', p.id]" class="btn-secondary btn-sm">Editar</a>
                        <button (click)="confirmarEliminar.set(p)" class="btn-danger btn-sm" [disabled]="ocupado()">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="text-center py-10 text-neutral-400">
                      A\xFAn no tiene informes guardados.
                      <a routerLink="/informes/nuevo" class="text-primary-600 hover:underline">Cree el primero</a>.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    <!-- Confirmar eliminaci\xF3n -->
    @if (confirmarEliminar(); as p) {
      <div class="modal-backdrop" (click)="cancelarEliminar()">
        <div class="modal-content max-w-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">Eliminar informe</h3>
            <button (click)="cancelarEliminar()" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>
          <div class="modal-body">
            <div class="flex items-start gap-3">
              <div class="shrink-0 w-10 h-10 rounded-full bg-danger-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <p class="text-sm text-neutral-600 mt-2">
                \xBFConfirma que quiere eliminar el informe <strong>{{ p.nombre }}</strong>?
                Solo se borra la plantilla; los datos del sistema no se tocan.
              </p>
            </div>
          </div>
          <div class="modal-footer">
            <button (click)="cancelarEliminar()" class="btn-secondary" [disabled]="eliminando()">Cancelar</button>
            <button (click)="eliminar()" class="btn-danger" [disabled]="eliminando()">
              {{ eliminando() ? 'Eliminando...' : 'S\xED, eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(ReportesListComponent, { className: "ReportesListComponent", filePath: "src/app/features/reportes/reportes-list.component.ts", lineNumber: 150 });
})();
export {
  ReportesListComponent
};
//# sourceMappingURL=chunk-F4BOV4M6.js.map
