/* House Face · America/Chicago clock — NEVER hardcode board day labels.
   All date strips / badges / "today" headers must call HouseClock. */
(function (global) {
  "use strict";
  var TZ = "America/Chicago";

  function parts(date) {
    var d = date || new Date();
    var map = {};
    try {
      new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      }).formatToParts(d).forEach(function (p) {
        if (p.type !== "literal") map[p.type] = p.value;
      });
    } catch (e) {
      /* fallback: treat local as CT (wall station is CT) */
      var wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
      var mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
      map = {
        weekday: wd,
        month: mo,
        day: String(d.getDate()),
        year: String(d.getFullYear()),
        hour: String(((d.getHours() + 11) % 12) + 1),
        minute: String(d.getMinutes()).padStart(2, "0"),
        dayPeriod: d.getHours() < 12 ? "AM" : "PM"
      };
    }
    return map;
  }

  function iso(date) {
    var p = parts(date);
    var m = String(p.month);
    /* formatToParts month is short name — rebuild via en-CA */
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(date || new Date()); /* YYYY-MM-DD */
    } catch (e) {
      var d = date || new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
  }

  function shortLabel(date) {
    var p = parts(date);
    return p.weekday + " " + p.month + " " + p.day;
  }

  function longLabel(date) {
    var p = parts(date);
    return p.weekday + " " + p.month + " " + p.day + " " + p.year;
  }

  function dow(date) {
    return parts(date).weekday;
  }

  function daypart(date) {
    var h;
    try {
      h = Number(new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour: "numeric",
        hour12: false
      }).format(date || new Date()));
    } catch (e) {
      h = (date || new Date()).getHours();
    }
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
  }

  /** Clean CT wall time · "8:10 AM" (never 24h / never bare ISO). */
  function timeLabel(date) {
    var p = parts(date);
    if (!p.hour || !p.minute) return "";
    var ap = p.dayPeriod ? (" " + p.dayPeriod) : "";
    return p.hour + ":" + p.minute + ap;
  }

  /** Date under big DOW · "Sep 28, 2026" (no weekday repeat). */
  function dateLine(date) {
    var p = parts(date);
    return p.month + " " + p.day + ", " + p.year;
  }

  function stamp(date) {
    return {
      tz: TZ,
      iso: iso(date),
      short: shortLabel(date),
      long: longLabel(date),
      dateLine: dateLine(date),
      time: timeLabel(date),
      dow: dow(date),
      daypart: daypart(date),
      year: parts(date).year
    };
  }

  var _liveTimer = null;

  /** Paint every [data-live-clock] / [data-live="time"] with CT wall time. */
  function paintLive(root) {
    root = root || (typeof document !== "undefined" ? document : null);
    if (!root || !root.querySelectorAll) return stamp(new Date());
    var s = stamp(new Date());
    root.querySelectorAll("[data-live-clock], [data-live='time'], [data-live='clock-time']").forEach(function (el) {
      el.textContent = s.time || "—";
      if (el.tagName === "TIME") el.setAttribute("datetime", s.iso + "T" + (s.time || "").replace(" ", ""));
      el.setAttribute("title", "America/Chicago · " + s.long + " · " + (s.time || ""));
    });
    /* Keep hub DOW / date-long honest across midnight without a reload */
    root.querySelectorAll("[data-live='dow']").forEach(function (el) {
      if (!el.closest || !el.closest(".hdr-date, .live-clock-host, header")) return;
      el.textContent = s.dow;
    });
    root.querySelectorAll("[data-live='date-long']").forEach(function (el) {
      if (!el.closest || !el.closest(".hdr-date, .live-clock-host, header, footer, .ftr, .sec-hdr, .sec-meta")) return;
      el.textContent = s.long || s.dateLine;
    });
    /* DADFIX1 · always refresh date-short (Dad Today meta was stuck on Sun Sep 27) */
    root.querySelectorAll("[data-live='date-short']").forEach(function (el) {
      el.textContent = s.short || s.long;
    });
    /* Also paint date-long outside hdr (footer stamps) */
    root.querySelectorAll("[data-live='date-long']").forEach(function (el) {
      if (el.closest && el.closest(".hdr-date, .live-clock-host, header")) return; /* already painted */
      el.textContent = s.long || s.dateLine || el.textContent;
    });
    return s;
  }

  function startLive(ms) {
    if (typeof document === "undefined") return;
    paintLive(document);
    if (_liveTimer) return;
    _liveTimer = setInterval(function () { paintLive(document); }, ms || 1000);
  }

  function stopLive() {
    if (_liveTimer) { clearInterval(_liveTimer); _liveTimer = null; }
  }

  global.HouseClock = {
    TZ: TZ,
    parts: parts,
    iso: iso,
    shortLabel: shortLabel,
    longLabel: longLabel,
    dateLine: dateLine,
    timeLabel: timeLabel,
    dow: dow,
    daypart: daypart,
    stamp: stamp,
    now: function () { return stamp(new Date()); },
    paintLive: paintLive,
    startLive: startLive,
    stopLive: stopLive
  };

  if (typeof document !== "undefined") {
    function bootLive() {
      if (document.querySelector("[data-live-clock], [data-live='time'], [data-live='clock-time']")) {
        startLive(1000);
      }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootLive);
    } else {
      bootLive();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
