import {
  AuthService
} from "./chunk-M4LO6B3L.js";
import {
  DefaultValueAccessor,
  FormsModule,
  NgControlStatus,
  NgControlStatusGroup,
  NgForm,
  NgModel,
  ɵNgNoValidate
} from "./chunk-2XI3ELAA.js";
import {
  Router
} from "./chunk-O3CMZLWV.js";
import {
  CommonModule,
  Component,
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
  ɵɵlistener,
  ɵɵnamespaceHTML,
  ɵɵnamespaceSVG,
  ɵɵnextContext,
  ɵɵproperty,
  ɵɵtemplate,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1,
  ɵɵtwoWayBindingSet,
  ɵɵtwoWayListener,
  ɵɵtwoWayProperty
} from "./chunk-WMIGZGXS.js";
import "./chunk-XWLXMCJQ.js";

// src/app/core/utils/rut.ts
function limpiarRut(valor) {
  return (valor || "").replace(/[^0-9kK]/g, "").toUpperCase();
}
function formatearRut(valor) {
  const limpio = limpiarRut(valor);
  if (limpio.length <= 1)
    return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}
function rutPlano(valor) {
  const limpio = limpiarRut(valor);
  if (limpio.length <= 1)
    return limpio;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}
function rutValido(valor) {
  const limpio = limpiarRut(valor);
  if (limpio.length < 2)
    return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo))
    return false;
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo.charAt(i)) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - suma % 11;
  const esperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  return esperado === dv;
}

// src/app/features/auth/login.component.ts
function LoginComponent_Conditional_11_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 9);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.errorMsg());
  }
}
function LoginComponent_Conditional_28_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(0, "svg", 19);
    \u0275\u0275element(1, "circle", 20)(2, "path", 21);
    \u0275\u0275elementEnd();
  }
}
var LoginComponent = class _LoginComponent {
  auth = inject(AuthService);
  router = inject(Router);
  rut = signal("");
  username = "";
  password = "";
  loading = signal(false);
  errorMsg = signal("");
  /** Solo se marca en rojo cuando ya escribió un RUT completo y no cuadra. */
  rutMalFormado = computed(() => {
    const valor = this.rut().replace(/[^0-9kK]/g, "");
    return valor.length >= 8 && !rutValido(valor);
  });
  /** Se formatea mientras escribe: el abogado dicta el RUT con puntos. */
  alEscribirRut(valor) {
    this.rut.set(formatearRut(valor));
  }
  onLogin() {
    if (!this.rut().trim()) {
      this.errorMsg.set("Indique el RUT de su estudio");
      return;
    }
    if (!rutValido(this.rut())) {
      this.errorMsg.set("El RUT no es v\xE1lido. Revise el d\xEDgito verificador.");
      return;
    }
    if (!this.username || !this.password) {
      this.errorMsg.set("Ingrese usuario y contrase\xF1a");
      return;
    }
    this.loading.set(true);
    this.errorMsg.set("");
    this.auth.login({
      rut: rutPlano(this.rut()),
      username: this.username,
      password: this.password
    }).subscribe({
      next: (usuario) => {
        if (usuario.debe_cambiar_password) {
          this.router.navigate(["/cambiar-clave"]);
          return;
        }
        this.router.navigate(["/"]);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(this.mensajeError(err));
      }
    });
  }
  /** Decir qué falló sin regalar cuál de los tres campos está mal. */
  mensajeError(err) {
    const e = err;
    const detail = e?.error?.detail;
    if (typeof detail === "string")
      return detail;
    if (e?.status === 403) {
      return "Su cuenta est\xE1 desactivada. Comun\xEDquese con el administrador del sistema.";
    }
    if (e?.status === 404) {
      return "No encontramos un estudio con ese RUT. Verif\xEDquelo con el administrador del sistema.";
    }
    return "No pudimos validar sus credenciales. Revise los datos e intente de nuevo.";
  }
  static \u0275fac = function LoginComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _LoginComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _LoginComponent, selectors: [["app-login"]], decls: 30, vars: 11, consts: [[1, "min-h-screen", "flex", "items-center", "justify-center", "bg-gradient-to-br", "from-primary-600", "to-primary-900", "px-4", "py-8"], [1, "card", "w-full", "max-w-md"], [1, "card-body", "p-8"], [1, "text-center", "mb-8"], [1, "w-16", "h-16", "bg-primary-100", "rounded-2xl", "flex", "items-center", "justify-center", "mx-auto", "mb-4"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", 1, "w-8", "h-8", "text-primary-600"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], ["role", "alert", 1, "alert-danger", "mb-4"], ["novalidate", "", 1, "space-y-5", 3, "ngSubmit"], ["for", "rut", 1, "form-label"], ["id", "rut", "type", "text", "name", "rut", "inputmode", "text", "placeholder", "12.345.678-9", "autocomplete", "organization", "aria-describedby", "ayuda-rut", 1, "form-input", 3, "ngModelChange", "ngModel"], ["id", "ayuda-rut", 1, "text-xs", "mt-1"], ["for", "username", 1, "form-label"], ["id", "username", "type", "text", "name", "username", "placeholder", "Ingrese su usuario", "autocomplete", "username", 1, "form-input", 3, "ngModelChange", "ngModel"], ["for", "password", 1, "form-label"], ["id", "password", "type", "password", "name", "password", "placeholder", "Ingrese su contrase\xF1a", "autocomplete", "current-password", 1, "form-input", 3, "ngModelChange", "ngModel"], ["type", "submit", 1, "btn-primary", "w-full", 3, "disabled"], ["viewBox", "0 0 24 24", "aria-hidden", "true", 1, "animate-spin", "h-5", "w-5"], ["cx", "12", "cy", "12", "r", "10", "stroke", "currentColor", "stroke-width", "4", "fill", "none", 1, "opacity-25"], ["fill", "currentColor", "d", "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z", 1, "opacity-75"]], template: function LoginComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div", 1)(2, "div", 2)(3, "div", 3)(4, "div", 4);
      \u0275\u0275namespaceSVG();
      \u0275\u0275elementStart(5, "svg", 5);
      \u0275\u0275element(6, "path", 6);
      \u0275\u0275elementEnd()();
      \u0275\u0275namespaceHTML();
      \u0275\u0275elementStart(7, "h1", 7);
      \u0275\u0275text(8, "Estado Diario CRM");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(9, "p", 8);
      \u0275\u0275text(10, " Ingrese las credenciales de su estudio ");
      \u0275\u0275elementEnd()();
      \u0275\u0275template(11, LoginComponent_Conditional_11_Template, 2, 1, "div", 9);
      \u0275\u0275elementStart(12, "form", 10);
      \u0275\u0275listener("ngSubmit", function LoginComponent_Template_form_ngSubmit_12_listener() {
        return ctx.onLogin();
      });
      \u0275\u0275elementStart(13, "div")(14, "label", 11);
      \u0275\u0275text(15, "RUT del estudio");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(16, "input", 12);
      \u0275\u0275listener("ngModelChange", function LoginComponent_Template_input_ngModelChange_16_listener($event) {
        return ctx.alEscribirRut($event);
      });
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(17, "p", 13);
      \u0275\u0275text(18);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(19, "div")(20, "label", 14);
      \u0275\u0275text(21, "Usuario");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(22, "input", 15);
      \u0275\u0275twoWayListener("ngModelChange", function LoginComponent_Template_input_ngModelChange_22_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.username, $event) || (ctx.username = $event);
        return $event;
      });
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(23, "div")(24, "label", 16);
      \u0275\u0275text(25, "Contrase\xF1a");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(26, "input", 17);
      \u0275\u0275twoWayListener("ngModelChange", function LoginComponent_Template_input_ngModelChange_26_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.password, $event) || (ctx.password = $event);
        return $event;
      });
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(27, "button", 18);
      \u0275\u0275template(28, LoginComponent_Conditional_28_Template, 3, 0, ":svg:svg", 19);
      \u0275\u0275text(29);
      \u0275\u0275elementEnd()()()()();
    }
    if (rf & 2) {
      \u0275\u0275advance(11);
      \u0275\u0275conditional(ctx.errorMsg() ? 11 : -1);
      \u0275\u0275advance(5);
      \u0275\u0275property("ngModel", ctx.rut());
      \u0275\u0275attribute("aria-invalid", ctx.rutMalFormado() ? "true" : null);
      \u0275\u0275advance();
      \u0275\u0275classMap(ctx.rutMalFormado() ? "text-danger-600" : "text-neutral-500");
      \u0275\u0275advance();
      \u0275\u0275textInterpolate1(" ", ctx.rutMalFormado() ? "Revise el RUT: el d\xEDgito verificador no corresponde." : "El RUT con el que su estudio est\xE1 registrado, con d\xEDgito verificador.", " ");
      \u0275\u0275advance(4);
      \u0275\u0275twoWayProperty("ngModel", ctx.username);
      \u0275\u0275advance(4);
      \u0275\u0275twoWayProperty("ngModel", ctx.password);
      \u0275\u0275advance();
      \u0275\u0275property("disabled", ctx.loading());
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.loading() ? 28 : -1);
      \u0275\u0275advance();
      \u0275\u0275textInterpolate1(" ", ctx.loading() ? "Ingresando..." : "Ingresar", " ");
    }
  }, dependencies: [CommonModule, FormsModule, \u0275NgNoValidate, DefaultValueAccessor, NgControlStatus, NgControlStatusGroup, NgModel, NgForm], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(LoginComponent, [{
    type: Component,
    args: [{
      selector: "app-login",
      standalone: true,
      imports: [CommonModule, FormsModule],
      template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 px-4 py-8">
      <div class="card w-full max-w-md">
        <div class="card-body p-8">
          <div class="text-center mb-8">
            <div class="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-neutral-800">Estado Diario CRM</h1>
            <p class="text-neutral-500 mt-1">
              Ingrese las credenciales de su estudio
            </p>
          </div>

          @if (errorMsg()) {
            <div class="alert-danger mb-4" role="alert">{{ errorMsg() }}</div>
          }

          <form (ngSubmit)="onLogin()" class="space-y-5" novalidate>
            <!-- El RUT del estudio es lo primero: define en qu\xE9 base de datos
                 se busca el usuario. Sin \xE9l, el mismo nombre de usuario puede
                 existir en varios estudios. -->
            <div>
              <label class="form-label" for="rut">RUT del estudio</label>
              <input
                id="rut"
                type="text"
                class="form-input"
                [ngModel]="rut()"
                (ngModelChange)="alEscribirRut($event)"
                name="rut"
                inputmode="text"
                placeholder="12.345.678-9"
                autocomplete="organization"
                [attr.aria-invalid]="rutMalFormado() ? 'true' : null"
                aria-describedby="ayuda-rut"
              />
              <p id="ayuda-rut" class="text-xs mt-1"
                 [class]="rutMalFormado() ? 'text-danger-600' : 'text-neutral-500'">
                {{ rutMalFormado()
                    ? 'Revise el RUT: el d\xEDgito verificador no corresponde.'
                    : 'El RUT con el que su estudio est\xE1 registrado, con d\xEDgito verificador.' }}
              </p>
            </div>

            <div>
              <label class="form-label" for="username">Usuario</label>
              <input id="username" type="text" class="form-input" [(ngModel)]="username" name="username"
                     placeholder="Ingrese su usuario" autocomplete="username" />
            </div>

            <div>
              <label class="form-label" for="password">Contrase\xF1a</label>
              <input id="password" type="password" class="form-input" [(ngModel)]="password" name="password"
                     placeholder="Ingrese su contrase\xF1a" autocomplete="current-password" />
            </div>

            <button type="submit" class="btn-primary w-full" [disabled]="loading()">
              @if (loading()) {
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              }
              {{ loading() ? 'Ingresando...' : 'Ingresar' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(LoginComponent, { className: "LoginComponent", filePath: "src/app/features/auth/login.component.ts", lineNumber: 87 });
})();
export {
  LoginComponent
};
//# sourceMappingURL=chunk-BB6QFC3R.js.map
