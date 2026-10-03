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

  /* KIDPAGES1 · CLIP rule: the hero clock is one line ("12:58 PM" never splits or runs past its card); the type steps
     down until the whole time sits inside the card that holds it. Re-run on every minute change and on resize. */
  function fitClock(el) {
    if (!el || !el.getBoundingClientRect || typeof getComputedStyle === "undefined") return;
    var box = el.closest("header, .hdr, .card, section") || el.parentElement;
    if (!box) return;
    /* OCT8: the landscape packer can re-place or re-size the header card after the first fit (late fonts, a slow
       box); a size change of the card refits the clock so the header never ends up past its card */
    if (!el._fitRO && typeof ResizeObserver === "function") {
      var lastW = 0, lastH = 0;
      el._fitRO = new ResizeObserver(function (en) {
        if (Math.abs(box.clientWidth - lastW) < 1 && Math.abs(box.clientHeight - lastH) < 1) return;
        fitClock(el); /* in the observer itself (before paint), no frame where the header runs past its card */
        lastW = box.clientWidth; lastH = box.clientHeight;
      });
      el._fitRO.observe(box);
    }
    el.style.whiteSpace = "nowrap";
    el.style.fontSize = "";
    el.style.paddingTop = ""; el.style.paddingBottom = "";
    el.setAttribute("data-fit", "1");
    var bs = getComputedStyle(box), br = box.getBoundingClientRect();
    var right = br.right - (parseFloat(bs.paddingRight) || 0) - (parseFloat(bs.borderRightWidth) || 0);
    var left = br.left + (parseFloat(bs.paddingLeft) || 0) + (parseFloat(bs.borderLeftWidth) || 0);
    var rg = document.createRange();
    for (var k = 0; k < 60; k++) {
      rg.selectNodeContents(el);
      var r = rg.getBoundingClientRect();
      /* OCT8: a wider minute ("11:34 PM") must not push the header's other pieces (the page chip) out of the card.
         The left edge is the card's own edge: a clock column that starts inside the card padding never gets wider by
         shrinking, so a padding-edge test shrank it to the floor (gallery-hero 1366/1536: 18px clock). */
      var kidsIn = true;
      for (var c = 0; c < box.children.length; c++) { var cr = box.children[c].getBoundingClientRect(); if (cr.width && cr.right > br.right - 0.5) { kidsIn = false; break; } /* the card edge itself (a chip may sit in the padding) */ }
      if (!r.width || (r.right <= right + 0.5 && r.left >= br.left - 0.5 && el.scrollWidth <= el.clientWidth + 1 && kidsIn)) break;
      var fs = parseFloat(getComputedStyle(el).fontSize) || 0;
      if (fs <= 14) break;
      el.style.setProperty("font-size", (fs - 1) + "px", "important");
    }
    /* OCT8: the hero clock's line-height is tighter than its font's glyph box, so the glyphs reach past the element top
       and bottom (and past a header card that hugs it). Pad the element by exactly that overhang so the box that the
       landscape packer measures holds the whole time; the packer then sizes the header around it. */
    try {
      rg.selectNodeContents(el);
      var gr = rg.getBoundingClientRect(), er = el.getBoundingClientRect(), z = el.offsetWidth ? er.width / el.offsetWidth : 1;
      if (gr.height && z > 0) {
        var ot = Math.max(0, er.top - gr.top) / z, ob = Math.max(0, gr.bottom - er.bottom) / z;
        if (ot > 0.5) el.style.paddingTop = Math.ceil(ot) + "px";
        if (ob > 0.5) el.style.paddingBottom = Math.ceil(ob) + "px";
      }
      /* the packer already dealt the cards with the old clock box: deal them again once, so the header holds it */
      var pad = el.style.paddingTop + "/" + el.style.paddingBottom;
      if (pad !== el._fitPad) {
        el._fitPad = pad;
        var HL = window.HouseLandscape;
        if (!fitClock._dealing && HL && typeof HL.apply === "function" && box.hasAttribute("data-ls-placed")) {
          fitClock._dealing = true;
          try { HL.apply(); } finally { fitClock._dealing = false; }
        }
      }
    } catch (e) { /* layout only */ }
  }
  if (typeof window !== "undefined" && window.addEventListener) {
    var _fitT = null;
    window.addEventListener("resize", function () {
      clearTimeout(_fitT);
      _fitT = setTimeout(function () { document.querySelectorAll("[data-live-clock]").forEach(fitClock); }, 80);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { document.querySelectorAll("[data-live-clock]").forEach(fitClock); });
  }

  /** Paint every [data-live-clock] / [data-live="time"] with CT wall time. */
  function paintLive(root) {
    root = root || (typeof document !== "undefined" ? document : null);
    if (!root || !root.querySelectorAll) return stamp(new Date());
    var s = stamp(new Date());
    root.querySelectorAll("[data-live-clock], [data-live='time'], [data-live='clock-time']").forEach(function (el) {
      var was = el.textContent;
      el.textContent = s.time || "—";
      if (el.hasAttribute("data-live-clock") && (was !== el.textContent || !el.hasAttribute("data-fit"))) fitClock(el);
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
