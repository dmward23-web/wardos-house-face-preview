/* HUBQUIET1 · Main board (sheet-index.html) only (Atlas 10/2). main's house-lights.js paints the hub lights
   pill "NEED KEY" (and the sub line "NEED KEY · controls dark") when this screen has no hub key. On the
   branch's wall path that state renders DIMMED WITH NO TEXT: the pill keeps its place, empties, and dims; the
   sub line goes back to the room names. house-lights.js itself is not changed, so every other page keeps its
   own behavior. Pure display: watches the two hub elements only; no data, no writes, no network. */
(function (g) {
  "use strict";
  var NEED = /NEED\s*(KEY|TOKEN)/i, ROOMS = "Dining \u00b7 Harris \u00b7 Kitchen";
  function quiet(doc) {
    doc = doc || document;
    var pill = doc.getElementById("hub-lights-pill"), sub = doc.getElementById("hub-lights-sub");
    if (pill) {
      var need = NEED.test(pill.textContent || "");
      if (need) { pill.textContent = ""; pill.setAttribute("aria-label", "Lights controls off on this screen"); }
      if (need || (pill.classList.contains("is-quiet") && !pill.textContent.trim())) pill.classList.add("is-quiet");
      else pill.classList.remove("is-quiet");
    }
    if (sub && NEED.test(sub.textContent || "")) sub.textContent = ROOMS;
    var srcs = doc.querySelectorAll("#hub-lights-panel .light-pad-src, #hub-lights-panel .light-pad-state, #hub-lights-panel .cmd-pill");
    Array.prototype.forEach.call(srcs, function (e) { if (NEED.test(e.textContent || "")) { e.textContent = ""; e.classList.add("is-quiet"); } });
  }
  function start() {
    quiet();
    var panel = document.getElementById("hub-lights-panel");
    if (panel && g.MutationObserver) new MutationObserver(function () { quiet(); }).observe(panel, { childList: true, subtree: true, characterData: true });
  }
  g.HouseHubLightsQuiet = { quiet: quiet };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(window);
