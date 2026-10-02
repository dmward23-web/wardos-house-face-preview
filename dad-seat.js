/* DADSEAT1 · Dad seat page: big Up next + countdown, rolling timeline (never empty),
   7-day card grid (top 3 + kid dots, tap to expand), one-line rules footer.
   Data: data/cal-live.json via HouseBoardStrip (dmward23 only, placeholders already dropped). */
(function () {
  "use strict";
  var H = window.HouseBoardStrip && window.HouseBoardStrip._h;
  if (!H) return;
  var AWARE = /\bawareness\b|\bcleaners?\b|\bHOA\b/i;
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ctIso(ms) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  }
  function dayName(iso, todayIso) {
    if (iso === todayIso) return "Today";
    if (iso === H.addDaysIso(todayIso, 1)) return "Tomorrow";
    var p = iso.split("-"); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
    return DOW[d.getUTCDay()] + " " + (+p[2]);
  }
  function dayShort(iso) {
    var p = iso.split("-"); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
    return { dow: DOW[d.getUTCDay()], num: +p[2] };
  }
  function dots(ev) {
    return H.whoNames(ev).map(function (w) { return '<i class="ds-dot" data-who="' + esc(w) + '" title="' + esc(w) + '"></i>'; }).join("");
  }
  function tags(ev) {
    return H.whoNames(ev).map(function (w) { return '<span class="ds-tag" data-who="' + esc(w) + '">' + esc(w) + "</span>"; }).join("");
  }
  function fmtCountdown(ms) {
    var m = Math.max(0, Math.round(ms / 60000));
    if (m < 1) return "now";
    var h = Math.floor(m / 60), mm = m % 60;
    if (h >= 24) { var d = Math.floor(h / 24); return "in " + d + (d === 1 ? " day " : " days ") + (h % 24) + " hr"; }
    return "in " + (h ? h + " hr " : "") + mm + " min";
  }
  function bigTime(ev) {
    var t = H.shortTime(ev.start);
    return t.replace(/([ap])$/i, function (_, ap) { return " " + ap.toUpperCase() + "M"; });
  }

  /* AUDIT1 · same start + same title for different kids → one row ("Hayes + Harris — SRE PE") */
  function mergeSame(list) {
    var out = [], by = {};
    list.forEach(function (e) {
      var key = (e.allDay ? "d" + H.eventDayIso(e) : H.eventStartMs(e)) + "|" + H.dayTitle(e).toLowerCase();
      var hit = by[key];
      if (!hit) { by[key] = e; out.push(e); return; }
      var names = H.whoNames(hit).concat(H.whoNames(e)).filter(function (n, i, a) { return n !== "Dan" && a.indexOf(n) === i; });
      if (!names.length) return;
      var merged = {};
      for (var k in hit) if (Object.prototype.hasOwnProperty.call(hit, k)) merged[k] = hit[k];
      merged.summary = names.join(" + ") + " — " + H.dayTitle(hit);
      out[out.indexOf(hit)] = merged;
      by[key] = merged;
    });
    return out;
  }

  var _cal = null, _kw = null, _open = {};
  function paint() {
    var root = document.querySelector("[data-dad-seat]");
    if (!root || !_cal) return;
    var now = Date.now(), todayIso = ctIso(now);
    var all = H.listEvents(_cal).filter(function (e) {
      var st = H.eventStartMs(e), en = Date.parse(e.end || "") || st;
      return e.allDay ? H.eventDayIso(e) >= todayIso : en > now;
    });
    all.sort(function (a, b) { return H.eventStartMs(a) - H.eventStartMs(b); });
    all = mergeSame(all);
    var timed = all.filter(function (e) { return !e.allDay && !AWARE.test(e.summary || "") && !H.isPrep(e); });

    /* Up next */
    var next = timed.filter(function (e) { return H.eventStartMs(e) > now; })[0];
    var nx = root.querySelector("[data-ds-next]");
    if (next) {
      var nIso = H.eventDayIso(next);
      nx.innerHTML =
        '<div class="ds-kick">Up next · ' + esc(dayName(nIso, todayIso)) + "</div>" +
        '<div class="ds-big"><span class="ds-time">' + esc(bigTime(next)) + '</span><span class="ds-cd" data-ds-cd="' + H.eventStartMs(next) + '">' + esc(fmtCountdown(H.eventStartMs(next) - now)) + "</span></div>" +
        '<div class="ds-what">' + esc(H.dayTitle(next)) + "</div>" +
        '<div class="ds-tags">' + tags(next) + "</div>";
      var restToday = timed.filter(function (e) { return e !== next && H.eventDayIso(e) === todayIso; });
      var line = restToday.length
        ? ("Also today: " + restToday.slice(0, 2).map(function (e) { return H.shortTime(e.start) + " " + H.dayTitle(e); }).join(" · ") + (restToday.length > 2 ? " +" + (restToday.length - 2) : ""))
        : (nIso === todayIso ? "Nothing else today" : "Nothing else tonight");
      root.querySelector("[data-ds-line]").textContent = line;
    } else {
      nx.innerHTML = '<div class="ds-kick">Up next</div><div class="ds-big"><span class="ds-time">Clear</span></div><div class="ds-what">Nothing on the calendar</div>';
      root.querySelector("[data-ds-line]").textContent = "";
    }

    /* Timeline · next 24 hours after Up next (min 4 stops) */
    var after = timed.filter(function (e) { return e !== next && H.eventStartMs(e) > now; });
    var tl = after.filter(function (e) { return H.eventStartMs(e) - now < 24 * 3600 * 1000; });
    if (tl.length < 4) tl = after.slice(0, 4);
    tl = tl.slice(0, 6);
    var tlh = tl.map(function (e) {
      var iso = H.eventDayIso(e);
      return '<div class="ds-stop"><span class="ds-st">' + esc(H.shortTime(e.start)) +
        (iso !== todayIso ? '<em>' + esc(dayShort(iso).dow) + "</em>" : "") + "</span>" +
        '<span class="ds-sw">' + esc(H.dayTitle(e)) + "</span><span class=\"ds-sd\">" + dots(e) + "</span></div>";
    }).join("");
    root.querySelector("[data-ds-tl]").innerHTML = tlh || '<div class="ds-none">Nothing else in the next day</div>';
    var allToday = tl.length && tl.every(function (e) { return H.eventDayIso(e) === todayIso; });
    root.querySelector("[data-ds-tl-hd]").textContent = allToday ? "Rest of today" : "Next 24 hours";

    /* Week grid · 7 days from today (today only if anything is left) */
    var start = timed.some(function (e) { return H.eventDayIso(e) === todayIso; }) ? todayIso : H.addDaysIso(todayIso, 1);
    var gh = "";
    for (var i = 0; i < 7; i++) {
      var iso = H.addDaysIso(start, i);
      var evs = all.filter(function (e) { return H.eventDayIso(e) === iso && !(!e.allDay && H.isPrep(e)); });
      evs.sort(function (a, b) {
        if (a.allDay !== b.allDay) return a.allDay ? 1 : -1;
        return H.eventStartMs(a) - H.eventStartMs(b);
      });
      var main = evs.filter(function (e) { return !AWARE.test(e.summary || ""); });
      var aware = evs.filter(function (e) { return AWARE.test(e.summary || ""); });
      var ds = dayShort(iso), isOpen = !!_open[iso];
      var shown = isOpen ? main.concat(aware) : main.slice(0, 3);
      var more = isOpen ? 0 : (evs.length - shown.length);
      gh += '<button type="button" class="ds-day' + (isOpen ? " is-open" : "") + (i === 0 ? " is-first" : "") + '" data-ds-day="' + iso + '">' +
        '<div class="ds-dh"><span class="ds-dn">' + esc(i === 0 ? dayName(iso, todayIso) : ds.dow) + '</span><span class="ds-dd">' + ds.num + "</span>" +
        '<span class="ds-dc">' + (evs.length ? evs.length : "") + "</span></div>";
      if (!evs.length) gh += '<div class="ds-none">Open day</div>';
      shown.forEach(function (e) {
        gh += '<div class="ds-row' + (AWARE.test(e.summary || "") ? " is-aware" : "") + '"><span class="ds-rt">' + esc(e.allDay ? "All day" : H.shortTime(e.start)) +
          '</span><span class="ds-rw">' + esc(H.dayTitle(e)) + '</span><span class="ds-rd">' + dots(e) + "</span></div>";
      });
      if (more > 0) gh += '<div class="ds-more">+' + more + " more · tap</div>";
      gh += "</button>";
    }
    root.querySelector("[data-ds-week]").innerHTML = gh;

    /* Footer · rules + pick in one line */
    var dan = (_kw && _kw.kids && _kw.kids.dan) || {};
    var bits = [];
    (dan.leaveBys || []).forEach(function (r) { bits.push(r.what); });
    var pick = (dan.picks || [])[0];
    if (pick) bits.push(pick.when + ": " + pick.what);
    root.querySelector("[data-ds-foot]").textContent = bits.join("  ·  ");
  }
  function tick() {
    document.querySelectorAll("[data-ds-cd]").forEach(function (el) {
      el.textContent = fmtCountdown(+el.getAttribute("data-ds-cd") - Date.now());
    });
  }
  function load() {
    H.loadCal(function (err, cal) { if (!err && cal) { _cal = cal; paint(); } });
    fetch("kids-week.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (w) { if (w) { _kw = w; paint(); } }).catch(function () {});
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest && ev.target.closest("[data-ds-day]");
    if (!b) return;
    var iso = b.getAttribute("data-ds-day");
    _open[iso] = !_open[iso];
    paint();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load); else load();
  setInterval(tick, 30000);
  setInterval(load, 5 * 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); });
})();
