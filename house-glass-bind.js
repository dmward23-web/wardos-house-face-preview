/* AUDIT1 · House Face glass binder for the older family sheets (month · month-chat · sheet-us · sheet-countdowns).
   Opt-in per page: <body data-glass="ovals month-today us-leave countdown">.
   Facts come only from data/cal-live.json (via HouseBoardStrip helpers) + live weather/Sensi.
   No data → hide the slot. Never paint dash-degree, TBD, loading or placeholder text. */
(function (global) {
  "use strict";
  var TZ = "America/Chicago";
  var DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function has(tok) {
    var v = (document.body && document.body.getAttribute("data-glass")) || "";
    return (" " + v + " ").indexOf(" " + tok + " ") >= 0;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ctIso(ms) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
    } catch (e) { return ""; }
  }
  function isoParts(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
    return { y: +m[1], mo: +m[2], d: +m[3], dow: d.getUTCDay(), utc: d.getTime() };
  }
  function dayDiff(fromIso, toIso) {
    var a = isoParts(fromIso), b = isoParts(toIso);
    if (!a || !b) return null;
    return Math.round((b.utc - a.utc) / 864e5);
  }
  function show(el, on) {
    if (!el) return;
    if (on) { el.removeAttribute("hidden"); el.style.display = ""; }
    else { el.setAttribute("hidden", ""); el.style.display = "none"; }
  }
  function H() { return global.HouseBoardStrip && global.HouseBoardStrip._h; }

  /* ── header ovals · live °, icon from the same wx state; hidden when not live ── */
  function wireOval(sel, deg, ico, label) {
    var oval = document.querySelector(sel);
    if (!oval) return;
    var d = oval.querySelector(".oval-deg");
    var i = oval.querySelector(".oval-ico");
    if (deg == null) { if (d) d.textContent = ""; oval.setAttribute("data-wired", "0"); show(oval, false); return; }
    if (d) d.textContent = deg;
    if (i && ico) i.textContent = ico;
    if (label) oval.setAttribute("aria-label", label);
    oval.setAttribute("data-wired", "1");
    show(oval, true);
  }
  function paintOvals() {
    wireOval(".hdr .oval.wx", null);
    wireOval(".hdr .oval.sensi", null);
    if (global.HouseWeather) {
      HouseWeather.load(function (err, data) {
        if (!err && data && data.temp != null && isFinite(Number(data.temp))) {
          wireOval(".hdr .oval.wx", Math.round(data.temp) + "°", data.icon || null, "Weather " + Math.round(data.temp) + " degrees");
        }
      });
    }
    if (global.HouseSensi && HouseSensi.fetchLive) {
      var paintSensi = function () {
        var st = HouseSensi.effectiveState && HouseSensi.effectiveState();
        if (st && st.gate && st.gate.live && typeof st.ambient === "number") {
          wireOval(".hdr .oval.sensi", st.ambient + "°", null, "Thermostat " + st.ambient + " degrees");
        } else {
          wireOval(".hdr .oval.sensi", null);
        }
      };
      HouseSensi.fetchLive(function () { paintSensi(); });
      if (HouseSensi.onChange) HouseSensi.onChange(paintSensi);
    }
  }

  /* ── month grid · TODAY tag follows the clock (grid is Sep 2026) ── */
  function paintMonthToday() {
    var grid = document.querySelector(".month-grid");
    if (!grid) return;
    var gy = +(grid.getAttribute("data-year") || 2026), gm = +(grid.getAttribute("data-month") || 9);
    var t = isoParts(ctIso(Date.now()));
    grid.querySelectorAll(".day.today").forEach(function (c) {
      c.classList.remove("today");
      var tag = c.querySelector(".day-tag");
      if (tag && /today/i.test(tag.textContent)) tag.parentNode.removeChild(tag);
    });
    if (!t || t.y !== gy || t.mo !== gm) return;
    grid.querySelectorAll(".day:not(.out)").forEach(function (c) {
      var dom = c.querySelector(".dom");
      if (!dom || +dom.textContent !== t.d) return;
      c.classList.add("today");
      if (!c.querySelector(".day-tag")) {
        var tag = document.createElement("span");
        tag.className = "day-tag";
        tag.textContent = "today";
        dom.parentNode.appendChild(tag);
      }
    });
  }

  /* ── sheet-us · next shared leave-by from cal-live (Erin / Nashville / Harbor) ── */
  var US_RE = /\b(Erin|Nashville|Harbor Cove|together)\b/i;
  function paintUsLeave(cal) {
    var h = H();
    var card = document.querySelector("[data-glass-us-leave]");
    if (!card || !h) return;
    var main = card.querySelector(".leaveby-main");
    var detail = card.querySelector(".leaveby-detail");
    var badge = card.querySelector(".leaveby-badge");
    var now = Date.now();
    var list = cal ? h.listEvents(cal) : [];
    var next = list.filter(function (e) { return !e.allDay && h.eventStartMs(e) > now && US_RE.test(e.summary || ""); })
      .sort(function (a, b) { return h.eventStartMs(a) - h.eventStartMs(b); })[0];
    if (!next) {
      if (main) main.textContent = "Nothing shared next on the calendar";
      if (detail) { detail.textContent = ""; show(detail, false); }
      if (badge) show(badge, false);
      return;
    }
    var iso = h.eventDayIso(next), p = isoParts(iso);
    var dayLab = p ? (DOW[p.dow] + " " + MON[p.mo - 1] + " " + p.d) : "";
    var parts = String(next.summary || "").replace(/^Dan\s*[—-]\s*/i, "").split(/\s·\s/);
    if (main) main.innerHTML = esc(dayLab) + ' · <span class="time">' + esc(h.shortTime(next.start)) + "</span>" + esc(parts[0]);
    if (detail) {
      var rest = parts.slice(1).join(" · ");
      detail.textContent = rest;
      show(detail, !!rest);
    }
    if (badge) { badge.textContent = p ? DOW[p.dow] : ""; show(badge, !!p); }
  }

  /* ── sheet-countdowns · Hayes birthday from cal-live, days from the clock ── */
  var BDAY_RE = /^Hayes birthday\b/i;
  function paintCountdown(cal) {
    var h = H();
    var sec = document.querySelector("[data-glass-bday]");
    var cheer = document.querySelector("[data-glass-bday-cheer]");
    if (!sec || !h) return;
    var today = ctIso(Date.now());
    var ev = (cal ? h.listEvents(cal) : []).filter(function (e) {
      return BDAY_RE.test(e.summary || "") && h.eventDayIso(e) >= today;
    }).sort(function (a, b) { return h.eventStartMs(a) - h.eventStartMs(b); })[0];
    if (!ev) { show(sec, false); if (cheer) show(cheer, false); return; }
    var iso = h.eventDayIso(ev), p = isoParts(iso), n = dayDiff(today, iso);
    if (!p || n == null) { show(sec, false); if (cheer) show(cheer, false); return; }
    var mdy = MON[p.mo - 1] + " " + p.d;
    var extra = String(ev.summary || "").replace(BDAY_RE, "").replace(/^\s*[—-]\s*/, "").replace(/\s*·\s*leave\s+\d{1,2}:\d{2}.*$/i, "").trim();
    function set(sel, txt) { var el = sec.querySelector(sel); if (el) el.textContent = txt; }
    set(".sec-meta", "calendar · " + DOW[p.dow] + " " + mdy);
    set(".when", DOW_LONG[p.dow] + " · " + mdy + " " + p.y);
    var boxes = sec.querySelectorAll(".count-box");
    if (boxes[0]) {
      boxes[0].querySelector(".n").textContent = n === 0 ? "🎂" : String(n);
      boxes[0].querySelector(".u").textContent = n === 0 ? "today" : (n === 1 ? "day" : "days");
    }
    if (boxes[2]) {
      boxes[2].querySelector(".n").textContent = DOW[p.dow];
      boxes[2].querySelector(".u").textContent = mdy;
    }
    set(".note", extra ? ("Birthday dinner · " + extra) : "On the family calendar");
    show(sec, true);
    if (cheer) {
      var hl = cheer.querySelector(".hl");
      if (hl) hl.textContent = DOW[p.dow] + " " + mdy;
      var sub = cheer.querySelector(".cheer-sub");
      if (sub) sub.innerHTML = "<strong>" + (n === 0 ? "Today" : (n + (n === 1 ? " day" : " days"))) + "</strong> · from the family calendar";
      show(cheer, true);
    }
  }

  function withCal(fn) {
    var h = H();
    if (!h || !h.loadCal) { fn(null); return; }
    h.loadCal(function (err, cal) { fn(!err && cal && cal.status === "live" ? cal : null); });
  }

  function boot() {
    if (has("ovals")) paintOvals();
    if (has("month-today")) paintMonthToday();
    if (has("us-leave") || has("countdown")) {
      withCal(function (cal) {
        if (has("us-leave")) paintUsLeave(cal);
        if (has("countdown")) paintCountdown(cal);
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setInterval(function () {
    if (has("month-today")) paintMonthToday();
    if (has("us-leave") || has("countdown")) withCal(function (cal) {
      if (has("us-leave")) paintUsLeave(cal);
      if (has("countdown")) paintCountdown(cal);
    });
  }, 5 * 60 * 1000);

  global.HouseGlassBind = { boot: boot };
})(typeof window !== "undefined" ? window : globalThis);
