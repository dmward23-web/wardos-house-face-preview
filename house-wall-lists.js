/* LISTS2 · house-wall-lists.js · branch wall-redesign-1 · loaded only by wall.html (not deployed).
   Readers for data the wall HOSTS but does not own. Every reader is strict: file missing, not today's, stale or off-shape
   -> null -> the tile is hidden. Nothing here sends anything to a person or a phone, and nothing here fetches.
   Shapes come from Atlas's contracts (ATLASLANE6, origin wall-redesign-atlas @ c9ee49a):
     - data/next-up.json        docs/wall-redesign/ATLAS-DATA-LANE.md  "NEXT UP"           -> leaveLine()
     - data/logistics-taps.json docs/wall-redesign/LOGISTICS-TAPS.md                        -> logisticsControls(), applyTap(), logisticsFor()
     - data/school-night.json   docs/wall-redesign/ATLAS-DATA-LANE.md  "School-night strip" -> schoolNight()
     - config/display-rename.json (display-only renames + parent-word scrub)                 -> compileRenames(), displayText()
   Field weather (fieldGame + fieldWeather) reads the forecast the hub's Open-Meteo pill (house-weather.js) already loads.
   Grocery is Ledger's own module (house-grocery-list.js), not read here. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HouseWallLists = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var TZ = "America/Chicago";
  var H6 = 6 * 60 * 60 * 1000;
  function nowMs(n) { return n == null ? Date.now() : Number(n); }
  function parse(iso) { var t = Date.parse(iso || ""); return isFinite(t) ? t : 0; }
  function ctParts(ms) {
    var p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return p;
  }
  function ctDate(ms) { var p = ctParts(ms); return p.year + "-" + p.month + "-" + p.day; }
  function fmtHM(ms) { var p = ctParts(ms), h = Number(p.hour) % 12 || 12; return h + ":" + p.minute; } /* h:mm, no am/pm (Atlas copy rule) */
  function fresh(j, now, maxMs) { var g = parse(j && j.generatedAt), t = nowMs(now); return !!g && t - g >= -5 * 60 * 1000 && t - g <= maxMs; }
  function today(j, now) { return !!j && typeof j === "object" && j.asOfIso === ctDate(nowMs(now)); }
  function str(s, max) { return typeof s === "string" && s.trim() && s.length <= (max || 80) ? s.trim() : null; }

  /* ---- display renames: config/display-rename.json (same rules Atlas applies at build time; no names in this code) ---- */
  function compileRenames(cfg) {
    try {
      if (!cfg || !Array.isArray(cfg.renames) || !cfg.parentScrub) return null;
      return {
        /* ATLASLANE9: the published config carries no patterns (they live in Atlas's private box file and the data is renamed
           at build time). A rename without a pattern is skipped; new RegExp(undefined) would match between every letter. */
        renames: cfg.renames.filter(function (r) { return r && typeof r.pattern === "string" && r.pattern; })
          .map(function (r) { return { re: new RegExp(r.pattern, "gi"), replace: String(r.replace) }; }),
        paren: new RegExp(cfg.parentScrub.parenthetical, "gi"),
        poss: new RegExp(cfg.parentScrub.possessive, "g"),
        residual: new RegExp(cfg.parentScrub.residual, "i")
      };
    } catch (e) { return null; }
  }
  /* Calendar text as the data gives it, with the board's display renames. null = the item is not published.
     No rules (config missing) -> text unchanged (the data files are already scrubbed at build time). */
  function displayText(s, rules) {
    if (typeof s !== "string") return s;
    if (!rules) return s;
    var out = s;
    rules.renames.forEach(function (r) { r.re.lastIndex = 0; out = out.replace(r.re, r.replace); });
    rules.paren.lastIndex = 0; rules.poss.lastIndex = 0;
    out = out.replace(rules.paren, "").replace(rules.poss, "$1$2");
    out = out.replace(/\s{2,}/g, " ").replace(/\s+([·,;:])/g, " $1").trim();
    if (!out) return null;
    return rules.residual.test(out) ? null : (out === s.trim() ? s : out);
  }

  /* ---- NEXT UP leave-by: data/next-up.json {asOfIso, generatedAt, next:{label, copy, leaveAt, leaveIso, startIso, day}|null, timer} ---- */
  var LEAVE_COPY = /^Leave \d{1,2}:\d{2}\.$/;
  function leaveLine(j, now, rules) {
    if (!today(j, now)) return null;
    var n = null, t = nowMs(now);
    if (Array.isArray(j.upcoming)) {
      /* DAYWIN1 · Atlas lists every leave still ahead (one morning run carries the day): the first one whose leave
         has not passed on this clock. Same day + not from later than this clock; nothing ahead = nothing. */
      if (!fresh(j, now, 24 * 3600 * 1000)) return null;
      for (var i = 0; i < j.upcoming.length; i++) { var u = j.upcoming[i]; if (u && typeof u === "object" && parse(u.leaveIso) > t) { n = u; break; } }
    } else {
      if (!fresh(j, now, H6) || !j.next || typeof j.next !== "object") return null;
      n = j.next;
    }
    if (!n) return null;
    var copy = str(n.copy, 16), label = displayText(str(n.label, 40), rules), at = parse(n.leaveIso);
    if (!copy || !LEAVE_COPY.test(copy) || !label || !at || at <= t) return null;
    var day = str(n.day, 9);
    return { label: label, copy: copy, day: day, atMs: at, text: label + " \u00b7 " + copy + (day && day !== "Today" ? " (" + day + ")" : "") };
  }

  /* ---- logistics taps: data/logistics-taps.json (controls + copy) + this screen's own state (per device) ---- */
  var TAP_IDS = ["im-home", "leaving", "check-in", "running-late"];
  var CHECKIN_KIDS = ["Harris", "Hayes", "Ainsley"];
  var LATE_CHIPS = [5, 10, 15, 20, 30];
  var STATE_KEY = "wardos-wall-logistics"; /* {taps:[{control, at, kid?, minutes?}]}; local only, never sent */
  /* house day resets 3:00 AM CT (same as who-home) */
  function houseDay(ms) { return ctDate(ms - 3 * 3600 * 1000); }
  function logisticsControls(j, now) {
    if (!j || typeof j !== "object" || j.sendsToPeople !== false || !Array.isArray(j.controls)) return null;
    var t = nowMs(now);
    if (j.date !== houseDay(t) || !(parse(j.resetsAt) > t) || !fresh(j, now, 24 * 3600 * 1000)) return null;
    var out = j.controls.filter(function (c) { return c && TAP_IDS.indexOf(c.id) >= 0 && str(c.label, 24); }).map(function (c) {
      var o = { id: c.id, label: c.label.trim() };
      if (c.id === "check-in") o.kids = (Array.isArray(c.kids) ? c.kids : []).filter(function (k) { return CHECKIN_KIDS.indexOf(k) >= 0; });
      if (c.id === "running-late") o.chips = (Array.isArray(c.chips) ? c.chips : j.lateChips || []).filter(function (m) { return LATE_CHIPS.indexOf(m) >= 0; });
      if (c.lights && typeof c.lights === "object") o.lights = { on: (c.lights.on || []).slice(), off: (c.lights.off || []).slice() };
      return o;
    }).filter(function (c) { return (c.id !== "check-in" || c.kids.length) && (c.id !== "running-late" || c.chips.length); });
    return out.length ? out : null;
  }
  /* copy (LOGISTICS-TAPS.md): "Home 6:05." · "Leaving 8:05." · "Running 15 min late." · "Ainsley home 5:52." */
  function statusLine(tap) {
    var at = parse(tap && tap.at); if (!at) return null;
    if (tap.control === "im-home") return "Home " + fmtHM(at) + ".";
    if (tap.control === "leaving") return "Leaving " + fmtHM(at) + ".";
    if (tap.control === "running-late") return "Running " + tap.minutes + " min late.";
    if (tap.control === "check-in") return tap.kid + " home " + fmtHM(at) + ".";
    return null;
  }
  function validTap(x) {
    if (!x || !parse(x.at)) return false;
    if (x.control === "im-home" || x.control === "leaving") return true;
    if (x.control === "check-in") return CHECKIN_KIDS.indexOf(x.kid) >= 0;
    if (x.control === "running-late") return LATE_CHIPS.indexOf(x.minutes) >= 0;
    return false;
  }
  function readState(store) { try { var j = JSON.parse(store.get(STATE_KEY) || "null"); return j && Array.isArray(j.taps) ? j : { taps: [] }; } catch (e) { return { taps: [] }; } }
  /* read-side normalizer: an earlier house day is gone; the latest tap wins the status line */
  function logisticsFor(state, now) {
    var t = nowMs(now), day = houseDay(t);
    var taps = ((state && state.taps) || []).filter(function (x) { return validTap(x) && houseDay(parse(x.at)) === day && parse(x.at) <= t + 5 * 60000; })
      .map(function (x) { var o = { control: x.control, at: x.at }; if (x.kid) o.kid = x.kid; if (x.minutes) o.minutes = x.minutes; return o; })
      .sort(function (a, b) { return parse(a.at) - parse(b.at); });
    var last = taps[taps.length - 1];
    return { date: day, taps: taps, status: last ? { control: last.control, line: statusLine(last), at: last.at } : null };
  }
  /* one tap on this screen: invalid -> no change, no effects. effects.sends is always [] (nothing goes to a person). */
  function applyTap(store, controls, input, now) {
    var t = nowMs(now), cur = logisticsFor(readState(store), t);
    var ctl = (controls || []).filter(function (c) { return c.id === (input && input.control); })[0];
    var tap = { control: input && input.control, at: new Date(t).toISOString() };
    if (input && input.kid) tap.kid = input.kid;
    if (input && input.minutes != null) tap.minutes = input.minutes;
    if (!ctl || !validTap(tap) || (ctl.kids && ctl.kids.indexOf(tap.kid) < 0) || (ctl.chips && ctl.chips.indexOf(tap.minutes) < 0))
      return { logistics: cur, effects: { lights: null, checkIn: null, sends: [] } };
    var next = logisticsFor({ taps: cur.taps.concat([tap]) }, t);
    store.set(STATE_KEY, JSON.stringify({ taps: next.taps }));
    return { logistics: next, effects: { lights: ctl.lights || null, checkIn: tap.control === "check-in" ? tap.kid.toLowerCase() : null, sends: [] } };
  }

  /* ---- school-night strip: data/school-night.json ---- */
  function schoolNight(j, now, rules) {
    var t = nowMs(now);
    if (!today(j, now) || !fresh(j, now, H6) || j.schoolNight !== true || j.visible !== true) return null;
    var from = parse(j.visibleFromIso), until = parse(j.visibleUntilIso);
    if (!from || !until || t < from || t >= until) return null; /* hides at 7:00 even on a stale file */
    var lines = [];
    function add(k, x) { var c = x && displayText(str(x.copy, 90), rules); if (c) lines.push({ k: k, v: c }); }
    (Array.isArray(j.pickup) ? j.pickup : []).forEach(function (x) { add("Pickup", x); });
    (Array.isArray(j.gear) ? j.gear : []).forEach(function (x) { add("Gear", x); });
    if (j.form) add("Form", j.form);
    return lines.length ? { lines: lines, untilMs: until } : null;
  }

  /* ---- field weather: tonight's game (calendar) + the Open-Meteo hourly forecast house-weather.js already loads ----
     game = a timed event today (CT) whose title says "game", not a practice, not started yet; time = "game H:MM" / "H:MM game"
     in the title, else the event start. No game -> null -> no weather. */
  function fieldGame(cal, now, rules) {
    if (!cal || typeof cal !== "object") return null;
    var t = nowMs(now), day = ctDate(t), seen = {}, best = null;
    var evs = [].concat(cal.nextLeave ? [cal.nextLeave] : [], Array.isArray(cal.upcomingLeaves) ? cal.upcomingLeaves : []);
    evs.forEach(function (e) {
      if (!e || e.allDay || typeof e.summary !== "string" || seen[e.id || e.summary + e.start]) return;
      seen[e.id || e.summary + e.start] = 1;
      var s = parse(e.start); if (!s || ctDate(s) !== day) return;
      if (!/\bgame\b/i.test(e.summary) || /\bpractice\b/i.test(e.summary)) return;
      var gm = /\bgame\s+(\d{1,2}):(\d{2})\b|\b(\d{1,2}):(\d{2})\s+game\b/i.exec(e.summary), g = s;
      if (gm) {
        var hh = Number(gm[1] || gm[3]) % 12, mi = Number(gm[2] || gm[4]);
        var cands = [hh, hh + 12].map(function (h) { return s + ((h * 60 + mi) - (Number(ctParts(s).hour) * 60 + Number(ctParts(s).minute))) * 60000; });
        g = cands.sort(function (a, b) { return Math.abs(a - s) - Math.abs(b - s); })[0];
      }
      if (g < t || ctDate(g) !== day) return;
      var what = displayText(e.summary, rules); if (!what) return;
      if (!best || g < best.gameMs) best = { gameMs: g, at: fmtHM(g), what: what };
    });
    return best;
  }
  /* wx = HouseWeather.load() data; uses wx.hourlyTemp {time:["YYYY-MM-DDTHH:00" CT], temp:[°F]} from the same Open-Meteo call.
     Reads the hour the game starts in. Missing hour / no number / fallback source without hourly temps -> null (never invented). */
  function fieldWeather(game, wx) {
    if (!game || !wx || wx.source !== "open-meteo" || !wx.hourlyTemp || !Array.isArray(wx.hourlyTemp.time)) return null;
    var p = ctParts(game.gameMs), key = p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":00";
    var i = wx.hourlyTemp.time.indexOf(key);
    var v = i >= 0 && Array.isArray(wx.hourlyTemp.temp) ? wx.hourlyTemp.temp[i] : null;
    if (typeof v !== "number" || !isFinite(v)) return null;
    return { text: Math.round(v) + "\u00b0 at " + game.at, temp: Math.round(v), hour: key, source: "open-meteo hourly temperature_2m" };
  }

  return { TAP_IDS: TAP_IDS, CHECKIN_KIDS: CHECKIN_KIDS, LATE_CHIPS: LATE_CHIPS, STATE_KEY: STATE_KEY, houseDay: houseDay, fmtHM: fmtHM,
    compileRenames: compileRenames, displayText: displayText, leaveLine: leaveLine,
    logisticsControls: logisticsControls, statusLine: statusLine, logisticsFor: logisticsFor, readState: readState, applyTap: applyTap,
    schoolNight: schoolNight, fieldGame: fieldGame, fieldWeather: fieldWeather };
});
