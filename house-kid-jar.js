/* house-kid-jar.js · JARHERO1 (Dan 6:05-6:15 PM CT via Atlas / Prism / Alfred). Glue only: the jar look and ALL motion
   (boil by fill, boil-over at full, glint on empty glass, nudge, reduced-motion still) live in Prism's jar-mercury.js.
   This file only chooses WHICH real number the jar gets, and never invents one.

   Hayes / Harris : level = this Dad week's closed MUSTS boxes / all MUSTS boxes (WardKids.mustWeekFill, the same
                    per-day taps the MUSTS tile paints). Total 0 or unknown -> null (quiet empty glass).
                    Each new close: setLevel(level, { ripple: true }).
   Ainsley        : Alfred's two-state status (PASS 6:08 PM). EMPTY (default, and every no-data case) or TRUSTED
                    (full) with one line "Trusted with: <unlock>", only from a granted unlock in data/unlocks.json
                    (lit[] entry for kid "ainsley"). Never from a count, a run, or the jar book. Behind ONE flag,
                    body[data-trust-jar], default "off" until Alfred's real-data re-score.
   Hunger (6:16)  : setHunger(0..1) from hungerFor() below, only from real due / slip data: data/kid-seats.json
                    (kids home; the generator's close window opensAt / closesAt; its Dad-seat slip loops) and the page's
                    own taps (today's open MUSTS boxes). Kids away, quiet, or no due data -> 0. Ainsley: binary 0 / 1
                    (Alfred: no graded state on her glass). Never from Ledger's jar book. feed() on each close tap.
   Boil-over      : onBoilOver -> JarMercury.boardLightSpill(this page's board, kid color), own page only.
   A jar only ever mounts for the page's own kid (body[data-kid]); nothing here paints another kid's state. */
(function (g) {
  "use strict";
  var doc = g.document;
  var BOYS = { hayes: 1, harris: 1 };
  var NO_DIGITS = /[0-9%\u2605\u2606\u0024]/;
  if (!doc || !doc.body || !g.JarMercury) { g.HouseKidJar = { hungerFor: hungerFor, trustedWord: trustedWord, jar: null }; if (!doc || !g.JarMercury) return; }

  function kidOfPage() { return (doc.body && doc.body.getAttribute("data-kid")) || ""; }
  function getJson(u) {
    if (!g.fetch) return Promise.resolve(null);
    return g.fetch(u + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r && r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function setLevel(jar, lv, ripple) {
    if (!jar) return;
    var before = jar.level ? jar.level() : null;
    if (jar.setLevel.length >= 2) { jar.setLevel(lv, { ripple: !!ripple }); return; }
    jar.setLevel(lv); /* module without the stepped-ripple option: same visible step + the earn splash */
    if (ripple && lv != null && before != null && lv > before + 0.0001 && jar.splash) jar.splash();
  }

  /* ---------- hunger: real due / slip data only (one function, unit-tested in scripts/house/tests/jarhero1.test.mjs) ----------
     seats    : data/kid-seats.json as published (null when missing)
     kid      : "hayes" | "harris" | "ainsley"
     nowMs    : clock
     today    : the page's live { open, total } of today's MUSTS boxes (WardKids.mustTodayOpen)
     -> 0 when kids are away / quiet, there is no close window, no musts, or nothing open today.
     -> boys: open share x time pressure. Before the close window opens: 0.3 (a simmer: due today). Inside the window
        it climbs from 0.3 to 1 at closesAt. Past closesAt, or the Dad-seat lists this kid's must as a slip loop: 1.
     -> ainsley: binary. 1 only when due now (close window open, past it, or slipping) with an open box; else 0. */
  function hungerFor(seats, kid, nowMs, today) {
    if (!seats || seats.quiet === true || !seats.seats || !seats.seats[kid]) return 0;
    var musts = seats.seats[kid].musts;
    if (!Array.isArray(musts) || !musts.length) return 0;
    var cl = seats.close, o = cl && Date.parse(cl.opensAt), c = cl && Date.parse(cl.closesAt);
    if (!cl || !isFinite(o) || !isFinite(c) || c <= o) return 0;
    if (!today || !(today.total > 0) || !(today.open > 0)) return 0;
    var ds = seats.dadSeat;
    var slipping = !!(ds && Array.isArray(ds.loops) && ds.loops.some(function (l) { return l && l.kind === "must" && l.kid === kid; }));
    var share = Math.max(0, Math.min(1, today.open / today.total));
    var press = slipping || nowMs >= c ? 1 : nowMs < o ? 0.3 : 0.3 + 0.7 * ((nowMs - o) / (c - o));
    if (kid === "ainsley") return slipping || nowMs >= o ? 1 : 0;
    return slipping || nowMs >= c ? 1 : Math.max(0, Math.min(1, share * press));
  }
  function call(jar, fn, arg) { if (jar && typeof jar[fn] === "function") { try { return jar[fn](arg); } catch (e) { /* visual only */ } } return undefined; }
  function call2(jar, fn, a, b) { if (jar && typeof jar[fn] === "function") { try { return jar[fn](a, b); } catch (e) { /* visual only */ } } return undefined; }
  function todayOf(kid) { var W = g.WardKids; return W && typeof W.mustTodayOpen === "function" ? W.mustTodayOpen(kid) : null; }
  function kidColor(kid) {
    try { return getComputedStyle(doc.documentElement).getPropertyValue("--jm-" + kid + "-glow").trim() || ""; } catch (e) { return ""; }
  }
  function boilOverFor(kid) {
    return function () {
      if (kidOfPage() !== kid || typeof g.JarMercury.boardLightSpill !== "function") return; /* own page only */
      g.JarMercury.boardLightSpill(doc.querySelector(".panel") || doc.body, kidColor(kid));
    };
  }

  /* ---------- Hayes / Harris ---------- */
  function mountBoy(kid, slot) {
    var host = slot.querySelector(".kj-jar") || slot.appendChild(doc.createElement("div"));
    host.className = "kj-jar";
    var W = g.WardKids;
    var fill = function () { var f = W && W.mustWeekFill ? W.mustWeekFill(kid) : null; return f && f.total > 0 ? f.level : null; };
    var jar = g.JarMercury.mount(host, { kid: kid, level: fill(), onBoilOver: boilOverFor(kid) });
    var seats = null;
    var hunger = function () { call(jar, "setHunger", hungerFor(seats, kid, Date.now(), todayOf(kid))); };
    var sync = function (ripple) { setLevel(jar, fill(), ripple); hunger(); };
    getJson("data/kid-seats.json").then(function (d) { seats = d; hunger(); });
    setInterval(hunger, 60000); /* time pressure moves with the clock */
    doc.addEventListener("house:earn", function (ev) {
      var d = ev && ev.detail;
      if (d && d.kidId && d.kidId !== kid) return;
      setTimeout(function () { if (d && d.done === true) call(jar, "feed"); sync(true); if (typeof lastClosed === "number") lastClosed = closedNow(); }, 0);
    });
    ["house:kid-rendered", "house:kids-data-ready"].forEach(function (n) {
      doc.addEventListener(n, function (ev) { var d = ev && ev.detail; if (d && d.kidId && d.kidId !== kid) return; sync(false); });
    });
    g.addEventListener("storage", function () { sync(false); });
    /* JARHERO2 (Prism 19:02 gap): a MUSTS day-pill tap fires no house:earn, so watch the pills themselves. Each new
       closed box: feed() + a stepped ripple; an un-tap steps the glass back down, quietly. */
    var closedNow = function () { var f = W && W.mustWeekFill ? W.mustWeekFill(kid) : null; return f && f.total > 0 ? f.closed : 0; };
    var lastClosed = closedNow(), tapT = 0;
    var musts = doc.getElementById("sec-musts");
    if (musts && typeof MutationObserver === "function") {
      new MutationObserver(function () {
        clearTimeout(tapT);
        tapT = setTimeout(function () {
          var c = closedNow();
          if (c > lastClosed) { call(jar, "feed"); sync(true); } else if (c !== lastClosed) sync(false);
          lastClosed = c;
        }, 30);
      }).observe(musts, { subtree: true, attributes: true, attributeFilter: ["class", "aria-pressed"] });
    }
    sync(false);
    return jar;
  }

  /* ---------- Ainsley: two states, nothing between ---------- */
  function trustedWord(unlocks) {
    var lit = unlocks && Array.isArray(unlocks.lit) ? unlocks.lit : [];
    for (var i = 0; i < lit.length; i++) {
      var u = lit[i];
      if (!u || u.kid !== "ainsley") continue;
      var w = typeof u.trustedWith === "string" ? u.trustedWith : (typeof u.word === "string" ? u.word : "");
      w = w.replace(/\s+/g, " ").trim();
      if (w && !NO_DIGITS.test(w) && w.length <= 40) return w;
    }
    return "";
  }
  function mountAinsley(slot) {
    var card = slot.closest("[data-trust-jar-card]");
    var host = slot.querySelector(".kj-jar") || slot.appendChild(doc.createElement("div"));
    host.className = "kj-jar kj-jar--status";
    /* Prism's status vessel: EMPTY (glass glint only) or TRUSTED (full, boiling over, one "Trusted with" line the module
       writes). It takes no numeric level at all. */
    var jar = g.JarMercury.mount(host, { kid: "ainsley", variant: "status", state: "empty", onBoilOver: boilOverFor("ainsley") });
    if (card) { card.hidden = false; card.setAttribute("data-trust-state", "empty"); }
    getJson("data/unlocks.json").then(function (u) {
      var w = trustedWord(u);
      if (!w) { call2(jar, "setState", "empty", ""); return; }
      call2(jar, "setState", "trusted", w); /* full, never a level in between, never eased toward */
      if (card) { card.setAttribute("data-trust-state", "trusted"); card.setAttribute("aria-label", "Trusted with: " + w); }
    });
    var seats = null;
    var hunger = function () { call(jar, "setHunger", hungerFor(seats, "ainsley", Date.now(), todayOf("ainsley"))); }; /* 0 or 1 */
    getJson("data/kid-seats.json").then(function (d) { seats = d; hunger(); });
    setInterval(hunger, 60000);
    doc.addEventListener("house:earn", function (ev) {
      var d = ev && ev.detail;
      if (d && d.kidId && d.kidId !== "ainsley") return;
      setTimeout(function () { if (d && d.done === true) call(jar, "feed"); hunger(); }, 0);
    });
    return jar;
  }
  function trustFlagOn() { return !!(doc.body && doc.body.getAttribute("data-trust-jar") === "on"); }

  function boot() {
    var kid = kidOfPage();
    var slot = doc.querySelector('[data-kid-jar="' + kid + '"]');
    if (!slot) return;
    if (BOYS[kid]) { g.HouseKidJar.jar = mountBoy(kid, slot); return; }
    if (kid === "ainsley" && trustFlagOn()) g.HouseKidJar.jar = mountAinsley(slot);
  }
  g.HouseKidJar = { boot: boot, hungerFor: hungerFor, trustedWord: trustedWord, jar: null };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
})(typeof window !== "undefined" ? window : globalThis);
