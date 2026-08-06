import {
  c,
  m
} from "./chunk-BKGK63T5.js";
import {
  e
} from "./chunk-MPEVUBGY.js";
import {
  H,
  P
} from "./chunk-JCI6M4U3.js";
import {
  __async
} from "./chunk-XWLXMCJQ.js";

// node_modules/@ionic/core/components/p-DHTSTb52.js
var n = () => {
  const n2 = window;
  n2.addEventListener("statusTap", () => {
    H(() => {
      const o = document.elementFromPoint(n2.innerWidth / 2, n2.innerHeight / 2);
      if (!o) return;
      const m2 = m(o);
      m2 && new Promise((o2) => e(m2, o2)).then(() => {
        P(() => __async(null, null, function* () {
          m2.style.setProperty("--overflow", "hidden"), yield c(m2, 300), m2.style.removeProperty("--overflow");
        }));
      });
    });
  });
};
export {
  n as startStatusTap
};
/*! Bundled license information:

@ionic/core/components/p-DHTSTb52.js:
  (*!
   * (C) Ionic http://ionicframework.com - MIT License
   *)
*/
//# sourceMappingURL=p-DHTSTb52-LX3JLXEO.js.map
