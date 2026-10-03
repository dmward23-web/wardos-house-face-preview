/* QARELAY1 · hub tile micro-rows bound to kids-week.json at runtime (Today / Week / Dad Seat / kid tiles).
   Replaces day-locked HTML rows. Day-lagged data → hide the micro rows rather than show stale facts.
   RIDES law: kid tiles never show Dad logistics (kind leave/ride, "Pick up …"/"Drop …"). */
(function () {
  /* HAYESJ1: kid names in titles go through the one shared matcher (house-kid-match.js): Hayes Johnson is not our Hayes */
  var KM = window.HouseKidMatch || (typeof require === "function" ? require("./house-kid-match.js") : null);
  function notOurs(s) { return KM ? KM.strip(s) : String(s == null ? "" : s); }
  "use strict";
  var TZ = "America/Chicago";
  function ctDate(d) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    } catch (e) { return ""; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function row(mt, md, chip, tone) {
    return '<div class="tile-mrow"><span class="mt">' + esc(mt) + '</span><span class="md">' + esc(md) + "</span>" +
      (chip ? '<span class="tile-mchip' + (tone ? " " + tone : "") + '">' + esc(chip) + "</span>" : "") + "</div>";
  }
  function isDadLogistics(it) {
    if (!it) return false;
    if (it.kind === "leave" || it.kind === "ride") return true;
    return /^(Pick\s*-?\s*up|Drop|Leave)\b/i.test(String(it.summary || it.place || it.what || "").trim());
  }
  function stripKid(s) {
    return String(s || "").replace(/^(?:(?:Ainsley|Hayes|Harris|Boys)\s*(?:\+\s*)?)+\s*[—–\-:·]\s*/i, "").trim();
  }
  var KID_RE = {
    hayes: /\bhayes\b|\bboys\b/i,
    harris: /\bharris\b|\bboys\b/i,
    ainsley: /\bainsley\b/i
  };
  /* Hub is a shared house screen: appointments show as "appointment", never provider detail. */
  var APPT_RE = /anxiety|therap|counsel|doctor|dentist|ortho|pediatric|clinic|\bappt\b/i;
  function isAppt(it) { return it && (it.kind === "appointment" || APPT_RE.test(String(it.summary || it.place || it.what || ""))); }
  function micro(sel) {
    var tile = document.querySelector(sel);
    return tile ? tile.querySelector(".tile-micro") : null;
  }
  function setMicro(el, html) {
    if (!el) return;
    if (html) { el.innerHTML = html; el.removeAttribute("hidden"); el.setAttribute("data-bound", "QARELAY1"); }
    else { el.innerHTML = ""; el.setAttribute("hidden", ""); }
  }

  function paint(week) {
    var now = Date.now();
    var today = ctDate(new Date());
    var lagged = !week || (week.asOfIso && today && week.asOfIso !== today);
    var tiles = [".tile.today", ".tile.week", ".tile.dan", ".tile[data-kid-seed='ainsley']",
      ".tile[data-kid-seed='hayes']", ".tile[data-kid-seed='harris']"];
    if (lagged) { tiles.forEach(function (s) { setMicro(micro(s), ""); }); return; }

    var queue = ((week.boardStrip && week.boardStrip.queue) || []).filter(function (it) {
      var end = Date.parse(it.endIso || "") || 0;
      var start = Date.parse(it.startIso || "") || 0;
      if (end && end < now) return false;
      if (!end && start && start + 90 * 60 * 1000 < now) return false;
      return true;
    });
    function isToday(it) { return it.startIso && ctDate(new Date(it.startIso)) === today; }
    function mtFor(it) { return isToday(it) ? (it.time || "") : (String(it.badge || "").toUpperCase() + (it.time ? " " + it.time : "")); }
    function titleOf(it) {
      if (isAppt(it)) {
        var who = (notOurs(it.summary).match(/^(Ainsley|Hayes|Harris)\b/) || [])[1];
        return (who ? who + " · " : "") + "appointment";
      }
      return stripKid(it.place || it.summary || "");
    }

    /* Kid tiles */
    ["ainsley", "hayes", "harris"].forEach(function (id) {
      var re = KID_RE[id];
      var mine = queue.filter(function (it) {
        if (isDadLogistics(it) || isAppt(it)) return false;
        var blob = notOurs((it.summary || "") + " " + (it.place || ""));
        if (id === "harris" && /\bhayes\b/i.test(blob) && !/\bharris\b|\bboys\b/i.test(blob)) return false;
        if (id === "hayes" && /\bharris\b/i.test(blob) && !/\bhayes\b|\bboys\b/i.test(blob)) return false;
        return re.test(blob) || (id !== "ainsley" && /\bSRE\b/.test(blob) && /\bhayes \+ harris\b|\bboys\b/i.test(blob));
      }).slice(0, 3);
      var html = mine.map(function (it, i) {
        return row(mtFor(it), titleOf(it), i === 0 ? (isToday(it) ? "Next" : "Up next") : "", i === 0 ? "amber" : "");
      }).join("");
      setMicro(micro(".tile[data-kid-seed='" + id + "']"), html);
    });

    /* Today tile · remaining today */
    var todayItems = queue.filter(isToday);
    var th = todayItems.slice(0, 3).map(function (it, i) {
      return row(it.time || "", isAppt(it) ? titleOf(it) : (it.place || it.summary || ""), i === 0 ? "Next" : "", i === 0 ? "amber" : "");
    }).join("");
    if (!th) th = row("EVE", "Nothing left today", "Clear", "green");
    else if (todayItems.length > 3) th += row("+" + (todayItems.length - 3), "more today", "", "");
    setMicro(micro(".tile.today"), th);

    /* Week tile · next 4 days from Dad week list */
    var dan = (week.kids && week.kids.dan) || {};
    var days = [];
    var byDay = {};
    (dan.week || []).forEach(function (r) {
      var key = String(r.when || "").split("·")[0].trim();
      if (!key) return;
      if (!byDay[key]) { byDay[key] = []; days.push(key); }
      byDay[key].push(isAppt(r) ? "appointment" : String(r.what || "").trim());
    });
    var todayDow = "";
    try { todayDow = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(new Date()); } catch (e) { /* */ }
    var wh = days.slice(0, 4).map(function (k) {
      var dow = k.split(" ")[0].toUpperCase();
      var list = byDay[k];
      var md = list.slice(0, 2).map(stripKid).join(" · ") + (list.length > 2 ? " +" + (list.length - 2) : "");
      var isNow = todayDow && k.indexOf(todayDow) === 0;
      return row(dow, md, isNow ? "Now" : "", isNow ? "amber" : "");
    }).join("");
    setMicro(micro(".tile.week"), wh);

    /* SEATS1 · Dad card = kid card face: big next leave-by + next two after it */
    var stage = document.querySelector(".tile.dan [data-dad-stage]");
    if (stage) {
      var first = queue[0];
      var dd = '<div class="kf-face kf-day"><div class="kf-kicker">Next leave</div>';
      if (!first) {
        dd += '<div class="kf-loud">Clear</div><div class="kf-title">Nothing queued</div>';
      } else {
        var dow = isToday(first) ? "TODAY" : String(first.badge || "").toUpperCase();
        dd += '<div class="kf-loud">' + esc((dow ? dow + " · " : "") + (first.time || "")) + "</div>";
        dd += '<div class="kf-title">' + esc(titleOf(first)) + "</div>";
        var rest = queue.slice(1, 3);
        if (rest.length) {
          dd += '<div class="kf-rows">' + rest.map(function (it) {
            return '<div class="kf-row"><span class="kf-mt">' + esc(mtFor(it)) + '</span><span class="kf-md">' + esc(titleOf(it)) + "</span></div>";
          }).join("") + "</div>";
        }
      }
      stage.innerHTML = dd + "</div>";
    } else {
      var dh = queue.slice(0, 2).map(function (it, i) {
        return row(mtFor(it), "Leave-by · " + titleOf(it), i === 0 ? "Next" : "", i === 0 ? "amber" : "");
      }).join("");
      dh += row("WK", "Week command board", "", "");
      setMicro(micro(".tile.dan"), dh);
    }
  }

  function load() {
    if (typeof fetch !== "function") return;
    fetch("kids-week.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (w) { if (w) paint(w); })
      .catch(function () { /* keep static rows */ });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
  setInterval(load, 5 * 60 * 1000);
})();
