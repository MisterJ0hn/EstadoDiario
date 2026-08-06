import {
  EstadoDiarioService
} from "./chunk-FLTDD2QG.js";
import {
  NotificationService
} from "./chunk-ZKUWYJUU.js";
import {
  ActivatedRoute,
  Router,
  RouterLink
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
  ɵɵattribute,
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
  ɵɵtextInterpolate3
} from "./chunk-WMIGZGXS.js";
import "./chunk-XWLXMCJQ.js";

// src/app/features/estado-diario/components/origenes-list/origenes-list.component.ts
var _forTrack0 = ($index, $item) => $item.key;
var _forTrack1 = ($index, $item) => $item.id;
function OrigenesListComponent_For_14_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 13);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r2.total(), " ");
  }
}
function OrigenesListComponent_For_14_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 12);
    \u0275\u0275listener("click", function OrigenesListComponent_For_14_Template_button_click_0_listener() {
      const t_r2 = \u0275\u0275restoreView(_r1).$implicit;
      const ctx_r2 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r2.selectTab(t_r2.key));
    });
    \u0275\u0275text(1);
    \u0275\u0275template(2, OrigenesListComponent_For_14_Conditional_2_Template, 2, 1, "span", 13);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const t_r2 = ctx.$implicit;
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275classMap(ctx_r2.activeTab() === t_r2.key ? "border-primary-600 text-primary-700" : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300");
    \u0275\u0275attribute("aria-selected", ctx_r2.activeTab() === t_r2.key);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", t_r2.label, " ");
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r2.activeTab() === t_r2.key ? 2 : -1);
  }
}
function OrigenesListComponent_Conditional_15_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 10);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(1, "svg", 14);
    \u0275\u0275element(2, "circle", 15)(3, "path", 16);
    \u0275\u0275elementEnd()();
  }
}
function OrigenesListComponent_Conditional_16_For_23_Conditional_21_Template(rf, ctx) {
  if (rf & 1) {
    const _r4 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 26);
    \u0275\u0275listener("click", function OrigenesListComponent_Conditional_16_For_23_Conditional_21_Template_button_click_0_listener() {
      \u0275\u0275restoreView(_r4);
      const o_r5 = \u0275\u0275nextContext().$implicit;
      const ctx_r2 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r2.onDelete(o_r5.id));
    });
    \u0275\u0275text(1, "Eliminar");
    \u0275\u0275elementEnd();
  }
}
function OrigenesListComponent_Conditional_16_For_23_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "tr")(1, "td", 20);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "td");
    \u0275\u0275text(4);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "td");
    \u0275\u0275text(6);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(7, "td", 21);
    \u0275\u0275text(8);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(9, "td");
    \u0275\u0275text(10);
    \u0275\u0275pipe(11, "date");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(12, "td");
    \u0275\u0275text(13);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(14, "td")(15, "span", 22);
    \u0275\u0275text(16);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(17, "td")(18, "div", 23)(19, "a", 24);
    \u0275\u0275text(20, "Ver");
    \u0275\u0275elementEnd();
    \u0275\u0275template(21, OrigenesListComponent_Conditional_16_For_23_Conditional_21_Template, 2, 0, "button", 25);
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const o_r5 = ctx.$implicit;
    const ctx_r2 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(o_r5.id);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(o_r5.rut || "-");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(o_r5.fecha || "-");
    \u0275\u0275advance();
    \u0275\u0275property("title", o_r5.nombre_archivo || "");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(o_r5.nombre_archivo || "-");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(\u0275\u0275pipeBind2(11, 11, o_r5.fecha_carga, "dd/MM/yyyy HH:mm"));
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(o_r5.usuario_carga || "-");
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(o_r5.total_movimientos);
    \u0275\u0275advance(3);
    \u0275\u0275property("routerLink", ctx_r2.verLink(o_r5))("queryParams", ctx_r2.verQueryParams(o_r5));
    \u0275\u0275advance(2);
    \u0275\u0275conditional(false ? 21 : -1);
  }
}
function OrigenesListComponent_Conditional_16_ForEmpty_24_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "tr")(1, "td", 27);
    \u0275\u0275text(2, " No hay archivos cargados ");
    \u0275\u0275elementEnd()();
  }
}
function OrigenesListComponent_Conditional_16_Conditional_25_Template(rf, ctx) {
  if (rf & 1) {
    const _r6 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 19)(1, "span", 28);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "div", 29)(4, "button", 30);
    \u0275\u0275listener("click", function OrigenesListComponent_Conditional_16_Conditional_25_Template_button_click_4_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r2 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r2.loadPage(ctx_r2.currentPage() - 1));
    });
    \u0275\u0275text(5, "Anterior");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "button", 30);
    \u0275\u0275listener("click", function OrigenesListComponent_Conditional_16_Conditional_25_Template_button_click_6_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r2 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r2.loadPage(ctx_r2.currentPage() + 1));
    });
    \u0275\u0275text(7, "Siguiente");
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate3(" Mostrando p\xE1gina ", ctx_r2.currentPage(), " de ", ctx_r2.totalPages(), " (", ctx_r2.total(), " registros) ");
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r2.currentPage() <= 1);
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r2.currentPage() >= ctx_r2.totalPages());
  }
}
function OrigenesListComponent_Conditional_16_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 11)(1, "div", 17)(2, "table", 18)(3, "thead")(4, "tr")(5, "th");
    \u0275\u0275text(6, "ID");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(7, "th");
    \u0275\u0275text(8, "RUT");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(9, "th");
    \u0275\u0275text(10, "Fecha");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(11, "th");
    \u0275\u0275text(12, "Archivo");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(13, "th");
    \u0275\u0275text(14, "Fecha Carga");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(15, "th");
    \u0275\u0275text(16, "Usuario");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(17, "th");
    \u0275\u0275text(18);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(19, "th");
    \u0275\u0275text(20, "Acciones");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(21, "tbody");
    \u0275\u0275repeaterCreate(22, OrigenesListComponent_Conditional_16_For_23_Template, 22, 14, "tr", null, _forTrack1, false, OrigenesListComponent_Conditional_16_ForEmpty_24_Template, 3, 0, "tr");
    \u0275\u0275elementEnd()()();
    \u0275\u0275template(25, OrigenesListComponent_Conditional_16_Conditional_25_Template, 8, 5, "div", 19);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance(18);
    \u0275\u0275textInterpolate(ctx_r2.columnaContador());
    \u0275\u0275advance(4);
    \u0275\u0275repeater(ctx_r2.origenes());
    \u0275\u0275advance(3);
    \u0275\u0275conditional(ctx_r2.totalPages() > 1 ? 25 : -1);
  }
}
var OrigenesListComponent = class _OrigenesListComponent {
  service = inject(EstadoDiarioService);
  notification = inject(NotificationService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  /** Los tres tipos de Excel que maneja el sistema; el `key` es el valor que espera el backend. */
  tabs = [
    { key: "estado_diario", label: "Estado Diario" },
    { key: "movimientos", label: "Movimientos" },
    { key: "audiencias", label: "Audiencias" }
  ];
  origenes = signal([]);
  loading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);
  activeTab = signal("estado_diario");
  SUBTITULOS = {
    estado_diario: "Archivos de estado diario cargados",
    movimientos: "Archivos de movimientos cargados",
    audiencias: "Archivos de audiencias cargados"
  };
  /** El contador de filas por archivo significa algo distinto en cada pestaña. */
  CONTADORES = {
    estado_diario: "Estado Diario",
    movimientos: "Movimientos",
    audiencias: "Audiencias"
  };
  subtitulo = computed(() => this.SUBTITULOS[this.activeTab()]);
  columnaContador = computed(() => this.CONTADORES[this.activeTab()]);
  ngOnInit() {
    const queryTab = this.route.snapshot.queryParamMap.get("tab");
    this.activeTab.set(this.normalizeTab(queryTab) ?? "estado_diario");
    this.loadPage(1);
  }
  normalizeTab(value) {
    return this.tabs.some((t) => t.key === value) ? value : null;
  }
  selectTab(tab) {
    if (this.activeTab() === tab)
      return;
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: "merge",
      replaceUrl: true
    });
    this.loadPage(1);
  }
  /**
   * "Ver" lleva a la vista que corresponde al tipo de archivo: el estado diario
   * tiene su listado por origen, y los otros dos se filtran por `origen_id` en
   * su propio módulo.
   */
  verLink(o) {
    if (o.tipo === "movimientos")
      return ["/movimientos"];
    if (o.tipo === "audiencias")
      return ["/audiencias"];
    return ["/estado-diario/origen", o.id, "movimientos"];
  }
  verQueryParams(o) {
    return o.tipo === "estado_diario" ? null : { origen_id: o.id };
  }
  loadPage(page) {
    this.loading.set(true);
    this.service.getOrigenes(page, 20, this.activeTab()).subscribe({
      next: (res) => {
        this.origenes.set(res.origenes);
        this.currentPage.set(res.page);
        this.totalPages.set(res.total_pages);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error("Error al cargar los archivos");
      }
    });
  }
  onDelete(id) {
    if (!confirm("\xBFEst\xE1 seguro de eliminar este archivo y todo su estado diario?"))
      return;
    this.service.deleteOrigen(id).subscribe({
      next: () => {
        this.notification.success("Archivo eliminado correctamente");
        this.loadPage(this.currentPage());
      },
      error: () => this.notification.error("Error al eliminar")
    });
  }
  static \u0275fac = function OrigenesListComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _OrigenesListComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _OrigenesListComponent, selectors: [["app-origenes-list"]], decls: 17, vars: 2, consts: [[1, "space-y-6"], [1, "flex", "items-center", "justify-between", "flex-wrap", "gap-4"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], ["routerLink", "/estado-diario/upload", 1, "btn-primary"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-5", "h-5"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M12 4v16m8-8H4"], [1, "border-b", "border-neutral-200"], ["role", "tablist", 1, "-mb-px", "flex", "gap-1", "overflow-x-auto"], ["type", "button", "role", "tab", 1, "flex", "items-center", "gap-2", "whitespace-nowrap", "border-b-2", "px-4", "py-3", "text-sm", "font-medium", "transition-colors", 3, "class"], [1, "flex", "items-center", "justify-center", "py-20"], [1, "card"], ["type", "button", "role", "tab", 1, "flex", "items-center", "gap-2", "whitespace-nowrap", "border-b-2", "px-4", "py-3", "text-sm", "font-medium", "transition-colors", 3, "click"], [1, "rounded-full", "px-2", "py-0.5", "text-xs", "font-semibold", "bg-primary-100", "text-primary-700"], ["viewBox", "0 0 24 24", 1, "animate-spin", "h-10", "w-10", "text-primary-600"], ["cx", "12", "cy", "12", "r", "10", "stroke", "currentColor", "stroke-width", "4", "fill", "none", 1, "opacity-25"], ["fill", "currentColor", "d", "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z", 1, "opacity-75"], [1, "table-wrapper"], [1, "data-table"], [1, "flex", "items-center", "justify-between", "px-6", "py-4", "border-t", "border-neutral-200"], [1, "font-medium"], [1, "max-w-[200px]", "truncate", 3, "title"], [1, "badge-info"], [1, "flex", "items-center", "gap-2"], [1, "btn-outline", "btn-sm", 3, "routerLink", "queryParams"], [1, "btn-danger", "btn-sm"], [1, "btn-danger", "btn-sm", 3, "click"], ["colspan", "8", 1, "text-center", "py-10", "text-neutral-400"], [1, "text-sm", "text-neutral-500"], [1, "flex", "gap-2"], [1, "btn-secondary", "btn-sm", 3, "click", "disabled"]], template: function OrigenesListComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div", 1)(2, "div")(3, "h1", 2);
      \u0275\u0275text(4, "Archivos");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(5, "p", 3);
      \u0275\u0275text(6);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(7, "a", 4);
      \u0275\u0275namespaceSVG();
      \u0275\u0275elementStart(8, "svg", 5);
      \u0275\u0275element(9, "path", 6);
      \u0275\u0275elementEnd();
      \u0275\u0275text(10, " Cargar Archivo ");
      \u0275\u0275elementEnd()();
      \u0275\u0275namespaceHTML();
      \u0275\u0275elementStart(11, "div", 7)(12, "nav", 8);
      \u0275\u0275repeaterCreate(13, OrigenesListComponent_For_14_Template, 3, 5, "button", 9, _forTrack0);
      \u0275\u0275elementEnd()();
      \u0275\u0275template(15, OrigenesListComponent_Conditional_15_Template, 4, 0, "div", 10)(16, OrigenesListComponent_Conditional_16_Template, 26, 3, "div", 11);
      \u0275\u0275elementEnd();
    }
    if (rf & 2) {
      \u0275\u0275advance(6);
      \u0275\u0275textInterpolate(ctx.subtitulo());
      \u0275\u0275advance(7);
      \u0275\u0275repeater(ctx.tabs);
      \u0275\u0275advance(2);
      \u0275\u0275conditional(ctx.loading() ? 15 : 16);
    }
  }, dependencies: [CommonModule, DatePipe, RouterLink], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(OrigenesListComponent, [{
    type: Component,
    args: [{
      selector: "app-origenes-list",
      standalone: true,
      imports: [CommonModule, RouterLink],
      template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-neutral-800">Archivos</h1>
          <p class="text-neutral-500 mt-1">{{ subtitulo() }}</p>
        </div>
        <a routerLink="/estado-diario/upload" class="btn-primary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Cargar Archivo
        </a>
      </div>

      <!-- Pesta\xF1as por tipo de archivo -->
      <div class="border-b border-neutral-200">
        <nav class="-mb-px flex gap-1 overflow-x-auto" role="tablist">
          @for (t of tabs; track t.key) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === t.key"
              (click)="selectTab(t.key)"
              class="flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              [class]="activeTab() === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'"
            >
              {{ t.label }}
              @if (activeTab() === t.key) {
                <span class="rounded-full px-2 py-0.5 text-xs font-semibold bg-primary-100 text-primary-700">
                  {{ total() }}
                </span>
              }
            </button>
          }
        </nav>
      </div>

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
                  <th>ID</th>
                  <th>RUT</th>
                  <th>Fecha</th>
                  <th>Archivo</th>
                  <th>Fecha Carga</th>
                  <th>Usuario</th>
                  <th>{{ columnaContador() }}</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (o of origenes(); track o.id) {
                  <tr>
                    <td class="font-medium">{{ o.id }}</td>
                    <td>{{ o.rut || '-' }}</td>
                    <td>{{ o.fecha || '-' }}</td>
                    <td class="max-w-[200px] truncate" [title]="o.nombre_archivo || ''">{{ o.nombre_archivo || '-' }}</td>
                    <td>{{ o.fecha_carga | date:'dd/MM/yyyy HH:mm' }}</td>
                    <td>{{ o.usuario_carga || '-' }}</td>
                    <td>
                      <span class="badge-info">{{ o.total_movimientos }}</span>
                    </td>
                    <td>
                      <div class="flex items-center gap-2">
                        <a [routerLink]="verLink(o)" [queryParams]="verQueryParams(o)"
                           class="btn-outline btn-sm">Ver</a>
                        <!--
                          Bot\xF3n "Eliminar" oculto por decisi\xF3n de negocio: los archivos
                          cargados no se borran desde la interfaz. El m\xE9todo onDelete() y el
                          llamado a deleteOrigen() se mantienen intactos a prop\xF3sito.
                          Para reactivarlo, cambiar la condici\xF3n del bloque de abajo de
                          false a true (o eliminar el bloque y dejar el bot\xF3n suelto).
                        -->
                        @if (false) {
                          <button (click)="onDelete(o.id)" class="btn-danger btn-sm">Eliminar</button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="text-center py-10 text-neutral-400">
                      No hay archivos cargados
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
                Mostrando p\xE1gina {{ currentPage() }} de {{ totalPages() }} ({{ total() }} registros)
              </span>
              <div class="flex gap-2">
                <button (click)="loadPage(currentPage() - 1)" [disabled]="currentPage() <= 1"
                        class="btn-secondary btn-sm">Anterior</button>
                <button (click)="loadPage(currentPage() + 1)" [disabled]="currentPage() >= totalPages()"
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
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(OrigenesListComponent, { className: "OrigenesListComponent", filePath: "src/app/features/estado-diario/components/origenes-list/origenes-list.component.ts", lineNumber: 136 });
})();
export {
  OrigenesListComponent
};
//# sourceMappingURL=chunk-MHAKWU73.js.map
