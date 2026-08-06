import {
  Directory
} from "./chunk-NEYQRVBS.js";
import {
  Capacitor,
  registerPlugin
} from "./chunk-GTR5QLCS.js";
import {
  HttpClient,
  Injectable,
  environment,
  inject,
  setClassMetadata,
  ɵɵdefineInjectable
} from "./chunk-WMIGZGXS.js";
import {
  __async
} from "./chunk-XWLXMCJQ.js";

// src/app/features/reportes/services/reporte.service.ts
var ReporteService = class _ReporteService {
  apiUrl = `${environment.apiUrl}/reportes`;
  http = inject(HttpClient);
  /** Catálogo de fuentes y campos con que se pinta el selector. */
  getCampos() {
    return this.http.get(`${this.apiUrl}/campos`);
  }
  getPlantillas() {
    return this.http.get(this.apiUrl);
  }
  crear(datos) {
    return this.http.post(this.apiUrl, datos);
  }
  actualizar(id, datos) {
    return this.http.put(`${this.apiUrl}/${id}`, datos);
  }
  eliminar(id) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
  /** Genera el Excel y lo despacha al correo del usuario de la sesión. */
  enviar(id) {
    return this.http.post(`${this.apiUrl}/${id}/enviar`, {});
  }
  /** Descarga directa del .xlsx, sin pasar por el correo. */
  descargar(id) {
    return this.http.get(`${this.apiUrl}/${id}/descargar`, { responseType: "blob" });
  }
  static \u0275fac = function ReporteService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _ReporteService)();
  };
  static \u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _ReporteService, factory: _ReporteService.\u0275fac, providedIn: "root" });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ReporteService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

// node_modules/@capacitor/synapse/dist/synapse.mjs
function s(t) {
  t.CapacitorUtils.Synapse = new Proxy({}, {
    get(e, n) {
      return new Proxy({}, {
        get(w, o) {
          return (c, p, r) => {
            const i = t.Capacitor.Plugins[n];
            if (i === void 0) {
              r(new Error(`Capacitor plugin ${n} not found`));
              return;
            }
            if (typeof i[o] != "function") {
              r(new Error(`Method ${o} not found in Capacitor plugin ${n}`));
              return;
            }
            (() => __async(null, null, function* () {
              try {
                const a = yield i[o](c);
                p(a);
              } catch (a) {
                r(a);
              }
            }))();
          };
        }
      });
    }
  });
}
function u(t) {
  t.CapacitorUtils.Synapse = new Proxy({}, {
    get(e, n) {
      return t.cordova.plugins[n];
    }
  });
}
function f(t = false) {
  typeof window > "u" || (window.CapacitorUtils = window.CapacitorUtils || {}, window.Capacitor !== void 0 && !t ? s(window) : window.cordova !== void 0 && u(window));
}

// node_modules/@capacitor/filesystem/dist/esm/index.js
var Filesystem = registerPlugin("Filesystem", {
  web: () => import("./chunk-5XXWAH66.js").then((m) => new m.FilesystemWeb())
});
f();

// node_modules/@capacitor/share/dist/esm/index.js
var Share = registerPlugin("Share", {
  web: () => import("./chunk-2DP45BDV.js").then((m) => new m.ShareWeb())
});

// src/app/core/utils/descarga.ts
function descargarBlob(blob, nombreArchivo, titulo = "Informe") {
  return __async(this, null, function* () {
    if (!Capacitor.isNativePlatform()) {
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      return;
    }
    const base64 = yield blobABase64(blob);
    const { uri } = yield Filesystem.writeFile({
      path: nombreArchivo,
      data: base64,
      directory: Directory.Cache
    });
    yield Share.share({
      title: titulo,
      text: nombreArchivo,
      url: uri,
      dialogTitle: "Guardar o compartir el informe"
    });
  });
}
function blobABase64(blob) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(lector.error);
    lector.onload = () => {
      const resultado = String(lector.result);
      resolver(resultado.slice(resultado.indexOf(",") + 1));
    };
    lector.readAsDataURL(blob);
  });
}
function mensajeErrorBlob(error, respaldo) {
  const cuerpo = error?.error;
  if (cuerpo instanceof Blob) {
    return cuerpo.text().then((texto) => {
      try {
        const json = JSON.parse(texto);
        return json.detail || json.mensaje || respaldo;
      } catch {
        return texto || respaldo;
      }
    });
  }
  const detalle = cuerpo?.detail;
  return Promise.resolve(detalle || respaldo);
}
function nombreArchivoSeguro(nombre, extension = ".xlsx") {
  const limpio = (nombre || "informe").replace(/[\\/:*?"<>|]+/g, "_").trim();
  return `${limpio || "informe"}${extension}`;
}

export {
  ReporteService,
  descargarBlob,
  mensajeErrorBlob,
  nombreArchivoSeguro
};
//# sourceMappingURL=chunk-2OY4HAWA.js.map
