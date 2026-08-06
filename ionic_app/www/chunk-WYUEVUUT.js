import {
  EstadoDiarioService
} from "./chunk-FLTDD2QG.js";
import {
  FiltrosPanelComponent
} from "./chunk-KKQNT7IP.js";
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
  CommonModule,
  Component,
  inject,
  setClassMetadata,
  signal,
  viewChild,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵconditional,
  ɵɵdefineComponent,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetCurrentView,
  ɵɵlistener,
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
  ɵɵtextInterpolate2,
  ɵɵtwoWayBindingSet,
  ɵɵtwoWayListener,
  ɵɵtwoWayProperty,
  ɵɵviewQuerySignal
} from "./chunk-WMIGZGXS.js";
import "./chunk-XWLXMCJQ.js";

// src/app/features/estado-diario/components/cortes-list/cortes-list.component.ts
var _forTrack0 = ($index, $item) => $item.valor;
var _forTrack1 = ($index, $item) => $item.id;
function CortesListComponent_For_16_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "option", 8);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const op_r1 = ctx.$implicit;
    \u0275\u0275property("ngValue", op_r1.valor);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(op_r1.etiqueta);
  }
}
function CortesListComponent_Conditional_17_For_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "option", 8);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const c_r4 = ctx.$implicit;
    \u0275\u0275property("ngValue", c_r4);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(c_r4);
  }
}
function CortesListComponent_Conditional_17_Template(rf, ctx) {
  if (rf & 1) {
    const _r2 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div")(1, "label", 14);
    \u0275\u0275text(2, "Corte");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "select", 15);
    \u0275\u0275twoWayListener("ngModelChange", function CortesListComponent_Conditional_17_Template_select_ngModelChange_3_listener($event) {
      \u0275\u0275restoreView(_r2);
      const ctx_r2 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r2.filtroCorte, $event) || (ctx_r2.filtroCorte = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementStart(4, "option", 8);
    \u0275\u0275text(5, "Todas");
    \u0275\u0275elementEnd();
    \u0275\u0275repeaterCreate(6, CortesListComponent_Conditional_17_For_7_Template, 2, 2, "option", 8, \u0275\u0275repeaterTrackByIdentity);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance(3);
    \u0275\u0275twoWayProperty("ngModel", ctx_r2.filtroCorte);
    \u0275\u0275advance();
    \u0275\u0275property("ngValue", "");
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r2.cortesDisponibles());
  }
}
function CortesListComponent_Conditional_20_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 11);
    \u0275\u0275text(1, "Cargando...");
    \u0275\u0275elementEnd();
  }
}
function CortesListComponent_Conditional_21_Template(rf, ctx) {
  if (rf & 1) {
    const _r5 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 12)(1, "div", 16);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "button", 17);
    \u0275\u0275listener("click", function CortesListComponent_Conditional_21_Template_button_click_3_listener() {
      \u0275\u0275restoreView(_r5);
      const ctx_r2 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r2.cargar());
    });
    \u0275\u0275text(4, " Reintentar ");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r2.error());
  }
}
function CortesListComponent_Conditional_22_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 13)(1, "p", 18);
    \u0275\u0275text(2, "No hay causas de corte");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "p", 19);
    \u0275\u0275text(4, " Aparecer\xE1n ac\xE1 cuando llegue un estado diario con las hojas de Corte Suprema o Corte de Apelaciones. ");
    \u0275\u0275elementEnd()();
  }
}
function CortesListComponent_Conditional_23_For_18_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "tr")(1, "td", 23);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "td");
    \u0275\u0275text(4);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "td");
    \u0275\u0275text(6);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(7, "td", 23);
    \u0275\u0275text(8);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(9, "td");
    \u0275\u0275text(10);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(11, "td");
    \u0275\u0275text(12);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const c_r6 = ctx.$implicit;
    const ctx_r2 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r2.fecha(c_r6.fecha_ingreso));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(c_r6.caratulado || "-");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(c_r6.ubicacion || "-");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r2.fecha(c_r6.fecha_ubicacion));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(c_r6.corte || "-");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(c_r6.tipo_recurso || "-");
  }
}
function CortesListComponent_Conditional_23_Conditional_19_Template(rf, ctx) {
  if (rf & 1) {
    const _r7 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 22)(1, "p", 24);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "div", 25)(4, "button", 26);
    \u0275\u0275listener("click", function CortesListComponent_Conditional_23_Conditional_19_Template_button_click_4_listener() {
      \u0275\u0275restoreView(_r7);
      const ctx_r2 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r2.irA(ctx_r2.pagina() - 1));
    });
    \u0275\u0275text(5, " Anterior ");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "button", 26);
    \u0275\u0275listener("click", function CortesListComponent_Conditional_23_Conditional_19_Template_button_click_6_listener() {
      \u0275\u0275restoreView(_r7);
      const ctx_r2 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r2.irA(ctx_r2.pagina() + 1));
    });
    \u0275\u0275text(7, " Siguiente ");
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate2(" P\xE1gina ", ctx_r2.pagina(), " de ", ctx_r2.totalPaginas(), " ");
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r2.pagina() <= 1);
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r2.pagina() >= ctx_r2.totalPaginas());
  }
}
function CortesListComponent_Conditional_23_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 20)(1, "table", 21)(2, "thead")(3, "tr")(4, "th");
    \u0275\u0275text(5, "FechaIngreso");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "th");
    \u0275\u0275text(7, "Caratulado");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "th");
    \u0275\u0275text(9, "Ubicaci\xF3n");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(10, "th");
    \u0275\u0275text(11, "FechaUbicaci\xF3n");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(12, "th");
    \u0275\u0275text(13, "Corte");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(14, "th");
    \u0275\u0275text(15, "TipoRecurso");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(16, "tbody");
    \u0275\u0275repeaterCreate(17, CortesListComponent_Conditional_23_For_18_Template, 13, 6, "tr", null, _forTrack1);
    \u0275\u0275elementEnd()()();
    \u0275\u0275template(19, CortesListComponent_Conditional_23_Conditional_19_Template, 8, 4, "div", 22);
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance(17);
    \u0275\u0275repeater(ctx_r2.cortes());
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r2.totalPaginas() > 1 ? 19 : -1);
  }
}
var CortesListComponent = class _CortesListComponent {
  service = inject(EstadoDiarioService);
  opciones = [
    { valor: "", etiqueta: "Todas" },
    { valor: "suprema", etiqueta: "Corte Suprema" },
    { valor: "apelaciones", etiqueta: "Corte de Apelaciones" }
  ];
  cortes = signal([]);
  cortesDisponibles = signal([]);
  total = signal(0);
  pagina = signal(1);
  totalPaginas = signal(1);
  cargando = signal(true);
  error = signal(null);
  filtroBusqueda = "";
  filtroTipo = "";
  filtroCorte = "";
  /** Filtros ya aplicados, los que se ven como badges. */
  chipsFiltros = signal([]);
  panel = viewChild(FiltrosPanelComponent);
  porPagina = 50;
  ngOnInit() {
    this.cargar();
  }
  cargar() {
    this.cargando.set(true);
    this.error.set(null);
    this.service.getCortes({
      tipo: this.filtroTipo || void 0,
      busqueda: this.filtroBusqueda.trim() || void 0,
      corte: this.filtroCorte || void 0,
      page: this.pagina(),
      limit: this.porPagina
    }).subscribe({
      next: (res) => {
        this.cortes.set(res.cortes);
        this.total.set(res.total);
        this.pagina.set(res.page);
        this.totalPaginas.set(res.total_pages);
        this.cortesDisponibles.set(res.cortes_disponibles ?? []);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set("No se pudieron cargar las causas de corte.");
      }
    });
  }
  onFiltrar() {
    this.pagina.set(1);
    this.sincronizarChips();
    this.cargar();
  }
  onLimpiarFiltros() {
    this.filtroBusqueda = "";
    this.filtroTipo = "";
    this.filtroCorte = "";
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
      case "tipo":
        this.filtroTipo = "";
        break;
      case "corte":
        this.filtroCorte = "";
        break;
    }
    this.onFiltrar();
  }
  /** Badges de lo APLICADO, no de lo escrito: si el usuario abre el panel,
   *  escribe y lo cierra sin aplicar, la barra no debe mentir sobre qué se
   *  está consultando. */
  sincronizarChips() {
    const chips = [];
    if (this.filtroBusqueda) {
      chips.push({ clave: "busqueda", etiqueta: "B\xFAsqueda", valor: this.filtroBusqueda });
    }
    if (this.filtroTipo) {
      const op = this.opciones.find((o) => o.valor === this.filtroTipo);
      chips.push({ clave: "tipo", etiqueta: "Tipo", valor: op?.etiqueta ?? this.filtroTipo });
    }
    if (this.filtroCorte) {
      chips.push({ clave: "corte", etiqueta: "Corte", valor: this.filtroCorte });
    }
    this.chipsFiltros.set(chips);
  }
  irA(pagina) {
    this.pagina.set(pagina);
    this.cargar();
  }
  fecha(valor) {
    if (!valor)
      return "-";
    const [anio, mes, dia] = valor.split("-");
    return dia ? `${dia}-${mes}-${anio}` : valor;
  }
  static \u0275fac = function CortesListComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _CortesListComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _CortesListComponent, selectors: [["app-cortes-list"]], viewQuery: function CortesListComponent_Query(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275viewQuerySignal(ctx.panel, FiltrosPanelComponent, 5);
    }
    if (rf & 2) {
      \u0275\u0275queryAdvance();
    }
  }, decls: 24, vars: 7, consts: [[1, "space-y-6"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], [3, "aplicar", "limpiar", "quitar", "chips"], ["for", "c-busqueda", 1, "form-label"], ["id", "c-busqueda", "type", "text", "placeholder", "Car\xE1tula o n\xFAmero de ingreso", 1, "form-input", 3, "ngModelChange", "keyup.enter", "ngModel"], ["for", "c-tipo", 1, "form-label"], ["id", "c-tipo", 1, "form-select", 3, "ngModelChange", "ngModel"], [3, "ngValue"], [1, "card"], [1, "card-body"], [1, "text-neutral-500", "py-8", "text-center"], [1, "alert-danger"], [1, "py-10", "text-center"], ["for", "c-corte", 1, "form-label"], ["id", "c-corte", 1, "form-select", 3, "ngModelChange", "ngModel"], [1, "flex-1"], ["type", "button", 1, "btn-danger", "btn-sm", "shrink-0", 3, "click"], [1, "text-neutral-600", "font-medium"], [1, "text-sm", "text-neutral-500", "mt-1"], [1, "table-wrapper"], [1, "data-table"], [1, "flex", "items-center", "justify-between", "mt-4"], [1, "whitespace-nowrap"], [1, "text-sm", "text-neutral-500"], [1, "flex", "gap-2"], ["type", "button", 1, "btn-secondary", "btn-sm", 3, "click", "disabled"]], template: function CortesListComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div")(2, "h1", 1);
      \u0275\u0275text(3, "Corte");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(4, "p", 2);
      \u0275\u0275text(5);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(6, "app-filtros-panel", 3);
      \u0275\u0275listener("aplicar", function CortesListComponent_Template_app_filtros_panel_aplicar_6_listener() {
        return ctx.onFiltrar();
      })("limpiar", function CortesListComponent_Template_app_filtros_panel_limpiar_6_listener() {
        return ctx.onLimpiarFiltros();
      })("quitar", function CortesListComponent_Template_app_filtros_panel_quitar_6_listener($event) {
        return ctx.quitarFiltro($event);
      });
      \u0275\u0275elementStart(7, "div")(8, "label", 4);
      \u0275\u0275text(9, "B\xFAsqueda");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(10, "input", 5);
      \u0275\u0275twoWayListener("ngModelChange", function CortesListComponent_Template_input_ngModelChange_10_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.filtroBusqueda, $event) || (ctx.filtroBusqueda = $event);
        return $event;
      });
      \u0275\u0275listener("keyup.enter", function CortesListComponent_Template_input_keyup_enter_10_listener() {
        return ctx.aplicarDesdeCampo();
      });
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(11, "div")(12, "label", 6);
      \u0275\u0275text(13, "Tipo de corte");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(14, "select", 7);
      \u0275\u0275twoWayListener("ngModelChange", function CortesListComponent_Template_select_ngModelChange_14_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.filtroTipo, $event) || (ctx.filtroTipo = $event);
        return $event;
      });
      \u0275\u0275repeaterCreate(15, CortesListComponent_For_16_Template, 2, 2, "option", 8, _forTrack0);
      \u0275\u0275elementEnd()();
      \u0275\u0275template(17, CortesListComponent_Conditional_17_Template, 8, 2, "div");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(18, "div", 9)(19, "div", 10);
      \u0275\u0275template(20, CortesListComponent_Conditional_20_Template, 2, 0, "p", 11)(21, CortesListComponent_Conditional_21_Template, 5, 1, "div", 12)(22, CortesListComponent_Conditional_22_Template, 5, 0, "div", 13)(23, CortesListComponent_Conditional_23_Template, 20, 1);
      \u0275\u0275elementEnd()()();
    }
    if (rf & 2) {
      \u0275\u0275advance(5);
      \u0275\u0275textInterpolate2(" ", ctx.total(), " ", ctx.total() === 1 ? "causa" : "causas", " en Corte Suprema y Corte de Apelaciones ");
      \u0275\u0275advance();
      \u0275\u0275property("chips", ctx.chipsFiltros());
      \u0275\u0275advance(4);
      \u0275\u0275twoWayProperty("ngModel", ctx.filtroBusqueda);
      \u0275\u0275advance(4);
      \u0275\u0275twoWayProperty("ngModel", ctx.filtroTipo);
      \u0275\u0275advance();
      \u0275\u0275repeater(ctx.opciones);
      \u0275\u0275advance(2);
      \u0275\u0275conditional(ctx.cortesDisponibles().length ? 17 : -1);
      \u0275\u0275advance(3);
      \u0275\u0275conditional(ctx.cargando() ? 20 : ctx.error() ? 21 : !ctx.cortes().length ? 22 : 23);
    }
  }, dependencies: [CommonModule, FormsModule, NgSelectOption, \u0275NgSelectMultipleOption, DefaultValueAccessor, SelectControlValueAccessor, NgControlStatus, NgModel, FiltrosPanelComponent], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(CortesListComponent, [{
    type: Component,
    args: [{
      selector: "app-cortes-list",
      standalone: true,
      imports: [CommonModule, FormsModule, FiltrosPanelComponent],
      template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Corte</h1>
        <p class="text-neutral-500 mt-1">
          {{ total() }} {{ total() === 1 ? 'causa' : 'causas' }} en Corte Suprema y Corte de
          Apelaciones
        </p>
      </div>

      <!-- Filtros: campos en el panel lateral, badges de lo aplicado ac\xE1. -->
      <app-filtros-panel
        [chips]="chipsFiltros()"
        (aplicar)="onFiltrar()"
        (limpiar)="onLimpiarFiltros()"
        (quitar)="quitarFiltro($event)"
      >
        <div>
          <label class="form-label" for="c-busqueda">B\xFAsqueda</label>
          <input
            id="c-busqueda"
            type="text"
            class="form-input"
            placeholder="Car\xE1tula o n\xFAmero de ingreso"
            [(ngModel)]="filtroBusqueda"
            (keyup.enter)="aplicarDesdeCampo()"
          />
        </div>
        <div>
          <label class="form-label" for="c-tipo">Tipo de corte</label>
          <select id="c-tipo" class="form-select" [(ngModel)]="filtroTipo">
            @for (op of opciones; track op.valor) {
              <option [ngValue]="op.valor">{{ op.etiqueta }}</option>
            }
          </select>
        </div>
        @if (cortesDisponibles().length) {
          <div>
            <label class="form-label" for="c-corte">Corte</label>
            <select id="c-corte" class="form-select" [(ngModel)]="filtroCorte">
              <option [ngValue]="''">Todas</option>
              @for (c of cortesDisponibles(); track c) {
                <option [ngValue]="c">{{ c }}</option>
              }
            </select>
          </div>
        }
      </app-filtros-panel>

      <div class="card">
        <div class="card-body">
          @if (cargando()) {
            <p class="text-neutral-500 py-8 text-center">Cargando...</p>
          } @else if (error()) {
            <div class="alert-danger">
              <div class="flex-1">{{ error() }}</div>
              <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">
                Reintentar
              </button>
            </div>
          } @else if (!cortes().length) {
            <div class="py-10 text-center">
              <p class="text-neutral-600 font-medium">No hay causas de corte</p>
              <p class="text-sm text-neutral-500 mt-1">
                Aparecer\xE1n ac\xE1 cuando llegue un estado diario con las hojas de Corte Suprema o
                Corte de Apelaciones.
              </p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>FechaIngreso</th>
                    <th>Caratulado</th>
                    <th>Ubicaci\xF3n</th>
                    <th>FechaUbicaci\xF3n</th>
                    <th>Corte</th>
                    <th>TipoRecurso</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of cortes(); track c.id) {
                    <tr>
                      <td class="whitespace-nowrap">{{ fecha(c.fecha_ingreso) }}</td>
                      <td>{{ c.caratulado || '-' }}</td>
                      <td>{{ c.ubicacion || '-' }}</td>
                      <td class="whitespace-nowrap">{{ fecha(c.fecha_ubicacion) }}</td>
                      <td>{{ c.corte || '-' }}</td>
                      <td>{{ c.tipo_recurso || '-' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (totalPaginas() > 1) {
              <div class="flex items-center justify-between mt-4">
                <p class="text-sm text-neutral-500">
                  P\xE1gina {{ pagina() }} de {{ totalPaginas() }}
                </p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn-secondary btn-sm"
                    [disabled]="pagina() <= 1"
                    (click)="irA(pagina() - 1)"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    class="btn-secondary btn-sm"
                    [disabled]="pagina() >= totalPaginas()"
                    (click)="irA(pagina() + 1)"
                  >
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
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(CortesListComponent, { className: "CortesListComponent", filePath: "src/app/features/estado-diario/components/cortes-list/cortes-list.component.ts", lineNumber: 158 });
})();
export {
  CortesListComponent
};
//# sourceMappingURL=chunk-WYUEVUUT.js.map
