import {
  EstadoDiarioService
} from "./chunk-FLTDD2QG.js";
import {
  NotificationService
} from "./chunk-ZKUWYJUU.js";
import {
  AuthService
} from "./chunk-M4LO6B3L.js";
import {
  CheckboxControlValueAccessor,
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
  EventEmitter,
  Input,
  Output,
  inject,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵconditional,
  ɵɵdefineComponent,
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
  ɵɵtextInterpolate1,
  ɵɵtwoWayBindingSet,
  ɵɵtwoWayListener,
  ɵɵtwoWayProperty
} from "./chunk-WMIGZGXS.js";

// src/app/features/estado-diario/components/recordatorio-modal/recordatorio-modal.component.ts
function RecordatorioModalComponent_Conditional_0_Conditional_35_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 20)(1, "div")(2, "label", 24);
    \u0275\u0275text(3, "Tel\xE9fono");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(4, "input", 25);
    \u0275\u0275twoWayListener("ngModelChange", function RecordatorioModalComponent_Conditional_0_Conditional_35_Template_input_ngModelChange_4_listener($event) {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext(2);
      \u0275\u0275twoWayBindingSet(ctx_r1.telefono, $event) || (ctx_r1.telefono = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(5, "div")(6, "label", 26);
    \u0275\u0275text(7, "Hora de env\xEDo");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "input", 27);
    \u0275\u0275twoWayListener("ngModelChange", function RecordatorioModalComponent_Conditional_0_Conditional_35_Template_input_ngModelChange_8_listener($event) {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext(2);
      \u0275\u0275twoWayBindingSet(ctx_r1.horaWhatsapp, $event) || (ctx_r1.horaWhatsapp = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(9, "p", 15);
    \u0275\u0275text(10);
    \u0275\u0275elementEnd()()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(4);
    \u0275\u0275twoWayProperty("ngModel", ctx_r1.telefono);
    \u0275\u0275advance(4);
    \u0275\u0275twoWayProperty("ngModel", ctx_r1.horaWhatsapp);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate1(" Se enviar\xE1 el ", ctx_r1.fechaLegible(), ". ");
  }
}
function RecordatorioModalComponent_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 1);
    \u0275\u0275listener("click", function RecordatorioModalComponent_Conditional_0_Template_div_click_0_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cerrar());
    });
    \u0275\u0275elementStart(1, "div", 2);
    \u0275\u0275listener("click", function RecordatorioModalComponent_Conditional_0_Template_div_click_1_listener($event) {
      \u0275\u0275restoreView(_r1);
      return \u0275\u0275resetView($event.stopPropagation());
    });
    \u0275\u0275elementStart(2, "div", 3)(3, "h3", 4);
    \u0275\u0275text(4, "Marcar como pendiente");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "button", 5);
    \u0275\u0275listener("click", function RecordatorioModalComponent_Conditional_0_Template_button_click_5_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cerrar());
    });
    \u0275\u0275text(6, "\xD7");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(7, "div", 6)(8, "p", 7);
    \u0275\u0275text(9, " El registro queda pendiente con el nivel de urgencia indicado y se agenda el recordatorio. ");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(10, "div")(11, "label", 8);
    \u0275\u0275text(12, "Nivel de urgencia");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(13, "select", 9);
    \u0275\u0275twoWayListener("ngModelChange", function RecordatorioModalComponent_Conditional_0_Template_select_ngModelChange_13_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r1.nivel, $event) || (ctx_r1.nivel = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementStart(14, "option", 10);
    \u0275\u0275text(15, "Bajo");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(16, "option", 11);
    \u0275\u0275text(17, "Medio");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(18, "option", 12);
    \u0275\u0275text(19, "Alto");
    \u0275\u0275elementEnd()()();
    \u0275\u0275elementStart(20, "div")(21, "label", 8);
    \u0275\u0275text(22, "Detalle");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(23, "textarea", 13);
    \u0275\u0275twoWayListener("ngModelChange", function RecordatorioModalComponent_Conditional_0_Template_textarea_ngModelChange_23_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r1.detalle, $event) || (ctx_r1.detalle = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(24, "div")(25, "label", 8);
    \u0275\u0275text(26, "Fecha del recordatorio");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(27, "input", 14);
    \u0275\u0275twoWayListener("ngModelChange", function RecordatorioModalComponent_Conditional_0_Template_input_ngModelChange_27_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r1.fecha, $event) || (ctx_r1.fecha = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(28, "p", 15);
    \u0275\u0275text(29, " Se agrega como evento de todo el d\xEDa en tu Google Calendar (si est\xE1 conectado). ");
    \u0275\u0275elementEnd()();
    \u0275\u0275element(30, "hr", 16);
    \u0275\u0275elementStart(31, "label", 17)(32, "input", 18);
    \u0275\u0275twoWayListener("ngModelChange", function RecordatorioModalComponent_Conditional_0_Template_input_ngModelChange_32_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r1.notificarWhatsapp, $event) || (ctx_r1.notificarWhatsapp = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(33, "span", 19);
    \u0275\u0275text(34, "Notificar por WhatsApp");
    \u0275\u0275elementEnd()();
    \u0275\u0275template(35, RecordatorioModalComponent_Conditional_0_Conditional_35_Template, 11, 3, "div", 20);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(36, "div", 21)(37, "button", 22);
    \u0275\u0275listener("click", function RecordatorioModalComponent_Conditional_0_Template_button_click_37_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.cerrar());
    });
    \u0275\u0275text(38, "Cancelar");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(39, "button", 23);
    \u0275\u0275listener("click", function RecordatorioModalComponent_Conditional_0_Template_button_click_39_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.guardar());
    });
    \u0275\u0275text(40);
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(13);
    \u0275\u0275twoWayProperty("ngModel", ctx_r1.nivel);
    \u0275\u0275advance(10);
    \u0275\u0275twoWayProperty("ngModel", ctx_r1.detalle);
    \u0275\u0275advance(4);
    \u0275\u0275twoWayProperty("ngModel", ctx_r1.fecha);
    \u0275\u0275advance(5);
    \u0275\u0275twoWayProperty("ngModel", ctx_r1.notificarWhatsapp);
    \u0275\u0275advance(3);
    \u0275\u0275conditional(ctx_r1.notificarWhatsapp ? 35 : -1);
    \u0275\u0275advance(4);
    \u0275\u0275property("disabled", ctx_r1.saving());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r1.saving() ? "Guardando..." : "Guardar", " ");
  }
}
var HORA_WHATSAPP_POR_DEFECTO = "09:00";
var RecordatorioModalComponent = class _RecordatorioModalComponent {
  service = inject(EstadoDiarioService);
  notification = inject(NotificationService);
  auth = inject(AuthService);
  _movimientoId = null;
  set movimientoId(id) {
    this._movimientoId = id;
    if (id !== null)
      this.resetForm();
  }
  get movimientoId() {
    return this._movimientoId;
  }
  /** Emitido al cancelar o cerrar el modal (con o sin éxito). */
  cerrado = new EventEmitter();
  /** Emitido solo cuando el recordatorio se creó correctamente. */
  guardado = new EventEmitter();
  saving = signal(false);
  nivel = "medio";
  detalle = "";
  fecha = "";
  notificarWhatsapp = false;
  telefono = "";
  /** Solo la hora (HH:mm). La fecha de envío es siempre la del recordatorio. */
  horaWhatsapp = HORA_WHATSAPP_POR_DEFECTO;
  resetForm() {
    this.nivel = "medio";
    this.detalle = "";
    this.fecha = "";
    this.notificarWhatsapp = false;
    this.telefono = this.auth.user()?.telefono ?? "";
    this.horaWhatsapp = HORA_WHATSAPP_POR_DEFECTO;
  }
  /** Fecha del recordatorio en formato chileno, para el texto de ayuda. */
  fechaLegible() {
    if (!this.fecha)
      return "el d\xEDa del recordatorio";
    const [anio, mes, dia] = this.fecha.split("-");
    return dia && mes && anio ? `${dia}-${mes}-${anio}` : this.fecha;
  }
  cerrar() {
    if (this.saving())
      return;
    this.cerrado.emit();
  }
  guardar() {
    if (!this.detalle.trim() || !this.fecha) {
      this.notification.warning("Complete el detalle y la fecha del recordatorio");
      return;
    }
    if (this.notificarWhatsapp && (!this.telefono.trim() || !this.horaWhatsapp)) {
      this.notification.warning("Para notificar por WhatsApp indique tel\xE9fono y hora de env\xEDo");
      return;
    }
    const id = this.movimientoId;
    if (id === null)
      return;
    const user = this.auth.user();
    this.saving.set(true);
    this.service.marcarPendiente(id, {
      nivel: this.nivel,
      username: user?.username,
      mensaje: this.detalle,
      fecha_hora: `${this.fecha} 00:00:00`,
      notificar_whatsapp: this.notificarWhatsapp,
      whatsapp_telefono: this.notificarWhatsapp ? this.telefono.trim() : void 0,
      // El backend sigue esperando fecha y hora completas; se arma juntando la
      // fecha del recordatorio con la hora que eligió el usuario.
      fecha_hora_whatsapp: this.notificarWhatsapp ? `${this.fecha} ${this.horaWhatsapp}:00` : void 0
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.notification.success("Marcado como pendiente");
        this.guardado.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.notification.error(err.error?.detail || "Error al marcar como pendiente");
      }
    });
  }
  static \u0275fac = function RecordatorioModalComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _RecordatorioModalComponent)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _RecordatorioModalComponent, selectors: [["app-recordatorio-modal"]], inputs: { movimientoId: "movimientoId" }, outputs: { cerrado: "cerrado", guardado: "guardado" }, decls: 1, vars: 1, consts: [[1, "modal-backdrop"], [1, "modal-backdrop", 3, "click"], [1, "modal-content", 3, "click"], [1, "modal-header"], [1, "text-lg", "font-semibold"], [1, "text-neutral-400", "hover:text-neutral-600", 3, "click"], [1, "modal-body", "space-y-4"], [1, "text-sm", "text-neutral-500"], [1, "form-label"], [1, "form-select", 3, "ngModelChange", "ngModel"], ["value", "bajo"], ["value", "medio"], ["value", "alto"], ["rows", "3", "placeholder", "Descripci\xF3n del recordatorio...", 1, "form-input", 3, "ngModelChange", "ngModel"], ["type", "date", 1, "form-input", 3, "ngModelChange", "ngModel"], [1, "text-xs", "text-neutral-400", "mt-1"], [1, "border-neutral-200"], [1, "flex", "items-center", "gap-2", "cursor-pointer"], ["type", "checkbox", 3, "ngModelChange", "ngModel"], [1, "text-sm", "text-neutral-700"], [1, "grid", "grid-cols-1", "md:grid-cols-2", "gap-4"], [1, "modal-footer"], [1, "btn-secondary", 3, "click"], [1, "btn-primary", 3, "click", "disabled"], ["for", "wa-telefono", 1, "form-label"], ["id", "wa-telefono", "type", "text", "placeholder", "+56912345678", 1, "form-input", 3, "ngModelChange", "ngModel"], ["for", "wa-hora", 1, "form-label"], ["id", "wa-hora", "type", "time", 1, "form-input", 3, "ngModelChange", "ngModel"]], template: function RecordatorioModalComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275template(0, RecordatorioModalComponent_Conditional_0_Template, 41, 7, "div", 0);
    }
    if (rf & 2) {
      \u0275\u0275conditional(ctx.movimientoId !== null ? 0 : -1);
    }
  }, dependencies: [CommonModule, FormsModule, NgSelectOption, \u0275NgSelectMultipleOption, DefaultValueAccessor, CheckboxControlValueAccessor, SelectControlValueAccessor, NgControlStatus, NgModel], encapsulation: 2 });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(RecordatorioModalComponent, [{
    type: Component,
    args: [{
      selector: "app-recordatorio-modal",
      standalone: true,
      imports: [CommonModule, FormsModule],
      template: `
    @if (movimientoId !== null) {
      <div class="modal-backdrop" (click)="cerrar()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">Marcar como pendiente</h3>
            <button (click)="cerrar()" class="text-neutral-400 hover:text-neutral-600">&times;</button>
          </div>
          <div class="modal-body space-y-4">
            <p class="text-sm text-neutral-500">
              El registro queda pendiente con el nivel de urgencia indicado y se agenda el recordatorio.
            </p>
            <div>
              <label class="form-label">Nivel de urgencia</label>
              <select class="form-select" [(ngModel)]="nivel">
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
              </select>
            </div>
            <div>
              <label class="form-label">Detalle</label>
              <textarea class="form-input" rows="3" [(ngModel)]="detalle" placeholder="Descripci\xF3n del recordatorio..."></textarea>
            </div>
            <div>
              <label class="form-label">Fecha del recordatorio</label>
              <input type="date" class="form-input" [(ngModel)]="fecha" />
              <p class="text-xs text-neutral-400 mt-1">
                Se agrega como evento de todo el d\xEDa en tu Google Calendar (si est\xE1 conectado).
              </p>
            </div>

            <hr class="border-neutral-200" />

            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" [(ngModel)]="notificarWhatsapp" />
              <span class="text-sm text-neutral-700">Notificar por WhatsApp</span>
            </label>

            @if (notificarWhatsapp) {
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="form-label" for="wa-telefono">Tel\xE9fono</label>
                  <input id="wa-telefono" type="text" class="form-input" [(ngModel)]="telefono"
                         placeholder="+56912345678" />
                </div>
                <div>
                  <!-- Solo la hora: el WhatsApp se env\xEDa el mismo d\xEDa del
                       recordatorio, as\xED que la fecha se toma de ah\xED y no se
                       vuelve a pedir. -->
                  <label class="form-label" for="wa-hora">Hora de env\xEDo</label>
                  <input id="wa-hora" type="time" class="form-input" [(ngModel)]="horaWhatsapp" />
                  <p class="text-xs text-neutral-400 mt-1">
                    Se enviar\xE1 el {{ fechaLegible() }}.
                  </p>
                </div>
              </div>
            }
          </div>
          <div class="modal-footer">
            <button (click)="cerrar()" class="btn-secondary">Cancelar</button>
            <button (click)="guardar()" class="btn-primary" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `
    }]
  }], null, { movimientoId: [{
    type: Input
  }], cerrado: [{
    type: Output
  }], guardado: [{
    type: Output
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(RecordatorioModalComponent, { className: "RecordatorioModalComponent", filePath: "src/app/features/estado-diario/components/recordatorio-modal/recordatorio-modal.component.ts", lineNumber: 94 });
})();

export {
  RecordatorioModalComponent
};
//# sourceMappingURL=chunk-WXMCI2HJ.js.map
