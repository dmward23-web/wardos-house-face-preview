/* House face · client-side checkoffs · localStorage · kids-safe
   Daily musts: house-checkoffs:{kid}:{YYYY-MM-DD} (America/Chicago via HouseClock) — resets each morning.
   Weekly musts: house-checkoffs:{kid}:week:{FriISO}. Stars bank toward the Dad-week jar. */
(function () {
  "use strict";

  var page = (location.pathname.split("/").pop() || "sheet").replace(/\.html$/i, "");
  var PAGE_KEY = "house-checkoffs:" + page;
  var SHARED_KEY = "house-checkoffs:chores-v2";
  var clearedLatch = false;
  var POP_MS = 420;

  var CHORE_RE = /^(ain|hay|har)-/;

  function usesShared(el) {
    var id = el.getAttribute("data-check") || "";
    if (el.getAttribute("data-kid-quest") === "1") return true;
    if (CHORE_RE.test(id)) return true;
    if (document.body.getAttribute("data-chores-shared") === "1") return true;
    return false;
  }

  function todayIso() {
    if (window.WardKids && window.WardKids.DAY_ISO) return window.WardKids.DAY_ISO;
    if (window.HouseClock && HouseClock.iso) return HouseClock.iso();
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

  function keyFor(el) {
    if (!usesShared(el)) return PAGE_KEY;
    var id = el.getAttribute("data-check") || "";
    var dayIso = el.getAttribute("data-day-iso") || "";
    if (window.WardKids && typeof window.WardKids.checkKeyFor === "function") {
      return window.WardKids.checkKeyFor(id, window.WardKids._data, dayIso || undefined);
    }
    var iso = dayIso || todayIso();
    var kid = (window.WardKids && window.WardKids.KID_FROM_CHECK && window.WardKids.KID_FROM_CHECK[id]) || "kid";
    var cadence = el.getAttribute("data-cadence") || "daily";
    if (cadence === "weekly" && window.WardKids && typeof window.WardKids.weekStartIso === "function") {
      return "house-checkoffs:" + kid + ":week:" + window.WardKids.weekStartIso(iso);
    }
    return "house-checkoffs:" + kid + ":" + iso;
  }

  function loadKey(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function saveKey(key, state) {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) { /* private mode / quota — silent */ }
  }

  function reducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }

  function ringEl(el) {
    return el.querySelector(".ring, .box") || null;
  }

  function isDone(el) {
    if (el.classList.contains("tap-star")) return el.classList.contains("lit");
    return el.classList.contains("done");
  }

  function checkNodes() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-check]")).filter(function (el) {
      /* Parent daily-week rows keep data-quest-id only; ignore stray wrappers */
      if (el.classList.contains("daily-week") && el.querySelector(".day-tap")) return false;
      return true;
    });
  }

  function questRowFor(el) {
    return el.closest(".quest, .chore") || el;
  }

  function refreshDailyRow(row) {
    if (!row || !row.classList.contains("daily-week")) return;
    var taps = row.querySelectorAll(".day-tap");
    if (!taps.length) return;
    var doneN = 0;
    taps.forEach(function (t) {
      if (t.classList.contains("done")) doneN += 1;
    });
    var need = taps.length || (window.WardKids && WardKids.DAD_WEEK_DAYS) || 7;
    var weekDone = doneN >= need;
    row.classList.toggle("done", weekDone);
    row.classList.toggle("open", !weekDone);
    /* KIDCHORES1 · no per-row Fri→Fri / jar / $ wk spam — board-level note only */
    var hint = row.querySelector(".hint");
    if (hint) hint.remove();
    var earn = row.querySelector(".star-earn");
    if (earn && !earn.classList.contains("addon-tag")) earn.remove();
  }

  function applyDone(el, done, animate) {
    var isDayTap = el.classList.contains("day-tap");
    var isChore = !isDayTap && (el.classList.contains("chore") || el.classList.contains("quest"));
    var isStar = el.classList.contains("tap-star");

    if (isStar) {
      el.classList.toggle("lit", done);
      el.classList.toggle("dim", !done);
      el.setAttribute("aria-pressed", done ? "true" : "false");
    } else if (isDayTap) {
      var wasDone = el.classList.contains("done");
      el.classList.toggle("done", done);
      el.setAttribute("aria-pressed", done ? "true" : "false");
      /* VINYLHEAT1 · Ainsley records spin when toggled OFF */
      if (animate && wasDone && !done && !reducedMotion()) {
        el.classList.remove("spin-off");
        void el.offsetWidth;
        el.classList.add("spin-off");
        window.setTimeout(function () { el.classList.remove("spin-off"); }, 720);
      }
      refreshDailyRow(questRowFor(el));
    } else {
      el.classList.toggle("done", done);
      if (isChore) {
        el.classList.toggle("open", !done);
        var hint = el.querySelector(".hint");
        var earn = el.querySelector(".star-earn");
        if (hint) {
          if (!hint.getAttribute("data-hint-open")) {
            hint.setAttribute("data-hint-open", hint.textContent);
          }
          hint.textContent = done
            ? "done · nice!"
            : hint.getAttribute("data-hint-open") || "tap when done";
        }
        if (earn && !earn.classList.contains("addon-tag")) {
          var n = earn.getAttribute("data-stars") || "1";
          earn.textContent = done ? "★ +" + n : "★ " + n; /* KIDPATH2: stars only, never $ */
        }
      }
      var ring = ringEl(el);
      if (ring) ring.textContent = done ? "✓" : "";
    }

    if (animate && !reducedMotion()) {
      el.classList.remove("pop");
      void el.offsetWidth;
      el.classList.add("pop");
      window.setTimeout(function () {
        el.classList.remove("pop");
      }, POP_MS);
    }
  }

  function soundEnabled() {
    if (window.HouseSfx && typeof HouseSfx.isMuted === "function" && HouseSfx.isMuted()) return false;
    var root = document.documentElement;
    var flag = root.getAttribute("data-sound");
    if (flag === null || flag === "") flag = "on";
    if (flag === "off" || flag === "0" || flag === "false") return false;
    if (reducedMotion()) return false;
    return true;
  }

  var _audioCtx = null;
  function getCtx() {
    /* Prefer shared HouseSfx context so one iOS unlock covers checkoffs too */
    if (window.HouseSfx && typeof HouseSfx.ensureCtx === "function") {
      var shared = HouseSfx.ensureCtx();
      if (shared) {
        if (shared.state === "suspended" && typeof HouseSfx.unlockAudio === "function") {
          try { HouseSfx.unlockAudio(); } catch (e) {}
        }
        return shared;
      }
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!_audioCtx) _audioCtx = new AC();
    if (_audioCtx.state === "suspended") {
      try { _audioCtx.resume(); } catch (e2) {}
    }
    return _audioCtx;
  }
  function masterOut(ctx) {
    if (window.HouseSfx && typeof HouseSfx.masterGain === "function") {
      var m = HouseSfx.masterGain();
      if (m) return m;
    }
    if (window.__houseMasterGain) return window.__houseMasterGain;
    return ctx.destination;
  }

  function tone(freq, dur, type, peak, when) {
    if (!soundEnabled()) return;
    try {
      var ctx = getCtx();
      if (!ctx) return;
      var t0 = (when != null ? when : ctx.currentTime);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, t0);
      var hot = (peak || 0.05) * 1.35;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.min(0.95, hot), t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(masterOut(ctx));
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* silent */ }
  }

  function cheerDing() {
    if (!soundEnabled()) return;
    try {
      var ctx = getCtx();
      if (!ctx) return;
      var t0 = ctx.currentTime;
      tone(880, 0.14, "sine", 0.055, t0);
      tone(1320, 0.16, "sine", 0.04, t0 + 0.04);
    } catch (e) { /* silent */ }
  }

  function cheerVictory() {
    if (!soundEnabled()) return;
    try {
      var ctx = getCtx();
      if (!ctx) return;
      var t0 = ctx.currentTime;
      tone(523.25, 0.18, "triangle", 0.06, t0);
      tone(659.25, 0.2, "triangle", 0.055, t0 + 0.08);
      tone(783.99, 0.22, "triangle", 0.05, t0 + 0.16);
      tone(1046.5, 0.32, "sine", 0.07, t0 + 0.26);
    } catch (e) { /* silent */ }
  }

  function progressStats() {
    /* Top progress bars = TODAY daily must day-taps only (week jar uses bank fill) */
    var today = todayIso();
    var nodes = checkNodes().filter(function (el) {
      if (el.getAttribute("data-optional") === "1" || el.classList.contains("addon")) return false;
      var cad = el.getAttribute("data-cadence") || "daily";
      if (cad === "weekly" || cad === "addon") return false;
      if (el.classList.contains("day-tap")) {
        return (el.getAttribute("data-day-iso") || today) === today;
      }
      /* legacy single daily row without day taps */
      return true;
    });
    var total = nodes.length;
    var done = 0;
    nodes.forEach(function (el) {
      if (isDone(el)) done += 1;
    });
    return { total: total, done: done, left: Math.max(0, total - done), pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function syncProgress(animateFill) {
    var stats = progressStats();
    var fills = document.querySelectorAll("[data-progress-fill]");
    fills.forEach(function (fill) {
      if (animateFill && !reducedMotion()) {
        fill.classList.remove("xp-bump");
        void fill.offsetWidth;
        fill.classList.add("xp-bump");
        window.setTimeout(function () { fill.classList.remove("xp-bump"); }, 480);
      }
      fill.style.width = stats.pct + "%";
      fill.setAttribute("data-pct", String(stats.pct));
      fill.classList.toggle("is-full", stats.total > 0 && stats.left === 0);
      fill.classList.toggle("is-low", stats.pct > 0 && stats.pct < 40);
      fill.classList.toggle("is-mid", stats.pct >= 40 && stats.pct < 100);
    });

    /* KIDPAGES1 · SPACE-01 + METER0: an empty meter (nothing counted yet, or nothing to count) is not drawn; an empty
       track reads as an input field. Its card leaves and the neighbours take the room; it returns with the first tap. */
    var empty = stats.total === 0 || stats.done === 0;
    fills.forEach(function (fill) {
      var m = fill.closest(".bar-card, .xp-row, .storm-meter");
      if (!m) return;
      if (empty) m.setAttribute("data-meter0", ""); else m.removeAttribute("data-meter0");
    });
    document.querySelectorAll(".bars").forEach(function (b) {
      var cards = b.querySelectorAll(".bar-card");
      var all0 = cards.length && Array.prototype.every.call(cards, function (c) { return c.hasAttribute("data-meter0"); });
      if (all0) b.setAttribute("data-meter0", ""); else b.removeAttribute("data-meter0");
    });

    document.querySelectorAll("[data-progress-meta]").forEach(function (el) {
      var tpl = el.getAttribute("data-progress-meta") || "";
      if (tpl.indexOf("{") >= 0) {
        el.textContent = tpl
          .replace(/\{done\}/g, String(stats.done))
          .replace(/\{total\}/g, String(stats.total))
          .replace(/\{left\}/g, String(stats.left))
          .replace(/\{pct\}/g, String(stats.pct));
      } else if (stats.total === 0) {
        el.textContent = "tap quests to fill";
      } else if (stats.left === 0) {
        el.textContent = "CLEAR · " + stats.done + "/" + stats.total;
      } else {
        el.textContent = stats.done + "/" + stats.total + " · " + stats.left + " left";
      }
    });

    document.querySelectorAll("[data-left-count]").forEach(function (el) {
      if (stats.total === 0) {
        el.textContent = "—";
      } else if (stats.left === 0) {
        el.textContent = "CLEAR";
        el.classList.add("is-clear");
      } else {
        el.textContent = stats.left + " left";
        el.classList.remove("is-clear");
      }
    });

    document.querySelectorAll("[data-progress-val]").forEach(function (el) {
      el.textContent = stats.pct + "%";
    });

    document.body.classList.toggle("house-progress-full", stats.total > 0 && stats.left === 0);
    document.body.setAttribute("data-checks-done", String(stats.done));
    document.body.setAttribute("data-checks-total", String(stats.total));
    document.body.setAttribute("data-checks-left", String(stats.left));

    return stats;
  }

  function burstLabel() {
    var forced = document.body.getAttribute("data-clear-label");
    if (forced) return forced;
    if (/harris/i.test(page)) return "LEVEL UP";
    if (/hayes/i.test(page)) return "VICTORY";
    if (/ainsley/i.test(page)) return "ENCORE";
    return "CLEARED";
  }

  function ensureBurst() {
    var el = document.getElementById("house-clear-burst");
    if (el) return el;
    el = document.createElement("div");
    el.id = "house-clear-burst";
    el.className = "house-clear-burst";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="hcb-flash"></div>' +
      '<div class="hcb-particles" aria-hidden="true">' +
      '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>' +
      '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>' +
      "</div>" +
      '<div class="hcb-label"></div>' +
      '<div class="hcb-sub">all quests done</div>';
    document.body.appendChild(el);
    return el;
  }

  function fireClearBurst() {
    if (reducedMotion()) {
      document.body.classList.add("house-cleared");
      return;
    }
    var el = ensureBurst();
    var label = el.querySelector(".hcb-label");
    if (label) label.textContent = burstLabel();
    el.classList.remove("is-on");
    void el.offsetWidth;
    el.classList.add("is-on");
    document.body.classList.add("house-cleared", "house-clear-flash");
    window.setTimeout(function () {
      document.body.classList.remove("house-clear-flash");
    }, 900);
    window.setTimeout(function () {
      el.classList.remove("is-on");
    }, 2200);
  }

  function evaluateClear(fromToggle) {
    var stats = syncProgress(!!fromToggle);
    if (stats.total === 0) {
      clearedLatch = false;
      document.body.classList.remove("house-cleared", "house-clear-flash");
      return stats;
    }
    if (stats.left === 0) {
      if (!clearedLatch) {
        clearedLatch = true;
        document.body.classList.add("house-cleared");
        if (fromToggle) {
          fireClearBurst();
          if (!window.HouseSfx) cheerVictory();
          try {
            document.dispatchEvent(
              new CustomEvent("house:cleared", {
                detail: { page: page, done: stats.done, total: stats.total }
              })
            );
          } catch (e) { /* ignore */ }
        }
      }
    } else if (clearedLatch) {
      clearedLatch = false;
      document.body.classList.remove("house-cleared", "house-clear-flash");
      var burst = document.getElementById("house-clear-burst");
      if (burst) burst.classList.remove("is-on");
    }
    return stats;
  }

  function refreshBankUI(checkId, done, dayIso) {
    try {
      if (!window.WardKids) return;
      var data = window.WardKids._data;
      var bank = window.WardKids.setCheck(checkId, done, data, dayIso || undefined);
      if (bank) window.WardKids.renderBank(document, bank);
      var kidId = (window.WardKids.KID_FROM_CHECK || {})[checkId];
      if (kidId && data) {
        var view = window.WardKids.getBankView(kidId, data);
        window.WardKids.renderBank(document, view);
      }
    } catch (e) { /* */ }
  }

  function wireChecks() {
    if (reducedMotion()) {
      document.documentElement.classList.add("rm-reduce");
      document.body.classList.add("rm-reduce");
    }

    try {
      if (window.WardKids && typeof window.WardKids.enhanceSharedChores === "function") {
        window.WardKids.enhanceSharedChores(document, window.WardKids._data);
      }
    } catch (eEnh) { /* */ }

    var nodes = checkNodes();
    nodes.forEach(function (el) {
      var id = el.getAttribute("data-check");
      if (!id) return;
      if (el.classList.contains("daily-week") && !el.classList.contains("day-tap")) return;

      var dayIso = el.getAttribute("data-day-iso") || "";
      var key = keyFor(el);
      var state = loadKey(key);
      if (Object.prototype.hasOwnProperty.call(state, id)) {
        applyDone(el, !!state[id], false);
      } else if (el.classList.contains("day-tap") && window.WardKids && typeof window.WardKids.getCheck === "function") {
        applyDone(el, !!window.WardKids.getCheck(id, window.WardKids._data, dayIso), false);
      }

      if (!el.classList.contains("day-tap")) {
        el.setAttribute("role", el.getAttribute("role") || "button");
        el.setAttribute("tabindex", el.getAttribute("tabindex") || "0");
      }

      if (el.getAttribute("data-wired") === "1") return;
      el.setAttribute("data-wired", "1");

      function toggle(ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        /* Daily week rows are shells — only .day-tap buttons count */
        if (el.classList.contains("daily-week") && !el.classList.contains("day-tap")) return;
        var nowDone = el.classList.contains("tap-star")
          ? !el.classList.contains("lit")
          : !el.classList.contains("done");
        applyDone(el, nowDone, true);
        if (nowDone && !(window.HouseSfx && usesShared(el))) cheerDing();
        var iso = el.getAttribute("data-day-iso") || "";
        if (usesShared(el) && window.WardKids && typeof window.WardKids.setCheck === "function") {
          refreshBankUI(id, nowDone, iso || undefined);
        } else {
          var k = keyFor(el);
          var st = loadKey(k);
          st[id] = nowDone;
          saveKey(k, st);
        }
        evaluateClear(true);
      }

      el.addEventListener("click", toggle);
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") toggle(ev);
      });
    });

    document.querySelectorAll(".quest.daily-week, .chore.daily-week").forEach(refreshDailyRow);

    evaluateClear(false);
  }

  window.HouseCheckoffs = { rewire: wireChecks, syncProgress: syncProgress, evaluateClear: evaluateClear };

  function start() {
    document.addEventListener("house:kid-rendered", function () {
      wireChecks();
    });
    document.addEventListener("house:kids-data-ready", function () {
      try {
        if (window.WardKids && window.WardKids.enhanceSharedChores) {
          window.WardKids.enhanceSharedChores(document, window.WardKids._data);
        }
      } catch (e) { /* */ }
      wireChecks();
    });
    wireChecks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
