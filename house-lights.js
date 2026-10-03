/* House Face · Lights control (Kasa LIVE only)
   Read: poll data/lights-live.json (Atlas fetcher → Pages).
   Write: POST Atlas lights-write-proxy (creds on box only).
   LIGHTS6: when localStorage empty, auto-use writeProxy + writeProxyToken
   from lights-live.json (public CF URL). No ?lightsProxy= seed required.
   HARD LAW: nothing ever DEMO. No fake taps. If proxy/token missing →
   controls disabled + honest NEED TOKEN / PROXY OFF / OFFLINE.
   See LIGHTS-LIVE.md
   Keys: wardos-lights-proxy · wardos-lights-proxy-token */
(function (global) {
  "use strict";

  var STATE_KEY = "house-lights-state"; /* legacy — unused for write */
  var LIVE_URL = "data/lights-live.json";
  /* FOREVER: age must never disable wall writes. Cron refreshes ~15m.
     Soft display window kept long only as last-resort honesty if cron dies. */
  var LIVE_FRESH_MS = 24 * 60 * 60 * 1000;
  var LIVE_POLL_MS = 60 * 1000;
  var DOCS = "LIGHTS-LIVE.md";
  var PROXY_LS_KEY = "wardos-lights-proxy";
  var PROXY_TOKEN_LS_KEY = "wardos-lights-proxy-token";
  var DEFAULT_PROXY = "http://127.0.0.1:8788";

  var STARTER = [
    { id: "dining-room", name: "Dining Room", where: "Dining Room", kind: "dimmer", on: true, brightness: 52 },
    { id: "harris-room", name: "Harris's Room", where: "Harris's Room", kind: "dimmer", on: true, brightness: 100 },
    { id: "kitchen", name: "Kitchen", where: "Kitchen", kind: "dimmer", on: true, brightness: 1 }
  ];


  var _liveCache = null;
  var _listeners = [];
  var _optimistic = {}; /* id -> {on,brightness,pending} — LIVE only, rolled back on fail */
  var _proxyReachable = null; /* null unknown · true/false after probe */
  var _proxyProbeAt = 0;
  var _writeInFlight = 0;
  var _dimDrag = null; /* {id, bright, writing} · preserve fill mid-drag */

  function parseUpdatedAt(iso) {
    if (!iso) return 0;
    var t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }

  function ageMs(data) {
    if (!data) return Infinity;
    var t = parseUpdatedAt(data.fetchedAt || data.updatedAt);
    if (!t) return Infinity;
    return Date.now() - t;
  }

  function qs(name) {
    try {
      var u = new URL(location.href);
      return u.searchParams.get(name);
    } catch (e) {
      return null;
    }
  }

  function isPagesHost() {
    try {
      return /\.github\.io$/i.test(location.hostname || "");
    } catch (e) {
      return false;
    }
  }

  function isLoopbackProxy(url) {
    return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(String(url || ""));
  }

  /** Optional override: seed proxy URL/token from ?lightsProxy= into localStorage. */
  function ingestProxyFromQuery() {
    try {
      var p = qs("lightsProxy") || qs("proxy");
      var t = qs("lightsProxyToken") || qs("proxyToken");
      if (p) localStorage.setItem(PROXY_LS_KEY, String(p).replace(/\/$/, ""));
      if (t) localStorage.setItem(PROXY_TOKEN_LS_KEY, String(t));
    } catch (e) { /* */ }
  }

  /**
   * LIGHTS6: after live JSON loads, if LS empty and JSON has a public writeProxy
   * (+ token), persist once so later polls keep working even if JSON briefly
   * drops the fields. Never persist loopback on Pages.
   */
  function ingestProxyFromLive(data) {
    if (!data) return;
    try {
      var wp = data.writeProxy ? String(data.writeProxy).replace(/\/$/, "") : "";
      var tok = data.writeProxyToken ? String(data.writeProxyToken) : "";
      if (!wp || (isPagesHost() && isLoopbackProxy(wp))) return;
      // PROXYFOLLOW1: the tunnel address can change when Atlas's computer
      // restarts; always follow the newest public address from live JSON.
      if (/^https:\/\//i.test(wp) || !localStorage.getItem(PROXY_LS_KEY)) {
        if (localStorage.getItem(PROXY_LS_KEY) !== wp) localStorage.setItem(PROXY_LS_KEY, wp);
      }
      if (tok && !localStorage.getItem(PROXY_TOKEN_LS_KEY)) {
        localStorage.setItem(PROXY_TOKEN_LS_KEY, tok);
      }
    } catch (e) { /* */ }
  }

  function proxyBase() {
    ingestProxyFromQuery();
    var fromQs = qs("lightsProxy") || qs("proxy");
    if (fromQs) return String(fromQs).replace(/\/$/, "");
    try {
      var ls = localStorage.getItem(PROXY_LS_KEY);
      if (ls) {
        var lsUrl = String(ls).replace(/\/$/, "");
        if (!(isPagesHost() && isLoopbackProxy(lsUrl))) return lsUrl;
      }
    } catch (e) { /* */ }
    var data = (_liveCache && _liveCache.data) || null;
    if (data && data.writeProxy) {
      var wp = String(data.writeProxy).replace(/\/$/, "");
      // Pages cannot reach Atlas loopback — skip localhost hints in live JSON.
      if (!(isPagesHost() && isLoopbackProxy(wp))) return wp;
    }
    if (isPagesHost()) return "";
    return DEFAULT_PROXY;
  }

  function proxyToken() {
    var t = qs("lightsProxyToken") || qs("proxyToken");
    if (t) return t;
    try {
      var ls = localStorage.getItem(PROXY_TOKEN_LS_KEY);
      if (ls) return ls;
    } catch (e) { /* */ }
    var data = (_liveCache && _liveCache.data) || null;
    if (data && data.writeProxyToken) return String(data.writeProxyToken);
    return "";
  }

  function proxyHeaders() {
    var h = { "Content-Type": "application/json", Accept: "application/json" };
    var t = proxyToken();
    if (t) {
      h["X-Lights-Proxy-Token"] = t;
      h["Authorization"] = "Bearer " + t;
    }
    return h;
  }

  /* AUDIT1 · no key saved on this screen → no lights requests at all (no probe, no write) */
  function hasKey() { return !!proxyToken(); }
  function noKey(g) { g = g || gate(); return !!(g.live && g.writeSupported && !hasKey()); }

  function canWrite() {
    if (!hasKey()) return false;
    var g = gate();
    var data = g.data;
    /* Forever: status=live + writeSupported + proxy — JSON age must NOT kill taps. */
    var statusLive = !!(data && data.status === "live");
    var ws = !!(g.writeSupported || (data && data.writeSupported));
    return !!(statusLive && ws && _proxyReachable && proxyBase());
  }

  function probeProxy(cb) {
    var base = proxyBase();
    if (!base || !hasKey()) {
      _proxyReachable = false;
      _proxyProbeAt = Date.now();
      if (cb) cb(false);
      notify();
      return;
    }
    // Skip loopback probe on Pages (that IP is the phone/Elo, not Atlas).
    if (isPagesHost() && isLoopbackProxy(base)) {
      _proxyReachable = false;
      _proxyProbeAt = Date.now();
      if (cb) cb(false);
      notify();
      return;
    }
    var url = base + "/health?t=" + Date.now();
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 4000);
    fetch(url, {
      cache: "no-store",
      signal: ctrl ? ctrl.signal : undefined,
      headers: proxyHeaders()
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, j: j };
      }).catch(function () { return { ok: r.ok, j: null }; });
    }).then(function (res) {
      clearTimeout(timer);
      var j = res.j || {};
      _proxyReachable = !!(res.ok && j.ok && (
        j.writeSupported === true ||
        j.lightsWrite === true ||
        j.service === "lights-write-proxy"
      ));
      _proxyProbeAt = Date.now();
      if (cb) cb(_proxyReachable);
      notify();
    }).catch(function () {
      clearTimeout(timer);
      _proxyReachable = false;
      _proxyProbeAt = Date.now();
      if (cb) cb(false);
      notify();
    });
  }

  function clampBright(n) {
    n = Math.round(Number(n) || 0);
    if (n < 0) n = 0;
    if (n > 100) n = 100;
    return n;
  }

  /**
   * Gate for UI labels.
   * LIVE only when status==="live" + fresh-ish roster.
   * NEED TOKEN when status need_token|stage.
   * Never invent LIVE. No DEMO overlays.
   */
  function gate(data) {
    data = data || (_liveCache && _liveCache.data) || null;
    var age = ageMs(data);
    var st = data && data.status;
    if (!data) {
      return {
        kind: "offline",
        live: false,
        needToken: true,
        label: "OFFLINE",
        writeSupported: false,
        data: null,
        ageMs: Infinity
      };
    }
    if (st === "need_token" || st === "need_creds" || st === "stage") {
      return {
        kind: "need_token",
        live: false,
        needToken: true,
        label: "NEED TOKEN",
        writeSupported: false,
        data: data,
        ageMs: age
      };
    }
    if (st === "live") {
      var ws = !!data.writeSupported;
      var label = "LIVE";
      if (ws && !hasKey()) label = "LIVE · NEED KEY";
      else if (ws && _proxyReachable === false) label = "LIVE · PROXY OFF";
      else if (ws && _proxyReachable === null) label = "LIVE";
      else if (!ws) label = "LIVE · READ ONLY";
      /* FOREVER FIX: never STALE-disable writes when JSON ages.
         Soft label only if snapshot older than LIVE_FRESH_MS (24h) AND proxy down. */
      if (age > LIVE_FRESH_MS && ws && hasKey() && _proxyReachable === false) {
        label = "STALE · PROXY OFF";
      } else if (age > LIVE_FRESH_MS && !ws) {
        label = "STALE · READ ONLY";
      }
      return {
        kind: "live",
        live: true,
        needToken: false,
        label: label,
        writeSupported: ws,
        data: data,
        ageMs: age
      };
    }
    return {
      kind: "error",
      live: false,
      needToken: false,
      label: (st === "error" ? "ERROR" : "OFFLINE"),
      writeSupported: false,
      data: data,
      ageMs: age
    };
  }

  function rosterFromLive(data) {
    var out = [];
    var list = (data && data.lights) || [];
    if (list.length) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id) out.push(list[i]);
      }
    } else {
      for (var j = 0; j < STARTER.length; j++) {
        out.push({
          id: STARTER[j].id,
          name: STARTER[j].name,
          where: STARTER[j].where,
          kind: STARTER[j].kind,
          on: null,
          brightness: null,
          online: null
        });
      }
    }
    return out;
  }

  function reservedFromLive(data) {
    var r = (data && data.reserved) || [];
    return r.length ? r : [];
  }

  /* Legacy localStorage readers kept as no-ops for API compat — NEVER used as truth. */
  function loadDemo() { return {}; }
  function saveDemo(map) { /* killed · HARD LAW no DEMO */ }

  /**
   * Effective per-light state for UI — LIVE reads only.
   * Optimistic overlay while a write is in flight; never DEMO localStorage.
   */
  function effectiveLights() {
    var g = gate();
    var data = g.data || (_liveCache && _liveCache.data) || null;
    var roster = rosterFromLive(data);
    var reserved = reservedFromLive(data);
    var items = [];
    var liveOk = !!g.live;
    for (var i = 0; i < roster.length; i++) {
      var L = roster[i];
      var id = L.id;
      var opt = _optimistic[id];
      var on = null;
      var brightness = null;
      if (opt && typeof opt.on === "boolean") on = opt.on;
      else if (typeof L.on === "boolean") on = L.on;
      if (opt && typeof opt.brightness === "number") brightness = opt.brightness;
      else if (typeof L.brightness === "number") brightness = L.brightness;
      items.push({
        id: id,
        name: L.name || id,
        where: L.where || "",
        kind: L.kind || "bulb",
        on: on,
        brightness: brightness != null ? clampBright(brightness) : null,
        online: liveOk ? (L.online !== false) : null,
        source: liveOk ? "live" : "offline",
        pending: !!(opt && opt.pending),
        disabled: !canWrite()
      });
    }
    return {
      gate: g,
      lights: items,
      reserved: reserved,
      writeSupported: !!(g.writeSupported),
      proxyReachable: _proxyReachable,
      canWrite: canWrite(),
      source: liveOk ? "live" : (g.needToken ? "need_token" : "offline")
    };
  }

  function applyOptimistic(id, patch) {
    var cur = _optimistic[id] || {};
    var next = {
      on: typeof patch.on === "boolean" ? patch.on : cur.on,
      brightness: typeof patch.brightness === "number" ? clampBright(patch.brightness) : cur.brightness,
      pending: true,
      prev: cur.prev || null
    };
    if (!cur.prev) {
      var eff = effectiveLights();
      for (var i = 0; i < eff.lights.length; i++) {
        if (eff.lights[i].id === id) {
          next.prev = { on: eff.lights[i].on, brightness: eff.lights[i].brightness };
          break;
        }
      }
    }
    _optimistic[id] = next;
  }

  function clearOptimistic(id) {
    if (id) delete _optimistic[id];
    else _optimistic = {};
  }

  function rollbackOptimistic(id) {
    var o = _optimistic[id];
    if (o && o.prev) {
      _optimistic[id] = { on: o.prev.on, brightness: o.prev.brightness, pending: false, prev: null };
      setTimeout(function () { clearOptimistic(id); notify(); }, 50);
    } else {
      clearOptimistic(id);
    }
  }

  function postWrite(body) {
    var base = proxyBase();
    if (!base) {
      return Promise.reject(new Error("PROXY OFF · no lights write proxy URL"));
    }
    var url = base + "/api/lights/set";
    _writeInFlight++;
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 15000);
    return fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: proxyHeaders(),
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      return r.json().then(function (j) {
        if (!r.ok || !j || !j.ok) {
          var err = new Error((j && j.error) || ("write HTTP " + r.status));
          err.payload = j;
          throw err;
        }
        return j;
      });
    }).finally(function () {
      _writeInFlight = Math.max(0, _writeInFlight - 1);
    });
  }

  function mergeWriteIntoCache(writePayload) {
    if (!writePayload || !writePayload.live) return;
    applyLivePayload(writePayload.live);
  }

  function setLight(id, patch) {
    if (!hasKey()) { notify(); return null; }
    var g = gate();
    if (!(g.live && g.writeSupported)) {
      notify();
      return null;
    }
    if (!canWrite()) {
      probeProxy();
      notify();
      return null;
    }
    applyOptimistic(id, patch || {});
    notify();
    var body = { id: id };
    if (patch && typeof patch.on === "boolean") body.on = patch.on;
    if (patch && typeof patch.brightness === "number") body.brightness = clampBright(patch.brightness);
    postWrite(body).then(function (j) {
      clearOptimistic(id);
      if (j.live) mergeWriteIntoCache(j);
      else fetchLive();
      notify();
    }).catch(function (err) {
      rollbackOptimistic(id);
      notify();
      try { console.warn("[HouseLights] write fail", err && err.message); } catch (e) {}
    });
    return _optimistic[id] || null;
  }

  function setAll(on) {
    if (!hasKey()) { notify(); return; }
    var g = gate();
    if (!(g.live && g.writeSupported) || !canWrite()) {
      probeProxy();
      notify();
      return;
    }
    var eff = effectiveLights();
    for (var i = 0; i < eff.lights.length; i++) {
      applyOptimistic(eff.lights[i].id, { on: !!on });
    }
    notify();
    postWrite(on ? { allOn: true } : { allOff: true }).then(function (j) {
      clearOptimistic();
      if (j.live) mergeWriteIntoCache(j);
      else fetchLive();
      notify();
    }).catch(function () {
      for (var i = 0; i < eff.lights.length; i++) rollbackOptimistic(eff.lights[i].id);
      notify();
    });
  }

  function notify() {
    for (var i = 0; i < _listeners.length; i++) {
      try { _listeners[i](effectiveLights()); } catch (e) { /* */ }
    }
  }

  function onChange(fn) {
    if (typeof fn === "function") _listeners.push(fn);
  }

  function applyLivePayload(data) {
    _liveCache = { at: Date.now(), data: data };
    ingestProxyFromLive(data);
    var g = gate(data);
    /* Clear optimistic once live snapshot catches up (no DEMO seed — HARD LAW). */
    if (g.live && data && Array.isArray(data.lights)) {
      for (var i = 0; i < data.lights.length; i++) {
        var L = data.lights[i];
        if (!L || !L.id || !_optimistic[L.id]) continue;
        var o = _optimistic[L.id];
        if (o.pending) continue;
        var matchOn = (typeof o.on !== "boolean") || o.on === L.on;
        var matchBr = (typeof o.brightness !== "number") || o.brightness === L.brightness;
        if (matchOn && matchBr) clearOptimistic(L.id);
      }
    }
    notify();
    return g;
  }

  /* LIGHTSFAST1: when the write proxy is reachable + keyed, read live state from
   * its warm Kasa session (seconds old) instead of the Pages JSON (minutes old),
   * so polls never snap a just-tapped switch back. Falls back to Pages JSON. */
  function fetchLive(cb) {
    var base = proxyBase();
    if (base && proxyToken() && _proxyReachable && !(isPagesHost() && isLoopbackProxy(base))) {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 4000);
      fetch(base + "/api/lights?t=" + Date.now(), {
        cache: "no-store",
        headers: proxyHeaders(),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error("proxy lights " + r.status);
        return r.json();
      }).then(function (j) {
        if (!j || j.status !== "live" || !Array.isArray(j.lights) || !j.lights.length) throw new Error("proxy not live");
        if (_writeInFlight > 0) { if (cb) cb(null, gate(), j); return; }
        var g = applyLivePayload(j);
        if (cb) cb(null, g, j);
      }).catch(function () {
        clearTimeout(timer);
        fetchLivePages(cb);
      });
      return;
    }
    fetchLivePages(cb);
  }

  function fetchLivePages(cb) {
    var url = LIVE_URL + (LIVE_URL.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("live json " + r.status);
      return r.json();
    }).then(function (j) {
      var g = applyLivePayload(j);
      if (cb) cb(null, g, j);
    }).catch(function (err) {
      if (!_liveCache) {
        applyLivePayload({
          status: "need_token",
          fetchedAt: null,
          source: "kasa-pending",
          writeSupported: false,
          lights: STARTER.map(function (s) {
            return {
              id: s.id, name: s.name, where: s.where, kind: s.kind,
              on: null, brightness: null, online: null
            };
          }),
          reserved: [],
          error: "data/lights-live.json unavailable"
        });
      }
      if (cb) cb(err || new Error("live fetch fail"), gate(), null);
    });
  }

  var _pollTimer = null;
  function startPolling() {
    ingestProxyFromQuery();
    fetchLive(function () { probeProxy(); });
    probeProxy();
    if (_pollTimer) return;
    _pollTimer = setInterval(function () {
      fetchLive();
      if (!_proxyProbeAt || Date.now() - _proxyProbeAt > 30000) probeProxy();
    }, LIVE_POLL_MS);
  }

  function countOn(items) {
    var n = 0;
    for (var i = 0; i < items.length; i++) if (items[i].on) n++;
    return n;
  }

  function paintChip(el) {
    if (!el) return;
    var eff = effectiveLights();
    var g = eff.gate;
    var n = eff.lights.length;
    var onN = countOn(eff.lights);
    var hdr = el.classList.contains("lights-hdr") || el.classList.contains("sensi-hdr") || el.classList.contains("nest-hdr");
    el.classList.add("lights-chip");
    el.classList.toggle("is-live", !!g.live);
    el.classList.toggle("is-need", g.kind === "need_token" || !!g.needToken);
    el.setAttribute("href", el.getAttribute("href") || "sheet-lights.html");
    var status = g.label;
    if (hdr) {
      var ico = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.7c.6.5 1 1.2 1.1 2H14.4c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/></svg>';
      var big = n ? String(n) : "—";
      var unit = n ? "pads" : "";
      var quiet = g.needToken ? "Kasa" : (onN ? (onN + " on") : "all off");
      el.innerHTML =
        '<div class="lights-hdr-ico nest-hdr-ico" aria-hidden="true">' + ico + "</div>"
        + '<div class="lights-hdr-text nest-hdr-text">'
        + '<div class="lights-hdr-kicker nest-hdr-kicker">Lights</div>'
        + '<div class="lights-hdr-line nest-hdr-line">'
        + '<span class="lights-hdr-main nest-hdr-main">' + big + "</span>"
        + '<span class="sensi-hdr-set">' + unit + "</span>"
        + '<span class="lights-hdr-mode nest-hdr-mode">' + quiet + "</span>"
        + "</div>"
        + '<div class="lights-hdr-sub nest-hdr-sub"><i class="hdr-live-dot" aria-hidden="true"></i>' + status + "</div>"
        + "</div>";
      return;
    }
    el.innerHTML =
      '<div class="lights-chip-ico" aria-hidden="true">💡</div>'
      + '<div class="lights-chip-text">'
      + '<div class="lights-chip-kicker">Lights · house</div>'
      + '<div class="lights-chip-line">'
      + '<span class="lights-chip-temp">' + n + "</span>"
      + '<span class="lights-chip-set">' + (onN ? onN + " on" : "off") + "</span>"
      + "</div>"
      + '<div class="lights-chip-sub">' + status + "</div>"
      + "</div>";
  }

  function mountChip(selector) {
    var el = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!el) return;
    paintChip(el);
    onChange(function () { paintChip(el); });
    startPolling();
  }


  var DOOR_GARAGE_STUBS = [
    { id: "garage-door", name: "Garage", where: "Door open / close" },
    { id: "door-pads", name: "Door pads", where: "Lock / unlock · codes" }
  ];

  function paintNeedConnectStubs(doc) {
    doc = doc || document;
    var grid = doc.getElementById("lights-stub-grid");
    if (!grid) return;
    var html = "";
    for (var i = 0; i < DOOR_GARAGE_STUBS.length; i++) {
      var R = DOOR_GARAGE_STUBS[i];
      html +=
        '<article class="light-pad is-pending is-need-connect is-off" data-light-id="' + R.id + '" data-need-connect="1">'
        + '<div class="light-pad-top">'
        + '<div class="light-pad-ico" aria-hidden="true">🔌</div>'
        + '<div><div class="light-pad-name">' + escapeHtml(R.name) + "</div>"
        + '<div class="light-pad-where">' + escapeHtml(R.where) + "</div></div>"
        + '<div class="light-pad-state cmd-pill cmd-pill--need">NEED CONNECT</div>'
        + "</div>"
        + '<div class="light-pad-actions">'
        + '<button type="button" class="cmd-rocker is-stub is-off" disabled aria-label="' + escapeHtml(R.name) + ' · need connect">'
        + '<span class="cmd-rocker-knob"></span></button>'
        + "</div>"
        + '<div class="light-pad-src">Not connected yet</div>'
        + "</article>";
    }
    grid.innerHTML = html;
  }

  /** Paint Google Home secondary Lights tile + optional pad row. */
  function paintPads(doc) {
    doc = doc || document;
    var eff = effectiveLights();
    var g = eff.gate;
    var meta = doc.getElementById("lights-zone-meta") || doc.querySelector(".sec-zone .zone-meta");
    if (meta && meta.closest && meta.closest(".sec-zone")) {
      meta.textContent = canWrite()
        ? ("Lights LIVE · " + eff.lights.length + " pads · write armed")
        : (g.live
          ? ("Lights LIVE · " + eff.lights.length + " pads · " + (noKey(g) ? "NEED KEY" : g.writeSupported ? "PROXY OFF" : "READ ONLY"))
          : (g.needToken
            ? ("Lights · NEED TOKEN · controls dark")
            : ("Lights · " + g.label + " · controls dark")));
    }
    var sub = doc.getElementById("lights-ctrl-sub");
    if (sub) {
      var names = eff.lights.map(function (L) { return L.name; }).join(" · ");
      sub.textContent = names || "Dining Room · Harris's Room · Kitchen";
    }
    var pill = doc.getElementById("lights-ctrl-pill");
    if (pill) {
      pill.textContent = g.label;
      pill.classList.toggle("on", !!g.live);
      pill.classList.add("cmd-pill");
      pill.classList.toggle("cmd-pill--live", !!g.live);
      pill.classList.toggle("cmd-pill--need", !!(g.needToken || g.kind === "need_token"));
      pill.classList.toggle("cmd-pill--off", !g.live && !(g.needToken || g.kind === "need_token"));
    }
    var allOn = doc.getElementById("lights-all-on");
    var allOff = doc.getElementById("lights-all-off");
    var armed = canWrite();
    if (allOn) {
      allOn.disabled = !armed;
      allOn.style.pointerEvents = armed ? "auto" : "none";
      allOn.style.opacity = armed ? "1" : "0.45";
      allOn.style.cursor = armed ? "pointer" : "not-allowed";
    }
    if (allOff) {
      allOff.disabled = !armed;
      allOff.style.pointerEvents = armed ? "auto" : "none";
      allOff.style.opacity = armed ? "1" : "0.45";
      allOff.style.cursor = armed ? "pointer" : "not-allowed";
    }
    var grid = doc.getElementById("lights-pad-grid");
    if (grid) {
      var html = "";
      for (var i = 0; i < eff.lights.length; i++) {
        var L = eff.lights[i];
        var onCls = L.on ? " is-on" : "";
        var dim = L.kind === "dimmer";
        var rockerCls = L.on ? " is-on" : " is-off";
        var armedPad = canWrite();
        var rockerDis = armedPad ? "" : " is-disabled";
        html +=
          '<article class="light-pad cmd-panel' + onCls + '" data-light-id="' + L.id + '">'
          + '<div class="light-pad-top">'
          + '<div class="light-pad-ico" aria-hidden="true">💡</div>'
          + '<div><div class="light-pad-name">' + escapeHtml(L.name) + "</div>"
          + '<div class="light-pad-where">' + escapeHtml(L.where || L.kind) + "</div></div>"
          + '<div class="light-pad-state">' + (L.on ? "ON" : "OFF") + "</div>"
          + "</div>"
          + '<div class="light-pad-actions">'
          + '<button type="button" class="cmd-rocker' + rockerCls + rockerDis + '" data-act="toggle" data-id="' + L.id + '"'
          + (armedPad ? "" : " disabled")
          + ' aria-label="' + escapeHtml(L.name) + ' ' + (L.on ? "on" : "off") + '">'
          + '<span class="cmd-rocker-knob" aria-hidden="true"></span></button>'
          + (dim
            ? '<input class="light-bright" type="range" min="1" max="100" value="' + clampBright(L.brightness || 100) + '" data-id="' + L.id + '" aria-label="Brightness"' + (armedPad ? "" : " disabled") + ' />'
            : "")
          + "</div>"
          + '<div class="light-pad-src">' + hubSrcLabel(eff, g) + "</div>"
          + "</article>";
      }
      /* reserved OP slot */
      for (var r = 0; r < eff.reserved.length; r++) {
        var R = eff.reserved[r];
        html +=
          '<article class="light-pad cmd-panel is-pending" data-light-id="' + R.id + '">'
          + '<div class="light-pad-top">'
          + '<div class="light-pad-ico" aria-hidden="true">⏳</div>'
          + '<div><div class="light-pad-name">' + escapeHtml(R.name || R.id) + "</div>"
          + '<div class="light-pad-where">' + escapeHtml(R.where || "Not connected yet") + "</div></div>"
          + '<div class="light-pad-state cmd-pill cmd-pill--need">NEED CONNECT</div>'
          + "</div>"
          + '<div class="light-pad-actions">'
          + '<button type="button" class="cmd-rocker is-stub is-off" disabled aria-label="need connect">'
          + '<span class="cmd-rocker-knob" aria-hidden="true"></span></button>'
          + "</div>"
          + '<div class="light-pad-src">Not connected yet</div>'
          + "</article>";
      }
      grid.innerHTML = html;
      bindPadHandlers(grid);
    }
    paintNeedConnectStubs(doc);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bindPadHandlers(grid) {
    if (!grid || grid.getAttribute("data-lights-bound") === "1") {
      /* re-bind each paint — clear flag first */
    }
    grid.setAttribute("data-lights-bound", "1");
    grid.onclick = function (ev) {
      var t = ev.target;
      if (!t) return;
      if (t.classList && t.classList.contains("cmd-rocker-knob") && t.parentElement) t = t.parentElement;
      if (!t.getAttribute) return;
      var act = t.getAttribute("data-act");
      var id = t.getAttribute("data-id");
      if (!act || !id) return;
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {}
      if (act === "on") setLight(id, { on: true });
      else if (act === "off") setLight(id, { on: false });
      else if (act === "toggle") {
        var wasOn = t.classList && t.classList.contains("is-on");
        setLight(id, { on: !wasOn });
      }
      var d0 = grid.ownerDocument || document;
      paintPads(d0); paintHubPanel(d0);
    };
    grid.onchange = function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains("light-bright")) return;
      var id = t.getAttribute("data-id");
      if (!id) return;
      setLight(id, { on: true, brightness: clampBright(t.value) });
      var d1 = grid.ownerDocument || document;
      paintPads(d1); paintHubPanel(d1);
    };
  }

  function wireAllButtons(doc) {
    doc = doc || document;
    function tap() {
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {}
    }
    /* OCT8-3a: with no key, All On / All Off open the key box (they used to look live and do nothing).
       The read-only preview's key box says it can't keep a key. */
    function needKeyBox() {
      if (hasKey()) return false;
      if (global.WardHubKeyEntry && WardHubKeyEntry.open) { WardHubKeyEntry.open(); return true; }
      return false;
    }
    var onB = doc.getElementById("lights-all-on");
    var offB = doc.getElementById("lights-all-off");
    [onB, offB].forEach(function (b) { if (b && !hasKey()) { b.setAttribute("aria-label", b.textContent.trim() + ": needs the screen key (tap to add it)"); b.title = "Needs the screen key"; } });
    if (onB && !onB._lightsWired) {
      onB._lightsWired = true;
      onB.addEventListener("click", function () {
        if (needKeyBox()) return;
        tap(); setAll(true); paintPads(doc); paintHubPanel(doc); paintChip(doc.getElementById("index-lights-chip"));
      });
    }
    if (offB && !offB._lightsWired) {
      offB._lightsWired = true;
      offB.addEventListener("click", function () {
        if (needKeyBox()) return;
        tap(); setAll(false); paintPads(doc); paintHubPanel(doc); paintChip(doc.getElementById("index-lights-chip"));
      });
    }
  }



  function hubSrcLabel(eff, g) {
    g = g || (eff && eff.gate) || gate();
    if (canWrite()) return "LIVE";
    if (noKey(g)) return "NEED KEY";
    if (g.live && g.writeSupported && _proxyReachable === false) return "LIVE · PROXY OFF";
    if (g.live && g.writeSupported) return "LIVE · PROXY…";
    if (g.live) return "LIVE · READ ONLY";
    if (g.needToken) return "NEED TOKEN";
    return g.label || "OFFLINE";
  }

  function hubHonesty(g) {
    g = g || gate();
    if (canWrite()) return "LIVE";
    if (noKey(g)) return "NEED KEY";
    if (g.live && g.writeSupported && _proxyReachable === false) return "PROXY OFF";
    if (g.live && g.writeSupported) return "LIVE";
    if (g.live) return "READ ONLY";
    if (g.needToken) return "NEED TOKEN";
    return g.label || "OFFLINE";
  }

  /** Hub command-deck roster · 3 LIVE (LIGHTS6 write) + 6 OFF · wait stubs (honest · never DEMO). */
  var HUB_DECK = [
    { id: "dining-room", short: "Dining", name: "Dining Room", live: true },
    { id: "harris-room", short: "Harris", name: "Harris's Room", live: true },
    { id: "kitchen", short: "Kitchen", name: "Kitchen", live: true },
    { id: "dads-room", short: "Dad", name: "Dad's Room", live: false },
    { id: "ainsley-room", short: "Ainsley", name: "Ainsley's Room", live: false },
    { id: "hayes-room", short: "Hayes", name: "Hayes' Room", live: false },
    { id: "living-room", short: "Living", name: "Living Room", live: false },
    { id: "family-room", short: "Family", name: "Family Room", live: false },
    { id: "basement", short: "Basement", name: "Basement", live: false }
  ];

  var HUB_SHORT_NAMES = {
    "dining-room": "Dining",
    "harris-room": "Harris",
    "kitchen": "Kitchen",
    "dads-room": "Dad",
    "ainsley-room": "Ainsley",
    "hayes-room": "Hayes",
    "living-room": "Living",
    "family-room": "Family",
    "basement": "Basement"
  };

  function shortHubName(L) {
    if (!L) return "";
    if (HUB_SHORT_NAMES[L.id]) return HUB_SHORT_NAMES[L.id];
    var n = String(L.name || L.id || "");
    n = n.replace(/\u2019s Room$/i, "").replace(/'s Room$/i, "").replace(/ Room$/i, "");
    return n || L.id;
  }

  /** Hub-only deck: LIVE Kasa rows + honest OFF · wait stubs (not in write path). */
  function hubDeckLights() {
    var eff = effectiveLights();
    var byId = {};
    for (var i = 0; i < eff.lights.length; i++) byId[eff.lights[i].id] = eff.lights[i];
    var out = [];
    for (var j = 0; j < HUB_DECK.length; j++) {
      var slot = HUB_DECK[j];
      if (slot.live && byId[slot.id]) {
        var L = byId[slot.id];
        out.push({
          id: L.id,
          name: L.name || slot.name,
          short: slot.short,
          kind: L.kind || "dimmer",
          on: L.on,
          brightness: L.brightness,
          live: true,
          needConnect: false,
          disabled: !canWrite()
        });
      } else if (slot.live) {
        out.push({
          id: slot.id,
          name: slot.name,
          short: slot.short,
          kind: "dimmer",
          on: null,
          brightness: null,
          live: true,
          needConnect: false,
          disabled: true,
          offline: true
        });
      } else {
        out.push({
          id: slot.id,
          name: slot.name,
          short: slot.short,
          kind: "stub",
          on: null,
          brightness: null,
          live: false,
          needConnect: true,
          disabled: true
        });
      }
    }
    return { gate: eff.gate, lights: out, canWrite: canWrite() };
  }

  function paintHubPanel(doc) {
    doc = doc || document;
    var panel = doc.getElementById("hub-lights-panel");
    if (!panel) return;
    if (_dimDrag) return; /* don't wipe mid-drag fill */
    var deck = hubDeckLights();
    var g = deck.gate;
    panel.classList.toggle("is-live", !!g.live);
    panel.classList.toggle("is-need", !!(g.needToken || g.kind === "need_token"));
    panel.classList.toggle("is-demo-write", false);
    panel.classList.toggle("is-proxy-off", !!(g.live && g.writeSupported && !canWrite()));
    panel.classList.toggle("is-disabled", !canWrite());
    panel.classList.add("hub-lights--deck9");

    var pill = doc.getElementById("hub-lights-pill");
    if (pill) {
      pill.textContent = hubHonesty(g);
      pill.classList.toggle("on", !!g.live);
      pill.classList.toggle("off", !g.live);
    }
    var sub = doc.getElementById("hub-lights-sub");
    if (sub) {
      sub.textContent = canWrite()
        ? "3 LIVE · 6 OFF · wait"
        : (noKey(g)
          ? "NEED KEY · controls dark"
          : g.live && g.writeSupported
          ? "PROXY OFF · write proxy unreachable (check tunnel)"
          : (g.live
            ? "LIVE read · write not armed"
            : (g.needToken ? "NEED TOKEN · controls dark" : ((g.label || "OFFLINE") + " · controls dark"))));
    }

    var grid = doc.getElementById("hub-lights-grid");
    if (!grid) return;
    grid.classList.add("hub-lights-grid--deck9");
    var html = "";
    for (var i = 0; i < deck.lights.length; i++) {
      var L = deck.lights[i];
      var hubName = L.short || shortHubName(L);
      if (L.needConnect) {
        html +=
          '<article class="hub-sw is-stub is-need-connect is-off hub-sw--stub" data-light-id="' + L.id + '" data-need-connect="1">'
          + '<div class="hub-sw-main">'
          + '<div class="hub-sw-text">'
          + '<div class="hub-sw-name">' + escapeHtml(hubName) + "</div>"
          + '<div class="hub-sw-meta">OFF · wait</div>'
          + "</div>"
          + '<span class="hub-sw-stub-pill" title="Not connected yet">OFF · wait</span>'
          + "</div>"
          + "</article>";
        continue;
      }
      var onCls = L.on ? " is-on" : " is-off";
      if (L.on == null) onCls = " is-off is-unknown";
      var dim = (L.kind === "dimmer" || L.kind === "switch/dimmer");
      var bright = L.brightness != null ? clampBright(L.brightness) : (L.on ? 100 : 0);
      /* Mid-drag: keep the fill the user is holding, not a stale poll. */
      if (_dimDrag && _dimDrag.id === L.id && typeof _dimDrag.bright === "number") {
        bright = clampBright(_dimDrag.bright);
      }
      var meta = L.on == null ? "…" : (L.on ? "ON" : "OFF");
      var writable = canWrite() && !L.disabled;
      var dimCls = dim ? " hub-sw--dim" : " hub-sw--toggle";
      html +=
        '<article class="hub-sw hub-sw--live' + dimCls + onCls + '" data-light-id="' + L.id + '">'
        + '<div class="hub-sw-main">'
        + '<div class="hub-sw-text">'
        + '<div class="hub-sw-name">' + escapeHtml(hubName) + "</div>"
        + '<div class="hub-sw-meta">' + meta + "</div>"
        + "</div>";
      if (dim) {
        /* Premium fill · tap rocker = on/off · drag track = brightness. Stubs never get this. */
        var fillPct = L.on ? bright : 0;
        var showPct = (L.on == null) ? "—" : (bright + "%");
        html +=
          '<div class="hub-sw-dim' + (writable ? "" : " is-disabled") + '" data-id="' + L.id + '">'
          + '<div class="hub-sw-track" role="slider" tabindex="' + (writable ? "0" : "-1") + '"'
          + ' aria-valuemin="1" aria-valuemax="100" aria-valuenow="' + bright + '"'
          + ' aria-label="' + escapeHtml(L.name) + ' brightness"'
          + ' data-id="' + L.id + '"' + (writable ? "" : " aria-disabled=\"true\"") + '>'
          + '<div class="hub-sw-fill" style="width:' + fillPct + '%" aria-hidden="true"></div>'
          + '<div class="hub-sw-thumb" style="left:' + fillPct + '%" aria-hidden="true"></div>'
          + "</div>"
          + '<span class="hub-sw-pct" data-pct-for="' + L.id + '">' + showPct + "</span>"
          + "</div>";
      }
      html +=
        '<button type="button" class="hub-sw-rocker' + onCls + (writable ? "" : " is-disabled") + '" data-act="toggle" data-id="'
        + L.id + '" aria-pressed="' + (L.on ? "true" : "false") + '" aria-label="'
        + escapeHtml(L.name) + ' power"' + (writable ? "" : " disabled") + '>'
        + '<span class="hub-sw-rocker-on">ON</span>'
        + '<span class="hub-sw-rocker-knob" aria-hidden="true"></span>'
        + '<span class="hub-sw-rocker-off">OFF</span>'
        + "</button>"
        + "</div>"
        + "</article>";
    }
    grid.innerHTML = html;
    bindHubHandlers(panel);
  }

  function brightFromPointer(track, clientX) {
    if (!track) return 50;
    var rect = track.getBoundingClientRect();
    var w = rect.width || 1;
    var x = clientX - rect.left;
    var pct = Math.round((x / w) * 100);
    return clampBright(Math.max(1, pct)); /* HS220 native 1–100 */
  }

  function paintDimVisual(panel, id, bright, on) {
    if (!panel || !id) return;
    bright = clampBright(bright);
    var fillPct = on === false ? 0 : bright;
    var track = panel.querySelector('.hub-sw-track[data-id="' + id + '"]');
    if (track) {
      track.setAttribute("aria-valuenow", String(bright));
      var fill = track.querySelector(".hub-sw-fill");
      var thumb = track.querySelector(".hub-sw-thumb");
      if (fill) fill.style.width = fillPct + "%";
      if (thumb) thumb.style.left = fillPct + "%";
    }
    var pct = panel.querySelector('[data-pct-for="' + id + '"]');
    if (pct) pct.textContent = bright + "%";
    var art = panel.querySelector('.hub-sw[data-light-id="' + id + '"]');
    if (art && on !== undefined && on !== null) {
      art.classList.toggle("is-on", !!on);
      art.classList.toggle("is-off", !on);
    }
  }

  function commitDim(id, bright, panel) {
    bright = clampBright(Math.max(1, bright));
    _dimDrag = null;
    setLight(id, { on: true, brightness: bright });
    paintHubPanel(panel.ownerDocument || document);
    paintPads(panel.ownerDocument || document);
    paintChip((panel.ownerDocument || document).getElementById("index-lights-chip"));
  }

  function bindHubHandlers(panel) {
    if (!panel) return;
    panel.setAttribute("data-hub-lights-bound", "1");
    panel.onclick = function (ev) {
      var t = ev.target;
      if (!t) return;
      /* Ignore clicks that originated on the dim track (pointer handlers own those). */
      if (t.closest && t.closest(".hub-sw-track, .hub-sw-dim")) return;
      var btn = t.closest ? t.closest("[data-act]") : null;
      if (!btn) {
        while (t && t !== panel && !(t.getAttribute && t.getAttribute("data-act"))) t = t.parentNode;
        btn = (t && t.getAttribute && t.getAttribute("data-act")) ? t : null;
      }
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      var id = btn.getAttribute("data-id");
      if (!act || !id) return;
      if (btn.classList && (btn.classList.contains("is-stub") || btn.getAttribute("data-need-connect"))) return;
      if (btn.closest && btn.closest("[data-need-connect]")) return;
      if (!canWrite()) { probeProxy(); return; }
      ev.preventDefault();
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {}
      if (act === "toggle") {
        var eff = effectiveLights();
        var cur = false;
        for (var i = 0; i < eff.lights.length; i++) {
          if (eff.lights[i].id === id) { cur = !!eff.lights[i].on; break; }
        }
        setLight(id, { on: !cur });
      } else if (act === "on") {
        setLight(id, { on: true });
      } else if (act === "off") {
        setLight(id, { on: false });
      }
      paintHubPanel(panel.ownerDocument || document);
      paintPads(panel.ownerDocument || document);
      paintChip((panel.ownerDocument || document).getElementById("index-lights-chip"));
    };

    /* LIGHTDIM1 · premium fill drag (pointer) · write on release · optimistic mid-drag */
    panel.onpointerdown = function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var track = t.closest(".hub-sw-track");
      if (!track || track.getAttribute("aria-disabled") === "true") return;
      var id = track.getAttribute("data-id");
      if (!id) return;
      if (!canWrite()) { probeProxy(); return; }
      ev.preventDefault();
      ev.stopPropagation();
      try { track.setPointerCapture(ev.pointerId); } catch (e) {}
      var bright = brightFromPointer(track, ev.clientX);
      _dimDrag = { id: id, bright: bright, pointerId: ev.pointerId };
      paintDimVisual(panel, id, bright, true);
      applyOptimistic(id, { on: true, brightness: bright });
    };
    panel.onpointermove = function (ev) {
      if (!_dimDrag || _dimDrag.pointerId !== ev.pointerId) return;
      var track = panel.querySelector('.hub-sw-track[data-id="' + _dimDrag.id + '"]');
      if (!track) return;
      ev.preventDefault();
      var bright = brightFromPointer(track, ev.clientX);
      _dimDrag.bright = bright;
      paintDimVisual(panel, _dimDrag.id, bright, true);
      applyOptimistic(_dimDrag.id, { on: true, brightness: bright });
    };
    function endDimPointer(ev) {
      if (!_dimDrag || (ev && _dimDrag.pointerId !== ev.pointerId)) return;
      var id = _dimDrag.id;
      var bright = _dimDrag.bright;
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {}
      commitDim(id, bright, panel);
    }
    panel.onpointerup = endDimPointer;
    panel.onpointercancel = function (ev) {
      if (!_dimDrag || _dimDrag.pointerId !== ev.pointerId) return;
      var id = _dimDrag.id;
      _dimDrag = null;
      rollbackOptimistic(id);
      paintHubPanel(panel.ownerDocument || document);
    };

    /* Keyboard on focused track · arrows nudge 5% */
    panel.onkeydown = function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains("hub-sw-track")) return;
      var id = t.getAttribute("data-id");
      if (!id || !canWrite()) return;
      var cur = Number(t.getAttribute("aria-valuenow") || 50);
      var next = cur;
      if (ev.key === "ArrowRight" || ev.key === "ArrowUp") next = cur + 5;
      else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") next = cur - 5;
      else if (ev.key === "Home") next = 1;
      else if (ev.key === "End") next = 100;
      else return;
      ev.preventDefault();
      next = clampBright(Math.max(1, next));
      paintDimVisual(panel, id, next, true);
      commitDim(id, next, panel);
    };

    /* Legacy range fallback (sheet-lights / older markup) */
    panel.oninput = function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains("hub-sw-bright")) return;
      var id = t.getAttribute("data-id");
      if (!id) return;
      var v = clampBright(t.value);
      var pct = panel.querySelector('[data-pct-for="' + id + '"]');
      if (pct) pct.textContent = v + "%";
    };
    panel.onchange = function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains("hub-sw-bright")) return;
      var id = t.getAttribute("data-id");
      if (!id) return;
      if (!canWrite()) { probeProxy(); return; }
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {}
      setLight(id, { on: true, brightness: clampBright(t.value) });
      paintHubPanel(panel.ownerDocument || document);
      paintPads(panel.ownerDocument || document);
      paintChip((panel.ownerDocument || document).getElementById("index-lights-chip"));
    };
  }

  function mountHubPanel(selector) {
    var doc = document;
    var panel = typeof selector === "string" ? doc.querySelector(selector) : selector;
    if (!panel) panel = doc.getElementById("hub-lights-panel");
    if (!panel) return null;
    wireAllButtons(doc);
    onChange(function () { paintHubPanel(doc); });
    startPolling();
    paintHubPanel(doc);
    return panel;
  }

  /** Kid-board room pad only (hub = full roster). One LIVE badge max · no shortcut fluff. */
  function paintKidPad(host, lightId, doc) {
    doc = doc || document;
    host = typeof host === "string" ? doc.querySelector(host) : host;
    if (!host || !lightId) return;
    var eff = effectiveLights();
    var g = eff.gate;
    var L = null;
    for (var i = 0; i < eff.lights.length; i++) {
      if (eff.lights[i].id === lightId) { L = eff.lights[i]; break; }
    }
    if (!L) {
      host.innerHTML = '<div class="kid-light-miss">Light not in roster</div>';
      return;
    }
    var onCls = L.on ? " is-on" : "";
    var dim = (L.kind === "dimmer" || L.kind === "switch/dimmer");
    var rockerCls = L.on ? " is-on" : " is-off";
    var armedPad = canWrite();
    var rockerDis = armedPad ? "" : " is-disabled";
    /* LIGHTSTRIP1 (Dan 6:05 PM): one compact strip: room name, on/off rocker, small dimmer. Same lights path
       (setLight) as before. LIGHTSQUIET1: when the hub can't take a write the strip dims quietly, the controls are
       disabled (a tap writes nothing and says nothing) and one small plain reason shows. No NEED KEY / token words. */
    var reason = "";
    if (!armedPad) {
      if (noKey(g)) reason = "Not set up on this screen";
      else if (g.live && g.writeSupported && _proxyReachable === false) reason = "Lights hub asleep";
      else if (g.live && !g.writeSupported) reason = "View only";
      else reason = "Lights offline";
    }
    host.innerHTML =
      '<div class="kid-light-strip' + onCls + (armedPad ? "" : " is-quiet") + '" data-light-id="' + L.id + '"'
      + (armedPad ? "" : ' aria-disabled="true"') + ">"
      + '<span class="kls-name">' + escapeHtml(L.name) + "</span>"
      + '<button type="button" class="cmd-rocker kls-rocker' + rockerCls + rockerDis + '" data-act="toggle" data-id="' + L.id + '"'
      + (armedPad ? "" : " disabled")
      + ' aria-label="' + escapeHtml(L.name) + ' ' + (L.on ? "on" : "off") + '">'
      + '<span class="cmd-rocker-knob" aria-hidden="true"></span></button>'
      + (dim
        ? '<input class="light-bright kls-dim" type="range" min="1" max="100" value="' + clampBright(L.brightness || 100) + '" data-id="' + L.id + '" aria-label="Brightness"' + (armedPad ? "" : " disabled") + ' />'
        : "")
      + (reason ? '<span class="kls-why">' + escapeHtml(reason) + "</span>" : "")
      + "</div>";
    host.onclick = function (ev) {
      var el = ev.target;
      if (!el) return;
      if (el.classList && el.classList.contains("cmd-rocker-knob") && el.parentElement) el = el.parentElement;
      if (!el.getAttribute) return;
      var act = el.getAttribute("data-act");
      var id = el.getAttribute("data-id");
      if (!act || !id) return;
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {}
      if (act === "on") setLight(id, { on: true });
      else if (act === "off") setLight(id, { on: false });
      else if (act === "toggle") {
        var wasOn = el.classList && el.classList.contains("is-on");
        setLight(id, { on: !wasOn });
      }
      paintKidPad(host, lightId, doc);
    };
    host.onchange = function (ev) {
      var el = ev.target;
      if (!el || !el.classList || !el.classList.contains("light-bright")) return;
      var id = el.getAttribute("data-id");
      if (!id) return;
      setLight(id, { on: true, brightness: clampBright(el.value) });
      paintKidPad(host, lightId, doc);
    };
  }

  function mountKidLight(selector, lightId) {
    var doc = document;
    var host = typeof selector === "string" ? doc.querySelector(selector) : selector;
    if (!host || !lightId) return;
    function repaint() { paintKidPad(host, lightId, doc); }
    onChange(repaint);
    startPolling();
    repaint();
  }

  global.HouseLights = {
    STATE_KEY: STATE_KEY,
    LIVE_URL: LIVE_URL,
    DOCS: DOCS,
    STARTER: STARTER,
    gate: gate,
    effectiveLights: effectiveLights,
    loadDemo: loadDemo,
    saveDemo: saveDemo,
    setLight: setLight,
    setAll: setAll,
    canWrite: canWrite,
    probeProxy: probeProxy,
    proxyBase: proxyBase,
    fetchLive: fetchLive,
    startPolling: startPolling,
    onChange: onChange,
    paintChip: paintChip,
    mountChip: mountChip,
    paintPads: paintPads,
    paintNeedConnectStubs: paintNeedConnectStubs,
    wireAllButtons: wireAllButtons,
    paintHubPanel: paintHubPanel,
    mountHubPanel: mountHubPanel,
    paintKidPad: paintKidPad,
    mountKidLight: mountKidLight,
    clampBright: clampBright,
    hubHonesty: hubHonesty
  };
})(typeof window !== "undefined" ? window : globalThis);
