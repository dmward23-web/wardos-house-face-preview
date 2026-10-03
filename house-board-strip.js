/* House Face · live leave-by / Schedule strip (HUBSCROLL1 · kid-first schedule).
   Date labels ALWAYS from HouseClock (America/Chicago).
   Authority: data/cal-live.json (dmward23 → cal-from-events.mjs).
   Panel paints today's remaining + tomorrow peek (dense list, hub-scale type).
   Never paint a past boardStrip.time/place. Never silent day-lagged kids-week.
   Glass law: never CUSTODY — WITH DAD / Dad week.
   CAL_FRESH_MS = 6 hours — past that, or asOfIso ≠ clock day → fail-closed CAL STALE. */
(function (global) {
  "use strict";
  /* HAYESJ1: kid names in titles go through the one shared matcher (house-kid-match.js): Hayes Johnson is not our Hayes */
  var KM = global.HouseKidMatch || (typeof require === "function" ? require("./house-kid-match.js") : null);
  function notOurs(s) { return KM ? KM.strip(s) : String(s == null ? "" : s); }

  var CAL_FRESH_MS = 6 * 60 * 60 * 1000;
  var MAX_TODAY = 12;
  var MAX_TOMORROW = 12;

  /** Kid / school / sports glass — never drop these for errands. */
  function isKidActivity(ev) {
    var s = notOurs((ev && (ev.summary || ev.place || "")) || "");
    if (/\b(Ainsley|Hayes|Harris|Boys)\b/i.test(s)) return true;
    if (/\b(swim|flag|baseball|SRE|LKMS|practice|game|PE|special|hearing|vision|field\s*trip|homework|collab|screening)\b/i.test(s)) return true;
    return false;
  }

  function isNoiseEvent(ev) {
    var s = notOurs((ev && (ev.summary || ev.place || "")) || "");
    if (isKidActivity(ev)) return false;
    if (/^Free\b/i.test(s)) return true;
    if (/\b(Amazon|Hank|HD #\d+|lever return|vanity|scooter)\b/i.test(s)) return true;
    if (/^Dan\b/i.test(s) && !/\b(Hayes|Harris|Ainsley|Boys)\b/i.test(s)) return true;
    if (/^Leave\s*·/i.test(s) && !/\b(Hayes|Harris|Ainsley|Boys|SRE|swim|flag|baseball)\b/i.test(s)) return true;
    return false;
  }

  function sortByStart(a, b) {
    return eventStartMs(a) - eventStartMs(b);
  }

  /** Prefer kid activities; never slice them off for noise. */
  function preferKidItems(items, softCap) {
    softCap = softCap || MAX_TOMORROW;
    var list = (items || []).slice();
    var kid = [];
    var rest = [];
    for (var i = 0; i < list.length; i++) {
      if (isKidActivity(list[i]) && !isNoiseEvent(list[i])) kid.push(list[i]);
      else rest.push(list[i]);
    }
    var out = kid.concat(rest);
    var floor = kid.length;
    var cap = Math.max(softCap, floor);
    return out.slice(0, Math.min(out.length, cap));
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** Kids-safe: never surface CUSTODY on glass. */
  function kidsSafe(s) {
    var t = String(s == null ? "" : s);
    t = t.replace(/\bCUSTODY\b/gi, "WITH DAD");
    t = t.replace(/\bcustody\b/gi, "Dad week");
    return t;
  }

  function parseMs(iso) {
    if (!iso) return 0;
    var t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }

  function ageMs(data) {
    if (!data) return Infinity;
    var t = parseMs(data.fetchedAt || data.updatedAt);
    if (!t) return Infinity;
    return Date.now() - t;
  }

  /** Clean CT wall time · "8:10 AM" (HUBFMT1 · never bare H:MM / never 24h ISO). */
  function clockTimeFromIso(iso) {
    if (!iso) return "";
    try {
      if (global.HouseClock && HouseClock.timeLabel) {
        return HouseClock.timeLabel(new Date(iso));
      }
      var p = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      }).formatToParts(new Date(iso)).forEach(function (x) {
        if (x.type !== "literal") p[x.type] = x.value;
      });
      var ap = p.dayPeriod ? (" " + p.dayPeriod) : "";
      return (p.hour || "") + ":" + (p.minute || "") + ap;
    } catch (e) {
      return "";
    }
  }

  function shortPlace(summary, cap) {
    var s = kidsSafe(String(summary || "").trim());
    s = s.replace(/^Leave\s*[·•\-–—]\s*/i, "");
    s = s.replace(/\(\s*Mom[^)]*\)/gi, "");
    s = s.replace(/\bMom\b[^·]*/gi, "");
    s = s.replace(/\s{2,}/g, " ").replace(/\s·\s*$/g, "").trim();
    cap = cap || 64;
    if (s.length > cap) { /* KIDPAGES1 · no ellipsis on the face: keep whole " · " phrases that fit; a lone long phrase stays whole (it wraps) */
      var ph = s.split(/\s+·\s+/), out = ph[0];
      for (var i = 1; i < ph.length && (out + " · " + ph[i]).length <= cap; i++) out += " · " + ph[i];
      s = out;
    }
    return s;
  }

  function eventStartMs(ev) {
    if (!ev) return 0;
    if (ev.startMs && Number.isFinite(ev.startMs)) return ev.startMs;
    return parseMs(ev.start || ev.startDateTime || ev.dateTime);
  }

  /** Chicago calendar day for timed events; date-only for all-day (Z midnight = that UTC date). */
  function eventDayIso(ev) {
    if (!ev) return "";
    var start = ev.start || ev.startDateTime || ev.dateTime || "";
    if (ev.allDay) {
      var m = String(start).match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : "";
    }
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date(eventStartMs(ev)));
    } catch (e) {
      var m2 = String(start).match(/^(\d{4}-\d{2}-\d{2})/);
      return m2 ? m2[1] : "";
    }
  }

  function addDaysIso(iso, days) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return "";
    var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function dowShortFromIso(iso) {
    try {
      var parts = String(iso).split("-");
      var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0));
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago", weekday: "short"
      }).format(d);
    } catch (e) {
      return "";
    }
  }

  /* SOFTGONE1 · placeholders never get the big card or a countdown */
  var SOFT_TITLE = /(^\s*[\[(]?\s*(cancel+ed|cxl|done|backup|tentative)\b)|\btbd\b|\bcancel if\b/i;
  function listEvents(cal) {
    var l = (cal && (cal.upcomingLeaves || cal.events)) || [];
    return l.filter(function (e) { return !(e && SOFT_TITLE.test(String(e.summary || e.title || ""))); });
  }

  /** First future event by start (> now). */
  function pickNextFuture(cal, nowMs) {
    nowMs = nowMs || Date.now();
    var list = listEvents(cal);
    var future = [];
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      if (ev.allDay) continue; /* next hero prefers timed leave */
      var ms = eventStartMs(ev);
      if (ms > nowMs) future.push(ev);
    }
    future.sort(function (a, b) { return eventStartMs(a) - eventStartMs(b); });
    if (!future.length) {
      /* fall back: any future including all-day tomorrow */
      for (var j = 0; j < list.length; j++) {
        var ms2 = eventStartMs(list[j]);
        if (ms2 > nowMs) future.push(list[j]);
      }
      future.sort(function (a, b) { return eventStartMs(a) - eventStartMs(b); });
    }
    if (!future.length) return null;
    var first = future[0];
    var firstMs = eventStartMs(first);
    for (var k = 0; k < future.length; k++) {
      if (eventStartMs(future[k]) !== firstMs) break;
      if (future[k].busy) return future[k];
    }
    return first;
  }

  function remainingToday(cal, clock, nowMs) {
    nowMs = nowMs || Date.now();
    var today = clock.iso;
    var out = [];
    var list = listEvents(cal);
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      if (eventDayIso(ev) !== today) continue;
      if (ev.allDay) {
        /* all-day today: show while day is current */
        out.push(ev);
        continue;
      }
      if (eventStartMs(ev) > nowMs) out.push(ev);
    }
    out.sort(function (a, b) {
      var ka = isKidActivity(a) ? 0 : (isNoiseEvent(a) ? 2 : 1);
      var kb = isKidActivity(b) ? 0 : (isNoiseEvent(b) ? 2 : 1);
      if (ka !== kb) return ka - kb;
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return eventStartMs(a) - eventStartMs(b);
    });
    return preferKidItems(out, MAX_TODAY);
  }

  function tomorrowPeek(cal, clock) {
    var tmr = addDaysIso(clock.iso, 1);
    var list = listEvents(cal);
    var kid = [];
    var busy = [];
    var allday = [];
    var other = [];
    var noise = [];
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      if (eventDayIso(ev) !== tmr) continue;
      if (ev.allDay) {
        if (isKidActivity(ev)) kid.push(ev);
        else allday.push(ev);
      } else if (isNoiseEvent(ev)) {
        noise.push(ev);
      } else if (isKidActivity(ev)) {
        kid.push(ev);
      } else if (ev.busy) {
        busy.push(ev);
      } else {
        other.push(ev);
      }
    }
    kid.sort(sortByStart);
    busy.sort(sortByStart);
    other.sort(sortByStart);
    noise.sort(sortByStart);
    /* Kid/school/sports first · errands last · never drop kid rows for noise */
    var merged = kid.concat(allday).concat(busy).concat(other).concat(noise);
    return { day: tmr, dow: dowShortFromIso(tmr), items: preferKidItems(merged, MAX_TOMORROW) };
  }

  function stripFromEvent(ev, clock) {
    if (!ev) {
      return {
        label: "Schedule · today",
        time: "",
        place: "Clear · no future on glass",
        detailHtml: "Calendar window empty · America/Chicago",
        badge: clock.dow
      };
    }
    var startMs = eventStartMs(ev);
    var startIsoDay = eventDayIso(ev) || clock.iso;
    var isToday = startIsoDay === clock.iso;
    var dow = clock.dow;
    try {
      dow = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago", weekday: "short"
      }).format(new Date(startMs));
    } catch (e2) { /* keep */ }
    var place = shortPlace(ev.summary || ev.place || "", ev._merged ? 120 : 64);
    var time = ev.allDay ? "day" : (clockTimeFromIso(ev.start) || "");
    return {
      label: isToday ? "Schedule · today" : ("Schedule · " + dow),
      _dayIso: startIsoDay,
      _dow: dow,
      time: time === "day" ? "" : time,
      place: place,
      detailHtml: "<strong>" + esc(time) + "</strong> " +
        esc(place) +
        (ev.location ? (" · " + esc(String(ev.location).split(",")[0])) : ""),
      badge: isToday ? clock.dow : dow
    };
  }

  function staleStrip(clock, reason) {
    return {
      label: "Schedule · today",
      time: "",
      place: "CAL STALE",
      detailHtml: esc(reason || "cal-live missing"),
      badge: clock.dow,
      _stale: true,
      _reason: reason || "cal-live missing",
      today: [],
      tomorrow: { day: "", dow: "", items: [] }
    };
  }

  function calIsFresh(cal, clock) {
    if (!cal) return { ok: false, reason: "cal-live missing" };
    if (cal.status === "error") {
      return { ok: false, reason: "cal error: " + (cal.error || "unknown") };
    }
    if (cal.status === "stale") {
      return { ok: false, reason: "cal-live status stale" };
    }
    if (cal.status !== "live") {
      return { ok: false, reason: "cal-live status " + (cal.status || "unknown") };
    }
    if (ageMs(cal) >= CAL_FRESH_MS) {
      return { ok: false, reason: "cal-live aged out · >6h" };
    }
    if (cal.asOfIso && clock && cal.asOfIso !== clock.iso) {
      return {
        ok: false,
        reason: "facts as-of " + cal.asOfIso + " · clock " + clock.iso
      };
    }
    return { ok: true, reason: null };
  }

  function futureLeaves(cal, nowMs, limit) {
    nowMs = nowMs || Date.now();
    limit = limit || 10;
    var list = listEvents(cal);
    var future = [];
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      if (ev.allDay) continue;
      var ms = eventStartMs(ev);
      if (ms > nowMs) future.push(ev);
    }
    future.sort(function (a, b) { return eventStartMs(a) - eventStartMs(b); });
    return future.slice(0, limit);
  }

  /* BOTHKIDS1 · same-start events share the hero (both boys always shown) */
  function mergeSameStart(cal, next) {
    if (!next || next.allDay) return next;
    var ms = eventStartMs(next);
    var same = listEvents(cal).filter(function (e) { return !e.allDay && eventStartMs(e) === ms; });
    if (same.length < 2) return next;
    var rx = /^\s*([A-Z][a-z]+)\s*[—–-]\s*([^:]+):\s*(.+)$/;
    var parts = same.map(function (e) { return String(e.summary || "").match(rx); });
    var summary;
    if (parts.every(function (m) { return m && m[2].trim() === parts[0][2].trim(); })) {
      summary = parts.map(function (m) { return m[1]; }).join(" + ") + " — " + parts[0][2].trim() + ": " +
        parts.map(function (m) { return m[1] + " " + m[3].trim(); }).join(" · ");
    } else {
      summary = same.map(function (e) { return String(e.summary || ""); }).join(" · ");
    }
    var out = {};
    for (var k in next) out[k] = next[k];
    out.summary = summary;
    out._merged = same.length;
    return out;
  }

  function pickStripFromCal(cal, clock) {
    var next = mergeSameStart(cal, pickNextFuture(cal, Date.now()));
    var strip = next
      ? stripFromEvent(next, clock)
      : {
          label: "Schedule · today",
          time: "",
          place: "Clear · no future on glass",
          detailHtml: "No upcoming events in cal-live window",
          badge: clock.dow
        };
    strip.today = remainingToday(cal, clock, Date.now());
    strip.tomorrow = tomorrowPeek(cal, clock);
    strip.future = futureLeaves(cal, Date.now(), 10);
    return strip;
  }

  var LAYOUT_KEY = "wardos.leaveby.layout.v2"; /* SCHEDDAY1 · fresh key so Day is default */
  var LAYOUTS = ["day", "rail", "who", "peek", "radar", "list"];
  var LAYOUT_LABELS = {
    day: "Day",
    rail: "Rail",
    who: "Who",
    peek: "Peek",
    radar: "Radar",
    list: "List"
  };
  var _lastStrip = null;
  var _lastClock = null;
  var _layoutBound = false;

  function getLayout() {
    try {
      var v = localStorage.getItem(LAYOUT_KEY) || "day";
      if (LAYOUTS.indexOf(v) >= 0) return v;
    } catch (e) { /* private mode */ }
    return "day";
  }

  function syncChipUI(id) {
    var root = document.querySelector(".leaveby");
    if (root) root.setAttribute("data-layout", id);
    var canvas = document.querySelector("[data-live='leaveby-layouts']");
    if (canvas) canvas.setAttribute("data-layout", id);
    document.querySelectorAll("[data-live='leaveby-switch'] [data-layout]").forEach(function (btn) {
      var on = btn.getAttribute("data-layout") === id;
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.classList.toggle("is-on", on);
    });
    var modeEl = document.querySelector("[data-live='leaveby-mode']");
    if (modeEl) modeEl.textContent = LAYOUT_LABELS[id] || id;
  }

  function setLayout(id) {
    if (LAYOUTS.indexOf(id) < 0) id = "day";
    try { localStorage.setItem(LAYOUT_KEY, id); } catch (e2) { /* ignore */ }
    syncChipUI(id);
    if (_lastStrip && _lastClock) paintLayouts(_lastStrip, _lastClock, id);
  }

  function cycleLayout(dir) {
    var cur = getLayout();
    var i = LAYOUTS.indexOf(cur);
    if (i < 0) i = LAYOUTS.indexOf("list");
    if (i < 0) i = 0;
    var next = LAYOUTS[(i + dir + LAYOUTS.length) % LAYOUTS.length];
    setLayout(next);
  }

  function bindSwipeCycle(root) {
    if (!root || root.getAttribute("data-swipe-bound") === "1") return;
    root.setAttribute("data-swipe-bound", "1");
    var startX = 0;
    var startY = 0;
    var startT = 0;
    var tracking = false;
    var pid = null;

    function onDown(ev) {
      /* chips handle their own picks · don't steal */
      if (ev.target && ev.target.closest && ev.target.closest(".leaveby-chip")) return;
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      tracking = true;
      pid = ev.pointerId;
      startX = ev.clientX;
      startY = ev.clientY;
      startT = Date.now();
      try { root.setPointerCapture && root.setPointerCapture(ev.pointerId); } catch (eCap) { /* ok */ }
    }
    function onUp(ev) {
      if (!tracking) return;
      if (pid != null && ev.pointerId !== pid) return;
      tracking = false;
      var dx = ev.clientX - startX;
      var dy = ev.clientY - startY;
      var dt = Date.now() - startT;
      pid = null;
      if (dt > 900) return;
      if (Math.abs(dx) < 48) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.15) return; /* vertical scroll wins */
      try {
        if (global.HouseSfx && HouseSfx.unlockAudio) HouseSfx.unlockAudio();
        if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap();
      } catch (e3) { /* ok */ }
      /* swipe · CTRLPANEL1 SFX */
      cycleLayout(dx < 0 ? 1 : -1);
    }
    function onCancel() {
      tracking = false;
      pid = null;
    }
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onCancel);
  }

  function bindLayoutSwitcher() {
    if (_layoutBound) return;
    var bar = document.querySelector("[data-live='leaveby-switch']");
    if (!bar) return;
    _layoutBound = true;
    var lastPickAt = 0;
    function onPick(ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-layout]") : null;
      if (!btn || !bar.contains(btn)) return;
      var id = btn.getAttribute("data-layout");
      if (!id) return;
      var now = Date.now();
      if (now - lastPickAt < 350) return; /* pointerdown+click debounce */
      lastPickAt = now;
      try { if (ev.cancelable) ev.preventDefault(); } catch (ePrev) { /* ok */ }
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e3) { /* ok */ }
      setLayout(id);
    }
    /* pointerdown first on Elo/touch · click as fallback */
    bar.addEventListener("pointerdown", onPick);
    bar.addEventListener("click", onPick);

    /* one swipe surface only · nested binds would triple-cycle on bubble */
    var leaveby = document.querySelector(".leaveby.leaveby--hot, .leaveby.leaveby--cmd, .leaveby");
    var canvas = document.querySelector("[data-live='leaveby-layouts']");
    bindSwipeCycle(leaveby || canvas);

    setLayout(getLayout());
  }

  function whoNames(ev) {
    var s = notOurs((ev && (ev.summary || ev.place)) || "");
    var out = [];
    if (/\bAinsley\b/i.test(s)) out.push("Ainsley");
    if (/\bHayes\b/i.test(s)) out.push("Hayes");
    if (/\bHarris\b/i.test(s)) out.push("Harris");
    if (/\bBoys\b/i.test(s) || /\bboth\s+boys\b/i.test(s)) {
      if (out.indexOf("Hayes") < 0) out.push("Hayes");
      if (out.indexOf("Harris") < 0) out.push("Harris");
    }
    if (/\b(?:Dan|Dad|Hank)\b/i.test(s)) out.push("Dan");
    if (!out.length) out.push("Dan");
    return out;
  }

  function upcomingFlat(strip, limit) {
    limit = limit || 12;
    var out = [];
    var today = (strip && strip.today) || [];
    var tmr = (strip && strip.tomorrow && strip.tomorrow.items) || [];
    var future = (strip && strip.future) || [];
    var i;
    for (i = 0; i < today.length; i++) out.push({ ev: today[i], when: "today" });
    for (i = 0; i < tmr.length; i++) out.push({ ev: tmr[i], when: "tmr" });
    /* Evening / empty today+tmr window: still paint real next leaves from cal-live */
    if (!out.length && future.length) {
      for (i = 0; i < future.length; i++) out.push({ ev: future[i], when: "soon" });
    } else if (today.length < 2 && future.length) {
      /* thin today: append near-term future not already listed */
      var seen = {};
      for (i = 0; i < out.length; i++) {
        seen[(out[i].ev.start || "") + "|" + (out[i].ev.summary || "")] = 1;
      }
      for (i = 0; i < future.length && out.length < limit; i++) {
        var key = (future[i].start || "") + "|" + (future[i].summary || "");
        if (seen[key]) continue;
        out.push({ ev: future[i], when: "soon" });
      }
    }
    var evs = out.map(function (x) { return x.ev; });
    var preferred = preferKidItems(evs, limit);
    var preferSet = {};
    for (var p = 0; p < preferred.length; p++) {
      preferSet[(preferred[p].start || "") + "|" + (preferred[p].summary || "")] = 1;
    }
    var filtered = [];
    for (var f = 0; f < out.length; f++) {
      var fk = (out[f].ev.start || "") + "|" + (out[f].ev.summary || "");
      if (preferSet[fk]) filtered.push(out[f]);
    }
    /* keep original order among preferred */
    return filtered.slice(0, Math.max(limit, preferred.length));
  }

  function minsUntil(ev) {
    if (!ev || ev.allDay) return null;
    var ms = eventStartMs(ev) - Date.now();
    if (!Number.isFinite(ms)) return null;
    return Math.max(0, Math.round(ms / 60000));
  }

  function fmtMins(m) {
    if (m == null) return "—";
    if (m < 60) return m + "m";
    var h = Math.floor(m / 60);
    var r = m % 60;
    return r ? (h + "h " + r + "m") : (h + "h");
  }

  function rowHtml(ev, isNext) {
    var title = shortPlace(ev.summary || ev.place || "");
    var timeLab = ev.allDay ? "day" : (clockTimeFromIso(ev.start) || "—");
    var cls = "leaveby-row" + (isNext ? " is-next" : "") + (ev.allDay ? " is-allday" : "");
    return '<li class="' + cls + '">' +
      '<span class="leaveby-row-time">' + esc(timeLab) + "</span>" +
      '<span class="leaveby-row-title">' + esc(title) + "</span>" +
      "</li>";
  }

  function paintLists(strip) {
    var todayEl = document.querySelector("[data-live='leaveby-today']");
    var tmrEl = document.querySelector("[data-live='leaveby-tomorrow']");
    var tmrLab = document.querySelector("[data-live='leaveby-tmr-label']");

    var today = (strip && strip.today) || [];
    var tmr = (strip && strip.tomorrow) || { items: [], dow: "" };

    if (todayEl) {
      if (strip && strip._stale) {
        todayEl.innerHTML = '<li class="leaveby-empty">CAL STALE</li>';
      } else if (!today.length) {
        todayEl.innerHTML = '<li class="leaveby-empty">Clear · nothing left today</li>';
      } else {
        var html = "";
        for (var i = 0; i < today.length; i++) {
          html += rowHtml(today[i], i === 0 && !today[i].allDay);
        }
        todayEl.innerHTML = html;
      }
    }

    if (tmrLab) {
      tmrLab.textContent = tmr.dow
        ? ("Tomorrow · " + tmr.dow)
        : "Tomorrow";
    }
    if (tmrEl) {
      if (strip && strip._stale) {
        tmrEl.innerHTML = '<li class="leaveby-empty">—</li>';
      } else if (!tmr.items || !tmr.items.length) {
        tmrEl.innerHTML = '<li class="leaveby-empty">Clear on glass</li>';
      } else {
        var th = "";
        for (var j = 0; j < tmr.items.length; j++) {
          th += rowHtml(tmr.items[j], false);
        }
        tmrEl.innerHTML = th;
      }
    }
  }

  function layoutRail(strip) {
    var items = upcomingFlat(strip, 7);
    if (strip && strip._stale) {
      return '<div class="lb-layout lb-rail"><div class="lb-empty">CAL STALE</div></div>';
    }
    if (!items.length) {
      return '<div class="lb-layout lb-rail"><div class="lb-empty">Clear on glass</div></div>';
    }
    var html = '<div class="lb-layout lb-rail" aria-label="Timeline rail"><div class="lb-rail-spine">';
    for (var i = 0; i < items.length; i++) {
      var ev = items[i].ev;
      var timeLab = ev.allDay ? "day" : (clockTimeFromIso(ev.start) || "—");
      var title = shortPlace(ev.summary || ev.place || "");
      var cls = "lb-rail-item" + (i === 0 ? " is-next" : "") +
        (items[i].when === "tmr" ? " is-tmr" : "");
      html += '<div class="' + cls + '">' +
        '<span class="lb-rail-dot" aria-hidden="true"></span>' +
        '<span class="lb-rail-time">' + esc(timeLab) + "</span>" +
        '<span class="lb-rail-pill">' + esc(title) + "</span>" +
        "</div>";
    }
    html += "</div></div>";
    return html;
  }

  function layoutWho(strip) {
    var order = ["Hayes", "Ainsley", "Harris", "Dan"];
    var buckets = { Hayes: [], Ainsley: [], Harris: [], Dan: [] };
    var items = upcomingFlat(strip, 12);
    if (strip && strip._stale) {
      return '<div class="lb-layout lb-who"><div class="lb-empty">CAL STALE</div></div>';
    }
    for (var i = 0; i < items.length; i++) {
      var names = whoNames(items[i].ev);
      for (var n = 0; n < names.length; n++) {
        if (buckets[names[n]] && buckets[names[n]].length < 3) {
          buckets[names[n]].push(items[i]);
        }
      }
    }
    var html = '<div class="lb-layout lb-who" aria-label="Who is next">';
    var any = false;
    for (var o = 0; o < order.length; o++) {
      var person = order[o];
      var list = buckets[person];
      if (!list.length) continue;
      any = true;
      html += '<div class="lb-who-group" data-who="' + esc(person) + '">' +
        '<div class="lb-who-name">' + esc(person) + "</div>" +
        '<div class="lb-who-rows">';
      for (var j = 0; j < list.length; j++) {
        var ev2 = list[j].ev;
        var t2 = ev2.allDay ? "day" : (clockTimeFromIso(ev2.start) || "—");
        var title2 = shortPlace(ev2.summary || ev2.place || "");
        html += '<div class="lb-who-row' + (j === 0 ? " is-next" : "") + '">' +
          '<span class="lb-who-time">' + esc(t2) + "</span>" +
          '<span class="lb-who-title">' + esc(title2) + "</span>" +
          "</div>";
      }
      html += "</div></div>";
    }
    if (!any) html += '<div class="lb-empty">Clear on glass</div>';
    html += "</div>";
    return html;
  }

  function layoutPeek(strip) {
    var items = upcomingFlat(strip, 3);
    if (strip && strip._stale) {
      return '<div class="lb-layout lb-peek"><div class="lb-empty">CAL STALE</div></div>';
    }
    if (!items.length) {
      return '<div class="lb-layout lb-peek"><div class="lb-empty">Clear on glass</div></div>';
    }
    var first = items[0].ev;
    var t0 = first.allDay ? "day" : (clockTimeFromIso(first.start) || "—");
    var html = '<div class="lb-layout lb-peek" aria-label="Next plus peek">' +
      '<div class="lb-peek-hero">' +
      '<span class="lb-peek-kicker">Next</span>' +
      '<span class="lb-peek-time">' + esc(t0) + "</span>" +
      '<span class="lb-peek-title">' + esc(shortPlace(first.summary || first.place || "")) + "</span>" +
      "</div>";
    if (items.length > 1) {
      html += '<div class="lb-peek-quiet">';
      for (var i = 1; i < items.length; i++) {
        var ev = items[i].ev;
        var t = ev.allDay ? "day" : (clockTimeFromIso(ev.start) || "—");
        html += '<div class="lb-peek-row">' +
          '<span class="lb-peek-row-time">' + esc(t) + "</span>" +
          '<span class="lb-peek-row-title">' + esc(shortPlace(ev.summary || ev.place || "")) + "</span>" +
          "</div>";
      }
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function layoutRadar(strip) {
    if (strip && strip._stale) {
      return '<div class="lb-layout lb-radar"><div class="lb-empty">CAL STALE</div></div>';
    }
    var items = upcomingFlat(strip, 1);
    if (!items.length) {
      return '<div class="lb-layout lb-radar"><div class="lb-empty">Clear on glass</div></div>';
    }
    var ev = items[0].ev;
    var mins = minsUntil(ev);
    var title = shortPlace(ev.summary || ev.place || "");
    var timeLab = ev.allDay ? "day" : (clockTimeFromIso(ev.start) || "—");
    var windowM = 180;
    var pct = mins == null ? 0 : Math.max(0, Math.min(1, 1 - (mins / windowM)));
    var r = 42;
    var c = 2 * Math.PI * r;
    var dash = (pct * c).toFixed(1);
    var gap = (c - pct * c).toFixed(1);
    var html = '<div class="lb-layout lb-radar" aria-label="Countdown radar">' +
      '<div class="lb-radar-ring" aria-hidden="true">' +
      '<svg viewBox="0 0 100 100" width="96" height="96">' +
      '<circle class="lb-radar-track" cx="50" cy="50" r="' + r + '" fill="none" stroke-width="8"/>' +
      '<circle class="lb-radar-prog" cx="50" cy="50" r="' + r + '" fill="none" stroke-width="8" ' +
      'stroke-dasharray="' + dash + " " + gap + '" transform="rotate(-90 50 50)"/>' +
      '<text class="lb-radar-mins" x="50" y="54" text-anchor="middle">' + esc(fmtMins(mins)) + "</text>" +
      "</svg></div>" +
      '<div class="lb-radar-line">' +
      '<span class="lb-radar-time">' + esc(timeLab) + "</span>" +
      '<span class="lb-radar-title">' + esc(title) + "</span>" +
      "</div></div>";
    return html;
  }

  function layoutList(strip) {
    /* REFINE CURRENT · tighter remaining + tomorrow peek */
    var today = (strip && strip.today) || [];
    var tmr = (strip && strip.tomorrow) || { items: [], dow: "" };
    if (strip && strip._stale) {
      return '<div class="lb-layout lb-list"><div class="lb-empty">CAL STALE</div></div>';
    }
    var html = '<div class="lb-layout lb-list" aria-label="Schedule list">';
    html += '<div class="lb-list-sec"><div class="lb-list-hdr">Remaining</div><ul class="lb-list-ul">';
    if (!today.length) {
      html += '<li class="lb-empty">Clear · nothing left today</li>';
    } else {
      for (var i = 0; i < today.length; i++) {
        var ev = today[i];
        var t = ev.allDay ? "day" : (clockTimeFromIso(ev.start) || "—");
        html += '<li class="lb-list-row' + (i === 0 && !ev.allDay ? " is-next" : "") + '">' +
          '<span class="lb-list-time">' + esc(t) + "</span>" +
          '<span class="lb-list-title">' + esc(shortPlace(ev.summary || ev.place || "")) + "</span>" +
          "</li>";
      }
    }
    html += "</ul></div>";
    html += '<div class="lb-list-sec lb-list-sec--tmr"><div class="lb-list-hdr">' +
      esc(tmr.dow ? ("Tmr · " + tmr.dow) : "Tomorrow") +
      '</div><ul class="lb-list-ul">';
    if (!tmr.items || !tmr.items.length) {
      html += '<li class="lb-empty">Clear on glass</li>';
    } else {
      /* Show every kid/school/sports row · soft-cap only after those */
      var showTmr = preferKidItems(tmr.items, Math.max(8, tmr.items.length));
      for (var j = 0; j < showTmr.length; j++) {
        var ev2 = showTmr[j];
        var t2 = ev2.allDay ? "day" : (clockTimeFromIso(ev2.start) || "—");
        html += '<li class="lb-list-row">' +
          '<span class="lb-list-time">' + esc(t2) + "</span>" +
          '<span class="lb-list-title">' + esc(shortPlace(ev2.summary || ev2.place || "")) + "</span>" +
          "</li>";
      }
    }
    html += "</ul></div></div>";
    return html;
  }

  /* SCHEDDAY1 · glance layout: Morning / Afternoon / Evening columns,
     big time per stop, kid color tags, prep folded into the next leave */
  var DAY_CSS = [
    ".lb-day{display:flex;flex-direction:column;gap:8px}",
    ".lb-day-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}",
    ".lb-day-col{background:rgba(255,255,255,.04);border:1px solid rgba(255,224,128,.14);border-radius:12px;padding:6px 7px;min-width:0}",
    ".lb-day-col.is-past{opacity:.35}",
    ".lb-day-col.is-now{border-color:rgba(255,224,128,.55);box-shadow:0 0 18px rgba(255,180,30,.18)}",
    ".lb-day-part{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ffe080;margin:0 0 4px}",
    ".lb-day-stop{display:flex;flex-direction:column;padding:4px 0 5px;border-top:1px solid rgba(255,255,255,.07)}",
    ".lb-day-stop:first-of-type{border-top:0}",
    ".lb-day-t{font-size:20px;font-weight:900;letter-spacing:-.04em;line-height:1;color:#f2eee6}",
    ".lb-day-stop.is-next .lb-day-t{color:#ffe080;text-shadow:0 0 16px rgba(255,180,30,.5)}",
    ".lb-day-what{font-size:12px;font-weight:700;color:#e8e2d6;line-height:1.2;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}",
    ".lb-day-tags{display:flex;flex-wrap:wrap;gap:3px;margin-top:3px}",
    ".lb-day-tag{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:1px 5px;border-radius:6px;background:rgba(255,255,255,.1);color:#f2eee6}",
    ".lb-day-tag[data-who=Ainsley]{background:rgba(236,72,153,.28);color:#ffd1e8}",
    ".lb-day-tag[data-who=Hayes]{background:rgba(56,152,255,.28);color:#cfe6ff}",
    ".lb-day-tag[data-who=Harris]{background:rgba(52,199,120,.28);color:#c9f5dc}",
    ".lb-day-tag[data-who=Dan]{background:rgba(255,224,128,.18);color:#ffe9a8}",
    ".lb-day-prep{font-size:10px;color:#bdb6a8;margin-top:2px}",
    ".lb-day-none{font-size:11px;color:#8d877c;padding:4px 0}",
    ".lb-day-tmr{display:flex;flex-wrap:wrap;align-items:center;gap:5px;font-size:11px;color:#d8d2c6}",
    ".lb-day-tmr b{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#ffe080;margin-right:2px}",
    ".lb-day-tchip{background:rgba(255,255,255,.06);border-radius:8px;padding:2px 7px;white-space:nowrap}",
    ".lb-day-tchip strong{color:#f2eee6;margin-right:4px}"
  ].join("\n");

  function ensureDayCss() {
    if (document.getElementById("sched-day1")) return;
    var st = document.createElement("style");
    st.id = "sched-day1";
    st.textContent = DAY_CSS;
    document.head.appendChild(st);
  }

  var PREP_RE = /^\s*(?:[A-Za-z+ ]+[—-]\s*)?(?:pack|snacks?|get|buy|bring|remind)\b/i;
  function isPrep(ev) {
    var s = String((ev && ev.summary) || "");
    return PREP_RE.test(s.replace(/^(?:Hayes|Harris|Ainsley|Boys|Dan)(?:\s*\+\s*\w+)?\s*[—-]\s*/i, ""));
  }

  function ctHour(iso) {
    var t = clockTimeFromIso(iso) || "";
    var m = /^(\d{1,2}):(\d{2})\s*([AP])M/i.exec(t);
    if (!m) return null;
    var h = parseInt(m[1], 10) % 12;
    if (/p/i.test(m[3])) h += 12;
    return h + parseInt(m[2], 10) / 60;
  }

  function nowCtHour() {
    return ctHour(new Date().toISOString());
  }

  function dayTitle(ev) {
    var s = shortPlace(ev.summary || ev.place || "");
    /* drop leading kid names — the tags carry who */
    var out = s.replace(/^(?:(?:Hayes|Harris|Ainsley|Boys|Dan)\s*(?:\+\s*)?)+\s*[—-]\s*/i, "") || s;
    /* time is already big on the left · drop echoed "leave 5:40 · 6:00" / "· 8:25" tails and Free/HOLD chrome */
    out = out.replace(/\s*·\s*leave\s+\d{1,2}:\d{2}.*$/i, "")
      .replace(/^Free\s*[·—-]\s*/i, "")
      .replace(/\s*·\s*HOLD\b.*$/i, "");
    return out || s;
  }

  function shortTime(iso) {
    var t = clockTimeFromIso(iso) || "—";
    return t.replace(/\s*([AP])M$/i, function (_, ap) { return ap.toLowerCase(); });
  }

  function stopHtml(ev, isNext, prepList) {
    var who = whoNames(ev);
    var tags = "";
    for (var i = 0; i < who.length; i++) {
      tags += '<span class="lb-day-tag" data-who="' + esc(who[i]) + '">' + esc(who[i]) + "</span>";
    }
    var prep = "";
    if (prepList && prepList.length) {
      prep = '<div class="lb-day-prep">Before: ' + esc(prepList.map(dayTitle).join(" · ")) + "</div>";
    }
    return '<div class="lb-day-stop' + (isNext ? " is-next" : "") + '">' +
      '<span class="lb-day-t">' + esc(ev.allDay ? "All day" : shortTime(ev.start)) + "</span>" +
      '<span class="lb-day-what">' + esc(dayTitle(ev)) + "</span>" +
      '<div class="lb-day-tags">' + tags + "</div>" + prep + "</div>";
  }

  function layoutDay(strip) {
    ensureDayCss();
    if (strip && strip._stale) {
      return '<div class="lb-layout lb-day"><div class="lb-empty">CAL STALE</div></div>';
    }
    var today = ((strip && strip.today) || []).slice();
    var parts = [
      { key: "am", label: "Morning", from: 0, to: 12, items: [] },
      { key: "pm", label: "Afternoon", from: 12, to: 17, items: [] },
      { key: "eve", label: "Evening", from: 17, to: 24, items: [] }
    ];
    /* fold prep rows into the next real stop */
    var pending = [];
    var stops = [];
    for (var i = 0; i < today.length; i++) {
      var ev = today[i];
      if (!ev.allDay && isPrep(ev)) { pending.push(ev); continue; }
      stops.push({ ev: ev, prep: pending });
      pending = [];
    }
    if (pending.length) {
      for (var k = 0; k < pending.length; k++) stops.push({ ev: pending[k], prep: [] });
    }
    var nextSet = false;
    for (var j = 0; j < stops.length; j++) {
      var h = stops[j].ev.allDay ? 0 : ctHour(stops[j].ev.start);
      if (h == null) h = 0;
      for (var p = 0; p < parts.length; p++) {
        if (h >= parts[p].from && h < parts[p].to) { parts[p].items.push(stops[j]); break; }
      }
    }
    for (var ps = 0; ps < parts.length; ps++) {
      parts[ps].items.sort(function (a, b) {
        if (a.ev.allDay !== b.ev.allDay) return a.ev.allDay ? -1 : 1;
        return eventStartMs(a.ev) - eventStartMs(b.ev);
      });
    }
    var nowH = nowCtHour();
    var html = '<div class="lb-layout lb-day" aria-label="Today at a glance"><div class="lb-day-cols">';
    for (var q = 0; q < parts.length; q++) {
      var part = parts[q];
      var cls = "lb-day-col";
      if (nowH != null && nowH >= part.to && !part.items.length) cls += " is-past";
      if (nowH != null && nowH >= part.from && nowH < part.to) cls += " is-now";
      html += '<div class="' + cls + '"><div class="lb-day-part">' + part.label + "</div>";
      if (!part.items.length) {
        html += '<div class="lb-day-none">' + (nowH != null && nowH >= part.to ? "Done" : "Open") + "</div>";
      }
      for (var r = 0; r < part.items.length; r++) {
        var isNext = !nextSet && !part.items[r].ev.allDay;
        if (isNext) nextSet = true;
        html += stopHtml(part.items[r].ev, isNext, part.items[r].prep);
      }
      html += "</div>";
    }
    html += "</div>";
    var tmr = (strip && strip.tomorrow) || { items: [], dow: "" };
    html += '<div class="lb-day-tmr"><b>' + esc(tmr.dow ? ("Tmr " + tmr.dow) : "Tomorrow") + "</b>";
    var tItems = (tmr.items || []).filter(function (e) { return e.allDay || !isPrep(e); });
    if (!tItems.length) {
      html += '<span class="lb-day-tchip">Clear</span>';
    } else {
      var showT = preferKidItems(tItems, 6);
      for (var t = 0; t < showT.length; t++) {
        var e2 = showT[t];
        html += '<span class="lb-day-tchip"><strong>' + esc(e2.allDay ? "Day" : shortTime(e2.start)) + "</strong>" +
          esc(dayTitle(e2)) + "</span>";
      }
    }
    html += "</div></div>";
    return html;
  }

  /* KIDPAGES1 · CLIP rule on the leave-by card: tomorrow's chips that would run past the card's box leave, last first
     (never half a chip, never an ellipsis); if even one does not fit, the Tmr row leaves. */
  function fitStrip(el) {
    try {
      var box = el.closest(".leaveby-body") || el, br = box.getBoundingClientRect();
      if (!br.height) return;
      var past = function (n) { var r = n.getBoundingClientRect(); return r.bottom > br.bottom + 1 || r.right > br.right + 1; };
      for (var k = 0; k < 12; k++) {
        var chips = el.querySelectorAll(".lb-day-tmr .lb-day-tchip"), last = chips[chips.length - 1];
        var over = box.scrollHeight > box.clientHeight + 1 || (last && past(last));
        if (!over) return;
        if (chips.length > 1) { last.parentNode.removeChild(last); continue; }
        var row = el.querySelector(".lb-day-tmr"); if (row) row.parentNode.removeChild(row);
        return;
      }
    } catch (e) { /* layout only */ }
  }

  function paintLayouts(strip, clock, mode) {
    var el = document.querySelector("[data-live='leaveby-layouts']");
    if (!el) {
      paintLists(strip);
      return;
    }
    mode = mode || getLayout();
    var html;
    if (mode === "day") html = layoutDay(strip);
    else if (mode === "rail") html = layoutRail(strip);
    else if (mode === "who") html = layoutWho(strip);
    else if (mode === "peek") html = layoutPeek(strip);
    else if (mode === "radar") html = layoutRadar(strip);
    else html = layoutList(strip);
    var banner = '<div class="lb-mode-banner" aria-live="polite">Layout · <strong>' +
      esc(LAYOUT_LABELS[mode] || mode) + "</strong></div>";
    el.innerHTML = banner + html;
    el.setAttribute("data-layout", mode);
    fitStrip(el); setTimeout(function () { fitStrip(el); }, 350);
    syncChipUI(mode);
    paintLists(strip); /* keep legacy nodes in sync if present */
  }

  function applyStrip(strip, clock) {
    var main = document.querySelector("[data-live='leaveby-main']");
    var detail = document.querySelector("[data-live='leaveby-detail']");
    var badge = document.querySelector("[data-live='leaveby-badge']");
    var label = document.querySelector("[data-live='leaveby-label']");
    var todaySub = document.querySelector("[data-live='today-sub']");
    var dateNodes = document.querySelectorAll("[data-live='date-short']");
    var longNodes = document.querySelectorAll("[data-live='date-long']");
    var dowNodes = document.querySelectorAll("[data-live='dow']");
    var warn = document.querySelector("[data-live='asof-warn']");

    dateNodes.forEach(function (n) { n.textContent = clock.short; });
    /* HUBFMT1 · date-long under big DOW = "Sep 28, 2026" (no weekday echo) */
    longNodes.forEach(function (n) {
      n.textContent = clock.dateLine || (global.HouseClock && HouseClock.dateLine
        ? HouseClock.dateLine()
        : clock.long);
    });
    dowNodes.forEach(function (n) { n.textContent = clock.dow; });
    var timeNodes = document.querySelectorAll("[data-live='time'], [data-live-clock], [data-live='clock-time']");
    timeNodes.forEach(function (n) {
      n.textContent = clock.time || (global.HouseClock && HouseClock.timeLabel ? HouseClock.timeLabel() : "");
    });

    /* AUDIT1 · hero names its day when the next item is not today ("Next up · Wed" / "Wed") */
    var notToday = !strip._stale && strip._dayIso && clock && strip._dayIso !== clock.iso;
    var isTodayEv = !strip._stale && strip._dayIso && clock && strip._dayIso === clock.iso;
    if (label) label.textContent = notToday ? ("Next up · " + strip._dow) : (isTodayEv ? "Next up · Today" : "");
    if (badge) badge.textContent = notToday ? strip._dow : (isTodayEv ? "Today" : "");
    if (todaySub) todaySub.textContent = clock.short + " · " + clock.daypart;

    var hotEv = document.querySelector("[data-live='hot-pill-event']");
    if (hotEv) {
      if (strip._stale) hotEv.textContent = "CAL STALE";
      else if (strip.time && strip.place) hotEv.textContent = strip.time + " · " + strip.place;
      else if (strip.place) hotEv.textContent = strip.place;
      else hotEv.textContent = "";
    }

    if (main && !strip._boot) {
      /* HUBCMD2 · pass-by hero = huge time + destination only · no Next/label chrome */
      if (strip._stale) {
        main.innerHTML = '<span class="leaveby-dest">CAL STALE</span>';
      } else if (strip.time && strip.place) {
        /* AUDIT1 · label row hidden on this page (hub) → carry the day as a small kicker in the hero */
        var labHidden = !label || label.offsetParent === null;
        main.innerHTML =
          (notToday && labHidden ? '<span class="leaveby-when">Next up · ' + esc(strip._dow) + "</span>" : "") +
          '<span class="time">' + esc(strip.time) + "</span>" +
          '<span class="leaveby-dest">' + esc(strip.place) + "</span>";
      } else if (strip.place) {
        main.innerHTML = '<span class="leaveby-dest">' + esc(strip.place) + "</span>";
      } else {
        main.innerHTML = '<span class="leaveby-dest">House day</span>';
      }
    }
    if (detail && strip.detailHtml) {
      detail.innerHTML = strip.detailHtml;
    }

    _lastStrip = strip;
    _lastClock = clock;
    bindLayoutSwitcher();
    paintLayouts(strip, clock, getLayout());

    if (warn) {
      if (strip._stale) {
        warn.hidden = false;
        warn.textContent = strip._reason || "CAL STALE";
      } else {
        warn.hidden = true;
        warn.textContent = "";
      }
    }
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    });
  }

  function loadCal(cb) {
    var urls = [
      "data/cal-live.json?v=" + Date.now(),
      "data/cal-live.json"
    ];
    var i = 0;
    function next() {
      if (i >= urls.length) { cb(new Error("cal-live missing"), null); return; }
      var u = urls[i++];
      fetchJson(u).then(function (d) { cb(null, d); })
        .catch(function () { next(); });
    }
    if (typeof fetch !== "function") { cb(new Error("no fetch"), null); return; }
    next();
  }

  function loadWeek(cb) {
    var urls = ["kids-week.json?v=" + Date.now(), "data/kids-week.json", "kids-week.json"];
    var i = 0;
    function next() {
      if (i >= urls.length) { cb(new Error("no week"), null); return; }
      var u = urls[i++];
      fetchJson(u).then(function (d) { cb(null, d); })
        .catch(function () { next(); });
    }
    if (typeof fetch !== "function") { cb(new Error("no fetch"), null); return; }
    next();
  }

  function boot() {
    if (!global.HouseClock) return;
    var clock = HouseClock.now();
    applyStrip({
      label: "Schedule · today",
      time: "",
      place: "",
      _boot: true,
      detailHtml: "America/Chicago · live clock",
      badge: clock.dow,
      today: [],
      tomorrow: { day: "", dow: "", items: [] }
    }, clock);

    loadCal(function (err, cal) {
      var gate = calIsFresh(cal, clock);
      if (!err && gate.ok) {
        applyStrip(pickStripFromCal(cal, clock), clock);
        return;
      }
      var reason = gate.reason || (err && err.message) || "cal-live missing";
      applyStrip(staleStrip(clock, reason), clock);
      loadWeek(function () { /* no-op for strip */ });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* Re-advance Next Up ~ every 60s so past items drop without full reload */
  setInterval(function () {
    if (!global.HouseClock) return;
    loadCal(function (err, cal) {
      var clock = HouseClock.now();
      var gate = calIsFresh(cal, clock);
      if (!err && gate.ok) applyStrip(pickStripFromCal(cal, clock), clock);
    });
  }, 60 * 1000);

  /* SCHEDDAY2 · Dad page (sheet-dan): Day layout for Today + This week */
  var DAN_CSS = [
    ".lb-day.dan-stack .lb-day-cols{grid-template-columns:1fr}",
    ".lb-day.dan-stack .lb-day-col.is-past{display:none}",
    ".lb-wk{display:flex;flex-direction:column;gap:8px}",
    ".lb-wk-day{background:rgba(255,255,255,.04);border:1px solid rgba(255,224,128,.14);border-radius:12px;padding:6px 8px}",
    ".lb-wk-day.is-tmr{border-color:rgba(255,224,128,.4)}",
    ".lb-wk-hd{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ffe080;margin:0 0 3px}",
    ".lb-wk-row{display:grid;grid-template-columns:52px 1fr;gap:6px;align-items:baseline;padding:3px 0;border-top:1px solid rgba(255,255,255,.07)}",
    ".lb-wk-row:first-of-type{border-top:0}",
    ".lb-wk-t{font-size:15px;font-weight:900;letter-spacing:-.03em;color:#f2eee6;white-space:nowrap}",
    ".lb-wk-what{font-size:12px;font-weight:700;color:#e8e2d6;line-height:1.2}",
    ".lb-wk-what .lb-day-tags{display:inline-flex;margin:0 0 0 4px;vertical-align:middle}"
  ].join("\n");
  function ensureDanCss() {
    ensureDayCss();
    if (document.getElementById("sched-day2")) return;
    var st = document.createElement("style");
    st.id = "sched-day2";
    st.textContent = DAN_CSS;
    document.head.appendChild(st);
  }
  var DOW3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function dayLabel(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return iso || "";
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
    return DOW3[d.getUTCDay()] + " " + (+m[3]);
  }
  function layoutWeekDays(cal, clock) {
    ensureDanCss();
    var list = listEvents(cal);
    var by = {}, days = [];
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      var d = eventDayIso(ev);
      if (!d || d <= clock.iso) continue;
      if (!ev.allDay && isPrep(ev)) continue;
      if (!by[d]) { by[d] = []; days.push(d); }
      by[d].push(ev);
    }
    days.sort();
    days = days.slice(0, 6);
    if (!days.length) return '<div class="lb-wk"><div class="lb-day-none">Week is clear</div></div>';
    var html = '<div class="lb-wk" aria-label="This week by day">';
    for (var k = 0; k < days.length; k++) {
      var evs = by[days[k]].slice().sort(function (a, b) {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return eventStartMs(a) - eventStartMs(b);
      });
      html += '<div class="lb-wk-day' + (k === 0 ? " is-tmr" : "") + '"><div class="lb-wk-hd">' +
        esc((k === 0 ? "Tomorrow · " : "") + dayLabel(days[k])) + "</div>";
      for (var j = 0; j < evs.length; j++) {
        var e = evs[j], who = whoNames(e), tags = "";
        for (var w = 0; w < who.length; w++) {
          tags += '<span class="lb-day-tag" data-who="' + esc(who[w]) + '">' + esc(who[w]) + "</span>";
        }
        html += '<div class="lb-wk-row"><span class="lb-wk-t">' + esc(e.allDay ? "All day" : shortTime(e.start)) +
          '</span><span class="lb-wk-what">' + esc(dayTitle(e)) + '<span class="lb-day-tags">' + tags + "</span></span></div>";
      }
      html += "</div>";
    }
    return html + "</div>";
  }
  function paintDan() {
    if (document.querySelector("[data-dad-seat]")) return; /* DADSEAT1 page paints itself */
    var tEl = document.querySelector("[data-mount-dan-today]");
    var wEl = document.querySelector("[data-mount-dan-week]");
    if ((!tEl && !wEl) || !global.HouseClock) return;
    loadCal(function (err, cal) {
      var clock = HouseClock.now();
      var gate = calIsFresh(cal, clock);
      if (err || !gate.ok) return; /* leave kids-data fallback cards */
      var strip = pickStripFromCal(cal, clock);
      if (tEl) {
        var h = layoutDay(strip).replace('class="lb-layout lb-day"', 'class="lb-layout lb-day dan-stack"');
        h = h.replace(/<div class="lb-day-tmr">[\s\S]*<\/div><\/div>$/, "</div>");
        ensureDanCss();
        tEl.innerHTML = h;
        tEl.setAttribute("data-sched", "day2");
      }
      if (wEl) {
        wEl.innerHTML = layoutWeekDays(cal, clock);
        wEl.setAttribute("data-sched", "day2");
      }
    });
  }
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("house:kids-data-ready", function () { setTimeout(paintDan, 0); });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paintDan);
    else paintDan();
    setInterval(paintDan, 60 * 1000);
  }

  global.HouseBoardStrip = {
    boot: boot,
    pickNextFuture: pickNextFuture,
    pickStripFromCal: pickStripFromCal,
    remainingToday: remainingToday,
    tomorrowPeek: tomorrowPeek,
    calIsFresh: calIsFresh,
    staleStrip: staleStrip,
    stripFromEvent: stripFromEvent,
    applyStrip: applyStrip,
    getLayout: getLayout,
    setLayout: setLayout,
    cycleLayout: cycleLayout,
    LAYOUTS: LAYOUTS,
    layoutWeekDays: layoutWeekDays,
    paintDan: paintDan,
    CAL_FRESH_MS: CAL_FRESH_MS,
    /* DADSEAT1 · read-only helpers for the Dad seat page */
    _h: { loadCal: loadCal, listEvents: listEvents, eventStartMs: eventStartMs, eventDayIso: eventDayIso,
      whoNames: whoNames, dayTitle: dayTitle, shortTime: shortTime, isPrep: isPrep, addDaysIso: addDaysIso }
  };
})(typeof window !== "undefined" ? window : globalThis);
