import {
  RecordatorioModalComponent
} from "./chunk-WXMCI2HJ.js";
import {
  EstadoDiarioService
} from "./chunk-FLTDD2QG.js";
import {
  FiltrosPanelComponent
} from "./chunk-KKQNT7IP.js";
import {
  NotificationService
} from "./chunk-ZKUWYJUU.js";
import "./chunk-M4LO6B3L.js";
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
  Router,
  RouterLink
} from "./chunk-O3CMZLWV.js";
import {
  CommonModule,
  Component,
  computed,
  forkJoin,
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
  ɵɵpureFunction1,
  ɵɵqueryAdvance,
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
  ɵɵtwoWayProperty,
  ɵɵviewQuerySignal
} from "./chunk-WMIGZGXS.js";
import {
  __spreadProps,
  __spreadValues
} from "./chunk-XWLXMCJQ.js";

// src/app/features/estado-diario/components/movimientos-list/movimientos-list.component.ts
var _c0 = (a0) => ["/estado-diario", a0];
var _forTrack0 = ($index, $item) => $item.key;
var _forTrack1 = ($index, $item) => $item.id;
function MovimientosListComponent_Conditional_7_For_3_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 22);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const t_r3 = \u0275\u0275nextContext().$implicit;
    const ctx_r3 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r3.counts()[t_r3.key]);
  }
}
function MovimientosListComponent_Conditional_7_For_3_Template(rf, ctx) {
  if (rf & 1) {
    const _r2 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 21);
    \u0275\u0275listener("click", function MovimientosListComponent_Conditional_7_For_3_Template_button_click_0_listener() {
      const t_r3 = \u0275\u0275restoreView(_r2).$implicit;
      const ctx_r3 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r3.selectTab(t_r3.key));
    });
    \u0275\u0275text(1);
    \u0275\u0275template(2, MovimientosListComponent_Conditional_7_For_3_Conditional_2_Template, 2, 1, "span", 22);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const t_r3 = ctx.$implicit;
    const ctx_r3 = \u0275\u0275nextContext(2);
    \u0275\u0275classProp("tab-link-activo", ctx_r3.activeTab() === t_r3.key);
    \u0275\u0275attribute("aria-selected", ctx_r3.activeTab() === t_r3.key);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", t_r3.label, " ");
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r3.counts()[t_r3.key] !== null ? 2 : -1);
  }
}
function MovimientosListComponent_Conditional_7_For_12_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "option", 14);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const j_r5 = ctx.$implicit;
    \u0275\u0275property("ngValue", j_r5.id);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(j_r5.nombre);
  }
}
function MovimientosListComponent_Conditional_7_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 8)(1, "nav", 9);
    \u0275\u0275repeaterCreate(2, MovimientosListComponent_Conditional_7_For_3_Template, 3, 5, "button", 10, _forTrack0);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(4, "app-filtros-panel", 11);
    \u0275\u0275listener("aplicar", function MovimientosListComponent_Conditional_7_Template_app_filtros_panel_aplicar_4_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r3 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r3.onFilter());
    })("limpiar", function MovimientosListComponent_Conditional_7_Template_app_filtros_panel_limpiar_4_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r3 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r3.onClearFilters());
    })("quitar", function MovimientosListComponent_Conditional_7_Template_app_filtros_panel_quitar_4_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r3 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r3.quitarFiltro($event));
    });
    \u0275\u0275elementStart(5, "div")(6, "label", 12);
    \u0275\u0275text(7, "Jurisdicci\xF3n");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "select", 13);
    \u0275\u0275twoWayListener("ngModelChange", function MovimientosListComponent_Conditional_7_Template_select_ngModelChange_8_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r3 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r3.filterJurisdiccion, $event) || (ctx_r3.filterJurisdiccion = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementStart(9, "option", 14);
    \u0275\u0275text(10, "Todas");
    \u0275\u0275elementEnd();
    \u0275\u0275repeaterCreate(11, MovimientosListComponent_Conditional_7_For_12_Template, 2, 2, "option", 14, _forTrack1);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(13, "div")(14, "label", 15);
    \u0275\u0275text(15, "Fecha desde");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(16, "input", 16);
    \u0275\u0275twoWayListener("ngModelChange", function MovimientosListComponent_Conditional_7_Template_input_ngModelChange_16_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r3 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r3.filterFechaDesde, $event) || (ctx_r3.filterFechaDesde = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(17, "div")(18, "label", 17);
    \u0275\u0275text(19, "Fecha hasta");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(20, "input", 18);
    \u0275\u0275twoWayListener("ngModelChange", function MovimientosListComponent_Conditional_7_Template_input_ngModelChange_20_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r3 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r3.filterFechaHasta, $event) || (ctx_r3.filterFechaHasta = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(21, "div")(22, "label", 19);
    \u0275\u0275text(23, "RUT");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(24, "input", 20);
    \u0275\u0275twoWayListener("ngModelChange", function MovimientosListComponent_Conditional_7_Template_input_ngModelChange_24_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r3 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r3.filterRut, $event) || (ctx_r3.filterRut = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275listener("keyup.enter", function MovimientosListComponent_Conditional_7_Template_input_keyup_enter_24_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r3 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r3.aplicarDesdeCampo());
    });
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r3.tabs);
    \u0275\u0275advance(2);
    \u0275\u0275property("chips", ctx_r3.chipsFiltros());
    \u0275\u0275advance(4);
    \u0275\u0275twoWayProperty("ngModel", ctx_r3.filterJurisdiccion);
    \u0275\u0275advance();
    \u0275\u0275property("ngValue", null);
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r3.jurisdicciones());
    \u0275\u0275advance(5);
    \u0275\u0275twoWayProperty("ngModel", ctx_r3.filterFechaDesde);
    \u0275\u0275advance(4);
    \u0275\u0275twoWayProperty("ngModel", ctx_r3.filterFechaHasta);
    \u0275\u0275advance(4);
    \u0275\u0275twoWayProperty("ngModel", ctx_r3.filterRut);
  }
}
function MovimientosListComponent_Conditional_8_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 4);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(1, "svg", 23);
    \u0275\u0275element(2, "circle", 24)(3, "path", 25);
    \u0275\u0275elementEnd()();
  }
}
function MovimientosListComponent_Conditional_9_For_23_Conditional_16_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 33);
    \u0275\u0275text(1, "Resuelto");
    \u0275\u0275elementEnd();
  }
}
function MovimientosListComponent_Conditional_9_For_23_Conditional_17_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span");
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const m_r6 = \u0275\u0275nextContext().$implicit;
    const ctx_r3 = \u0275\u0275nextContext(2);
    \u0275\u0275classMap(ctx_r3.claseNivel(m_r6.nivel_pendiente));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1("Pendiente - ", m_r6.nivel_pendiente, "");
  }
}
function MovimientosListComponent_Conditional_9_For_23_Conditional_18_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 35);
    \u0275\u0275text(1, "No le\xEDdo");
    \u0275\u0275elementEnd();
  }
}
function MovimientosListComponent_Conditional_9_For_23_Conditional_21_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    const _r8 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 41);
    \u0275\u0275listener("click", function MovimientosListComponent_Conditional_9_For_23_Conditional_21_Conditional_3_Template_div_click_0_listener() {
      \u0275\u0275restoreView(_r8);
      const ctx_r3 = \u0275\u0275nextContext(4);
      return \u0275\u0275resetView(ctx_r3.cerrarMenu());
    });
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(1, "div", 42)(2, "button", 43);
    \u0275\u0275listener("click", function MovimientosListComponent_Conditional_9_For_23_Conditional_21_Conditional_3_Template_button_click_2_listener() {
      \u0275\u0275restoreView(_r8);
      const m_r6 = \u0275\u0275nextContext(2).$implicit;
      const ctx_r3 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r3.onResolver(m_r6.id));
    });
    \u0275\u0275text(3, " Resuelto ");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(4, "button", 43);
    \u0275\u0275listener("click", function MovimientosListComponent_Conditional_9_For_23_Conditional_21_Conditional_3_Template_button_click_4_listener() {
      \u0275\u0275restoreView(_r8);
      const m_r6 = \u0275\u0275nextContext(2).$implicit;
      const ctx_r3 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r3.onPendiente(m_r6.id));
    });
    \u0275\u0275text(5, " Pendiente ");
    \u0275\u0275elementEnd()();
  }
}
function MovimientosListComponent_Conditional_9_For_23_Conditional_21_Template(rf, ctx) {
  if (rf & 1) {
    const _r7 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 38);
    \u0275\u0275listener("click", function MovimientosListComponent_Conditional_9_For_23_Conditional_21_Template_button_click_0_listener($event) {
      \u0275\u0275restoreView(_r7);
      const m_r6 = \u0275\u0275nextContext().$implicit;
      const ctx_r3 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r3.toggleMenu(m_r6.id, $event));
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(1, "svg", 39);
    \u0275\u0275element(2, "path", 40);
    \u0275\u0275elementEnd()();
    \u0275\u0275template(3, MovimientosListComponent_Conditional_9_For_23_Conditional_21_Conditional_3_Template, 6, 0);
  }
  if (rf & 2) {
    const m_r6 = \u0275\u0275nextContext().$implicit;
    const ctx_r3 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(3);
    \u0275\u0275conditional(ctx_r3.menuAbiertoId() === m_r6.id ? 3 : -1);
  }
}
function MovimientosListComponent_Conditional_9_For_23_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "tr")(1, "td", 29)(2, "a", 30);
    \u0275\u0275text(3);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(4, "td");
    \u0275\u0275text(5);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "td", 31);
    \u0275\u0275text(7);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "td", 32)(9, "a", 30);
    \u0275\u0275text(10);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(11, "td");
    \u0275\u0275text(12);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(13, "td");
    \u0275\u0275text(14);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(15, "td");
    \u0275\u0275template(16, MovimientosListComponent_Conditional_9_For_23_Conditional_16_Template, 2, 0, "span", 33)(17, MovimientosListComponent_Conditional_9_For_23_Conditional_17_Template, 2, 3, "span", 34)(18, MovimientosListComponent_Conditional_9_For_23_Conditional_18_Template, 2, 0, "span", 35);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(19, "td", 36)(20, "div", 37);
    \u0275\u0275template(21, MovimientosListComponent_Conditional_9_For_23_Conditional_21_Template, 4, 1);
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const m_r6 = ctx.$implicit;
    \u0275\u0275advance(2);
    \u0275\u0275property("routerLink", \u0275\u0275pureFunction1(11, _c0, m_r6.id));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", m_r6.rol || "-", " ");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(m_r6.rol_unico || "-");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(m_r6.fecha_ingreso || "-");
    \u0275\u0275advance();
    \u0275\u0275property("title", m_r6.caratulado || "");
    \u0275\u0275advance();
    \u0275\u0275property("routerLink", \u0275\u0275pureFunction1(13, _c0, m_r6.id));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", m_r6.caratulado || "-", " ");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(m_r6.tribunal || "-");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(m_r6.tipo_causa || "-");
    \u0275\u0275advance(2);
    \u0275\u0275conditional(m_r6.leido ? 16 : m_r6.pendiente ? 17 : 18);
    \u0275\u0275advance(5);
    \u0275\u0275conditional(!m_r6.leido ? 21 : -1);
  }
}
function MovimientosListComponent_Conditional_9_ForEmpty_24_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "tr")(1, "td", 44);
    \u0275\u0275text(2, " No se encontraron registros del estado diario ");
    \u0275\u0275elementEnd()();
  }
}
function MovimientosListComponent_Conditional_9_Conditional_25_Template(rf, ctx) {
  if (rf & 1) {
    const _r9 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 28)(1, "span", 45);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "div", 46)(4, "button", 47);
    \u0275\u0275listener("click", function MovimientosListComponent_Conditional_9_Conditional_25_Template_button_click_4_listener() {
      \u0275\u0275restoreView(_r9);
      const ctx_r3 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r3.goToPage(ctx_r3.currentPage() - 1));
    });
    \u0275\u0275text(5, "Anterior");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "button", 47);
    \u0275\u0275listener("click", function MovimientosListComponent_Conditional_9_Conditional_25_Template_button_click_6_listener() {
      \u0275\u0275restoreView(_r9);
      const ctx_r3 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r3.goToPage(ctx_r3.currentPage() + 1));
    });
    \u0275\u0275text(7, "Siguiente");
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r3 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate3(" P\xE1gina ", ctx_r3.currentPage(), " de ", ctx_r3.totalPages(), " (", ctx_r3.total(), " registros) ");
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r3.currentPage() <= 1);
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r3.currentPage() >= ctx_r3.totalPages());
  }
}
function MovimientosListComponent_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 5)(1, "div", 26)(2, "table", 27)(3, "thead")(4, "tr")(5, "th");
    \u0275\u0275text(6, "Rit/Rol");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(7, "th");
    \u0275\u0275text(8, "Ruc/RolUnico");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(9, "th");
    \u0275\u0275text(10, "FechaIngreso");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(11, "th");
    \u0275\u0275text(12, "Caratulado");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(13, "th");
    \u0275\u0275text(14, "Tribunal");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(15, "th");
    \u0275\u0275text(16, "TipoCausa");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(17, "th");
    \u0275\u0275text(18, "Estado");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(19, "th");
    \u0275\u0275text(20, "Acciones");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(21, "tbody");
    \u0275\u0275repeaterCreate(22, MovimientosListComponent_Conditional_9_For_23_Template, 22, 15, "tr", null, _forTrack1, false, MovimientosListComponent_Conditional_9_ForEmpty_24_Template, 3, 0, "tr");
    \u0275\u0275elementEnd()()();
    \u0275\u0275template(25, MovimientosListComponent_Conditional_9_Conditional_25_Template, 8, 5, "div", 28);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance(22);
    \u0275\u0275repeater(ctx_r3.movimientos());
    \u0275\u0275advance(3);
    \u0275\u0275conditional(ctx_r3.totalPages() > 1 ? 25 : -1);
  }
}
function MovimientosListComponent_Conditional_11_Template(rf, ctx) {
  if (rf & 1) {
    const _r10 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 48);
    \u0275\u0275listener("click", function MovimientosListComponent_Conditional_11_Template_div_click_0_listener() {
      \u0275\u0275restoreView(_r10);
      const ctx_r3 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r3.cancelarResolver());
    });
    \u0275\u0275elementStart(1, "div", 49);
    \u0275\u0275listener("click", function MovimientosListComponent_Conditional_11_Template_div_click_1_listener($event) {
      \u0275\u0275restoreView(_r10);
      return \u0275\u0275resetView($event.stopPropagation());
    });
    \u0275\u0275elementStart(2, "div", 50)(3, "h3", 51);
    \u0275\u0275text(4, "Marcar como resuelto");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "button", 52);
    \u0275\u0275listener("click", function MovimientosListComponent_Conditional_11_Template_button_click_5_listener() {
      \u0275\u0275restoreView(_r10);
      const ctx_r3 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r3.cancelarResolver());
    });
    \u0275\u0275text(6, "\xD7");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(7, "div", 53)(8, "div", 54)(9, "div", 55);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(10, "svg", 56);
    \u0275\u0275element(11, "path", 57);
    \u0275\u0275elementEnd()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(12, "p", 58);
    \u0275\u0275text(13, " \xBFConfirma que quiere marcar este registro como ");
    \u0275\u0275elementStart(14, "strong");
    \u0275\u0275text(15, "resuelto");
    \u0275\u0275elementEnd();
    \u0275\u0275text(16, "? ");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(17, "div")(18, "label", 59);
    \u0275\u0275text(19, "Observaci\xF3n (opcional)");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(20, "textarea", 60);
    \u0275\u0275twoWayListener("ngModelChange", function MovimientosListComponent_Conditional_11_Template_textarea_ngModelChange_20_listener($event) {
      \u0275\u0275restoreView(_r10);
      const ctx_r3 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r3.observacionResuelto, $event) || (ctx_r3.observacionResuelto = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(21, "p", 61);
    \u0275\u0275text(22, "Queda registrada junto con la resoluci\xF3n.");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(23, "div", 62)(24, "button", 63);
    \u0275\u0275listener("click", function MovimientosListComponent_Conditional_11_Template_button_click_24_listener() {
      \u0275\u0275restoreView(_r10);
      const ctx_r3 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r3.cancelarResolver());
    });
    \u0275\u0275text(25, "Cancelar");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(26, "button", 64);
    \u0275\u0275listener("click", function MovimientosListComponent_Conditional_11_Template_button_click_26_listener() {
      \u0275\u0275restoreView(_r10);
      const ctx_r3 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r3.confirmarResolver());
    });
    \u0275\u0275text(27);
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance(20);
    \u0275\u0275twoWayProperty("ngModel", ctx_r3.observacionResuelto);
    \u0275\u0275advance(4);
    \u0275\u0275property("disabled", ctx_r3.confirmandoResolver());
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r3.confirmandoResolver());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r3.confirmandoResolver() ? "Guardando..." : "S\xED, marcar resuelto", " ");
  }
}
function fmtFechaChip(iso) {
  const [anio, mes, dia] = iso.split("-");
  return dia && mes && anio ? `${dia}-${mes}-${anio}` : iso;
}
var MovimientosListComponent = class _MovimientosListComponent {
  service = inject(EstadoDiarioService);
  notification = inject(NotificationService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  tabs = [
    { key: "no-leidos", label: "No Le\xEDdos" },
    { key: "leidos", label: "Resueltos" },
    { key: "pendientes", label: "Pendientes" }
  ];
  movimientos = signal([]);
  jurisdicciones = signal([]);
  loading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);
  counts = signal({ "no-leidos": null, leidos: null, pendientes: null });
  isOrigen = signal(false);
  activeTab = signal("no-leidos");
  filterJurisdiccion = null;
  filterFechaDesde = "";
  filterFechaHasta = "";
  filterRut = "";
  /** Filtros ya aplicados, los que se ven como badges. */
  chipsFiltros = signal([]);
  panel = viewChild(FiltrosPanelComponent);
  menuAbiertoId = signal(null);
  /**
   * Id del registro para el que está abierto el modal de recordatorio; null = cerrado.
   * Marcar "Pendiente" y agendar son una sola acción: el modal registra el
   * recordatorio y deja el registro en estado pendiente con el nivel elegido ahí.
   */
  recordatorioMovimientoId = signal(null);
  confirmarResolverId = signal(null);
  confirmandoResolver = signal(false);
  /** Comentario opcional que acompaña al "resuelto"; se limpia en cada apertura del modal. */
  observacionResuelto = "";
  title = computed(() => this.isOrigen() ? "Estado Diario del Archivo" : "Estado Diario");
  claseNivel(nivel) {
    if (nivel === "alto")
      return "badge-danger";
    if (nivel === "medio")
      return "badge-yellow";
    return "badge-orange";
  }
  ngOnInit() {
    const filter = this.route.snapshot.data["filter"] || "movimientos";
    this.isOrigen.set(filter === "origen");
    if (this.isOrigen()) {
      this.loadData();
      return;
    }
    const queryTab = this.route.snapshot.queryParamMap.get("tab");
    this.activeTab.set(this.normalizeTab(queryTab) ?? this.normalizeTab(filter) ?? "no-leidos");
    this.service.getJurisdicciones(true).subscribe({
      next: (res) => this.jurisdicciones.set(res.jurisdicciones)
    });
    this.loadData();
    this.loadCounts();
  }
  normalizeTab(value) {
    return this.tabs.some((t) => t.key === value) ? value : null;
  }
  selectTab(tab) {
    if (this.activeTab() === tab)
      return;
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: "merge",
      replaceUrl: true
    });
    this.loadData();
  }
  loadData() {
    this.loading.set(true);
    this.cerrarMenu();
    if (this.isOrigen()) {
      const origenId = Number(this.route.snapshot.paramMap.get("id"));
      this.service.getMovimientosByOrigen(origenId).subscribe({
        next: (res) => {
          this.movimientos.set(res.movimientos);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notification.error("Error al cargar el estado diario");
        }
      });
    } else {
      this.service.getMovimientos(this.activeTab(), this.buildParams()).subscribe({
        next: (res) => {
          this.movimientos.set(res.movimientos);
          this.total.set(res.total);
          this.currentPage.set(res.page);
          this.totalPages.set(res.total_pages);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notification.error("Error al cargar el estado diario");
        }
      });
    }
  }
  buildParams() {
    const params = { page: this.currentPage(), limit: 20 };
    if (this.filterJurisdiccion)
      params.jurisdiccion = this.filterJurisdiccion;
    if (this.filterFechaDesde)
      params.fecha_desde = this.filterFechaDesde;
    if (this.filterFechaHasta)
      params.fecha_hasta = this.filterFechaHasta;
    if (this.filterRut)
      params.rut = this.filterRut;
    return params;
  }
  /** Totales por estado para los contadores de las pestañas (respetan los filtros activos). */
  loadCounts() {
    const params = __spreadProps(__spreadValues({}, this.buildParams()), { page: 1, limit: 1 });
    forkJoin({
      "no-leidos": this.service.getMovimientos("no-leidos", params),
      leidos: this.service.getMovimientos("leidos", params),
      pendientes: this.service.getMovimientos("pendientes", params)
    }).subscribe({
      next: (res) => this.counts.set({
        "no-leidos": res["no-leidos"].total,
        leidos: res.leidos.total,
        pendientes: res.pendientes.total
      }),
      error: () => this.counts.set({ "no-leidos": null, leidos: null, pendientes: null })
    });
  }
  onFilter() {
    this.currentPage.set(1);
    this.sincronizarChips();
    this.loadData();
    this.loadCounts();
  }
  /** Enter dentro de un campo del panel: aplica sin obligar a ir al botón. */
  aplicarDesdeCampo() {
    this.panel()?.cerrar();
    this.onFilter();
  }
  onClearFilters() {
    this.filterJurisdiccion = null;
    this.filterFechaDesde = "";
    this.filterFechaHasta = "";
    this.filterRut = "";
    this.onFilter();
  }
  /** Quita un solo filtro desde su badge y vuelve a consultar. */
  quitarFiltro(clave) {
    switch (clave) {
      case "jurisdiccion":
        this.filterJurisdiccion = null;
        break;
      case "fecha_desde":
        this.filterFechaDesde = "";
        break;
      case "fecha_hasta":
        this.filterFechaHasta = "";
        break;
      case "rut":
        this.filterRut = "";
        break;
    }
    this.onFilter();
  }
  /**
   * Los badges muestran lo que está APLICADO, no lo que hay escrito en el
   * panel: si el usuario abre, escribe y cierra sin aplicar, la barra no debe
   * mentir sobre qué se está consultando. Por eso se recalculan acá y no en un
   * computed sobre los campos.
   */
  sincronizarChips() {
    const chips = [];
    if (this.filterJurisdiccion) {
      const j = this.jurisdicciones().find((x) => x.id === this.filterJurisdiccion);
      chips.push({
        clave: "jurisdiccion",
        etiqueta: "Jurisdicci\xF3n",
        valor: j?.nombre ?? String(this.filterJurisdiccion)
      });
    }
    if (this.filterFechaDesde) {
      chips.push({ clave: "fecha_desde", etiqueta: "Desde", valor: fmtFechaChip(this.filterFechaDesde) });
    }
    if (this.filterFechaHasta) {
      chips.push({ clave: "fecha_hasta", etiqueta: "Hasta", valor: fmtFechaChip(this.filterFechaHasta) });
    }
    if (this.filterRut) {
      chips.push({ clave: "rut", etiqueta: "RUT", valor: this.filterRut });
    }
    this.chipsFiltros.set(chips);
  }
  goToPage(page) {
    this.currentPage.set(page);
    this.loadData();
  }
  toggleMenu(id, event) {
    event.stopPropagation();
    this.menuAbiertoId.set(this.menuAbiertoId() === id ? null : id);
  }
  cerrarMenu() {
    this.menuAbiertoId.set(null);
  }
  onResolver(id) {
    this.cerrarMenu();
    this.observacionResuelto = "";
    this.confirmarResolverId.set(id);
  }
  cancelarResolver() {
    if (this.confirmandoResolver())
      return;
    this.observacionResuelto = "";
    this.confirmarResolverId.set(null);
  }
  confirmarResolver() {
    const id = this.confirmarResolverId();
    if (id === null)
      return;
    this.confirmandoResolver.set(true);
    this.service.marcarLeido(id, this.observacionResuelto).subscribe({
      next: () => {
        this.confirmandoResolver.set(false);
        this.confirmarResolverId.set(null);
        this.observacionResuelto = "";
        this.notification.success("Marcado como resuelto");
        this.loadData();
        if (!this.isOrigen())
          this.loadCounts();
      },
      error: () => {
        this.confirmandoResolver.set(false);
        this.notification.error("Error al marcar como resuelto");
      }
    });
  }
  /**
   * "Pendiente" abre el modal de recordatorio: ahí se elige el nivel de urgencia
   * (bajo/medio/alto), que es el que queda guardado tanto en el registro como en
   * el recordatorio. No se pregunta el nivel dos veces.
   */
  onPendiente(id) {
    this.cerrarMenu();
    this.recordatorioMovimientoId.set(id);
  }
  onRecordatorioGuardado() {
    this.recordatorioMovimientoId.set(null);
    this.loadData();
    this.loadCounts();
  }
  static \u0275fac = function MovimientosListComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _MovimientosListComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _MovimientosListComponent, selectors: [["app-movimientos-list"]], viewQuery: function MovimientosListComponent_Query(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275viewQuerySignal(ctx.panel, FiltrosPanelComponent, 5);
    }
    if (rf & 2) {
      \u0275\u0275queryAdvance();
    }
  }, decls: 12, vars: 6, consts: [[1, "space-y-6"], [1, "flex", "items-center", "justify-between", "flex-wrap", "gap-4"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], [1, "flex", "items-center", "justify-center", "py-20"], [1, "card"], [3, "cerrado", "guardado", "movimientoId"], [1, "modal-backdrop"], [1, "border-b", "border-neutral-200"], ["role", "tablist", 1, "tabs-nav"], ["type", "button", "role", "tab", 1, "tab-link", 3, "tab-link-activo"], [3, "aplicar", "limpiar", "quitar", "chips"], ["for", "f-jurisdiccion", 1, "form-label"], ["id", "f-jurisdiccion", 1, "form-select", 3, "ngModelChange", "ngModel"], [3, "ngValue"], ["for", "f-desde", 1, "form-label"], ["id", "f-desde", "type", "date", 1, "form-input", 3, "ngModelChange", "ngModel"], ["for", "f-hasta", 1, "form-label"], ["id", "f-hasta", "type", "date", 1, "form-input", 3, "ngModelChange", "ngModel"], ["for", "f-rut", 1, "form-label"], ["id", "f-rut", "type", "text", "placeholder", "Ej: 16952077-1", 1, "form-input", 3, "ngModelChange", "keyup.enter", "ngModel"], ["type", "button", "role", "tab", 1, "tab-link", 3, "click"], [1, "tab-contador"], ["viewBox", "0 0 24 24", 1, "animate-spin", "h-10", "w-10", "text-primary-600"], ["cx", "12", "cy", "12", "r", "10", "stroke", "currentColor", "stroke-width", "4", "fill", "none", 1, "opacity-25"], ["fill", "currentColor", "d", "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z", 1, "opacity-75"], [1, "table-wrapper"], [1, "data-table"], [1, "flex", "items-center", "justify-between", "px-6", "py-4", "border-t", "border-neutral-200"], [1, "font-medium"], [1, "hover:text-primary-600", "hover:underline", 3, "routerLink"], [1, "whitespace-nowrap"], [1, "max-w-[200px]", "truncate", 3, "title"], [1, "badge-success"], [3, "class"], [1, "badge-neutral"], [1, "relative"], [1, "inline-flex", "items-center", "gap-1", "align-middle"], ["title", "Acciones", 1, "btn-outline", "btn-sm", 3, "click"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-4", "h-4"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M19 9l-7 7-7-7"], [1, "fixed", "inset-0", "z-10", 3, "click"], [1, "absolute", "right-0", "z-20", "mt-1", "w-40", "rounded-lg", "border", "border-neutral-200", "bg-white", "shadow-lg", "py-1"], [1, "block", "w-full", "text-left", "px-3", "py-2", "text-sm", "text-neutral-700", "hover:bg-neutral-50", 3, "click"], ["colspan", "9", 1, "text-center", "py-10", "text-neutral-400"], [1, "text-sm", "text-neutral-500"], [1, "flex", "gap-2"], [1, "btn-secondary", "btn-sm", 3, "click", "disabled"], [1, "modal-backdrop", 3, "click"], [1, "modal-content", "max-w-sm", 3, "click"], [1, "modal-header"], [1, "text-lg", "font-semibold"], [1, "text-neutral-400", "hover:text-neutral-600", 3, "click"], [1, "modal-body", "space-y-4"], [1, "flex", "items-start", "gap-3"], [1, "shrink-0", "w-10", "h-10", "rounded-full", "bg-accent-100", "flex", "items-center", "justify-center"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-5", "h-5", "text-accent-600"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"], [1, "text-sm", "text-neutral-600", "mt-2"], [1, "form-label"], ["rows", "3", "placeholder", "Ej: se present\xF3 escrito el 12-08-2026", 1, "form-input", 3, "ngModelChange", "ngModel"], [1, "text-xs", "text-neutral-400", "mt-1"], [1, "modal-footer"], [1, "btn-secondary", 3, "click", "disabled"], [1, "btn-success", 3, "click", "disabled"]], template: function MovimientosListComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div", 1)(2, "div")(3, "h1", 2);
      \u0275\u0275text(4);
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(5, "p", 3);
      \u0275\u0275text(6);
      \u0275\u0275elementEnd()()();
      \u0275\u0275template(7, MovimientosListComponent_Conditional_7_Template, 25, 6)(8, MovimientosListComponent_Conditional_8_Template, 4, 0, "div", 4)(9, MovimientosListComponent_Conditional_9_Template, 26, 2, "div", 5);
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(10, "app-recordatorio-modal", 6);
      \u0275\u0275listener("cerrado", function MovimientosListComponent_Template_app_recordatorio_modal_cerrado_10_listener() {
        return ctx.recordatorioMovimientoId.set(null);
      })("guardado", function MovimientosListComponent_Template_app_recordatorio_modal_guardado_10_listener() {
        return ctx.onRecordatorioGuardado();
      });
      \u0275\u0275elementEnd();
      \u0275\u0275template(11, MovimientosListComponent_Conditional_11_Template, 28, 4, "div", 7);
    }
    if (rf & 2) {
      \u0275\u0275advance(4);
      \u0275\u0275textInterpolate(ctx.title());
      \u0275\u0275advance(2);
      \u0275\u0275textInterpolate1("", ctx.total(), " registros encontrados");
      \u0275\u0275advance();
      \u0275\u0275conditional(!ctx.isOrigen() ? 7 : -1);
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.loading() ? 8 : 9);
      \u0275\u0275advance(2);
      \u0275\u0275property("movimientoId", ctx.recordatorioMovimientoId());
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.confirmarResolverId() !== null ? 11 : -1);
    }
  }, dependencies: [
    CommonModule,
    FormsModule,
    NgSelectOption,
    \u0275NgSelectMultipleOption,
    DefaultValueAccessor,
    SelectControlValueAccessor,
    NgControlStatus,
    NgModel,
    RouterLink,
    RecordatorioModalComponent,
    FiltrosPanelComponent
  ], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MovimientosListComponent, [{
    type: Component,
    args: [{
      selector: "app-movimientos-list",
      standalone: true,
      imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        RecordatorioModalComponent,
        FiltrosPanelComponent
      ],
      template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">{{ title() }}</h1>
          <p class="text-neutral-500 mt-1">{{ total() }} registros encontrados</p>
        </div>
      </div>

      @if (!isOrigen()) {
        <!-- Tabs de estado -->
        <div class="border-b border-neutral-200">
          <nav class="tabs-nav" role="tablist">
            @for (t of tabs; track t.key) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="activeTab() === t.key"
                (click)="selectTab(t.key)"
                class="tab-link"
                [class.tab-link-activo]="activeTab() === t.key"
              >
                {{ t.label }}
                @if (counts()[t.key] !== null) {
                  <span class="tab-contador">{{ counts()[t.key] }}</span>
                }
              </button>
            }
          </nav>
        </div>

        <!-- Filtros: los campos viven en el panel lateral; ac\xE1 solo quedan los
             badges de lo aplicado y el bot\xF3n que lo abre. -->
        <app-filtros-panel
          [chips]="chipsFiltros()"
          (aplicar)="onFilter()"
          (limpiar)="onClearFilters()"
          (quitar)="quitarFiltro($event)"
        >
          <div>
            <label class="form-label" for="f-jurisdiccion">Jurisdicci\xF3n</label>
            <select id="f-jurisdiccion" class="form-select" [(ngModel)]="filterJurisdiccion">
              <option [ngValue]="null">Todas</option>
              @for (j of jurisdicciones(); track j.id) {
                <option [ngValue]="j.id">{{ j.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="form-label" for="f-desde">Fecha desde</label>
            <input id="f-desde" type="date" class="form-input" [(ngModel)]="filterFechaDesde" />
          </div>
          <div>
            <label class="form-label" for="f-hasta">Fecha hasta</label>
            <input id="f-hasta" type="date" class="form-input" [(ngModel)]="filterFechaHasta" />
          </div>
          <div>
            <label class="form-label" for="f-rut">RUT</label>
            <input id="f-rut" type="text" class="form-input" [(ngModel)]="filterRut"
                   placeholder="Ej: 16952077-1" (keyup.enter)="aplicarDesdeCampo()" />
          </div>
        </app-filtros-panel>
      }

      <!-- Table -->
      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      } @else {
        <div class="card">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Rit/Rol</th>
                  <th>Ruc/RolUnico</th>
                  <th>FechaIngreso</th>
                  <th>Caratulado</th>
                  <th>Tribunal</th>
                  <th>TipoCausa</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (m of movimientos(); track m.id) {
                  <tr>
                    <td class="font-medium">
                      <a [routerLink]="['/estado-diario', m.id]" class="hover:text-primary-600 hover:underline">
                        {{ m.rol || '-' }}
                      </a>
                    </td>
                    <td>{{ m.rol_unico || '-' }}</td>
                    <td class="whitespace-nowrap">{{ m.fecha_ingreso || '-' }}</td>
                    <td class="max-w-[200px] truncate" [title]="m.caratulado || ''">
                      <a [routerLink]="['/estado-diario', m.id]" class="hover:text-primary-600 hover:underline">
                        {{ m.caratulado || '-' }}
                      </a>
                    </td>
                    <td>{{ m.tribunal || '-' }}</td>
                    <td>{{ m.tipo_causa || '-' }}</td>
                    <td>
                      @if (m.leido) {
                        <span class="badge-success">Resuelto</span>
                      } @else if (m.pendiente) {
                        <span [class]="claseNivel(m.nivel_pendiente)">Pendiente - {{ m.nivel_pendiente }}</span>
                      } @else {
                        <span class="badge-neutral">No le\xEDdo</span>
                      }
                    </td>
                    <td class="relative">
                      <div class="inline-flex items-center gap-1 align-middle">
                        @if (!m.leido) {
                          <button (click)="toggleMenu(m.id, $event)" class="btn-outline btn-sm" title="Acciones">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          @if (menuAbiertoId() === m.id) {
                            <!-- Backdrop invisible para cerrar el men\xFA al hacer click afuera -->
                            <div class="fixed inset-0 z-10" (click)="cerrarMenu()"></div>
                            <div class="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-neutral-200 bg-white shadow-lg py-1">
                              <button (click)="onResolver(m.id)"
                                      class="block w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                                Resuelto
                              </button>
                              <!-- "Pendiente" abre el modal de recordatorio: marcar pendiente
                                   y agendar son una sola acci\xF3n. -->
                              <button (click)="onPendiente(m.id)"
                                      class="block w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                                Pendiente
                              </button>
                            </div>
                          }
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="9" class="text-center py-10 text-neutral-400">
                      No se encontraron registros del estado diario
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          @if (totalPages() > 1) {
            <div class="flex items-center justify-between px-6 py-4 border-t border-neutral-200">
              <span class="text-sm text-neutral-500">
                P\xE1gina {{ currentPage() }} de {{ totalPages() }} ({{ total() }} registros)
              </span>
              <div class="flex gap-2">
                <button (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() <= 1"
                        class="btn-secondary btn-sm">Anterior</button>
                <button (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() >= totalPages()"
                        class="btn-secondary btn-sm">Siguiente</button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <app-recordatorio-modal
      [movimientoId]="recordatorioMovimientoId()"
      (cerrado)="recordatorioMovimientoId.set(null)"
      (guardado)="onRecordatorioGuardado()"
    />


    <!-- Confirmar "Resuelto" -->
    @if (confirmarResolverId() !== null) {
      <div class="modal-backdrop" (click)="cancelarResolver()">
        <div class="modal-content max-w-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">Marcar como resuelto</h3>
            <button (click)="cancelarResolver()" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>
          <div class="modal-body space-y-4">
            <div class="flex items-start gap-3">
              <div class="shrink-0 w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p class="text-sm text-neutral-600 mt-2">
                \xBFConfirma que quiere marcar este registro como <strong>resuelto</strong>?
              </p>
            </div>
            <div>
              <label class="form-label">Observaci\xF3n (opcional)</label>
              <textarea class="form-input" rows="3" [(ngModel)]="observacionResuelto"
                        placeholder="Ej: se present\xF3 escrito el 12-08-2026"></textarea>
              <p class="text-xs text-neutral-400 mt-1">Queda registrada junto con la resoluci\xF3n.</p>
            </div>
          </div>
          <div class="modal-footer">
            <button (click)="cancelarResolver()" class="btn-secondary" [disabled]="confirmandoResolver()">Cancelar</button>
            <button (click)="confirmarResolver()" class="btn-success" [disabled]="confirmandoResolver()">
              {{ confirmandoResolver() ? 'Guardando...' : 'S\xED, marcar resuelto' }}
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
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(MovimientosListComponent, { className: "MovimientosListComponent", filePath: "src/app/features/estado-diario/components/movimientos-list/movimientos-list.component.ts", lineNumber: 250 });
})();
export {
  MovimientosListComponent
};
//# sourceMappingURL=chunk-NMWLMP7T.js.map
