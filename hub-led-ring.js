/* LEDRING1 · thin amber LED that laps the whole board once a minute.
   LEDPHONE1 · on phones it hugs the real screen edge (rounded display corners, down past the
   home bar), measured from the fixed box itself — never the bottom of the scrolled layout.
   Synced to the wall clock: the head sits at top-center at :00 and moves clockwise. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var INSET = 3, R = 18, LAP_MS = 60000;
  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "led-ring");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("preserveAspectRatio", "none");
  var PHONE = false;
  try { PHONE = Math.min(screen.width, screen.height) <= 600; } catch (e) {}
  if (PHONE) { INSET = 2; R = 50; svg.classList.add("led-ring--phone"); }
  // tail (soft, long) → mid → head (bright, short); heads line up
  var layers = [
    { len: 90, cls: "led-tail" },
    { len: 36, cls: "led-mid" },
    { len: 10, cls: "led-head" }
  ];
  var paths = layers.map(function (l) {
    var p = document.createElementNS(NS, "path");
    p.setAttribute("class", l.cls);
    p.setAttribute("pathLength", "1000");
    p.setAttribute("stroke-dasharray", l.len + " " + (1000 - l.len));
    svg.appendChild(p);
    return p;
  });
  function shape() {
    var rc = svg.getBoundingClientRect();
    var w = Math.round(rc.width) || window.innerWidth, h = Math.round(rc.height) || window.innerHeight;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    var x1 = INSET, y1 = INSET, x2 = w - INSET, y2 = h - INSET, r = R;
    var d = "M" + (w / 2) + " " + y1
      + " H" + (x2 - r) + " A" + r + " " + r + " 0 0 1 " + x2 + " " + (y1 + r)
      + " V" + (y2 - r) + " A" + r + " " + r + " 0 0 1 " + (x2 - r) + " " + y2
      + " H" + (x1 + r) + " A" + r + " " + r + " 0 0 1 " + x1 + " " + (y2 - r)
      + " V" + (y1 + r) + " A" + r + " " + r + " 0 0 1 " + (x1 + r) + " " + y1
      + " Z";
    paths.forEach(function (p) { p.setAttribute("d", d); });
  }
  function run() {
    var into = Date.now() % LAP_MS;
    paths.forEach(function (p, i) {
      var L = layers[i].len;
      if (p.__anim) p.__anim.cancel();
      // head = start + L; start = -offset  →  offset runs L → L-1000 over one lap
      p.__anim = p.animate(
        [{ strokeDashoffset: L }, { strokeDashoffset: L - 1000 }],
        { duration: LAP_MS, iterations: Infinity, easing: "linear", delay: -into }
      );
    });
  }
  function start() {
    document.body.appendChild(svg);
    shape(); run();
    var t;
    function again() { clearTimeout(t); t = setTimeout(function () { shape(); run(); }, 150); }
    window.addEventListener("resize", again);
    window.addEventListener("orientationchange", again);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", again);
    // re-sync after the tablet wakes / tab comes back
    document.addEventListener("visibilitychange", function () { if (!document.hidden) run(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
