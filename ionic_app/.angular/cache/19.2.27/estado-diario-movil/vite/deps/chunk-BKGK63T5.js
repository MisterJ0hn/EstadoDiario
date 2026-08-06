import {
  e
} from "./chunk-MPEVUBGY.js";
import {
  a
} from "./chunk-JCI6M4U3.js";
import {
  __async
} from "./chunk-XWLXMCJQ.js";

// node_modules/@ionic/core/components/p-DRugphUN.js
var a2 = "ion-content";
var t = ".ion-content-scroll-host";
var r = `${a2}, ${t}`;
var e2 = (o) => "ION-CONTENT" === o.tagName;
var i = (s) => __async(null, null, function* () {
  return e2(s) ? (yield new Promise((a3) => e(s, a3)), s.getScrollElement()) : s;
});
var n = (o) => o.querySelector(t) || o.querySelector(r);
var m = (o) => o.closest(r);
var c = (o, s) => e2(o) ? o.scrollToTop(s) : Promise.resolve(o.scrollTo({
  top: 0,
  left: 0,
  behavior: "smooth"
}));
var f = (o, s, a3, t2) => e2(o) ? o.scrollByPoint(s, a3, t2) : Promise.resolve(o.scrollBy({
  top: a3,
  left: s,
  behavior: t2 > 0 ? "smooth" : "auto"
}));
var p = (o) => a(o, a2);
var h = (o) => {
  if (e2(o)) {
    const s = o.scrollY;
    return o.scrollY = false, s;
  }
  return o.style.setProperty("overflow", "hidden"), true;
};
var l = (o, s) => {
  e2(o) ? o.scrollY = s : o.style.removeProperty("overflow");
};

export {
  a2 as a,
  t,
  e2 as e,
  i,
  n,
  m,
  c,
  f,
  p,
  h,
  l
};
/*! Bundled license information:

@ionic/core/components/p-DRugphUN.js:
  (*!
   * (C) Ionic http://ionicframework.com - MIT License
   *)
*/
//# sourceMappingURL=chunk-BKGK63T5.js.map
