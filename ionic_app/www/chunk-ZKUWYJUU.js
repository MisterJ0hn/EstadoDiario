import {
  Injectable,
  setClassMetadata,
  signal,
  ɵɵdefineInjectable
} from "./chunk-WMIGZGXS.js";

// src/app/core/services/notification.service.ts
var NotificationService = class _NotificationService {
  _counter = 0;
  _notifications = signal([]);
  notifications = this._notifications.asReadonly();
  show(type, message, duration = 4e3) {
    const id = ++this._counter;
    this._notifications.update((list) => [...list, { id, type, message }]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }
  success(message) {
    this.show("success", message);
  }
  error(message) {
    this.show("error", message, 6e3);
  }
  warning(message) {
    this.show("warning", message);
  }
  info(message) {
    this.show("info", message);
  }
  dismiss(id) {
    this._notifications.update((list) => list.filter((n) => n.id !== id));
  }
  static \u0275fac = function NotificationService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _NotificationService)();
  };
  static \u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _NotificationService, factory: _NotificationService.\u0275fac, providedIn: "root" });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NotificationService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

export {
  NotificationService
};
//# sourceMappingURL=chunk-ZKUWYJUU.js.map
