import {
  U,
  r
} from "./chunk-YIQUV7N7.js";

// node_modules/@ionic/core/components/p-BsBCoGa-.js
var i = (i2, r2) => {
  var a, n, e;
  const s = "40px", c = "back" === r2.direction, l = r2.leavingEl, p = U(r2.enteringEl), b = p.querySelector("ion-toolbar"), m = r();
  if (m.addElement(p).fill("both").beforeRemoveClass("ion-page-invisible"), c ? m.duration((null !== (a = r2.duration) && void 0 !== a ? a : 0) || 200).easing("cubic-bezier(0.47,0,0.745,0.715)") : m.duration((null !== (n = r2.duration) && void 0 !== n ? n : 0) || 280).easing("cubic-bezier(0.36,0.66,0.04,1)").fromTo("transform", `translateY(${s})`, "translateY(0px)").fromTo("opacity", 0.01, 1), b) {
    const t = r();
    t.addElement(b), m.addAnimation(t);
  }
  if (l && c) {
    m.duration((null !== (e = r2.duration) && void 0 !== e ? e : 0) || 200).easing("cubic-bezier(0.47,0,0.745,0.715)");
    const i3 = r();
    i3.addElement(U(l)).onFinish((o) => {
      1 === o && i3.elements.length > 0 && i3.elements[0].style.setProperty("display", "none");
    }).fromTo("transform", "translateY(0px)", `translateY(${s})`).fromTo("opacity", 1, 0), m.addAnimation(i3);
  }
  return m;
};

export {
  i
};
/*! Bundled license information:

@ionic/core/components/p-BsBCoGa-.js:
  (*!
   * (C) Ionic http://ionicframework.com - MIT License
   *)
*/
//# sourceMappingURL=chunk-BWQDHZDG.js.map
