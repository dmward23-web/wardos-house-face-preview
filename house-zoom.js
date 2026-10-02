/* House face · zoom REMOVED (Dan 9/29) · ZOOMKILL1 · strips control, pins 100% on every page */
(function (global) {
  "use strict";
  var KEY = "house-zoom:v1";
  function strip() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    document.querySelectorAll("[data-house-zoom-ctl], .house-zoom").forEach(function (el) { el.remove(); });
    var panel = document.querySelector(".panel");
    if (panel) { panel.style.zoom = ""; panel.style.transform = ""; panel.style.transformOrigin = ""; panel.style.marginBottom = ""; }
    document.documentElement.style.removeProperty("--house-zoom");
    document.documentElement.removeAttribute("data-house-zoom");
    if (!document.getElementById("hz-kill")) {
      var s = document.createElement("style"); s.id = "hz-kill";
      s.textContent = "[data-house-zoom-ctl],.house-zoom{display:none!important}";
      (document.head || document.documentElement).appendChild(s);
    }
    return 1;
  }
  global.HouseZoom = { KEY: KEY, STEPS: [1], mount: strip, setScale: strip, load: function () { return 1; }, apply: strip };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", strip); else strip();
})(window);
