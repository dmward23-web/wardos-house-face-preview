/* PREVIEW1 · preview-guard.js: injected as the FIRST script of every page in a
 * public preview build (scripts/preview/publish-preview.mjs). Never part of the
 * wall build. Read only: the preview shows the house, it never changes it.
 *  - hub / camera keys are ignored (storage reads return nothing, URL keys dropped)
 *  - every write is refused before it leaves the page: non-GET fetch, XHR, beacons,
 *    any /api/ call (tap sync, jar shared writes, Sensi, Kasa lights, nice-one), WebRTC
 *  - data/*.json reads come from the copy shipped with this preview build (a data-only push updates it),
 *    falling back to the live published data only for a file the preview does not carry
 *  - a quiet footer chip names the source commit; a portrait phone gets a
 *    "turn sideways" hint */
(function (w, d) {
  "use strict";
  var CFG = w.__WARDOS_PREVIEW_CFG__ || {};
  var LIVE = String(CFG.liveData || "").replace(/\/?$/, "/");
  w.WARDOS_PREVIEW = true;
  var KEY_RE = /token|proxy|hub-?key|nest.*proxy/i;
  try {
    var gi = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return KEY_RE.test(String(k)) ? null : gi.call(this, k); };
    var si = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (KEY_RE.test(String(k))) return; return si.call(this, k, v); };
  } catch (e) {}
  try {
    var u = new URL(w.location.href), drop = false;
    u.searchParams.forEach(function (_v, k) { if (KEY_RE.test(k)) drop = true; });
    if (drop) { Array.from(u.searchParams.keys()).forEach(function (k) { if (KEY_RE.test(k)) u.searchParams.delete(k); }); w.history.replaceState(null, "", u.toString()); }
  } catch (e) {}
  var blocked = [];
  w.__previewBlocked = blocked;
  function refuse(what) {
    blocked.push(what);
    return Promise.resolve(new Response(JSON.stringify({ ok: false, preview: true, error: "preview is read only" }), { status: 403, headers: { "Content-Type": "application/json" } }));
  }
  var of = w.fetch ? w.fetch.bind(w) : null;
  function dataName(url) {
    var m = String(url).match(/(?:^|\/)data\/([A-Za-z0-9._-]+\.json)(?:\?|$)/);
    return m ? m[1] : "";
  }
  w.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || String(input);
    var method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") return refuse(method + " " + url);
    if (/\/api\//.test(url)) return refuse("GET " + url);
    var name = dataName(url);
    if (name && of) {
      /* OCT8-7: the preview reads ITS OWN bundled data/ first (no cache), so a data-only push to the preview repo
         updates the page; the live published data is only the fallback for a file the preview does not carry */
      var opts = Object.assign({}, init || {}, { cache: "no-store" });
      return of(url, opts).then(function (r) { if (r.ok) return r; throw new Error("bundled " + r.status); })
        .catch(function () { return LIVE ? of(LIVE + name + "?t=" + Date.now(), opts) : of(input, init); });
    }
    return of ? of(input, init) : refuse(url);
  };
  try {
    var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, url) { this.__pv = String(m).toUpperCase() !== "GET" || /\/api\//.test(url); this.__pvu = url; return xo.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () { if (this.__pv) { blocked.push("XHR " + this.__pvu); return; } return xs.apply(this, arguments); };
  } catch (e) {}
  try { if (navigator.sendBeacon) navigator.sendBeacon = function (url) { blocked.push("beacon " + url); return false; }; } catch (e) {}
  try { w.RTCPeerConnection = undefined; w.webkitRTCPeerConnection = undefined; } catch (e) {}
  try { w.WebSocket = function () { blocked.push("websocket"); throw new Error("preview is read only"); }; } catch (e) {}

  function chrome() {
    if (!d.body || d.getElementById("pv-chip")) return;
    var css = d.createElement("style");
    css.textContent =
      "#pv-chip{position:fixed;right:8px;bottom:6px;z-index:2147483000;font:11px/1.3 system-ui,sans-serif;color:rgba(200,215,230,.55);background:rgba(10,16,24,.55);border-radius:6px;padding:2px 7px;pointer-events:none}" +
      "#pv-turn{display:none;position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483001;font:13px/1.3 system-ui,sans-serif;color:#dfe8f2;background:rgba(14,24,36,.92);border:1px solid rgba(140,170,200,.35);border-radius:10px;padding:8px 12px}" +
      "@media (orientation:portrait) and (max-width:820px){#pv-turn{display:block}}";
    d.head.appendChild(css);
    var c = d.createElement("div"); c.id = "pv-chip";
    c.textContent = "Preview · read only" + (CFG.sha ? " · " + CFG.sha : "");
    d.body.appendChild(c);
    /* KIDPAGES1: kid pages have a real phone portrait layout: no "turn sideways" note there */
    if (/(^|\/)kid-[a-z]+\.html/.test(location.pathname) || (d.body && d.body.hasAttribute("data-kid") && /kid-/.test(location.pathname))) return;
    var t = d.createElement("div"); t.id = "pv-turn"; t.setAttribute("role", "note");
    t.textContent = "Turn your phone sideways to see the wall";
    t.addEventListener("click", function () { t.remove(); });
    d.body.appendChild(t);
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", chrome); else chrome();
})(window, document);
