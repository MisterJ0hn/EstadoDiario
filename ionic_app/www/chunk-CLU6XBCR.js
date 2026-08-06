import {
  NotificationService
} from "./chunk-ZKUWYJUU.js";
import {
  FormsModule
} from "./chunk-2XI3ELAA.js";
import {
  CommonModule,
  Component,
  HttpClient,
  Injectable,
  environment,
  inject,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵclassMap,
  ɵɵconditional,
  ɵɵdefineComponent,
  ɵɵdefineInjectable,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetCurrentView,
  ɵɵlistener,
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

// src/app/features/configuracion/services/usuario.service.ts
var UsuarioService = class _UsuarioService {
  apiUrl = `${environment.apiUrl}/usuarios`;
  http = inject(HttpClient);
  /** Usuarios con sus jurisdicciones, más el catálogo para poder asignarlas. */
  permisos() {
    return this.http.get(`${this.apiUrl}/permisos`);
  }
  /**
   * Reemplaza las jurisdicciones de un usuario.
   * Lista vacía = ve todas (no "no ve nada").
   */
  guardarPermisos(id, jurisdicciones) {
    return this.http.put(`${this.apiUrl}/${id}/permisos`, { jurisdicciones });
  }
  static \u0275fac = function UsuarioService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _UsuarioService)();
  };
  static \u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _UsuarioService, factory: _UsuarioService.\u0275fac, providedIn: "root" });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(UsuarioService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

// src/app/features/configuracion/components/usuarios/usuarios.component.ts
var _forTrack0 = ($index, $item) => $item.usuario_id;
var _forTrack1 = ($index, $item) => $item.id;
function UsuariosComponent_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 5)(1, "div", 4)(2, "p", 11);
    \u0275\u0275text(3, "No se pudo cargar la lista de usuarios.");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(4, "p", 12);
    \u0275\u0275text(5);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(6, "button", 13);
    \u0275\u0275listener("click", function UsuariosComponent_Conditional_9_Template_button_click_6_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cargar());
    });
    \u0275\u0275text(7, " Reintentar ");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(ctx_r1.error());
  }
}
function UsuariosComponent_Conditional_12_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 8);
    \u0275\u0275text(1, "Cargando...");
    \u0275\u0275elementEnd();
  }
}
function UsuariosComponent_Conditional_13_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 8);
    \u0275\u0275text(1, "Todav\xEDa no hay usuarios.");
    \u0275\u0275elementEnd();
  }
}
function UsuariosComponent_Conditional_14_For_18_Conditional_12_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 15);
    \u0275\u0275text(1, "Todas (es administrador)");
    \u0275\u0275elementEnd();
  }
}
function UsuariosComponent_Conditional_14_For_18_Conditional_13_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 15);
    \u0275\u0275text(1, "Todas");
    \u0275\u0275elementEnd();
  }
}
function UsuariosComponent_Conditional_14_For_18_Conditional_14_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 19);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const id_r3 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext(4);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r1.nombreDe(id_r3));
  }
}
function UsuariosComponent_Conditional_14_For_18_Conditional_14_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 16);
    \u0275\u0275repeaterCreate(1, UsuariosComponent_Conditional_14_For_18_Conditional_14_For_2_Template, 2, 1, "span", 19, \u0275\u0275repeaterTrackByIdentity);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const u_r4 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275advance();
    \u0275\u0275repeater(u_r4.jurisdicciones);
  }
}
function UsuariosComponent_Conditional_14_For_18_Conditional_16_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 17);
    \u0275\u0275text(1, "No aplica");
    \u0275\u0275elementEnd();
  }
}
function UsuariosComponent_Conditional_14_For_18_Conditional_17_Template(rf, ctx) {
  if (rf & 1) {
    const _r5 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 20);
    \u0275\u0275listener("click", function UsuariosComponent_Conditional_14_For_18_Conditional_17_Template_button_click_0_listener() {
      \u0275\u0275restoreView(_r5);
      const u_r4 = \u0275\u0275nextContext().$implicit;
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.abrir(u_r4));
    });
    \u0275\u0275text(1, " Editar permisos ");
    \u0275\u0275elementEnd();
  }
}
function UsuariosComponent_Conditional_14_For_18_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "tr")(1, "td", 11);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "td");
    \u0275\u0275text(4);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "td")(6, "span");
    \u0275\u0275text(7);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(8, "td")(9, "span");
    \u0275\u0275text(10);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(11, "td");
    \u0275\u0275template(12, UsuariosComponent_Conditional_14_For_18_Conditional_12_Template, 2, 0, "span", 15)(13, UsuariosComponent_Conditional_14_For_18_Conditional_13_Template, 2, 0, "span", 15)(14, UsuariosComponent_Conditional_14_For_18_Conditional_14_Template, 3, 0, "span", 16);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(15, "td");
    \u0275\u0275template(16, UsuariosComponent_Conditional_14_For_18_Conditional_16_Template, 2, 0, "span", 17)(17, UsuariosComponent_Conditional_14_For_18_Conditional_17_Template, 2, 0, "button", 18);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const u_r4 = ctx.$implicit;
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(u_r4.username);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(u_r4.nombre_completo);
    \u0275\u0275advance(2);
    \u0275\u0275classMap(u_r4.rol === "admin" ? "badge-info" : "badge-neutral");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", u_r4.rol === "admin" ? "Administrador" : "Usuario", " ");
    \u0275\u0275advance(2);
    \u0275\u0275classMap(u_r4.activo ? "badge-success" : "badge-neutral");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", u_r4.activo ? "Activo" : "Inactivo", " ");
    \u0275\u0275advance(2);
    \u0275\u0275conditional(u_r4.rol === "admin" ? 12 : u_r4.jurisdicciones.length === 0 ? 13 : 14);
    \u0275\u0275advance(4);
    \u0275\u0275conditional(u_r4.rol === "admin" ? 16 : 17);
  }
}
function UsuariosComponent_Conditional_14_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 9)(1, "table", 14)(2, "thead")(3, "tr")(4, "th");
    \u0275\u0275text(5, "Usuario");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "th");
    \u0275\u0275text(7, "Nombre");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "th");
    \u0275\u0275text(9, "Rol");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(10, "th");
    \u0275\u0275text(11, "Estado");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(12, "th");
    \u0275\u0275text(13, "Jurisdicciones que ve");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(14, "th");
    \u0275\u0275text(15, "Acciones");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(16, "tbody");
    \u0275\u0275repeaterCreate(17, UsuariosComponent_Conditional_14_For_18_Template, 18, 10, "tr", null, _forTrack0);
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(17);
    \u0275\u0275repeater(ctx_r1.usuarios());
  }
}
function UsuariosComponent_Conditional_15_For_12_Template(rf, ctx) {
  if (rf & 1) {
    const _r7 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "label", 29)(1, "input", 33);
    \u0275\u0275listener("change", function UsuariosComponent_Conditional_15_For_12_Template_input_change_1_listener() {
      const j_r8 = \u0275\u0275restoreView(_r7).$implicit;
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.alternar(j_r8.id));
    });
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(2, "span", 34);
    \u0275\u0275text(3);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const j_r8 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275property("checked", ctx_r1.seleccion().includes(j_r8.id));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(j_r8.nombre);
  }
}
function UsuariosComponent_Conditional_15_Conditional_13_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 3)(1, "div", 4);
    \u0275\u0275text(2, " Sin nada marcado, ");
    \u0275\u0275elementStart(3, "strong");
    \u0275\u0275text(4);
    \u0275\u0275elementEnd();
    \u0275\u0275text(5, ". Para restringir el acceso, marque las que s\xED puede ver. Si lo que quiere es que no entre al sistema, pida que se desactive su cuenta. ");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const u_r9 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate1("", u_r9.username, " ver\xE1 todas las jurisdicciones");
  }
}
function UsuariosComponent_Conditional_15_Template(rf, ctx) {
  if (rf & 1) {
    const _r6 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 21);
    \u0275\u0275listener("click", function UsuariosComponent_Conditional_15_Template_div_click_0_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cerrar());
    });
    \u0275\u0275elementStart(1, "div", 22);
    \u0275\u0275listener("click", function UsuariosComponent_Conditional_15_Template_div_click_1_listener($event) {
      \u0275\u0275restoreView(_r6);
      return \u0275\u0275resetView($event.stopPropagation());
    })("keydown.escape", function UsuariosComponent_Conditional_15_Template_div_keydown_escape_1_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cerrar());
    });
    \u0275\u0275elementStart(2, "div", 23)(3, "h3", 24);
    \u0275\u0275text(4);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "button", 25);
    \u0275\u0275listener("click", function UsuariosComponent_Conditional_15_Template_button_click_5_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cerrar());
    });
    \u0275\u0275text(6, " \xD7 ");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(7, "div", 26)(8, "p", 27);
    \u0275\u0275text(9, " Marque las jurisdicciones cuyas causas puede ver. El resto no le aparecer\xE1n en ninguna pantalla ni en sus informes. ");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(10, "div", 28);
    \u0275\u0275repeaterCreate(11, UsuariosComponent_Conditional_15_For_12_Template, 4, 2, "label", 29, _forTrack1);
    \u0275\u0275elementEnd();
    \u0275\u0275template(13, UsuariosComponent_Conditional_15_Conditional_13_Template, 6, 1, "div", 3);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(14, "div", 30)(15, "button", 31);
    \u0275\u0275listener("click", function UsuariosComponent_Conditional_15_Template_button_click_15_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cerrar());
    });
    \u0275\u0275text(16, " Cancelar ");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(17, "button", 32);
    \u0275\u0275listener("click", function UsuariosComponent_Conditional_15_Template_button_click_17_listener() {
      \u0275\u0275restoreView(_r6);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.guardar());
    });
    \u0275\u0275text(18);
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const u_r9 = ctx;
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate1(" Permisos de ", u_r9.nombre_completo || u_r9.username, " ");
    \u0275\u0275advance(7);
    \u0275\u0275repeater(ctx_r1.jurisdicciones());
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r1.seleccion().length === 0 ? 13 : -1);
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r1.guardando());
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r1.guardando());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r1.guardando() ? "Guardando..." : "Guardar permisos", " ");
  }
}
var UsuariosComponent = class _UsuariosComponent {
  service = inject(UsuarioService);
  notification = inject(NotificationService);
  usuarios = signal([]);
  jurisdicciones = signal([]);
  cargando = signal(true);
  error = signal(null);
  editando = signal(null);
  seleccion = signal([]);
  guardando = signal(false);
  ngOnInit() {
    this.cargar();
  }
  cargar() {
    this.cargando.set(true);
    this.error.set(null);
    this.service.permisos().subscribe({
      next: (res) => {
        this.usuarios.set(res.usuarios);
        this.jurisdicciones.set(res.jurisdicciones);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(this.mensajeError(e));
      }
    });
  }
  nombreDe(id) {
    return this.jurisdicciones().find((j) => j.id === id)?.nombre ?? `#${id}`;
  }
  abrir(u) {
    this.editando.set(u);
    this.seleccion.set([...u.jurisdicciones]);
  }
  cerrar() {
    this.editando.set(null);
  }
  alternar(id) {
    this.seleccion.update((actual) => actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]);
  }
  guardar() {
    const u = this.editando();
    if (!u)
      return;
    this.guardando.set(true);
    this.service.guardarPermisos(u.usuario_id, this.seleccion()).subscribe({
      next: (actualizado) => {
        this.guardando.set(false);
        this.cerrar();
        this.usuarios.update((lista) => lista.map((x) => x.usuario_id === actualizado.usuario_id ? actualizado : x));
        this.notification.success(actualizado.jurisdicciones.length === 0 ? `${actualizado.username} ve todas las jurisdicciones` : `Permisos de ${actualizado.username} actualizados`);
      },
      error: (e) => {
        this.guardando.set(false);
        this.notification.error(this.mensajeError(e));
      }
    });
  }
  mensajeError(err) {
    const detail = err?.error?.detail;
    if (typeof detail === "string")
      return detail;
    return "No se pudo completar la operaci\xF3n. Intente de nuevo.";
  }
  static \u0275fac = function UsuariosComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _UsuariosComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _UsuariosComponent, selectors: [["app-usuarios"]], decls: 16, vars: 3, consts: [[1, "space-y-6"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], [1, "alert-info"], [1, "flex-1"], [1, "alert-danger"], [1, "card"], [1, "card-body"], [1, "text-neutral-500", "py-8", "text-center"], [1, "table-wrapper"], [1, "modal-backdrop", "animar-fondo"], [1, "font-medium"], [1, "text-sm", "mt-1"], ["type", "button", 1, "btn-danger", "btn-sm", "shrink-0", 3, "click"], [1, "data-table"], [1, "text-neutral-500"], [1, "flex", "flex-wrap", "gap-1"], [1, "text-xs", "text-neutral-400"], ["type", "button", 1, "btn-secondary", "btn-sm"], [1, "badge-neutral"], ["type", "button", 1, "btn-secondary", "btn-sm", 3, "click"], [1, "modal-backdrop", "animar-fondo", 3, "click"], ["role", "dialog", "aria-modal", "true", "aria-labelledby", "titulo-permisos", "tabindex", "-1", 1, "modal-content", 3, "click", "keydown.escape"], [1, "modal-header"], ["id", "titulo-permisos", 1, "text-lg", "font-semibold"], ["type", "button", "aria-label", "Cerrar", 1, "text-neutral-400", "hover:text-neutral-600", 3, "click"], [1, "modal-body", "space-y-4"], [1, "text-sm", "text-neutral-700"], [1, "rounded-lg", "border", "border-neutral-200", "divide-y", "divide-neutral-200"], [1, "flex", "items-center", "gap-3", "px-4", "py-2", "cursor-pointer", "hover:bg-neutral-50"], [1, "modal-footer"], ["type", "button", 1, "btn-secondary", 3, "click", "disabled"], ["type", "button", 1, "btn-primary", 3, "click", "disabled"], ["type", "checkbox", 1, "form-checkbox", 3, "change", "checked"], [1, "text-sm", "text-neutral-800"]], template: function UsuariosComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div")(2, "h1", 1);
      \u0275\u0275text(3, "Usuarios y permisos");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(4, "p", 2);
      \u0275\u0275text(5, " Defina qu\xE9 jurisdicciones puede ver cada integrante del estudio ");
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(6, "div", 3)(7, "div", 4);
      \u0275\u0275text(8, " Las cuentas de acceso las administra Temposoft. Si necesita agregar o dar de baja a alguien, solic\xEDtelo al administrador del sistema. ");
      \u0275\u0275elementEnd()();
      \u0275\u0275template(9, UsuariosComponent_Conditional_9_Template, 8, 1, "div", 5);
      \u0275\u0275elementStart(10, "div", 6)(11, "div", 7);
      \u0275\u0275template(12, UsuariosComponent_Conditional_12_Template, 2, 0, "p", 8)(13, UsuariosComponent_Conditional_13_Template, 2, 0, "p", 8)(14, UsuariosComponent_Conditional_14_Template, 19, 0, "div", 9);
      \u0275\u0275elementEnd()()();
      \u0275\u0275template(15, UsuariosComponent_Conditional_15_Template, 19, 5, "div", 10);
    }
    if (rf & 2) {
      let tmp_2_0;
      \u0275\u0275advance(9);
      \u0275\u0275conditional(ctx.error() ? 9 : -1);
      \u0275\u0275advance(3);
      \u0275\u0275conditional(ctx.cargando() ? 12 : ctx.usuarios().length === 0 ? 13 : 14);
      \u0275\u0275advance(3);
      \u0275\u0275conditional((tmp_2_0 = ctx.editando()) ? 15 : -1, tmp_2_0);
    }
  }, dependencies: [CommonModule, FormsModule], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(UsuariosComponent, [{
    type: Component,
    args: [{
      selector: "app-usuarios",
      standalone: true,
      imports: [CommonModule, FormsModule],
      template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Usuarios y permisos</h1>
        <p class="text-neutral-500 mt-1">
          Defina qu\xE9 jurisdicciones puede ver cada integrante del estudio
        </p>
      </div>

      <div class="alert-info">
        <div class="flex-1">
          Las cuentas de acceso las administra Temposoft. Si necesita agregar o dar de baja a
          alguien, solic\xEDtelo al administrador del sistema.
        </div>
      </div>

      @if (error()) {
        <div class="alert-danger">
          <div class="flex-1">
            <p class="font-medium">No se pudo cargar la lista de usuarios.</p>
            <p class="text-sm mt-1">{{ error() }}</p>
          </div>
          <button type="button" class="btn-danger btn-sm shrink-0" (click)="cargar()">
            Reintentar
          </button>
        </div>
      }

      <div class="card">
        <div class="card-body">
          @if (cargando()) {
            <p class="text-neutral-500 py-8 text-center">Cargando...</p>
          } @else if (usuarios().length === 0) {
            <p class="text-neutral-500 py-8 text-center">Todav\xEDa no hay usuarios.</p>
          } @else {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Jurisdicciones que ve</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (u of usuarios(); track u.usuario_id) {
                    <tr>
                      <td class="font-medium">{{ u.username }}</td>
                      <td>{{ u.nombre_completo }}</td>
                      <td>
                        <span [class]="u.rol === 'admin' ? 'badge-info' : 'badge-neutral'">
                          {{ u.rol === 'admin' ? 'Administrador' : 'Usuario' }}
                        </span>
                      </td>
                      <td>
                        <span [class]="u.activo ? 'badge-success' : 'badge-neutral'">
                          {{ u.activo ? 'Activo' : 'Inactivo' }}
                        </span>
                      </td>
                      <td>
                        @if (u.rol === 'admin') {
                          <span class="text-neutral-500">Todas (es administrador)</span>
                        } @else if (u.jurisdicciones.length === 0) {
                          <span class="text-neutral-500">Todas</span>
                        } @else {
                          <span class="flex flex-wrap gap-1">
                            @for (id of u.jurisdicciones; track id) {
                              <span class="badge-neutral">{{ nombreDe(id) }}</span>
                            }
                          </span>
                        }
                      </td>
                      <td>
                        @if (u.rol === 'admin') {
                          <span class="text-xs text-neutral-400">No aplica</span>
                        } @else {
                          <button type="button" class="btn-secondary btn-sm" (click)="abrir(u)">
                            Editar permisos
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </div>

    @if (editando(); as u) {
      <div class="modal-backdrop animar-fondo" (click)="cerrar()">
        <div
          class="modal-content"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-permisos"
          (keydown.escape)="cerrar()"
          tabindex="-1"
        >
          <div class="modal-header">
            <h3 id="titulo-permisos" class="text-lg font-semibold">
              Permisos de {{ u.nombre_completo || u.username }}
            </h3>
            <button
              type="button"
              (click)="cerrar()"
              class="text-neutral-400 hover:text-neutral-600"
              aria-label="Cerrar"
            >
              &times;
            </button>
          </div>

          <div class="modal-body space-y-4">
            <p class="text-sm text-neutral-700">
              Marque las jurisdicciones cuyas causas puede ver. El resto no le aparecer\xE1n en
              ninguna pantalla ni en sus informes.
            </p>

            <div class="rounded-lg border border-neutral-200 divide-y divide-neutral-200">
              @for (j of jurisdicciones(); track j.id) {
                <label class="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    class="form-checkbox"
                    [checked]="seleccion().includes(j.id)"
                    (change)="alternar(j.id)"
                  />
                  <span class="text-sm text-neutral-800">{{ j.nombre }}</span>
                </label>
              }
            </div>

            <!-- El caso que se malinterpreta: nada marcado NO es "no ve nada". -->
            @if (seleccion().length === 0) {
              <div class="alert-info">
                <div class="flex-1">
                  Sin nada marcado, <strong>{{ u.username }} ver\xE1 todas las jurisdicciones</strong>.
                  Para restringir el acceso, marque las que s\xED puede ver. Si lo que quiere es que
                  no entre al sistema, pida que se desactive su cuenta.
                </div>
              </div>
            }
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="cerrar()" [disabled]="guardando()">
              Cancelar
            </button>
            <button type="button" class="btn-primary" (click)="guardar()" [disabled]="guardando()">
              {{ guardando() ? 'Guardando...' : 'Guardar permisos' }}
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
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(UsuariosComponent, { className: "UsuariosComponent", filePath: "src/app/features/configuracion/components/usuarios/usuarios.component.ts", lineNumber: 188 });
})();
export {
  UsuariosComponent
};
//# sourceMappingURL=chunk-CLU6XBCR.js.map
