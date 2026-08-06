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
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵtemplate,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1
} from "./chunk-WMIGZGXS.js";
import "./chunk-XWLXMCJQ.js";

// src/app/features/auth/cambiar-clave.component.ts
var _forTrack0 = ($index, $item) => $item.texto;
function CambiarClaveComponent_Conditional_11_Template(rf, ctx) {
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
function CambiarClaveComponent_For_23_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(0, "svg", 23);
    \u0275\u0275element(1, "path", 24);
    \u0275\u0275elementEnd();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(2, "span", 25);
    \u0275\u0275text(3, "Cumple:");
    \u0275\u0275elementEnd();
  }
}
function CambiarClaveComponent_For_23_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(0, "svg", 26);
    \u0275\u0275element(1, "circle", 27);
    \u0275\u0275elementEnd();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(2, "span", 25);
    \u0275\u0275text(3, "Falta:");
    \u0275\u0275elementEnd();
  }
}
function CambiarClaveComponent_For_23_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "li", 22);
    \u0275\u0275template(1, CambiarClaveComponent_For_23_Conditional_1_Template, 4, 0)(2, CambiarClaveComponent_For_23_Conditional_2_Template, 4, 0);
    \u0275\u0275elementStart(3, "span");
    \u0275\u0275text(4);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const r_r2 = ctx.$implicit;
    \u0275\u0275classMap(r_r2.cumple ? "text-accent-700" : "text-neutral-600");
    \u0275\u0275advance();
    \u0275\u0275conditional(r_r2.cumple ? 1 : 2);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(r_r2.texto);
  }
}
function CambiarClaveComponent_Conditional_27_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(0, "svg", 19);
    \u0275\u0275element(1, "circle", 28)(2, "path", 29);
    \u0275\u0275elementEnd();
  }
}
var CambiarClaveComponent = class _CambiarClaveComponent {
  auth = inject(AuthService);
  router = inject(Router);
  nueva = signal("");
  confirmacion = signal("");
  guardando = signal(false);
  errorMsg = signal("");
  /** Solo las reglas que el navegador puede comprobar de verdad. La de "no
   *  repetir la provisoria" se verifica en el servidor y se dice como nota. */
  reglas = computed(() => [
    { texto: "Al menos 8 caracteres", cumple: this.nueva().length >= 8 },
    {
      texto: "Las dos contrase\xF1as coinciden",
      cumple: this.nueva().length > 0 && this.nueva() === this.confirmacion()
    }
  ]);
  guardar() {
    if (this.nueva().length < 8) {
      this.errorMsg.set("La contrase\xF1a nueva debe tener al menos 8 caracteres");
      return;
    }
    if (this.nueva() !== this.confirmacion()) {
      this.errorMsg.set("Las dos contrase\xF1as no coinciden. Vuelva a escribirlas.");
      return;
    }
    this.errorMsg.set("");
    this.guardando.set(true);
    this.auth.cambiarPasswordObligatorio({ password_nueva: this.nueva() }).subscribe({
      next: (user) => {
        this.guardando.set(false);
        this.router.navigate(["/dashboard"]);
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorMsg.set(this.mensajeError(err));
      }
    });
  }
  mensajeError(err) {
    const detail = err?.error?.detail;
    if (typeof detail === "string")
      return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const primero = detail[0];
      if (primero?.msg)
        return primero.msg;
    }
    return "No se pudo guardar la contrase\xF1a. Intente de nuevo.";
  }
  static \u0275fac = function CambiarClaveComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _CambiarClaveComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _CambiarClaveComponent, selectors: [["app-cambiar-clave"]], decls: 32, vars: 7, consts: [[1, "min-h-screen", "flex", "items-center", "justify-center", "bg-gradient-to-br", "from-primary-600", "to-primary-900", "px-4", "py-8"], [1, "card", "w-full", "max-w-md"], [1, "card-body", "p-8"], [1, "text-center", "mb-6"], [1, "w-16", "h-16", "bg-warning-100", "rounded-2xl", "flex", "items-center", "justify-center", "mx-auto", "mb-4"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", "aria-hidden", "true", 1, "w-8", "h-8", "text-warning-700"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"], [1, "text-2xl", "font-bold", "text-neutral-800"], [1, "text-neutral-500", "mt-1"], ["role", "alert", 1, "alert-danger", "mb-4"], ["novalidate", "", 1, "space-y-5", 3, "ngSubmit"], ["for", "nueva", 1, "form-label"], ["id", "nueva", "type", "password", "name", "nueva", "autocomplete", "new-password", "aria-describedby", "reglas-clave", 1, "form-input", 3, "ngModelChange", "ngModel"], ["for", "confirmacion", 1, "form-label"], ["id", "confirmacion", "type", "password", "name", "confirmacion", "autocomplete", "new-password", 1, "form-input", 3, "ngModelChange", "ngModel"], ["id", "reglas-clave", 1, "space-y-1.5", "text-sm"], [1, "flex", "items-start", "gap-2", 3, "class"], [1, "text-xs", "text-neutral-500", "-mt-2"], ["type", "submit", 1, "btn-primary", "w-full", 3, "disabled"], ["viewBox", "0 0 24 24", "aria-hidden", "true", 1, "animate-spin", "h-5", "w-5"], [1, "border-t", "border-neutral-200", "mt-6", "pt-4", "text-center"], ["type", "button", 1, "text-sm", "text-neutral-500", "hover:text-primary-700", "hover:underline", "focus:outline-none", "focus:ring-2", "focus:ring-primary-200", "rounded", "px-2", "py-1", 3, "click", "disabled"], [1, "flex", "items-start", "gap-2"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", "aria-hidden", "true", 1, "w-4", "h-4", "mt-0.5", "shrink-0"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "2", "d", "M5 13l4 4L19 7"], [1, "sr-only"], ["fill", "none", "stroke", "currentColor", "viewBox", "0 0 24 24", "aria-hidden", "true", 1, "w-4", "h-4", "mt-0.5", "shrink-0", "text-neutral-400"], ["cx", "12", "cy", "12", "r", "8", "stroke-width", "2"], ["cx", "12", "cy", "12", "r", "10", "stroke", "currentColor", "stroke-width", "4", "fill", "none", 1, "opacity-25"], ["fill", "currentColor", "d", "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z", 1, "opacity-75"]], template: function CambiarClaveComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "div", 0)(1, "div", 1)(2, "div", 2)(3, "div", 3)(4, "div", 4);
      \u0275\u0275namespaceSVG();
      \u0275\u0275elementStart(5, "svg", 5);
      \u0275\u0275element(6, "path", 6);
      \u0275\u0275elementEnd()();
      \u0275\u0275namespaceHTML();
      \u0275\u0275elementStart(7, "h1", 7);
      \u0275\u0275text(8, "Defina su contrase\xF1a");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(9, "p", 8);
      \u0275\u0275text(10, " Su clave actual es provisoria. Para seguir usando el sistema tiene que reemplazarla por una suya. ");
      \u0275\u0275elementEnd()();
      \u0275\u0275template(11, CambiarClaveComponent_Conditional_11_Template, 2, 1, "div", 9);
      \u0275\u0275elementStart(12, "form", 10);
      \u0275\u0275listener("ngSubmit", function CambiarClaveComponent_Template_form_ngSubmit_12_listener() {
        return ctx.guardar();
      });
      \u0275\u0275elementStart(13, "div")(14, "label", 11);
      \u0275\u0275text(15, "Contrase\xF1a nueva");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(16, "input", 12);
      \u0275\u0275listener("ngModelChange", function CambiarClaveComponent_Template_input_ngModelChange_16_listener($event) {
        return ctx.nueva.set($event);
      });
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(17, "div")(18, "label", 13);
      \u0275\u0275text(19, "Repita la contrase\xF1a nueva");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(20, "input", 14);
      \u0275\u0275listener("ngModelChange", function CambiarClaveComponent_Template_input_ngModelChange_20_listener($event) {
        return ctx.confirmacion.set($event);
      });
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(21, "ul", 15);
      \u0275\u0275repeaterCreate(22, CambiarClaveComponent_For_23_Template, 5, 4, "li", 16, _forTrack0);
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(24, "p", 17);
      \u0275\u0275text(25, " Adem\xE1s tiene que ser distinta de la clave provisoria; el sistema lo verifica al guardar. ");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(26, "button", 18);
      \u0275\u0275template(27, CambiarClaveComponent_Conditional_27_Template, 3, 0, ":svg:svg", 19);
      \u0275\u0275text(28);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(29, "div", 20)(30, "button", 21);
      \u0275\u0275listener("click", function CambiarClaveComponent_Template_button_click_30_listener() {
        return ctx.auth.logout();
      });
      \u0275\u0275text(31, " Cerrar sesi\xF3n e ingresar con otra cuenta ");
      \u0275\u0275elementEnd()()()()();
    }
    if (rf & 2) {
      \u0275\u0275advance(11);
      \u0275\u0275conditional(ctx.errorMsg() ? 11 : -1);
      \u0275\u0275advance(5);
      \u0275\u0275property("ngModel", ctx.nueva());
      \u0275\u0275advance(4);
      \u0275\u0275property("ngModel", ctx.confirmacion());
      \u0275\u0275advance(2);
      \u0275\u0275repeater(ctx.reglas());
      \u0275\u0275advance(4);
      \u0275\u0275property("disabled", ctx.guardando());
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.guardando() ? 27 : -1);
      \u0275\u0275advance();
      \u0275\u0275textInterpolate1(" ", ctx.guardando() ? "Guardando..." : "Guardar y entrar", " ");
      \u0275\u0275advance(2);
      \u0275\u0275property("disabled", ctx.guardando());
    }
  }, dependencies: [CommonModule, FormsModule, \u0275NgNoValidate, DefaultValueAccessor, NgControlStatus, NgControlStatusGroup, NgModel, NgForm], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(CambiarClaveComponent, [{
    type: Component,
    args: [{
      selector: "app-cambiar-clave",
      standalone: true,
      imports: [CommonModule, FormsModule],
      template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 px-4 py-8">
      <div class="card w-full max-w-md">
        <div class="card-body p-8">
          <div class="text-center mb-6">
            <div class="w-16 h-16 bg-warning-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-warning-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-neutral-800">Defina su contrase\xF1a</h1>
            <p class="text-neutral-500 mt-1">
              Su clave actual es provisoria. Para seguir usando el sistema tiene que
              reemplazarla por una suya.
            </p>
          </div>

          @if (errorMsg()) {
            <div class="alert-danger mb-4" role="alert">{{ errorMsg() }}</div>
          }

          <form (ngSubmit)="guardar()" class="space-y-5" novalidate>
            <div>
              <label class="form-label" for="nueva">Contrase\xF1a nueva</label>
              <input
                id="nueva"
                type="password"
                class="form-input"
                [ngModel]="nueva()"
                (ngModelChange)="nueva.set($event)"
                name="nueva"
                autocomplete="new-password"
                aria-describedby="reglas-clave"
              />
            </div>

            <div>
              <label class="form-label" for="confirmacion">Repita la contrase\xF1a nueva</label>
              <input
                id="confirmacion"
                type="password"
                class="form-input"
                [ngModel]="confirmacion()"
                (ngModelChange)="confirmacion.set($event)"
                name="confirmacion"
                autocomplete="new-password"
              />
            </div>

            <!-- Las reglas se ven antes de escribir y se van cumpliendo a la
                 vista: nadie descubre el requisito reci\xE9n al mandar el
                 formulario. El estado no depende solo del color: cada regla
                 lleva su marca y su texto. -->
            <ul id="reglas-clave" class="space-y-1.5 text-sm">
              @for (r of reglas(); track r.texto) {
                <li class="flex items-start gap-2"
                    [class]="r.cumple ? 'text-accent-700' : 'text-neutral-600'">
                  @if (r.cumple) {
                    <svg class="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="sr-only">Cumple:</span>
                  } @else {
                    <svg class="w-4 h-4 mt-0.5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="8" stroke-width="2" />
                    </svg>
                    <span class="sr-only">Falta:</span>
                  }
                  <span>{{ r.texto }}</span>
                </li>
              }
            </ul>
            <p class="text-xs text-neutral-500 -mt-2">
              Adem\xE1s tiene que ser distinta de la clave provisoria; el sistema lo verifica al
              guardar.
            </p>

            <button type="submit" class="btn-primary w-full" [disabled]="guardando()">
              @if (guardando()) {
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              }
              {{ guardando() ? 'Guardando...' : 'Guardar y entrar' }}
            </button>
          </form>

          <!-- \xDAnica salida posible: irse. No se ofrece "m\xE1s tarde" porque no
               existe: el sistema no responde nada m\xE1s hasta el cambio. -->
          <div class="border-t border-neutral-200 mt-6 pt-4 text-center">
            <button type="button" (click)="auth.logout()" [disabled]="guardando()"
                    class="text-sm text-neutral-500 hover:text-primary-700 hover:underline
                           focus:outline-none focus:ring-2 focus:ring-primary-200 rounded px-2 py-1">
              Cerrar sesi\xF3n e ingresar con otra cuenta
            </button>
          </div>
        </div>
      </div>
    </div>
  `
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(CambiarClaveComponent, { className: "CambiarClaveComponent", filePath: "src/app/features/auth/cambiar-clave.component.ts", lineNumber: 127 });
})();
export {
  CambiarClaveComponent
};
//# sourceMappingURL=chunk-BDYLXP2S.js.map
