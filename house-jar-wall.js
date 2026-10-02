/* NICEONE1 + JARTILE1 · house-jar-wall.js · window.HouseJarWall (Node: require) · Wright, Oct 1 2026.
   CHORE LAW (Dan 8:01 PM CT): the jar is Ledger's tile; it pays time and picks, never cash; balances are never listed.
   1. Jar tile (wall.html + hub): renders ONLY HouseJar book.wallDisplay() = {ruleText, ruleLine2, jars:[{jar,name}], synced, syncLabel}:
      the law sentence, ruleLine2 directly under it (both verbatim), the jar names, and the sync label. No numbers, no fill, no money. Hidden if the seed or module is missing.
   2. Nice one (wall + hub seat cards ONLY, never kid-*.html): press-and-hold 1.5 s (a short tap does nothing) -> on-screen
      4-digit PIN pad (buttons only, no input element, no keyboard) -> PIN verified ON THE HUB (/api/nice-one/verify, same hub
      key as Sensi/Kasa) -> chips from Ledger's seed (+10 min / +15 min / +1 pick) + reasons -> the hub spends the one grant
      for a uuid tapId (/api/nice-one/consume) -> only then book.niceOne({..., pinOk:true}) with the parentGate hook armed for
      that single call. JAR-VIEW-01 (Alfred): no totals view on the wall at all; parentView is never called from here. Hidden while no PIN is set.
   Functional markup only, existing classes (Dan is picking the 2100 look): no CSS in here. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HouseJarWall = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";
  var HOLD_MS = 1500, PIN_LEN = 4, TAPS_KEY = "wardos.niceone.taps.v1", TOKEN_LS = "wardos-lights-proxy-token";
  var SEAT_KIDS = ["harris", "hayes", "ainsley"];

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /** never on a kid page: kid-*.html, or any page whose <body> carries data-kid */
  function allowedPage(pathname, bodyKid) { return !/(^|\/)kid-[a-z-]+\.html$/i.test(String(pathname || "")) && !bodyKid; }

  /* ---------- jar tile ---------- */
  function jarTileModel(d) {
    if (!d || typeof d.ruleText !== "string" || !d.ruleText.trim() || !Array.isArray(d.jars) || !d.jars.length) return null;
    var jars = d.jars.map(function (j) { return { id: String((j && j.jar) || "").trim(), name: String((j && j.name) || "").trim() }; }).filter(function (j) { return j.name; });
    if (!jars.length) return null;
    return { rule: d.ruleText.trim(), rule2: typeof d.ruleLine2 === "string" ? d.ruleLine2.trim() : "", names: jars.map(function (j) { return j.name; }), ids: jars.map(function (j) { return j.id; }),
      sync: d.synced === true ? "" : String(d.syncLabel || "Not synced") };
  }
  /* ION1: Prism's Ion jar markup (.jars / .jarg outline glyph / .jar-sync / .jar-rule). Outline glyphs only: no fill, no numbers. */
  function jarTileHtml(m) {
    return '<div class="ah"><span class="kick">Jar</span></div>' +
      '<div class="jar-mid"><div class="jars" data-jar-names aria-label="Jars">' + m.names.map(function (n, i) {
        var id = (m.ids && m.ids[i]) || "";
        return '<span class="jarg"' + (id ? ' data-jar="' + esc(id) + '"' : "") + '><i class="jar-glyph" aria-hidden="true"></i><em>' + esc(n) + "</em></span>"; }).join("") + "</div>" +
      (m.sync ? '<span class="jar-sync" data-jar-sync>' + esc(m.sync) + "</span>" : "") + "</div>" +
      '<p class="jar-rule" data-jar-rule>' + esc(m.rule) + "</p>" +
      (m.rule2 ? '<p class="jar-rule jar-rule2" data-jar-rule2>' + esc(m.rule2) + "</p>" : "");
  }
  function paintJarTile(el, display) {
    if (!el) return false;
    var m = jarTileModel(display);
    if (!m) { el.hidden = true; el.innerHTML = ""; return false; }
    el.innerHTML = jarTileHtml(m); el.hidden = false; return true;
  }

  /* ---------- press-and-hold (1.5 s); a short tap does nothing ---------- */
  function createHold(o) {
    var ms = o.ms || HOLD_MS, T = o.timers || global, now = o.now || function () { return Date.now(); };
    var t0 = null, timer = null, iv = null, opened = false;
    function stop() { if (timer != null) T.clearTimeout(timer); if (iv != null) T.clearInterval(iv); timer = iv = null; t0 = null; }
    return {
      down: function () {
        stop(); opened = false; t0 = now();
        iv = T.setInterval(function () { if (t0 != null && o.onProgress) o.onProgress(Math.min(1, (now() - t0) / ms)); }, 50);
        timer = T.setTimeout(function () { stop(); opened = true; if (o.onProgress) o.onProgress(1); if (o.onOpen) o.onOpen(); }, ms);
      },
      up: function () { var was = opened; stop(); if (o.onProgress) o.onProgress(0); return was; },
      cancel: function () { stop(); if (o.onProgress) o.onProgress(0); },
      isOpen: function () { return opened; }
    };
  }

  /* ---------- on-screen PIN pad state (no input element) ---------- */
  function createPad(len) {
    len = len || PIN_LEN; var v = "";
    return {
      digit: function (d) { d = String(d); if (/^\d$/.test(d) && v.length < len) v += d; return v.length === len; },
      back: function () { v = v.slice(0, -1); },
      clear: function () { v = ""; },
      value: function () { return v; },
      full: function () { return v.length === len; },
      dots: function () { var s = ""; for (var i = 0; i < len; i++) s += i < v.length ? "\u25CF" : "\u25CB"; return s; }
    };
  }

  function uuid() {
    try { if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID(); } catch (e) { /* */ }
    var b = []; for (var i = 0; i < 16; i++) b.push(Math.floor(Math.random() * 256));
    try { if (global.crypto && global.crypto.getRandomValues) { var a = new Uint8Array(16); global.crypto.getRandomValues(a); b = Array.prototype.slice.call(a); } } catch (e2) { /* */ }
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = b.map(function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  /* ---------- hub gate client ----------
     verify(pin) -> hub checks the PIN (never here). act(action, tapId, fn) -> hub spends the grant for tapId, then fn(true) runs
     ONCE with parentGate armed. A tapId this device already recorded never runs fn again (resync / double tap safe). */
  function createGate(o) {
    var f = o.fetch, base = o.base || function () { return ""; }, token = o.token || function () { return ""; };
    var now = o.now || function () { return Date.now(); }, store = o.storage || null;
    var grant = null, armed = false;
    function call(path, method, body) {
      var b = base(), k = token();
      if (!f || !b || !k) return Promise.resolve({ status: 0, body: { ok: false, error: "no-hub" } });
      var h = { "X-Lights-Proxy-Token": k }; if (body) h["Content-Type"] = "application/json";
      return Promise.resolve(f(String(b).replace(/\/$/, "") + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: "no-store" }))
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j || {} }; }, function () { return { status: r.status, body: {} }; }); })
        .catch(function () { return { status: 0, body: { ok: false, error: "hub-unreachable" } }; });
    }
    function taps() { try { return JSON.parse((store && store.getItem(TAPS_KEY)) || "{}") || {}; } catch (e) { return {}; } }
    function saveTap(id, entryId) { var t = taps(); t[id] = entryId || true; var k = Object.keys(t); while (k.length > 200) delete t[k.shift()]; try { store && store.setItem(TAPS_KEY, JSON.stringify(t)); } catch (e) { /* */ } }
    function runArmed(fn) { armed = true; try { return fn(true); } finally { armed = false; } }
    return {
      parentGate: function () { return armed === true; }, /* HouseJar create({parentGate}) hook: true only inside one gated call */
      status: function () { return call("/api/nice-one/status", "GET").then(function (r) { return { pinSet: r.status === 200 && r.body.pinSet === true }; }); },
      verify: function (pin) {
        return call("/api/nice-one/verify", "POST", { pin: String(pin) }).then(function (r) {
          if (r.status === 200 && r.body.ok && r.body.grantToken) { grant = { token: r.body.grantToken, exp: now() + (Number(r.body.expiresIn) || 60) * 1000 }; return { ok: true }; }
          grant = null; return { ok: false, error: r.body.error || "hub-error", triesLeft: r.body.triesLeft, retryAfterSec: r.body.retryAfterSec };
        });
      },
      hasGrant: function () { return !!grant && now() < grant.exp; },
      drop: function () { grant = null; },
      act: function (action, tapId, fn) {
        var done = taps()[tapId];
        if (done) return Promise.resolve({ ok: true, duplicate: true, entryId: done === true ? null : done });
        if (!grant || now() >= grant.exp) { grant = null; return Promise.resolve({ ok: false, error: "grant-expired" }); }
        return call("/api/nice-one/consume", "POST", { grantToken: grant.token, tapId: tapId, action: action }).then(function (r) {
          if (!(r.status === 200 && r.body.ok)) { if (/grant-(used|expired)|no-grant/.test(r.body.error || "")) grant = null; return { ok: false, error: r.body.error || "hub-error" }; }
          grant = null; /* one grant per unlock */
          var out = runArmed(fn);
          if (out && out.ok) saveTap(tapId, out.entry && out.entry.id);
          return out || { ok: false, error: "book-error" };
        });
      }
    };
  }

  /* ---------- UI (wall/hub only) ---------- */
  function nameOf(book, kid) {
    var j = (book.wallDisplay().jars || []).filter(function (x) { return x.jar === kid; })[0];
    return j ? j.name : kid;
  }
  function controlHtml(kid) {
    return '<button type="button" class="nice1" data-nice-one="' + esc(kid) + '" aria-label="Nice one, parent hold">' +
      '<span>Nice one</span><small>Parent · hold</small>' +
      '<progress data-nice-hold max="100" value="0" hidden></progress></button>';
  }
  function padHtml() {
    var d = ""; ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].forEach(function (n) { d += '<button type="button" class="chip" data-pad-digit="' + n + '">' + n + "</button>"; });
    return '<div role="dialog" aria-modal="true" aria-label="Parent" data-nice-panel>' +
      '<span class="kick" data-pad-title>Nice one</span>' +
      '<div data-pad-step="pin"><div data-pad-dots aria-live="polite"></div><div data-pad-keys>' + d +
      '<button type="button" class="chip" data-pad-back>Back</button></div></div>' +
      '<div data-pad-step="grant" hidden><div data-grant-chips></div><div data-grant-reasons></div>' +
      '<button type="button" class="tap" data-grant-give disabled><span class="tx"><span>Give</span><small>One per PIN</small></span></button>' +
      "</div>" +
      '<span class="note" data-pad-msg aria-live="polite"></span>' +
      '<button type="button" class="chip" data-pad-cancel>Cancel</button></div>';
  }

  function mount(o) {
    var doc = o.document, book = o.book, gate = o.gate, T = o.timers || global, now = o.now || function () { return Date.now(); };
    var loc = (o.location && o.location.pathname) || "";
    if (!doc || !book || !gate || !allowedPage(loc, doc.body && doc.body.getAttribute("data-kid"))) return null;
    var hosts = [];
    doc.querySelectorAll("[data-nice-one-host]").forEach(function (h) { hosts.push({ el: h, kid: h.getAttribute("data-nice-one-host") }); });
    doc.querySelectorAll("[data-kid-flip]").forEach(function (t) {
      var kid = t.getAttribute("data-kid-flip"), foot = t.querySelector(".tile-foot");
      if (foot && SEAT_KIDS.indexOf(kid) >= 0 && !foot.querySelector("[data-nice-one-host]")) { var s = doc.createElement("span"); s.setAttribute("data-nice-one-host", kid); foot.appendChild(s); hosts.push({ el: s, kid: kid }); }
    });
    hosts = hosts.filter(function (h) { return SEAT_KIDS.indexOf(h.kid) >= 0; });
    if (!hosts.length) return null;
    var padHost = doc.querySelector("[data-nice-pad-host]");
    if (!padHost) { padHost = doc.createElement("div"); padHost.setAttribute("data-nice-pad-host", ""); padHost.hidden = true; doc.body.appendChild(padHost); }
    padHost.innerHTML = padHtml(); padHost.hidden = true;
    var P = function (sel) { return padHost.querySelector(sel); };
    var pad = createPad(PIN_LEN), state = { kid: null, chip: null, reason: null, tapId: null, busy: false }, closeT = null;

    function msg(t) { P("[data-pad-msg]").textContent = t || ""; }
    function step(which) { padHost.querySelectorAll("[data-pad-step]").forEach(function (s) { s.hidden = s.getAttribute("data-pad-step") !== which; }); }
    function paintDots() { P("[data-pad-dots]").textContent = pad.dots(); }
    function close() {
      if (closeT != null) T.clearTimeout(closeT); closeT = null;
      pad.clear(); gate.drop(); state = { kid: null, chip: null, reason: null, tapId: null, busy: false };
      msg(""); padHost.hidden = true;
    }
    function open(kid) {
      close(); state.kid = kid;
      P("[data-pad-title]").textContent = "Nice one \u00b7 " + nameOf(book, kid);
      step("pin"); paintDots(); padHost.hidden = false;
    }
    function paintGrant() {
      var chips = book.chips(), reasons = (book.reasons().niceOne || []);
      P("[data-grant-chips]").innerHTML = chips.map(function (c) { return '<button type="button" class="chip' + (state.chip === c.id ? " is-on" : "") + '" data-grant-chip="' + esc(c.id) + '" aria-pressed="' + (state.chip === c.id) + '">' + esc(c.label) + "</button>"; }).join("");
      P("[data-grant-reasons]").innerHTML = reasons.map(function (r) { return '<button type="button" class="chip' + (state.reason === r.id ? " is-on" : "") + '" data-grant-reason="' + esc(r.id) + '" aria-pressed="' + (state.reason === r.id) + '">' + esc(r.label) + "</button>"; }).join("");
      P("[data-grant-give]").disabled = !(state.chip && state.reason) || state.busy;
    }
    function submitPin() {
      state.busy = true; msg("Checking\u2026");
      gate.verify(pad.value()).then(function (r) {
        pad.clear(); paintDots(); state.busy = false;
        if (r.ok) { msg(""); step("grant"); paintGrant(); return; }
        if (r.error === "locked") msg("Locked \u00b7 try again in " + Math.ceil((r.retryAfterSec || 600) / 60) + " min");
        else if (r.error === "wrong-pin") msg("Wrong PIN \u00b7 " + r.triesLeft + " left");
        else msg("Hub didn't answer");
      });
    }
    padHost.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("button") : null; if (!t || state.busy) return;
      if (t.hasAttribute("data-pad-cancel")) return close();
      if (t.hasAttribute("data-pad-digit")) { if (pad.digit(t.getAttribute("data-pad-digit"))) { paintDots(); submitPin(); } else paintDots(); return; }
      if (t.hasAttribute("data-pad-back")) { pad.back(); paintDots(); return; }
      if (t.hasAttribute("data-grant-chip")) { state.chip = t.getAttribute("data-grant-chip"); return paintGrant(); }
      if (t.hasAttribute("data-grant-reason")) { state.reason = t.getAttribute("data-grant-reason"); return paintGrant(); }
      if (t.hasAttribute("data-grant-give")) {
        if (!(state.chip && state.reason)) return;
        state.tapId = state.tapId || uuid(); state.busy = true; paintGrant(); msg("Adding\u2026");
        var kid = state.kid, chip = state.chip, reason = state.reason;
        gate.act("nice-one", state.tapId, function (ok) { return book.niceOne({ jar: kid, chip: chip, reason: reason, pinOk: ok }); }).then(function (r) {
          state.busy = false;
          if (r && r.ok) {
            var c = book.chips().filter(function (x) { return x.id === chip; })[0];
            msg("Added " + (c ? c.label : "") + " \u00b7 " + nameOf(book, kid) + (book.wallDisplay().synced ? "" : " \u00b7 this screen"));
            if (o.onChange) o.onChange();
            closeT = T.setTimeout(close, 2000);
          } else { msg(r && /grant/.test(r.error || "") ? "PIN again" : "Didn't add"); if (r && /grant/.test(r.error || "")) { step("pin"); paintDots(); } paintGrant(); }
        });
      }
    });

    hosts.forEach(function (h) {
      h.el.innerHTML = controlHtml(h.kid);
      var btn = h.el.querySelector("[data-nice-one]"), bar = btn.querySelector("[data-nice-hold]");
      var hold = createHold({ ms: HOLD_MS, timers: T, now: now,
        onProgress: function (p) { bar.value = Math.round(p * 100); bar.hidden = p <= 0; },
        onOpen: function () { open(h.kid); } });
      var stop = function (e) { if (e && e.stopPropagation) e.stopPropagation(); };
      btn.addEventListener("pointerdown", function (e) { stop(e); hold.down(); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { btn.addEventListener(ev, function (e) { stop(e); hold.up(); }); });
      btn.addEventListener("click", function (e) { stop(e); if (e.preventDefault) e.preventDefault(); }); /* a click alone opens nothing */
      btn.addEventListener("contextmenu", function (e) { if (e.preventDefault) e.preventDefault(); });
    });
    return { open: open, close: close, hosts: hosts.length, panel: padHost };
  }

  /** browser boot: jar tile from Ledger's book; Nice one only when the hub says a PIN is set. */
  function boot(o) {
    o = o || {};
    var w = o.window || global, doc = w.document, HJ = w.HouseJar;
    var tiles = doc ? doc.querySelectorAll("[data-house-jar]") : [];
    if (!doc || !HJ || typeof HJ.load !== "function") { Array.prototype.forEach.call(tiles, function (t) { t.hidden = true; }); return Promise.resolve(null); }
    if (!allowedPage(w.location && w.location.pathname, doc.body && doc.body.getAttribute("data-kid"))) return Promise.resolve(null);
    var token = function () { try { return w.localStorage.getItem(TOKEN_LS) || ""; } catch (e) { return ""; } };
    var base = function () { try { return (w.HouseLights && w.HouseLights.proxyBase && w.HouseLights.proxyBase()) || ""; } catch (e) { return ""; } };
    var storage = null; try { storage = w.localStorage; } catch (e) { /* */ }
    var gate = createGate({ fetch: function (u, x) { return w.fetch(u, x); }, base: o.base || base, token: o.token || token, storage: storage });
    return HJ.load({ parentGate: gate.parentGate }).then(function (book) {
      var paint = function () { Array.prototype.forEach.call(tiles, function (t) { paintJarTile(t, book.wallDisplay()); }); };
      paint();
      if (!jarTileModel(book.wallDisplay())) return { book: book, ui: null }; /* no seed: no tile, no Nice one */
      return gate.status().then(function (s) {
        if (!s.pinSet) return { book: book, ui: null };
        return { book: book, ui: mount({ document: doc, location: w.location, book: book, gate: gate, onChange: paint }) };
      });
    });
  }

  return { HOLD_MS: HOLD_MS, PIN_LEN: PIN_LEN, TAPS_KEY: TAPS_KEY, allowedPage: allowedPage, jarTileModel: jarTileModel, jarTileHtml: jarTileHtml,
    paintJarTile: paintJarTile, createHold: createHold, createPad: createPad, createGate: createGate, mount: mount, boot: boot, uuid: uuid };
});
