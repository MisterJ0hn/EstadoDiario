import {
  NotificationService
} from "./chunk-ZKUWYJUU.js";
import {
  AuthService
} from "./chunk-M4LO6B3L.js";
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from "./chunk-O3CMZLWV.js";
import {
  CommonModule,
  Component,
  DestroyRef,
  NgClass,
  RuntimeError,
  UpperCasePipe,
  assertInInjectionContext,
  assertNotInReactiveContext,
  computed,
  filter,
  inject,
  map,
  setClassMetadata,
  signal,
  startWith,
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
  ɵɵpipe,
  ɵɵpipeBind1,
  ɵɵproperty,
  ɵɵpureFunction1,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtemplate,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1,
  ɵɵtextInterpolate2
} from "./chunk-WMIGZGXS.js";
import {
  __spreadProps,
  __spreadValues
} from "./chunk-XWLXMCJQ.js";

// node_modules/@angular/core/fesm2022/rxjs-interop.mjs
function toSignal(source, options) {
  typeof ngDevMode !== "undefined" && ngDevMode && assertNotInReactiveContext(toSignal, "Invoking `toSignal` causes new subscriptions every time. Consider moving `toSignal` outside of the reactive context and read the signal value where needed.");
  const requiresCleanup = !options?.manualCleanup;
  requiresCleanup && !options?.injector && assertInInjectionContext(toSignal);
  const cleanupRef = requiresCleanup ? options?.injector?.get(DestroyRef) ?? inject(DestroyRef) : null;
  const equal = makeToSignalEqual(options?.equal);
  let state;
  if (options?.requireSync) {
    state = signal({
      kind: 0
      /* StateKind.NoValue */
    }, {
      equal
    });
  } else {
    state = signal({
      kind: 1,
      value: options?.initialValue
    }, {
      equal
    });
  }
  let destroyUnregisterFn;
  const sub = source.subscribe({
    next: (value) => state.set({
      kind: 1,
      value
    }),
    error: (error) => {
      if (options?.rejectErrors) {
        throw error;
      }
      state.set({
        kind: 2,
        error
      });
    },
    complete: () => {
      destroyUnregisterFn?.();
    }
    // Completion of the Observable is meaningless to the signal. Signals don't have a concept of
    // "complete".
  });
  if (options?.requireSync && state().kind === 0) {
    throw new RuntimeError(601, (typeof ngDevMode === "undefined" || ngDevMode) && "`toSignal()` called with `requireSync` but `Observable` did not emit synchronously.");
  }
  destroyUnregisterFn = cleanupRef?.onDestroy(sub.unsubscribe.bind(sub));
  return computed(() => {
    const current = state();
    switch (current.kind) {
      case 1:
        return current.value;
      case 2:
        throw current.error;
      case 0:
        throw new RuntimeError(601, (typeof ngDevMode === "undefined" || ngDevMode) && "`toSignal()` called with `requireSync` but `Observable` did not emit synchronously.");
    }
  }, {
    equal: options?.equal
  });
}
function makeToSignalEqual(userEquality = Object.is) {
  return (a, b) => a.kind === 1 && b.kind === 1 && userEquality(a.value, b.value);
}

// src/app/features/layout/layout.component.ts
var _c0 = (a0) => ({ exact: a0 });
var _forTrack0 = ($index, $item) => $item.id;
var _forTrack1 = ($index, $item) => $item.titulo;
var _forTrack2 = ($index, $item) => $item.etiqueta;
var _forTrack3 = ($index, $item) => $item.ruta;
function LayoutComponent_For_2_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 29);
    \u0275\u0275listener("click", function LayoutComponent_For_2_Template_div_click_0_listener() {
      const n_r2 = \u0275\u0275restoreView(_r1).$implicit;
      const ctx_r2 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r2.notificationService.dismiss(n_r2.id));
    });
    \u0275\u0275elementStart(1, "span", 30);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "span", 31);
    \u0275\u0275text(4, "\xD7");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const n_r2 = ctx.$implicit;
    \u0275\u0275classProp("alert-success", n_r2.type === "success")("alert-danger", n_r2.type === "error")("alert-warning", n_r2.type === "warning")("alert-info", n_r2.type === "info");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(n_r2.message);
  }
}
function LayoutComponent_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    const _r4 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 32);
    \u0275\u0275listener("click", function LayoutComponent_Conditional_3_Template_div_click_0_listener() {
      \u0275\u0275restoreView(_r4);
      const ctx_r2 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r2.mobileOpen.set(false));
    });
    \u0275\u0275elementEnd();
  }
}
function LayoutComponent_Conditional_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 6);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r2.marca.largo);
  }
}
function LayoutComponent_Conditional_8_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 7);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r2.marca.corto);
  }
}
function LayoutComponent_For_14_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 33);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const grupo_r5 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", grupo_r5.titulo, " ");
  }
}
function LayoutComponent_For_14_For_3_Conditional_0_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 38);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(2, "svg", 39);
    \u0275\u0275element(3, "path", 40);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const item_r7 = \u0275\u0275nextContext(2).$implicit;
    const ctx_r2 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(item_r7.etiqueta);
    \u0275\u0275advance();
    \u0275\u0275classProp("rotate-90", ctx_r2.estaAbierto(item_r7));
  }
}
function LayoutComponent_For_14_For_3_Conditional_0_Conditional_4_For_1_Template(rf, ctx) {
  if (rf & 1) {
    const _r8 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "a", 42);
    \u0275\u0275listener("click", function LayoutComponent_For_14_For_3_Conditional_0_Conditional_4_For_1_Template_a_click_0_listener() {
      \u0275\u0275restoreView(_r8);
      const ctx_r2 = \u0275\u0275nextContext(5);
      return \u0275\u0275resetView(ctx_r2.mobileOpen.set(false));
    });
    \u0275\u0275elementStart(1, "span");
    \u0275\u0275text(2);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const hijo_r9 = ctx.$implicit;
    \u0275\u0275property("routerLink", hijo_r9.ruta)("routerLinkActiveOptions", \u0275\u0275pureFunction1(3, _c0, !!hijo_r9.exacto));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(hijo_r9.etiqueta);
  }
}
function LayoutComponent_For_14_For_3_Conditional_0_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275repeaterCreate(0, LayoutComponent_For_14_For_3_Conditional_0_Conditional_4_For_1_Template, 3, 5, "a", 41, _forTrack3);
  }
  if (rf & 2) {
    const item_r7 = \u0275\u0275nextContext(2).$implicit;
    \u0275\u0275repeater(item_r7.hijos);
  }
}
function LayoutComponent_For_14_For_3_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r6 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 35);
    \u0275\u0275listener("click", function LayoutComponent_For_14_For_3_Conditional_0_Template_button_click_0_listener() {
      \u0275\u0275restoreView(_r6);
      const item_r7 = \u0275\u0275nextContext().$implicit;
      const ctx_r2 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r2.alternarGrupo(item_r7.etiqueta));
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(1, "svg", 36);
    \u0275\u0275element(2, "path", 37);
    \u0275\u0275elementEnd();
    \u0275\u0275template(3, LayoutComponent_For_14_For_3_Conditional_0_Conditional_3_Template, 4, 3);
    \u0275\u0275elementEnd();
    \u0275\u0275template(4, LayoutComponent_For_14_For_3_Conditional_0_Conditional_4_Template, 2, 0);
  }
  if (rf & 2) {
    const item_r7 = \u0275\u0275nextContext().$implicit;
    const ctx_r2 = \u0275\u0275nextContext(2);
    \u0275\u0275classMap(ctx_r2.hayHijoActivo(item_r7) ? "text-primary-400" : "text-neutral-300");
    \u0275\u0275attribute("aria-expanded", ctx_r2.estaAbierto(item_r7))("title", ctx_r2.showLabels() ? null : item_r7.etiqueta);
    \u0275\u0275advance(2);
    \u0275\u0275attribute("d", item_r7.icono);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r2.showLabels() ? 3 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r2.estaAbierto(item_r7) && ctx_r2.showLabels() ? 4 : -1);
  }
}
function LayoutComponent_For_14_For_3_Conditional_1_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span");
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const item_r7 = \u0275\u0275nextContext(2).$implicit;
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(item_r7.etiqueta);
  }
}
function LayoutComponent_For_14_For_3_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    const _r10 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "a", 43);
    \u0275\u0275listener("click", function LayoutComponent_For_14_For_3_Conditional_1_Template_a_click_0_listener() {
      \u0275\u0275restoreView(_r10);
      const ctx_r2 = \u0275\u0275nextContext(3);
      return \u0275\u0275resetView(ctx_r2.mobileOpen.set(false));
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(1, "svg", 36);
    \u0275\u0275element(2, "path", 37);
    \u0275\u0275elementEnd();
    \u0275\u0275template(3, LayoutComponent_For_14_For_3_Conditional_1_Conditional_3_Template, 2, 1, "span");
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const item_r7 = \u0275\u0275nextContext().$implicit;
    const ctx_r2 = \u0275\u0275nextContext(2);
    \u0275\u0275property("routerLink", item_r7.ruta)("routerLinkActiveOptions", \u0275\u0275pureFunction1(5, _c0, !!item_r7.exacto));
    \u0275\u0275attribute("title", ctx_r2.showLabels() ? null : item_r7.etiqueta);
    \u0275\u0275advance(2);
    \u0275\u0275attribute("d", item_r7.icono);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r2.showLabels() ? 3 : -1);
  }
}
function LayoutComponent_For_14_For_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275template(0, LayoutComponent_For_14_For_3_Conditional_0_Template, 5, 7)(1, LayoutComponent_For_14_For_3_Conditional_1_Template, 4, 7, "a", 34);
  }
  if (rf & 2) {
    const item_r7 = ctx.$implicit;
    \u0275\u0275conditional(item_r7.hijos ? 0 : 1);
  }
}
function LayoutComponent_For_14_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div");
    \u0275\u0275template(1, LayoutComponent_For_14_Conditional_1_Template, 2, 1, "p", 33);
    \u0275\u0275repeaterCreate(2, LayoutComponent_For_14_For_3_Template, 2, 1, null, null, _forTrack2);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const grupo_r5 = ctx.$implicit;
    const \u0275$index_37_r11 = ctx.$index;
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275classMap(\u0275$index_37_r11 === 0 ? "" : "pt-4 mt-2 border-t border-neutral-700");
    \u0275\u0275advance();
    \u0275\u0275conditional(grupo_r5.titulo && ctx_r2.showLabels() ? 1 : -1);
    \u0275\u0275advance();
    \u0275\u0275repeater(grupo_r5.items);
  }
}
function LayoutComponent_Conditional_20_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 16)(1, "p", 44);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "p", 45);
    \u0275\u0275text(4);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    let tmp_1_0;
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate2("", (tmp_1_0 = ctx_r2.auth.user()) == null ? null : tmp_1_0.nombre, " ", (tmp_1_0 = ctx_r2.auth.user()) == null ? null : tmp_1_0.apellido, "");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r2.etiquetaRol());
  }
}
function LayoutComponent_Conditional_22_Template(rf, ctx) {
  if (rf & 1) {
    const _r12 = \u0275\u0275getCurrentView();
    \u0275\u0275element(0, "div", 30);
    \u0275\u0275elementStart(1, "button", 46);
    \u0275\u0275listener("click", function LayoutComponent_Conditional_22_Template_button_click_1_listener() {
      \u0275\u0275restoreView(_r12);
      const ctx_r2 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r2.auth.logout());
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(2, "svg", 26);
    \u0275\u0275element(3, "path", 27);
    \u0275\u0275elementEnd()();
  }
}
function LayoutComponent_Conditional_33_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 24);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275property("title", ctx_r2.nombreCliente());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r2.nombreCliente(), " ");
  }
}
var ICONO = {
  grafico: "M3 12h4l3 8 4-16 3 8h4",
  carpeta: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  subir: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  sobre: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  portapapeles: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  reloj: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  balanza: "M12 3v18m-7-5l3-7 3 7m-6 0a3 3 0 006 0m4 0l3-7 3 7m-6 0a3 3 0 006 0M5 6h14",
  calendario: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  barras: "M9 17v-6m3 6V7m3 10v-4M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  bitacora: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  usuarios: "M17 20h5v-1a3 3 0 00-5.356-1.857M17 20H7m10 0v-1c0-.656-.126-1.283-.356-1.857M7 20H2v-1a3 3 0 015.356-1.857M7 20v-1c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  edificio: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  engranaje: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
};
var MENU_CLIENTE = [
  {
    titulo: null,
    items: [
      { ruta: "/dashboard", etiqueta: "Dashboard", icono: ICONO.grafico },
      { ruta: "/estado-diario", etiqueta: "Bit\xE1cora", icono: ICONO.carpeta, exacto: true },
      { ruta: "/estado-diario/upload", etiqueta: "Cargar Archivo", icono: ICONO.subir },
      {
        etiqueta: "Estado Diario",
        icono: ICONO.sobre,
        hijos: [
          { ruta: "/estado-diario/movimientos", etiqueta: "Materia", icono: ICONO.sobre },
          { ruta: "/estado-diario/cortes", etiqueta: "Corte", icono: ICONO.balanza }
        ]
      },
      {
        etiqueta: "Movimientos",
        icono: ICONO.portapapeles,
        hijos: [
          { ruta: "/movimientos", etiqueta: "Materia", icono: ICONO.portapapeles, exacto: true },
          { ruta: "/movimientos/cortes", etiqueta: "Corte", icono: ICONO.balanza }
        ]
      },
      { ruta: "/audiencias", etiqueta: "Audiencias", icono: ICONO.reloj },
      { ruta: "/estado-diario/calendario", etiqueta: "Calendario", icono: ICONO.calendario },
      { ruta: "/informes", etiqueta: "Reportes", icono: ICONO.barras }
    ]
  }
];
var MENU_ADMIN_CLIENTE = {
  titulo: "Administraci\xF3n",
  items: [
    { ruta: "/configuracion/usuarios", etiqueta: "Usuarios y permisos", icono: ICONO.usuarios },
    { ruta: "/configuracion/correo/log", etiqueta: "Bit\xE1cora de Correo", icono: ICONO.bitacora }
  ]
};
var LayoutComponent = class _LayoutComponent {
  auth = inject(AuthService);
  notificationService = inject(NotificationService);
  collapsed = signal(false);
  mobileOpen = signal(false);
  /** En móvil el menú siempre muestra los textos; en escritorio depende de si está contraído. */
  showLabels = computed(() => !this.collapsed() || this.mobileOpen());
  router = inject(Router);
  /** URL actual, para saber qué grupo del menú corresponde al lugar donde uno
   *  está parado. Se sigue con una señal y no leyendo `router.url` en el
   *  template: eso no se reevalúa al navegar. */
  urlActual = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects), startWith(this.router.url)), { initialValue: this.router.url });
  /**
   * Grupos que el usuario abrió o cerró a mano. Lo que NO está acá sigue la
   * regla por defecto: un grupo se ve abierto si la ruta actual es de alguno
   * de sus hijos, para que al entrar por un enlace directo el menú muestre
   * dónde está uno parado.
   */
  gruposAlternados = signal({});
  alternarGrupo(etiqueta) {
    if (this.collapsed())
      this.collapsed.set(false);
    const item = this.buscarGrupo(etiqueta);
    const abiertoAhora = item ? this.estaAbierto(item) : false;
    this.gruposAlternados.update((estado) => __spreadProps(__spreadValues({}, estado), { [etiqueta]: !abiertoAhora }));
  }
  estaAbierto(item) {
    const decidido = this.gruposAlternados()[item.etiqueta];
    return decidido ?? this.hayHijoActivo(item);
  }
  /** true si la ruta actual pertenece a alguno de los hijos del grupo. */
  hayHijoActivo(item) {
    const url = this.urlActual();
    return (item.hijos ?? []).some((h) => h.exacto ? url === h.ruta : !!h.ruta && url.startsWith(h.ruta));
  }
  buscarGrupo(etiqueta) {
    for (const grupo of this.menu()) {
      const encontrado = grupo.items.find((i) => i.etiqueta === etiqueta);
      if (encontrado)
        return encontrado;
    }
    return void 0;
  }
  /** La app móvil es solo para estudios: el administrador del estudio suma su
   *  bloque, y no hay menú de plataforma (esa consola se usa del navegador). */
  menu = computed(() => this.auth.isAdmin() ? [...MENU_CLIENTE, MENU_ADMIN_CLIENTE] : MENU_CLIENTE);
  /** Nombre del estudio de la sesión actual, para la barra superior. */
  nombreCliente = computed(() => this.auth.user()?.cliente_nombre ?? "");
  marca = { largo: "Estado Diario", corto: "ED" };
  etiquetaRol = computed(() => this.auth.user()?.rol === "admin" ? "Administrador" : "Usuario");
  static \u0275fac = function LayoutComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _LayoutComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _LayoutComponent, selectors: [["app-layout"]], decls: 39, vars: 11, consts: [[1, "fixed", "top-4", "right-4", "z-[60]", "flex", "flex-col", "gap-2", "max-w-sm"], [1, "alert", "cursor-pointer", 3, "alert-success", "alert-danger", "alert-warning", "alert-info"], [1, "fixed", "inset-0", "bg-black/50", "z-30", "md:hidden"], [1, "flex", "flex-col", "md:flex-row", "h-screen"], [1, "bg-neutral-900", "text-white", "flex", "flex-col", "transition-all", "duration-300", "shrink-0", "fixed", "inset-x-0", "top-0", "z-40", "w-full", "max-h-[90vh]", "overflow-y-auto", "shadow-xl", "md:static", "md:z-auto", "md:max-h-none", "md:h-auto", "md:overflow-visible", "md:shadow-none", "md:flex", 3, "ngClass"], [1, "h-16", "flex", "items-center", "justify-between", "px-4", "border-b", "border-neutral-700", "shrink-0"], [1, "text-lg", "font-bold", "tracking-tight"], [1, "text-lg", "font-bold", "mx-auto"], ["aria-label", "Cerrar men\xFA", 1, "text-neutral-400", "hover:text-white", "md:hidden", 3, "click"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-6", "h-6"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M6 18L18 6M6 6l12 12"], [1, "flex-1", "py-4", "space-y-1", "overflow-y-auto"], [3, "class"], [1, "border-t", "border-neutral-700", "p-4", "shrink-0"], ["routerLink", "/perfil", 1, "flex", "items-center", "gap-3", "group", 3, "click"], [1, "w-8", "h-8", "rounded-full", "bg-primary-600", "flex", "items-center", "justify-center", "text-sm", "font-bold", "shrink-0"], [1, "flex-1", "min-w-0"], [1, "flex", "items-center", "gap-3", "mt-1"], [1, "flex-1", "flex", "flex-col", "overflow-hidden", "min-h-0"], [1, "h-16", "bg-white", "border-b", "border-neutral-200", "flex", "items-center", "gap-3", "px-4", "md:px-6", "shrink-0"], ["aria-label", "Abrir men\xFA", 1, "text-neutral-500", "hover:text-neutral-700", "md:hidden", 3, "click"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M4 6h16M4 12h16M4 18h16"], ["aria-label", "Contraer men\xFA", 1, "text-neutral-500", "hover:text-neutral-700", "hidden", "md:block", 3, "click"], [1, "text-base", "md:text-lg", "font-semibold", "text-neutral-800", "truncate"], [1, "badge-neutral", "shrink-0", "max-w-[12rem]", "truncate", 3, "title"], ["aria-label", "Cerrar sesi\xF3n", 1, "ml-auto", "text-neutral-500", "hover:text-neutral-700", "md:hidden", 3, "click"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-5", "h-5"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"], [1, "flex-1", "overflow-y-auto", "p-4", "md:p-6", "bg-neutral-50"], [1, "alert", "cursor-pointer", 3, "click"], [1, "flex-1"], [1, "text-current", "opacity-60", "hover:opacity-100"], [1, "fixed", "inset-0", "bg-black/50", "z-30", "md:hidden", 3, "click"], [1, "px-4", "pb-1", "text-xs", "uppercase", "tracking-wide", "text-neutral-500"], ["routerLinkActive", "bg-primary-600/20 text-primary-400 border-r-2 border-primary-400", 1, "flex", "items-center", "gap-3", "px-4", "py-2.5", "text-sm", "text-neutral-300", "hover:text-white", "hover:bg-neutral-800", "transition-colors", 3, "routerLink", "routerLinkActiveOptions"], ["type", "button", 1, "w-full", "flex", "items-center", "gap-3", "px-4", "py-2.5", "text-sm", "transition-colors", "hover:text-white", "hover:bg-neutral-800", 3, "click"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-5", "h-5", "shrink-0"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2"], [1, "flex-1", "text-left"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-4", "h-4", "shrink-0", "transition-transform"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M9 5l7 7-7 7"], ["routerLinkActive", "bg-primary-600/20 text-primary-400 border-r-2 border-primary-400", 1, "flex", "items-center", "gap-3", "py-2", "pr-4", "text-sm", "text-neutral-400", "hover:text-white", "hover:bg-neutral-800", "transition-colors", 2, "padding-left", "3.25rem", 3, "routerLink", "routerLinkActiveOptions"], ["routerLinkActive", "bg-primary-600/20 text-primary-400 border-r-2 border-primary-400", 1, "flex", "items-center", "gap-3", "py-2", "pr-4", "text-sm", "text-neutral-400", "hover:text-white", "hover:bg-neutral-800", "transition-colors", 2, "padding-left", "3.25rem", 3, "click", "routerLink", "routerLinkActiveOptions"], ["routerLinkActive", "bg-primary-600/20 text-primary-400 border-r-2 border-primary-400", 1, "flex", "items-center", "gap-3", "px-4", "py-2.5", "text-sm", "text-neutral-300", "hover:text-white", "hover:bg-neutral-800", "transition-colors", 3, "click", "routerLink", "routerLinkActiveOptions"], [1, "text-sm", "font-medium", "truncate", "group-hover:underline"], [1, "text-xs", "text-neutral-400", "truncate"], ["aria-label", "Cerrar sesi\xF3n", 1, "text-neutral-400", "hover:text-white", 3, "click"]], template: function LayoutComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0);
      \u0275\u0275repeaterCreate(1, LayoutComponent_For_2_Template, 5, 9, "div", 1, _forTrack0);
      \u0275\u0275elementEnd();
      \u0275\u0275template(3, LayoutComponent_Conditional_3_Template, 1, 0, "div", 2);
      \u0275\u0275elementStart(4, "div", 3)(5, "aside", 4)(6, "div", 5);
      \u0275\u0275template(7, LayoutComponent_Conditional_7_Template, 2, 1, "span", 6)(8, LayoutComponent_Conditional_8_Template, 2, 1, "span", 7);
      \u0275\u0275elementStart(9, "button", 8);
      \u0275\u0275listener("click", function LayoutComponent_Template_button_click_9_listener() {
        return ctx.mobileOpen.set(false);
      });
      \u0275\u0275namespaceSVG();
      \u0275\u0275elementStart(10, "svg", 9);
      \u0275\u0275element(11, "path", 10);
      \u0275\u0275elementEnd()()();
      \u0275\u0275namespaceHTML();
      \u0275\u0275elementStart(12, "nav", 11);
      \u0275\u0275repeaterCreate(13, LayoutComponent_For_14_Template, 4, 3, "div", 12, _forTrack1);
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(15, "div", 13)(16, "a", 14);
      \u0275\u0275listener("click", function LayoutComponent_Template_a_click_16_listener() {
        return ctx.mobileOpen.set(false);
      });
      \u0275\u0275elementStart(17, "div", 15);
      \u0275\u0275text(18);
      \u0275\u0275pipe(19, "uppercase");
      \u0275\u0275elementEnd();
      \u0275\u0275template(20, LayoutComponent_Conditional_20_Template, 5, 3, "div", 16);
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(21, "div", 17);
      \u0275\u0275template(22, LayoutComponent_Conditional_22_Template, 4, 0);
      \u0275\u0275elementEnd()()();
      \u0275\u0275elementStart(23, "main", 18)(24, "header", 19)(25, "button", 20);
      \u0275\u0275listener("click", function LayoutComponent_Template_button_click_25_listener() {
        return ctx.mobileOpen.set(!ctx.mobileOpen());
      });
      \u0275\u0275namespaceSVG();
      \u0275\u0275elementStart(26, "svg", 9);
      \u0275\u0275element(27, "path", 21);
      \u0275\u0275elementEnd()();
      \u0275\u0275namespaceHTML();
      \u0275\u0275elementStart(28, "button", 22);
      \u0275\u0275listener("click", function LayoutComponent_Template_button_click_28_listener() {
        return ctx.collapsed.set(!ctx.collapsed());
      });
      \u0275\u0275namespaceSVG();
      \u0275\u0275elementStart(29, "svg", 9);
      \u0275\u0275element(30, "path", 21);
      \u0275\u0275elementEnd()();
      \u0275\u0275namespaceHTML();
      \u0275\u0275elementStart(31, "h2", 23);
      \u0275\u0275text(32, "Estado Diario CRM");
      \u0275\u0275elementEnd();
      \u0275\u0275template(33, LayoutComponent_Conditional_33_Template, 2, 2, "span", 24);
      \u0275\u0275elementStart(34, "button", 25);
      \u0275\u0275listener("click", function LayoutComponent_Template_button_click_34_listener() {
        return ctx.auth.logout();
      });
      \u0275\u0275namespaceSVG();
      \u0275\u0275elementStart(35, "svg", 26);
      \u0275\u0275element(36, "path", 27);
      \u0275\u0275elementEnd()()();
      \u0275\u0275namespaceHTML();
      \u0275\u0275elementStart(37, "div", 28);
      \u0275\u0275element(38, "router-outlet");
      \u0275\u0275elementEnd()()();
    }
    if (rf & 2) {
      let tmp_6_0;
      \u0275\u0275advance();
      \u0275\u0275repeater(ctx.notificationService.notifications());
      \u0275\u0275advance(2);
      \u0275\u0275conditional(ctx.mobileOpen() ? 3 : -1);
      \u0275\u0275advance(2);
      \u0275\u0275classProp("hidden", !ctx.mobileOpen());
      \u0275\u0275property("ngClass", ctx.collapsed() ? "md:w-16" : "md:w-64");
      \u0275\u0275advance(2);
      \u0275\u0275conditional(ctx.showLabels() ? 7 : 8);
      \u0275\u0275advance(6);
      \u0275\u0275repeater(ctx.menu());
      \u0275\u0275advance(5);
      \u0275\u0275textInterpolate1(" ", \u0275\u0275pipeBind1(19, 9, (((tmp_6_0 = ctx.auth.user()) == null ? null : tmp_6_0.nombre) || "U")[0]), " ");
      \u0275\u0275advance(2);
      \u0275\u0275conditional(ctx.showLabels() ? 20 : -1);
      \u0275\u0275advance(2);
      \u0275\u0275conditional(ctx.showLabels() ? 22 : -1);
      \u0275\u0275advance(11);
      \u0275\u0275conditional(ctx.nombreCliente() ? 33 : -1);
    }
  }, dependencies: [CommonModule, NgClass, UpperCasePipe, RouterOutlet, RouterLink, RouterLinkActive], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(LayoutComponent, [{
    type: Component,
    args: [{
      selector: "app-layout",
      standalone: true,
      imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
      template: `
    <!-- Notifications -->
    <div class="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
      @for (n of notificationService.notifications(); track n.id) {
        <div
          class="alert cursor-pointer"
          [class.alert-success]="n.type === 'success'"
          [class.alert-danger]="n.type === 'error'"
          [class.alert-warning]="n.type === 'warning'"
          [class.alert-info]="n.type === 'info'"
          (click)="notificationService.dismiss(n.id)"
        >
          <span class="flex-1">{{ n.message }}</span>
          <span class="text-current opacity-60 hover:opacity-100">&times;</span>
        </div>
      }
    </div>

    <!-- Backdrop (solo m\xF3vil) -->
    @if (mobileOpen()) {
      <div class="fixed inset-0 bg-black/50 z-30 md:hidden" (click)="mobileOpen.set(false)"></div>
    }

    <div class="flex flex-col md:flex-row h-screen">
      <!-- Sidebar: en m\xF3vil se despliega desde la parte superior -->
      <aside
        class="bg-neutral-900 text-white flex flex-col transition-all duration-300 shrink-0
               fixed inset-x-0 top-0 z-40 w-full max-h-[90vh] overflow-y-auto shadow-xl
               md:static md:z-auto md:max-h-none md:h-auto md:overflow-visible md:shadow-none md:flex"
        [class.hidden]="!mobileOpen()"
        [ngClass]="collapsed() ? 'md:w-16' : 'md:w-64'"
      >
        <div class="h-16 flex items-center justify-between px-4 border-b border-neutral-700 shrink-0">
          @if (showLabels()) {
            <span class="text-lg font-bold tracking-tight">{{ marca.largo }}</span>
          } @else {
            <span class="text-lg font-bold mx-auto">{{ marca.corto }}</span>
          }
          <button (click)="mobileOpen.set(false)" class="text-neutral-400 hover:text-white md:hidden"
                  aria-label="Cerrar men\xFA">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav class="flex-1 py-4 space-y-1 overflow-y-auto">
          @for (grupo of menu(); track grupo.titulo; let primero = $first) {
            <div [class]="primero ? '' : 'pt-4 mt-2 border-t border-neutral-700'">
              @if (grupo.titulo && showLabels()) {
                <p class="px-4 pb-1 text-xs uppercase tracking-wide text-neutral-500">
                  {{ grupo.titulo }}
                </p>
              }
              @for (item of grupo.items; track item.etiqueta) {
                @if (item.hijos) {
                  <!-- \xCDtem con submen\xFA: no navega, abre y cierra el grupo. -->
                  <button
                    type="button"
                    (click)="alternarGrupo(item.etiqueta)"
                    [attr.aria-expanded]="estaAbierto(item)"
                    [attr.title]="showLabels() ? null : item.etiqueta"
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                           hover:text-white hover:bg-neutral-800"
                    [class]="hayHijoActivo(item) ? 'text-primary-400' : 'text-neutral-300'"
                  >
                    <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="item.icono" />
                    </svg>
                    @if (showLabels()) {
                      <span class="flex-1 text-left">{{ item.etiqueta }}</span>
                      <svg class="w-4 h-4 shrink-0 transition-transform"
                           [class.rotate-90]="estaAbierto(item)"
                           fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    }
                  </button>

                  @if (estaAbierto(item) && showLabels()) {
                    @for (hijo of item.hijos; track hijo.ruta) {
                      <a
                        [routerLink]="hijo.ruta"
                        routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
                        [routerLinkActiveOptions]="{ exact: !!hijo.exacto }"
                        (click)="mobileOpen.set(false)"
                        class="flex items-center gap-3 py-2 pr-4 text-sm text-neutral-400
                               hover:text-white hover:bg-neutral-800 transition-colors"
                        style="padding-left: 3.25rem"
                      >
                        <span>{{ hijo.etiqueta }}</span>
                      </a>
                    }
                  }
                } @else {
                  <a
                    [routerLink]="item.ruta"
                    routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
                    [routerLinkActiveOptions]="{ exact: !!item.exacto }"
                    (click)="mobileOpen.set(false)"
                    [attr.title]="showLabels() ? null : item.etiqueta"
                    class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                  >
                    <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="item.icono" />
                    </svg>
                    @if (showLabels()) {
                      <span>{{ item.etiqueta }}</span>
                    }
                  </a>
                }
              }
            </div>
          }
        </nav>

        <div class="border-t border-neutral-700 p-4 shrink-0">
          <a routerLink="/perfil" (click)="mobileOpen.set(false)" class="flex items-center gap-3 group">
            <div class="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold shrink-0">
              {{ (auth.user()?.nombre || 'U')[0] | uppercase }}
            </div>
            @if (showLabels()) {
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate group-hover:underline">{{ auth.user()?.nombre }} {{ auth.user()?.apellido }}</p>
                <p class="text-xs text-neutral-400 truncate">{{ etiquetaRol() }}</p>
              </div>
            }
          </a>
          <div class="flex items-center gap-3 mt-1">
            @if (showLabels()) {
              <div class="flex-1"></div>
              <button (click)="auth.logout()" class="text-neutral-400 hover:text-white" aria-label="Cerrar sesi\xF3n">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            }
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col overflow-hidden min-h-0">
        <header class="h-16 bg-white border-b border-neutral-200 flex items-center gap-3 px-4 md:px-6 shrink-0">
          <!-- Toggle m\xF3vil -->
          <button (click)="mobileOpen.set(!mobileOpen())" class="text-neutral-500 hover:text-neutral-700 md:hidden"
                  aria-label="Abrir men\xFA">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <!-- Toggle escritorio -->
          <button (click)="collapsed.set(!collapsed())" class="text-neutral-500 hover:text-neutral-700 hidden md:block"
                  aria-label="Contraer men\xFA">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h2 class="text-base md:text-lg font-semibold text-neutral-800 truncate">Estado Diario CRM</h2>

          <!-- Con varios estudios en la misma plataforma, saber en cu\xE1l se est\xE1
               parado deja de ser un adorno: va fijo en la barra superior. -->
          @if (nombreCliente()) {
            <span class="badge-neutral shrink-0 max-w-[12rem] truncate" [title]="nombreCliente()">
              {{ nombreCliente() }}
            </span>
          }

          <button (click)="auth.logout()" class="ml-auto text-neutral-500 hover:text-neutral-700 md:hidden"
                  aria-label="Cerrar sesi\xF3n">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto p-4 md:p-6 bg-neutral-50">
          <router-outlet />
        </div>
      </main>
    </div>
  `
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(LayoutComponent, { className: "LayoutComponent", filePath: "src/app/features/layout/layout.component.ts", lineNumber: 293 });
})();
export {
  LayoutComponent
};
/*! Bundled license information:

@angular/core/fesm2022/rxjs-interop.mjs:
  (**
   * @license Angular v19.2.25
   * (c) 2010-2025 Google LLC. https://angular.io/
   * License: MIT
   *)
*/
//# sourceMappingURL=chunk-USF42FRU.js.map
