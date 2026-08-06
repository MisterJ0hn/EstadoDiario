import {
  NotificationService
} from "./chunk-ZKUWYJUU.js";
import {
  AuthService
} from "./chunk-M4LO6B3L.js";
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
  ɵɵelement,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetCurrentView,
  ɵɵlistener,
  ɵɵnextContext,
  ɵɵproperty,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtemplate,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1,
  ɵɵtextInterpolate2,
  ɵɵtwoWayBindingSet,
  ɵɵtwoWayListener,
  ɵɵtwoWayProperty
} from "./chunk-WMIGZGXS.js";
import "./chunk-XWLXMCJQ.js";

// src/app/features/configuracion/services/google-calendar.service.ts
var GoogleCalendarService = class _GoogleCalendarService {
  apiUrl = `${environment.apiUrl}/google-calendar`;
  http = inject(HttpClient);
  estado() {
    return this.http.get(`${this.apiUrl}/estado`);
  }
  conectar() {
    return this.http.get(`${this.apiUrl}/conectar`);
  }
  desconectar() {
    return this.http.post(`${this.apiUrl}/desconectar`, {});
  }
  static \u0275fac = function GoogleCalendarService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _GoogleCalendarService)();
  };
  static \u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _GoogleCalendarService, factory: _GoogleCalendarService.\u0275fac, providedIn: "root" });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(GoogleCalendarService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

// src/app/features/perfil/perfil.component.ts
function PerfilComponent_Conditional_47_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 16);
    \u0275\u0275text(1, "Consultando estado de conexi\xF3n...");
    \u0275\u0275elementEnd();
  }
}
function PerfilComponent_Conditional_48_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 18);
    \u0275\u0275text(1, " Conectado como ");
    \u0275\u0275elementStart(2, "strong");
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
    \u0275\u0275text(4, ". Los recordatorios que crees se agregar\xE1n a este calendario. ");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "div", 14)(6, "button", 19);
    \u0275\u0275listener("click", function PerfilComponent_Conditional_48_Template_button_click_6_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.desconectar());
    });
    \u0275\u0275text(7);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r1.googleEmail());
    \u0275\u0275advance(3);
    \u0275\u0275property("disabled", ctx_r1.ocupadoGoogle());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r1.ocupadoGoogle() ? "Desconectando..." : "Desconectar", " ");
  }
}
function PerfilComponent_Conditional_49_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "p", 20);
    \u0275\u0275text(1, " No has conectado tu cuenta de Google. Sin conectarla, los recordatorios se siguen guardando en el sistema, pero no aparecen en tu Google Calendar. ");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(2, "div", 14)(3, "button", 15);
    \u0275\u0275listener("click", function PerfilComponent_Conditional_49_Template_button_click_3_listener() {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.conectar());
    });
    \u0275\u0275text(4);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(3);
    \u0275\u0275property("disabled", ctx_r1.ocupadoGoogle());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r1.ocupadoGoogle() ? "Redirigiendo..." : "Conectar Google Calendar", " ");
  }
}
function PerfilComponent_Conditional_50_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div");
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275classMap(ctx_r1.mensajeGoogleEsError() ? "alert-danger" : "alert-info");
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r1.mensajeGoogle());
  }
}
var PerfilComponent = class _PerfilComponent {
  auth = inject(AuthService);
  googleService = inject(GoogleCalendarService);
  notification = inject(NotificationService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  telefono = "";
  guardandoTelefono = signal(false);
  cargandoEstado = signal(true);
  conectado = signal(false);
  googleEmail = signal(null);
  ocupadoGoogle = signal(false);
  mensajeGoogle = signal("");
  mensajeGoogleEsError = signal(false);
  ngOnInit() {
    this.telefono = this.auth.user()?.telefono ?? "";
    this.cargarEstadoGoogle();
    const resultado = this.route.snapshot.queryParamMap.get("google");
    if (resultado === "ok") {
      this.mensajeGoogle.set("Cuenta de Google conectada correctamente.");
      this.mensajeGoogleEsError.set(false);
    } else if (resultado === "error") {
      this.mensajeGoogle.set("No se pudo completar la conexi\xF3n con Google. Intenta nuevamente.");
      this.mensajeGoogleEsError.set(true);
    }
    if (resultado) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }
  guardarTelefono() {
    this.guardandoTelefono.set(true);
    this.auth.actualizarPerfil({ telefono: this.telefono.trim() || null }).subscribe({
      next: () => {
        this.guardandoTelefono.set(false);
        this.notification.success("Tel\xE9fono actualizado");
      },
      error: () => {
        this.guardandoTelefono.set(false);
        this.notification.error("No se pudo guardar el tel\xE9fono");
      }
    });
  }
  cargarEstadoGoogle() {
    this.cargandoEstado.set(true);
    this.googleService.estado().subscribe({
      next: (res) => {
        this.conectado.set(res.conectado);
        this.googleEmail.set(res.google_email ?? null);
        this.cargandoEstado.set(false);
      },
      error: () => {
        this.cargandoEstado.set(false);
        this.notification.error("No se pudo consultar el estado de Google Calendar");
      }
    });
  }
  conectar() {
    this.ocupadoGoogle.set(true);
    this.googleService.conectar().subscribe({
      next: (res) => {
        window.location.href = res.url;
      },
      error: (err) => {
        this.ocupadoGoogle.set(false);
        this.mensajeGoogle.set(err.error?.detail || "No se pudo iniciar la conexi\xF3n con Google");
        this.mensajeGoogleEsError.set(true);
      }
    });
  }
  desconectar() {
    this.ocupadoGoogle.set(true);
    this.googleService.desconectar().subscribe({
      next: () => {
        this.ocupadoGoogle.set(false);
        this.conectado.set(false);
        this.googleEmail.set(null);
        this.notification.success("Cuenta de Google desconectada");
      },
      error: () => {
        this.ocupadoGoogle.set(false);
        this.notification.error("No se pudo desconectar la cuenta");
      }
    });
  }
  static \u0275fac = function PerfilComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _PerfilComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _PerfilComponent, selectors: [["app-perfil"]], decls: 51, vars: 10, consts: [[1, "max-w-2xl", "mx-auto", "space-y-6"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], [1, "card"], [1, "card-header"], [1, "text-lg", "font-semibold"], [1, "card-body", "space-y-4"], [1, "grid", "grid-cols-1", "md:grid-cols-2", "gap-4", "text-sm"], [1, "text-xs", "text-neutral-500", "uppercase"], [1, "font-medium"], [1, "border-neutral-200"], [1, "form-label"], ["type", "text", "placeholder", "+56912345678", 1, "form-input", 3, "ngModelChange", "ngModel"], [1, "text-xs", "text-neutral-400", "mt-1"], [1, "flex", "justify-end"], [1, "btn-primary", 3, "click", "disabled"], [1, "text-neutral-500"], [3, "class"], [1, "alert-success"], [1, "btn-danger", 3, "click", "disabled"], [1, "text-neutral-600"]], template: function PerfilComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div")(2, "h1", 1);
      \u0275\u0275text(3, "Mi Perfil");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(4, "p", 2);
      \u0275\u0275text(5, "Tus datos y tu conexi\xF3n personal con Google Calendar.");
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(6, "div", 3)(7, "div", 4)(8, "h3", 5);
      \u0275\u0275text(9, "Datos");
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(10, "div", 6)(11, "div", 7)(12, "div")(13, "span", 8);
      \u0275\u0275text(14, "Usuario");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(15, "p", 9);
      \u0275\u0275text(16);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(17, "div")(18, "span", 8);
      \u0275\u0275text(19, "Correo");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(20, "p", 9);
      \u0275\u0275text(21);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(22, "div")(23, "span", 8);
      \u0275\u0275text(24, "Nombre");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(25, "p", 9);
      \u0275\u0275text(26);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(27, "div")(28, "span", 8);
      \u0275\u0275text(29, "Rol");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(30, "p", 9);
      \u0275\u0275text(31);
      \u0275\u0275elementEnd()()();
      \u0275\u0275element(32, "hr", 10);
      \u0275\u0275elementStart(33, "div")(34, "label", 11);
      \u0275\u0275text(35, "Tel\xE9fono");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(36, "input", 12);
      \u0275\u0275twoWayListener("ngModelChange", function PerfilComponent_Template_input_ngModelChange_36_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.telefono, $event) || (ctx.telefono = $event);
        return $event;
      });
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(37, "p", 13);
      \u0275\u0275text(38, " N\xFAmero por defecto para recibir recordatorios de WhatsApp; puedes cambiarlo al crear cada uno. ");
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(39, "div", 14)(40, "button", 15);
      \u0275\u0275listener("click", function PerfilComponent_Template_button_click_40_listener() {
        return ctx.guardarTelefono();
      });
      \u0275\u0275text(41);
      \u0275\u0275elementEnd()()()();
      \u0275\u0275elementStart(42, "div", 3)(43, "div", 4)(44, "h3", 5);
      \u0275\u0275text(45, "Google Calendar");
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(46, "div", 6);
      \u0275\u0275template(47, PerfilComponent_Conditional_47_Template, 2, 0, "p", 16)(48, PerfilComponent_Conditional_48_Template, 8, 3)(49, PerfilComponent_Conditional_49_Template, 5, 2)(50, PerfilComponent_Conditional_50_Template, 2, 3, "div", 17);
      \u0275\u0275elementEnd()()();
    }
    if (rf & 2) {
      let tmp_0_0;
      let tmp_1_0;
      let tmp_2_0;
      let tmp_3_0;
      \u0275\u0275advance(16);
      \u0275\u0275textInterpolate((tmp_0_0 = ctx.auth.user()) == null ? null : tmp_0_0.username);
      \u0275\u0275advance(5);
      \u0275\u0275textInterpolate((tmp_1_0 = ctx.auth.user()) == null ? null : tmp_1_0.email);
      \u0275\u0275advance(5);
      \u0275\u0275textInterpolate2("", (tmp_2_0 = ctx.auth.user()) == null ? null : tmp_2_0.nombre, " ", (tmp_2_0 = ctx.auth.user()) == null ? null : tmp_2_0.apellido, "");
      \u0275\u0275advance(5);
      \u0275\u0275textInterpolate(((tmp_3_0 = ctx.auth.user()) == null ? null : tmp_3_0.rol) === "admin" ? "Administrador" : "Usuario");
      \u0275\u0275advance(5);
      \u0275\u0275twoWayProperty("ngModel", ctx.telefono);
      \u0275\u0275advance(4);
      \u0275\u0275property("disabled", ctx.guardandoTelefono());
      \u0275\u0275advance();
      \u0275\u0275textInterpolate1(" ", ctx.guardandoTelefono() ? "Guardando..." : "Guardar tel\xE9fono", " ");
      \u0275\u0275advance(6);
      \u0275\u0275conditional(ctx.cargandoEstado() ? 47 : ctx.conectado() ? 48 : 49);
      \u0275\u0275advance(3);
      \u0275\u0275conditional(ctx.mensajeGoogle() ? 50 : -1);
    }
  }, dependencies: [CommonModule, FormsModule, DefaultValueAccessor, NgControlStatus, NgModel], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PerfilComponent, [{
    type: Component,
    args: [{
      selector: "app-perfil",
      standalone: true,
      imports: [CommonModule, FormsModule],
      template: `
    <div class="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Mi Perfil</h1>
        <p class="text-neutral-500 mt-1">Tus datos y tu conexi\xF3n personal con Google Calendar.</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="text-lg font-semibold">Datos</h3>
        </div>
        <div class="card-body space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-xs text-neutral-500 uppercase">Usuario</span>
              <p class="font-medium">{{ auth.user()?.username }}</p>
            </div>
            <div>
              <span class="text-xs text-neutral-500 uppercase">Correo</span>
              <p class="font-medium">{{ auth.user()?.email }}</p>
            </div>
            <div>
              <span class="text-xs text-neutral-500 uppercase">Nombre</span>
              <p class="font-medium">{{ auth.user()?.nombre }} {{ auth.user()?.apellido }}</p>
            </div>
            <div>
              <span class="text-xs text-neutral-500 uppercase">Rol</span>
              <p class="font-medium">{{ auth.user()?.rol === 'admin' ? 'Administrador' : 'Usuario' }}</p>
            </div>
          </div>

          <hr class="border-neutral-200" />

          <div>
            <label class="form-label">Tel\xE9fono</label>
            <input type="text" class="form-input" [(ngModel)]="telefono" placeholder="+56912345678" />
            <p class="text-xs text-neutral-400 mt-1">
              N\xFAmero por defecto para recibir recordatorios de WhatsApp; puedes cambiarlo al crear cada uno.
            </p>
          </div>

          <div class="flex justify-end">
            <button (click)="guardarTelefono()" class="btn-primary" [disabled]="guardandoTelefono()">
              {{ guardandoTelefono() ? 'Guardando...' : 'Guardar tel\xE9fono' }}
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="text-lg font-semibold">Google Calendar</h3>
        </div>
        <div class="card-body space-y-4">
          @if (cargandoEstado()) {
            <p class="text-neutral-500">Consultando estado de conexi\xF3n...</p>
          } @else if (conectado()) {
            <div class="alert-success">
              Conectado como <strong>{{ googleEmail() }}</strong>. Los recordatorios que crees se
              agregar\xE1n a este calendario.
            </div>
            <div class="flex justify-end">
              <button (click)="desconectar()" class="btn-danger" [disabled]="ocupadoGoogle()">
                {{ ocupadoGoogle() ? 'Desconectando...' : 'Desconectar' }}
              </button>
            </div>
          } @else {
            <p class="text-neutral-600">
              No has conectado tu cuenta de Google. Sin conectarla, los recordatorios se
              siguen guardando en el sistema, pero no aparecen en tu Google Calendar.
            </p>
            <div class="flex justify-end">
              <button (click)="conectar()" class="btn-primary" [disabled]="ocupadoGoogle()">
                {{ ocupadoGoogle() ? 'Redirigiendo...' : 'Conectar Google Calendar' }}
              </button>
            </div>
          }

          @if (mensajeGoogle()) {
            <div [class]="mensajeGoogleEsError() ? 'alert-danger' : 'alert-info'">{{ mensajeGoogle() }}</div>
          }
        </div>
      </div>
    </div>
  `
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(PerfilComponent, { className: "PerfilComponent", filePath: "src/app/features/perfil/perfil.component.ts", lineNumber: 99 });
})();
export {
  PerfilComponent
};
//# sourceMappingURL=chunk-R4QGXNYA.js.map
