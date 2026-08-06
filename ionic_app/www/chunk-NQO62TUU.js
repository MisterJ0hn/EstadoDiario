import {
  MovimientoService
} from "./chunk-MAUBW23E.js";
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

// src/app/features/movimientos/movimientos.component.ts
var _forTrack0 = ($index, $item) => $item.materia;
var _forTrack1 = ($index, $item) => $item.id;
var _forTrack2 = ($index, $item) => $item.etiqueta;
function MovimientosComponent_Conditional_7_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 4)(1, "span");
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "button", 20);
    \u0275\u0275listener("click", function MovimientosComponent_Conditional_7_Template_button_click_3_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.quitarFiltroArchivo());
    });
    \u0275\u0275text(4, "Ver todos");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate1("Mostrando solo los movimientos del archivo #", ctx_r1.filtroOrigenId, ".");
  }
}
function MovimientosComponent_For_15_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 7);
    \u0275\u0275listener("click", function MovimientosComponent_For_15_Template_button_click_0_listener() {
      const c_r4 = \u0275\u0275restoreView(_r3).$implicit;
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.seleccionarMateria(c_r4.materia));
    });
    \u0275\u0275text(1);
    \u0275\u0275elementStart(2, "span", 8);
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
function MovimientosComponent_For_28_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "option", 15);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const e_r5 = ctx.$implicit;
    \u0275\u0275property("ngValue", e_r5);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(e_r5);
  }
}
function MovimientosComponent_Conditional_33_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 18);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(1, "svg", 21);
    \u0275\u0275element(2, "circle", 22)(3, "path", 23);
    \u0275\u0275elementEnd()();
  }
}
function MovimientosComponent_Conditional_34_For_20_Conditional_13_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 36);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const m_r7 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(m_r7.estado_causa);
  }
}
function MovimientosComponent_Conditional_34_For_20_Conditional_14_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275text(0, " - ");
  }
}
function MovimientosComponent_Conditional_34_For_20_Conditional_17_For_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div")(1, "dt", 42);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "dd", 43);
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
function MovimientosComponent_Conditional_34_For_20_Conditional_17_ForEmpty_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 41);
    \u0275\u0275text(1, "Sin datos adicionales para este registro");
    \u0275\u0275elementEnd();
  }
}
function MovimientosComponent_Conditional_34_For_20_Conditional_17_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "tr", 38)(1, "td", 39)(2, "dl", 40);
    \u0275\u0275repeaterCreate(3, MovimientosComponent_Conditional_34_For_20_Conditional_17_For_4_Template, 5, 2, "div", null, _forTrack2, false, MovimientosComponent_Conditional_34_For_20_Conditional_17_ForEmpty_5_Template, 2, 0, "div", 41);
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const m_r7 = \u0275\u0275nextContext().$implicit;
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275attribute("colspan", ctx_r1.colspan);
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r1.detalle(m_r7));
  }
}
function MovimientosComponent_Conditional_34_For_20_Template(rf, ctx) {
  if (rf & 1) {
    const _r6 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "tr", 28);
    \u0275\u0275listener("click", function MovimientosComponent_Conditional_34_For_20_Template_tr_click_0_listener() {
      const m_r7 = \u0275\u0275restoreView(_r6).$implicit;
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.alternarDetalle(m_r7.id));
    });
    \u0275\u0275elementStart(1, "td", 29);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(2, "svg", 30);
    \u0275\u0275element(3, "path", 31);
    \u0275\u0275elementEnd()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(4, "td", 32);
    \u0275\u0275text(5);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "td", 33);
    \u0275\u0275text(7);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "td", 34);
    \u0275\u0275text(9);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(10, "td", 35);
    \u0275\u0275text(11);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(12, "td");
    \u0275\u0275template(13, MovimientosComponent_Conditional_34_For_20_Conditional_13_Template, 2, 1, "span", 36)(14, MovimientosComponent_Conditional_34_For_20_Conditional_14_Template, 1, 0);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(15, "td", 37);
    \u0275\u0275text(16);
    \u0275\u0275elementEnd()();
    \u0275\u0275template(17, MovimientosComponent_Conditional_34_For_20_Conditional_17_Template, 6, 2, "tr", 38);
  }
  if (rf & 2) {
    const m_r7 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275classProp("rotate-90", ctx_r1.detalleAbiertoId() === m_r7.id);
    \u0275\u0275attribute("aria-label", ctx_r1.detalleAbiertoId() === m_r7.id ? "Ocultar detalle" : "Ver detalle");
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(m_r7.rol || "-");
    \u0275\u0275advance();
    \u0275\u0275property("title", m_r7.tribunal || "");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(m_r7.tribunal || "-");
    \u0275\u0275advance();
    \u0275\u0275property("title", m_r7.caratulado || "");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(m_r7.caratulado || "-");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r1.fmtFecha(m_r7.fecha_ingreso));
    \u0275\u0275advance(2);
    \u0275\u0275conditional(m_r7.estado_causa ? 13 : 14);
    \u0275\u0275advance(2);
    \u0275\u0275property("title", m_r7.institucion || "");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(m_r7.institucion || "-");
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r1.detalleAbiertoId() === m_r7.id ? 17 : -1);
  }
}
function MovimientosComponent_Conditional_34_ForEmpty_21_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "tr")(1, "td", 44);
    \u0275\u0275text(2, " No se encontraron movimientos ");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275attribute("colspan", ctx_r1.colspan);
  }
}
function MovimientosComponent_Conditional_34_Conditional_22_Template(rf, ctx) {
  if (rf & 1) {
    const _r9 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 27)(1, "span", 45);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "div", 46)(4, "button", 47);
    \u0275\u0275listener("click", function MovimientosComponent_Conditional_34_Conditional_22_Template_button_click_4_listener() {
      \u0275\u0275restoreView(_r9);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.irAPagina(ctx_r1.currentPage() - 1));
    });
    \u0275\u0275text(5, "Anterior");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "button", 47);
    \u0275\u0275listener("click", function MovimientosComponent_Conditional_34_Conditional_22_Template_button_click_6_listener() {
      \u0275\u0275restoreView(_r9);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.irAPagina(ctx_r1.currentPage() + 1));
    });
    \u0275\u0275text(7, "Siguiente");
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate3(" P\xE1gina ", ctx_r1.currentPage(), " de ", ctx_r1.totalPages(), " (", ctx_r1.total(), " registros) ");
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r1.currentPage() <= 1);
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r1.currentPage() >= ctx_r1.totalPages());
  }
}
function MovimientosComponent_Conditional_34_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 19)(1, "div", 24)(2, "table", 25)(3, "thead")(4, "tr");
    \u0275\u0275element(5, "th", 26);
    \u0275\u0275elementStart(6, "th");
    \u0275\u0275text(7, "Rit");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "th");
    \u0275\u0275text(9, "Tribunal");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(10, "th");
    \u0275\u0275text(11, "Caratulado");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(12, "th");
    \u0275\u0275text(13, "FechaIngreso");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(14, "th");
    \u0275\u0275text(15, "EstadoCausa");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(16, "th");
    \u0275\u0275text(17, "Instituci\xF3n");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(18, "tbody");
    \u0275\u0275repeaterCreate(19, MovimientosComponent_Conditional_34_For_20_Template, 18, 13, null, null, _forTrack1, false, MovimientosComponent_Conditional_34_ForEmpty_21_Template, 3, 1, "tr");
    \u0275\u0275elementEnd()()();
    \u0275\u0275template(22, MovimientosComponent_Conditional_34_Conditional_22_Template, 8, 5, "div", 27);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(19);
    \u0275\u0275repeater(ctx_r1.movimientos());
    \u0275\u0275advance(3);
    \u0275\u0275conditional(ctx_r1.totalPages() > 1 ? 22 : -1);
  }
}
var MovimientosComponent = class _MovimientosComponent {
  service = inject(MovimientoService);
  notification = inject(NotificationService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  movimientos = signal([]);
  materias = signal([]);
  estadosCausa = signal([]);
  totalResumen = signal(0);
  loading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);
  /** null = pestaña "Todas". Se refleja en el query param `materia`. */
  materiaActiva = signal(null);
  detalleAbiertoId = signal(null);
  filtroBusqueda = "";
  filtroEstadoCausa = "";
  filtroTribunal = "";
  filtroRut = "";
  /** Filtros ya aplicados, los que se ven como badges. */
  chipsFiltros = signal([]);
  panel = viewChild(FiltrosPanelComponent);
  /** Fijado por query param cuando se entra desde un archivo concreto; no se edita en pantalla. */
  filtroOrigenId;
  /** Columnas de la tabla, para el colspan del detalle y del estado vacío.
   *  Chevron + Rut + Tribunal + Caratulado + FechaIngreso + EstadoCausa +
   *  Institución. Es fijo desde que las causas de corte se fueron a su propia
   *  pantalla y dejó de haber columnas condicionales. */
  colspan = 7;
  ngOnInit() {
    const materia = this.route.snapshot.queryParamMap.get("materia");
    this.materiaActiva.set(materia || null);
    const origenId = Number(this.route.snapshot.queryParamMap.get("origen_id"));
    this.filtroOrigenId = Number.isFinite(origenId) && origenId > 0 ? origenId : void 0;
    this.cargarResumen();
    this.cargarDatos();
  }
  /** Fechas ISO (yyyy-MM-dd) a dd-MM-yyyy sin pasar por Date, que desplaza el día por zona horaria. */
  fmtFecha(valor) {
    if (!valor)
      return "-";
    const partes = valor.slice(0, 10).split("-");
    return partes.length === 3 ? `${partes[2]}-${partes[1]}-${partes[0]}` : valor;
  }
  /** Campos que no están en la tabla; se omiten los vacíos. */
  detalle(m) {
    const campos = [
      { etiqueta: "Materia", valor: m.materia },
      { etiqueta: "Tribunal", valor: m.tribunal },
      { etiqueta: "Corte", valor: m.corte },
      { etiqueta: "Era", valor: m.era },
      { etiqueta: "Instituci\xF3n", valor: m.institucion },
      { etiqueta: "Ubicaci\xF3n", valor: m.ubicacion },
      { etiqueta: "Fecha ubicaci\xF3n", valor: m.fecha_ubicacion ? this.fmtFecha(m.fecha_ubicacion) : null },
      { etiqueta: "Fecha del archivo", valor: m.fecha_archivo ? this.fmtFecha(m.fecha_archivo) : null },
      { etiqueta: "Archivo", valor: m.nombre_archivo }
    ];
    return campos.filter((c) => !!c.valor && String(c.valor).trim() !== "").map((c) => ({ etiqueta: c.etiqueta, valor: String(c.valor) }));
  }
  alternarDetalle(id) {
    this.detalleAbiertoId.set(this.detalleAbiertoId() === id ? null : id);
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
    this.service.getMovimientos(__spreadProps(__spreadValues({}, this.filtros()), {
      materia: this.materiaActiva() || void 0,
      page: this.currentPage(),
      limit: 20
    })).subscribe({
      next: (res) => {
        this.movimientos.set(res.movimientos);
        this.total.set(res.total);
        this.currentPage.set(res.page);
        this.totalPages.set(res.total_pages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error("Error al cargar los movimientos");
      }
    });
  }
  /** Conteos por materia y estados de causa disponibles; respeta los filtros activos. */
  cargarResumen() {
    this.service.getResumen(this.filtros()).subscribe({
      next: (res) => {
        this.materias.set(res.por_materia);
        this.totalResumen.set(res.total);
        this.estadosCausa.set(res.estados_causa);
      },
      error: () => {
        this.materias.set([]);
        this.estadosCausa.set([]);
      }
    });
  }
  filtros() {
    return {
      busqueda: this.filtroBusqueda || void 0,
      estado_causa: this.filtroEstadoCausa || void 0,
      tribunal: this.filtroTribunal || void 0,
      rut: this.filtroRut || void 0,
      origen_id: this.filtroOrigenId
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
    this.filtroEstadoCausa = "";
    this.filtroTribunal = "";
    this.filtroRut = "";
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
      case "estado_causa":
        this.filtroEstadoCausa = "";
        break;
      case "tribunal":
        this.filtroTribunal = "";
        break;
      case "rut":
        this.filtroRut = "";
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
    if (this.filtroEstadoCausa) {
      chips.push({ clave: "estado_causa", etiqueta: "Estado", valor: this.filtroEstadoCausa });
    }
    if (this.filtroTribunal) {
      chips.push({ clave: "tribunal", etiqueta: "Tribunal", valor: this.filtroTribunal });
    }
    if (this.filtroRut) {
      chips.push({ clave: "rut", etiqueta: "RUT", valor: this.filtroRut });
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
  irAPagina(page) {
    this.currentPage.set(page);
    this.detalleAbiertoId.set(null);
    this.cargarDatos();
  }
  static \u0275fac = function MovimientosComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _MovimientosComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _MovimientosComponent, selectors: [["app-movimientos"]], viewQuery: function MovimientosComponent_Query(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275viewQuerySignal(ctx.panel, FiltrosPanelComponent, 5);
    }
    if (rf & 2) {
      \u0275\u0275queryAdvance();
    }
  }, decls: 35, vars: 14, consts: [[1, "space-y-6"], [1, "flex", "items-center", "justify-between", "flex-wrap", "gap-4"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], [1, "alert-info", "flex", "items-center", "justify-between", "gap-4"], [1, "border-b", "border-neutral-200"], ["role", "tablist", 1, "-mb-px", "flex", "gap-1", "overflow-x-auto"], ["type", "button", "role", "tab", 1, "flex", "items-center", "gap-2", "whitespace-nowrap", "border-b-2", "px-4", "py-3", "text-sm", "font-medium", "transition-colors", 3, "click"], [1, "rounded-full", "px-2", "py-0.5", "text-xs", "font-semibold"], ["type", "button", "role", "tab", 1, "flex", "items-center", "gap-2", "whitespace-nowrap", "border-b-2", "px-4", "py-3", "text-sm", "font-medium", "transition-colors", 3, "class"], [3, "aplicar", "limpiar", "quitar", "chips"], ["for", "m-busqueda", 1, "form-label"], ["id", "m-busqueda", "type", "text", "placeholder", "Car\xE1tula o rol", 1, "form-input", 3, "ngModelChange", "keyup.enter", "ngModel"], ["for", "m-estado", 1, "form-label"], ["id", "m-estado", 1, "form-select", 3, "ngModelChange", "ngModel"], [3, "ngValue"], ["for", "m-tribunal", 1, "form-label"], ["id", "m-tribunal", "type", "text", "placeholder", "Coincidencia parcial", 1, "form-input", 3, "ngModelChange", "keyup.enter", "ngModel"], [1, "flex", "items-center", "justify-center", "py-20"], [1, "card"], [1, "btn-secondary", "btn-sm", "shrink-0", 3, "click"], ["viewBox", "0 0 24 24", 1, "animate-spin", "h-10", "w-10", "text-primary-600"], ["cx", "12", "cy", "12", "r", "10", "stroke", "currentColor", "stroke-width", "4", "fill", "none", 1, "opacity-25"], ["fill", "currentColor", "d", "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z", 1, "opacity-75"], [1, "table-wrapper"], [1, "data-table"], [1, "w-8"], [1, "flex", "items-center", "justify-between", "px-6", "py-4", "border-t", "border-neutral-200"], [1, "cursor-pointer", 3, "click"], [1, "text-neutral-400"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-4", "h-4", "transition-transform"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M9 5l7 7-7 7"], [1, "font-medium", "whitespace-nowrap"], [1, "max-w-[200px]", "truncate", 3, "title"], [1, "max-w-[280px]", "truncate", 3, "title"], [1, "whitespace-nowrap"], [1, "badge-info"], [1, "max-w-[180px]", "truncate", 3, "title"], [1, "bg-neutral-50"], [1, "whitespace-normal"], [1, "grid", "grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-4", "gap-4", "py-2"], [1, "text-sm", "text-neutral-400"], [1, "text-xs", "text-neutral-500", "uppercase", "tracking-wide"], [1, "text-sm", "text-neutral-800", "mt-0.5", "break-words"], [1, "text-center", "py-10", "text-neutral-400"], [1, "text-sm", "text-neutral-500"], [1, "flex", "gap-2"], [1, "btn-secondary", "btn-sm", 3, "click", "disabled"]], template: function MovimientosComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div", 1)(2, "div")(3, "h1", 2);
      \u0275\u0275text(4, "Movimientos");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(5, "p", 3);
      \u0275\u0275text(6);
      \u0275\u0275elementEnd()()();
      \u0275\u0275template(7, MovimientosComponent_Conditional_7_Template, 5, 1, "div", 4);
      \u0275\u0275elementStart(8, "div", 5)(9, "nav", 6)(10, "button", 7);
      \u0275\u0275listener("click", function MovimientosComponent_Template_button_click_10_listener() {
        return ctx.seleccionarMateria(null);
      });
      \u0275\u0275text(11, " Todas ");
      \u0275\u0275elementStart(12, "span", 8);
      \u0275\u0275text(13);
      \u0275\u0275elementEnd()();
      \u0275\u0275repeaterCreate(14, MovimientosComponent_For_15_Template, 4, 7, "button", 9, _forTrack0);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(16, "app-filtros-panel", 10);
      \u0275\u0275listener("aplicar", function MovimientosComponent_Template_app_filtros_panel_aplicar_16_listener() {
        return ctx.onFiltrar();
      })("limpiar", function MovimientosComponent_Template_app_filtros_panel_limpiar_16_listener() {
        return ctx.onLimpiarFiltros();
      })("quitar", function MovimientosComponent_Template_app_filtros_panel_quitar_16_listener($event) {
        return ctx.quitarFiltro($event);
      });
      \u0275\u0275elementStart(17, "div")(18, "label", 11);
      \u0275\u0275text(19, "B\xFAsqueda");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(20, "input", 12);
      \u0275\u0275twoWayListener("ngModelChange", function MovimientosComponent_Template_input_ngModelChange_20_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.filtroBusqueda, $event) || (ctx.filtroBusqueda = $event);
        return $event;
      });
      \u0275\u0275listener("keyup.enter", function MovimientosComponent_Template_input_keyup_enter_20_listener() {
        return ctx.aplicarDesdeCampo();
      });
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(21, "div")(22, "label", 13);
      \u0275\u0275text(23, "Estado de la causa");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(24, "select", 14);
      \u0275\u0275twoWayListener("ngModelChange", function MovimientosComponent_Template_select_ngModelChange_24_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.filtroEstadoCausa, $event) || (ctx.filtroEstadoCausa = $event);
        return $event;
      });
      \u0275\u0275elementStart(25, "option", 15);
      \u0275\u0275text(26, "Todos");
      \u0275\u0275elementEnd();
      \u0275\u0275repeaterCreate(27, MovimientosComponent_For_28_Template, 2, 2, "option", 15, \u0275\u0275repeaterTrackByIdentity);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(29, "div")(30, "label", 16);
      \u0275\u0275text(31, "Tribunal");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(32, "input", 17);
      \u0275\u0275twoWayListener("ngModelChange", function MovimientosComponent_Template_input_ngModelChange_32_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.filtroTribunal, $event) || (ctx.filtroTribunal = $event);
        return $event;
      });
      \u0275\u0275listener("keyup.enter", function MovimientosComponent_Template_input_keyup_enter_32_listener() {
        return ctx.aplicarDesdeCampo();
      });
      \u0275\u0275elementEnd()()();
      \u0275\u0275template(33, MovimientosComponent_Conditional_33_Template, 4, 0, "div", 18)(34, MovimientosComponent_Conditional_34_Template, 23, 2, "div", 19);
      \u0275\u0275elementEnd();
    }
    if (rf & 2) {
      \u0275\u0275advance(6);
      \u0275\u0275textInterpolate1(" Estado procesal de las causas \u2014 ", ctx.total(), " registros encontrados ");
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.filtroOrigenId ? 7 : -1);
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
      \u0275\u0275twoWayProperty("ngModel", ctx.filtroEstadoCausa);
      \u0275\u0275advance();
      \u0275\u0275property("ngValue", "");
      \u0275\u0275advance(2);
      \u0275\u0275repeater(ctx.estadosCausa());
      \u0275\u0275advance(5);
      \u0275\u0275twoWayProperty("ngModel", ctx.filtroTribunal);
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.loading() ? 33 : 34);
    }
  }, dependencies: [CommonModule, FormsModule, NgSelectOption, \u0275NgSelectMultipleOption, DefaultValueAccessor, SelectControlValueAccessor, NgControlStatus, NgModel, FiltrosPanelComponent], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MovimientosComponent, [{
    type: Component,
    args: [{
      selector: "app-movimientos",
      standalone: true,
      imports: [CommonModule, FormsModule, FiltrosPanelComponent],
      template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Movimientos</h1>
          <p class="text-neutral-500 mt-1">
            Estado procesal de las causas \u2014 {{ total() }} registros encontrados
          </p>
        </div>
      </div>

      <!-- Se lleg\xF3 acotado a un archivo concreto desde la vista Archivos -->
      @if (filtroOrigenId) {
        <div class="alert-info flex items-center justify-between gap-4">
          <span>Mostrando solo los movimientos del archivo #{{ filtroOrigenId }}.</span>
          <button (click)="quitarFiltroArchivo()" class="btn-secondary btn-sm shrink-0">Ver todos</button>
        </div>
      }

      <!-- Pesta\xF1as por materia (las alimenta /movimientos/resumen) -->
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
          <label class="form-label" for="m-busqueda">B\xFAsqueda</label>
          <input id="m-busqueda" type="text" class="form-input" [(ngModel)]="filtroBusqueda"
                 placeholder="Car\xE1tula o rol" (keyup.enter)="aplicarDesdeCampo()" />
        </div>
        <div>
          <label class="form-label" for="m-estado">Estado de la causa</label>
          <select id="m-estado" class="form-select" [(ngModel)]="filtroEstadoCausa">
            <option [ngValue]="''">Todos</option>
            @for (e of estadosCausa(); track e) {
              <option [ngValue]="e">{{ e }}</option>
            }
          </select>
        </div>
        <div>
          <label class="form-label" for="m-tribunal">Tribunal</label>
          <input id="m-tribunal" type="text" class="form-input" [(ngModel)]="filtroTribunal"
                 placeholder="Coincidencia parcial" (keyup.enter)="aplicarDesdeCampo()" />
        </div>
      </app-filtros-panel>

      <!-- Tabla -->
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
                  <th class="w-8"></th>
                  <th>Rit</th>
                  <th>Tribunal</th>
                  <th>Caratulado</th>
                  <th>FechaIngreso</th>
                  <th>EstadoCausa</th>
                  <th>Instituci\xF3n</th>
                </tr>
              </thead>
              <tbody>
                @for (m of movimientos(); track m.id) {
                  <tr class="cursor-pointer" (click)="alternarDetalle(m.id)">
                    <td class="text-neutral-400">
                      <svg class="w-4 h-4 transition-transform" [class.rotate-90]="detalleAbiertoId() === m.id"
                           fill="none" stroke="currentColor" viewBox="0 0 24 24"
                           [attr.aria-label]="detalleAbiertoId() === m.id ? 'Ocultar detalle' : 'Ver detalle'">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                    <td class="font-medium whitespace-nowrap">{{ m.rol || '-' }}</td>
                    <td class="max-w-[200px] truncate" [title]="m.tribunal || ''">{{ m.tribunal || '-' }}</td>
                    <td class="max-w-[280px] truncate" [title]="m.caratulado || ''">{{ m.caratulado || '-' }}</td>
                    <td class="whitespace-nowrap">{{ fmtFecha(m.fecha_ingreso) }}</td>
                    <td>
                      @if (m.estado_causa) {
                        <span class="badge-info">{{ m.estado_causa }}</span>
                      } @else { - }
                    </td>
                    <td class="max-w-[180px] truncate" [title]="m.institucion || ''">{{ m.institucion || '-' }}</td>
                  </tr>

                  <!-- Detalle expandible: solo los campos con dato. Es la forma de
                       mostrar era/corte/ubicaci\xF3n en las materias donde vienen
                       espor\xE1dicamente, sin columnas vac\xEDas en la tabla. -->
                  @if (detalleAbiertoId() === m.id) {
                    <tr class="bg-neutral-50">
                      <td [attr.colspan]="colspan" class="whitespace-normal">
                        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
                          @for (d of detalle(m); track d.etiqueta) {
                            <div>
                              <dt class="text-xs text-neutral-500 uppercase tracking-wide">{{ d.etiqueta }}</dt>
                              <dd class="text-sm text-neutral-800 mt-0.5 break-words">{{ d.valor }}</dd>
                            </div>
                          } @empty {
                            <div class="text-sm text-neutral-400">Sin datos adicionales para este registro</div>
                          }
                        </dl>
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr>
                    <td [attr.colspan]="colspan" class="text-center py-10 text-neutral-400">
                      No se encontraron movimientos
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Paginaci\xF3n -->
          @if (totalPages() > 1) {
            <div class="flex items-center justify-between px-6 py-4 border-t border-neutral-200">
              <span class="text-sm text-neutral-500">
                P\xE1gina {{ currentPage() }} de {{ totalPages() }} ({{ total() }} registros)
              </span>
              <div class="flex gap-2">
                <button (click)="irAPagina(currentPage() - 1)" [disabled]="currentPage() <= 1"
                        class="btn-secondary btn-sm">Anterior</button>
                <button (click)="irAPagina(currentPage() + 1)" [disabled]="currentPage() >= totalPages()"
                        class="btn-secondary btn-sm">Siguiente</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(MovimientosComponent, { className: "MovimientosComponent", filePath: "src/app/features/movimientos/movimientos.component.ts", lineNumber: 215 });
})();
export {
  MovimientosComponent
};
//# sourceMappingURL=chunk-NQO62TUU.js.map
