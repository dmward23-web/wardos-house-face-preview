/* House Face · LINKWEB1 · every badge / tile / card leads somewhere (Dan 10/1).
 * One connected web, no dead ends, no new boards.
 * Each rule = [pages, selector, target]. target is a board file, or a fn(el)
 * that picks one (kid tiles → that kid's board, day cards → Today / Month).
 * Matched elements get data-go + cursor:pointer; a tap anywhere on them goes
 * to the target. Real controls inside (links, buttons, checkoffs, sound,
 * chips with their own action) keep their job — we never fire over them.
 * Header stays tap-home (house-hdr-home.js). Re-scans after live re-renders. */
(function () {
  "use strict";
  var PAGE = (location.pathname.split("/").pop() || "sheet-index.html").toLowerCase();
  var KIDS = { ainsley: "kid-ainsley.html", hayes: "kid-hayes.html", harris: "kid-harris.html" };
  var ABBR = { ain: "ainsley", hay: "hayes", har: "harris", ains: "ainsley" };
  var TODAY = "sheet-today.html", MONTH = "month.html", CHORES = "sheet-chores.html",
      JAR = "sheet-allowance.html", STATUS = "sheet-status.html", US = "sheet-us.html",
      CAMS = "nest-webrtc.html", LIGHTS = "sheet-lights.html", HUBHOME = "sheet-google-home.html",
      DAN = "sheet-dan.html", /* PRESSMAP1 (e): the desk gate is reached ONLY from the Dad Seat (sheet-dan.html); every other press lands on the Dad Seat */ DESK = "sheet-desk-gate.html", PACK = "sheet-pack.html",
      GALLERY = "sheet-gallery.html", HERO = "sheet-gallery-hero.html", INDEX = "sheet-index.html";
  var CONTROL = "a[href],button,input,select,textarea,label,summary,[role=button],[contenteditable=true]," +
    /* tap actions other House scripts own (delegated or direct) — never navigate over them */
    "[data-check],.quest,.chore,.day-tap,[data-mute-toggle],[data-mnav],[data-ym],.empty-slot,.opt," +
    "[data-consume-day],[data-ds-day],[data-act],[data-face-dot],[data-who-up],[data-layout],[data-hq-claim],[data-m]," +
    "[data-grow-meter],[data-grow-goal-line],[data-goal-chip],[data-got-it],[data-save-del],.saves-list-row,[class*='saves-']," +
    ".kf-claim,.kid-flip-go,.leaveby-chip,.sctl-row,.hub-sw-track,.hub-sw-dim,.hub-cam,.cam,[data-hub-key-entry],.hub-quest-claim,.kid-light-host";

  function txt(el) { return String((el && (el.innerText || el.textContent)) || "").replace(/\s+/g, " ").trim(); }
  function kidOf(el) {
    for (var n = el, i = 0; n && n.nodeType === 1 && i < 6; n = n.parentElement, i++) {
      var dk = n.getAttribute("data-kid") || n.getAttribute("data-bank-kid");
      if (dk && KIDS[dk]) return dk;
      var cl = n.classList;
      for (var k in KIDS) if (cl.contains(k)) return k;
      for (var a in ABBR) if (cl.contains(a)) return ABBR[a];
      var al = String(n.getAttribute("aria-label") || "").toLowerCase();
      for (var k3 in KIDS) if (al.indexOf(k3) >= 0) return k3;
    }
    var t = txt(el).toLowerCase(), hit = [];
    for (var k2 in KIDS) if (t.indexOf(k2) >= 0) hit.push(k2);
    if (!hit.length) { /* jar names: Tour = Ainsley · Victory = Hayes · Gem = Harris */
      if (/\btour\b/.test(t)) hit.push("ainsley");
      if (/\bvictory\b/.test(t)) hit.push("hayes");
      if (/\bgem\b/.test(t)) hit.push("harris");
    }
    return hit.length === 1 ? hit[0] : null;
  }
  function kid(fallback) { return function (el) { var k = kidOf(el); return k ? KIDS[k] : fallback; }; }
  function byText(pairs, fallback) {
    return function (el) {
      var t = txt(el);
      for (var i = 0; i < pairs.length; i++) if (pairs[i][0].test(t)) return pairs[i][1];
      return fallback || null;
    };
  }
  var DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  function ctDow() {
    try { return new Date().toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short" }).toUpperCase().slice(0, 3); }
    catch (e) { return DOW[new Date().getDay()]; }
  }
  /* a day card: NOW / TODAY / ALL DAY / today's weekday → Today, anything later → Month */
  function dayCard(el) {
    var t = txt(el).toUpperCase();
    if (/^(NOW|TODAY|ALL DAY|TONIGHT)\b/.test(t) || t.indexOf(ctDow()) === 0) return TODAY;
    return MONTH;
  }
  function monthOut(el) {
    var n = parseInt(txt(el), 10);
    return n >= 20 ? "mnav:-1" : "mnav:1";
  }

  var R = [
    /* every board · build/status footer stamps → Status */
    ["*", "span.ftr-chip:not(a), div.ftr-chip:not(a)", STATUS],

    /* Google Home hub (+ retired Sensi redirect) */
    ["sheet-google-home.html", ".cam-path, .note", CAMS],

    /* Nest cam viewer · STILL / NEED KEY state pill → Status (open gaps) */
    ["nest-webrtc.html", ".hud .pill", STATUS],

    /* Lights · garage / door pads that aren't lights → Google Home pads */
    ["sheet-lights.html", "article.light-pad.is-need-connect", HUBHOME],

    /* Today */
    ["sheet-today.html", "section.gm, .unknown-chips, .gm-badge", MONTH],
    ["sheet-today.html", "section.today-day", MONTH],
    ["sheet-today.html", "section.today-day .leaveby-row", kid(DAN)],
    ["sheet-today.html", "section.sec[aria-label*='here' i], section.sec[aria-label*='who' i]", US],

    /* Kid boards */
    ["kid-*", ".xp-stage, .xp-row, .xp-glass, .bar-card, .left-chip, .storm-meter", CHORES],
    ["kid-*", "section.hot-banner, .consume-hero, .consume-punch-card, .consume-label[data-mount-consume-today-label]", TODAY],
    ["kid-*", ".consume-label:not([data-mount-consume-today-label]), .consume-ahead, .consume-ahead-row, .consume-routine, .day-records .row:not(a)", MONTH],
    ["kid-*", ".harbor-strip", TODAY],
    ["kid-*", ".harbor-strip .card", dayCard],
    ["kid-*", ".sec-bank.bank-card, .money-row, .money-chip", JAR],
    ["kid-*", ".sec-light", LIGHTS],

    /* Dad Seat */
    ["sheet-dan.html", "section.ds-next, section.ds-sec", TODAY],
    ["sheet-dan.html", ".kids-row > *:not(a)", kid(null)],

    /* Month */
    ["month.html", ".banner-row", US],
    ["month.html", ".banner-row > *:not(a)", kid(US)],
    ["month.html", ".day.out", monthOut],

    /* Chores · streak badge → that kid's board; vibe banner → jar path */
    ["sheet-chores.html", ".streak", kid(null)],
    ["sheet-chores.html", "section.cheer", JAR],
    ["sheet-chores.html", ".cheer-badge", byText([[/3 KIDS/i, INDEX], [/LIVE|TAPS/i, STATUS]])],

    /* Groceries · each kid's treat slot → that kid's board */
    ["sheet-groceries.html", ".treat", kid(null)],

    /* Allowance */
    ["sheet-allowance.html", "section.link-banner", CHORES],
    ["sheet-allowance.html", "section.bank, .streak-pill, .g2-grow-chip", kid(null)],
    ["sheet-allowance.html", ".feed-row", CHORES],
    ["sheet-allowance.html", ".desk-note, .badge", DAN],

    /* Our ideas (weekend) · kid idea cards → kid boards */
    ["sheet-weekend.html", ".vote-card", kid(null)],
    ["sheet-weekend.html", ".cheer-badge", STATUS],

    /* Family trips (win) */
    ["sheet-win.html", "section.hero, article.trip.is-next", PACK],
    ["sheet-win.html", "article.trip:not(.is-next)", MONTH],

    /* Status · every listed page / gap / lock row → its board */
    ["sheet-status.html", ".ship", byText([
      [/Sheets index/i, INDEX], [/Week board/i, INDEX], [/Month chat/i, "month-chat.html"], [/Month board/i, MONTH],
      [/Today/i, TODAY], [/Hayes|Ainsley|Harris/i, INDEX], [/Chores|Groceries/i, CHORES],
      [/Dinner/i, "sheet-dinner.html"], [/Win|Countdowns/i, "sheet-win.html"], [/Us .*Load|Load day/i, US],
      [/Desk gate/i, DAN], [/Lights/i, LIGHTS], [/Sensi|Nest/i, HUBHOME], [/Checkoffs/i, CHORES]])],
    ["sheet-status.html", ".stat", byText([[/PAGES BUILT/i, INDEX], [/TEMPLATE LOCK/i, GALLERY], [/OPEN GAPS/i, TODAY], [/PROMO/i, HERO]])],
    ["sheet-status.html", ".lock-row", byText([[/Kid color/i, INDEX], [/Never on House/i, DAN], [/Canvas|phone crop/i, HERO]], GALLERY)],
    ["sheet-status.html", ".gap-row", byText([[/weather/i, TODAY + "#house-wx"], [/Calendar/i, MONTH], [/School/i, TODAY], [/Lights/i, LIGHTS]])],
    ["sheet-status.html", ".promo-row", byText([[/PNG plates/i, HERO], [/Desk gate/i, DAN]], GALLERY)],

    /* Us */
    ["sheet-us.html", ".log-card", byText([[/calendar/i, MONTH]], US)],
    ["sheet-us.html", ".safe-note", DAN],

    /* Countdowns */
    ["sheet-countdowns.html", "section.cheer, .flame-row", kid(MONTH)],
    ["sheet-countdowns.html", ".count-row, .safe", MONTH],
    ["sheet-countdowns.html", ".cheer-badge", byText([[/BDAY/i, MONTH]], kid(MONTH))],

    /* Pack */
    ["sheet-pack.html", "section.cheer", US],
    ["sheet-pack.html", ".tab", byText([[/Mom week/i, US]], DAN)],
    ["sheet-pack.html", ".handoff", "sheet-load-day.html"],
    ["sheet-pack.html", ".cheer-badge", byText([[/FRI|MON|TUE|WED|THU|SAT|SUN/i, MONTH]], "sheet-win.html")],

    /* Load day */
    ["sheet-load-day.html", "section.loadband", MONTH],
    ["sheet-load-day.html", "article.beat", byText([[/House\+Desk/i, DAN]], kid(TODAY))],
    ["sheet-load-day.html", ".kchip", kid(null)],
    ["sheet-load-day.html", "section.sec[aria-label*='glance' i], .handoff-card, .glance-row", TODAY],

    /* Month chat (plate) */
    ["month-chat.html", ".day, .dow-row", MONTH],
    ["month-chat.html", ".banner, .us-row", US],

    /* Desk gate · House side → House boards; Desk side stays Desk (no House board) */
    ["sheet-desk-gate.html", ".side.house .side-ico, .side.house .side-pill, .side.house .loud, .kids-note", INDEX],
    ["sheet-desk-gate.html", ".side.house .item", byText([[/Calendar/i, MONTH], [/Kids/i, INDEX], [/Chores/i, CHORES], [/Us logistics/i, US]])],

    /* Dinner · suggest → Dad (Dad locks the night) */
    ["sheet-dinner.html", ".suggest", DAN],
    ["sheet-dinner.html", ".vote-chip:not(a), .kid-chip:not(a)", kid(null)]
  ];

  function pageMatch(p) {
    if (p === "*") return true;
    if (p.slice(-1) === "*") return PAGE.indexOf(p.slice(0, -1)) === 0;
    return PAGE === p;
  }
  function scan() {
    for (var i = 0; i < R.length; i++) {
      var r = R[i];
      if (!pageMatch(r[0])) continue;
      if (r[0] === "*" && PAGE === STATUS) continue;
      var list;
      try { list = document.querySelectorAll(r[1]); } catch (e) { continue; }
      for (var j = 0; j < list.length; j++) {
        var el = list[j];
        if (el.closest("header") || el.closest("a[href]") || el.closest("button")) continue;
        var t = typeof r[2] === "function" ? r[2](el) : r[2];
        if (typeof t === "function") t = t(el);
        if (!t) continue;
        if (t === PAGE) continue; /* never loop to the same board */
        el.setAttribute("data-go", t);
        el.classList.add("hf-go");
        if (!el.hasAttribute("role")) el.setAttribute("role", "link");
      }
    }
  }
  function go(t) {
    if (t.indexOf("mnav:") === 0) {
      var b = document.querySelector('[data-mnav="' + t.slice(5) + '"]');
      if (b) { b.click(); return; }
      t = MONTH;
    }
    try { if (window.HouseSfx && window.HouseSfx.tap) window.HouseSfx.tap(); } catch (e) {}
    window.location.assign(t);
  }
  document.addEventListener("click", function (ev) {
    if (ev.defaultPrevented || ev.button > 0) return;
    var t = ev.target;
    if (!t || !t.closest) return;
    var g = t.closest("[data-go]");
    if (!g || g.closest("header")) return;
    var ctl = t.closest(CONTROL);
    if (ctl && (g.contains(ctl) && ctl !== g)) return; /* real control keeps its own action */
    ev.preventDefault();
    go(g.getAttribute("data-go"));
  });
  document.addEventListener("keydown", function (ev) {
    if ((ev.key === "Enter") && ev.target && ev.target.getAttribute && ev.target.getAttribute("data-go")) { ev.preventDefault(); go(ev.target.getAttribute("data-go")); }
  });

  var css = document.createElement("style");
  css.id = "hf-go-css";
  css.textContent = ".hf-go{cursor:pointer!important;-webkit-tap-highlight-color:rgba(255,255,255,0.08)}.hf-go:active{filter:brightness(1.1)}";
  (document.head || document.documentElement).appendChild(css);

  var pend = 0;
  function soon() { if (pend) return; pend = setTimeout(function () { pend = 0; scan(); }, 250); }
  function start() {
    scan();
    try { new MutationObserver(soon).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    document.addEventListener("house:kid-rendered", soon);
    document.addEventListener("house:kids-data-ready", soon);
    setTimeout(scan, 1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.HouseLinks = { scan: scan, rules: R, control: CONTROL };
})();
