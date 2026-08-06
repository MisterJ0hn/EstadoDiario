import {
  HttpClient,
  HttpParams,
  Injectable,
  environment,
  inject,
  setClassMetadata,
  ɵɵdefineInjectable
} from "./chunk-WMIGZGXS.js";

// src/app/features/audiencias/services/audiencia.service.ts
var AudienciaService = class _AudienciaService {
  apiUrl = `${environment.apiUrl}/audiencias`;
  http = inject(HttpClient);
  getAudiencias(filtros = {}) {
    return this.http.get(this.apiUrl, {
      params: this.toParams(filtros)
    });
  }
  /** Conteo por materia (pestañas) y tipos de audiencia disponibles (combo). */
  getResumen(filtros = {}) {
    return this.http.get(`${this.apiUrl}/resumen`, {
      params: this.toParams({
        tipo_audiencia: filtros.tipo_audiencia,
        tribunal: filtros.tribunal,
        busqueda: filtros.busqueda,
        rut: filtros.rut,
        origen_id: filtros.origen_id,
        desde: filtros.desde,
        hasta: filtros.hasta,
        incluir_pasadas: filtros.incluir_pasadas
      })
    });
  }
  /**
   * Audiencias de una ventana de fechas para el calendario. El rango es
   * obligatorio: las audiencias se acumulan sin techo y no se traen todas.
   */
  getCalendario(desde, hasta) {
    const params = new HttpParams().set("desde", desde).set("hasta", hasta);
    return this.http.get(`${this.apiUrl}/calendario`, { params });
  }
  uploadFile(file, rut, fecha) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("rut", rut || "");
    formData.append("fecha", fecha || "");
    return this.http.post(`${this.apiUrl}/upload`, formData);
  }
  /** Reintento manual: publica en Google las audiencias futuras que falten. */
  sincronizarGoogle() {
    return this.http.post(`${this.apiUrl}/sincronizar-google`, {});
  }
  toParams(filtros) {
    let params = new HttpParams();
    if (filtros.materia)
      params = params.set("materia", filtros.materia);
    if (filtros.tipo_audiencia)
      params = params.set("tipo_audiencia", filtros.tipo_audiencia);
    if (filtros.tribunal)
      params = params.set("tribunal", filtros.tribunal);
    if (filtros.busqueda)
      params = params.set("busqueda", filtros.busqueda);
    if (filtros.rut)
      params = params.set("rut", filtros.rut);
    if (filtros.origen_id)
      params = params.set("origen_id", filtros.origen_id);
    if (filtros.desde)
      params = params.set("desde", filtros.desde);
    if (filtros.hasta)
      params = params.set("hasta", filtros.hasta);
    if (filtros.incluir_pasadas)
      params = params.set("incluir_pasadas", true);
    if (filtros.page)
      params = params.set("page", filtros.page);
    if (filtros.limit)
      params = params.set("limit", filtros.limit);
    return params;
  }
  static \u0275fac = function AudienciaService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _AudienciaService)();
  };
  static \u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _AudienciaService, factory: _AudienciaService.\u0275fac, providedIn: "root" });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(AudienciaService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

export {
  AudienciaService
};
//# sourceMappingURL=chunk-IYRFMHMF.js.map
