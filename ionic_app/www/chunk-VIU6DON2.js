import {
  RecordatorioModalComponent
} from "./chunk-WXMCI2HJ.js";
import {
  EstadoDiarioService
} from "./chunk-FLTDD2QG.js";
import {
  NotificationService
} from "./chunk-ZKUWYJUU.js";
import "./chunk-M4LO6B3L.js";
import {
  DefaultValueAccessor,
  FormsModule,
  NgControlStatus,
  NgModel
} from "./chunk-2XI3ELAA.js";
import {
  ActivatedRoute,
  Router
} from "./chunk-O3CMZLWV.js";
import {
  CommonModule,
  Component,
  DatePipe,
  inject,
  setClassMetadata,
  signal,
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
  ɵɵpipe,
  ɵɵpipeBind2,
  ɵɵproperty,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
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

// src/app/features/estado-diario/components/movimiento-detail/movimiento-detail.component.ts
var _forTrack0 = ($index, $item) => $item.id;
function MovimientoDetailComponent_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 1);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(1, "svg", 4);
    \u0275\u0275element(2, "circle", 5)(3, "path", 6);
    \u0275\u0275elementEnd()();
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 34);
    \u0275\u0275listener("click", function MovimientoDetailComponent_Conditional_2_Conditional_9_Template_button_click_0_listener() {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.abrirResolver());
    });
    \u0275\u0275text(1, "Marcar como Resuelto");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(2, "button", 35);
    \u0275\u0275listener("click", function MovimientoDetailComponent_Conditional_2_Conditional_9_Template_button_click_2_listener() {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.recordatorioMovimientoId.set(ctx_r1.movimiento().id));
    });
    \u0275\u0275text(3, "Marcar como Pendiente");
    \u0275\u0275elementEnd();
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_70_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 25);
    \u0275\u0275text(1, "Resuelto");
    \u0275\u0275elementEnd();
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_71_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span");
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275classMap(ctx_r1.claseNivel(ctx_r1.movimiento().nivel_pendiente));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1("Pendiente - ", ctx_r1.movimiento().nivel_pendiente, "");
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_72_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 27);
    \u0275\u0275text(1, "No le\xEDdo");
    \u0275\u0275elementEnd();
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_73_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div")(1, "span", 28);
    \u0275\u0275text(2, "Fecha resoluci\xF3n:");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "span", 29);
    \u0275\u0275text(4);
    \u0275\u0275pipe(5, "date");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(\u0275\u0275pipeBind2(5, 1, ctx_r1.movimiento().fecha_leido, "dd/MM/yyyy HH:mm"));
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_74_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div")(1, "span", 19);
    \u0275\u0275text(2, "Observaci\xF3n");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "p", 36);
    \u0275\u0275text(4);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().observacion_resuelto);
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_75_Conditional_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div")(1, "span", 28);
    \u0275\u0275text(2, "Asignado a:");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "span", 29);
    \u0275\u0275text(4);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(3);
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().usuario_pendiente);
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_75_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div")(1, "span", 28);
    \u0275\u0275text(2, "Nivel:");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "span", 37);
    \u0275\u0275text(4);
    \u0275\u0275elementEnd()();
    \u0275\u0275template(5, MovimientoDetailComponent_Conditional_2_Conditional_75_Conditional_5_Template, 5, 1, "div");
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().nivel_pendiente);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r1.movimiento().usuario_pendiente ? 5 : -1);
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_90_Template(rf, ctx) {
  if (rf & 1) {
    const _r4 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 38);
    \u0275\u0275listener("click", function MovimientoDetailComponent_Conditional_2_Conditional_90_Template_button_click_0_listener() {
      \u0275\u0275restoreView(_r4);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.recordatorioMovimientoId.set(ctx_r1.movimiento().id));
    });
    \u0275\u0275text(1, "Nuevo Recordatorio");
    \u0275\u0275elementEnd();
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_10_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span");
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const a_r5 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275classMap(a_r5.enviado ? "badge-success" : "badge-neutral");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", a_r5.enviado ? "Enviado" : "Programado", " ");
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_11_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275text(0, " \u2014 ");
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_13_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 25);
    \u0275\u0275text(1, "Sincronizado");
    \u0275\u0275elementEnd();
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_14_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 41);
    \u0275\u0275text(1, "Error");
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const a_r5 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275property("title", a_r5.google_sync_error);
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_15_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275text(0, " \u2014 ");
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_17_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 27);
    \u0275\u0275text(1, "Finalizado");
    \u0275\u0275elementEnd();
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_18_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 42);
    \u0275\u0275text(1, "Vigente");
    \u0275\u0275elementEnd();
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "tr")(1, "td", 40);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "td");
    \u0275\u0275text(4);
    \u0275\u0275pipe(5, "date");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "td")(7, "span");
    \u0275\u0275text(8);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(9, "td");
    \u0275\u0275template(10, MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_10_Template, 2, 3, "span", 26)(11, MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_11_Template, 1, 0);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(12, "td");
    \u0275\u0275template(13, MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_13_Template, 2, 0, "span", 25)(14, MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_14_Template, 2, 1, "span", 41)(15, MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_15_Template, 1, 0);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(16, "td");
    \u0275\u0275template(17, MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_17_Template, 2, 0, "span", 27)(18, MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Conditional_18_Template, 2, 0, "span", 42);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(19, "td");
    \u0275\u0275text(20);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const a_r5 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext(3);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(a_r5.detalle);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(\u0275\u0275pipeBind2(5, 9, a_r5.fecha_hora, "dd/MM/yyyy"));
    \u0275\u0275advance(3);
    \u0275\u0275classMap(ctx_r1.claseNivel(a_r5.nivel));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(a_r5.nivel);
    \u0275\u0275advance(2);
    \u0275\u0275conditional(a_r5.notificar_whatsapp ? 10 : 11);
    \u0275\u0275advance(3);
    \u0275\u0275conditional(a_r5.google_event_id ? 13 : a_r5.google_sync_error ? 14 : 15);
    \u0275\u0275advance(4);
    \u0275\u0275conditional(a_r5.finalizado ? 17 : 18);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(a_r5.usuario_registro || "-");
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_91_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 32)(1, "table", 39)(2, "thead")(3, "tr")(4, "th");
    \u0275\u0275text(5, "Detalle");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "th");
    \u0275\u0275text(7, "Fecha");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "th");
    \u0275\u0275text(9, "Nivel");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(10, "th");
    \u0275\u0275text(11, "WhatsApp");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(12, "th");
    \u0275\u0275text(13, "Google");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(14, "th");
    \u0275\u0275text(15, "Estado");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(16, "th");
    \u0275\u0275text(17, "Usuario");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(18, "tbody");
    \u0275\u0275repeaterCreate(19, MovimientoDetailComponent_Conditional_2_Conditional_91_For_20_Template, 21, 12, "tr", null, _forTrack0);
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(19);
    \u0275\u0275repeater(ctx_r1.agendas());
  }
}
function MovimientoDetailComponent_Conditional_2_Conditional_92_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 33);
    \u0275\u0275text(1, " No hay recordatorios ");
    \u0275\u0275elementEnd();
  }
}
function MovimientoDetailComponent_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 7)(1, "div")(2, "button", 8);
    \u0275\u0275listener("click", function MovimientoDetailComponent_Conditional_2_Template_button_click_2_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.goBack());
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(3, "svg", 9);
    \u0275\u0275element(4, "path", 10);
    \u0275\u0275elementEnd();
    \u0275\u0275text(5, " Volver ");
    \u0275\u0275elementEnd();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(6, "h1", 11);
    \u0275\u0275text(7);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(8, "div", 12);
    \u0275\u0275template(9, MovimientoDetailComponent_Conditional_2_Conditional_9_Template, 4, 0);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(10, "div", 13)(11, "div", 14)(12, "div", 15)(13, "h3", 16);
    \u0275\u0275text(14, "Informaci\xF3n General");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(15, "div", 17)(16, "dl", 18)(17, "div")(18, "dt", 19);
    \u0275\u0275text(19, "Rol");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(20, "dd", 20);
    \u0275\u0275text(21);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(22, "div")(23, "dt", 19);
    \u0275\u0275text(24, "Rol \xDAnico");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(25, "dd", 20);
    \u0275\u0275text(26);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(27, "div", 21)(28, "dt", 19);
    \u0275\u0275text(29, "Caratulado");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(30, "dd", 20);
    \u0275\u0275text(31);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(32, "div")(33, "dt", 19);
    \u0275\u0275text(34, "Tribunal");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(35, "dd", 20);
    \u0275\u0275text(36);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(37, "div")(38, "dt", 19);
    \u0275\u0275text(39, "Jurisdicci\xF3n");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(40, "dd", 20);
    \u0275\u0275text(41);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(42, "div")(43, "dt", 19);
    \u0275\u0275text(44, "Tipo Causa");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(45, "dd", 20);
    \u0275\u0275text(46);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(47, "div")(48, "dt", 19);
    \u0275\u0275text(49, "Fecha Ingreso");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(50, "dd", 20);
    \u0275\u0275text(51);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(52, "div")(53, "dt", 19);
    \u0275\u0275text(54, "Ubicaci\xF3n");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(55, "dd", 20);
    \u0275\u0275text(56);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(57, "div")(58, "dt", 19);
    \u0275\u0275text(59, "Corte");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(60, "dd", 20);
    \u0275\u0275text(61);
    \u0275\u0275elementEnd()()()()();
    \u0275\u0275elementStart(62, "div", 14)(63, "div", 15)(64, "h3", 16);
    \u0275\u0275text(65, "Estado");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(66, "div", 22)(67, "div", 23)(68, "span", 24);
    \u0275\u0275text(69, "Estado:");
    \u0275\u0275elementEnd();
    \u0275\u0275template(70, MovimientoDetailComponent_Conditional_2_Conditional_70_Template, 2, 0, "span", 25)(71, MovimientoDetailComponent_Conditional_2_Conditional_71_Template, 2, 3, "span", 26)(72, MovimientoDetailComponent_Conditional_2_Conditional_72_Template, 2, 0, "span", 27);
    \u0275\u0275elementEnd();
    \u0275\u0275template(73, MovimientoDetailComponent_Conditional_2_Conditional_73_Template, 6, 4, "div")(74, MovimientoDetailComponent_Conditional_2_Conditional_74_Template, 5, 1, "div")(75, MovimientoDetailComponent_Conditional_2_Conditional_75_Template, 6, 2);
    \u0275\u0275elementStart(76, "div")(77, "span", 28);
    \u0275\u0275text(78, "RUT:");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(79, "span", 29);
    \u0275\u0275text(80);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(81, "div")(82, "span", 28);
    \u0275\u0275text(83, "Fecha Estado Diario:");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(84, "span", 29);
    \u0275\u0275text(85);
    \u0275\u0275elementEnd()()()()();
    \u0275\u0275elementStart(86, "div", 14)(87, "div", 30)(88, "h3", 16);
    \u0275\u0275text(89, "Recordatorios");
    \u0275\u0275elementEnd();
    \u0275\u0275template(90, MovimientoDetailComponent_Conditional_2_Conditional_90_Template, 2, 0, "button", 31);
    \u0275\u0275elementEnd();
    \u0275\u0275template(91, MovimientoDetailComponent_Conditional_2_Conditional_91_Template, 21, 0, "div", 32)(92, MovimientoDetailComponent_Conditional_2_Conditional_92_Template, 2, 0, "div", 33);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(7);
    \u0275\u0275textInterpolate1("Detalle del Estado Diario #", ctx_r1.movimiento().id, "");
    \u0275\u0275advance(2);
    \u0275\u0275conditional(!ctx_r1.movimiento().leido ? 9 : -1);
    \u0275\u0275advance(12);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().rol || "-");
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().rol_unico || "-");
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().caratulado || "-");
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().tribunal || "-");
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().jurisdiccion || "-");
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().tipo_causa || "-");
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().fecha_ingreso || "-");
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().ubicacion || "-");
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().corte || "-");
    \u0275\u0275advance(9);
    \u0275\u0275conditional(ctx_r1.movimiento().leido ? 70 : ctx_r1.movimiento().pendiente ? 71 : 72);
    \u0275\u0275advance(3);
    \u0275\u0275conditional(ctx_r1.movimiento().leido && ctx_r1.movimiento().fecha_leido ? 73 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r1.movimiento().observacion_resuelto ? 74 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r1.movimiento().pendiente ? 75 : -1);
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().rut || "-");
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(ctx_r1.movimiento().fecha_estado_diario || "-");
    \u0275\u0275advance(5);
    \u0275\u0275conditional(!ctx_r1.movimiento().leido ? 90 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r1.agendas().length > 0 ? 91 : 92);
  }
}
function MovimientoDetailComponent_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    const _r6 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 43);
    \u0275\u0275listener("click", function MovimientoDetailComponent_Conditional_4_Template_div_click_0_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cancelarResolver());
    });
    \u0275\u0275elementStart(1, "div", 44);
    \u0275\u0275listener("click", function MovimientoDetailComponent_Conditional_4_Template_div_click_1_listener($event) {
      \u0275\u0275restoreView(_r6);
      return \u0275\u0275resetView($event.stopPropagation());
    });
    \u0275\u0275elementStart(2, "div", 45)(3, "h3", 16);
    \u0275\u0275text(4, "Marcar como resuelto");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "button", 46);
    \u0275\u0275listener("click", function MovimientoDetailComponent_Conditional_4_Template_button_click_5_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cancelarResolver());
    });
    \u0275\u0275text(6, "\xD7");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(7, "div", 47)(8, "div", 48)(9, "div", 49);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(10, "svg", 50);
    \u0275\u0275element(11, "path", 51);
    \u0275\u0275elementEnd()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(12, "p", 52);
    \u0275\u0275text(13, " \xBFConfirma que quiere marcar este registro como ");
    \u0275\u0275elementStart(14, "strong");
    \u0275\u0275text(15, "resuelto");
    \u0275\u0275elementEnd();
    \u0275\u0275text(16, "? ");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(17, "div")(18, "label", 53);
    \u0275\u0275text(19, "Observaci\xF3n (opcional)");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(20, "textarea", 54);
    \u0275\u0275twoWayListener("ngModelChange", function MovimientoDetailComponent_Conditional_4_Template_textarea_ngModelChange_20_listener($event) {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r1.observacionResuelto, $event) || (ctx_r1.observacionResuelto = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(21, "p", 55);
    \u0275\u0275text(22, "Queda registrada junto con la resoluci\xF3n.");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(23, "div", 56)(24, "button", 57);
    \u0275\u0275listener("click", function MovimientoDetailComponent_Conditional_4_Template_button_click_24_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cancelarResolver());
    });
    \u0275\u0275text(25, "Cancelar");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(26, "button", 58);
    \u0275\u0275listener("click", function MovimientoDetailComponent_Conditional_4_Template_button_click_26_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.onMarcarLeido());
    });
    \u0275\u0275text(27);
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(20);
    \u0275\u0275twoWayProperty("ngModel", ctx_r1.observacionResuelto);
    \u0275\u0275advance(4);
    \u0275\u0275property("disabled", ctx_r1.confirmandoResolver());
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r1.confirmandoResolver());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r1.confirmandoResolver() ? "Guardando..." : "S\xED, marcar resuelto", " ");
  }
}
var MovimientoDetailComponent = class _MovimientoDetailComponent {
  service = inject(EstadoDiarioService);
  notification = inject(NotificationService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  movimiento = signal(null);
  agendas = signal([]);
  loading = signal(true);
  /** id del registro para el que se abre el modal "Marcar como pendiente"; null = cerrado */
  recordatorioMovimientoId = signal(null);
  confirmarResolver = signal(false);
  confirmandoResolver = signal(false);
  /** Comentario opcional que acompaña al "resuelto" */
  observacionResuelto = "";
  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get("id"));
    this.loadDetalle(id);
    this.loadAgendas(id);
  }
  loadDetalle(id) {
    this.service.getMovimientoDetalle(id).subscribe({
      next: (res) => {
        this.movimiento.set(res.movimiento);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error("Error al cargar detalle");
      }
    });
  }
  loadAgendas(id) {
    this.service.getAgendas(id).subscribe({
      next: (res) => this.agendas.set(res.agendas)
    });
  }
  goBack() {
    this.router.navigate(["/estado-diario/movimientos"]);
  }
  claseNivel(nivel) {
    if (nivel === "alto")
      return "badge-danger";
    if (nivel === "medio")
      return "badge-yellow";
    return "badge-orange";
  }
  abrirResolver() {
    this.observacionResuelto = "";
    this.confirmarResolver.set(true);
  }
  cancelarResolver() {
    if (this.confirmandoResolver())
      return;
    this.observacionResuelto = "";
    this.confirmarResolver.set(false);
  }
  onMarcarLeido() {
    const id = this.movimiento().id;
    this.confirmandoResolver.set(true);
    this.service.marcarLeido(id, this.observacionResuelto).subscribe({
      next: () => {
        this.confirmandoResolver.set(false);
        this.confirmarResolver.set(false);
        this.observacionResuelto = "";
        this.notification.success("Marcado como resuelto");
        this.loadDetalle(id);
      },
      error: () => {
        this.confirmandoResolver.set(false);
        this.notification.error("Error al marcar como resuelto");
      }
    });
  }
  onRecordatorioGuardado() {
    const id = this.movimiento().id;
    this.recordatorioMovimientoId.set(null);
    this.loadDetalle(id);
    this.loadAgendas(id);
  }
  static \u0275fac = function MovimientoDetailComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _MovimientoDetailComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _MovimientoDetailComponent, selectors: [["app-movimiento-detail"]], decls: 5, vars: 3, consts: [[1, "space-y-6"], [1, "flex", "items-center", "justify-center", "py-20"], [3, "cerrado", "guardado", "movimientoId"], [1, "modal-backdrop"], ["viewBox", "0 0 24 24", 1, "animate-spin", "h-10", "w-10", "text-primary-600"], ["cx", "12", "cy", "12", "r", "10", "stroke", "currentColor", "stroke-width", "4", "fill", "none", 1, "opacity-25"], ["fill", "currentColor", "d", "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z", 1, "opacity-75"], [1, "flex", "items-center", "justify-between", "flex-wrap", "gap-4"], [1, "text-primary-600", "hover:text-primary-800", "text-sm", "mb-2", "inline-flex", "items-center", "gap-1", 3, "click"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-4", "h-4"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M15 19l-7-7 7-7"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "flex", "gap-2"], [1, "grid", "grid-cols-1", "lg:grid-cols-2", "gap-6"], [1, "card"], [1, "card-header"], [1, "text-lg", "font-semibold"], [1, "card-body"], [1, "grid", "grid-cols-2", "gap-4"], [1, "text-xs", "text-neutral-500", "uppercase"], [1, "font-medium", "mt-0.5"], [1, "col-span-2"], [1, "card-body", "space-y-4"], [1, "flex", "items-center", "gap-3"], [1, "text-sm", "text-neutral-500"], [1, "badge-success"], [3, "class"], [1, "badge-neutral"], [1, "text-xs", "text-neutral-500"], [1, "text-sm", "ml-2"], [1, "card-header", "flex", "items-center", "justify-between"], [1, "btn-outline", "btn-sm"], [1, "table-wrapper"], [1, "card-body", "text-center", "text-neutral-400", "py-8"], [1, "btn-success", 3, "click"], [1, "btn-warning", 3, "click"], [1, "text-sm", "text-neutral-700", "mt-1", "whitespace-pre-line"], [1, "text-sm", "ml-2", "font-medium"], [1, "btn-outline", "btn-sm", 3, "click"], [1, "data-table"], [1, "max-w-[250px]", "whitespace-normal"], [1, "badge-danger", 3, "title"], [1, "badge-info"], [1, "modal-backdrop", 3, "click"], [1, "modal-content", "max-w-sm", 3, "click"], [1, "modal-header"], [1, "text-neutral-400", "hover:text-neutral-600", 3, "click"], [1, "modal-body", "space-y-4"], [1, "flex", "items-start", "gap-3"], [1, "shrink-0", "w-10", "h-10", "rounded-full", "bg-accent-100", "flex", "items-center", "justify-center"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-5", "h-5", "text-accent-600"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"], [1, "text-sm", "text-neutral-600", "mt-2"], [1, "form-label"], ["rows", "3", "placeholder", "Ej: se present\xF3 escrito el 12-08-2026", 1, "form-input", 3, "ngModelChange", "ngModel"], [1, "text-xs", "text-neutral-400", "mt-1"], [1, "modal-footer"], [1, "btn-secondary", 3, "click", "disabled"], [1, "btn-success", 3, "click", "disabled"]], template: function MovimientoDetailComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0);
      \u0275\u0275template(1, MovimientoDetailComponent_Conditional_1_Template, 4, 0, "div", 1)(2, MovimientoDetailComponent_Conditional_2_Template, 93, 19);
      \u0275\u0275elementStart(3, "app-recordatorio-modal", 2);
      \u0275\u0275listener("cerrado", function MovimientoDetailComponent_Template_app_recordatorio_modal_cerrado_3_listener() {
        return ctx.recordatorioMovimientoId.set(null);
      })("guardado", function MovimientoDetailComponent_Template_app_recordatorio_modal_guardado_3_listener() {
        return ctx.onRecordatorioGuardado();
      });
      \u0275\u0275elementEnd();
      \u0275\u0275template(4, MovimientoDetailComponent_Conditional_4_Template, 28, 4, "div", 3);
      \u0275\u0275elementEnd();
    }
    if (rf & 2) {
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.loading() ? 1 : ctx.movimiento() ? 2 : -1);
      \u0275\u0275advance(2);
      \u0275\u0275property("movimientoId", ctx.recordatorioMovimientoId());
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.confirmarResolver() ? 4 : -1);
    }
  }, dependencies: [CommonModule, DatePipe, FormsModule, DefaultValueAccessor, NgControlStatus, NgModel, RecordatorioModalComponent], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MovimientoDetailComponent, [{
    type: Component,
    args: [{
      selector: "app-movimiento-detail",
      standalone: true,
      imports: [CommonModule, FormsModule, RecordatorioModalComponent],
      template: `
    <div class="space-y-6">
      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      } @else if (movimiento()) {
        <!-- Header -->
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <button (click)="goBack()" class="text-primary-600 hover:text-primary-800 text-sm mb-2 inline-flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <h1 class="text-2xl font-bold text-neutral-800">Detalle del Estado Diario #{{ movimiento()!.id }}</h1>
          </div>
          <div class="flex gap-2">
            @if (!movimiento()!.leido) {
              <button (click)="abrirResolver()" class="btn-success">Marcar como Resuelto</button>
              <!-- Marcar pendiente y agendar son una sola acci\xF3n: el modal de
                   recordatorio deja el registro pendiente con el nivel elegido ah\xED. -->
              <button (click)="recordatorioMovimientoId.set(movimiento()!.id)" class="btn-warning">Marcar como Pendiente</button>
            }
          </div>
        </div>

        <!-- Detail Card -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card">
            <div class="card-header">
              <h3 class="text-lg font-semibold">Informaci\xF3n General</h3>
            </div>
            <div class="card-body">
              <dl class="grid grid-cols-2 gap-4">
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Rol</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.rol || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Rol \xDAnico</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.rol_unico || '-' }}</dd>
                </div>
                <div class="col-span-2">
                  <dt class="text-xs text-neutral-500 uppercase">Caratulado</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.caratulado || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Tribunal</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.tribunal || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Jurisdicci\xF3n</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.jurisdiccion || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Tipo Causa</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.tipo_causa || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Fecha Ingreso</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.fecha_ingreso || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Ubicaci\xF3n</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.ubicacion || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-neutral-500 uppercase">Corte</dt>
                  <dd class="font-medium mt-0.5">{{ movimiento()!.corte || '-' }}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="text-lg font-semibold">Estado</h3>
            </div>
            <div class="card-body space-y-4">
              <div class="flex items-center gap-3">
                <span class="text-sm text-neutral-500">Estado:</span>
                @if (movimiento()!.leido) {
                  <span class="badge-success">Resuelto</span>
                } @else if (movimiento()!.pendiente) {
                  <span [class]="claseNivel(movimiento()!.nivel_pendiente)">Pendiente - {{ movimiento()!.nivel_pendiente }}</span>
                } @else {
                  <span class="badge-neutral">No le\xEDdo</span>
                }
              </div>

              @if (movimiento()!.leido && movimiento()!.fecha_leido) {
                <div>
                  <span class="text-xs text-neutral-500">Fecha resoluci\xF3n:</span>
                  <span class="text-sm ml-2">{{ movimiento()!.fecha_leido | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
              }

              @if (movimiento()!.observacion_resuelto) {
                <div>
                  <span class="text-xs text-neutral-500 uppercase">Observaci\xF3n</span>
                  <p class="text-sm text-neutral-700 mt-1 whitespace-pre-line">{{ movimiento()!.observacion_resuelto }}</p>
                </div>
              }

              @if (movimiento()!.pendiente) {
                <div>
                  <span class="text-xs text-neutral-500">Nivel:</span>
                  <span class="text-sm ml-2 font-medium">{{ movimiento()!.nivel_pendiente }}</span>
                </div>
                @if (movimiento()!.usuario_pendiente) {
                  <div>
                    <span class="text-xs text-neutral-500">Asignado a:</span>
                    <span class="text-sm ml-2">{{ movimiento()!.usuario_pendiente }}</span>
                  </div>
                }
              }

              <div>
                <span class="text-xs text-neutral-500">RUT:</span>
                <span class="text-sm ml-2">{{ movimiento()!.rut || '-' }}</span>
              </div>
              <div>
                <span class="text-xs text-neutral-500">Fecha Estado Diario:</span>
                <span class="text-sm ml-2">{{ movimiento()!.fecha_estado_diario || '-' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Recordatorios -->
        <div class="card">
          <div class="card-header flex items-center justify-between">
            <h3 class="text-lg font-semibold">Recordatorios</h3>
            @if (!movimiento()!.leido) {
              <button (click)="recordatorioMovimientoId.set(movimiento()!.id)" class="btn-outline btn-sm">Nuevo Recordatorio</button>
            }
          </div>
          @if (agendas().length > 0) {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Detalle</th>
                    <th>Fecha</th>
                    <th>Nivel</th>
                    <th>WhatsApp</th>
                    <th>Google</th>
                    <th>Estado</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of agendas(); track a.id) {
                    <tr>
                      <td class="max-w-[250px] whitespace-normal">{{ a.detalle }}</td>
                      <td>{{ a.fecha_hora | date:'dd/MM/yyyy' }}</td>
                      <td><span [class]="claseNivel(a.nivel)">{{ a.nivel }}</span></td>
                      <td>
                        @if (a.notificar_whatsapp) {
                          <span [class]="a.enviado ? 'badge-success' : 'badge-neutral'">
                            {{ a.enviado ? 'Enviado' : 'Programado' }}
                          </span>
                        } @else { \u2014 }
                      </td>
                      <td>
                        @if (a.google_event_id) {
                          <span class="badge-success">Sincronizado</span>
                        } @else if (a.google_sync_error) {
                          <span class="badge-danger" [title]="a.google_sync_error">Error</span>
                        } @else { \u2014 }
                      </td>
                      <td>
                        @if (a.finalizado) {
                          <span class="badge-neutral">Finalizado</span>
                        } @else {
                          <span class="badge-info">Vigente</span>
                        }
                      </td>
                      <td>{{ a.usuario_registro || '-' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="card-body text-center text-neutral-400 py-8">
              No hay recordatorios
            </div>
          }
        </div>
      }

      <app-recordatorio-modal
        [movimientoId]="recordatorioMovimientoId()"
        (cerrado)="recordatorioMovimientoId.set(null)"
        (guardado)="onRecordatorioGuardado()"
      />

      <!-- Confirmar "Resolver" -->
      @if (confirmarResolver()) {
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
              <button (click)="onMarcarLeido()" class="btn-success" [disabled]="confirmandoResolver()">
                {{ confirmandoResolver() ? 'Guardando...' : 'S\xED, marcar resuelto' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(MovimientoDetailComponent, { className: "MovimientoDetailComponent", filePath: "src/app/features/estado-diario/components/movimiento-detail/movimiento-detail.component.ts", lineNumber: 255 });
})();
export {
  MovimientoDetailComponent
};
//# sourceMappingURL=chunk-VIU6DON2.js.map
