import {
  CommonModule,
  Component,
  HostListener,
  effect,
  input,
  output,
  setClassMetadata,
  signal,
  viewChild,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵattribute,
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
  ɵɵprojection,
  ɵɵprojectionDef,
  ɵɵqueryAdvance,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵresetView,
  ɵɵresolveDocument,
  ɵɵrestoreView,
  ɵɵtemplate,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1,
  ɵɵviewQuerySignal
} from "./chunk-WMIGZGXS.js";

// src/app/shared/components/filtros-panel/filtros-panel.component.ts
var _c0 = ["panel"];
var _c1 = ["*"];
var _forTrack0 = ($index, $item) => $item.clave;
function FiltrosPanelComponent_For_2_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "span", 2)(1, "span", 8);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "span", 9);
    \u0275\u0275text(4);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "button", 10);
    \u0275\u0275listener("click", function FiltrosPanelComponent_For_2_Template_button_click_5_listener() {
      const c_r2 = \u0275\u0275restoreView(_r1).$implicit;
      const ctx_r2 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r2.quitar.emit(c_r2.clave));
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(6, "svg", 11);
    \u0275\u0275element(7, "path", 12);
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const c_r2 = ctx.$implicit;
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate1("", c_r2.etiqueta, ":");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(c_r2.valor);
    \u0275\u0275advance();
    \u0275\u0275attribute("aria-label", "Quitar el filtro " + c_r2.etiqueta);
  }
}
function FiltrosPanelComponent_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    const _r4 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 13);
    \u0275\u0275listener("click", function FiltrosPanelComponent_Conditional_3_Template_button_click_0_listener() {
      \u0275\u0275restoreView(_r4);
      const ctx_r2 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r2.limpiar.emit());
    });
    \u0275\u0275text(1, " Limpiar todo ");
    \u0275\u0275elementEnd();
  }
}
function FiltrosPanelComponent_Conditional_8_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 7);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r2.chips().length, " ");
  }
}
function FiltrosPanelComponent_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    const _r5 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 14);
    \u0275\u0275listener("click", function FiltrosPanelComponent_Conditional_9_Template_div_click_0_listener() {
      \u0275\u0275restoreView(_r5);
      const ctx_r2 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r2.cerrar());
    });
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(1, "aside", 15, 0)(3, "header", 16)(4, "h2", 17);
    \u0275\u0275text(5);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "button", 18);
    \u0275\u0275listener("click", function FiltrosPanelComponent_Conditional_9_Template_button_click_6_listener() {
      \u0275\u0275restoreView(_r5);
      const ctx_r2 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r2.cerrar());
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(7, "svg", 19);
    \u0275\u0275element(8, "path", 12);
    \u0275\u0275elementEnd()()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(9, "div", 20);
    \u0275\u0275projection(10);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(11, "footer", 21)(12, "button", 22);
    \u0275\u0275listener("click", function FiltrosPanelComponent_Conditional_9_Template_button_click_12_listener() {
      \u0275\u0275restoreView(_r5);
      const ctx_r2 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r2.onLimpiar());
    });
    \u0275\u0275text(13, "Limpiar");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(14, "button", 23);
    \u0275\u0275listener("click", function FiltrosPanelComponent_Conditional_9_Template_button_click_14_listener() {
      \u0275\u0275restoreView(_r5);
      const ctx_r2 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r2.onAplicar());
    });
    \u0275\u0275text(15, "Aplicar filtros");
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275attribute("aria-label", ctx_r2.titulo());
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r2.titulo());
  }
}
var FiltrosPanelComponent = class _FiltrosPanelComponent {
  chips = input([]);
  titulo = input("Filtros");
  /** Se emite al pulsar "Aplicar filtros"; el panel ya se cerró. */
  aplicar = output();
  /** "Limpiar" dentro del panel y "Limpiar todo" en la barra de badges. */
  limpiar = output();
  /** Clave del chip que el usuario quitó con la ✕. */
  quitar = output();
  abierto = signal(false);
  panel = viewChild("panel");
  /** Quién abrió el panel, para devolverle el foco al cerrar. */
  disparador = null;
  constructor() {
    effect(() => {
      this.panel()?.nativeElement.focus();
    });
  }
  abrir() {
    this.disparador = document.activeElement;
    this.abierto.set(true);
  }
  cerrar() {
    if (!this.abierto()) {
      return;
    }
    this.abierto.set(false);
    this.disparador?.focus();
    this.disparador = null;
  }
  onAplicar() {
    this.cerrar();
    this.aplicar.emit();
  }
  onLimpiar() {
    this.cerrar();
    this.limpiar.emit();
  }
  onEscape() {
    if (this.abierto()) {
      this.cerrar();
    }
  }
  static \u0275fac = function FiltrosPanelComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _FiltrosPanelComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _FiltrosPanelComponent, selectors: [["app-filtros-panel"]], viewQuery: function FiltrosPanelComponent_Query(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275viewQuerySignal(ctx.panel, _c0, 5);
    }
    if (rf & 2) {
      \u0275\u0275queryAdvance();
    }
  }, hostBindings: function FiltrosPanelComponent_HostBindings(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275listener("keydown.escape", function FiltrosPanelComponent_keydown_escape_HostBindingHandler() {
        return ctx.onEscape();
      }, false, \u0275\u0275resolveDocument);
    }
  }, inputs: { chips: [1, "chips"], titulo: [1, "titulo"] }, outputs: { aplicar: "aplicar", limpiar: "limpiar", quitar: "quitar" }, ngContentSelectors: _c1, decls: 10, vars: 3, consts: [["panel", ""], [1, "flex", "items-center", "gap-2", "flex-wrap"], [1, "badge-info", "gap-1", "pl-2.5", "pr-1", "py-1"], ["type", "button", 1, "text-xs", "font-medium", "text-neutral-500", "hover:text-danger-600", "underline", "underline-offset-2", "focus:outline-none", "focus:ring-2", "focus:ring-neutral-300", "rounded", "px-1", "transition-colors"], ["type", "button", 1, "btn-secondary", "btn-sm", "ml-auto", "shrink-0", 3, "click"], ["viewBox", "0 0 20 20", "fill", "currentColor", "aria-hidden", "true", 1, "h-4", "w-4"], ["fill-rule", "evenodd", "d", "M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0\n                   01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0\n                   .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0\n                   00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z", "clip-rule", "evenodd"], [1, "ml-1", "rounded-full", "bg-primary-600", "px-1.5", "py-0.5", "text-xs", "font-semibold", "text-white"], [1, "font-normal", "opacity-70"], [1, "font-semibold"], ["type", "button", 1, "ml-0.5", "rounded-full", "p-0.5", "text-primary-700/60", "hover:bg-primary-200", "hover:text-primary-900", "focus:outline-none", "focus:ring-2", "focus:ring-primary-400", "transition-colors", 3, "click"], ["viewBox", "0 0 20 20", "fill", "currentColor", "aria-hidden", "true", 1, "h-3.5", "w-3.5"], ["d", "M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72\n                       3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"], ["type", "button", 1, "text-xs", "font-medium", "text-neutral-500", "hover:text-danger-600", "underline", "underline-offset-2", "focus:outline-none", "focus:ring-2", "focus:ring-neutral-300", "rounded", "px-1", "transition-colors", 3, "click"], ["aria-hidden", "true", 1, "fixed", "inset-0", "z-40", "bg-black/40", "animar-fondo", 3, "click"], ["tabindex", "-1", "role", "dialog", "aria-modal", "true", 1, "fixed", "right-0", "top-0", "bottom-0", "z-50", "flex", "w-full", "max-w-sm", "flex-col", "bg-white", "shadow-2xl", "outline-none", "animar-panel-derecha"], [1, "flex", "items-center", "justify-between", "border-b", "border-neutral-200", "px-5", "py-4"], [1, "text-lg", "font-semibold", "text-neutral-800"], ["type", "button", "aria-label", "Cerrar el panel de filtros", 1, "rounded-lg", "p-1.5", "text-neutral-400", "hover:bg-neutral-100", "hover:text-neutral-600", "focus:outline-none", "focus:ring-2", "focus:ring-primary-400", "transition-colors", 3, "click"], ["viewBox", "0 0 20 20", "fill", "currentColor", "aria-hidden", "true", 1, "h-5", "w-5"], [1, "flex-1", "space-y-4", "overflow-y-auto", "px-5", "py-5"], [1, "flex", "items-center", "justify-end", "gap-3", "border-t", "border-neutral-200", "px-5", "py-4"], ["type", "button", 1, "btn-secondary", 3, "click"], ["type", "button", 1, "btn-primary", 3, "click"]], template: function FiltrosPanelComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275projectionDef();
      \u0275\u0275elementStart(0, "div", 1);
      \u0275\u0275repeaterCreate(1, FiltrosPanelComponent_For_2_Template, 8, 3, "span", 2, _forTrack0);
      \u0275\u0275template(3, FiltrosPanelComponent_Conditional_3_Template, 2, 0, "button", 3);
      \u0275\u0275elementStart(4, "button", 4);
      \u0275\u0275listener("click", function FiltrosPanelComponent_Template_button_click_4_listener() {
        return ctx.abrir();
      });
      \u0275\u0275namespaceSVG();
      \u0275\u0275elementStart(5, "svg", 5);
      \u0275\u0275element(6, "path", 6);
      \u0275\u0275elementEnd();
      \u0275\u0275text(7, " Filtrar ");
      \u0275\u0275template(8, FiltrosPanelComponent_Conditional_8_Template, 2, 1, "span", 7);
      \u0275\u0275elementEnd()();
      \u0275\u0275template(9, FiltrosPanelComponent_Conditional_9_Template, 16, 2);
    }
    if (rf & 2) {
      \u0275\u0275advance();
      \u0275\u0275repeater(ctx.chips());
      \u0275\u0275advance(2);
      \u0275\u0275conditional(ctx.chips().length > 1 ? 3 : -1);
      \u0275\u0275advance(5);
      \u0275\u0275conditional(ctx.chips().length ? 8 : -1);
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.abierto() ? 9 : -1);
    }
  }, dependencies: [CommonModule], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FiltrosPanelComponent, [{
    type: Component,
    args: [{
      selector: "app-filtros-panel",
      standalone: true,
      imports: [CommonModule],
      template: `
    <div class="flex items-center gap-2 flex-wrap">
      @for (c of chips(); track c.clave) {
        <span class="badge-info gap-1 pl-2.5 pr-1 py-1">
          <span class="font-normal opacity-70">{{ c.etiqueta }}:</span>
          <span class="font-semibold">{{ c.valor }}</span>
          <button
            type="button"
            (click)="quitar.emit(c.clave)"
            [attr.aria-label]="'Quitar el filtro ' + c.etiqueta"
            class="ml-0.5 rounded-full p-0.5 text-primary-700/60 hover:bg-primary-200 hover:text-primary-900
                   focus:outline-none focus:ring-2 focus:ring-primary-400 transition-colors"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72
                       3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </span>
      }

      @if (chips().length > 1) {
        <button
          type="button"
          (click)="limpiar.emit()"
          class="text-xs font-medium text-neutral-500 hover:text-danger-600 underline underline-offset-2
                 focus:outline-none focus:ring-2 focus:ring-neutral-300 rounded px-1 transition-colors"
        >
          Limpiar todo
        </button>
      }

      <!-- ml-auto empuja el bot\xF3n a la derecha aunque no haya ning\xFAn badge -->
      <button type="button" (click)="abrir()" class="btn-secondary btn-sm ml-auto shrink-0">
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0
                   01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0
                   .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0
                   00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z"
                clip-rule="evenodd" />
        </svg>
        Filtrar
        @if (chips().length) {
          <span class="ml-1 rounded-full bg-primary-600 px-1.5 py-0.5 text-xs font-semibold text-white">
            {{ chips().length }}
          </span>
        }
      </button>
    </div>

    @if (abierto()) {
      <div
        class="fixed inset-0 z-40 bg-black/40 animar-fondo"
        (click)="cerrar()"
        aria-hidden="true"
      ></div>

      <aside
        #panel
        tabindex="-1"
        class="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl
               outline-none animar-panel-derecha"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="titulo()"
      >
        <header class="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 class="text-lg font-semibold text-neutral-800">{{ titulo() }}</h2>
          <button
            type="button"
            (click)="cerrar()"
            aria-label="Cerrar el panel de filtros"
            class="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600
                   focus:outline-none focus:ring-2 focus:ring-primary-400 transition-colors"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72
                       3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </header>

        <div class="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <ng-content />
        </div>

        <footer class="flex items-center justify-end gap-3 border-t border-neutral-200 px-5 py-4">
          <button type="button" (click)="onLimpiar()" class="btn-secondary">Limpiar</button>
          <button type="button" (click)="onAplicar()" class="btn-primary">Aplicar filtros</button>
        </footer>
      </aside>
    }
  `
    }]
  }], () => [], { onEscape: [{
    type: HostListener,
    args: ["document:keydown.escape"]
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(FiltrosPanelComponent, { className: "FiltrosPanelComponent", filePath: "src/app/shared/components/filtros-panel/filtros-panel.component.ts", lineNumber: 136 });
})();

export {
  FiltrosPanelComponent
};
//# sourceMappingURL=chunk-KKQNT7IP.js.map
