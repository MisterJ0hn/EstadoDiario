import {
  AudienciaService
} from "./chunk-IYRFMHMF.js";
import {
  FiltrosPanelComponent
} from "./chunk-KKQNT7IP.js";
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
  ActivatedRoute,
  Router
} from "./chunk-O3CMZLWV.js";
import {
  CommonModule,
  Component,
  computed,
  inject,
  setClassMetadata,
  signal,
  viewChild,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵattribute,
  ɵɵclassMap,
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
  ɵɵqueryAdvance,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵrepeaterTrackByIdentity,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtemplate,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1,
  ɵɵtextInterpolate2,
  ɵɵtextInterpolate3,
  ɵɵtwoWayBindingSet,
  ɵɵtwoWayListener,
  ɵɵtwoWayProperty,
  ɵɵviewQuerySignal
} from "./chunk-WMIGZGXS.js";
import {
  __spreadProps,
  __spreadValues
} from "./chunk-XWLXMCJQ.js";

// src/app/features/audiencias/audiencias.component.ts
var _forTrack0 = ($index, $item) => $item.materia;
var _forTrack1 = ($index, $item) => $item.fecha;
var _forTrack2 = ($index, $item) => $item.id;
var _forTrack3 = ($index, $item) => $item.etiqueta;
function AudienciasComponent_Conditional_12_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 7)(1, "span");
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "button", 28);
    \u0275\u0275listener("click", function AudienciasComponent_Conditional_12_Template_button_click_3_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.quitarFiltroArchivo());
    });
    \u0275\u0275text(4, "Ver todas");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate1("Mostrando solo las audiencias del archivo #", ctx_r1.filtroOrigenId, ".");
  }
}
function AudienciasComponent_For_20_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 10);
    \u0275\u0275listener("click", function AudienciasComponent_For_20_Template_button_click_0_listener() {
      const c_r4 = \u0275\u0275restoreView(_r3).$implicit;
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.seleccionarMateria(c_r4.materia));
    });
    \u0275\u0275text(1);
    \u0275\u0275elementStart(2, "span", 11);
    \u0275\u0275text(3);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const c_r4 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275classMap(ctx_r1.materiaActiva() === c_r4.materia ? "border-primary-600 text-primary-700" : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300");
    \u0275\u0275attribute("aria-selected", ctx_r1.materiaActiva() === c_r4.materia);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", c_r4.materia || "Sin materia", " ");
    \u0275\u0275advance();
    \u0275\u0275classMap(ctx_r1.materiaActiva() === c_r4.materia ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-600");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", c_r4.total, " ");
  }
}
function AudienciasComponent_For_33_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "option", 18);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const t_r5 = ctx.$implicit;
    \u0275\u0275property("ngValue", t_r5);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(t_r5);
  }
}
function AudienciasComponent_Conditional_47_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 26);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(1, "svg", 29);
    \u0275\u0275element(2, "circle", 30)(3, "path", 31);
    \u0275\u0275elementEnd()();
  }
}
function AudienciasComponent_Conditional_48_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275text(0, " No se encontraron audiencias con esos filtros ");
  }
}
function AudienciasComponent_Conditional_48_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275text(0, " No hay audiencias pr\xF3ximas. Si esperaba alguna, revise que el archivo de audiencias se haya importado. ");
  }
}
function AudienciasComponent_Conditional_48_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 27)(1, "div", 32);
    \u0275\u0275template(2, AudienciasComponent_Conditional_48_Conditional_2_Template, 1, 0)(3, AudienciasComponent_Conditional_48_Conditional_3_Template, 1, 0);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r1.incluirPasadas() ? 2 : 3);
  }
}
function AudienciasComponent_Conditional_49_For_2_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 37);
    \u0275\u0275text(1, "Hoy");
    \u0275\u0275elementEnd();
  }
}
function AudienciasComponent_Conditional_49_For_2_Conditional_14_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "th");
    \u0275\u0275text(1, "Materia");
    \u0275\u0275elementEnd();
  }
}
function AudienciasComponent_Conditional_49_For_2_For_29_Conditional_6_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 56);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const a_r7 = \u0275\u0275nextContext(2).$implicit;
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(a_r7.materia);
  }
}
function AudienciasComponent_Conditional_49_For_2_For_29_Conditional_6_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275text(0, " - ");
  }
}
function AudienciasComponent_Conditional_49_For_2_For_29_Conditional_6_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "td");
    \u0275\u0275template(1, AudienciasComponent_Conditional_49_For_2_For_29_Conditional_6_Conditional_1_Template, 2, 1, "span", 56)(2, AudienciasComponent_Conditional_49_For_2_For_29_Conditional_6_Conditional_2_Template, 1, 0);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const a_r7 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275advance();
    \u0275\u0275conditional(a_r7.materia ? 1 : 2);
  }
}
function AudienciasComponent_Conditional_49_For_2_For_29_Conditional_18_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 53);
    \u0275\u0275text(1, "\u2713");
    \u0275\u0275elementEnd();
  }
}
function AudienciasComponent_Conditional_49_For_2_For_29_Conditional_19_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 54);
    \u0275\u0275text(1, "\u2013");
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const a_r7 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275property("title", a_r7.google_sync_error || "Todav\xEDa no publicada en Google Calendar");
  }
}
function AudienciasComponent_Conditional_49_For_2_For_29_Conditional_20_For_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div")(1, "dt", 61);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "dd", 62);
    \u0275\u0275text(4);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const d_r8 = ctx.$implicit;
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(d_r8.etiqueta);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(d_r8.valor);
  }
}
function AudienciasComponent_Conditional_49_For_2_For_29_Conditional_20_ForEmpty_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 59);
    \u0275\u0275text(1, "Sin datos adicionales para esta audiencia");
    \u0275\u0275elementEnd();
  }
}
function AudienciasComponent_Conditional_49_For_2_For_29_Conditional_20_Conditional_6_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 60);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const a_r7 = \u0275\u0275nextContext(2).$implicit;
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" Google Calendar: ", a_r7.google_sync_error, " ");
  }
}
function AudienciasComponent_Conditional_49_For_2_For_29_Conditional_20_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "tr", 55)(1, "td", 57)(2, "dl", 58);
    \u0275\u0275repeaterCreate(3, AudienciasComponent_Conditional_49_For_2_For_29_Conditional_20_For_4_Template, 5, 2, "div", null, _forTrack3, false, AudienciasComponent_Conditional_49_For_2_For_29_Conditional_20_ForEmpty_5_Template, 2, 0, "div", 59);
    \u0275\u0275elementEnd();
    \u0275\u0275template(6, AudienciasComponent_Conditional_49_For_2_For_29_Conditional_20_Conditional_6_Template, 2, 1, "p", 60);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const a_r7 = \u0275\u0275nextContext().$implicit;
    const ctx_r1 = \u0275\u0275nextContext(3);
    \u0275\u0275advance();
    \u0275\u0275attribute("colspan", ctx_r1.colspan());
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r1.detalle(a_r7));
    \u0275\u0275advance(3);
    \u0275\u0275conditional(a_r7.google_sync_error ? 6 : -1);
  }
}
function AudienciasComponent_Conditional_49_For_2_For_29_Template(rf, ctx) {
  if (rf & 1) {
    const _r6 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "tr", 44);
    \u0275\u0275listener("click", function AudienciasComponent_Conditional_49_For_2_For_29_Template_tr_click_0_listener() {
      const a_r7 = \u0275\u0275restoreView(_r6).$implicit;
      const ctx_r1 = \u0275\u0275nextContext(3);
      return \u0275\u0275resetView(ctx_r1.alternarDetalle(a_r7.id));
    });
    \u0275\u0275elementStart(1, "td", 45);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(2, "svg", 46);
    \u0275\u0275element(3, "path", 47);
    \u0275\u0275elementEnd()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(4, "td", 48);
    \u0275\u0275text(5);
    \u0275\u0275elementEnd();
    \u0275\u0275template(6, AudienciasComponent_Conditional_49_For_2_For_29_Conditional_6_Template, 3, 1, "td");
    \u0275\u0275elementStart(7, "td", 49);
    \u0275\u0275text(8);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(9, "td", 50);
    \u0275\u0275text(10);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(11, "td", 51);
    \u0275\u0275text(12);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(13, "td", 49);
    \u0275\u0275text(14);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(15, "td", 51);
    \u0275\u0275text(16);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(17, "td", 52);
    \u0275\u0275template(18, AudienciasComponent_Conditional_49_For_2_For_29_Conditional_18_Template, 2, 0, "span", 53)(19, AudienciasComponent_Conditional_49_For_2_For_29_Conditional_19_Template, 2, 1, "span", 54);
    \u0275\u0275elementEnd()();
    \u0275\u0275template(20, AudienciasComponent_Conditional_49_For_2_For_29_Conditional_20_Template, 7, 3, "tr", 55);
  }
  if (rf & 2) {
    const a_r7 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext(3);
    \u0275\u0275advance(2);
    \u0275\u0275classProp("rotate-90", ctx_r1.detalleAbiertoId() === a_r7.id);
    \u0275\u0275attribute("aria-label", ctx_r1.detalleAbiertoId() === a_r7.id ? "Ocultar detalle" : "Ver detalle");
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r1.fmtHora(a_r7.hora));
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r1.materiaActiva() === null ? 6 : -1);
    \u0275\u0275advance();
    \u0275\u0275property("title", a_r7.tipo_audiencia || "");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", a_r7.tipo_audiencia || "-", " ");
    \u0275\u0275advance();
    \u0275\u0275property("title", a_r7.caratulado || "");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(a_r7.caratulado || "-");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(a_r7.rol || a_r7.ruc || "-");
    \u0275\u0275advance();
    \u0275\u0275property("title", a_r7.tribunal || "");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(a_r7.tribunal || "-");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(a_r7.sala || "-");
    \u0275\u0275advance(2);
    \u0275\u0275conditional(a_r7.en_google_calendar ? 18 : 19);
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r1.detalleAbiertoId() === a_r7.id ? 20 : -1);
  }
}
function AudienciasComponent_Conditional_49_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 27)(1, "div", 35)(2, "span", 36);
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
    \u0275\u0275template(4, AudienciasComponent_Conditional_49_For_2_Conditional_4_Template, 2, 0, "span", 37);
    \u0275\u0275elementStart(5, "span", 38);
    \u0275\u0275text(6);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(7, "div", 39)(8, "table", 40)(9, "thead")(10, "tr");
    \u0275\u0275element(11, "th", 41);
    \u0275\u0275elementStart(12, "th", 42);
    \u0275\u0275text(13, "Hora");
    \u0275\u0275elementEnd();
    \u0275\u0275template(14, AudienciasComponent_Conditional_49_For_2_Conditional_14_Template, 2, 0, "th");
    \u0275\u0275elementStart(15, "th");
    \u0275\u0275text(16, "Tipo de audiencia");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(17, "th");
    \u0275\u0275text(18, "Car\xE1tula");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(19, "th");
    \u0275\u0275text(20, "RIT / RUC");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(21, "th");
    \u0275\u0275text(22, "Tribunal");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(23, "th");
    \u0275\u0275text(24, "Sala");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(25, "th", 43);
    \u0275\u0275text(26, "GCal");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(27, "tbody");
    \u0275\u0275repeaterCreate(28, AudienciasComponent_Conditional_49_For_2_For_29_Template, 21, 15, null, null, _forTrack2);
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const g_r9 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(g_r9.etiqueta);
    \u0275\u0275advance();
    \u0275\u0275conditional(g_r9.esHoy ? 4 : -1);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate2(" ", g_r9.audiencias.length, " ", g_r9.audiencias.length === 1 ? "audiencia" : "audiencias", " ");
    \u0275\u0275advance(8);
    \u0275\u0275conditional(ctx_r1.materiaActiva() === null ? 14 : -1);
    \u0275\u0275advance(14);
    \u0275\u0275repeater(g_r9.audiencias);
  }
}
function AudienciasComponent_Conditional_49_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    const _r10 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 34)(1, "span", 63);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "div", 64)(4, "button", 65);
    \u0275\u0275listener("click", function AudienciasComponent_Conditional_49_Conditional_3_Template_button_click_4_listener() {
      \u0275\u0275restoreView(_r10);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.irAPagina(ctx_r1.currentPage() - 1));
    });
    \u0275\u0275text(5, "Anterior");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "button", 65);
    \u0275\u0275listener("click", function AudienciasComponent_Conditional_49_Conditional_3_Template_button_click_6_listener() {
      \u0275\u0275restoreView(_r10);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.irAPagina(ctx_r1.currentPage() + 1));
    });
    \u0275\u0275text(7, "Siguiente");
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate3(" P\xE1gina ", ctx_r1.currentPage(), " de ", ctx_r1.totalPages(), " (", ctx_r1.total(), " audiencias) ");
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r1.currentPage() <= 1);
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r1.currentPage() >= ctx_r1.totalPages());
  }
}
function AudienciasComponent_Conditional_49_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 33);
    \u0275\u0275repeaterCreate(1, AudienciasComponent_Conditional_49_For_2_Template, 30, 5, "div", 27, _forTrack1);
    \u0275\u0275elementEnd();
    \u0275\u0275template(3, AudienciasComponent_Conditional_49_Conditional_3_Template, 8, 5, "div", 34);
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r1.grupos());
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r1.totalPages() > 1 ? 3 : -1);
  }
}
var DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Mi\xE9rcoles", "Jueves", "Viernes", "S\xE1bado"];
var MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
];
function claveDia(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
var AudienciasComponent = class _AudienciasComponent {
  service = inject(AudienciaService);
  notification = inject(NotificationService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  audiencias = signal([]);
  materias = signal([]);
  tiposAudiencia = signal([]);
  totalResumen = signal(0);
  loading = signal(true);
  sincronizando = signal(false);
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);
  /** null = pestaña "Todas". Se refleja en el query param `materia`. */
  materiaActiva = signal(null);
  detalleAbiertoId = signal(null);
  /** Por defecto solo lo que viene; el histórico es una decisión explícita. */
  incluirPasadas = signal(false);
  filtroBusqueda = "";
  filtroTipo = "";
  filtroTribunal = "";
  filtroRut = "";
  filtroDesde = "";
  filtroHasta = "";
  /** Filtros ya aplicados, los que se ven como badges. */
  chipsFiltros = signal([]);
  panel = viewChild(FiltrosPanelComponent);
  /** Fijado por query param cuando se entra desde un archivo; no se edita en pantalla. */
  filtroOrigenId;
  /** Columnas visibles, para el colspan de las filas de detalle. */
  colspan = computed(() => this.materiaActiva() === null ? 9 : 8);
  /** Agrupación por día: una agenda se lee por jornada, no fila por fila. */
  grupos = computed(() => {
    const hoy = claveDia(/* @__PURE__ */ new Date());
    const mapa = /* @__PURE__ */ new Map();
    for (const a of this.audiencias()) {
      const lista = mapa.get(a.fecha_audiencia) ?? [];
      lista.push(a);
      mapa.set(a.fecha_audiencia, lista);
    }
    return [...mapa.entries()].map(([fecha, lista]) => ({
      fecha,
      etiqueta: this.etiquetaDia(fecha),
      esHoy: fecha === hoy,
      audiencias: lista
    }));
  });
  ngOnInit() {
    const materia = this.route.snapshot.queryParamMap.get("materia");
    this.materiaActiva.set(materia || null);
    const origenId = Number(this.route.snapshot.queryParamMap.get("origen_id"));
    this.filtroOrigenId = Number.isFinite(origenId) && origenId > 0 ? origenId : void 0;
    const busqueda = this.route.snapshot.queryParamMap.get("busqueda");
    if (busqueda)
      this.filtroBusqueda = busqueda;
    if (this.filtroOrigenId || busqueda)
      this.incluirPasadas.set(true);
    this.sincronizarChips();
    this.cargarResumen();
    this.cargarDatos();
  }
  /** "Jueves 7 de agosto de 2026", sin pasar por Date (que desplaza por zona horaria). */
  etiquetaDia(iso) {
    const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number);
    if (!anio || !mes || !dia)
      return iso;
    const nombreDia = DIAS_SEMANA[new Date(anio, mes - 1, dia).getDay()];
    return `${nombreDia} ${dia} de ${MESES[mes - 1]} de ${anio}`;
  }
  /** "10:00:00" -> "10:00". Sin hora (pasa en la hoja Penal) se dice explícitamente. */
  fmtHora(valor) {
    return valor ? valor.slice(0, 5) : "Sin hora";
  }
  /** Fechas ISO (yyyy-MM-dd) a dd-MM-yyyy sin pasar por Date. */
  fmtFecha(valor) {
    if (!valor)
      return "-";
    const partes = valor.slice(0, 10).split("-");
    return partes.length === 3 ? `${partes[2]}-${partes[1]}-${partes[0]}` : valor;
  }
  /** Campos que no están en la tabla; se omiten los vacíos. */
  detalle(a) {
    const campos = [
      { etiqueta: "Materia", valor: a.materia },
      { etiqueta: "RIT", valor: a.rol },
      { etiqueta: "RUC", valor: a.ruc },
      { etiqueta: "Juez", valor: a.juez },
      { etiqueta: "Estado", valor: a.estado },
      { etiqueta: "Tribunal", valor: a.tribunal },
      { etiqueta: "Sala", valor: a.sala },
      { etiqueta: "RUT", valor: a.rut },
      { etiqueta: "Archivo", valor: a.nombre_archivo }
    ];
    return campos.filter((c) => !!c.valor && String(c.valor).trim() !== "").map((c) => ({ etiqueta: c.etiqueta, valor: String(c.valor) }));
  }
  alternarDetalle(id) {
    this.detalleAbiertoId.set(this.detalleAbiertoId() === id ? null : id);
  }
  alternarPasadas() {
    this.incluirPasadas.set(!this.incluirPasadas());
    this.onFiltrar();
  }
  seleccionarMateria(materia) {
    if (this.materiaActiva() === materia)
      return;
    this.materiaActiva.set(materia);
    this.currentPage.set(1);
    this.detalleAbiertoId.set(null);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { materia: materia || null },
      queryParamsHandling: "merge",
      replaceUrl: true
    });
    this.cargarDatos();
  }
  cargarDatos() {
    this.loading.set(true);
    this.service.getAudiencias(__spreadProps(__spreadValues({}, this.filtros()), {
      materia: this.materiaActiva() || void 0,
      page: this.currentPage(),
      limit: 50
    })).subscribe({
      next: (res) => {
        this.audiencias.set(res.audiencias);
        this.total.set(res.total);
        this.currentPage.set(res.page);
        this.totalPages.set(res.total_pages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error("Error al cargar las audiencias");
      }
    });
  }
  /** Conteos por materia y tipos disponibles; respeta los filtros activos. */
  cargarResumen() {
    this.service.getResumen(this.filtros()).subscribe({
      next: (res) => {
        this.materias.set(res.por_materia);
        this.totalResumen.set(res.total);
        this.tiposAudiencia.set(res.tipos_audiencia);
      },
      error: () => {
        this.materias.set([]);
        this.tiposAudiencia.set([]);
      }
    });
  }
  filtros() {
    return {
      busqueda: this.filtroBusqueda || void 0,
      tipo_audiencia: this.filtroTipo || void 0,
      tribunal: this.filtroTribunal || void 0,
      rut: this.filtroRut || void 0,
      origen_id: this.filtroOrigenId,
      desde: this.filtroDesde || void 0,
      hasta: this.filtroHasta || void 0,
      incluir_pasadas: this.incluirPasadas() || void 0
    };
  }
  onFiltrar() {
    this.currentPage.set(1);
    this.detalleAbiertoId.set(null);
    this.sincronizarChips();
    this.cargarDatos();
    this.cargarResumen();
  }
  onLimpiarFiltros() {
    this.filtroBusqueda = "";
    this.filtroTipo = "";
    this.filtroTribunal = "";
    this.filtroRut = "";
    this.filtroDesde = "";
    this.filtroHasta = "";
    this.onFiltrar();
  }
  /** Enter dentro de un campo del panel: aplica sin ir hasta el botón. */
  aplicarDesdeCampo() {
    this.panel()?.cerrar();
    this.onFiltrar();
  }
  /** Quita un solo filtro desde su badge y vuelve a consultar. */
  quitarFiltro(clave) {
    switch (clave) {
      case "busqueda":
        this.filtroBusqueda = "";
        break;
      case "tipo_audiencia":
        this.filtroTipo = "";
        break;
      case "tribunal":
        this.filtroTribunal = "";
        break;
      case "rut":
        this.filtroRut = "";
        break;
      case "desde":
        this.filtroDesde = "";
        break;
      case "hasta":
        this.filtroHasta = "";
        break;
    }
    this.onFiltrar();
  }
  /**
   * Badges de lo APLICADO, no de lo escrito: si el usuario abre el panel,
   * escribe y lo cierra sin aplicar, la barra no debe mentir sobre qué se está
   * consultando.
   *
   * `origen_id` queda fuera a propósito: no se edita en pantalla y ya tiene su
   * propio aviso arriba del listado.
   */
  sincronizarChips() {
    const chips = [];
    if (this.filtroBusqueda) {
      chips.push({ clave: "busqueda", etiqueta: "B\xFAsqueda", valor: this.filtroBusqueda });
    }
    if (this.filtroTipo) {
      chips.push({ clave: "tipo_audiencia", etiqueta: "Tipo", valor: this.filtroTipo });
    }
    if (this.filtroTribunal) {
      chips.push({ clave: "tribunal", etiqueta: "Tribunal", valor: this.filtroTribunal });
    }
    if (this.filtroRut) {
      chips.push({ clave: "rut", etiqueta: "RUT", valor: this.filtroRut });
    }
    if (this.filtroDesde) {
      chips.push({ clave: "desde", etiqueta: "Desde", valor: this.fmtFecha(this.filtroDesde) });
    }
    if (this.filtroHasta) {
      chips.push({ clave: "hasta", etiqueta: "Hasta", valor: this.fmtFecha(this.filtroHasta) });
    }
    this.chipsFiltros.set(chips);
  }
  quitarFiltroArchivo() {
    this.filtroOrigenId = void 0;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { origen_id: null },
      queryParamsHandling: "merge",
      replaceUrl: true
    });
    this.onFiltrar();
  }
  /**
   * Reintento manual de la publicación en Google, que ya corre sola al
   * importar. Sirve para cuando el usuario conectó su cuenta DESPUÉS de que le
   * llegaran las audiencias por correo.
   */
  sincronizarGoogle() {
    this.sincronizando.set(true);
    this.service.sincronizarGoogle().subscribe({
      next: (res) => {
        this.sincronizando.set(false);
        if (res.exito) {
          this.notification.success(res.mensaje || "Audiencias publicadas en Google Calendar");
          this.cargarDatos();
        } else {
          this.notification.warning(res.mensaje || "No se pudo publicar en Google Calendar");
        }
      },
      error: (err) => {
        this.sincronizando.set(false);
        this.notification.error(err.error?.detail || "No se pudo publicar en Google Calendar");
      }
    });
  }
  irAPagina(page) {
    this.currentPage.set(page);
    this.detalleAbiertoId.set(null);
    this.cargarDatos();
  }
  static \u0275fac = function AudienciasComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _AudienciasComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _AudienciasComponent, selectors: [["app-audiencias"]], viewQuery: function AudienciasComponent_Query(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275viewQuerySignal(ctx.panel, FiltrosPanelComponent, 5);
    }
    if (rf & 2) {
      \u0275\u0275queryAdvance();
    }
  }, decls: 50, vars: 21, consts: [[1, "space-y-6"], [1, "flex", "items-start", "justify-between", "flex-wrap", "gap-4"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], [1, "flex", "items-center", "gap-2"], [1, "btn-secondary", "btn-sm", 3, "click"], [1, "btn-outline", "btn-sm", 3, "click", "disabled"], [1, "alert-info", "flex", "items-center", "justify-between", "gap-4"], [1, "border-b", "border-neutral-200"], ["role", "tablist", 1, "-mb-px", "flex", "gap-1", "overflow-x-auto"], ["type", "button", "role", "tab", 1, "flex", "items-center", "gap-2", "whitespace-nowrap", "border-b-2", "px-4", "py-3", "text-sm", "font-medium", "transition-colors", 3, "click"], [1, "rounded-full", "px-2", "py-0.5", "text-xs", "font-semibold"], ["type", "button", "role", "tab", 1, "flex", "items-center", "gap-2", "whitespace-nowrap", "border-b-2", "px-4", "py-3", "text-sm", "font-medium", "transition-colors", 3, "class"], [3, "aplicar", "limpiar", "quitar", "chips"], ["for", "a-busqueda", 1, "form-label"], ["id", "a-busqueda", "type", "text", "placeholder", "Car\xE1tula, RIT o RUC", 1, "form-input", 3, "ngModelChange", "keyup.enter", "ngModel"], ["for", "a-tipo", 1, "form-label"], ["id", "a-tipo", 1, "form-select", 3, "ngModelChange", "ngModel"], [3, "ngValue"], ["for", "a-tribunal", 1, "form-label"], ["id", "a-tribunal", "type", "text", "placeholder", "Coincidencia parcial", 1, "form-input", 3, "ngModelChange", "keyup.enter", "ngModel"], [1, "grid", "grid-cols-2", "gap-3"], ["for", "a-desde", 1, "form-label"], ["id", "a-desde", "type", "date", 1, "form-input", 3, "ngModelChange", "ngModel"], ["for", "a-hasta", 1, "form-label"], ["id", "a-hasta", "type", "date", 1, "form-input", 3, "ngModelChange", "ngModel"], [1, "flex", "items-center", "justify-center", "py-20"], [1, "card"], [1, "btn-secondary", "btn-sm", "shrink-0", 3, "click"], ["viewBox", "0 0 24 24", 1, "animate-spin", "h-10", "w-10", "text-primary-600"], ["cx", "12", "cy", "12", "r", "10", "stroke", "currentColor", "stroke-width", "4", "fill", "none", 1, "opacity-25"], ["fill", "currentColor", "d", "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z", 1, "opacity-75"], [1, "py-16", "text-center", "text-neutral-400"], [1, "space-y-5"], [1, "card", "flex", "items-center", "justify-between", "px-6", "py-4"], [1, "flex", "items-center", "gap-3", "px-6", "py-3", "border-b", "border-neutral-200", "bg-neutral-50"], [1, "font-semibold", "text-neutral-800"], [1, "badge-info"], [1, "text-sm", "text-neutral-500", "ml-auto"], [1, "table-wrapper"], [1, "data-table"], [1, "w-8"], [1, "w-20"], ["title", "Publicada en Google Calendar", 1, "w-10"], [1, "cursor-pointer", 3, "click"], [1, "text-neutral-400"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-4", "h-4", "transition-transform"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M9 5l7 7-7 7"], [1, "font-semibold", "tabular-nums"], [1, "max-w-[220px]", "truncate", 3, "title"], [1, "max-w-[240px]", "truncate", 3, "title"], [1, "whitespace-nowrap"], [1, "text-center"], ["title", "Publicada en Google Calendar", 1, "text-accent-600"], [1, "text-neutral-300", 3, "title"], [1, "bg-neutral-50"], [1, "badge-neutral"], [1, "whitespace-normal"], [1, "grid", "grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-4", "gap-4", "py-2"], [1, "text-sm", "text-neutral-400"], [1, "text-xs", "text-danger-600", "pb-2"], [1, "text-xs", "text-neutral-500", "uppercase", "tracking-wide"], [1, "text-sm", "text-neutral-800", "mt-0.5", "break-words"], [1, "text-sm", "text-neutral-500"], [1, "flex", "gap-2"], [1, "btn-secondary", "btn-sm", 3, "click", "disabled"]], template: function AudienciasComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div", 1)(2, "div")(3, "h1", 2);
      \u0275\u0275text(4, "Pr\xF3ximas audiencias");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(5, "p", 3);
      \u0275\u0275text(6);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(7, "div", 4)(8, "button", 5);
      \u0275\u0275listener("click", function AudienciasComponent_Template_button_click_8_listener() {
        return ctx.alternarPasadas();
      });
      \u0275\u0275text(9);
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(10, "button", 6);
      \u0275\u0275listener("click", function AudienciasComponent_Template_button_click_10_listener() {
        return ctx.sincronizarGoogle();
      });
      \u0275\u0275text(11);
      \u0275\u0275elementEnd()()();
      \u0275\u0275template(12, AudienciasComponent_Conditional_12_Template, 5, 1, "div", 7);
      \u0275\u0275elementStart(13, "div", 8)(14, "nav", 9)(15, "button", 10);
      \u0275\u0275listener("click", function AudienciasComponent_Template_button_click_15_listener() {
        return ctx.seleccionarMateria(null);
      });
      \u0275\u0275text(16, " Todas ");
      \u0275\u0275elementStart(17, "span", 11);
      \u0275\u0275text(18);
      \u0275\u0275elementEnd()();
      \u0275\u0275repeaterCreate(19, AudienciasComponent_For_20_Template, 4, 7, "button", 12, _forTrack0);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(21, "app-filtros-panel", 13);
      \u0275\u0275listener("aplicar", function AudienciasComponent_Template_app_filtros_panel_aplicar_21_listener() {
        return ctx.onFiltrar();
      })("limpiar", function AudienciasComponent_Template_app_filtros_panel_limpiar_21_listener() {
        return ctx.onLimpiarFiltros();
      })("quitar", function AudienciasComponent_Template_app_filtros_panel_quitar_21_listener($event) {
        return ctx.quitarFiltro($event);
      });
      \u0275\u0275elementStart(22, "div")(23, "label", 14);
      \u0275\u0275text(24, "B\xFAsqueda");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(25, "input", 15);
      \u0275\u0275twoWayListener("ngModelChange", function AudienciasComponent_Template_input_ngModelChange_25_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.filtroBusqueda, $event) || (ctx.filtroBusqueda = $event);
        return $event;
      });
      \u0275\u0275listener("keyup.enter", function AudienciasComponent_Template_input_keyup_enter_25_listener() {
        return ctx.aplicarDesdeCampo();
      });
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(26, "div")(27, "label", 16);
      \u0275\u0275text(28, "Tipo de audiencia");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(29, "select", 17);
      \u0275\u0275twoWayListener("ngModelChange", function AudienciasComponent_Template_select_ngModelChange_29_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.filtroTipo, $event) || (ctx.filtroTipo = $event);
        return $event;
      });
      \u0275\u0275elementStart(30, "option", 18);
      \u0275\u0275text(31, "Todos");
      \u0275\u0275elementEnd();
      \u0275\u0275repeaterCreate(32, AudienciasComponent_For_33_Template, 2, 2, "option", 18, \u0275\u0275repeaterTrackByIdentity);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(34, "div")(35, "label", 19);
      \u0275\u0275text(36, "Tribunal");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(37, "input", 20);
      \u0275\u0275twoWayListener("ngModelChange", function AudienciasComponent_Template_input_ngModelChange_37_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.filtroTribunal, $event) || (ctx.filtroTribunal = $event);
        return $event;
      });
      \u0275\u0275listener("keyup.enter", function AudienciasComponent_Template_input_keyup_enter_37_listener() {
        return ctx.aplicarDesdeCampo();
      });
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(38, "div", 21)(39, "div")(40, "label", 22);
      \u0275\u0275text(41, "Desde");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(42, "input", 23);
      \u0275\u0275twoWayListener("ngModelChange", function AudienciasComponent_Template_input_ngModelChange_42_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.filtroDesde, $event) || (ctx.filtroDesde = $event);
        return $event;
      });
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(43, "div")(44, "label", 24);
      \u0275\u0275text(45, "Hasta");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(46, "input", 25);
      \u0275\u0275twoWayListener("ngModelChange", function AudienciasComponent_Template_input_ngModelChange_46_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.filtroHasta, $event) || (ctx.filtroHasta = $event);
        return $event;
      });
      \u0275\u0275elementEnd()()()();
      \u0275\u0275template(47, AudienciasComponent_Conditional_47_Template, 4, 0, "div", 26)(48, AudienciasComponent_Conditional_48_Template, 4, 1, "div", 27)(49, AudienciasComponent_Conditional_49_Template, 4, 1);
      \u0275\u0275elementEnd();
    }
    if (rf & 2) {
      \u0275\u0275advance(6);
      \u0275\u0275textInterpolate3(" ", ctx.incluirPasadas() ? "Todas las audiencias" : "Audiencias fijadas de hoy en adelante", " \u2014 ", ctx.total(), " ", ctx.total() === 1 ? "audiencia" : "audiencias", " ");
      \u0275\u0275advance(3);
      \u0275\u0275textInterpolate1(" ", ctx.incluirPasadas() ? "Ver solo pr\xF3ximas" : "Incluir pasadas", " ");
      \u0275\u0275advance();
      \u0275\u0275property("disabled", ctx.sincronizando());
      \u0275\u0275advance();
      \u0275\u0275textInterpolate1(" ", ctx.sincronizando() ? "Publicando..." : "Publicar en Google Calendar", " ");
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.filtroOrigenId ? 12 : -1);
      \u0275\u0275advance(3);
      \u0275\u0275classMap(ctx.materiaActiva() === null ? "border-primary-600 text-primary-700" : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300");
      \u0275\u0275attribute("aria-selected", ctx.materiaActiva() === null);
      \u0275\u0275advance(2);
      \u0275\u0275classMap(ctx.materiaActiva() === null ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-600");
      \u0275\u0275advance();
      \u0275\u0275textInterpolate1(" ", ctx.totalResumen(), " ");
      \u0275\u0275advance();
      \u0275\u0275repeater(ctx.materias());
      \u0275\u0275advance(2);
      \u0275\u0275property("chips", ctx.chipsFiltros());
      \u0275\u0275advance(4);
      \u0275\u0275twoWayProperty("ngModel", ctx.filtroBusqueda);
      \u0275\u0275advance(4);
      \u0275\u0275twoWayProperty("ngModel", ctx.filtroTipo);
      \u0275\u0275advance();
      \u0275\u0275property("ngValue", "");
      \u0275\u0275advance(2);
      \u0275\u0275repeater(ctx.tiposAudiencia());
      \u0275\u0275advance(5);
      \u0275\u0275twoWayProperty("ngModel", ctx.filtroTribunal);
      \u0275\u0275advance(5);
      \u0275\u0275twoWayProperty("ngModel", ctx.filtroDesde);
      \u0275\u0275advance(4);
      \u0275\u0275twoWayProperty("ngModel", ctx.filtroHasta);
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.loading() ? 47 : ctx.grupos().length === 0 ? 48 : 49);
    }
  }, dependencies: [CommonModule, FormsModule, NgSelectOption, \u0275NgSelectMultipleOption, DefaultValueAccessor, SelectControlValueAccessor, NgControlStatus, NgModel, FiltrosPanelComponent], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(AudienciasComponent, [{
    type: Component,
    args: [{
      selector: "app-audiencias",
      standalone: true,
      imports: [CommonModule, FormsModule, FiltrosPanelComponent],
      template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Pr\xF3ximas audiencias</h1>
          <p class="text-neutral-500 mt-1">
            {{ incluirPasadas() ? 'Todas las audiencias' : 'Audiencias fijadas de hoy en adelante' }}
            \u2014 {{ total() }} {{ total() === 1 ? 'audiencia' : 'audiencias' }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="alternarPasadas()" class="btn-secondary btn-sm">
            {{ incluirPasadas() ? 'Ver solo pr\xF3ximas' : 'Incluir pasadas' }}
          </button>
          <button (click)="sincronizarGoogle()" class="btn-outline btn-sm" [disabled]="sincronizando()">
            {{ sincronizando() ? 'Publicando...' : 'Publicar en Google Calendar' }}
          </button>
        </div>
      </div>

      <!-- Se lleg\xF3 acotado a un archivo concreto desde la vista Archivos -->
      @if (filtroOrigenId) {
        <div class="alert-info flex items-center justify-between gap-4">
          <span>Mostrando solo las audiencias del archivo #{{ filtroOrigenId }}.</span>
          <button (click)="quitarFiltroArchivo()" class="btn-secondary btn-sm shrink-0">Ver todas</button>
        </div>
      }

      <!-- Pesta\xF1as por materia (las alimenta /audiencias/resumen) -->
      <div class="border-b border-neutral-200">
        <nav class="-mb-px flex gap-1 overflow-x-auto" role="tablist">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="materiaActiva() === null"
            (click)="seleccionarMateria(null)"
            class="flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors"
            [class]="materiaActiva() === null
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'"
          >
            Todas
            <span class="rounded-full px-2 py-0.5 text-xs font-semibold"
                  [class]="materiaActiva() === null ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'">
              {{ totalResumen() }}
            </span>
          </button>
          @for (c of materias(); track c.materia) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="materiaActiva() === c.materia"
              (click)="seleccionarMateria(c.materia)"
              class="flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              [class]="materiaActiva() === c.materia
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'"
            >
              {{ c.materia || 'Sin materia' }}
              <span class="rounded-full px-2 py-0.5 text-xs font-semibold"
                    [class]="materiaActiva() === c.materia ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'">
                {{ c.total }}
              </span>
            </button>
          }
        </nav>
      </div>

      <!-- Filtros: campos en el panel lateral, badges de lo aplicado ac\xE1. -->
      <app-filtros-panel
        [chips]="chipsFiltros()"
        (aplicar)="onFiltrar()"
        (limpiar)="onLimpiarFiltros()"
        (quitar)="quitarFiltro($event)"
      >
        <div>
          <label class="form-label" for="a-busqueda">B\xFAsqueda</label>
          <input id="a-busqueda" type="text" class="form-input" [(ngModel)]="filtroBusqueda"
                 placeholder="Car\xE1tula, RIT o RUC" (keyup.enter)="aplicarDesdeCampo()" />
        </div>
        <div>
          <label class="form-label" for="a-tipo">Tipo de audiencia</label>
          <select id="a-tipo" class="form-select" [(ngModel)]="filtroTipo">
            <option [ngValue]="''">Todos</option>
            @for (t of tiposAudiencia(); track t) {
              <option [ngValue]="t">{{ t }}</option>
            }
          </select>
        </div>
        <div>
          <label class="form-label" for="a-tribunal">Tribunal</label>
          <input id="a-tribunal" type="text" class="form-input" [(ngModel)]="filtroTribunal"
                 placeholder="Coincidencia parcial" (keyup.enter)="aplicarDesdeCampo()" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label" for="a-desde">Desde</label>
            <input id="a-desde" type="date" class="form-input" [(ngModel)]="filtroDesde" />
          </div>
          <div>
            <label class="form-label" for="a-hasta">Hasta</label>
            <input id="a-hasta" type="date" class="form-input" [(ngModel)]="filtroHasta" />
          </div>
        </div>
      </app-filtros-panel>

      <!-- Listado agrupado por d\xEDa -->
      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      } @else if (grupos().length === 0) {
        <div class="card">
          <div class="py-16 text-center text-neutral-400">
            @if (incluirPasadas()) {
              No se encontraron audiencias con esos filtros
            } @else {
              No hay audiencias pr\xF3ximas. Si esperaba alguna, revise que el archivo
              de audiencias se haya importado.
            }
          </div>
        </div>
      } @else {
        <div class="space-y-5">
          @for (g of grupos(); track g.fecha) {
            <div class="card">
              <div class="flex items-center gap-3 px-6 py-3 border-b border-neutral-200 bg-neutral-50">
                <span class="font-semibold text-neutral-800">{{ g.etiqueta }}</span>
                @if (g.esHoy) {
                  <span class="badge-info">Hoy</span>
                }
                <span class="text-sm text-neutral-500 ml-auto">
                  {{ g.audiencias.length }} {{ g.audiencias.length === 1 ? 'audiencia' : 'audiencias' }}
                </span>
              </div>

              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th class="w-8"></th>
                      <th class="w-20">Hora</th>
                      @if (materiaActiva() === null) {
                        <th>Materia</th>
                      }
                      <th>Tipo de audiencia</th>
                      <th>Car\xE1tula</th>
                      <th>RIT / RUC</th>
                      <th>Tribunal</th>
                      <th>Sala</th>
                      <th class="w-10" title="Publicada en Google Calendar">GCal</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (a of g.audiencias; track a.id) {
                      <tr class="cursor-pointer" (click)="alternarDetalle(a.id)">
                        <td class="text-neutral-400">
                          <svg class="w-4 h-4 transition-transform" [class.rotate-90]="detalleAbiertoId() === a.id"
                               fill="none" stroke="currentColor" viewBox="0 0 24 24"
                               [attr.aria-label]="detalleAbiertoId() === a.id ? 'Ocultar detalle' : 'Ver detalle'">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td class="font-semibold tabular-nums">{{ fmtHora(a.hora) }}</td>
                        @if (materiaActiva() === null) {
                          <td>
                            @if (a.materia) {
                              <span class="badge-neutral">{{ a.materia }}</span>
                            } @else { - }
                          </td>
                        }
                        <td class="max-w-[220px] truncate" [title]="a.tipo_audiencia || ''">
                          {{ a.tipo_audiencia || '-' }}
                        </td>
                        <td class="max-w-[240px] truncate" [title]="a.caratulado || ''">{{ a.caratulado || '-' }}</td>
                        <td class="whitespace-nowrap">{{ a.rol || a.ruc || '-' }}</td>
                        <td class="max-w-[220px] truncate" [title]="a.tribunal || ''">{{ a.tribunal || '-' }}</td>
                        <td class="whitespace-nowrap">{{ a.sala || '-' }}</td>
                        <td class="text-center">
                          @if (a.en_google_calendar) {
                            <span class="text-accent-600" title="Publicada en Google Calendar">&#10003;</span>
                          } @else {
                            <span class="text-neutral-300"
                                  [title]="a.google_sync_error || 'Todav\xEDa no publicada en Google Calendar'">&ndash;</span>
                          }
                        </td>
                      </tr>

                      <!-- Detalle expandible: solo los campos con dato. Es la forma
                           de mostrar juez, estado y procedencia sin dejar columnas
                           vac\xEDas en la tabla. -->
                      @if (detalleAbiertoId() === a.id) {
                        <tr class="bg-neutral-50">
                          <td [attr.colspan]="colspan()" class="whitespace-normal">
                            <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
                              @for (d of detalle(a); track d.etiqueta) {
                                <div>
                                  <dt class="text-xs text-neutral-500 uppercase tracking-wide">{{ d.etiqueta }}</dt>
                                  <dd class="text-sm text-neutral-800 mt-0.5 break-words">{{ d.valor }}</dd>
                                </div>
                              } @empty {
                                <div class="text-sm text-neutral-400">Sin datos adicionales para esta audiencia</div>
                              }
                            </dl>
                            @if (a.google_sync_error) {
                              <p class="text-xs text-danger-600 pb-2">
                                Google Calendar: {{ a.google_sync_error }}
                              </p>
                            }
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>

        <!-- Paginaci\xF3n -->
        @if (totalPages() > 1) {
          <div class="card flex items-center justify-between px-6 py-4">
            <span class="text-sm text-neutral-500">
              P\xE1gina {{ currentPage() }} de {{ totalPages() }} ({{ total() }} audiencias)
            </span>
            <div class="flex gap-2">
              <button (click)="irAPagina(currentPage() - 1)" [disabled]="currentPage() <= 1"
                      class="btn-secondary btn-sm">Anterior</button>
              <button (click)="irAPagina(currentPage() + 1)" [disabled]="currentPage() >= totalPages()"
                      class="btn-secondary btn-sm">Siguiente</button>
            </div>
          </div>
        }
      }
    </div>
  `
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(AudienciasComponent, { className: "AudienciasComponent", filePath: "src/app/features/audiencias/audiencias.component.ts", lineNumber: 298 });
})();
export {
  AudienciasComponent
};
//# sourceMappingURL=chunk-2FHBN76X.js.map
