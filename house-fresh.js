/* House Face · FRESH1 · the phone keeps a copy of the page for up to 10 min
 * (GitHub Pages max-age=600) and iOS home-screen apps hold it even longer.
 * On open, on return to the app, and every 3 min: fetch this page fresh and
 * compare its ?v= build stamps with the ones running now. If a newer build is
 * live, reload onto it. Loop-guarded (max once per 45s). */
(function () {
  "use strict";
  if (typeof fetch !== "function") return;
  var GUARD = "house-fresh:last";
  function stamps(html) {
    var out = [], re = /\.(?:js|css)\?v=([A-Za-z0-9_.-]+)/g, m;
    while ((m = re.exec(html))) out.push(m[1]);
    return out.sort().join(",");
  }
  function mine() {
    var bits = [];
    document.querySelectorAll("script[src],link[rel=stylesheet][href]").forEach(function (el) {
      bits.push(el.getAttribute("src") || el.getAttribute("href") || "");
    });
    return stamps(bits.join(" "));
  }
  var running = null;
  function check() {
    if (running === null) running = mine();
    if (!running) return;
    var url = location.pathname + "?freshcheck=" + Date.now();
    fetch(url, { cache: "no-store" }).then(function (r) {
      return r.ok ? r.text() : "";
    }).then(function (html) {
      if (!html) return;
      var live = stamps(html);
      if (!live || live === running) return;
      var last = 0;
      try { last = Number(sessionStorage.getItem(GUARD)) || 0; } catch (_) {}
      if (Date.now() - last < 45000) return;
      try { sessionStorage.setItem(GUARD, String(Date.now())); } catch (_) {}
      var q = location.search.replace(/[?&]fresh=\d+/, "").replace(/^\?/, "");
      location.replace(location.pathname + "?" + (q ? q + "&" : "") + "fresh=" + Date.now() + location.hash);
    }).catch(function () {});
  }
  if (document.readyState === "complete") setTimeout(check, 1500);
  else window.addEventListener("load", function () { setTimeout(check, 1500); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); });
  window.addEventListener("pageshow", function (e) { if (e.persisted) check(); });
  setInterval(check, 3 * 60 * 1000);
})();
