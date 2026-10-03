/* house-us-erupt.js · JARHERO1 / Alfred 6:19 PM. The Us together board erupts ONLY on Atlas's existing Us together rule:
   the same signal that lights Weekend fun (3 kids, Mon-Thu closes, 10 of 12), computed in scripts/house/kid-layer-lib.mjs
   usTogetherFor() and published as data/kid-seats.json usTogether.lit. It never reads a jar, a jar state, Ainsley's
   trusted-with, or Ledger's book. Rule not met -> nothing at all (no callout, no partial version). */
(function (g) {
  "use strict";
  function shouldErupt(kidSeats) {
    var u = kidSeats && kidSeats.usTogether;
    return !!(u && u.lit === true);
  }
  /* OCT8 #8 · mount sizing under CSS zoom (house-zoom.js zooms the board ~1.4-2.5x on landscape screens). Prism's canvas
     takes its px size from getBoundingClientRect() (zoomed, on-screen px) but writes it as a CSS width/height inside the
     zoomed tile, so the zoom is applied twice: the canvas comes out zoom x too big and its middle lands off the tile's
     middle. His drawing math is in on-screen px, so the fix on our side is only the box: divide the CSS size by the
     tile's own zoom. The left/top % offsets already follow the tile. Root cause write-up: jar-mercury/ERUPT-CANVAS-BUG.md */
  function zoomOf(el) {
    var w = el && el.offsetWidth, r = el && el.getBoundingClientRect ? el.getBoundingClientRect().width : 0;
    return w > 0 && r > 0 ? r / w : 1;
  }
  function fitToZoom(tile, cv) {
    if (!tile || !cv || !cv.style) return cv;
    var z = zoomOf(tile);
    if (!(z > 0) || Math.abs(z - 1) < 0.01) return cv;
    var w = parseFloat(cv.style.width), h = parseFloat(cv.style.height);
    if (w > 0) cv.style.width = (w / z) + "px";
    if (h > 0) cv.style.height = (h / z) + "px";
    return cv;
  }
  var api = { shouldErupt: shouldErupt, fitToZoom: fitToZoom, zoomOf: zoomOf };
  if (typeof module === "object" && module.exports) module.exports = api;
  g.HouseUsErupt = api;
  var doc = g.document;
  if (!doc || !g.fetch) return;
  function run() {
    var tile = doc.getElementById("us-board");
    if (!tile) return;
    g.fetch("data/kid-seats.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (d) {
        if (!shouldErupt(d)) return;
        /* the eruption stays on its own board: Prism's canvas reaches 30% beside / 90% above / 70% below the tile, so
           while it runs the tile clips it to its own rounded box; it never paints over the header or other tiles */
        if (!doc.getElementById("us-erupt-clip")) {
          var st = doc.createElement("style"); st.id = "us-erupt-clip";
          st.textContent = "#us-board:has(> canvas.jm-erupt){overflow:clip!important}";
          (doc.head || doc.documentElement).appendChild(st);
        }
        if (g.JarMercury && typeof g.JarMercury.eruptUsTogether === "function") fitToZoom(tile, g.JarMercury.eruptUsTogether(tile, shouldErupt(d))); /* Prism 19:09 API: one family boolean, true only on the rule */
      });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", run); else run();
})(typeof window !== "undefined" ? window : globalThis);
