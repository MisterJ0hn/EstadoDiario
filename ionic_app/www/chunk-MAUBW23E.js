import {
  HttpClient,
  HttpParams,
  Injectable,
  environment,
  inject,
  setClassMetadata,
  ɵɵdefineInjectable
} from "./chunk-WMIGZGXS.js";

// src/app/features/movimientos/services/movimiento.service.ts
var MovimientoService = class _MovimientoService {
  apiUrl = `${environment.apiUrl}/movimientos`;
  http = inject(HttpClient);
  getMovimientos(filtros = {}) {
    return this.http.get(this.apiUrl, {
      params: this.toParams(filtros)
    });
  }
  /** Conteo por materia (pestañas) y estados de causa disponibles (combo). */
  getResumen(filtros = {}) {
    return this.http.get(`${this.apiUrl}/resumen`, {
      params: this.toParams({
        estado_causa: filtros.estado_causa,
        tribunal: filtros.tribunal,
        busqueda: filtros.busqueda,
        rut: filtros.rut,
        origen_id: filtros.origen_id
      })
    });
  }
  /** Causas de corte: viven en otra tabla y se muestran en el submenú Corte. */
  getCortes(params = {}) {
    let httpParams = new HttpParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== void 0 && valor !== null && valor !== "") {
        httpParams = httpParams.set(clave, valor);
      }
    }
    return this.http.get(`${this.apiUrl}/cortes`, {
      params: httpParams
    });
  }
  uploadFile(file, rut, fecha) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("rut", rut || "");
    formData.append("fecha", fecha || "");
    return this.http.post(`${this.apiUrl}/upload`, formData);
  }
  toParams(filtros) {
    let params = new HttpParams();
    if (filtros.materia)
      params = params.set("materia", filtros.materia);
    if (filtros.estado_causa)
      params = params.set("estado_causa", filtros.estado_causa);
    if (filtros.tribunal)
      params = params.set("tribunal", filtros.tribunal);
    if (filtros.busqueda)
      params = params.set("busqueda", filtros.busqueda);
    if (filtros.rut)
      params = params.set("rut", filtros.rut);
    if (filtros.origen_id)
      params = params.set("origen_id", filtros.origen_id);
    if (filtros.page)
      params = params.set("page", filtros.page);
    if (filtros.limit)
      params = params.set("limit", filtros.limit);
    return params;
  }
  static \u0275fac = function MovimientoService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _MovimientoService)();
  };
  static \u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _MovimientoService, factory: _MovimientoService.\u0275fac, providedIn: "root" });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MovimientoService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

export {
  MovimientoService
};
//# sourceMappingURL=chunk-MAUBW23E.js.map
