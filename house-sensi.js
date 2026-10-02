/* House Face · Sensi thermostat
   Live path: poll data/sensi-live.json (Atlas box fetcher → Pages).
   DEMO/STUB localStorage when live missing/stale/need_token.
   NEVER invent live temps. NEVER label DEMO as LIVE.
   Keys: house-sensi-connected, house-sensi-state */
(function (global) {
  "use strict";

  var CONNECTED_KEY = "house-sensi-connected";
  var STATE_KEY = "house-sensi-state";
  var LIVE_URL = "data/sensi-live.json";
  var LIVE_FRESH_MS = 30 * 60 * 1000;
  var LIVE_POLL_MS = 60 * 1000;
  var WEB_LOGIN = "https://manager.sensicomfort.com/";
  var WEB_PRODUCT = "https://sensi.copeland.com/en-us";
  var APP_IOS = "https://apps.apple.com/us/app/sensi/id792612452";
  var APP_ANDROID = "https://play.google.com/store/apps/details?id=com.asynchrony.emerson.sensi";
  var APP_SCHEME = "sensi://";
  var DOCS = "SENSI-LIVE.md";

  var MODES = ["Heat", "Cool", "Auto", "Off"];
  var FANS = ["Auto", "On"];

  var _liveCache = null; /* { at, data } */
  var _listeners = [];

  function chicagoDayKey() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
    } catch (e) {
      var d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
  }

  function defaults() {
    return {
      day: chicagoDayKey(),
      ambient: 72,
      setpoint: 70,
      mode: "Heat",
      fan: "Auto",
      hold: false
    };
  }

  function isConnected() {
    try { return localStorage.getItem(CONNECTED_KEY) === "1"; } catch (e) { return false; }
  }

  function setConnected(on) {
    try {
      if (on) localStorage.setItem(CONNECTED_KEY, "1");
      else localStorage.removeItem(CONNECTED_KEY);
    } catch (e) { /* */ }
  }

  function loadState() {
    var base = defaults();
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (!raw) return base;
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return base;
      var day = chicagoDayKey();
      return {
        day: day,
        ambient: (o.day === day && typeof o.ambient === "number") ? o.ambient : base.ambient,
        setpoint: typeof o.setpoint === "number" ? clampSet(o.setpoint) : base.setpoint,
        mode: MODES.indexOf(o.mode) >= 0 ? o.mode : base.mode,
        fan: FANS.indexOf(o.fan) >= 0 ? o.fan : base.fan,
        hold: !!o.hold
      };
    } catch (e) { return base; }
  }

  function saveState(st) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        day: chicagoDayKey(),
        ambient: st.ambient,
        setpoint: clampSet(st.setpoint),
        mode: st.mode,
        fan: st.fan,
        hold: !!st.hold
      }));
    } catch (e) { /* */ }
  }

  function clampSet(n) {
    n = Math.round(Number(n) || 70);
    if (n < 50) n = 50;
    if (n > 90) n = 90;
    return n;
  }

  function modeColor(mode) {
    if (mode === "Heat") return { accent: "#c87810", soft: "#fff0d0", label: "HEAT" };
    if (mode === "Cool") return { accent: "#2868a0", soft: "#d8ecff", label: "COOL" };
    if (mode === "Auto") return { accent: "#287838", soft: "#d8f0d8", label: "AUTO" };
    return { accent: "#5a5e66", soft: "#e8ebf0", label: "OFF" };
  }

  function parseUpdatedAt(iso) {
    if (!iso) return 0;
    var t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }

  function liveFresh(data) {
    if (!data || data.status !== "live" || !data.thermostat) return false;
    var t = parseUpdatedAt(data.updatedAt);
    if (!t) return false;
    return (Date.now() - t) <= LIVE_FRESH_MS;
  }

  /** Gate for UI labels.
   * LIVE when status==="live" + thermostat (even if aging).
   * NEED TOKEN only when status==="need_token" (creds truly missing).
   * Never invent LIVE from DEMO localStorage. */
  function liveStatus(data) {
    data = data || (_liveCache && _liveCache.data) || null;
    if (!data) return { kind: "stub", label: "STUB", live: false };
    if (data.status === "need_token") {
      return { kind: "need_token", label: "NEED TOKEN", live: false, error: data.error || null };
    }
    if (data.status === "error") {
      return { kind: "error", label: "FETCH ERR", live: false, error: data.error || null };
    }
    if (data.status === "live" && data.thermostat) {
      var th = data.thermostat;
      var offline = th && th.online === false;
      var aging = !liveFresh(data);
      return {
        kind: offline ? "offline" : (aging ? "aging" : "live"),
        label: offline ? "LIVE · OFFLINE" : (aging ? "LIVE · aging" : "LIVE"),
        live: true,
        writeSupported: !!data.writeSupported,
        updatedAt: data.updatedAt,
        thermostat: th
      };
    }
    if (data.status === "live") {
      return { kind: "stub", label: "LIVE · no unit", live: false, error: "live JSON missing thermostat" };
    }
    return { kind: "stub", label: "STUB", live: false };
  }

  /**
   * Effective display state: prefer fresh live reads; DEMO for writes / fallback.
   * ambient/mode/fan/setpoint from live when live; otherwise localStorage DEMO.
   */
  function effectiveState() {
    var demo = loadState();
    var gate = liveStatus();
    if (gate.live && gate.thermostat) {
      var th = gate.thermostat;
      return {
        source: "live",
        ambient: typeof th.ambient === "number" ? th.ambient : demo.ambient,
        setpoint: typeof th.setpoint === "number" ? th.setpoint : demo.setpoint,
        heatSetpoint: typeof th.heatSetpoint === "number" ? th.heatSetpoint : null,
        coolSetpoint: typeof th.coolSetpoint === "number" ? th.coolSetpoint : null,
        mode: MODES.indexOf(th.mode) >= 0 ? th.mode : demo.mode,
        fan: FANS.indexOf(th.fan) >= 0 ? th.fan : demo.fan,
        hold: !!th.hold,
        name: th.name || "Sensi",
        humidity: typeof th.humidity === "number" ? th.humidity : null,
        online: th.online !== false,
        writeSupported: !!gate.writeSupported,
        gate: gate
      };
    }
    return {
      source: "demo",
      ambient: demo.ambient,
      setpoint: demo.setpoint,
      mode: demo.mode,
      fan: demo.fan,
      hold: !!demo.hold,
      name: "Sensi",
      humidity: null,
      online: null,
      writeSupported: false,
      gate: gate
    };
  }

  function notify() {
    var st = effectiveState();
    for (var i = 0; i < _listeners.length; i++) {
      try { _listeners[i](st); } catch (e) { /* */ }
    }
  }

  function onChange(fn) {
    if (typeof fn === "function") _listeners.push(fn);
  }

  function applyLivePayload(data) {
    _liveCache = { at: Date.now(), data: data };
    notify();
    return liveStatus(data);
  }

  function fetchLive(cb) {
    var url = LIVE_URL + (LIVE_URL.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("live json " + r.status);
      return r.json();
    }).then(function (j) {
      var gate = applyLivePayload(j);
      if (cb) cb(null, gate, j);
    }).catch(function (err) {
      /* Keep last cache if any; otherwise stay stub — do not invent */
      if (!_liveCache) {
        applyLivePayload({
          status: "need_token",
          updatedAt: null,
          thermostat: null,
          error: "data/sensi-live.json unavailable"
        });
      }
      if (cb) cb(err || new Error("live fetch fail"), liveStatus(), null);
    });
  }

  var _pollTimer = null;
  function startPolling() {
    fetchLive();
    if (_pollTimer) return;
    _pollTimer = setInterval(function () { fetchLive(); }, LIVE_POLL_MS);
  }

  function openUrl(url) {
    try { window.open(url, "_blank", "noopener,noreferrer"); } catch (e) {
      try { location.href = url; } catch (e2) { /* */ }
    }
  }

  function connectOpenWeb() { openUrl(WEB_LOGIN); }
  function connectOpenProduct() { openUrl(WEB_PRODUCT); }
  function connectOpenIos() { openUrl(APP_IOS); }
  function connectOpenAndroid() { openUrl(APP_ANDROID); }
  function connectTryApp() {
    try {
      var iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = APP_SCHEME;
      document.body.appendChild(iframe);
      setTimeout(function () {
        try { document.body.removeChild(iframe); } catch (e) { /* */ }
        openUrl(WEB_LOGIN);
      }, 700);
    } catch (e) {
      openUrl(WEB_LOGIN);
    }
  }

  /* SENSIAUTO1 · Auto runs a range (heat–cool), not one number. Not live → no invented temp. */
  function setLabel(st) {
    if (st.source !== "live") return "";
    if (st.mode === "Auto" && st.heatSetpoint != null && st.coolSetpoint != null) return st.heatSetpoint + "–" + st.coolSetpoint + "°";
    return st.setpoint + "°";
  }
  function ambLabel(st) { return st.source === "live" ? st.ambient : "—"; }

  function paintChip(el) {
    if (!el) return;
    var st = effectiveState();
    var mc = modeColor(st.mode);
    var status = st.gate.label;
    var hdr = el.classList.contains("sensi-hdr");
    el.classList.add("sensi-chip");
    el.classList.toggle("is-live", !!st.gate.live);
    el.classList.toggle("is-need", st.gate.kind === "need_token");
    el.setAttribute("data-mode", st.mode || "Auto");
    el.setAttribute("href", el.getAttribute("href") || "sheet-google-home.html");
    if (hdr) {
      /* HUBOVAL1 · matched oval pill — big ambient, quiet set/mode, honest LIVE/NEED */
      var thermoIco = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.2v9.4a3.6 3.6 0 1 0 4 0V3.2a2 2 0 1 0-4 0z"/><path d="M12 14.8v2.4"/></svg>';
      el.innerHTML =
        '<div class="sensi-hdr-ico" aria-hidden="true">' + thermoIco + "</div>"
        + '<div class="sensi-hdr-text">'
        + '<div class="sensi-hdr-kicker">Sensi</div>'
        + '<div class="sensi-hdr-line">'
        + '<span class="sensi-hdr-temp">' + ambLabel(st) + "°</span>"
        + (setLabel(st) ? '<span class="sensi-hdr-set">set ' + setLabel(st) + "</span>" : "")
        + '<span class="sensi-hdr-mode">' + mc.label + "</span>"
        + "</div>"
        + '<div class="sensi-hdr-sub"><i class="hdr-live-dot" aria-hidden="true"></i>' + status + "</div>"
        + "</div>";
      return;
    }
    el.innerHTML =
      '<div class="sensi-chip-ico" aria-hidden="true">🌡</div>'
      + '<div class="sensi-chip-text">'
      + '<div class="sensi-chip-kicker">Sensi · indoors</div>'
      + '<div class="sensi-chip-line">'
      + '<span class="sensi-chip-temp">' + ambLabel(st) + "°</span>"
      + (setLabel(st) ? '<span class="sensi-chip-set">set ' + setLabel(st) + "</span>" : "")
      + '<span class="sensi-chip-mode" style="--sensi-accent:' + mc.accent + '">' + mc.label + "</span>"
      + "</div>"
      + '<div class="sensi-chip-sub">' + status + " · fan " + st.fan + "</div>"
      + "</div>";
  }

  function mountChip(selector) {
    var el = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!el) return;
    paintChip(el);
    onChange(function () { paintChip(el); });
    startPolling();
  }

  /** Paint climate hero on Google Home sheet. */
  function paintHero(ids) {
    ids = ids || {};
    var st = effectiveState();
    var mc = modeColor(st.mode);
    var amb = document.getElementById(ids.amb || "sensi-hero-amb");
    var set = document.getElementById(ids.set || "sensi-hero-set");
    var mode = document.getElementById(ids.mode || "sensi-hero-mode");
    var pill = document.getElementById(ids.pill || "sensi-hero-pill");
    var sub = document.getElementById(ids.sub || "sensi-hero-sub");
    var ambLab = document.querySelector(".climate-amb .lab");
    if (amb) amb.innerHTML = ambLabel(st) + "<span>°</span>";
    if (set) set.textContent = setLabel(st) || "—";
    if (mode) {
      mode.textContent = mc.label;
      mode.style.background = mc.soft;
      mode.style.color = "#121418";
      mode.style.borderColor = mc.accent;
    }
    if (pill) {
      pill.textContent = st.gate.label;
      pill.classList.toggle("on", st.gate.live);
      pill.classList.add("cmd-pill");
      pill.classList.toggle("cmd-pill--live", !!st.gate.live);
      pill.classList.toggle("cmd-pill--need", st.gate.kind === "need_token");
      pill.classList.toggle("cmd-pill--off", !st.gate.live && st.gate.kind !== "need_token");
      pill.classList.toggle("cmd-pill--stub", st.gate.kind === "stub");
    }
    if (ambLab) {
      ambLab.textContent = st.gate.live ? "Indoor live" : "Indoor · not live";
    }
    if (sub) {
      var src = st.gate.live ? "LIVE" : (st.gate.kind === "need_token" ? "NEED TOKEN" : (st.gate.kind === "error" || st.gate.kind === "stale" ? "OFF" : "LOCAL"));
      sub.textContent = src + " · " + st.mode + " · fan " + st.fan + " · not Nest";
    }
  }

  function mountHero(ids) {
    paintHero(ids);
    onChange(function () { paintHero(ids); });
    startPolling();
  }

  global.HouseSensi = {
    CONNECTED_KEY: CONNECTED_KEY,
    STATE_KEY: STATE_KEY,
    LIVE_URL: LIVE_URL,
    WEB_LOGIN: WEB_LOGIN,
    WEB_PRODUCT: WEB_PRODUCT,
    APP_IOS: APP_IOS,
    APP_ANDROID: APP_ANDROID,
    DOCS: DOCS,
    MODES: MODES,
    FANS: FANS,
    isConnected: isConnected,
    setConnected: setConnected,
    loadState: loadState,
    saveState: saveState,
    clampSet: clampSet,
    modeColor: modeColor,
    chicagoDayKey: chicagoDayKey,
    connectOpenWeb: connectOpenWeb,
    connectOpenProduct: connectOpenProduct,
    connectOpenIos: connectOpenIos,
    connectOpenAndroid: connectOpenAndroid,
    connectTryApp: connectTryApp,
    paintChip: paintChip,
    mountChip: mountChip,
    paintHero: paintHero,
    mountHero: mountHero,
    fetchLive: fetchLive,
    startPolling: startPolling,
    liveStatus: liveStatus,
    effectiveState: effectiveState,
    onChange: onChange
  };
})(typeof window !== "undefined" ? window : globalThis);
