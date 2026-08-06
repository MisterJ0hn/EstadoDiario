import {
  HttpClient,
  HttpParams,
  Injectable,
  environment,
  setClassMetadata,
  ɵɵdefineInjectable,
  ɵɵinject
} from "./chunk-WMIGZGXS.js";

// src/app/features/estado-diario/services/estado-diario.service.ts
var EstadoDiarioService = class _EstadoDiarioService {
  http;
  apiUrl = `${environment.apiUrl}/estado-diario`;
  jurisdiccionUrl = `${environment.apiUrl}/jurisdicciones`;
  constructor(http) {
    this.http = http;
  }
  // ── Jurisdicciones ─────────────────────
  /**
   * `excluirCorte` deja fuera Corte Suprema y Corte de Apelaciones. Se usa en
   * el filtro de Materia: esas causas se movieron a su propia tabla, así que
   * ofrecerlas ahí no filtraría nada.
   */
  getJurisdicciones(excluirCorte = false) {
    const params = excluirCorte ? new HttpParams().set("excluir_corte", true) : void 0;
    return this.http.get(this.jurisdiccionUrl, { params });
  }
  // ── Causas de corte ────────────────────
  getCortes(params = {}) {
    let httpParams = new HttpParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== void 0 && valor !== null && valor !== "") {
        httpParams = httpParams.set(clave, valor);
      }
    }
    return this.http.get(`${this.apiUrl}/cortes`, { params: httpParams });
  }
  // ── Orígenes ───────────────────────────
  getOrigenes(page = 1, perPage = 20, tipo) {
    let params = new HttpParams().set("page", page).set("per_page", perPage);
    if (tipo)
      params = params.set("tipo", tipo);
    return this.http.get(`${this.apiUrl}/origenes`, { params });
  }
  deleteOrigen(id) {
    return this.http.delete(`${this.apiUrl}/origenes/${id}`);
  }
  uploadFile(file, rut, fecha) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("rut", rut || "");
    formData.append("fecha", fecha || "");
    return this.http.post(`${this.apiUrl}/upload`, formData);
  }
  // ── Movimientos ────────────────────────
  getMovimientos(filter, params = {}) {
    let httpParams = new HttpParams();
    if (params.jurisdiccion)
      httpParams = httpParams.set("jurisdiccion", params.jurisdiccion);
    if (params.fecha_desde)
      httpParams = httpParams.set("fecha_desde", params.fecha_desde);
    if (params.fecha_hasta)
      httpParams = httpParams.set("fecha_hasta", params.fecha_hasta);
    if (params.rut)
      httpParams = httpParams.set("rut", params.rut);
    if (params.page)
      httpParams = httpParams.set("page", params.page);
    if (params.limit)
      httpParams = httpParams.set("limit", params.limit);
    return this.http.get(`${this.apiUrl}/${filter}`, { params: httpParams });
  }
  getMovimientosByOrigen(origenId) {
    return this.http.get(`${this.apiUrl}/origenes/${origenId}/movimientos`);
  }
  getMovimientoDetalle(id) {
    return this.http.get(`${this.apiUrl}/${id}`);
  }
  // ── Acciones ───────────────────────────
  /** La observación es opcional; si no se indica se manda el body vacío. */
  marcarLeido(id, observacion) {
    const body = observacion?.trim() ? { observacion: observacion.trim() } : {};
    return this.http.post(`${this.apiUrl}/${id}/leido`, body);
  }
  marcarPendiente(id, data) {
    return this.http.post(`${this.apiUrl}/${id}/pendiente`, data);
  }
  // ── Agendas / Recordatorios ─────────────
  getAgendas(estadoDiarioId) {
    return this.http.get(`${this.apiUrl}/${estadoDiarioId}/agendas`);
  }
  crearAgenda(estadoDiarioId, data) {
    return this.http.post(`${this.apiUrl}/${estadoDiarioId}/agenda`, data);
  }
  finalizarAgenda(agendaId, data) {
    return this.http.post(`${this.apiUrl}/agendas/${agendaId}/finalizar`, data);
  }
  getCalendario() {
    return this.http.get(`${this.apiUrl}/calendario`);
  }
  static \u0275fac = function EstadoDiarioService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _EstadoDiarioService)(\u0275\u0275inject(HttpClient));
  };
  static \u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _EstadoDiarioService, factory: _EstadoDiarioService.\u0275fac, providedIn: "root" });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(EstadoDiarioService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], () => [{ type: HttpClient }], null);
})();

export {
  EstadoDiarioService
};
//# sourceMappingURL=chunk-FLTDD2QG.js.map
