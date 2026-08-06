import {
  AudienciaService
} from "./chunk-IYRFMHMF.js";
import {
  EstadoDiarioService
} from "./chunk-FLTDD2QG.js";
import {
  NotificationService
} from "./chunk-ZKUWYJUU.js";
import {
  Router
} from "./chunk-O3CMZLWV.js";
import {
  CommonModule,
  Component,
  DatePipe,
  computed,
  inject,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵadvance,
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
  ɵɵpipe,
  ɵɵpipeBind2,
  ɵɵproperty,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵrepeaterTrackByIdentity,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtemplate,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate2
} from "./chunk-WMIGZGXS.js";
import "./chunk-XWLXMCJQ.js";

// src/app/features/calendario/calendario.component.ts
var _forTrack0 = ($index, $item) => $item.key;
var _forTrack1 = ($index, $item) => $item.id;
function CalendarioComponent_Conditional_23_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 15);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(1, "svg", 18);
    \u0275\u0275element(2, "circle", 19)(3, "path", 20);
    \u0275\u0275elementEnd()();
  }
}
function CalendarioComponent_Conditional_24_For_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 22);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const d_r1 = ctx.$implicit;
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(d_r1);
  }
}
function CalendarioComponent_Conditional_24_For_6_For_6_Template(rf, ctx) {
  if (rf & 1) {
    const _r2 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 31);
    \u0275\u0275listener("click", function CalendarioComponent_Conditional_24_For_6_For_6_Template_button_click_0_listener() {
      const a_r3 = \u0275\u0275restoreView(_r2).$implicit;
      const ctx_r3 = \u0275\u0275nextContext(3);
      return \u0275\u0275resetView(ctx_r3.verAudiencias(a_r3));
    });
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const a_r3 = ctx.$implicit;
    const ctx_r3 = \u0275\u0275nextContext(3);
    \u0275\u0275property("title", ctx_r3.tituloAudiencia(a_r3));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate2("", ctx_r3.fmtHora(a_r3.hora), " ", a_r3.caratulado || a_r3.rol || a_r3.ruc, "");
  }
}
function CalendarioComponent_Conditional_24_For_6_For_8_Template(rf, ctx) {
  if (rf & 1) {
    const _r5 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 32);
    \u0275\u0275listener("click", function CalendarioComponent_Conditional_24_For_6_For_8_Template_button_click_0_listener() {
      const r_r6 = \u0275\u0275restoreView(_r5).$implicit;
      const ctx_r3 = \u0275\u0275nextContext(3);
      return \u0275\u0275resetView(ctx_r3.abrirDetalle(r_r6));
    });
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const r_r6 = ctx.$implicit;
    const ctx_r3 = \u0275\u0275nextContext(3);
    \u0275\u0275classMap(ctx_r3.claseChip(r_r6.nivel));
    \u0275\u0275property("title", r_r6.movimiento_caratulado || r_r6.detalle);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(r_r6.movimiento_rol || r_r6.movimiento_caratulado || r_r6.detalle);
  }
}
function CalendarioComponent_Conditional_24_For_6_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 25)(1, "div", 26)(2, "span", 27);
    \u0275\u0275text(3);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(4, "div", 28);
    \u0275\u0275repeaterCreate(5, CalendarioComponent_Conditional_24_For_6_For_6_Template, 2, 3, "button", 29, _forTrack1);
    \u0275\u0275repeaterCreate(7, CalendarioComponent_Conditional_24_For_6_For_8_Template, 2, 4, "button", 30, _forTrack1);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const dia_r7 = ctx.$implicit;
    \u0275\u0275classProp("bg-neutral-50", !dia_r7.delMes);
    \u0275\u0275advance(2);
    \u0275\u0275classMap(dia_r7.esHoy ? "bg-primary-600 text-white" : dia_r7.delMes ? "text-neutral-700" : "text-neutral-400");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(dia_r7.fecha.getDate());
    \u0275\u0275advance(2);
    \u0275\u0275repeater(dia_r7.audiencias);
    \u0275\u0275advance(2);
    \u0275\u0275repeater(dia_r7.recordatorios);
  }
}
function CalendarioComponent_Conditional_24_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 16)(1, "div", 21);
    \u0275\u0275repeaterCreate(2, CalendarioComponent_Conditional_24_For_3_Template, 2, 1, "div", 22, \u0275\u0275repeaterTrackByIdentity);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(4, "div", 23);
    \u0275\u0275repeaterCreate(5, CalendarioComponent_Conditional_24_For_6_Template, 9, 5, "div", 24, _forTrack0);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r3.diasSemana);
    \u0275\u0275advance(3);
    \u0275\u0275repeater(ctx_r3.dias());
  }
}
function CalendarioComponent_Conditional_25_Conditional_29_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div")(1, "span", 48);
    \u0275\u0275text(2, "Registrado por:");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "span", 49);
    \u0275\u0275text(4);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const r_r9 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(r_r9.usuario_registro);
  }
}
function CalendarioComponent_Conditional_25_Conditional_30_Template(rf, ctx) {
  if (rf & 1) {
    const _r10 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 46)(1, "button", 50);
    \u0275\u0275listener("click", function CalendarioComponent_Conditional_25_Conditional_30_Template_button_click_1_listener() {
      \u0275\u0275restoreView(_r10);
      const ctx_r3 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r3.confirmandoFinalizar.set(true));
    });
    \u0275\u0275text(2, "Finalizar recordatorio");
    \u0275\u0275elementEnd()();
  }
}
function CalendarioComponent_Conditional_25_Conditional_31_Template(rf, ctx) {
  if (rf & 1) {
    const _r11 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 47)(1, "p", 51);
    \u0275\u0275text(2, "\xBFMarcar tambi\xE9n el registro como resuelto?");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "div", 52)(4, "button", 53);
    \u0275\u0275listener("click", function CalendarioComponent_Conditional_25_Conditional_31_Template_button_click_4_listener() {
      \u0275\u0275restoreView(_r11);
      const ctx_r3 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r3.finalizar(true));
    });
    \u0275\u0275text(5, " S\xED, marcar como resuelto ");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "button", 54);
    \u0275\u0275listener("click", function CalendarioComponent_Conditional_25_Conditional_31_Template_button_click_6_listener() {
      \u0275\u0275restoreView(_r11);
      const ctx_r3 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r3.finalizar(false));
    });
    \u0275\u0275text(7, " No, solo finalizar el recordatorio ");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "button", 55);
    \u0275\u0275listener("click", function CalendarioComponent_Conditional_25_Conditional_31_Template_button_click_8_listener() {
      \u0275\u0275restoreView(_r11);
      const ctx_r3 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r3.confirmandoFinalizar.set(false));
    });
    \u0275\u0275text(9, " Cancelar ");
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r3 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(4);
    \u0275\u0275property("disabled", ctx_r3.finalizando());
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r3.finalizando());
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r3.finalizando());
  }
}
function CalendarioComponent_Conditional_25_Template(rf, ctx) {
  if (rf & 1) {
    const _r8 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 33);
    \u0275\u0275listener("click", function CalendarioComponent_Conditional_25_Template_div_click_0_listener() {
      \u0275\u0275restoreView(_r8);
      const ctx_r3 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r3.cerrarDetalle());
    });
    \u0275\u0275elementStart(1, "div", 34);
    \u0275\u0275listener("click", function CalendarioComponent_Conditional_25_Template_div_click_1_listener($event) {
      \u0275\u0275restoreView(_r8);
      return \u0275\u0275resetView($event.stopPropagation());
    });
    \u0275\u0275elementStart(2, "div", 35)(3, "h3", 36);
    \u0275\u0275text(4, "Recordatorio");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "button", 37);
    \u0275\u0275listener("click", function CalendarioComponent_Conditional_25_Template_button_click_5_listener() {
      \u0275\u0275restoreView(_r8);
      const ctx_r3 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r3.cerrarDetalle());
    });
    \u0275\u0275text(6, "\xD7");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(7, "div", 38)(8, "div", 7)(9, "span", 39);
    \u0275\u0275text(10);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(11, "span", 40);
    \u0275\u0275text(12);
    \u0275\u0275pipe(13, "date");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(14, "div")(15, "span", 41);
    \u0275\u0275text(16, "Detalle");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(17, "p", 42);
    \u0275\u0275text(18);
    \u0275\u0275elementEnd()();
    \u0275\u0275element(19, "hr", 43);
    \u0275\u0275elementStart(20, "div")(21, "span", 41);
    \u0275\u0275text(22, "Estado Diario");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(23, "p", 44);
    \u0275\u0275text(24);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(25, "p", 40);
    \u0275\u0275text(26);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(27, "button", 45);
    \u0275\u0275listener("click", function CalendarioComponent_Conditional_25_Template_button_click_27_listener() {
      const r_r9 = \u0275\u0275restoreView(_r8);
      const ctx_r3 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r3.verMovimiento(r_r9));
    });
    \u0275\u0275text(28, " Ver detalle del registro \u2192 ");
    \u0275\u0275elementEnd()();
    \u0275\u0275template(29, CalendarioComponent_Conditional_25_Conditional_29_Template, 5, 1, "div")(30, CalendarioComponent_Conditional_25_Conditional_30_Template, 3, 0, "div", 46)(31, CalendarioComponent_Conditional_25_Conditional_31_Template, 10, 3, "div", 47);
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const r_r9 = ctx;
    const ctx_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance(9);
    \u0275\u0275classMap(ctx_r3.claseChip(r_r9.nivel));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(r_r9.nivel);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(\u0275\u0275pipeBind2(13, 10, r_r9.fecha_hora, "dd/MM/yyyy"));
    \u0275\u0275advance(6);
    \u0275\u0275textInterpolate(r_r9.detalle);
    \u0275\u0275advance(6);
    \u0275\u0275textInterpolate(r_r9.movimiento_caratulado || "-");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate2("", r_r9.movimiento_rol || "-", " \xB7 ", r_r9.movimiento_tribunal || "-", "");
    \u0275\u0275advance(3);
    \u0275\u0275conditional(r_r9.usuario_registro ? 29 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(!ctx_r3.confirmandoFinalizar() ? 30 : 31);
  }
}
var DIAS_SEMANA = ["Lun", "Mar", "Mi\xE9", "Jue", "Vie", "S\xE1b", "Dom"];
var MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];
function claveDia(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
var CalendarioComponent = class _CalendarioComponent {
  service = inject(EstadoDiarioService);
  audienciaService = inject(AudienciaService);
  notification = inject(NotificationService);
  router = inject(Router);
  diasSemana = DIAS_SEMANA;
  loading = signal(true);
  recordatorios = signal([]);
  audiencias = signal([]);
  mesActual = signal(this.primerDiaDelMes(/* @__PURE__ */ new Date()));
  seleccionado = signal(null);
  confirmandoFinalizar = signal(false);
  finalizando = signal(false);
  porDia = computed(() => {
    const mapa = /* @__PURE__ */ new Map();
    for (const r of this.recordatorios()) {
      const key = r.fecha_hora.slice(0, 10);
      const lista = mapa.get(key) ?? [];
      lista.push(r);
      mapa.set(key, lista);
    }
    return mapa;
  });
  audienciasPorDia = computed(() => {
    const mapa = /* @__PURE__ */ new Map();
    for (const a of this.audiencias()) {
      const key = a.fecha_audiencia.slice(0, 10);
      const lista = mapa.get(key) ?? [];
      lista.push(a);
      mapa.set(key, lista);
    }
    return mapa;
  });
  nombreMes = computed(() => MESES[this.mesActual().getMonth()]);
  dias = computed(() => {
    const mes = this.mesActual();
    const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const offset = (primerDia.getDay() + 6) % 7;
    const inicio = new Date(primerDia);
    inicio.setDate(inicio.getDate() - offset);
    const hoy = claveDia(/* @__PURE__ */ new Date());
    const mapa = this.porDia();
    const mapaAudiencias = this.audienciasPorDia();
    const celdas = [];
    for (let i = 0; i < 42; i++) {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + i);
      const key = claveDia(fecha);
      celdas.push({
        fecha,
        key,
        delMes: fecha.getMonth() === mes.getMonth(),
        esHoy: key === hoy,
        recordatorios: mapa.get(key) ?? [],
        audiencias: mapaAudiencias.get(key) ?? []
      });
    }
    return celdas;
  });
  ngOnInit() {
    this.cargar();
    this.cargarAudiencias();
  }
  primerDiaDelMes(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  cargar() {
    this.loading.set(true);
    this.service.getCalendario().subscribe({
      next: (res) => {
        this.recordatorios.set(res.recordatorios);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error("No se pudo cargar el calendario");
      }
    });
  }
  /**
   * Las audiencias se cargan por ventana, a diferencia de los recordatorios
   * vigentes que se traen enteros una sola vez: son un conjunto que crece sin
   * techo (cada archivo semanal suma) y traerlas todas engordaría la respuesta
   * mes a mes. La ventana es la misma grilla de 42 celdas que se está pintando.
   */
  cargarAudiencias() {
    const mes = this.mesActual();
    const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const inicio = new Date(primerDia);
    inicio.setDate(inicio.getDate() - (primerDia.getDay() + 6) % 7);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 41);
    this.audienciaService.getCalendario(claveDia(inicio), claveDia(fin)).subscribe({
      next: (res) => this.audiencias.set(res.audiencias),
      // Silencioso a propósito: el calendario sigue siendo útil con los
      // recordatorios, y ya hay un error visible si falla la carga principal.
      error: () => this.audiencias.set([])
    });
  }
  mesAnterior() {
    const m = this.mesActual();
    this.mesActual.set(new Date(m.getFullYear(), m.getMonth() - 1, 1));
    this.cargarAudiencias();
  }
  mesSiguiente() {
    const m = this.mesActual();
    this.mesActual.set(new Date(m.getFullYear(), m.getMonth() + 1, 1));
    this.cargarAudiencias();
  }
  irAHoy() {
    this.mesActual.set(this.primerDiaDelMes(/* @__PURE__ */ new Date()));
    this.cargarAudiencias();
  }
  /** "10:00:00" -> "10:00". La hoja Penal puede venir sin hora. */
  fmtHora(valor) {
    return valor ? valor.slice(0, 5) : "";
  }
  tituloAudiencia(a) {
    return [
      a.tipo_audiencia,
      a.caratulado || a.rol || a.ruc,
      a.tribunal,
      a.sala
    ].filter((p) => !!p && String(p).trim() !== "").join(" \xB7 ");
  }
  /** El detalle de una audiencia vive en su módulo; el calendario solo la anuncia. */
  verAudiencias(a) {
    this.router.navigate(["/audiencias"], {
      queryParams: { busqueda: a.rol || a.ruc || a.caratulado }
    });
  }
  /** Colores por nivel de urgencia: bajo = naranjo, medio = amarillo, alto = rojo. */
  claseChip(nivel) {
    if (nivel === "alto")
      return "badge-danger";
    if (nivel === "medio")
      return "badge-yellow";
    return "badge-orange";
  }
  abrirDetalle(r) {
    this.seleccionado.set(r);
    this.confirmandoFinalizar.set(false);
  }
  cerrarDetalle() {
    if (this.finalizando())
      return;
    this.seleccionado.set(null);
    this.confirmandoFinalizar.set(false);
  }
  verMovimiento(r) {
    this.router.navigate(["/estado-diario", r.estado_diario_id]);
  }
  finalizar(marcarResuelto) {
    const r = this.seleccionado();
    if (!r)
      return;
    this.finalizando.set(true);
    this.service.finalizarAgenda(r.id, { marcar_resuelto: marcarResuelto }).subscribe({
      next: () => {
        this.finalizando.set(false);
        this.notification.success(marcarResuelto ? "Recordatorio finalizado y registro marcado como resuelto" : "Recordatorio finalizado");
        this.recordatorios.set(this.recordatorios().filter((x) => x.id !== r.id));
        this.seleccionado.set(null);
        this.confirmandoFinalizar.set(false);
      },
      error: (err) => {
        this.finalizando.set(false);
        this.notification.error(err.error?.detail || "No se pudo finalizar el recordatorio");
      }
    });
  }
  static \u0275fac = function CalendarioComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _CalendarioComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _CalendarioComponent, selectors: [["app-calendario"]], decls: 26, vars: 4, consts: [[1, "space-y-6"], [1, "flex", "items-center", "justify-between", "flex-wrap", "gap-4"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "flex", "items-center", "gap-4", "mt-1", "text-xs", "text-neutral-500"], [1, "flex", "items-center", "gap-1.5"], [1, "w-2.5", "h-2.5", "rounded-sm", "bg-primary-500"], [1, "w-2.5", "h-2.5", "rounded-sm", "bg-warning-400"], [1, "flex", "items-center", "gap-2"], ["title", "Mes anterior", 1, "btn-secondary", "btn-sm", 3, "click"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-4", "h-4"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M15 19l-7-7 7-7"], [1, "btn-secondary", "btn-sm", 3, "click"], ["title", "Mes siguiente", 1, "btn-secondary", "btn-sm", 3, "click"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M9 5l7 7-7 7"], [1, "font-semibold", "text-neutral-800", "ml-2", "min-w-[160px]"], [1, "flex", "items-center", "justify-center", "py-20"], [1, "card", "overflow-hidden"], [1, "modal-backdrop"], ["viewBox", "0 0 24 24", 1, "animate-spin", "h-10", "w-10", "text-primary-600"], ["cx", "12", "cy", "12", "r", "10", "stroke", "currentColor", "stroke-width", "4", "fill", "none", 1, "opacity-25"], ["fill", "currentColor", "d", "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z", 1, "opacity-75"], [1, "grid", "grid-cols-7", "border-b", "border-neutral-200", "bg-neutral-50"], [1, "px-2", "py-2", "text-center", "text-xs", "font-semibold", "text-neutral-500", "uppercase"], [1, "grid", "grid-cols-7"], [1, "min-h-[110px]", "border-b", "border-r", "border-neutral-100", "p-1.5", "last:border-r-0", 3, "bg-neutral-50"], [1, "min-h-[110px]", "border-b", "border-r", "border-neutral-100", "p-1.5", "last:border-r-0"], [1, "flex", "items-center", "justify-between", "mb-1"], [1, "text-xs", "font-medium", "w-6", "h-6", "flex", "items-center", "justify-center", "rounded-full"], [1, "space-y-1"], [1, "w-full", "text-left", "truncate", "rounded", "px-1.5", "py-0.5", "text-xs", "font-medium", "bg-primary-100", "text-primary-800", "hover:bg-primary-200", 3, "title"], [1, "w-full", "text-left", "truncate", "rounded", "px-1.5", "py-0.5", "text-xs", "font-medium", 3, "class", "title"], [1, "w-full", "text-left", "truncate", "rounded", "px-1.5", "py-0.5", "text-xs", "font-medium", "bg-primary-100", "text-primary-800", "hover:bg-primary-200", 3, "click", "title"], [1, "w-full", "text-left", "truncate", "rounded", "px-1.5", "py-0.5", "text-xs", "font-medium", 3, "click", "title"], [1, "modal-backdrop", 3, "click"], [1, "modal-content", 3, "click"], [1, "modal-header"], [1, "text-lg", "font-semibold"], [1, "text-neutral-400", "hover:text-neutral-600", 3, "click"], [1, "modal-body", "space-y-4"], [1, "px-2", "py-0.5", "rounded-full", "text-xs", "font-medium"], [1, "text-sm", "text-neutral-500"], [1, "text-xs", "text-neutral-500", "uppercase"], [1, "text-sm", "mt-0.5"], [1, "border-neutral-200"], [1, "font-medium", "mt-0.5"], [1, "text-primary-600", "hover:underline", "text-sm", "mt-1", 3, "click"], [1, "pt-2"], [1, "rounded-lg", "border", "border-warning-200", "bg-warning-50", "p-3", "space-y-3"], [1, "text-xs", "text-neutral-500"], [1, "text-sm", "ml-1"], [1, "btn-warning", "w-full", 3, "click"], [1, "text-sm", "text-neutral-700"], [1, "flex", "flex-col", "gap-2"], [1, "btn-success", "btn-sm", 3, "click", "disabled"], [1, "btn-secondary", "btn-sm", 3, "click", "disabled"], [1, "text-xs", "text-neutral-400", "hover:text-neutral-600", 3, "click", "disabled"]], template: function CalendarioComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div", 1)(2, "div")(3, "h1", 2);
      \u0275\u0275text(4, "Calendario");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(5, "div", 3)(6, "span", 4);
      \u0275\u0275element(7, "span", 5);
      \u0275\u0275text(8, " Audiencias ");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(9, "span", 4);
      \u0275\u0275element(10, "span", 6);
      \u0275\u0275text(11, " Recordatorios ");
      \u0275\u0275elementEnd()()();
      \u0275\u0275elementStart(12, "div", 7)(13, "button", 8);
      \u0275\u0275listener("click", function CalendarioComponent_Template_button_click_13_listener() {
        return ctx.mesAnterior();
      });
      \u0275\u0275namespaceSVG();
      \u0275\u0275elementStart(14, "svg", 9);
      \u0275\u0275element(15, "path", 10);
      \u0275\u0275elementEnd()();
      \u0275\u0275namespaceHTML();
      \u0275\u0275elementStart(16, "button", 11);
      \u0275\u0275listener("click", function CalendarioComponent_Template_button_click_16_listener() {
        return ctx.irAHoy();
      });
      \u0275\u0275text(17, "Hoy");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(18, "button", 12);
      \u0275\u0275listener("click", function CalendarioComponent_Template_button_click_18_listener() {
        return ctx.mesSiguiente();
      });
      \u0275\u0275namespaceSVG();
      \u0275\u0275elementStart(19, "svg", 9);
      \u0275\u0275element(20, "path", 13);
      \u0275\u0275elementEnd()();
      \u0275\u0275namespaceHTML();
      \u0275\u0275elementStart(21, "span", 14);
      \u0275\u0275text(22);
      \u0275\u0275elementEnd()()();
      \u0275\u0275template(23, CalendarioComponent_Conditional_23_Template, 4, 0, "div", 15)(24, CalendarioComponent_Conditional_24_Template, 7, 0, "div", 16);
      \u0275\u0275elementEnd();
      \u0275\u0275template(25, CalendarioComponent_Conditional_25_Template, 32, 13, "div", 17);
    }
    if (rf & 2) {
      let tmp_2_0;
      \u0275\u0275advance(22);
      \u0275\u0275textInterpolate2(" ", ctx.nombreMes(), " ", ctx.mesActual().getFullYear(), " ");
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.loading() ? 23 : 24);
      \u0275\u0275advance(2);
      \u0275\u0275conditional((tmp_2_0 = ctx.seleccionado()) ? 25 : -1, tmp_2_0);
    }
  }, dependencies: [CommonModule, DatePipe], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(CalendarioComponent, [{
    type: Component,
    args: [{
      selector: "app-calendario",
      standalone: true,
      imports: [CommonModule],
      template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Calendario</h1>
          <!-- Leyenda: sin ella, dos chips de colores distintos no dicen qu\xE9 son.
               Los recordatorios usan el c\xF3digo de urgencia del sistema
               (bajo=naranjo, medio=amarillo, alto=rojo) y las audiencias el azul
               primario, porque no tienen nivel: las fija el tribunal. -->
          <div class="flex items-center gap-4 mt-1 text-xs text-neutral-500">
            <span class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm bg-primary-500"></span> Audiencias
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm bg-warning-400"></span> Recordatorios
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="mesAnterior()" class="btn-secondary btn-sm" title="Mes anterior">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button (click)="irAHoy()" class="btn-secondary btn-sm">Hoy</button>
          <button (click)="mesSiguiente()" class="btn-secondary btn-sm" title="Mes siguiente">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span class="font-semibold text-neutral-800 ml-2 min-w-[160px]">
            {{ nombreMes() }} {{ mesActual().getFullYear() }}
          </span>
        </div>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin h-10 w-10 text-primary-600" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      } @else {
        <div class="card overflow-hidden">
          <div class="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
            @for (d of diasSemana; track d) {
              <div class="px-2 py-2 text-center text-xs font-semibold text-neutral-500 uppercase">{{ d }}</div>
            }
          </div>
          <div class="grid grid-cols-7">
            @for (dia of dias(); track dia.key) {
              <div
                class="min-h-[110px] border-b border-r border-neutral-100 p-1.5 last:border-r-0"
                [class.bg-neutral-50]="!dia.delMes"
              >
                <div class="flex items-center justify-between mb-1">
                  <span
                    class="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full"
                    [class]="dia.esHoy ? 'bg-primary-600 text-white' : dia.delMes ? 'text-neutral-700' : 'text-neutral-400'"
                  >{{ dia.fecha.getDate() }}</span>
                </div>
                <div class="space-y-1">
                  <!-- Las audiencias van primero: son compromisos con hora fija
                       ante un tribunal, y mandan sobre un recordatorio propio. -->
                  @for (a of dia.audiencias; track a.id) {
                    <button
                      (click)="verAudiencias(a)"
                      class="w-full text-left truncate rounded px-1.5 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 hover:bg-primary-200"
                      [title]="tituloAudiencia(a)"
                    >{{ fmtHora(a.hora) }} {{ a.caratulado || a.rol || a.ruc }}</button>
                  }
                  @for (r of dia.recordatorios; track r.id) {
                    <button
                      (click)="abrirDetalle(r)"
                      class="w-full text-left truncate rounded px-1.5 py-0.5 text-xs font-medium"
                      [class]="claseChip(r.nivel)"
                      [title]="r.movimiento_caratulado || r.detalle"
                    >{{ r.movimiento_rol || r.movimiento_caratulado || r.detalle }}</button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>

    <!-- Detalle / Finalizar -->
    @if (seleccionado(); as r) {
      <div class="modal-backdrop" (click)="cerrarDetalle()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">Recordatorio</h3>
            <button (click)="cerrarDetalle()" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>
          <div class="modal-body space-y-4">
            <div class="flex items-center gap-2">
              <span [class]="claseChip(r.nivel)" class="px-2 py-0.5 rounded-full text-xs font-medium">{{ r.nivel }}</span>
              <span class="text-sm text-neutral-500">{{ r.fecha_hora | date:'dd/MM/yyyy' }}</span>
            </div>

            <div>
              <span class="text-xs text-neutral-500 uppercase">Detalle</span>
              <p class="text-sm mt-0.5">{{ r.detalle }}</p>
            </div>

            <hr class="border-neutral-200" />

            <div>
              <span class="text-xs text-neutral-500 uppercase">Estado Diario</span>
              <p class="font-medium mt-0.5">{{ r.movimiento_caratulado || '-' }}</p>
              <p class="text-sm text-neutral-500">{{ r.movimiento_rol || '-' }} \xB7 {{ r.movimiento_tribunal || '-' }}</p>
              <button (click)="verMovimiento(r)" class="text-primary-600 hover:underline text-sm mt-1">
                Ver detalle del registro \u2192
              </button>
            </div>

            @if (r.usuario_registro) {
              <div>
                <span class="text-xs text-neutral-500">Registrado por:</span>
                <span class="text-sm ml-1">{{ r.usuario_registro }}</span>
              </div>
            }

            @if (!confirmandoFinalizar()) {
              <div class="pt-2">
                <button (click)="confirmandoFinalizar.set(true)" class="btn-warning w-full">Finalizar recordatorio</button>
              </div>
            } @else {
              <div class="rounded-lg border border-warning-200 bg-warning-50 p-3 space-y-3">
                <p class="text-sm text-neutral-700">\xBFMarcar tambi\xE9n el registro como resuelto?</p>
                <div class="flex flex-col gap-2">
                  <button (click)="finalizar(true)" class="btn-success btn-sm" [disabled]="finalizando()">
                    S\xED, marcar como resuelto
                  </button>
                  <button (click)="finalizar(false)" class="btn-secondary btn-sm" [disabled]="finalizando()">
                    No, solo finalizar el recordatorio
                  </button>
                  <button (click)="confirmandoFinalizar.set(false)" class="text-xs text-neutral-400 hover:text-neutral-600" [disabled]="finalizando()">
                    Cancelar
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(CalendarioComponent, { className: "CalendarioComponent", filePath: "src/app/features/calendario/calendario.component.ts", lineNumber: 184 });
})();
export {
  CalendarioComponent
};
//# sourceMappingURL=chunk-CZEHUR6G.js.map
