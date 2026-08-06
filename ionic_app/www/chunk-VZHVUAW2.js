import {
  c,
  m
} from "./chunk-LBQZL65R.js";
import {
  e
} from "./chunk-2B2MM3ZS.js";
import {
  H,
  P
} from "./chunk-KKZ6NJ4Z.js";
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
//# sourceMappingURL=chunk-VZHVUAW2.js.map
