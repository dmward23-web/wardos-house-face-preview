/* House Face · HDRHOME1 · the page header IS the Home button (Dan 10/1).
 * Tap / click anywhere in the top title bar → sheet-index.html (main board).
 * Real controls inside the header (sound toggle, Us, weather/thermostat ovals,
 * Cams, cam start/stop) keep doing their own job. Live bits (clock, pills)
 * are plain text, so tapping them goes home too.
 * Also strips any leftover header link to sheet-index.html (old Home button).
 * Works with touch: header gets touch-action:manipulation (no 300ms delay,
 * page pan still allowed) and we listen to plain click, which taps fire.
 * HDRGLANCE1 (SPACE-01, 10/2): the empty header middle (.hdr-spacer) carries a one-line glance:
 * the next leave countdown (Atlas's data/next-up.json, today only) or today's handoff (the
 * house-mode timeline's kids-away span later today). Plain text: a tap still goes Home. */
(function () {
  "use strict";
  var HOME = "sheet-index.html";
  var HOME_RE = /(^|\/)sheet-index\.html(?:[?#]|$)/;
  var CONTROL = "a[href],button,input,select,textarea,label,summary,[role=button],[data-mute-toggle],[contenteditable=true]";

  function injectStyle() {
    if (document.getElementById("hdr-home-css")) return;
    var s = document.createElement("style");
    s.id = "hdr-home-css";
    s.textContent =
      "header.hdr-home-tap{cursor:pointer!important;touch-action:manipulation!important;" +
      "-webkit-tap-highlight-color:rgba(255,255,255,0.08);pointer-events:auto!important;" +
      "-webkit-user-select:none;user-select:none}" +
      "header.hdr-home-tap *{cursor:pointer}" +
      "header.hdr-home-tap a[href],header.hdr-home-tap button{cursor:pointer}" +
      "header.hdr-home-tap:active{filter:brightness(1.12)}" +
      "header.hdr-home-tap:focus-visible{outline:3px solid rgba(255,220,140,0.8);outline-offset:2px}";
    (document.head || document.documentElement).appendChild(s);
  }

  function goHome() {
    try { if (window.HouseSfx && window.HouseSfx.tap) window.HouseSfx.tap(); } catch (e) {}
    try { window.location.assign(HOME); } catch (e2) { window.location.href = HOME; }
  }

  function pickHeader() {
    return document.querySelector("header.hdr") || document.querySelector("body > .shell > header, body header");
  }

  function wire() {
    var h = pickHeader();
    if (!h || h.getAttribute("data-hdr-home") === "1") return;
    h.setAttribute("data-hdr-home", "1");
    h.classList.add("hdr-home-tap");
    h.setAttribute("tabindex", "0");
    h.setAttribute("title", "Back to the House board");
    /* old Home buttons → gone (header replaces them) */
    h.querySelectorAll("a[href]").forEach(function (a) {
      if (HOME_RE.test(a.getAttribute("href") || "")) {
        var row = a.parentElement;
        a.remove();
        if (row && row.classList.contains("nav-row") && !row.children.length) row.remove();
      }
    });
    function inHeader(ev) {
      if (h.contains(ev.target)) return true;
      /* decorative overlays (pointer-events:auto floats) drawn over the bar */
      var r = h.getBoundingClientRect();
      return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    }
    document.addEventListener("click", function (ev) {
      if (ev.defaultPrevented || ev.button > 0) return;
      if (!inHeader(ev)) return;
      var t = ev.target && ev.target.closest ? ev.target.closest(CONTROL) : null;
      if (t && t !== h) return; /* a real control inside/over the header */
      ev.preventDefault();
      goHome();
    });
    h.addEventListener("keydown", function (ev) {
      if (ev.target !== h) return;
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); goHome(); }
    });
  }

  /* ---- HDRGLANCE1 ---- */
  var TZ = "America/Chicago";
  function ctDay(ms) { try { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms)); } catch (e) { return ""; } }
  function ctTime(iso) { try { return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso)); } catch (e) { return ""; } }
  function clean(t) {
    t = String(t == null ? "" : t);
    try { if (window.HouseNoAgent && window.HouseNoAgent.clean) t = window.HouseNoAgent.clean(t); } catch (e) {}
    return /null|undefined|NEED (KEY|TOKEN)|\bmom\b|\bjar\b|\$|streak/i.test(t) ? "" : t.replace(/\s*\u2014\s*/g, " · ");
  }
  function getJson(name) {
    return fetch("data/" + name + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  var glanceFeeds = { nextUp: null, houseMode: null };
  function glanceText(now) {
    var a = "", b = "";
    var nu = glanceFeeds.nextUp, nx = nu && nu.next, lt = nx && Date.parse(nx.leaveIso || "");
    if (isFinite(lt) && lt > now && ctDay(lt) === ctDay(now)) {
      var m = Math.round((lt - now) / 60000), hh = Math.floor(m / 60), mm = m % 60;
      a = "Leave in " + (hh ? hh + "h " : "") + mm + "m";
      b = clean(nx.label);
    }
    var hm = glanceFeeds.houseMode, tl = hm && Array.isArray(hm.timeline) ? hm.timeline : [];
    var hv = tl.filter(function (x) { var t0 = Date.parse(x && x.since || ""); return x && x.mode === "kids-away" && isFinite(t0) && t0 > now && ctDay(t0) === ctDay(now); })[0];
    var ho = hv ? "Handoff " + ctTime(hv.since) : "";
    if (!a && ho) return ho + " · today";
    if (!a) return "";
    return a + (b ? " · " + b : "") + (ho ? " · " + ho : "");
  }
  function paintGlance() {
    var sp = document.querySelector("header .hdr-spacer");
    if (!sp) return;
    var t = glanceText(Date.now());
    sp.setAttribute("data-glance", "header-glance");
    /* longest line that fits the room: full line, then the countdown alone; else nothing (never a clipped word) */
    var tries = t ? [t, t.split(" · ")[0]] : [];
    sp.classList.add("hdr-glance"); t = "";
    for (var i = 0; i < tries.length; i++) {
      sp.textContent = tries[i];
      if (sp.clientWidth >= 120 && sp.scrollWidth <= sp.clientWidth + 1) { t = tries[i]; break; }
    }
    sp.classList.toggle("hdr-glance", !!t);
    sp.textContent = t;
    /* the line grows to fill its room (no dead header band either side), capped by the header's own height */
    sp.style.fontSize = "";
    if (t && sp.clientWidth > 0) {
      var base = parseFloat(getComputedStyle(sp).fontSize) || 24, hd = sp.closest("header") || sp.parentElement;
      var ck = hd && hd.querySelector("[data-live-clock], .live-clock, .board-clock"), ckf = ck ? parseFloat(getComputedStyle(ck).fontSize) || 0 : 0;
      var cap = Math.max(base, Math.min(ckf ? ckf * 0.85 : base * 1.6, base * 3)), f = cap;
      var rg = document.createRange(); rg.selectNodeContents(sp);
      for (; f > base; f -= 2) { sp.style.fontSize = f + "px"; if (rg.getBoundingClientRect().width <= sp.getBoundingClientRect().width * 0.97) break; }
      if (f <= base) sp.style.fontSize = "";
    }
    if (t) sp.removeAttribute("aria-hidden"); else sp.setAttribute("aria-hidden", "true");
  }
  function loadGlance() {
    if (!document.querySelector("header .hdr-spacer") || !window.fetch) return;
    Promise.all([getJson("next-up.json"), getJson("house-mode.json")]).then(function (r) {
      glanceFeeds.nextUp = r[0]; glanceFeeds.houseMode = r[1]; paintGlance();
    });
  }
  function injectGlanceStyle() {
    if (document.getElementById("hdr-glance-css")) return;
    var s = document.createElement("style");
    s.id = "hdr-glance-css";
    s.textContent =
      "header .hdr-spacer.hdr-glance{flex:1 1 auto;min-width:0;align-self:center;text-align:center;" +
      "font-weight:800;font-size:clamp(18px,1.9vw,44px);line-height:1.15;color:rgba(255,236,190,0.92);" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 18px;letter-spacing:0.01em}";
    (document.head || document.documentElement).appendChild(s);
  }

  injectStyle();
  injectGlanceStyle();
  function boot() { wire(); loadGlance(); setInterval(paintGlance, 30000); setInterval(loadGlance, 600000); window.addEventListener("resize", function () { setTimeout(paintGlance, 250); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
