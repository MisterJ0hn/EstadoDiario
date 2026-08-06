import {
  o
} from "./chunk-MJA5TOG2.js";
import {
  b
} from "./chunk-MPEVUBGY.js";
import {
  s
} from "./chunk-336XFI5V.js";
import "./chunk-JCI6M4U3.js";
import "./chunk-XWLXMCJQ.js";

// node_modules/@ionic/core/components/p-gAg0kXZp.js
var s2 = (s3, e, n, a, c) => {
  const i = s3.ownerDocument.defaultView;
  let p = o(s3);
  const m = (t) => p ? -t.deltaX : t.deltaX;
  return s({
    el: s3,
    gestureName: "goback-swipe",
    gesturePriority: 101,
    threshold: 10,
    canStart: (t) => (p = o(s3), ((t2) => {
      const {
        startX: o2
      } = t2;
      return p ? o2 >= i.innerWidth - 50 : o2 <= 50;
    })(t) && e()),
    onStart: n,
    onMove: (t) => {
      const o2 = m(t);
      a(o2 / i.innerWidth);
    },
    onEnd: (o2) => {
      const r = m(o2), s4 = i.innerWidth, e2 = r / s4, n2 = ((t) => p ? -t.velocityX : t.velocityX)(o2), a2 = n2 >= 0 && (n2 > 0.2 || r > s4 / 2), f = (a2 ? 1 - e2 : e2) * s4;
      let h = 0;
      if (f > 5) {
        const t = f / Math.abs(n2);
        h = Math.min(t, 540);
      }
      c(a2, e2 <= 0 ? 0.01 : b(0, e2, 0.9999), h);
    }
  });
};
export {
  s2 as createSwipeBackGesture
};
/*! Bundled license information:

@ionic/core/components/p-gAg0kXZp.js:
  (*!
   * (C) Ionic http://ionicframework.com - MIT License
   *)
*/
//# sourceMappingURL=p-gAg0kXZp-BZUKAZ4W.js.map
