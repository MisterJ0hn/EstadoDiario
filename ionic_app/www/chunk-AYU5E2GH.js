import {
  ReporteService,
  descargarBlob,
  mensajeErrorBlob,
  nombreArchivoSeguro
} from "./chunk-2OY4HAWA.js";
import "./chunk-NEYQRVBS.js";
import {
  EstadoDiarioService
} from "./chunk-FLTDD2QG.js";
import {
  MovimientoService
} from "./chunk-MAUBW23E.js";
import "./chunk-GTR5QLCS.js";
import {
  NotificationService
} from "./chunk-ZKUWYJUU.js";
import {
  DefaultValueAccessor,
  FormsModule,
  MaxLengthValidator,
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
  inject,
  setClassMetadata,
  signal,
  switchMap,
  tap,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵclassMap,
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
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵrepeaterTrackByIdentity,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtemplate,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1
} from "./chunk-WMIGZGXS.js";
import "./chunk-XWLXMCJQ.js";

// src/app/features/reportes/reporte-form.component.ts
var _forTrack0 = ($index, $item) => $item.fuente;
var _forTrack1 = ($index, $item) => $item.clave;
var _forTrack2 = ($index, $item) => $item.valor;
var _forTrack3 = ($index, $item) => $item.id;
function ReporteFormComponent_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 5);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(1, "svg", 8);
    \u0275\u0275element(2, "circle", 9)(3, "path", 10);
    \u0275\u0275elementEnd()();
  }
}
function ReporteFormComponent_Conditional_10_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 6)(1, "div", 11)(2, "p", 12);
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(4, "a", 13);
    \u0275\u0275text(5, "Volver a mis informes");
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r0.error());
  }
}
function ReporteFormComponent_Conditional_11_For_23_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 45);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_11_For_23_Template_button_click_0_listener() {
      const f_r4 = \u0275\u0275restoreView(_r3).$implicit;
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.pedirCambioFuente(f_r4.fuente));
    });
    \u0275\u0275elementStart(1, "span", 46);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "span", 47);
    \u0275\u0275text(4);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const f_r4 = ctx.$implicit;
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275classMap(ctx_r0.fuente() === f_r4.fuente ? "border-primary-600 bg-primary-50 ring-2 ring-primary-200" : "border-neutral-200 hover:border-primary-300 hover:bg-neutral-50");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(f_r4.etiqueta);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate1("", f_r4.campos.length, " campos disponibles");
  }
}
function ReporteFormComponent_Conditional_11_For_43_Template(rf, ctx) {
  if (rf & 1) {
    const _r5 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "li", 31)(1, "span", 48);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "button", 49);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_11_For_43_Template_button_click_3_listener() {
      const c_r6 = \u0275\u0275restoreView(_r5).$implicit;
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.agregar(c_r6.clave));
    });
    \u0275\u0275text(4, "Agregar");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const c_r6 = ctx.$implicit;
    \u0275\u0275advance();
    \u0275\u0275property("title", c_r6.etiqueta);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(c_r6.etiqueta);
    \u0275\u0275advance();
    \u0275\u0275property("title", "Agregar " + c_r6.etiqueta);
  }
}
function ReporteFormComponent_Conditional_11_ForEmpty_44_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275text(0, " Ning\xFAn campo coincide con la b\xFAsqueda ");
  }
}
function ReporteFormComponent_Conditional_11_ForEmpty_44_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275text(0, " Ya agreg\xF3 todos los campos de esta fuente ");
  }
}
function ReporteFormComponent_Conditional_11_ForEmpty_44_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "li", 32);
    \u0275\u0275template(1, ReporteFormComponent_Conditional_11_ForEmpty_44_Conditional_1_Template, 1, 0)(2, ReporteFormComponent_Conditional_11_ForEmpty_44_Conditional_2_Template, 1, 0);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.busqueda() ? 1 : 2);
  }
}
function ReporteFormComponent_Conditional_11_For_55_Template(rf, ctx) {
  if (rf & 1) {
    const _r7 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "li", 34)(1, "span", 50);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "span", 51);
    \u0275\u0275text(4);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "button", 52);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_11_For_55_Template_button_click_5_listener() {
      const \u0275$index_145_r8 = \u0275\u0275restoreView(_r7).$index;
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.subir(\u0275$index_145_r8));
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(6, "svg", 53);
    \u0275\u0275element(7, "path", 54);
    \u0275\u0275elementEnd()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(8, "button", 55);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_11_For_55_Template_button_click_8_listener() {
      const \u0275$index_145_r8 = \u0275\u0275restoreView(_r7).$index;
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.bajar(\u0275$index_145_r8));
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(9, "svg", 53);
    \u0275\u0275element(10, "path", 56);
    \u0275\u0275elementEnd()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(11, "button", 57);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_11_For_55_Template_button_click_11_listener() {
      const c_r9 = \u0275\u0275restoreView(_r7).$implicit;
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.quitar(c_r9.clave));
    });
    \u0275\u0275text(12, " \xD7 ");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const c_r9 = ctx.$implicit;
    const \u0275$index_145_r8 = ctx.$index;
    const \u0275$count_145_r10 = ctx.$count;
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(\u0275$index_145_r8 + 1);
    \u0275\u0275advance();
    \u0275\u0275property("title", c_r9.etiqueta);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(c_r9.etiqueta);
    \u0275\u0275advance();
    \u0275\u0275property("disabled", \u0275$index_145_r8 === 0);
    \u0275\u0275advance(3);
    \u0275\u0275property("disabled", \u0275$index_145_r8 === \u0275$count_145_r10 - 1);
  }
}
function ReporteFormComponent_Conditional_11_ForEmpty_56_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "li", 32);
    \u0275\u0275text(1, " No ha elegido ning\xFAn campo. El informe necesita al menos uno. ");
    \u0275\u0275elementEnd();
  }
}
function ReporteFormComponent_Conditional_11_Conditional_64_For_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "option", 60);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const o_r12 = ctx.$implicit;
    \u0275\u0275property("value", o_r12.valor);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(o_r12.etiqueta);
  }
}
function ReporteFormComponent_Conditional_11_Conditional_64_Template(rf, ctx) {
  if (rf & 1) {
    const _r11 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div")(1, "label", 17);
    \u0275\u0275text(2, "Estado");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "select", 58);
    \u0275\u0275listener("ngModelChange", function ReporteFormComponent_Conditional_11_Conditional_64_Template_select_ngModelChange_3_listener($event) {
      \u0275\u0275restoreView(_r11);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.filtroEstado.set($event));
    });
    \u0275\u0275elementStart(4, "option", 59);
    \u0275\u0275text(5, "Todos");
    \u0275\u0275elementEnd();
    \u0275\u0275repeaterCreate(6, ReporteFormComponent_Conditional_11_Conditional_64_For_7_Template, 2, 2, "option", 60, _forTrack2);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(3);
    \u0275\u0275property("ngModel", ctx_r0.filtroEstado());
    \u0275\u0275advance(3);
    \u0275\u0275repeater(ctx_r0.opcionesEstado());
  }
}
function ReporteFormComponent_Conditional_11_Conditional_65_Template(rf, ctx) {
  if (rf & 1) {
    const _r13 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div")(1, "label", 17);
    \u0275\u0275text(2, "Nivel de urgencia");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "select", 58);
    \u0275\u0275listener("ngModelChange", function ReporteFormComponent_Conditional_11_Conditional_65_Template_select_ngModelChange_3_listener($event) {
      \u0275\u0275restoreView(_r13);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.filtroNivel.set($event));
    });
    \u0275\u0275elementStart(4, "option", 59);
    \u0275\u0275text(5, "Todos");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "option", 61);
    \u0275\u0275text(7, "Bajo");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "option", 62);
    \u0275\u0275text(9, "Medio");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(10, "option", 63);
    \u0275\u0275text(11, "Alto");
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(3);
    \u0275\u0275property("ngModel", ctx_r0.filtroNivel());
  }
}
function ReporteFormComponent_Conditional_11_Conditional_66_For_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "option", 64);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const j_r15 = ctx.$implicit;
    \u0275\u0275property("ngValue", j_r15.id);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(j_r15.nombre);
  }
}
function ReporteFormComponent_Conditional_11_Conditional_66_Template(rf, ctx) {
  if (rf & 1) {
    const _r14 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div")(1, "label", 17);
    \u0275\u0275text(2, "Jurisdicci\xF3n");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "select", 58);
    \u0275\u0275listener("ngModelChange", function ReporteFormComponent_Conditional_11_Conditional_66_Template_select_ngModelChange_3_listener($event) {
      \u0275\u0275restoreView(_r14);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.filtroJurisdiccion.set($event));
    });
    \u0275\u0275elementStart(4, "option", 64);
    \u0275\u0275text(5, "Todas");
    \u0275\u0275elementEnd();
    \u0275\u0275repeaterCreate(6, ReporteFormComponent_Conditional_11_Conditional_66_For_7_Template, 2, 2, "option", 64, _forTrack3);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(3);
    \u0275\u0275property("ngModel", ctx_r0.filtroJurisdiccion());
    \u0275\u0275advance();
    \u0275\u0275property("ngValue", null);
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r0.jurisdicciones());
  }
}
function ReporteFormComponent_Conditional_11_Conditional_67_For_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "option", 60);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const m_r17 = ctx.$implicit;
    \u0275\u0275property("value", m_r17);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(m_r17);
  }
}
function ReporteFormComponent_Conditional_11_Conditional_67_For_15_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "option", 60);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const e_r18 = ctx.$implicit;
    \u0275\u0275property("value", e_r18);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(e_r18);
  }
}
function ReporteFormComponent_Conditional_11_Conditional_67_Template(rf, ctx) {
  if (rf & 1) {
    const _r16 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div")(1, "label", 17);
    \u0275\u0275text(2, "Materia");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "select", 58);
    \u0275\u0275listener("ngModelChange", function ReporteFormComponent_Conditional_11_Conditional_67_Template_select_ngModelChange_3_listener($event) {
      \u0275\u0275restoreView(_r16);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.filtroMateria.set($event));
    });
    \u0275\u0275elementStart(4, "option", 59);
    \u0275\u0275text(5, "Todas");
    \u0275\u0275elementEnd();
    \u0275\u0275repeaterCreate(6, ReporteFormComponent_Conditional_11_Conditional_67_For_7_Template, 2, 2, "option", 60, \u0275\u0275repeaterTrackByIdentity);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(8, "div")(9, "label", 17);
    \u0275\u0275text(10, "Estado de la causa");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(11, "select", 58);
    \u0275\u0275listener("ngModelChange", function ReporteFormComponent_Conditional_11_Conditional_67_Template_select_ngModelChange_11_listener($event) {
      \u0275\u0275restoreView(_r16);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.filtroEstadoCausa.set($event));
    });
    \u0275\u0275elementStart(12, "option", 59);
    \u0275\u0275text(13, "Todos");
    \u0275\u0275elementEnd();
    \u0275\u0275repeaterCreate(14, ReporteFormComponent_Conditional_11_Conditional_67_For_15_Template, 2, 2, "option", 60, \u0275\u0275repeaterTrackByIdentity);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(3);
    \u0275\u0275property("ngModel", ctx_r0.filtroMateria());
    \u0275\u0275advance(3);
    \u0275\u0275repeater(ctx_r0.materias());
    \u0275\u0275advance(5);
    \u0275\u0275property("ngModel", ctx_r0.filtroEstadoCausa());
    \u0275\u0275advance(3);
    \u0275\u0275repeater(ctx_r0.estadosCausa());
  }
}
function ReporteFormComponent_Conditional_11_Conditional_79_Template(rf, ctx) {
  if (rf & 1) {
    const _r19 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div")(1, "span", 65);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "button", 66);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_11_Conditional_79_Template_button_click_3_listener() {
      \u0275\u0275restoreView(_r19);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.mensaje.set(""));
    });
    \u0275\u0275text(4, "\xD7");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275classMap(ctx_r0.mensajeEsError() ? "alert-danger" : "alert-success");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.mensaje());
  }
}
function ReporteFormComponent_Conditional_11_Conditional_83_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 12);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.motivoBloqueo());
  }
}
function ReporteFormComponent_Conditional_11_Conditional_84_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275text(0, " Al enviar o descargar se guardan primero los cambios del informe. ");
  }
}
function ReporteFormComponent_Conditional_11_Template(rf, ctx) {
  if (rf & 1) {
    const _r2 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 6)(1, "div", 14)(2, "h2", 15);
    \u0275\u0275text(3, "1. Datos del informe");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(4, "div", 16)(5, "div")(6, "label", 17);
    \u0275\u0275text(7, "Nombre ");
    \u0275\u0275elementStart(8, "span", 18);
    \u0275\u0275text(9, "*");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(10, "input", 19);
    \u0275\u0275listener("ngModelChange", function ReporteFormComponent_Conditional_11_Template_input_ngModelChange_10_listener($event) {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.nombre.set($event));
    });
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(11, "div", 20)(12, "label", 17);
    \u0275\u0275text(13, "Descripci\xF3n");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(14, "input", 21);
    \u0275\u0275listener("ngModelChange", function ReporteFormComponent_Conditional_11_Template_input_ngModelChange_14_listener($event) {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.descripcion.set($event));
    });
    \u0275\u0275elementEnd()()()();
    \u0275\u0275elementStart(15, "div", 6)(16, "div", 14)(17, "h2", 15);
    \u0275\u0275text(18, "2. Fuente de datos");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(19, "p", 22);
    \u0275\u0275text(20, " Cada fuente tiene sus propios campos y filtros. Al cambiarla se descartan los campos ya elegidos. ");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(21, "div", 23);
    \u0275\u0275repeaterCreate(22, ReporteFormComponent_Conditional_11_For_23_Template, 5, 4, "button", 24, _forTrack0);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(24, "div", 6)(25, "div", 14)(26, "h2", 15);
    \u0275\u0275text(27, "3. Campos del informe");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(28, "p", 22);
    \u0275\u0275text(29, " El ");
    \u0275\u0275elementStart(30, "strong");
    \u0275\u0275text(31, "orden de la columna derecha es el orden de las columnas del Excel");
    \u0275\u0275elementEnd();
    \u0275\u0275text(32, ": use las flechas para moverlos. ");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(33, "div", 25)(34, "div")(35, "div", 26)(36, "h3", 27);
    \u0275\u0275text(37);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(38, "button", 28);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_11_Template_button_click_38_listener() {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.agregarTodos());
    });
    \u0275\u0275text(39, "Agregar todos");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(40, "input", 29);
    \u0275\u0275listener("ngModelChange", function ReporteFormComponent_Conditional_11_Template_input_ngModelChange_40_listener($event) {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.busqueda.set($event));
    });
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(41, "ul", 30);
    \u0275\u0275repeaterCreate(42, ReporteFormComponent_Conditional_11_For_43_Template, 5, 3, "li", 31, _forTrack1, false, ReporteFormComponent_Conditional_11_ForEmpty_44_Template, 3, 1, "li", 32);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(45, "div")(46, "div", 26)(47, "h3", 27);
    \u0275\u0275text(48);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(49, "button", 28);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_11_Template_button_click_49_listener() {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.quitarTodos());
    });
    \u0275\u0275text(50, "Quitar todos");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(51, "p", 33);
    \u0275\u0275text(52, " El primero de la lista es la primera columna del Excel. ");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(53, "ul", 30);
    \u0275\u0275repeaterCreate(54, ReporteFormComponent_Conditional_11_For_55_Template, 13, 5, "li", 34, _forTrack1, false, ReporteFormComponent_Conditional_11_ForEmpty_56_Template, 2, 0, "li", 32);
    \u0275\u0275elementEnd()()()();
    \u0275\u0275elementStart(57, "div", 6)(58, "div", 14)(59, "h2", 15);
    \u0275\u0275text(60, "4. Filtros");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(61, "p", 22);
    \u0275\u0275text(62, " Todos opcionales. Sin filtros, el informe trae todos sus registros de esta fuente. ");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(63, "div", 16);
    \u0275\u0275template(64, ReporteFormComponent_Conditional_11_Conditional_64_Template, 8, 1, "div")(65, ReporteFormComponent_Conditional_11_Conditional_65_Template, 12, 1, "div")(66, ReporteFormComponent_Conditional_11_Conditional_66_Template, 8, 2, "div")(67, ReporteFormComponent_Conditional_11_Conditional_67_Template, 16, 2);
    \u0275\u0275elementStart(68, "div")(69, "label", 17);
    \u0275\u0275text(70, "Fecha desde");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(71, "input", 35);
    \u0275\u0275listener("ngModelChange", function ReporteFormComponent_Conditional_11_Template_input_ngModelChange_71_listener($event) {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.filtroDesde.set($event));
    });
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(72, "div")(73, "label", 17);
    \u0275\u0275text(74, "Fecha hasta");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(75, "input", 35);
    \u0275\u0275listener("ngModelChange", function ReporteFormComponent_Conditional_11_Template_input_ngModelChange_75_listener($event) {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.filtroHasta.set($event));
    });
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(76, "div", 36)(77, "p", 37);
    \u0275\u0275text(78);
    \u0275\u0275elementEnd()()()();
    \u0275\u0275template(79, ReporteFormComponent_Conditional_11_Conditional_79_Template, 5, 3, "div", 38);
    \u0275\u0275elementStart(80, "div", 6)(81, "div", 39)(82, "p", 40);
    \u0275\u0275template(83, ReporteFormComponent_Conditional_11_Conditional_83_Template, 2, 1, "span", 12)(84, ReporteFormComponent_Conditional_11_Conditional_84_Template, 1, 0);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(85, "div", 41)(86, "button", 42);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_11_Template_button_click_86_listener() {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.guardar());
    });
    \u0275\u0275text(87);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(88, "button", 43);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_11_Template_button_click_88_listener() {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.descargar());
    });
    \u0275\u0275text(89);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(90, "button", 44);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_11_Template_button_click_90_listener() {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.enviar());
    });
    \u0275\u0275text(91);
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(10);
    \u0275\u0275property("ngModel", ctx_r0.nombre());
    \u0275\u0275advance(4);
    \u0275\u0275property("ngModel", ctx_r0.descripcion());
    \u0275\u0275advance(8);
    \u0275\u0275repeater(ctx_r0.catalogo());
    \u0275\u0275advance(15);
    \u0275\u0275textInterpolate1(" Disponibles (", ctx_r0.disponibles().length, ") ");
    \u0275\u0275advance();
    \u0275\u0275property("disabled", ctx_r0.disponibles().length === 0);
    \u0275\u0275advance(2);
    \u0275\u0275property("ngModel", ctx_r0.busqueda());
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r0.disponiblesFiltrados());
    \u0275\u0275advance(6);
    \u0275\u0275textInterpolate1(" Columnas del Excel (", ctx_r0.elegidos().length, ") ");
    \u0275\u0275advance();
    \u0275\u0275property("disabled", ctx_r0.elegidos().length === 0);
    \u0275\u0275advance(5);
    \u0275\u0275repeater(ctx_r0.elegidosDetalle());
    \u0275\u0275advance(10);
    \u0275\u0275conditional(ctx_r0.opcionesEstado().length > 0 ? 64 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.usaNivel() ? 65 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.usaJurisdiccion() ? 66 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.usaMateria() ? 67 : -1);
    \u0275\u0275advance(4);
    \u0275\u0275property("ngModel", ctx_r0.filtroDesde());
    \u0275\u0275advance(4);
    \u0275\u0275property("ngModel", ctx_r0.filtroHasta());
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r0.ayudaFechas());
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.mensaje() ? 79 : -1);
    \u0275\u0275advance(4);
    \u0275\u0275conditional(!ctx_r0.puedeGenerar() ? 83 : 84);
    \u0275\u0275advance(3);
    \u0275\u0275property("disabled", !ctx_r0.puedeGenerar() || ctx_r0.ocupado());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r0.guardando() ? "Guardando..." : "Guardar", " ");
    \u0275\u0275advance();
    \u0275\u0275property("disabled", !ctx_r0.puedeGenerar() || ctx_r0.ocupado());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r0.descargando() ? "Generando..." : "Descargar", " ");
    \u0275\u0275advance();
    \u0275\u0275property("disabled", !ctx_r0.puedeGenerar() || ctx_r0.ocupado());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r0.enviando() ? "Enviando..." : "Enviar por correo", " ");
  }
}
function ReporteFormComponent_Conditional_12_Template(rf, ctx) {
  if (rf & 1) {
    const _r20 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 67);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_12_Template_div_click_0_listener() {
      \u0275\u0275restoreView(_r20);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.fuentePendiente.set(null));
    });
    \u0275\u0275elementStart(1, "div", 68);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_12_Template_div_click_1_listener($event) {
      \u0275\u0275restoreView(_r20);
      return \u0275\u0275resetView($event.stopPropagation());
    });
    \u0275\u0275elementStart(2, "div", 69)(3, "h3", 70);
    \u0275\u0275text(4, "Cambiar la fuente de datos");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "button", 71);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_12_Template_button_click_5_listener() {
      \u0275\u0275restoreView(_r20);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.fuentePendiente.set(null));
    });
    \u0275\u0275text(6, "\xD7");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(7, "div", 72)(8, "div", 73)(9, "div", 74);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(10, "svg", 75);
    \u0275\u0275element(11, "path", 76);
    \u0275\u0275elementEnd()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(12, "p", 77);
    \u0275\u0275text(13, " Los ");
    \u0275\u0275elementStart(14, "strong");
    \u0275\u0275text(15);
    \u0275\u0275elementEnd();
    \u0275\u0275text(16, " que ya eligi\xF3 y los filtros se descartan, porque no existen en la otra fuente. \xBFContin\xFAa? ");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(17, "div", 78)(18, "button", 79);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_12_Template_button_click_18_listener() {
      \u0275\u0275restoreView(_r20);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.fuentePendiente.set(null));
    });
    \u0275\u0275text(19, "Cancelar");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(20, "button", 80);
    \u0275\u0275listener("click", function ReporteFormComponent_Conditional_12_Template_button_click_20_listener() {
      const pendiente_r21 = \u0275\u0275restoreView(_r20);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.confirmarCambioFuente(pendiente_r21));
    });
    \u0275\u0275text(21, "S\xED, cambiar");
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(15);
    \u0275\u0275textInterpolate1("", ctx_r0.elegidos().length, " campos");
  }
}
var ReporteFormComponent = class _ReporteFormComponent {
  service = inject(ReporteService);
  estadoDiarioService = inject(EstadoDiarioService);
  movimientoService = inject(MovimientoService);
  notification = inject(NotificationService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  catalogo = signal([]);
  plantillaId = signal(null);
  cargando = signal(true);
  error = signal("");
  nombre = signal("");
  descripcion = signal("");
  fuente = signal("estado_diario");
  /** Claves de los campos elegidos: su orden ES el orden de columnas del Excel. */
  elegidos = signal([]);
  busqueda = signal("");
  /** Fuente que el usuario quiere cambiar, a la espera de confirmación. */
  fuentePendiente = signal(null);
  filtroEstado = signal("");
  filtroNivel = signal("");
  filtroJurisdiccion = signal(null);
  filtroMateria = signal("");
  filtroEstadoCausa = signal("");
  filtroDesde = signal("");
  filtroHasta = signal("");
  jurisdicciones = signal([]);
  materias = signal([]);
  estadosCausa = signal([]);
  guardando = signal(false);
  enviando = signal(false);
  descargando = signal(false);
  mensaje = signal("");
  mensajeEsError = signal(false);
  /** Campos del catálogo para la fuente activa. */
  camposFuente = computed(() => this.catalogo().find((f) => f.fuente === this.fuente())?.campos ?? []);
  disponibles = computed(() => this.camposFuente().filter((c) => !this.elegidos().includes(c.clave)));
  disponiblesFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    if (!texto)
      return this.disponibles();
    return this.disponibles().filter((c) => c.etiqueta.toLowerCase().includes(texto));
  });
  /** Los elegidos, en su orden, resueltos contra el catálogo. */
  elegidosDetalle = computed(() => {
    const catalogo = this.camposFuente();
    return this.elegidos().map((clave) => catalogo.find((c) => c.clave === clave)).filter((c) => !!c);
  });
  opcionesEstado = computed(() => {
    if (this.fuente() === "estado_diario") {
      return [
        { valor: "no-leido", etiqueta: "No le\xEDdos" },
        { valor: "pendiente", etiqueta: "Pendientes" },
        { valor: "resuelto", etiqueta: "Resueltos" }
      ];
    }
    if (this.fuente() === "agenda") {
      return [
        { valor: "vigentes", etiqueta: "Vigentes" },
        { valor: "finalizados", etiqueta: "Finalizados" }
      ];
    }
    return [];
  });
  usaNivel = computed(() => this.fuente() === "estado_diario" || this.fuente() === "agenda");
  usaJurisdiccion = computed(() => this.fuente() === "estado_diario");
  usaMateria = computed(() => this.fuente() === "movimientos");
  ayudaFechas = computed(() => this.fuente() === "agenda" ? "El rango se aplica sobre la fecha del recordatorio." : "El rango se aplica sobre la fecha del archivo de estado diario, no sobre la fecha de ingreso de la causa.");
  puedeGenerar = computed(() => this.elegidos().length > 0 && this.nombre().trim().length > 0);
  motivoBloqueo = computed(() => {
    if (!this.nombre().trim())
      return "P\xF3ngale un nombre al informe para poder guardarlo.";
    if (this.elegidos().length === 0)
      return "Elija al menos un campo: un informe sin columnas no se puede generar.";
    return "";
  });
  ocupado = computed(() => this.guardando() || this.enviando() || this.descargando());
  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get("id");
    const id = idParam ? Number(idParam) : null;
    this.estadoDiarioService.getJurisdicciones().subscribe({
      next: (res) => this.jurisdicciones.set(res.jurisdicciones)
    });
    this.service.getCampos().subscribe({
      next: (res) => {
        this.catalogo.set(res.fuentes);
        if (id) {
          this.cargarPlantilla(id);
        } else {
          this.cargando.set(false);
        }
      },
      error: () => {
        this.cargando.set(false);
        this.error.set("No se pudo cargar el cat\xE1logo de campos");
      }
    });
  }
  cargarPlantilla(id) {
    this.service.getPlantillas().subscribe({
      next: (res) => {
        const plantilla = res.plantillas.find((p) => p.id === id);
        if (!plantilla) {
          this.cargando.set(false);
          this.error.set("El informe no existe o no est\xE1 disponible para su usuario");
          return;
        }
        this.aplicar(plantilla);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set("No se pudo cargar el informe");
      }
    });
  }
  aplicar(p) {
    this.plantillaId.set(p.id);
    this.nombre.set(p.nombre);
    this.descripcion.set(p.descripcion ?? "");
    this.fuente.set(p.fuente);
    this.elegidos.set([...p.campos]);
    const f = p.filtros ?? {};
    this.filtroEstado.set(f.estado ?? "");
    this.filtroNivel.set(f.nivel ?? "");
    this.filtroJurisdiccion.set(f.jurisdiccion_id ?? null);
    this.filtroMateria.set(f.materia ?? "");
    this.filtroEstadoCausa.set(f.estado_causa ?? "");
    this.filtroDesde.set(f.fecha_desde ?? "");
    this.filtroHasta.set(f.fecha_hasta ?? "");
    if (p.fuente === "movimientos")
      this.cargarCatalogoMovimientos();
  }
  /** Materias y estados de causa reales del usuario, para no filtrar a ciegas. */
  cargarCatalogoMovimientos() {
    if (this.materias().length > 0)
      return;
    this.movimientoService.getResumen().subscribe({
      next: (res) => {
        this.materias.set(res.por_materia.map((m) => m.materia).filter((m) => !!m));
        this.estadosCausa.set(res.estados_causa);
      }
    });
  }
  // ── Fuente ────────────────────────────────────────────
  pedirCambioFuente(fuente) {
    if (fuente === this.fuente())
      return;
    if (this.elegidos().length === 0) {
      this.confirmarCambioFuente(fuente);
      return;
    }
    this.fuentePendiente.set(fuente);
  }
  confirmarCambioFuente(fuente) {
    this.fuentePendiente.set(null);
    this.fuente.set(fuente);
    this.elegidos.set([]);
    this.busqueda.set("");
    this.limpiarFiltros();
    if (fuente === "movimientos")
      this.cargarCatalogoMovimientos();
  }
  limpiarFiltros() {
    this.filtroEstado.set("");
    this.filtroNivel.set("");
    this.filtroJurisdiccion.set(null);
    this.filtroMateria.set("");
    this.filtroEstadoCausa.set("");
    this.filtroDesde.set("");
    this.filtroHasta.set("");
  }
  // ── Selector de campos ────────────────────────────────
  agregar(clave) {
    this.elegidos.update((lista) => lista.includes(clave) ? lista : [...lista, clave]);
  }
  quitar(clave) {
    this.elegidos.update((lista) => lista.filter((c) => c !== clave));
  }
  agregarTodos() {
    const nuevos = this.disponibles().map((c) => c.clave);
    this.elegidos.update((lista) => [...lista, ...nuevos]);
  }
  quitarTodos() {
    this.elegidos.set([]);
  }
  subir(indice) {
    if (indice <= 0)
      return;
    this.intercambiar(indice, indice - 1);
  }
  bajar(indice) {
    if (indice >= this.elegidos().length - 1)
      return;
    this.intercambiar(indice, indice + 1);
  }
  intercambiar(a, b) {
    this.elegidos.update((lista) => {
      const copia = [...lista];
      [copia[a], copia[b]] = [copia[b], copia[a]];
      return copia;
    });
  }
  // ── Guardar / generar ─────────────────────────────────
  filtros() {
    const f = {};
    if (this.opcionesEstado().length > 0 && this.filtroEstado())
      f.estado = this.filtroEstado();
    if (this.usaNivel() && this.filtroNivel())
      f.nivel = this.filtroNivel();
    if (this.usaJurisdiccion() && this.filtroJurisdiccion()) {
      f.jurisdiccion_id = Number(this.filtroJurisdiccion());
    }
    if (this.usaMateria()) {
      if (this.filtroMateria())
        f.materia = this.filtroMateria();
      if (this.filtroEstadoCausa())
        f.estado_causa = this.filtroEstadoCausa();
    }
    if (this.filtroDesde())
      f.fecha_desde = this.filtroDesde();
    if (this.filtroHasta())
      f.fecha_hasta = this.filtroHasta();
    return f;
  }
  payload() {
    return {
      nombre: this.nombre().trim(),
      descripcion: this.descripcion().trim() || null,
      fuente: this.fuente(),
      campos: this.elegidos(),
      filtros: this.filtros()
    };
  }
  /**
   * Guardar y generar son una sola acción: enviar o descargar siempre trabaja
   * sobre lo que está en pantalla, así que primero se persiste la plantilla.
   */
  asegurarGuardado() {
    const id = this.plantillaId();
    const datos = this.payload();
    const peticion = id ? this.service.actualizar(id, datos) : this.service.crear(datos);
    return peticion.pipe(tap((p) => this.plantillaId.set(p.id)));
  }
  guardar() {
    if (!this.puedeGenerar() || this.ocupado())
      return;
    this.mensaje.set("");
    this.guardando.set(true);
    const esNuevo = this.plantillaId() === null;
    this.asegurarGuardado().subscribe({
      next: (p) => {
        this.guardando.set(false);
        this.notification.success("Informe guardado");
        if (esNuevo)
          this.router.navigate(["/informes", p.id], { replaceUrl: true });
      },
      error: (err) => {
        this.guardando.set(false);
        this.mostrarError(err.error?.detail || "No se pudo guardar el informe");
      }
    });
  }
  enviar() {
    if (!this.puedeGenerar() || this.ocupado())
      return;
    this.mensaje.set("");
    this.enviando.set(true);
    this.asegurarGuardado().pipe(switchMap((p) => this.service.enviar(p.id))).subscribe({
      next: (res) => {
        this.enviando.set(false);
        this.mensaje.set(res.mensaje);
        this.mensajeEsError.set(false);
        this.notification.success(res.mensaje);
      },
      error: (err) => {
        this.enviando.set(false);
        this.mostrarError(`${err.error?.detail || "No se pudo enviar el informe"} \u2014 mientras tanto puede usar Descargar.`);
      }
    });
  }
  descargar() {
    if (!this.puedeGenerar() || this.ocupado())
      return;
    this.mensaje.set("");
    this.descargando.set(true);
    this.asegurarGuardado().pipe(switchMap((p) => this.service.descargar(p.id))).subscribe({
      next: (blob) => {
        this.descargando.set(false);
        descargarBlob(blob, nombreArchivoSeguro(this.nombre()), this.nombre()).catch(() => this.mostrarError("No se pudo guardar el informe"));
      },
      error: (err) => {
        this.descargando.set(false);
        mensajeErrorBlob(err, "No se pudo generar el informe").then((m) => this.mostrarError(m));
      }
    });
  }
  mostrarError(texto) {
    this.mensaje.set(texto);
    this.mensajeEsError.set(true);
  }
  static \u0275fac = function ReporteFormComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _ReporteFormComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _ReporteFormComponent, selectors: [["app-reporte-form"]], decls: 13, vars: 3, consts: [[1, "space-y-6"], [1, "flex", "items-start", "justify-between", "flex-wrap", "gap-4"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], ["routerLink", "/informes", 1, "btn-secondary", "shrink-0"], [1, "flex", "items-center", "justify-center", "py-20"], [1, "card"], [1, "modal-backdrop"], ["viewBox", "0 0 24 24", 1, "animate-spin", "h-10", "w-10", "text-primary-600"], ["cx", "12", "cy", "12", "r", "10", "stroke", "currentColor", "stroke-width", "4", "fill", "none", 1, "opacity-25"], ["fill", "currentColor", "d", "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z", 1, "opacity-75"], [1, "card-body", "space-y-3"], [1, "text-danger-700"], ["routerLink", "/informes", 1, "btn-secondary"], [1, "card-header"], [1, "font-semibold", "text-neutral-800"], [1, "card-body", "grid", "grid-cols-1", "md:grid-cols-3", "gap-4"], [1, "form-label"], [1, "text-danger-600"], ["type", "text", "placeholder", "Ej: Causas pendientes de la semana", "maxlength", "200", 1, "form-input", 3, "ngModelChange", "ngModel"], [1, "md:col-span-2"], ["type", "text", "placeholder", "Opcional. Para reconocerlo en la lista de informes", 1, "form-input", 3, "ngModelChange", "ngModel"], [1, "text-sm", "text-neutral-500", "mt-1"], [1, "card-body", "grid", "grid-cols-1", "md:grid-cols-3", "gap-3"], ["type", "button", 1, "text-left", "rounded-lg", "border", "p-4", "transition-colors", 3, "class"], [1, "card-body", "grid", "grid-cols-1", "lg:grid-cols-2", "gap-6"], [1, "flex", "items-center", "justify-between", "mb-2"], [1, "text-sm", "font-semibold", "text-neutral-700"], ["type", "button", 1, "btn-secondary", "btn-sm", 3, "click", "disabled"], ["type", "text", "placeholder", "Buscar campo...", 1, "form-input", "mb-2", 3, "ngModelChange", "ngModel"], [1, "rounded-lg", "border", "border-neutral-200", "divide-y", "divide-neutral-100", "max-h-80", "overflow-y-auto"], [1, "flex", "items-center", "justify-between", "gap-2", "px-3", "py-2", "hover:bg-neutral-50"], [1, "px-3", "py-6", "text-center", "text-sm", "text-neutral-400"], [1, "text-xs", "text-neutral-400", "mb-2", "h-[42px]", "flex", "items-center"], [1, "flex", "items-center", "gap-2", "px-3", "py-2", "hover:bg-neutral-50"], ["type", "date", 1, "form-input", 3, "ngModelChange", "ngModel"], [1, "md:col-span-3"], [1, "text-xs", "text-neutral-400"], [3, "class"], [1, "card-body", "flex", "flex-wrap", "items-center", "justify-between", "gap-3"], [1, "text-sm", "text-neutral-500"], [1, "flex", "flex-wrap", "gap-3"], [1, "btn-secondary", 3, "click", "disabled"], [1, "btn-outline", 3, "click", "disabled"], [1, "btn-primary", 3, "click", "disabled"], ["type", "button", 1, "text-left", "rounded-lg", "border", "p-4", "transition-colors", 3, "click"], [1, "block", "font-medium", "text-neutral-800"], [1, "block", "text-xs", "text-neutral-500", "mt-1"], [1, "text-sm", "text-neutral-700", "truncate", 3, "title"], ["type", "button", 1, "btn-outline", "btn-sm", "shrink-0", 3, "click", "title"], [1, "w-6", "shrink-0", "text-xs", "font-semibold", "text-neutral-400"], [1, "flex-1", "text-sm", "text-neutral-700", "truncate", 3, "title"], ["type", "button", "title", "Subir", 1, "btn-secondary", "btn-sm", "shrink-0", 3, "click", "disabled"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-3", "h-3"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M5 15l7-7 7 7"], ["type", "button", "title", "Bajar", 1, "btn-secondary", "btn-sm", "shrink-0", 3, "click", "disabled"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M19 9l-7 7-7-7"], ["type", "button", "title", "Quitar", 1, "btn-danger", "btn-sm", "shrink-0", 3, "click"], [1, "form-select", 3, "ngModelChange", "ngModel"], ["value", ""], [3, "value"], ["value", "bajo"], ["value", "medio"], ["value", "alto"], [3, "ngValue"], [1, "flex-1"], [1, "text-current", "opacity-60", "hover:opacity-100", 3, "click"], [1, "modal-backdrop", 3, "click"], [1, "modal-content", "max-w-sm", 3, "click"], [1, "modal-header"], [1, "text-lg", "font-semibold"], [1, "text-neutral-400", "hover:text-neutral-600", 3, "click"], [1, "modal-body"], [1, "flex", "items-start", "gap-3"], [1, "shrink-0", "w-10", "h-10", "rounded-full", "bg-warning-100", "flex", "items-center", "justify-center"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-5", "h-5", "text-warning-600"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"], [1, "text-sm", "text-neutral-600", "mt-2"], [1, "modal-footer"], [1, "btn-secondary", 3, "click"], [1, "btn-warning", 3, "click"]], template: function ReporteFormComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div", 1)(2, "div")(3, "h1", 2);
      \u0275\u0275text(4);
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(5, "p", 3);
      \u0275\u0275text(6, " Elija la fuente de datos y los campos que quiere ver en el Excel. ");
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(7, "a", 4);
      \u0275\u0275text(8, "Volver a mis informes");
      \u0275\u0275elementEnd()();
      \u0275\u0275template(9, ReporteFormComponent_Conditional_9_Template, 4, 0, "div", 5)(10, ReporteFormComponent_Conditional_10_Template, 6, 1, "div", 6)(11, ReporteFormComponent_Conditional_11_Template, 92, 24);
      \u0275\u0275elementEnd();
      \u0275\u0275template(12, ReporteFormComponent_Conditional_12_Template, 22, 1, "div", 7);
    }
    if (rf & 2) {
      let tmp_2_0;
      \u0275\u0275advance(4);
      \u0275\u0275textInterpolate1(" ", ctx.plantillaId() ? "Editar informe" : "Nuevo informe", " ");
      \u0275\u0275advance(5);
      \u0275\u0275conditional(ctx.cargando() ? 9 : ctx.error() ? 10 : 11);
      \u0275\u0275advance(3);
      \u0275\u0275conditional((tmp_2_0 = ctx.fuentePendiente()) ? 12 : -1, tmp_2_0);
    }
  }, dependencies: [CommonModule, FormsModule, NgSelectOption, \u0275NgSelectMultipleOption, DefaultValueAccessor, SelectControlValueAccessor, NgControlStatus, MaxLengthValidator, NgModel, RouterLink], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ReporteFormComponent, [{
    type: Component,
    args: [{
      selector: "app-reporte-form",
      standalone: true,
      imports: [CommonModule, FormsModule, RouterLink],
      template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">
            {{ plantillaId() ? 'Editar informe' : 'Nuevo informe' }}
          </h1>
          <p class="text-neutral-500 mt-1">
            Elija la fuente de datos y los campos que quiere ver en el Excel.
          </p>
        </div>
        <a routerLink="/informes" class="btn-secondary shrink-0">Volver a mis informes</a>
      </div>

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
            <a routerLink="/informes" class="btn-secondary">Volver a mis informes</a>
          </div>
        </div>
      } @else {
        <!-- 1. Datos del informe -->
        <div class="card">
          <div class="card-header">
            <h2 class="font-semibold text-neutral-800">1. Datos del informe</h2>
          </div>
          <div class="card-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="form-label">Nombre <span class="text-danger-600">*</span></label>
              <input type="text" class="form-input" [ngModel]="nombre()" (ngModelChange)="nombre.set($event)"
                     placeholder="Ej: Causas pendientes de la semana" maxlength="200" />
            </div>
            <div class="md:col-span-2">
              <label class="form-label">Descripci\xF3n</label>
              <input type="text" class="form-input" [ngModel]="descripcion()" (ngModelChange)="descripcion.set($event)"
                     placeholder="Opcional. Para reconocerlo en la lista de informes" />
            </div>
          </div>
        </div>

        <!-- 2. Fuente de datos -->
        <div class="card">
          <div class="card-header">
            <h2 class="font-semibold text-neutral-800">2. Fuente de datos</h2>
            <p class="text-sm text-neutral-500 mt-1">
              Cada fuente tiene sus propios campos y filtros. Al cambiarla se descartan los campos ya elegidos.
            </p>
          </div>
          <div class="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
            @for (f of catalogo(); track f.fuente) {
              <button type="button" (click)="pedirCambioFuente(f.fuente)"
                      class="text-left rounded-lg border p-4 transition-colors"
                      [class]="fuente() === f.fuente
                        ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-neutral-200 hover:border-primary-300 hover:bg-neutral-50'">
                <span class="block font-medium text-neutral-800">{{ f.etiqueta }}</span>
                <span class="block text-xs text-neutral-500 mt-1">{{ f.campos.length }} campos disponibles</span>
              </button>
            }
          </div>
        </div>

        <!-- 3. Campos -->
        <div class="card">
          <div class="card-header">
            <h2 class="font-semibold text-neutral-800">3. Campos del informe</h2>
            <p class="text-sm text-neutral-500 mt-1">
              El <strong>orden de la columna derecha es el orden de las columnas del Excel</strong>:
              use las flechas para moverlos.
            </p>
          </div>
          <div class="card-body grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Disponibles -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-semibold text-neutral-700">
                  Disponibles ({{ disponibles().length }})
                </h3>
                <button type="button" (click)="agregarTodos()" class="btn-secondary btn-sm"
                        [disabled]="disponibles().length === 0">Agregar todos</button>
              </div>
              <input type="text" class="form-input mb-2" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)"
                     placeholder="Buscar campo..." />
              <ul class="rounded-lg border border-neutral-200 divide-y divide-neutral-100 max-h-80 overflow-y-auto">
                @for (c of disponiblesFiltrados(); track c.clave) {
                  <li class="flex items-center justify-between gap-2 px-3 py-2 hover:bg-neutral-50">
                    <span class="text-sm text-neutral-700 truncate" [title]="c.etiqueta">{{ c.etiqueta }}</span>
                    <button type="button" (click)="agregar(c.clave)" class="btn-outline btn-sm shrink-0"
                            [title]="'Agregar ' + c.etiqueta">Agregar</button>
                  </li>
                } @empty {
                  <li class="px-3 py-6 text-center text-sm text-neutral-400">
                    @if (busqueda()) { Ning\xFAn campo coincide con la b\xFAsqueda }
                    @else { Ya agreg\xF3 todos los campos de esta fuente }
                  </li>
                }
              </ul>
            </div>

            <!-- Elegidos -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-semibold text-neutral-700">
                  Columnas del Excel ({{ elegidos().length }})
                </h3>
                <button type="button" (click)="quitarTodos()" class="btn-secondary btn-sm"
                        [disabled]="elegidos().length === 0">Quitar todos</button>
              </div>
              <!-- Ocupa el alto del buscador de la izquierda para que ambas listas queden alineadas -->
              <p class="text-xs text-neutral-400 mb-2 h-[42px] flex items-center">
                El primero de la lista es la primera columna del Excel.
              </p>
              <ul class="rounded-lg border border-neutral-200 divide-y divide-neutral-100 max-h-80 overflow-y-auto">
                @for (c of elegidosDetalle(); track c.clave; let i = $index, primero = $first, ultimo = $last) {
                  <li class="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50">
                    <span class="w-6 shrink-0 text-xs font-semibold text-neutral-400">{{ i + 1 }}</span>
                    <span class="flex-1 text-sm text-neutral-700 truncate" [title]="c.etiqueta">{{ c.etiqueta }}</span>
                    <button type="button" (click)="subir(i)" class="btn-secondary btn-sm shrink-0"
                            [disabled]="primero" title="Subir">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button type="button" (click)="bajar(i)" class="btn-secondary btn-sm shrink-0"
                            [disabled]="ultimo" title="Bajar">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button type="button" (click)="quitar(c.clave)" class="btn-danger btn-sm shrink-0" title="Quitar">
                      &times;
                    </button>
                  </li>
                } @empty {
                  <li class="px-3 py-6 text-center text-sm text-neutral-400">
                    No ha elegido ning\xFAn campo. El informe necesita al menos uno.
                  </li>
                }
              </ul>
            </div>
          </div>
        </div>

        <!-- 4. Filtros -->
        <div class="card">
          <div class="card-header">
            <h2 class="font-semibold text-neutral-800">4. Filtros</h2>
            <p class="text-sm text-neutral-500 mt-1">
              Todos opcionales. Sin filtros, el informe trae todos sus registros de esta fuente.
            </p>
          </div>
          <div class="card-body grid grid-cols-1 md:grid-cols-3 gap-4">
            @if (opcionesEstado().length > 0) {
              <div>
                <label class="form-label">Estado</label>
                <select class="form-select" [ngModel]="filtroEstado()" (ngModelChange)="filtroEstado.set($event)">
                  <option value="">Todos</option>
                  @for (o of opcionesEstado(); track o.valor) {
                    <option [value]="o.valor">{{ o.etiqueta }}</option>
                  }
                </select>
              </div>
            }

            @if (usaNivel()) {
              <div>
                <label class="form-label">Nivel de urgencia</label>
                <select class="form-select" [ngModel]="filtroNivel()" (ngModelChange)="filtroNivel.set($event)">
                  <option value="">Todos</option>
                  <option value="bajo">Bajo</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                </select>
              </div>
            }

            @if (usaJurisdiccion()) {
              <div>
                <label class="form-label">Jurisdicci\xF3n</label>
                <select class="form-select" [ngModel]="filtroJurisdiccion()"
                        (ngModelChange)="filtroJurisdiccion.set($event)">
                  <option [ngValue]="null">Todas</option>
                  @for (j of jurisdicciones(); track j.id) {
                    <option [ngValue]="j.id">{{ j.nombre }}</option>
                  }
                </select>
              </div>
            }

            @if (usaMateria()) {
              <div>
                <label class="form-label">Materia</label>
                <select class="form-select" [ngModel]="filtroMateria()" (ngModelChange)="filtroMateria.set($event)">
                  <option value="">Todas</option>
                  @for (m of materias(); track m) {
                    <option [value]="m">{{ m }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label">Estado de la causa</label>
                <select class="form-select" [ngModel]="filtroEstadoCausa()"
                        (ngModelChange)="filtroEstadoCausa.set($event)">
                  <option value="">Todos</option>
                  @for (e of estadosCausa(); track e) {
                    <option [value]="e">{{ e }}</option>
                  }
                </select>
              </div>
            }

            <div>
              <label class="form-label">Fecha desde</label>
              <input type="date" class="form-input" [ngModel]="filtroDesde()" (ngModelChange)="filtroDesde.set($event)" />
            </div>
            <div>
              <label class="form-label">Fecha hasta</label>
              <input type="date" class="form-input" [ngModel]="filtroHasta()" (ngModelChange)="filtroHasta.set($event)" />
            </div>
            <div class="md:col-span-3">
              <p class="text-xs text-neutral-400">{{ ayudaFechas() }}</p>
            </div>
          </div>
        </div>

        @if (mensaje()) {
          <div [class]="mensajeEsError() ? 'alert-danger' : 'alert-success'">
            <span class="flex-1">{{ mensaje() }}</span>
            <button (click)="mensaje.set('')" class="text-current opacity-60 hover:opacity-100">&times;</button>
          </div>
        }

        <!-- Acciones -->
        <div class="card">
          <div class="card-body flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-neutral-500">
              @if (!puedeGenerar()) {
                <span class="text-danger-700">{{ motivoBloqueo() }}</span>
              } @else {
                Al enviar o descargar se guardan primero los cambios del informe.
              }
            </p>
            <div class="flex flex-wrap gap-3">
              <button (click)="guardar()" class="btn-secondary" [disabled]="!puedeGenerar() || ocupado()">
                {{ guardando() ? 'Guardando...' : 'Guardar' }}
              </button>
              <button (click)="descargar()" class="btn-outline" [disabled]="!puedeGenerar() || ocupado()">
                {{ descargando() ? 'Generando...' : 'Descargar' }}
              </button>
              <button (click)="enviar()" class="btn-primary" [disabled]="!puedeGenerar() || ocupado()">
                {{ enviando() ? 'Enviando...' : 'Enviar por correo' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Confirmar cambio de fuente: se pierden los campos elegidos -->
    @if (fuentePendiente(); as pendiente) {
      <div class="modal-backdrop" (click)="fuentePendiente.set(null)">
        <div class="modal-content max-w-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">Cambiar la fuente de datos</h3>
            <button (click)="fuentePendiente.set(null)" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>
          <div class="modal-body">
            <div class="flex items-start gap-3">
              <div class="shrink-0 w-10 h-10 rounded-full bg-warning-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p class="text-sm text-neutral-600 mt-2">
                Los <strong>{{ elegidos().length }} campos</strong> que ya eligi\xF3 y los filtros se descartan,
                porque no existen en la otra fuente. \xBFContin\xFAa?
              </p>
            </div>
          </div>
          <div class="modal-footer">
            <button (click)="fuentePendiente.set(null)" class="btn-secondary">Cancelar</button>
            <button (click)="confirmarCambioFuente(pendiente)" class="btn-warning">S\xED, cambiar</button>
          </div>
        </div>
      </div>
    }
  `
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(ReporteFormComponent, { className: "ReporteFormComponent", filePath: "src/app/features/reportes/reporte-form.component.ts", lineNumber: 323 });
})();
export {
  ReporteFormComponent
};
//# sourceMappingURL=chunk-AYU5E2GH.js.map
