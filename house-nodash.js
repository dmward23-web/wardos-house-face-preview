/* NODASH1 (Dan 10/2: no em dash on the face). Display only, no data written: on every House Face board a
   calendar title's " — " reads " · " (the hub glance's rule, house-hdr-home.js), and a lone "—" placeholder
   (no value yet: "—", "—:—", "—°", "—% RH", "→ —") draws nothing, so the cell is blank and narrow.
   Watches the board for text it fills in later. Guard: scripts/wall/no-emdash.py. */
(function (g) {
  "use strict";
  var D = "\u2014", ONLY = /^[\s\u2014\u2192:%°·\-]*(?:RH)?[\s\u2014\u2192:%°·\-]*$/;
  function fix(n) {
    var t = n.nodeValue; if (!t || t.indexOf(D) < 0) return;
    var p = n.parentElement; if (!p || p.closest("script,style,template,defs,symbol,textarea,input")) return;
    var v = ONLY.test(t) ? "" : t.replace(/\s*\u2014\s*/g, " \u00b7 ").replace(/^\s*\u00b7\s*/, "").replace(/\s*\u00b7\s*$/, "");
    if (v !== t) n.nodeValue = v;
  }
  function sweep(root) {
    if (!root) return;
    if (root.nodeType === 3) { fix(root); return; }
    var tw = document.createTreeWalker(root, 4, null), n; while ((n = tw.nextNode())) fix(n);
  }
  function start() {
    sweep(document.body);
    if (!g.MutationObserver) return;
    new MutationObserver(function (recs) {
      recs.forEach(function (r) { if (r.type === "characterData") fix(r.target); else Array.prototype.forEach.call(r.addedNodes, sweep); });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  g.HouseNoDash = { fix: fix, sweep: sweep, only: ONLY };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(window);
