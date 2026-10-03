/* jar-mercury.js · Prism kit · Fri Oct 2 2026 (Phase 1 final: the hungry living jar) · window.JarMercury
   Colored liquid mercury that BOILS harder as it fills and boils over at full. Told through motion alone.
   VISUAL ONLY: pure canvas + inline SVG + WAAPI, no libraries, no network, no storage. It never computes data:
   Wright passes level / hunger / nudge and calls feed(). The only text it ever draws is Ainsley's TRUSTED line.
   Full API + numbers: README.md and MOTION-SPEC-jar-mercury.md in this kit. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.JarMercury = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";
  /* ===== geometry (viewBox 0 0 100 128 for both shapes) ===== */
  function smooth(a, b, t) { t = t < 0 ? 0 : t > 1 ? 1 : t; t = t * t * (3 - 2 * t); return a + (b - a) * t; }
  var GEO = {
    jar: {
      outer: "M30,19 C30,27 12,26 12,38 L12,112 C12,120.5 18,124 26,124 L74,124 C82,124 88,120.5 88,112 L88,38 C88,26 70,27 70,19 Z",
      inner: "M33,21.5 C33,29 15.4,28.5 15.4,40 L15.4,111 C15.4,118 20,120.6 27,120.6 L73,120.6 C80,120.6 84.6,118 84.6,111 L84.6,40 C84.6,28.5 67,29 67,21.5 Z",
      xl: 15.4, xr: 84.6, cx: 50, floor: 120.6, top: 44, overTop: 25, rimY: 19.5, bottom: 124,
      hw: function (y) { return y < 19 ? 20 : y < 38 ? smooth(20, 38, (y - 19) / 19) : y < 112 ? 38 : smooth(38, 30, (y - 112) / 12); },
      lidOrigin: "50% 11.4%", hinge: "25% 11.4%"
    },
    vessel: {
      outer: "M35,15 C35,19 29,19.5 29,25 L29,114 C29,120.5 32.5,124 39,124 L61,124 C67.5,124 71,120.5 71,114 L71,25 C71,19.5 65,19 65,15 Z",
      inner: "M37.4,16.5 C37.4,21 31.6,21.5 31.6,27 L31.6,113 C31.6,118.6 34.4,120.8 39.5,120.8 L60.5,120.8 C65.6,120.8 68.4,118.6 68.4,113 L68.4,27 C68.4,21.5 62.6,21 62.6,16.5 Z",
      xl: 31.6, xr: 68.4, cx: 50, floor: 120.8, top: 31, overTop: 19, rimY: 15.5, bottom: 124,
      hw: function (y) { return y < 15 ? 15 : y < 25 ? smooth(15, 21, (y - 15) / 10) : y < 114 ? 21 : smooth(21, 16, (y - 114) / 10); },
      lidOrigin: "50% 9.6%", hinge: "35% 9.6%"
    }
  };
  var FX = { l: -12, t: -48, w: 124, h: 184 }; /* fx canvas extent in units: room for the feed blob above, spatter, rivulets + pool */
  /* ===== motion + boil numbers (MOTION-SPEC-jar-mercury.md) ===== */
  var M = {
    ref: 160, ampExp: 0.4,
    waves: [ { a: 1.10, lambda: 1.30, period: 4.6, dir: 1, ph: 0.0 }, { a: 0.70, lambda: 0.70, period: 3.1, dir: -1, ph: 1.7 }, { a: 0.30, lambda: 0.40, period: 2.0, dir: 1, ph: 4.1 } ],
    slosh: { a1: 0.050, p1: 6.4, a2: 0.022, p2: 3.9, period: 2.8, zeta: 0.14, maxTilt: 0.09 },
    boilWaves: [ { lambda: 0.50, period: 1.30 }, { lambda: 0.30, period: 0.90 }, { lambda: 0.18, period: 0.62 } ],
    boil: { simmer: 0.12, exp: 1.3, rate0: 2, rate1: 24, rough0: 0.25, rough1: 1.6, spatterAt: 0.45, overAt: 0.995,
            hungerCut: 0.6, nudgeSimmer: 0.16, feedSurge: 0.9, burstSurge: 1.3, surgeTau: 1.2 },
    level: { period: 1.4, zeta: 0.78 },
    ripple: { amp: 1.6, decay: 0.45, speed: 70, k: 0.42, dur: 1.4 },
    splash: { amp: 3.0, crown: 3.6, crownW: 4.5, crownT: 0.36, tiltKick: 0.08, drops: 6 },
    meniscus: { droop: 1.5, reach: 5.0 },
    topFace: 2.8, topFaceSmall: 1.9,
    shimmer: { liquidPeriod: 7.0, glassPeriod: 6.5, glassSweep: 1.5 },
    hunger: { dim: 0.30, desat: 0.25, glowCut: 0.55, rattleEvery: [9, 2.2], rattleDeg: [1.5, 4.5], rattleDur: 0.36 },
    nudge: { hopEvery: 3.2, hopDur: 0.56, glowPeriod: 1.6 },
    perk: { tau: 1.1, rateBoost: 1.2, leanDeg: 5, hop: 1.2 },
    feed: { g: 300, lidOpenDeg: -28 },
    over: { rise: 1.6, streamsHero: 7, streamsMid: 5, streamsSmall: 2, poolRx: 34 },
    pool: { small: 6, mid: 18, hero: 34, spatter: 24 },
    fps: { max: 60, low: 30, small: 30, smallPx: 100, adaptMs: 7.0 },
    dprMax: 2, dprPhoneHero: 3
  };
  var PERSONALITY = {
    harris:  { name: "wild splashy monster", rate: 1.45, rMin: 1.4, rMax: 4.4, sizeSkew: 1.6, speed: 0.9, wobble: 1.7, spatter: 0.65, spatterV: 1.25, rough: 1.5,
               slosh: 1.35, hopH: 1.5, hopSquash: 0.2, hops: 2, lean: 1.3, glowR: 1.15, rattle: 1.3, streams: 1.3, streamW: 1.25 },
    hayes:   { name: "cool steady intense", rate: 1.35, rMin: 1.0, rMax: 1.7, sizeSkew: 1.0, speed: 1.45, wobble: 0.45, spatter: 0.12, spatterV: 0.9, rough: 0.7,
               slosh: 0.8, hopH: 0.75, hopSquash: 0.1, hops: 1, lean: 0.8, glowR: 0.82, rattle: 0.85, streams: 0.9, streamW: 0.85 },
    ainsley: { name: "sleek calm grown-up", rate: 0.6, rMin: 1.1, rMax: 2.2, sizeSkew: 1.2, speed: 0.75, wobble: 0.6, spatter: 0.05, spatterV: 0.7, rough: 0.55,
               slosh: 0.6, hopH: 0.55, hopSquash: 0.06, hops: 1, lean: 0.6, glowR: 1.0, rattle: 0.6, streams: 0.6, streamW: 1.6, capClick: true },
    family:  { name: "house", rate: 1.0, rMin: 1.2, rMax: 2.8, sizeSkew: 1.3, speed: 1.0, wobble: 1.0, spatter: 0.35, spatterV: 1.0, rough: 1.0,
               slosh: 1.0, hopH: 1.0, hopSquash: 0.14, hops: 1, lean: 1.0, glowR: 1.0, rattle: 1.0, streams: 1.0, streamW: 1.0 }
  };
  var KIDS = { hayes: 1, harris: 1, ainsley: 1, family: 1 };
  var FALLBACK = { base: "#8fa8c0", light: "#e6eef6", shadow: "#2a3a4a", deep: "#05080c", spec: "#ffffff", glow: "rgba(160,190,220,0.35)" };

  /* ===== pure helpers ===== */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function normLevel(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    var n = Number(v); if (!isFinite(n)) return null; return clamp(n, 0, 1);
  }
  function levelFromPctText(t) {
    var m = /^\s*(\d{1,3}(?:\.\d+)?)\s*%\s*(?![\s\S])/.exec(String(t == null ? "" : t));
    return m ? normLevel(Number(m[1]) / 100) : null;
  }
  function boilFor(level) { var l = normLevel(level); if (!l) return 0; return M.boil.simmer + (1 - M.boil.simmer) * Math.pow(l, M.boil.exp); }
  function boilCurve(level) {
    var B = boilFor(level), l = normLevel(level) || 0;
    return { B: +B.toFixed(3), bubblesPerSec: B ? +(M.boil.rate0 + M.boil.rate1 * B).toFixed(1) : 0, sizeMul: B ? +(0.6 + 0.7 * B).toFixed(2) : 0,
             roughnessU: B ? +(M.boil.rough0 + M.boil.rough1 * B).toFixed(2) : 0,
             spatter: l >= M.boil.spatterAt ? +((l - M.boil.spatterAt) / (1 - M.boil.spatterAt)).toFixed(2) : 0, boilOver: l >= M.boil.overAt };
  }
  function parseColor(s, fb) {
    s = String(s || "").trim();
    var m = /^#([0-9a-f]{6})(?![\s\S])/i.exec(s); /* (?![\s\S]) = end of string; no dollar glyph in kid-path files */
    if (m) { var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 1]; }
    m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?\s*\)(?![\s\S])/i.exec(s);
    if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
    return fb ? parseColor(fb) : [128, 128, 128, 1];
  }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a == null ? c[3] : a) + ")"; }
  function mix(c1, c2, t) { return [Math.round(c1[0] + (c2[0] - c1[0]) * t), Math.round(c1[1] + (c2[1] - c1[1]) * t), Math.round(c1[2] + (c2[2] - c1[2]) * t), c1[3] == null ? 1 : c1[3]]; }
  function desat(c, t) { var g = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return mix(c, [g, g, g, c[3]], t); }
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var api = { levelFromPctText: levelFromPctText, normLevel: normLevel, boilFor: boilFor, boilCurve: boilCurve, MOTION: M, PERSONALITY: PERSONALITY, GEOMETRY: GEO };

  /* ===== glass markup ===== */
  var uid = 0;
  function defs(id) {
    return "<defs>" +
      '<linearGradient id="jmr' + id + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="var(--jm-glass-edge)"/><stop offset=".16" stop-color="var(--jm-glass-edge-2)"/><stop offset=".84" stop-color="var(--jm-glass-edge-2)"/><stop offset="1" stop-color="var(--jm-glass-edge)"/></linearGradient>' +
      '<linearGradient id="jms' + id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset=".45" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="jml' + id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--jm-lid-top)"/><stop offset="1" stop-color="var(--jm-lid-low)"/></linearGradient>' +
      '<linearGradient id="jmk' + id + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="var(--jm-base)" stop-opacity="0"/><stop offset=".5" stop-color="var(--jm-base)" stop-opacity=".9"/><stop offset="1" stop-color="var(--jm-base)" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="jmc' + id + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#3a2a14"/><stop offset=".2" stop-color="#e8d0a0"/><stop offset=".28" stop-color="#fff6dc"/><stop offset=".42" stop-color="#9a7444"/><stop offset=".68" stop-color="#2a1c0c"/><stop offset=".86" stop-color="#c49a5c"/><stop offset="1" stop-color="#2a1c0c"/></linearGradient>' +
      '<radialGradient id="jmbg' + id + '" cx="50%" cy="92%" r="62%"><stop offset="0" stop-color="var(--jm-glow)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></radialGradient>' +
      "</defs>";
  }
  function svg(cls, body) { return '<svg class="' + cls + '" viewBox="0 0 100 128" aria-hidden="true" focusable="false">' + body + "</svg>"; }
  function glassBack(id, shape) {
    var g = GEO[shape || "jar"];
    return svg("jm-back", defs(id) + '<path d="' + g.outer + '" fill="var(--jm-glass-tint)"/><path d="' + g.inner + '" class="jm-bglow" fill="url(#jmbg' + id + ')" opacity=".55"/>' +
      (shape === "vessel" ? '<ellipse cx="50" cy="16.6" rx="12.6" ry="1.4" fill="none" stroke="var(--jm-glass-edge-2)" stroke-width=".7"/>'
                          : '<ellipse cx="50" cy="21.6" rx="17" ry="1.8" fill="none" stroke="var(--jm-glass-edge-2)" stroke-width=".8"/>'));
  }
  function glassFront(id, shape) {
    if (shape === "vessel") {
      var flutes = "";
      [35.5, 41, 46.5, 53.5, 59, 64.5].forEach(function (x, i) { /* vertical flutes: no rings, no ticks, no graduations */
        flutes += '<path d="M' + x + ',30 L' + x + ',110" stroke="#fff" stroke-opacity="' + (i === 0 ? 0.22 : i === 5 ? 0.12 : 0.07) + '" stroke-width=".6"/>'; });
      return svg("jm-front", defs(id) +
        '<path d="' + GEO.vessel.outer + '" fill="none" stroke="url(#jmr' + id + ')" stroke-width="1.4"/>' +
        '<path d="' + GEO.vessel.inner + '" fill="none" stroke="rgba(255,255,255,.08)" stroke-width=".6"/>' + flutes +
        '<path d="M32.6,34 C32.6,31 34.8,31 34.8,34 L34.8,106 C34.8,109 32.6,109 32.6,106 Z" fill="url(#jms' + id + ')"/>' +
        '<path d="M66.8,38 L66.8,100" stroke="#fff" stroke-opacity=".18" stroke-width="1" stroke-linecap="round"/>' +
        '<path d="M31.5,24.5 C33,21.6 35.5,20.4 37.2,19.2" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.1" stroke-linecap="round"/>' +
        '<path d="M33,121.4 C42,124.4 58,124.4 67,121.4" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".8" stroke-linecap="round"/>' +
        '<path d="M37,123.8 L63,123.8" stroke="url(#jmk' + id + ')" stroke-width=".9" stroke-linecap="round" opacity=".7"/>' +
        '<path d="M34.6,15 L65.4,15" stroke="url(#jmk' + id + ')" stroke-width=".8" stroke-linecap="round"/>');
    }
    return svg("jm-front", defs(id) +
      '<path d="' + GEO.jar.outer + '" fill="none" stroke="url(#jmr' + id + ')" stroke-width="1.7"/>' +
      '<path d="' + GEO.jar.inner + '" fill="none" stroke="rgba(255,255,255,.09)" stroke-width=".7"/>' +
      '<path d="M19.2,46 C19.2,42 22.6,42 22.6,46 L22.6,104 C22.6,108 19.2,108 19.2,104 Z" fill="url(#jms' + id + ')"/>' +
      '<rect x="25" y="50" width="1.1" height="44" rx=".55" fill="url(#jms' + id + ')" opacity=".75"/>' +
      '<path d="M80.4,52 L80.4,100" stroke="#fff" stroke-opacity=".20" stroke-width="1.3" stroke-linecap="round"/>' +
      '<path d="M17.6,35.5 C20.5,30.6 26,28.6 30.4,26.4" fill="none" stroke="#fff" stroke-opacity=".62" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M70.5,27 C75,28.8 79.6,31 82.2,35" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1" stroke-linecap="round"/>' +
      '<path d="M21,121.6 C34,125.6 66,125.6 79,121.6" fill="none" stroke="#fff" stroke-opacity=".30" stroke-width=".9" stroke-linecap="round"/>' +
      '<path d="M26,123.9 L74,123.9" stroke="url(#jmk' + id + ')" stroke-width="1" stroke-linecap="round" opacity=".7"/>' +
      '<rect x="28.5" y="14" width="43" height="6.4" rx="1.6" fill="url(#jml' + id + ')" stroke="var(--jm-glass-edge-2)" stroke-width=".7"/>' +
      '<path d="M27,14.3 L73,14.3" stroke="url(#jmk' + id + ')" stroke-width=".9" stroke-linecap="round"/>');
  }
  function lidSvg(id, shape) {
    if (shape === "vessel") /* sleek low cap: polished honey metal, fine bevel, no toy knob */
      return svg("jm-lid", defs(id) + '<rect x="33" y="5" width="34" height="7.6" rx="1.4" fill="url(#jmc' + id + ')"/>' +
        '<path d="M33.6,6.1 L66.4,6.1" stroke="#fff" stroke-opacity=".7" stroke-width=".55"/><path d="M33.4,11.6 L66.6,11.6" stroke="#000" stroke-opacity=".45" stroke-width=".6"/>' +
        '<rect x="34.4" y="12.4" width="31.2" height="2.6" rx=".5" fill="#140f09" stroke="var(--jm-glass-edge-2)" stroke-width=".4"/>');
    return svg("jm-lid", defs(id) + '<rect x="25" y="4.6" width="50" height="10" rx="3.2" fill="url(#jml' + id + ')" stroke="var(--jm-glass-edge)" stroke-opacity=".55" stroke-width=".9"/>' +
      '<path d="M28.6,6.4 L71.4,6.4" stroke="#fff" stroke-opacity=".72" stroke-width=".9" stroke-linecap="round"/>' +
      '<path d="M30.5,9.6 L33,9.6" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" stroke-linecap="round"/>');
  }
  api.glassBackSvg = glassBack; api.glassFrontSvg = glassFront; api.lidSvg = lidSvg;
  if (typeof document === "undefined") return api; /* Node: helpers only */

  /* ===== shared environment: one rAF, visibility + on-screen pause, adaptive fps ===== */
  var jars = [], rafId = 0, capFps = M.fps.max, costEma = 0;
  var mqReduce = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(mqReduce && mqReduce.matches); }
  function now() { return (global.performance && performance.now) ? performance.now() / 1000 : Date.now() / 1000; }
  var io = (typeof IntersectionObserver !== "undefined") ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { var j = e.target.__jm; if (j) { j.onscreen = e.isIntersecting; if (j.onscreen) j.render(true); } });
    schedule();
  }, { rootMargin: "96px" }) : null;
  var ro = (typeof ResizeObserver !== "undefined") ? new ResizeObserver(function (es) {
    es.forEach(function (e) { var j = e.target.__jm; if (j && j.alive) { var w = Math.min(e.target.offsetWidth, (e.target.offsetHeight || 1e9) / 1.28); if (Math.abs(w - j.cssW) > 0.5) { j.resize(); if (reduced()) j.freezeFrame(); else j.render(true); } } });
  }) : null;
  function wantsLoop(j) { return j.alive && j.onscreen && !document.hidden && !reduced(); }
  function schedule() {
    if (rafId) return;
    for (var i = 0; i < jars.length; i++) if (wantsLoop(jars[i])) { rafId = global.requestAnimationFrame(tick); return; }
  }
  function tick() {
    rafId = 0;
    var t = now(), any = false, a = global.performance ? performance.now() : 0, drew = 0;
    for (var i = 0; i < jars.length; i++) {
      var j = jars[i];
      if (!wantsLoop(j)) { j.last = 0; continue; }
      any = true;
      var minDt = Math.max(1 / capFps, j.idleDt());
      if (j.lastDraw && t - j.lastDraw < minDt - 0.004) continue;
      j.step(t); j.render(false, t); j.lastDraw = t; drew++;
    }
    if (global.performance && drew) { /* adaptive: if a whole jar pass gets expensive, every jar drops to 30 fps */
      costEma = costEma * 0.95 + (performance.now() - a) * 0.05;
      capFps = costEma > M.fps.adaptMs ? M.fps.low : (costEma < M.fps.adaptMs * 0.5 ? M.fps.max : capFps);
    }
    if (any) rafId = global.requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (rafId) { global.cancelAnimationFrame(rafId); rafId = 0; } }
    else { jars.forEach(function (j) { j.last = 0; }); schedule(); }
  });
  if (mqReduce) {
    var onRM = function () { jars.forEach(function (j) { j.freezeFrame(); }); schedule(); };
    if (mqReduce.addEventListener) mqReduce.addEventListener("change", onRM); else if (mqReduce.addListener) mqReduce.addListener(onRM);
  }

  /* ===== chrome sprites (pre-rendered; re-tinted only when quantized hunger changes) ===== */
  function bubbleSprite(c) {
    var S = 64, cv = document.createElement("canvas"); cv.width = cv.height = S;
    var x = cv.getContext("2d"), r = S * 0.5;
    var halo = x.createRadialGradient(r, r, r * 0.55, r, r, r); /* displacement halo: the metal darkens around the bubble */
    halo.addColorStop(0, rgba(c.deep, 0.55)); halo.addColorStop(1, rgba(c.deep, 0));
    x.fillStyle = halo; x.beginPath(); x.arc(r, r, r, 0, 7); x.fill();
    var R = r * 0.76, g = x.createRadialGradient(r - R * 0.32, r - R * 0.38, 0, r, r, R);
    g.addColorStop(0, rgba(c.spec, 1)); g.addColorStop(0.16, rgba(c.light, 1)); g.addColorStop(0.45, rgba(c.base, 1));
    g.addColorStop(0.78, rgba(c.shadow, 1)); g.addColorStop(0.93, rgba(c.deep, 1)); g.addColorStop(1, rgba(mix(c.base, c.light, 0.4), 1));
    x.fillStyle = g; x.beginPath(); x.arc(r, r, R, 0, 7); x.fill();
    x.fillStyle = rgba(c.spec, 0.95); x.beginPath(); x.ellipse(r - R * 0.35, r - R * 0.42, R * 0.2, R * 0.12, -0.6, 0, 7); x.fill();
    x.strokeStyle = rgba(c.light, 0.4); x.lineWidth = S * 0.025; x.beginPath(); x.arc(r, r, R * 0.8, 0.3, 1.6); x.stroke();
    return cv;
  }
  function blobSprite(c) {
    var S = 96, cv = document.createElement("canvas"); cv.width = cv.height = S;
    var x = cv.getContext("2d"), r = S / 2;
    var gl = x.createRadialGradient(r, r, r * 0.3, r, r, r); gl.addColorStop(0, rgba(c.glow, Math.min(1, c.glow[3] * 2.2))); gl.addColorStop(1, rgba(c.glow, 0));
    x.fillStyle = gl; x.fillRect(0, 0, S, S);
    var R = r * 0.42, g = x.createRadialGradient(r - R * 0.3, r - R * 0.4, 0, r, r, R);
    g.addColorStop(0, "#fff"); g.addColorStop(0.2, rgba(c.spec, 1)); g.addColorStop(0.5, rgba(c.light, 1)); g.addColorStop(0.85, rgba(c.base, 1)); g.addColorStop(1, rgba(c.shadow, 1));
    x.fillStyle = g; x.beginPath(); x.arc(r, r, R, 0, 7); x.fill();
    return cv;
  }

  /* ===== one jar ===== */
  function Jar(host, opts) {
    var id = ++uid;
    this.host = host;
    this.kid = KIDS[opts.kid] ? opts.kid : "family";
    this.status = this.kid === "ainsley" && opts.variant === "status";
    this.shape = this.status ? "vessel" : "jar";
    this.g = GEO[this.shape];
    this.p = Object.assign({}, PERSONALITY[this.kid] || PERSONALITY.family, opts.personality || {});
    this.onBoilOver = typeof opts.onBoilOver === "function" ? opts.onBoilOver : null;
    this.optsDpr = opts.dprMax;
    this.seed = (opts.seed >>> 0) || (0x9e3779b1 ^ Math.imul(id, 2654435761)) >>> 0;
    this.rand = rng(this.seed);
    var wrap = document.createElement("div");
    wrap.className = "jm" + (this.status ? " jm--status" : "");
    wrap.setAttribute("data-kid", this.kid);
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = '<div class="jm-stage"><div class="jm-glow"></div>' + glassBack(id, this.shape) + '<canvas class="jm-liquid"></canvas>' + glassFront(id, this.shape) +
      '<canvas class="jm-fx"></canvas>' + lidSvg(id, this.shape) + "</div>";
    host.classList.add("jm-host");
    host.appendChild(wrap);
    this.wrap = wrap;
    this.stage = wrap.querySelector(".jm-stage");
    this.glowEl = wrap.querySelector(".jm-glow");
    this.lidEl = wrap.querySelector(".jm-lid");
    this.lidEl.style.transformOrigin = this.g.lidOrigin;
    this.cv = wrap.querySelector(".jm-liquid"); this.ctx = this.cv.getContext("2d");
    this.fx = wrap.querySelector(".jm-fx"); this.fctx = this.fx.getContext("2d");
    this.clipInner = new Path2D(this.g.inner); this.clipOuter = new Path2D(this.g.outer);
    this.lineEl = null;
    if (this.status) { /* the one line of text in the whole kit; empty + hidden unless TRUSTED with a real reward */
      this.lineEl = document.createElement("p"); this.lineEl.className = "jm-line"; this.lineEl.hidden = true;
      host.appendChild(this.lineEl);
    }
    this.alive = true; this.onscreen = !io; this.cssW = 0; this.scale = 1; this.fscale = 1; this.k = 1; this.lk = 1;
    this.target = null; this.lv = 0; this.lvV = 0; this.pendingLevel = undefined; this.pendingRipple = false;
    this.binary = this.kid === "ainsley"; /* Alfred: Ainsley's hunger is BINARY (0 | 1) and never grades her glass */
    this.hunger = 0; this.cool = 0; this.hungerShown = -1; this.nudge = false; this.nudgeT0 = 0;
    this.perkV = 0; this.leanDir = 0; this.surge = 0; this.overAmt = 0; this.wasOver = false;
    this.tilt = 0; this.tiltV = 0; this.rings = []; this.pops = []; this.blob = null; this.lidAnim = null; this.nextRattle = 0;
    this.bubbles = []; this.spatter = []; this.streams = []; this.poolAmt = 0; this.spawnAcc = 0;
    this.t0 = now(); this.last = 0; this.lastDraw = 0; this.minDt = 0;
    if (this.status) this.setStateRaw(opts.state, opts.unlock); else this.target = normLevel(opts.level);
    if (opts.hunger != null) this.hungerRaw(opts.hunger);
    this.lv = this.target || 0;
    this.readColors();
    wrap.__jm = this;
    if (io) io.observe(wrap);
    if (ro) ro.observe(wrap);
    if (opts.perkOnTouch !== false) this.wirePerk();
    this.resize();
    this.freezeFrame(true);
  }
  var P = Jar.prototype;
  P.readColors = function () {
    var cs = global.getComputedStyle(this.wrap), c = {};
    ["base", "light", "shadow", "deep", "spec", "glow"].forEach(function (k) { c[k] = parseColor(cs.getPropertyValue("--jm-" + k), FALLBACK[k]); });
    this.col0 = c; this.hungerShown = -1; this.tint();
  };
  P.tint = function () { /* hunger: cooler, duller, a little desaturated; never red, never grey-dead (desat capped at 25%) */
    var h = Math.round(this.cool * 20) / 20;
    if (h === this.hungerShown) return;
    this.hungerShown = h;
    var c0 = this.col0, H = M.hunger, c = {};
    ["base", "light", "shadow", "deep", "spec"].forEach(function (k) { c[k] = desat(mix(c0[k], c0.deep, (k === "deep" ? 0 : H.dim) * h), H.desat * h); });
    c.spec = mix(c.spec, c.light, 0.35 * h);
    c.glow = c0.glow;
    this.col = c; this.grads = null;
    this.sprite = bubbleSprite(c); this.blobImg = blobSprite(c0);
  };
  P.hasLiquid = function () { return this.target !== null && (this.target > 0.001 || this.lv > 0.002); };
  P.resize = function () {
    /* layout size (no transforms). If the host stretches the box off 100:128, the stage fits inside it (contain, centred),
       so glass, liquid and fx never distort or drift apart. */
    var w0 = Math.max(1, this.wrap.offsetWidth || this.wrap.getBoundingClientRect().width), h0 = this.wrap.offsetHeight || w0 * 1.28;
    var w = Math.min(w0, h0 / 1.28), h = w * 1.28, sl = (w0 - w) / 2, st = (h0 - h) / 2;
    var key = w.toFixed(1) + "," + sl.toFixed(1) + "," + st.toFixed(1);
    if (key !== this._stageKey) {
      this._stageKey = key;
      var full = sl < 0.5 && st < 0.5;
      this.stage.style.cssText = full ? "" : "left:" + sl.toFixed(1) + "px;top:" + st.toFixed(1) + "px;width:" + w.toFixed(1) + "px;height:" + h.toFixed(1) + "px;right:auto;bottom:auto;";
      this.wrap.style.transformOrigin = full ? "" : "50% " + (st + h).toFixed(1) + "px";
    }
    var dev = global.devicePixelRatio || 1;
    var cap = this.optsDpr || ((w >= 180 && (global.innerWidth || 1000) <= 500) ? M.dprPhoneHero : M.dprMax);
    var dpr = Math.min(cap, dev);
    this.cssW = w; this.small = w < M.fps.smallPx; this.size = w >= 200 ? "hero" : w >= M.fps.smallPx ? "mid" : "small";
    this.k = Math.pow(M.ref / w, M.ampExp);   /* amplitudes in units: calm at hero, still readable at 60 px */
    this.lk = Math.pow(M.ref / w, 0.6);       /* line widths stay ~px-sized at any jar size */
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); this.scale = (w * dpr) / 100;
    this.fx.width = Math.round(w * FX.w / 100 * dpr); this.fx.height = Math.round(h * FX.h / 128 * dpr); this.fscale = (w * dpr) / 100;
    this.dpr = dpr;
    this.minDt = this.small ? 1 / M.fps.small : 0;
    this.maxBubbles = M.pool[this.size];
    this.grads = null;
  };
  P.wirePerk = function () {
    var self = this;
    var h = function (e) {
      var x = null;
      try { var r = self.wrap.getBoundingClientRect(); var px = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX; if (px != null) x = (px - (r.left + r.width / 2)) / Math.max(1, r.width / 2); } catch (er) { x = null; }
      self.perk(x);
    };
    this._perkH = h;
    ["pointerenter", "pointerdown", "touchstart"].forEach(function (ev) { self.host.addEventListener(ev, h, { passive: true }); });
  };

  /* ---------- public behaviours ---------- */
  P.setLevel = function (v, o) {
    if (this.status) return false; /* the status variant never takes a numeric level */
    var lv = normLevel(v);
    if (this.blob && !reduced()) { this.pendingLevel = lv; this.pendingRipple = !!(o && o.ripple); return true; } /* lands on impact */
    var rose = lv !== null && (this.target === null || lv > this.target + 1e-4);
    this.target = lv;
    if (lv === null) { this.lv = 0; this.lvV = 0; }
    if (o && o.ripple && rose && !reduced()) { this.ring(this.g.cx + (this.rand() - 0.5) * 14, 1); this.surge = Math.max(this.surge, 0.35); }
    if (reduced()) this.freezeFrame(); else { this.render(true); schedule(); }
    return true;
  };
  P.setStateRaw = function (state, unlock) {
    var u = typeof unlock === "string" ? unlock.trim() : "";
    var trusted = state === "trusted" && u.length > 0; /* TRUSTED needs a real reward string; anything else is EMPTY */
    this.target = trusted ? 1 : null;
    if (!trusted) { this.lv = 0; this.lvV = 0; }
    this.state = trusted ? "trusted" : "empty";
    this.wrap.setAttribute("data-state", this.state);
    if (this.lineEl) { this.lineEl.textContent = trusted ? "Trusted with: " + u : ""; this.lineEl.hidden = !trusted; }
  };
  P.setState = function (state, unlock) {
    if (!this.status) return false;
    this.setStateRaw(state, unlock);
    if (reduced()) this.freezeFrame(); else { this.render(true); schedule(); }
    return true;
  };
  P.hungerRaw = function (h) {
    h = Number(h); h = isFinite(h) ? clamp(h, 0, 1) : 0;
    if (this.binary) h = h > 0 ? 1 : 0;   /* Ainsley: anything > 0 is 1. Hungry = soft pulse + cap click, nothing graded */
    this.hunger = h;
    this.cool = this.binary ? 0 : h;      /* cooling (dull chrome, weaker boil, dim glow) is for the boys / family only */
  };
  P.setHunger = function (h) { this.hungerRaw(h); this.tint(); if (reduced()) this.freezeFrame(); else schedule(); return true; };
  P.setNudge = function (on) {
    on = !!on;
    if (on === this.nudge) return true;
    this.nudge = on;
    if (on) { this.nudgeT0 = now(); this.nextRattle = 0; }
    else if (!reduced() && !this.binary) { /* cleared on the close tap: boil back up HARD (not Ainsley: two states only) */
      this.surge = Math.max(this.surge, M.boil.burstSurge);
      if (this.hasLiquid()) this.burst(1.2); else this.ring(this.g.cx, 0.6);
    }
    if (reduced()) this.freezeFrame(); else schedule();
    return true;
  };
  P.feed = function () {
    if (!this.alive || reduced() || document.hidden) return false;
    var g = this.g;
    this.blob = { x: g.cx + (this.rand() - 0.5) * 4, y: -34, vy: 20, r: 5.5 * this.k + 1.5 };
    this.lidAnim = { kind: "open", t0: now() };
    schedule(); return true;
  };
  P.perk = function (x) {
    if (!this.alive || reduced()) return false;
    this.perkV = 1; this.leanDir = typeof x === "number" && isFinite(x) ? clamp(x, -1, 1) : (this.rand() < 0.5 ? -0.6 : 0.6);
    schedule(); return true;
  };
  P.splash = function () {
    if (!this.alive || reduced() || !this.hasLiquid() || document.hidden) return false;
    this.burst(1); this.tiltV += (this.rand() < 0.5 ? -1 : 1) * M.splash.tiltKick; this.surge = Math.max(this.surge, 0.6); schedule(); return true;
  };
  P.ring = function (x0, scale) { this.rings.push({ t0: this.simNow(), x0: x0, s: scale }); if (this.rings.length > 4) this.rings.shift(); };
  P.simNow = function () { return this._simT != null ? this._simT : now(); };
  P.burst = function (scale) {
    var S = M.splash, g = this.g, ys = this.surfaceBase();
    this.rings.push({ t0: this.simNow(), x0: g.cx + (this.rand() - 0.5) * 10, s: scale, crown: true }); if (this.rings.length > 4) this.rings.shift();
    for (var i = 0; i < Math.round(S.drops * scale * (0.5 + this.p.spatter)); i++)
      this.addSpatter(g.cx + (this.rand() - 0.5) * 12, ys - 1, (this.rand() - 0.5) * 34, -(44 + this.rand() * 36) * this.p.spatterV, 0.8 + this.rand() * 1.0);
  };
  P.freezeFrame = function (warm) {
    /* first paint (warm-up so a jar is already boiling when it appears) or reduced motion (deterministic frozen boil) */
    this.lv = this.target || 0; this.lvV = 0; this.tilt = 0; this.tiltV = 0; this.rings = []; this.pops = []; this.blob = null; this.lidAnim = null;
    this.surge = 0; this.perkV = 0; this.pendingLevel = undefined;
    var red = reduced();
    if (red || warm) {
      this.rand = rng(this.seed);
      this.bubbles = []; this.spatter = []; this.streams = []; this.overAmt = this.lv >= M.boil.overAt ? 1 : 0; this.poolAmt = 0; this.wasOver = this.overAmt > 0;
      var T = 0, dt = 1 / 30;
      for (var i = 0; i < 75; i++) { T += dt; this._simT = this.t0 + T; this.stepSim(dt, T, true); }
      this._simT = null;
      if (red) { this.frozenT = T; this.render(true, this.t0 + T); this.applyTransforms(this.t0 + T, true); return; }
      this.t0 = now() - T; this.frozenT = null; this.pops = []; this.rings = [];
    }
    this.render(true);
  };

  /* ---------- simulation ---------- */
  P.boilNow = function () { /* effective boil after hunger, nudge, surge, perk */
    var B = boilFor(this.lv > 0.002 ? this.lv : 0);
    if (!B) return 0;
    B *= 1 - M.boil.hungerCut * this.cool;
    if (this.nudge && !this.binary) B = Math.min(B, M.boil.nudgeSimmer);
    return B + this.surge + this.perkV * 0.25;
  };
  P.surfaceBase = function () { var g = this.g, y = g.floor - this.lv * (g.floor - g.top); return lerp(y, g.overTop, this.overAmt); };
  P.addSpatter = function (x, y, vx, vy, r) {
    if (this.spatter.length >= M.pool.spatter * (this.small ? 0.3 : 1)) return;
    this.spatter.push({ x: x, y: y, vx: vx, vy: vy, r: r * this.k });
  };
  P.step = function (t) {
    var dt = this.last ? clamp(t - this.last, 0, 0.05) : 1 / 60;
    this.last = t;
    this.stepSim(dt, t - this.t0, false);
  };
  P.stepSim = function (dt, T, frozen) {
    var g = this.g, p = this.p, self = this, tnow = this.t0 + T;
    /* level spring: a stepped, smooth rise per close tap */
    var L = M.level, wl = 2 * Math.PI / L.period, tgt = this.target || 0;
    if (frozen) this.lv = tgt; else { this.lvV += (-wl * wl * (this.lv - tgt) - 2 * L.zeta * wl * this.lvV) * dt; this.lv = clamp(this.lv + this.lvV * dt, 0, 1); }
    /* boil-over eases in at full */
    var full = this.target !== null && this.target >= M.boil.overAt && this.lv > 0.985;
    this.overAmt = frozen ? (full ? 1 : 0) : clamp(this.overAmt + (full ? dt / M.over.rise : -dt / 0.8), 0, 1);
    if (full && this.overAmt > 0.6 && !this.wasOver) {
      this.wasOver = true;
      if (this.onBoilOver && !frozen) setTimeout(function () { try { self.onBoilOver(self.handle); } catch (e) { /* caller's problem */ } }, 0);
    }
    if (!full && this.overAmt < 0.05) this.wasOver = false;
    /* decays */
    this.surge *= Math.exp(-dt / M.boil.surgeTau); if (this.surge < 0.005) this.surge = 0;
    this.perkV *= Math.exp(-dt / M.perk.tau); if (this.perkV < 0.01) this.perkV = 0;
    /* tilt spring (kicks) on top of the constant driven slosh */
    var ws = 2 * Math.PI / M.slosh.period;
    this.tiltV += (-ws * ws * this.tilt - 2 * M.slosh.zeta * ws * this.tiltV) * dt;
    this.tilt = clamp(this.tilt + this.tiltV * dt, -M.slosh.maxTilt, M.slosh.maxTilt);
    this.rings = this.rings.filter(function (s) { return tnow - s.t0 < M.ripple.dur + 0.4; });
    this.pops = this.pops.filter(function (q) { return tnow - q.t0 < 0.4; });
    /* feed blob */
    if (this.blob) {
      var b = this.blob; b.vy += M.feed.g * dt; b.y += b.vy * dt;
      if (b.y >= this.surfaceBase() - 1) {
        this.blob = null; this.surge = Math.max(this.surge, M.boil.feedSurge);
        if (this.pendingLevel !== undefined) { var pl = this.pendingLevel, pr = this.pendingRipple; this.pendingLevel = undefined; this.setLevel(pl, { ripple: pr }); }
        if (this.hasLiquid()) this.burst(0.9); else this.ring(g.cx, 0.6);
        this.lidAnim = { kind: "close", t0: tnow };
      }
    }
    if (!this.hasLiquid()) { this.bubbles.length = 0; this.streams.length = 0; this.poolAmt = Math.max(0, this.poolAmt - dt * 0.5); }
    var B0 = this.boilNow(); this.Bc = B0;
    /* bubbles spawn from the floor at a rate set by the boil curve x personality */
    if (B0 > 0) {
      var rate = (M.boil.rate0 + M.boil.rate1 * Math.min(B0, 1.6)) * p.rate * (1 + M.perk.rateBoost * this.perkV) * (this.small ? 0.45 : 1);
      this.spawnAcc += rate * dt;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        if (this.bubbles.length >= this.maxBubbles) { this.spawnAcc = 0; break; }
        var sizeMul = (0.6 + 0.7 * Math.min(B0, 1.4)) * Math.pow(M.ref / Math.max(60, this.cssW), 0.25);
        var r = lerp(p.rMin, p.rMax, Math.pow(this.rand(), p.sizeSkew)) * sizeMul;
        var span = (g.xr - g.xl - 2 * r - 2);
        this.bubbles.push({ x: g.xl + r + 1 + this.rand() * span, y: g.floor - r, r: r, vy: (16 + this.rand() * 14) * p.speed * (0.7 + 0.5 * Math.min(B0, 1.5)),
          ph: this.rand() * 6.28, dome: -1 });
      }
    } else this.spawnAcc = 0;
    this.bubbles = this.bubbles.filter(function (q) {
      if (q.dome >= 0) { q.dome += dt; if (q.dome > 0.1 + 0.12 / (1 + B0)) { self.pop(q, tnow, B0); return false; } return true; }
      q.vy *= 1 + 0.6 * dt; q.y -= q.vy * dt; q.x += Math.sin(T * 3.1 + q.ph) * 3 * p.wobble * dt * (q.r / 2);
      q.x = clamp(q.x, g.xl + q.r * 0.8, g.xr - q.r * 0.8);
      var sy = self.surf(q.x, T, false);
      if (q.y - q.r * 0.25 <= sy) { q.y = sy; q.dome = 0; }
      return true;
    });
    /* spatter beads: thrown above the meniscus, fall back in (or off the rim when boiling over) */
    this.spatter = this.spatter.filter(function (d) {
      d.vy += 260 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.vy > 0 && d.x > g.xl && d.x < g.xr && d.y > self.surf(d.x, T, false)) return false;
      return d.y < 140;
    });
    /* boil-over: rivulets down the outside glass + a pool at the base */
    var want = this.overAmt > 0.5 ? Math.round((this.small ? M.over.streamsSmall : this.size === "mid" ? M.over.streamsMid : M.over.streamsHero) * p.streams) : 0;
    while (this.streams.length < want) this.streams.push(this.newStream());
    for (var si = this.streams.length - 1; si >= 0; si--) {
      var st = this.streams[si];
      if (st.phase === 0) { st.len += st.v * dt * (1 - 0.6 * st.len / st.max); if (st.len >= st.max - 1) { st.phase = 1; st.hold = 0; } }
      else if (st.phase === 1) { st.hold += dt; if (st.hold > st.holdFor) st.phase = 2; }
      else { st.w *= Math.exp(-dt / 0.6); if (st.w < 0.15 * this.lk) { if (si >= want) this.streams.splice(si, 1); else this.streams[si] = this.newStream(); } }
    }
    this.poolAmt = clamp(this.poolAmt + (this.overAmt > 0.5 ? dt * 0.35 : -dt * 0.5), 0, 1);
    /* lid: hunger / nudge rattle (classic lid) or a subtle cap click (Ainsley); more often + harder when hungrier */
    var urge = this.binary ? (this.hunger || this.nudge ? 0.5 : 0) : Math.max(this.hunger, this.nudge ? 0.7 : 0);
    if (urge > 0.12 && !this.lidAnim && this.overAmt < 0.3 && !frozen) {
      if (!this.nextRattle) this.nextRattle = tnow + 0.6 + this.rand();
      if (tnow >= this.nextRattle) {
        this.lidAnim = { kind: p.capClick ? "click" : "rattle", t0: tnow, amp: lerp(M.hunger.rattleDeg[0], M.hunger.rattleDeg[1], urge) * p.rattle };
        this.nextRattle = tnow + lerp(M.hunger.rattleEvery[0], M.hunger.rattleEvery[1], urge) * (0.8 + 0.4 * this.rand());
      }
    }
  };
  P.newStream = function () {
    var g = this.g, hw0 = g.hw(g.rimY), edge = this.rand() < 0.3, side = this.rand() < 0.5 ? -1 : 1;
    var x0 = edge ? g.cx + side * hw0 * 0.97 : g.cx + side * (0.25 + 0.7 * this.rand()) * hw0;
    var max = edge ? g.bottom - g.rimY - 8 : 10 + this.rand() * (g.bottom - g.rimY) * 0.5;
    return { x0: x0, len: 0, max: max, v: 16 + this.rand() * 18, w: (2.0 + this.rand() * 1.5) * this.p.streamW * this.lk, phase: 0, hold: 0,
             holdFor: 0.6 + this.rand() * 1.8, ph: this.rand() * 6.28, edge: edge };
  };
  P.pop = function (q, tnow, B) {
    this.pops.push({ x: q.x, t0: tnow, a: q.r * 0.7 }); if (this.pops.length > 10) this.pops.shift();
    var l = this.lv, sp = l >= M.boil.spatterAt ? 0.3 + 0.7 * (l - M.boil.spatterAt) / (1 - M.boil.spatterAt) : 0;
    sp = Math.min(1, sp * this.p.spatter * (0.4 + 0.6 * Math.min(B, 1.5)));
    if (this.small) sp *= 0.3;
    if (this.rand() < sp) {
      var n = 1 + Math.round(this.rand() * 2 * this.p.spatter);
      for (var i = 0; i < n; i++) this.addSpatter(q.x, q.y - q.r * 0.5, (this.rand() - 0.5) * 26, -(26 + this.rand() * 36) * this.p.spatterV * (0.7 + 0.3 * B), 0.45 + this.rand() * 0.7 * (q.r / 2));
    }
  };
  P.surf = function (x, T, back) {
    var g = this.g, k = this.k, p = this.p, W = g.xr - g.xl, y = this.surfaceBase(), i, w;
    var ph = back ? 0.9 : 0, B = this.Bc || 0;
    for (i = 0; i < M.waves.length; i++) { w = M.waves[i]; y += w.a * k * p.slosh * Math.sin(2 * Math.PI * ((x - g.xl) / (w.lambda * W)) - w.dir * 2 * Math.PI * T / w.period + w.ph + ph); }
    var tl = M.slosh.a1 * Math.sin(2 * Math.PI * T / M.slosh.p1) + M.slosh.a2 * Math.sin(2 * Math.PI * T / M.slosh.p2 + 1.1);
    y += (tl * k * p.slosh + this.tilt) * (x - g.cx) * (back ? 0.85 : 1);
    if (B > 0) { /* churn: a rolling surface, faster and rougher as the boil builds */
      var R = (M.boil.rough0 + M.boil.rough1 * Math.min(B, 1.6)) * p.rough * k;
      for (i = 0; i < M.boilWaves.length; i++) { w = M.boilWaves[i]; y += R * (0.55 - i * 0.12) * Math.sin(2 * Math.PI * ((x - g.xl) / (w.lambda * W)) + (i % 2 ? 1 : -1) * 2 * Math.PI * T / w.period + i * 2.3 + ph * 1.7); }
    }
    var tn = this.t0 + T, j;
    for (j = 0; j < this.pops.length; j++) { var q = this.pops[j], tau = tn - q.t0; if (tau < 0) continue; y += -q.a * Math.exp(-Math.pow((x - q.x) / (q.a * 1.6 + 0.8), 2)) * Math.exp(-tau / 0.16) * Math.cos(tau * 22); }
    for (j = 0; j < this.rings.length; j++) {
      var s = this.rings[j], ta = tn - s.t0; if (ta < 0) continue;
      var d = Math.abs(x - s.x0), front = M.ripple.speed * ta, A = (s.crown ? M.splash.amp : M.ripple.amp) * s.s * k;
      if (s.crown && ta < M.splash.crownT) y -= M.splash.crown * s.s * k * Math.exp(-Math.pow((x - s.x0) / M.splash.crownW, 2)) * Math.sin(Math.PI * ta / M.splash.crownT);
      if (d > front) continue;
      y += A * Math.exp(-ta / M.ripple.decay) * Math.exp(-d / 28) * Math.cos(M.ripple.k * d - M.ripple.k * front);
    }
    var dw = Math.min(x - g.xl, g.xr - x), mr = M.meniscus.reach;
    if (dw < mr) { var qq = 1 - dw / mr; y += M.meniscus.droop * Math.pow(k, 0.5) * qq * qq; } /* convex mercury meniscus: droops at the glass */
    return Math.max(y, this.overAmt > 0 ? g.overTop - 4 : g.top - 6);
  };

  /* ---------- drawing ---------- */
  P.buildGrads = function (ctx) {
    var c = this.col, g = this.g, gr = {}, small = this.small;
    var h = ctx.createLinearGradient(g.xl, 0, g.xr, 0);
    [[0.00, c.deep], [0.04, c.shadow], [0.10, c.base], [0.17, c.light], [0.205, c.spec], [0.235, c.spec],
     [0.26, c.light], [0.31, c.base], [0.40, small ? mix(c.shadow, c.base, 0.5) : c.shadow], [0.47, small ? mix(c.shadow, c.base, 0.3) : mix(c.deep, c.shadow, 0.35)],
     [0.55, small ? mix(c.shadow, c.base, 0.5) : c.shadow], [0.64, c.base], [0.74, mix(c.base, c.light, 0.5)], [0.80, c.light], [0.86, c.base], [0.93, c.shadow], [1.00, c.deep]]
      .forEach(function (st) { h.addColorStop(st[0], rgba(st[1], 1)); });
    gr.body = h;
    var tf = ctx.createLinearGradient(g.xl, 0, g.xr, 0);
    [[0, c.deep], [0.10, c.shadow], [0.24, c.base], [0.32, c.light], [0.46, c.base], [0.70, c.shadow], [0.88, c.base], [1, c.deep]].forEach(function (s) { tf.addColorStop(s[0], rgba(s[1], 1)); });
    gr.top = tf;
    this.grads = gr;
  };
  P.render = function (force, t) {
    if (!this.alive) return;
    if (t == null) t = reduced() && this.frozenT != null ? this.t0 + this.frozenT : now();
    var T = t - this.t0, liquid = this.hasLiquid();
    var gP = M.shimmer.glassPeriod, gPh = (T % gP) / gP, sweeping = gPh < M.shimmer.glassSweep / gP + 0.02;
    var busy = liquid || this.blob || this.spatter.length || this.rings.length || this.streams.length || this.poolAmt > 0;
    /* EMPTY glass skips the paint while nothing visible changes (between glint sweeps; transforms still run) */
    if (!force && !busy && !sweeping && !this.glintWas) { this.applyTransforms(t); return; }
    this.glintWas = sweeping;
    var fill = liquid ? "liquid" : "empty"; if (fill !== this._fill) { this.wrap.setAttribute("data-fill", fill); this._fill = fill; }
    this.drawLiquid(T, liquid, gPh);
    var fxBusy = !!(this.blob || this.spatter.length || this.overAmt > 0.02 || this.poolAmt > 0.01);
    if (fxBusy || this.fxWas || force) { this.drawFx(T); this.fxWas = fxBusy; }
    this.applyTransforms(t);
  };
  P.drawLiquid = function (T, liquid, gPh) {
    var ctx = this.ctx, s = this.scale, c = this.col, g = this.g, lk = this.lk, i;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    if (!liquid) { this.drawGlint(ctx, gPh); return; }
    if (!this.grads) this.buildGrads(ctx);
    var gr = this.grads;
    ctx.save(); ctx.clip(this.clipInner);
    var W = g.xr - g.xl, N = Math.max(24, Math.min(72, Math.round(this.cssW / 4))), half = W / 2;
    var xs = [], yf = [], yb = [], x;
    var tf = (this.small ? M.topFaceSmall : M.topFace) * (this.status ? 0.7 : 1);
    for (i = 0; i <= N; i++) {
      x = g.xl - 0.5 + (W + 1) * i / N; xs.push(x);
      var f = this.surf(x, T, false), e = tf * Math.sqrt(Math.max(0, 1 - Math.pow((x - g.cx) / (half + 0.5), 2)));
      yf.push(f); yb.push(Math.min(f, this.surf(x, T, true) - e));
    }
    var ys = this.surfaceBase(), depth = Math.max(4, g.floor - ys);
    var path = function (arr, off) { ctx.beginPath(); for (var q = 0; q <= N; q++) ctx[q ? "lineTo" : "moveTo"](xs[q], arr[q] + (off || 0)); };
    var body = function () { path(yf); ctx.lineTo(g.xr + 2, 128); ctx.lineTo(g.xl - 2, 128); ctx.closePath(); };
    /* 1 body: hard-banded cylindrical chrome roll */
    body(); ctx.fillStyle = gr.body; ctx.fill();
    /* 2 vertical environment: bright sky under the surface, dark floor */
    var v = ctx.createLinearGradient(0, ys, 0, ys + depth);
    v.addColorStop(0, rgba(c.spec, 0.5)); v.addColorStop(0.05, rgba(c.light, 0.1)); v.addColorStop(0.16, rgba(c.deep, 0)); v.addColorStop(0.55, rgba(c.deep, 0));
    v.addColorStop(0.8, rgba(c.deep, 0.35)); v.addColorStop(1, rgba(c.deep, 0.8)); ctx.fillStyle = v; ctx.fill();
    /* 2b reflected horizon riding the waves (feathered, bowed) */
    var hk = Math.min(depth * 0.24, 13), hw = Math.max(1.2, Math.min(depth * 0.07, 4.2)), bow = Math.min(depth * 0.10, 5);
    if (depth > 7) {
      ctx.beginPath();
      for (i = 0; i <= N; i++) { var bq = Math.sqrt(Math.max(0, 1 - Math.pow((xs[i] - g.cx) / (half + 0.5), 2))); ctx[i ? "lineTo" : "moveTo"](xs[i], yf[i] + hk + bow * bq); }
      ctx.lineJoin = "round";
      ctx.strokeStyle = rgba(c.deep, 0.16); ctx.lineWidth = hw * 2.6; ctx.stroke();
      ctx.strokeStyle = rgba(c.deep, 0.22); ctx.lineWidth = hw * 1.6; ctx.stroke();
      ctx.strokeStyle = rgba(c.deep, 0.30); ctx.lineWidth = hw * 0.8; ctx.stroke();
    }
    /* 3 bubbles rising inside the metal: chrome spheres in the kid's color with a displacement halo */
    var spr = this.sprite;
    for (i = 0; i < this.bubbles.length; i++) { /* opaque metal: a bubble shows faintly deep down, fully as it nears the surface */
      var q = this.bubbles[i]; if (q.dome >= 0) continue; var R = q.r * 1.32; ctx.globalAlpha = clamp(1.15 - (q.y - ys) / 34, 0.18, 1); ctx.drawImage(spr, q.x - R, q.y - R, 2 * R, 2 * R); }
    ctx.globalAlpha = 1;
    /* 4 specular window bars + a slow specular band sweeping across (constant shimmer) */
    var sh = this.tilt * 40, B = this.Bc || 0;
    var st = ctx.createLinearGradient(0, ys, 0, ys + depth);
    st.addColorStop(0, rgba(c.spec, 0.95)); st.addColorStop(0.16, rgba(c.spec, 0.75)); st.addColorStop(0.22, rgba(c.spec, 0.1)); st.addColorStop(0.3, rgba(c.spec, 0.1));
    st.addColorStop(0.36, rgba(c.spec, 0.55)); st.addColorStop(0.85, rgba(c.spec, 0.12)); st.addColorStop(1, rgba(c.spec, 0));
    ctx.fillStyle = st;
    var bar = function (x0, w, a, inset) { var ii = Math.max(0, Math.min(N, Math.round((x0 - g.xl) / (W + 1) * N))); ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x0, yf[ii] + 1.2); ctx.lineTo(x0 + w, yf[ii] + 1.2); ctx.lineTo(x0 + w * 0.8, g.floor - inset); ctx.lineTo(x0 + w * 0.2, g.floor - inset); ctx.closePath(); ctx.fill(); };
    var bx = g.xl + W * 0.19 + sh; bar(bx, W * 0.027, 1, 3); bar(bx + W * 0.043, W * 0.012, 0.7, 4); bar(g.xl + W * 0.82 + sh, W * 0.016, 0.42, 6);
    ctx.globalAlpha = 1;
    var swp = ((T % M.shimmer.liquidPeriod) / M.shimmer.liquidPeriod) * 1.6 - 0.3, sxw = g.xl + W * swp;
    var band = ctx.createLinearGradient(sxw - W * 0.12, 0, sxw + W * 0.12, 0);
    band.addColorStop(0, rgba(c.spec, 0)); band.addColorStop(0.5, rgba(c.spec, 0.24)); band.addColorStop(1, rgba(c.spec, 0));
    ctx.fillStyle = band; body(); ctx.fill();
    /* 5 rolled lip shadow, top face, Fresnel, back meniscus, front lip */
    path(yf, 1.1); ctx.strokeStyle = rgba(c.shadow, 0.55); ctx.lineWidth = 1.5 * lk; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xs[0], yf[0]); for (i = 1; i <= N; i++) ctx.lineTo(xs[i], yf[i]); for (i = N; i >= 0; i--) ctx.lineTo(xs[i], yb[i]); ctx.closePath();
    ctx.fillStyle = gr.top; ctx.fill();
    var fr = ctx.createLinearGradient(0, ys - tf - 1, 0, ys + 1.5); fr.addColorStop(0, rgba(c.light, 0)); fr.addColorStop(0.65, rgba(c.light, 0.35)); fr.addColorStop(1, rgba(c.spec, 0.75));
    ctx.fillStyle = fr; ctx.fill();
    path(yb); ctx.strokeStyle = rgba(c.shadow, 0.45); ctx.lineWidth = 0.5 * lk; ctx.stroke();
    path(yf); ctx.strokeStyle = rgba(c.spec, Math.min(1, 0.8 + 0.2 * Math.min(1, B))); ctx.lineWidth = 0.6 * lk; ctx.stroke();
    /* 6 domes: bubbles breaking through the surface */
    for (i = 0; i < this.bubbles.length; i++) {
      var d = this.bubbles[i]; if (d.dome < 0) continue;
      var rr = d.r * (1 - d.dome * 1.5), Rd = rr * 1.32; if (rr <= 0.2) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(d.x - Rd, d.y - Rd - 2, Rd * 2, Rd + 2 + rr * 0.15); ctx.clip();
      ctx.drawImage(spr, d.x - Rd, d.y - Rd * 0.75, 2 * Rd, 2 * Rd); ctx.restore();
    }
    /* 7 travelling glint on the top face */
    var gx = g.cx - W * 0.12 + Math.sin(2 * Math.PI * T / 9) * W * 0.18, gi = Math.max(0, Math.min(N, Math.round((gx - g.xl) / (W + 1) * N))), gy = (yf[gi] + yb[gi]) / 2;
    var gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, 5); gl.addColorStop(0, rgba(c.spec, 0.9)); gl.addColorStop(1, rgba(c.spec, 0));
    ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(gx, gy, 5, 1.4, 0, 0, 7); ctx.fill();
    ctx.restore();
    this.drawGlint(ctx, gPh);
  };
  P.drawGlint = function (ctx, gPh) { /* glass glint sweep (every jar, EMPTY included): a diagonal band of light crossing the glass */
    var sw = gPh / (M.shimmer.glassSweep / M.shimmer.glassPeriod);
    if (sw > 1.05) return;
    ctx.save(); ctx.clip(this.clipOuter);
    var gx = -14 + sw * 128, gg = ctx.createLinearGradient(gx - 7, 6, gx + 7, -4), ga = 0.10 + 0.06 * (1 - this.cool);
    gg.addColorStop(0, "rgba(255,255,255,0)"); gg.addColorStop(0.45, "rgba(255,255,255," + (ga * 0.6).toFixed(3) + ")"); gg.addColorStop(0.5, "rgba(255,255,255," + ga.toFixed(3) + ")"); gg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gg; ctx.fillRect(0, 0, 100, 128); ctx.restore();
  };
  P.drawFx = function (T) {
    var ctx = this.fctx, s = this.fscale, c = this.col, g = this.g, lk = this.lk, i;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.fx.width, this.fx.height);
    ctx.setTransform(s, 0, 0, s, -FX.l * s, -FX.t * s);
    /* base pool (boil-over) */
    if (this.poolAmt > 0.01) {
      var pr = M.over.poolRx * (this.status ? 0.62 : 1) * (0.55 + 0.45 * this.poolAmt), py = g.bottom + 0.6;
      var pg = ctx.createLinearGradient(g.cx - pr, 0, g.cx + pr, 0);
      pg.addColorStop(0, rgba(c.deep, 0)); pg.addColorStop(0.12, rgba(c.shadow, 0.9)); pg.addColorStop(0.3, rgba(c.light, 1)); pg.addColorStop(0.36, rgba(c.spec, 1));
      pg.addColorStop(0.5, rgba(c.base, 1)); pg.addColorStop(0.75, rgba(c.shadow, 1)); pg.addColorStop(0.88, rgba(c.base, 0.9)); pg.addColorStop(1, rgba(c.deep, 0));
      ctx.globalAlpha = Math.min(1, this.poolAmt * 1.6);
      ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(g.cx, py, pr, (2.4 * this.poolAmt + 0.8), 0, 0, 7); ctx.fill();
      ctx.strokeStyle = rgba(c.spec, 0.7); ctx.lineWidth = 0.4 * lk; ctx.beginPath(); ctx.ellipse(g.cx - pr * 0.1, py - 0.5, pr * 0.7, 1.2 * this.poolAmt + 0.3, 0, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    /* overflow: a chrome sheet spilling over the lip and down the shoulder + glossy rivulets down the outside */
    if (this.overAmt > 0.02) {
      var oa = this.overAmt, ry = g.rimY, sl = (this.status ? 6 : 8.5 + 2 * Math.sin(T * 1.3)) * oa, NS = 22, u, yb2, pts2 = [];
      var bulge = ctx.createLinearGradient(g.cx - g.hw(ry + sl) - 2, 0, g.cx + g.hw(ry + sl) + 2, 0);
      [[0, c.deep], [0.08, c.shadow], [0.2, c.light], [0.25, c.spec], [0.31, c.base], [0.5, c.shadow], [0.58, mix(c.deep, c.shadow, 0.4)], [0.72, c.base], [0.8, c.light], [0.9, c.shadow], [1, c.deep]].forEach(function (q) { bulge.addColorStop(q[0], rgba(q[1], 1)); });
      for (i = 0; i <= NS; i++) { u = -1 + 2 * i / NS; yb2 = ry + sl * (0.75 + 0.25 * Math.cos(u * 1.4)) + 1.6 * oa * Math.sin(u * 7.3 + T * 1.7) * this.p.rough; pts2.push([g.cx + u * (g.hw(yb2) + 0.9), yb2]); }
      for (i = 0; i < this.streams.length; i++) this.drawStream(ctx, this.streams[i], T, ry + sl * 0.6);
      ctx.fillStyle = bulge; ctx.beginPath();
      var crown = 1.6 + 0.8 * Math.sin(T * 5.2) * this.p.rough;
      ctx.moveTo(pts2[0][0], pts2[0][1]); ctx.lineTo(g.cx - g.hw(ry) - 0.9, ry - 0.4);
      ctx.bezierCurveTo(g.cx - g.hw(ry) * 0.5, ry - 0.4 - crown * oa * 1.6, g.cx + g.hw(ry) * 0.5, ry - 0.4 - crown * oa * 1.6, g.cx + g.hw(ry) + 0.9, ry - 0.4);
      for (i = NS; i >= 0; i--) ctx.lineTo(pts2[i][0], pts2[i][1]);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(c.spec, 0.9 * oa); ctx.lineWidth = 0.6 * lk; ctx.beginPath();
      ctx.moveTo(g.cx - g.hw(ry) * 0.85, ry - 0.2 - crown * oa * 0.6); ctx.quadraticCurveTo(g.cx - g.hw(ry) * 0.2, ry - 0.6 - crown * oa * 1.25, g.cx + g.hw(ry) * 0.25, ry - 0.5 - crown * oa * 1.1); ctx.stroke();
      ctx.strokeStyle = rgba(c.deep, 0.55 * oa); ctx.lineWidth = 0.8 * lk; ctx.beginPath();
      for (i = 0; i <= NS; i++) ctx[i ? "lineTo" : "moveTo"](pts2[i][0], pts2[i][1] - 0.3); ctx.stroke();
    }
    /* spatter beads above the meniscus */
    var spr = this.sprite;
    for (i = 0; i < this.spatter.length; i++) { var d = this.spatter[i], R = d.r * 1.32; ctx.drawImage(spr, d.x - R, d.y - R, 2 * R, 2 * R); }
    /* feed blob: a glowing chrome drop in the kid's color, falling in through the open lid */
    if (this.blob) { var b = this.blob, br = b.r * 2.3, st = 1 + Math.min(0.35, b.vy / 900); ctx.drawImage(this.blobImg, b.x - br / st, b.y - br * st, 2 * br / st, 2 * br * st); }
  };
  P.drawStream = function (ctx, st, T, y0) {
    var g = this.g, c = this.col, hw0 = g.hw(g.rimY), n = Math.max(4, Math.round(st.len / 2.5)), pts = [], i;
    for (i = 0; i <= n; i++) {
      var y = y0 + st.len * i / n, hwy = g.hw(Math.min(y, g.bottom - 1));
      var x = g.cx + (st.x0 - g.cx) * hwy / hw0 + (st.edge ? 0 : Math.sin(y * 0.14 + st.ph) * 0.6);
      if (st.edge) x += (st.x0 > g.cx ? 0.7 : -0.7);
      pts.push([x, y]);
    }
    var line = function (dx) { ctx.beginPath(); for (var q = 0; q < pts.length; q++) ctx[q ? "lineTo" : "moveTo"](pts[q][0] + (dx || 0), pts[q][1]); };
    var w = st.w * (0.85 + 0.15 * Math.sin(T * 3 + st.ph)), half = Math.max(1, Math.floor(pts.length * 0.45));
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    var seg = function (from, to, ww) { /* thick near the lip, thinning toward the bead */
      var dx = function (dd, col, lw) { ctx.beginPath(); for (var q = from; q <= to; q++) ctx[q > from ? "lineTo" : "moveTo"](pts[q][0] + dd, pts[q][1]); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); };
      dx(0, rgba(c.deep, 0.9), ww * 1.3); dx(0, rgba(c.base, 1), ww); dx(-ww * 0.14, rgba(c.light, 0.95), ww * 0.42); dx(-ww * 0.26, rgba(c.spec, 1), ww * 0.15);
    };
    seg(0, half, w * 1.15); seg(half, pts.length - 1, w * 0.8);
    var hd = pts[pts.length - 1], hr = w * (0.62 + 0.3 * Math.min(1, st.len / 30)) * (st.phase === 2 ? 0.6 : 1);
    if (hr > 0.2) ctx.drawImage(this.sprite, hd[0] - hr * 1.32, hd[1] - hr * 1.2, hr * 2.64, hr * 2.64);
  };
  P.applyTransforms = function (t, frozen) {
    var p = this.p, T = t - this.t0, wrapT = "", lidT = "", glow = (1 - M.hunger.glowCut * this.cool) * (this.hasLiquid() ? 1 : this.nudge ? 0.9 : this.hunger > 0.12 ? 0.5 : 0.3), still = reduced() || frozen;
    if (!still) {
      var ty = 0, sx = 1, sy = 1, rot = 0;
      if (this.nudge) { /* hungry hop: squash, stretch + lift, land squash (Harris: a goofy double hop) */
        var ht = ((t - this.nudgeT0) % M.nudge.hopEvery), hd = M.nudge.hopDur;
        for (var hp = 0; hp < p.hops; hp++) {
          var u = (ht - hp * hd * 0.85) / hd;
          if (u < 0 || u > 1) continue;
          var hh = 6 * p.hopH * (hp ? 0.6 : 1), sq = p.hopSquash;
          if (u < 0.18) { var a = u / 0.18; sy = 1 - sq * a; sx = 1 + sq * 0.7 * a; }
          else if (u < 0.6) { var b2 = Math.sin(Math.PI * (u - 0.18) / 0.42); ty = -hh * b2; sy = 1 + sq * 0.6 * b2; sx = 1 - sq * 0.35 * b2; }
          else if (u < 0.78) { var c3 = Math.sin(Math.PI * (u - 0.6) / 0.18); sy = 1 - sq * 0.7 * c3; sx = 1 + sq * 0.5 * c3; }
        }
        glow *= 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t - this.nudgeT0) / M.nudge.glowPeriod));
      } else if (this.hunger > 0.12 && (this.binary || !this.hasLiquid())) { /* hungry EMPTY glass (or Ainsley hungry, either state): a soft pulse */
        glow *= 0.75 + 0.25 * Math.sin(2 * Math.PI * T / 2.4);
      }
      if (this.perkV > 0) { rot += this.leanDir * M.perk.leanDeg * p.lean * this.perkV; ty -= M.perk.hop * this.perkV * 2 * Math.abs(Math.sin(Math.PI * this.perkV)); glow += 0.3 * this.perkV; }
      glow += 0.35 * Math.min(1, this.surge);
      if (ty || sx !== 1 || sy !== 1 || rot) wrapT = "translateY(" + (ty * this.cssW / 100).toFixed(2) + "px) rotate(" + rot.toFixed(2) + "deg) scale(" + sx.toFixed(3) + "," + sy.toFixed(3) + ")";
      var la = this.lidAnim, lt = 0, lrot = 0;
      if (la) {
        var e = t - la.t0;
        if (la.kind === "rattle") { if (e > M.hunger.rattleDur) this.lidAnim = null; else { var f = e / M.hunger.rattleDur; lrot = la.amp * Math.sin(f * Math.PI * 10) * (1 - f); lt = -1.4 * Math.abs(Math.sin(f * Math.PI * 5)) * (1 - f) * (la.amp / 3); } }
        else if (la.kind === "click") { if (e > 0.34) this.lidAnim = null; else { lrot = e < 0.12 ? -la.amp * 0.5 * (e / 0.12) : -la.amp * 0.5 * Math.max(0, 1 - (e - 0.12) / 0.1); lt = e < 0.22 ? -0.7 : 0; } }
        else if (la.kind === "open") { var o = Math.min(1, e / 0.2); lrot = M.feed.lidOpenDeg * o; lt = -3 * o; if (this.lidEl.style.transformOrigin !== this.g.hinge) this.lidEl.style.transformOrigin = this.g.hinge; if (e > 2.5) la.kind = "close", la.t0 = t; }
        else if (la.kind === "close") { var cl = Math.min(1, e / 0.26); lrot = M.feed.lidOpenDeg * (1 - cl); lt = -3 * (1 - cl); if (cl >= 1) lrot += 2.2 * Math.sin((e - 0.26) * 45) * Math.max(0, 0.46 - e) * 5; if (e > 0.46) { this.lidAnim = null; this.lidEl.style.transformOrigin = this.g.lidOrigin; } }
      }
      if (this.overAmt > 0.02 && (!la || la.kind === "rattle" || la.kind === "click")) { /* the boil lifts and rocks the lid */
        lt += -(2.6 + 1.3 * Math.sin(T * 6.1)) * this.overAmt * (this.status ? 0.45 : 1);
        lrot += (this.status ? 1.0 : 3.2) * Math.sin(T * 1.7) * this.overAmt;
      }
      if (lt || lrot) lidT = "translateY(" + (lt * this.cssW / 100).toFixed(2) + "px) rotate(" + lrot.toFixed(2) + "deg)";
      if (this.overAmt > 0.5) glow += 0.25 + 0.15 * Math.sin(T * 2.4);
    } else {
      if (this.nudge) glow *= 0.85;                 /* reduced motion: a static glow, no hop, no rattle */
      if (this.overAmt > 0.5) { glow += 0.25; lidT = "translateY(" + (-2.6 * this.overAmt * (this.status ? 0.45 : 1) * this.cssW / 100).toFixed(2) + "px)"; }
    }
    if (wrapT !== this._wT) { this.wrap.style.transform = wrapT; this._wT = wrapT; }
    if (lidT !== this._lT) { this.lidEl.style.transform = lidT; this._lT = lidT; }
    var go = clamp(glow, 0, 1.6).toFixed(2); if (go !== this._gO) { this.glowEl.style.opacity = go; this._gO = go; }
    var gs = (p.glowR * (this.overAmt > 0.5 ? 1.25 : 1)).toFixed(2); if (gs !== this._gS) { this.glowEl.style.transform = "scale(" + gs + ")"; this._gS = gs; }
  };
  P.idleDt = function () { /* EMPTY glass with nothing to animate runs at 24 fps (glint sweep + transforms only) */
    if (this.hasLiquid() || this.nudge || this.lidAnim || this.perkV || this.blob || this.spatter.length || this.rings.length || this.poolAmt > 0) return this.minDt;
    return Math.max(this.minDt, 1 / 24);
  };
  P.destroy = function () {
    this.alive = false;
    if (io) io.unobserve(this.wrap);
    if (ro) ro.unobserve(this.wrap);
    var self = this;
    if (this._perkH) ["pointerenter", "pointerdown", "touchstart"].forEach(function (ev) { self.host.removeEventListener(ev, self._perkH); });
    if (this.wrap.parentNode) this.wrap.parentNode.removeChild(this.wrap);
    if (this.lineEl && this.lineEl.parentNode) this.lineEl.parentNode.removeChild(this.lineEl);
    this.host.classList.remove("jm-host");
    var i = jars.indexOf(this); if (i >= 0) jars.splice(i, 1);
  };

  function mount(el, opts) {
    if (!el) return null;
    opts = opts || {};
    for (var q = jars.length - 1; q >= 0; q--) if (!jars[q].wrap.isConnected) jars[q].destroy(); /* host re-rendered: drop orphans */
    var prev = el.querySelector(":scope > .jm");
    if (prev && prev.__jm) { var pj = prev.__jm; if (pj.status) pj.setState(opts.state, opts.unlock); else pj.setLevel(opts.level); return pj.handle; }
    var j = new Jar(el, opts);
    jars.push(j);
    j.handle = {
      el: j.wrap, kid: j.kid, variant: j.status ? "status" : "jar",
      setLevel: function (v, o) { return j.setLevel(v, o); },
      setState: function (s, u) { return j.setState(s, u); },
      setHunger: function (h) { return j.setHunger(h); },
      setNudge: function (on) { return j.setNudge(on); },
      feed: function () { return j.feed(); },
      perk: function (x) { return j.perk(x); },
      splash: function () { return j.splash(); },
      level: function () { return j.status ? null : j.target; },
      state: function () { return j.status ? j.state : null; },
      refreshColors: function () { j.readColors(); j.render(true); },
      crystallize: function () { return false; }, /* RESERVED (Phase 5 weekly memory crystals): not built, a no-op today */
      destroy: function () { j.destroy(); },
      _jar: j
    };
    schedule();
    return j.handle;
  }
  function splashAll(target) { var n = 0; jars.forEach(function (j) { if (target == null || target === j.kid || target === j.host || target === j.wrap) { if (j.splash()) n++; } }); return n; }

  /* ===== board light spill (a full boil-over floods the kid's board with their color; ~3.4 s, WAAPI, no layout) ===== */
  function kidColor(kidOrColor, key) {
    if (KIDS[kidOrColor]) { var v = global.getComputedStyle(document.documentElement).getPropertyValue("--jm-" + kidOrColor + "-" + (key || "base")).trim(); if (v) return v; }
    return String(kidOrColor || "#ffffff");
  }
  function boardLightSpill(boardEl, kidOrColor, o) {
    o = o || {};
    boardEl = boardEl || document.body;
    var col = kidColor(kidOrColor), glow = KIDS[kidOrColor] ? kidColor(kidOrColor, "glow") : col;
    var fixed = boardEl === document.body || boardEl === document.documentElement;
    var ov = document.createElement("div");
    ov.className = "jm-spill"; ov.setAttribute("aria-hidden", "true");
    ov.style.cssText = "position:" + (fixed ? "fixed" : "absolute") + ";inset:0;pointer-events:none;overflow:hidden;z-index:2147483000;contain:strict;";
    if (!fixed && global.getComputedStyle(boardEl).position === "static") boardEl.style.position = "relative";
    var ox = 50, oy = 40;
    try {
      if (o.origin) {
        var br = fixed ? { left: 0, top: 0, width: global.innerWidth, height: global.innerHeight } : boardEl.getBoundingClientRect(), r = o.origin.getBoundingClientRect();
        ox = ((r.left + r.width / 2) - br.left) / br.width * 100; oy = ((r.top + r.height * 0.15) - br.top) / br.height * 100;
      }
    } catch (e) { ox = 50; oy = 40; }
    var flood = document.createElement("div"), run = document.createElement("div");
    flood.style.cssText = "position:absolute;left:" + ox.toFixed(2) + "%;top:" + oy.toFixed(2) + "%;width:50vmax;height:50vmax;margin:-25vmax 0 0 -25vmax;border-radius:50%;" +
      "background:radial-gradient(closest-side," + col + " 0%," + glow + " 30%,transparent 72%);opacity:0;transform:scale(.2);will-change:transform,opacity;";
    run.style.cssText = "position:absolute;left:0;right:0;top:0;height:50%;background:linear-gradient(180deg,transparent 0%," + glow + " 40%," + col + " 55%,transparent 100%);opacity:0;transform:translateY(-100%);will-change:transform,opacity;";
    ov.appendChild(flood); ov.appendChild(run); boardEl.appendChild(ov);
    var dur = o.duration || 3400;
    if (reduced() || !ov.animate) { flood.style.opacity = ".2"; flood.style.transform = "scale(1)"; setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 1600); return ov; }
    flood.animate([{ opacity: 0, transform: "scale(.2)" }, { opacity: 0.5, transform: "scale(2)", offset: 0.22 }, { opacity: 0.34, transform: "scale(4.1)", offset: 0.6 }, { opacity: 0, transform: "scale(5.8)" }],
      { duration: dur, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" });
    var a2 = run.animate([{ opacity: 0, transform: "translateY(-100%)" }, { opacity: 0.3, transform: "translateY(10%)", offset: 0.35 }, { opacity: 0.18, transform: "translateY(90%)", offset: 0.7 }, { opacity: 0, transform: "translateY(160%)" }],
      { duration: dur, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" });
    a2.onfinish = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
    return ov;
  }

  /* ===== Us-together eruption (one-shot ~4 s on the tile: bubbles + glow in all three kid colors) ===== */
  function eruptUsTogether(tileEl, familyUnlocked, o) {
    /* Alfred: fires ONLY from Atlas's public Us together rule (10 of 12 Mon-Thu closes unlocks Weekend fun), passed in by
       Wright as ONE family boolean. No per-kid inputs, never derived from jar states, always all three colors. */
    o = o || {};
    if (!tileEl || familyUnlocked !== true) return null;
    var kids = ["harris", "hayes", "ainsley"];
    var r = tileEl.getBoundingClientRect(), padX = 0.3, padT = 0.9, padB = 0.7;
    var wcss = r.width * (1 + 2 * padX), hcss = r.height * (1 + padT + padB);
    if (global.getComputedStyle(tileEl).position === "static") tileEl.style.position = "relative";
    var cv = document.createElement("canvas"); cv.className = "jm-erupt"; cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:absolute;pointer-events:none;z-index:50;left:" + (-padX * 100) + "%;top:" + (-padT * 100) + "%;width:" + wcss + "px;height:" + hcss + "px;";
    var dpr = Math.min(2, global.devicePixelRatio || 1); cv.width = Math.round(wcss * dpr); cv.height = Math.round(hcss * dpr);
    tileEl.appendChild(cv);
    var ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    var cols = kids.map(function (k) {
      var gc = function (n) { return parseColor(kidColor(k, n), FALLBACK[n]); };
      var c = { base: gc("base"), light: gc("light"), shadow: gc("shadow"), deep: gc("deep"), spec: gc("spec"), glow: gc("glow") };
      return { c: c, spr: bubbleSprite(c) };
    });
    var R = rng(77), parts = [], cap = Math.min(140, Math.round(r.width * r.height / 900) + 40), dur = (o.duration || 4000) / 1000;
    var baseY = hcss - r.height * padB - r.height * 0.3;
    if (reduced()) {
      cols.forEach(function (q, i) { var x = wcss * padX + r.width * (i + 0.5) / cols.length, gr = ctx.createRadialGradient(x, baseY, 0, x, baseY, Math.min(r.width * 0.24, r.height * 0.95)); gr.addColorStop(0, rgba(q.c.glow, 0.7)); gr.addColorStop(1, rgba(q.c.glow, 0)); ctx.fillStyle = gr; ctx.fillRect(0, 0, wcss, hcss); });
      setTimeout(function () { if (cv.parentNode) cv.parentNode.removeChild(cv); }, 1600); return cv;
    }
    var t0 = now(), acc = 0, last = t0;
    function frame() {
      if (!cv.isConnected) return;
      var t = now(), e = t - t0, dt = Math.min(0.05, t - last); last = t;
      var rate = e < dur * 0.7 ? 70 * (1 - e / (dur * 0.7)) + 20 : 0;
      acc += rate * dt;
      while (acc >= 1 && parts.length < cap) {
        acc -= 1; var ci = Math.floor(R() * cols.length), lane = (ci + 0.5) / cols.length;
        parts.push({ c: ci, x: wcss * (padX + (lane * 0.8 + 0.1 + (R() - 0.5) * 0.25) * r.width / wcss), y: baseY, vx: (R() - 0.5) * 70, vy: -(120 + R() * 230), r: 3 + R() * 8, life: 0, max: 0.8 + R() * 1.2 });
      }
      ctx.clearRect(0, 0, wcss, hcss);
      var fade = e > dur * 0.75 ? Math.max(0, 1 - (e - dur * 0.75) / (dur * 0.25)) : 1;
      cols.forEach(function (q, i) {
        var x = wcss * padX + r.width * (i + 0.5) / cols.length, y = baseY - r.height * 0.3 * Math.sin(Math.min(1, e / 0.8) * Math.PI / 2), rad = Math.min(r.width * (0.24 + 0.05 * Math.sin(e * 3 + i)), r.height * 0.95);
        var gr = ctx.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, rgba(q.c.glow, 0.8 * fade)); gr.addColorStop(1, rgba(q.c.glow, 0));
        ctx.fillStyle = gr; ctx.fillRect(0, 0, wcss, hcss);
      });
      ctx.globalAlpha = fade;
      parts = parts.filter(function (pp) {
        pp.life += dt; pp.vy += 260 * dt; pp.x += pp.vx * dt; pp.y += pp.vy * dt;
        var kk = pp.life / pp.max; if (kk >= 1 || pp.y > hcss + 20) return false;
        var rr = pp.r * (kk > 0.85 ? (1 - kk) / 0.15 : 1);
        ctx.drawImage(cols[pp.c].spr, pp.x - rr * 1.32, pp.y - rr * 1.32, rr * 2.64, rr * 2.64);
        return true;
      });
      ctx.globalAlpha = 1;
      if (e < dur) global.requestAnimationFrame(frame); else if (cv.parentNode) cv.parentNode.removeChild(cv);
    }
    global.requestAnimationFrame(frame);
    return cv;
  }

  api.mount = mount;
  api.splash = splashAll;
  api.boardLightSpill = boardLightSpill;
  api.eruptUsTogether = eruptUsTogether;
  api._jars = jars;
  api._fps = function () { return capFps; };
  return api;
});
