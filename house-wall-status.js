/* WALLKIT1/3 · house-wall-status.js · branch wall-redesign-1 · loaded only by wall.html (branch, not deployed).
   Pure rules for the 27" wall: next up, status lights, scenes, thermostat Travel, open loops.
   No DOM, no fetch, no timers, no writes. Every light returns null (= hidden) or {id, ok, text, href}.
   Stale or missing data -> null. Never a placeholder. Never invents a scene, device, band, cadence, or time.
   Rulings Oct 1 (redesign owner): cams only (no doors) and hidden until a real per-camera check exists;
   dragon has no line; pond hidden until a real source; travel week READ from data/house-mode.json only
   (never inferred from the calendar); thermostat is a plain reading, no flag while temps are null;
   Load day hidden until a live source with an as-of; listening pip PARKED; Home/Leaving = Dan's Kasa scenes
   (no key -> NEED KEY, zero requests); thermostat Travel 55-85 / Back home (arm then confirm);
   laundry = NEED TOKEN until an LG ThinQ PAT exists.
   Plan: docs/wall-redesign/*.md. Tests: scripts/wall/house-wall-status.test.mjs */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HouseWallStatus = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TZ = "America/Chicago";
  /* Fresh windows mirror constants that already ship (no new numbers). */
  var FRESH = {
    nest: 30 * 60 * 1000,        /* house-nest.js LIVE_FRESH_MS */
    sensi: 30 * 60 * 1000,       /* house-sensi.js LIVE_FRESH_MS */
    lights: 24 * 60 * 60 * 1000, /* house-lights.js LIVE_FRESH_MS */
    cal: 6 * 60 * 60 * 1000,     /* house-board-strip.js CAL_FRESH_MS */
    laundry: 30 * 60 * 1000,     /* ASSUMED kit default (mirrors Sensi/Nest polled feeds) · no laundry feed exists yet */
    laundryTimer: 5 * 60 * 1000  /* ASSUMED: a remaining time older than this is not printed (never extrapolated) */
  };
  var HUB = "sheet-google-home.html";
  var LOAD = "sheet-load-day.html";
  /* house-mode.json keys = Atlas's real schema (docs/wall-redesign/ATLAS-DATA-LANE.md, merged @ 4b288a4). */
  var MODE_KEYS = ["school-day", "after-school", "weekend", "day-off", "kids-away", "nashville-week", "guest", "quiet"];
  var MODE_LABEL_FORCE = { "kids-away": "Kids away" }; /* ruling: never "Custody-out" or a parent-week label on the wall; the file label is not shown for this key */
  var KID_NAMES = ["Ainsley", "Hayes", "Harris"];
  var TRAVEL_KEYS = ["nashville-week"];

  function nowMs(now) { return now == null ? Date.now() : (now instanceof Date ? now.getTime() : Number(now)); }
  function parse(iso) { if (!iso) return 0; var t = Date.parse(iso); return isFinite(t) ? t : 0; }
  function fresh(iso, maxMs, now) {
    var t = parse(iso);
    if (!t || !(maxMs > 0)) return false;
    var age = nowMs(now) - t;
    return age >= -5 * 60 * 1000 && age <= maxMs;
  }
  function ctIso(ms) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  }
  function addDaysIso(iso, n) {
    var p = iso.split("-").map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n, 12));
    return d.toISOString().slice(0, 10);
  }
  function shortCam(name) { return String(name || "").replace(/\s+camera$/i, "").trim(); }
  function nameList(names) {
    if (names.length <= 2) return names.join(", ");
    return names[0] + " +" + (names.length - 1);
  }

  /* 1 · Cams only (doors not shown). Hidden until a real per-camera check exists:
     every roster cam must carry online === true/false from a real check (SDM Connectivity or a proxy probe).
     Today all cams report online:null, so this returns null. */
  function camsLight(nest, opts) {
    opts = opts || {};
    if (!nest || nest.status !== "live" || nest.error) return null;
    if (!fresh(nest.fetchedAt || nest.updatedAt, FRESH.nest, opts.now)) return null;
    var cams = Array.isArray(nest.cameras) ? nest.cameras : [];
    if (!cams.length) return null;
    var byName = {};
    cams.forEach(function (c) { byName[String(c.name || "")] = c; });
    var roster = Array.isArray(opts.roster) && opts.roster.length ? opts.roster : cams.map(function (c) { return c.name; });
    var bad = [], unknown = false;
    roster.forEach(function (n) {
      var c = byName[n];
      if (!c) bad.push(shortCam(n));
      else if (c.online === false) bad.push(shortCam(n));
      else if (c.online !== true) unknown = true;
    });
    if (unknown) return null; /* no real per-camera check -> hidden (never "OK" on null) */
    if (bad.length) return { id: "cams", ok: false, text: nameList(bad) + " offline", href: HUB };
    return { id: "cams", ok: true, text: "Cams OK", href: HUB };
  }

  /* House mode · READ ONLY from data/house-mode.json (Atlas):
     {mode:"<key>", label, since, until, asOfIso, generatedAt, source, reason, warnings}.
     Hidden (null) when missing, unknown key, no label, asOfIso != today CT, or now is outside since..until.
     Travel / Nashville week only ever comes from this file (never inferred). */
  function readHouseMode(json, opts) {
    opts = opts || {};
    if (!json || typeof json !== "object" || typeof json.mode !== "string") return null;
    var now = nowMs(opts.now);
    if (json.asOfIso !== ctIso(now)) return null;
    var gen = parse(json.generatedAt);
    if (gen && gen > now + 5 * 60 * 1000) return null; /* a file from later than this clock is not this window's data */
    /* DAYWIN1 · Atlas writes the house day's windows (timeline); the wall shows the one covering its own clock */
    if (Array.isArray(json.timeline) && json.timeline.length) {
      var win = null;
      for (var i = 0; i < json.timeline.length; i++) {
        var w = json.timeline[i]; if (!w || typeof w.mode !== "string") continue;
        var ws = parse(w.since), wu = parse(w.until);
        if ((!ws || now >= ws - 5 * 60 * 1000) && (!wu || now < wu)) { win = w; break; }
      }
      if (!win) return null;
      json = { mode: win.mode, label: win.label, since: win.since, until: win.until, asOfIso: json.asOfIso };
    }
    var key = json.mode;
    if (MODE_KEYS.indexOf(key) < 0 || !json.label) return null;
    var until = parse(json.until), since = parse(json.since);
    if (until && now >= until) return null;
    if (since && now < since - 5 * 60 * 1000) return null;
    var label = MODE_LABEL_FORCE[key] || String(json.label);
    return { key: key, id: key, label: label, since: json.since || null, until: json.until || null };
  }
  function isTravelWeek(mode) { return !!(mode && TRAVEL_KEYS.indexOf(mode.key) >= 0); }

  /* 2 · Thermostat · plain reading "73° · school day". mode = readHouseMode(...) result.
     temps = data/house-mode-temps.json (Atlas; values null today). A flag only appears when that mode's
     band has real numbers: {heatSetpoint:[lo,hi]|null, coolSetpoint:[lo,hi]|null}. Null -> never flagged. */
  /* Travel = the LIVE reading is Auto heat 55 / cool 85 (not a local flag). */
  var TRAVEL_SET = { mode: "auto", heatSetpoint: 55, coolSetpoint: 85 };
  function isTravelThermo(th) {
    return !!th && String(th.mode || "").toLowerCase() === TRAVEL_SET.mode
      && th.heatSetpoint === TRAVEL_SET.heatSetpoint && th.coolSetpoint === TRAVEL_SET.coolSetpoint;
  }
  /* data/house-mode-temps.json -> bands (mirror of Atlas bandsFromTemps in scripts/house/wall-state.mjs).
     Only non-null targets make a band; all null (today, "awaiting Dan") = {} = never flags. */
  function bandsFromTemps(temps) {
    var out = {}, modes = (temps && temps.modes) || {};
    var tol = temps && typeof temps.toleranceF === "number" ? temps.toleranceF : 0;
    MODE_KEYS.forEach(function (k) {
      var m = modes[k]; if (!m) return;
      var band = {};
      if (typeof m.heatSetpoint === "number") band.heatSetpoint = [m.heatSetpoint - tol, m.heatSetpoint + tol];
      if (typeof m.coolSetpoint === "number") band.coolSetpoint = [m.coolSetpoint - tol, m.coolSetpoint + tol];
      if (Object.keys(band).length) out[k] = band;
    });
    return out;
  }
  function numRange(r) { return Array.isArray(r) && r.length === 2 && typeof r[0] === "number" && typeof r[1] === "number"; }
  function thermoLight(sensi, opts) {
    opts = opts || {};
    if (!sensi || sensi.status !== "live" || sensi.error || !sensi.thermostat) return null;
    if (!fresh(sensi.updatedAt, FRESH.sensi, opts.now)) return null;
    var th = sensi.thermostat;
    if (th.online === false) return { id: "thermo", ok: false, text: "Thermostat offline", href: HUB };
    if (isTravelThermo(th)) return { id: "thermo", ok: true, travel: true, text: "Travel \u00b7 55\u201385", href: HUB };
    if (typeof th.ambient !== "number") return null;
    var mode = opts.mode && opts.mode.label ? opts.mode : null;
    var text = th.ambient + "\u00b0" + (mode ? " \u00b7 " + mode.label.toLowerCase() : "");
    var mkey = mode ? (mode.key || mode.id) : null;
    var bands = opts.bands || (opts.temps ? bandsFromTemps(opts.temps) : null);
    var band = mkey && bands ? bands[mkey] : null;
    if (band) {
      var bad = (numRange(band.heatSetpoint) && !(th.heatSetpoint >= band.heatSetpoint[0] && th.heatSetpoint <= band.heatSetpoint[1]))
        || (numRange(band.coolSetpoint) && !(th.coolSetpoint >= band.coolSetpoint[0] && th.coolSetpoint <= band.coolSetpoint[1]));
      if (bad) {
        var set = (th.heatSetpoint != null && th.coolSetpoint != null && /^auto$/i.test(th.mode))
          ? th.heatSetpoint + "\u2013" + th.coolSetpoint : String(th.setpoint != null ? th.setpoint : "");
        return { id: "thermo", ok: false, attention: true, text: text + " \u00b7 check set " + set + "\u00b0", href: HUB };
      }
    }
    return { id: "thermo", ok: true, text: text, href: HUB };
  }

  /* 3 · Load day, only today or tomorrow. src = {loadDay:{isoDate,label}, asOfIso} from an Atlas feed (none exists yet). */
  function loadDayLight(src, opts) {
    opts = opts || {};
    if (!src || !src.loadDay || !src.loadDay.isoDate) return null;
    var today = ctIso(nowMs(opts.now));
    if (src.asOfIso !== today) return null;
    var d = src.loadDay.isoDate;
    if (d === today) return { id: "loadday", ok: true, text: "Load day today", href: LOAD };
    if (d === addDaysIso(today, 1)) return { id: "loadday", ok: true, text: "Load day tomorrow", href: LOAD };
    return null;
  }

  /* 4 · Travel-week care. Dragon: NO line (ruling: hidden until it exists). Pond: hidden until a real source.
     Gate = isTravelWeek(readHouseMode(house-mode.json)) only. pond = {filterOk:boolean, asOf, freshMs} from a
     real source (none exists); freshMs must come with the source (cadence UNKNOWN) or the line stays hidden. */
  function travelLights(mode, care, opts) {
    opts = opts || {};
    var out = [];
    if (!isTravelWeek(mode) || !care) return out;
    var pd = care.pond;
    if (pd && typeof pd.filterOk === "boolean" && fresh(pd.asOf, pd.freshMs, opts.now)) {
      out.push({ id: "pond", ok: pd.filterOk, text: pd.filterOk ? "Pond filter OK" : "Pond filter not OK", href: null });
    }
    return out;
  }

  /* 5 · Laundry (LG ThinQ Connect). Field names inside unit.state are LG's real device-state schema
     (runState.currentState, timer.remainHour/remainMinute, remoteControlEnable.remoteControlEnabled,
     operation.washerOperationMode / dryerOperationMode). The wrapper {status, fetchedAt, washer:{state}, dryer:{state}}
     is a PROPOSED proxy shape (no feed exists). null / no token -> "NEED TOKEN". Stale -> hidden. */
  var ACTIVE = ["RUNNING", "DETECTING", "SOAKING", "PREWASH", "RINSING", "SPINNING", "DRYING", "COOLING", "STEAM",
    "STEAM_SOFTENING", "REFRESHING", "ADD_DRAIN", "RINSE_HOLD", "SMART_GRID_RUN", "CHANGE_CONDITION", "DISPLAY_LOADSIZE", "DETERGENT_AMOUNT"];
  var DONE = ["END", "COMPLETE", "WRINKLE_CARE", "RUNNING_END"];
  var IDLE = ["POWER_OFF", "INITIAL", "SLEEP", "STANDBY"];
  function unitState(unit) {
    if (!unit || !unit.state) return null;
    var st = unit.state;
    if (Array.isArray(st)) { /* location-list form: prefer MAIN */
      var main = st.filter(function (x) { return x && x.location && x.location.locationName === "MAIN"; })[0];
      st = main || st[0];
    }
    return st && typeof st === "object" ? st : null;
  }
  function runState(unit) {
    var st = unitState(unit);
    var v = st && st.runState && st.runState.currentState;
    return v ? String(v).toUpperCase() : null;
  }
  function remainText(st) {
    var t = st && st.timer;
    if (!t || typeof t.remainHour !== "number" || typeof t.remainMinute !== "number") return null;
    if (t.remainHour < 0 || t.remainMinute < 0 || t.remainMinute > 59) return null;
    return t.remainHour + ":" + (t.remainMinute < 10 ? "0" : "") + t.remainMinute;
  }
  function unitText(name, unit, timerFresh) {
    var rs = runState(unit);
    if (!rs || IDLE.indexOf(rs) >= 0) return null;
    if (DONE.indexOf(rs) >= 0) return { text: name + " DONE", ok: true };
    if (rs === "PAUSE" || rs === "PAUSED") return { text: name + " paused", ok: true };
    if (rs === "RESERVED") return { text: name + " delay start", ok: true };
    if (rs === "ERROR" || rs === "POWER_FAIL") return { text: name + " error", ok: false };
    if (ACTIVE.indexOf(rs) >= 0) {
      var tt = timerFresh ? remainText(unitState(unit)) : null;
      return { text: name + " " + (tt || "running"), ok: true }; /* never a made-up time */
    }
    return { text: name + " " + rs.toLowerCase().replace(/_/g, " "), ok: true }; /* honest raw state */
  }
  function laundryLight(laundry, opts) {
    opts = opts || {};
    if (!laundry || laundry.status === "need_token" || laundry.hasToken === false) {
      return { id: "laundry", ok: false, need: true, text: "NEED TOKEN", href: HUB + "#laundry" };
    }
    if (laundry.status !== "live" || laundry.error) return null;
    if (!fresh(laundry.fetchedAt, FRESH.laundry, opts.now)) return null;
    var timerFresh = fresh(laundry.fetchedAt, FRESH.laundryTimer, opts.now);
    var parts = [unitText("Washer", laundry.washer, timerFresh), unitText("Dryer", laundry.dryer, timerFresh)].filter(Boolean);
    if (!parts.length) return null; /* both off / idle -> nothing to say */
    return {
      id: "laundry",
      ok: parts.every(function (p) { return p.ok; }),
      text: parts.map(function (p) { return p.text; }).join(" \u00b7 "),
      href: HUB + "#laundry"
    };
  }
  /* Controls for one unit ("washer" | "dryer"). No token -> every control disabled, sends:false (zero requests).
     Start ONLY when the appliance reports remoteControlEnable.remoteControlEnabled === true (Remote Start armed).
     No Pause: ThinQ Connect's writable washer/dryerOperationMode enum has no pause value (START, STOP, POWER_OFF,
     POWER_ON / WAKE_UP per model profile), so Pause is hidden, never mapped to STOP (ruling Oct 1). See LAUNDRY.md.
     Off (POWER_OFF) also needs the remote-control flag (ASSUMED; LG enforcement per model UNKNOWN). */
  function laundryControls(laundry, unitKey, opts) {
    opts = opts || {};
    var off = { start: false, off: false, sends: false };
    if (!laundry || laundry.status !== "live" || laundry.hasToken === false || laundry.error) return Object.assign(off, { reason: "NEED TOKEN" });
    if (!fresh(laundry.fetchedAt, FRESH.laundry, opts.now)) return Object.assign(off, { reason: "STALE" });
    var unit = laundry[unitKey], st = unitState(unit), rs = runState(unit);
    if (!st || !rs) return Object.assign(off, { reason: "NO UNIT" });
    var armed = !!(st.remoteControlEnable && st.remoteControlEnable.remoteControlEnabled === true);
    var active = ACTIVE.indexOf(rs) >= 0;
    var c = { start: armed && !active, off: armed && rs !== "POWER_OFF" };
    c.sends = c.start || c.off;
    c.reason = armed ? null : "REMOTE START OFF";
    return c;
  }

  /* feeds: {nest, sensi, loadDay, care, laundry, houseMode (raw house-mode.json), temps (house-mode-temps.json)} */
  function statusStrip(feeds, opts) {
    feeds = feeds || {}; opts = opts || {};
    var mode = readHouseMode(feeds.houseMode, { now: opts.now });
    var lights = [
      camsLight(feeds.nest, { now: opts.now, roster: opts.roster }),
      thermoLight(feeds.sensi, { now: opts.now, mode: mode, temps: feeds.temps }),
      loadDayLight(feeds.loadDay, { now: opts.now })
    ].concat(travelLights(mode, feeds.care, { now: opts.now }));
    if ("laundry" in feeds) lights.push(laundryLight(feeds.laundry, { now: opts.now }));
    return lights.filter(Boolean);
  }

  /* NEXT UP from cal-live.json nextLeave. Hidden when the feed is not live, older than 6h, not today's,
     or the event is all-day / already over / not today. Text is the calendar's own words (never rewritten). */
  function clockParts(ms) {
    var p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(ms)).split(" ");
    return { t: p[0], ap: p[1] || "" };
  }
  function nextUp(cal, opts) {
    opts = opts || {};
    var now = nowMs(opts.now);
    if (!cal || cal.status !== "live" || cal.error) return null;
    if (!fresh(cal.fetchedAt || cal.updatedAt, FRESH.cal, now)) return null;
    if (cal.asOfIso !== ctIso(now)) return null;
    var e = cal.nextLeave;
    if (!e || e.allDay || !e.summary) return null;
    var s = parse(e.start), en = parse(e.end);
    if (!s || ctIso(s) !== ctIso(now)) return null;
    if ((en || s) <= now) return null;
    var where = e.location ? String(e.location).split(",")[0].trim() : "";
    if (where && String(e.summary).toLowerCase().indexOf(where.toLowerCase()) >= 0) where = ""; /* already in the words */
    return { time: clockParts(s).t, ampm: clockParts(s).ap, what: String(e.summary), where: where || null,
      ends: en ? clockParts(en).t + " " + clockParts(en).ap : null, startIso: e.start };
  }
  /* Header stale dot: which PRESENT feeds are past their window (missing files are hidden tiles, not stale). */
  function staleFeeds(feeds, opts) {
    feeds = feeds || {}; opts = opts || {};
    var out = [];
    [["cal", "calendar"], ["sensi", "thermostat"], ["nest", "cams"], ["lights", "lights"]].forEach(function (k) {
      var f = feeds[k[0]];
      if (!f) return;
      if (f.status !== "live" || !fresh(f.fetchedAt || f.updatedAt, FRESH[k[0]], opts.now)) out.push(k[1]);
    });
    return out;
  }

  /* Pickup strip · data/pickup-chain.json (Atlas). Hidden when missing, not today's, generatedAt older than the
     calendar window (6 h, same as cal-live), at/after cutoff, or no rows left. Status is re-derived from the clock:
     the row in progress = now, the first upcoming = next, the rest = later. Ended rows are dropped. */
  function pickupChain(json, opts) {
    opts = opts || {};
    var now = nowMs(opts.now), today = ctIso(now);
    if (!json || json.asOfIso !== today || json.date !== today || json.schoolDay === false) return null;
    if (!fresh(json.generatedAt, FRESH.cal, now)) return null;
    var cut = parse(json.cutoff);
    if (cut && now >= cut) return null;
    var rows = (Array.isArray(json.rows) ? json.rows : []).filter(function (r) {
      if (!r || !r.what || !Array.isArray(r.who) || !r.who.length) return false;
      if (!r.who.every(function (w) { return KID_NAMES.indexOf(w) >= 0; })) return false;
      var end = parse(r.endIso) || parse(r.timeIso) || parse(r.startIso);
      return end > now;
    }).map(function (r) {
      return { who: r.who.slice(), by: r.by || null, what: String(r.what), where: r.where || null, time: r.time || null,
        leaveBy: r.leaveBy || null, gear: Array.isArray(r.gear) ? r.gear.slice() : [], kind: r.kind || null,
        startMs: parse(r.startIso) || parse(r.timeIso), endMs: parse(r.endIso) };
    });
    if (!rows.length) return null;
    rows.sort(function (a, b) { return a.startMs - b.startMs; });
    var nextSet = false;
    rows.forEach(function (r) {
      if (r.startMs && r.startMs <= now && (!r.endMs || now < r.endMs)) r.status = "now";
      else if (!nextSet) { r.status = "next"; nextSet = true; }
      else r.status = "later";
    });
    return { rows: rows, generatedAt: json.generatedAt };
  }

  /* Who's home · data/who-home.json (Atlas shape; check-ins are per-device, no writer exists yet).
     House day = CT date of (now - 3h). Shown only when at least one kid has a real check-in from this house day;
     an all-null seed would just be three placeholders, so it stays hidden. Kids away -> hidden. */
  function houseDay(now) { return ctIso(nowMs(now) - 3 * 60 * 60 * 1000); }
  function whoHome(json, opts) {
    opts = opts || {};
    var now = nowMs(opts.now);
    if (opts.mode && opts.mode.key === "kids-away") return null;
    if (!json || json.date !== houseDay(now) || !Array.isArray(json.kids)) return null;
    var day = houseDay(now), any = false;
    var kids = KID_NAMES.map(function (name) {
      var k = json.kids.filter(function (x) { return x && (x.name === name || String(x.id || "") === name.toLowerCase()); })[0];
      var at = k && k.checkedInAt ? parse(k.checkedInAt) : 0;
      var ok = !!at && at <= now + 5 * 60 * 1000 && houseDay(at) === day;
      if (ok) any = true;
      return { name: name, inAt: ok ? new Date(at).toISOString() : null };
    });
    return any ? { kids: kids } : null;
  }

  /* Pack flags · data/pack-flags.json (Atlas). Today-relevant only: date == today CT, before clearsAt, each flag
     created today CT, kid is one of the three, text 1-60 chars (Atlas's addPackFlag already wall-safe-scans). */
  function packFlags(json, opts) {
    opts = opts || {};
    var now = nowMs(opts.now), today = ctIso(now);
    if (!json || json.date !== today || !Array.isArray(json.flags)) return null;
    var clr = parse(json.clearsAt);
    if (clr && now >= clr) return null;
    var flags = json.flags.filter(function (f) {
      var at = f && parse(f.createdAt);
      return at && ctIso(at) === today && at <= now + 5 * 60 * 1000 && KID_NAMES.indexOf(f.kid) >= 0
        && typeof f.text === "string" && f.text.trim().length > 0 && f.text.length <= 60;
    }).map(function (f) { return { kid: f.kid, text: f.text.trim() }; });
    return flags.length ? { flags: flags } : null;
  }

  /* Scenes (Dan, Oct 1). Kasa only, through the EXISTING lights write path (HouseLights.setLight).
     Neither touches the Sensi. Kasa All on / All off stays as is and is not relabeled. Mode chips recall nothing. */
  var SCENES = {
    home: { id: "home", label: "I\u2019m home", writes: [{ id: "kitchen", on: true }, { id: "dining-room", on: true }] },
    leave: { id: "leave", label: "Leaving", writes: [{ id: "dining-room", on: false }, { id: "harris-room", on: false }, { id: "kitchen", on: false }] }
  };
  function scenePlan(id) {
    var sc = SCENES[id];
    return sc ? sc.writes.map(function (w) { return { id: w.id, on: w.on }; }) : [];
  }
  /* hasKey = a lights key is saved on this screen. No key -> quiet NEED KEY, zero requests. */
  function sceneButtons(opts) {
    opts = opts || {};
    return ["home", "leave"].map(function (id) {
      var sc = SCENES[id];
      return { id: id, label: sc.label, sub: opts.hasKey ? null : "NEED KEY", disabled: !opts.hasKey, sends: !!opts.hasKey };
    });
  }

  /* Arm-then-confirm (no menu). First tap arms; a second tap within ARM_MS confirms; otherwise it disarms. */
  var ARM_MS = 5000;
  function armTap(arm, now) {
    var t = nowMs(now);
    if (arm && arm.armedAt != null && t - arm.armedAt >= 0 && t - arm.armedAt < ARM_MS) return { arm: null, fire: true };
    return { arm: { armedAt: t }, fire: false };
  }
  function isArmed(arm, now) {
    var t = nowMs(now);
    return !!(arm && arm.armedAt != null && t - arm.armedAt >= 0 && t - arm.armedAt < ARM_MS);
  }
  /* Thermostat Travel button. th = live reading; saved = proxy says a prior setting is captured (true/false/null). */
  function travelButton(th, opts) {
    opts = opts || {};
    var travel = isTravelThermo(th);
    var armed = isArmed(opts.arm, opts.now);
    var b = { action: travel ? "back" : "travel", label: travel ? "Back home" : "Travel", sub: null, armed: false, disabled: false, sends: false };
    if (!opts.hasKey) { b.sub = "NEED KEY"; b.disabled = true; return b; }
    if (!th || th.online === false) { b.disabled = true; return b; }
    if (travel && opts.saved !== true) { b.sub = "no saved setting"; b.disabled = true; return b; }
    b.armed = armed;
    b.sends = armed; /* only a confirm (second tap) sends */
    if (armed) b.label = travel ? "Tap again \u00b7 Back home" : "Tap again \u00b7 Travel 55\u201385";
    return b;
  }

  /* ---------- open loops: max 3, house objects only ---------- */
  var MONEY_RE = /\$|\b(bills?|balances?|autopay|wells|cards?|pay|paid|payment|owed?|cost|price|buy|bought|bids?|quotes?|invoice|refund|ledger|cash|budget|dollars?|usd)\b/i;
  var KID_DOLLAR_RE = /\b(jars?|gems?|stars?|allowance|payday|rewards?)\b/i;
  var PEOPLE_RE = /\b(hayes|ainsley|harris|erin|kristin|dan|daniel|mom|dad|coach|riley|casey|text|email|call|reply|legal|court|therap\w*)\b/i;
  var SEVERITY = { safety: 0, device: 1, task: 2 };

  function isHouseLoop(item) {
    if (!item || item.kind !== "house-object" || !item.object || !item.text) return false;
    var obj = String(item.object);
    var rest = String(item.text).split(obj).join(" ");
    if (MONEY_RE.test(obj) || MONEY_RE.test(rest)) return false;
    if (KID_DOLLAR_RE.test(obj) || KID_DOLLAR_RE.test(rest)) return false;
    if (item.rosterName !== true && PEOPLE_RE.test(obj)) return false; /* device names only via live roster */
    if (PEOPLE_RE.test(rest)) return false;
    return SEVERITY.hasOwnProperty(item.severity);
  }

  function openLoops(items, opts) {
    opts = opts || {};
    var list = (Array.isArray(items) ? items : []).filter(function (it) {
      return isHouseLoop(it) && fresh(it.asOf, it.freshMs, opts.now);
    });
    list.sort(function (a, b) {
      var s = SEVERITY[a.severity] - SEVERITY[b.severity];
      if (s) return s;
      var da = parse(a.due), db = parse(b.due);
      if (da && db && da !== db) return da - db;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return String(a.object).localeCompare(String(b.object));
    });
    return list.slice(0, 3); /* [] -> strip hidden */
  }

  /* INV-01 (Atlas 10/2): today's calendar REMIND / GET items are the open-loops source.
     "REMIND · x", "GET · x", or "<who> — get x" on today's CT date, not yet past. The who-prefix and any
     agent hand-off ("→ Ledger") are dropped; clean (house-noagent) runs on the words when given. Everything
     still goes through isHouseLoop, so money, people and messages never reach the face. */
  var LOOP_RE = /^\s*(?:(REMIND|GET)\b\s*[·:\-\u2014]?\s*|[^\u2014]{1,40}\s\u2014\s*(get|remind)\b\s*)(.+)$/i;
  function ctDayOf(ms) {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms)); }
    catch (e) { return ""; }
  }
  function calLoops(cal, opts) {
    opts = opts || {};
    var now = nowMs(opts.now), clean = typeof opts.clean === "function" ? opts.clean : function (t) { return t; };
    if (!cal || !Array.isArray(cal.upcomingLeaves)) return [];
    var seen = {};
    return cal.upcomingLeaves.filter(function (e) {
      var t = parse(e && e.start);
      return e && !e.allDay && t && ctDayOf(t) === ctDayOf(now) && parse(e.end || e.start) >= now;
    }).map(function (e) {
      var m = LOOP_RE.exec(String(e.summary || ""));
      if (!m) return null;
      var verb = (m[1] || m[2] || "").toLowerCase();
      var what = clean(String(m[3]).replace(/\s*\u2192\s*[A-Z][\w ]*?(?=\s*\(|$)/, "").trim());
      if (!what) return null;
      var text = (verb === "get" ? "Get " : "Remind \u00b7 ") + what;
      var obj = what.split(/\s*[(\u00b7]/)[0].trim() || what;
      if (seen[text]) return null; seen[text] = 1;
      return { kind: "house-object", object: obj, text: text, severity: "task", due: e.start,
        asOf: cal.fetchedAt, freshMs: FRESH.cal, href: "sheet-today.html#today-now", source: "cal-live" };
    }).filter(Boolean);
  }

  /* KIDSAWAY1 (10/2): while the kids are away the seat band shows Dan's next days from cal-live (real items only).
     Window: from now through the kids-back day (opts.until), at most 7 days after today. Dropped: items already
     over, kid items (the who-part names a kid or "Kids"; the handoff itself rides on the "Kids back" line), money
     (MONEY_RE), private items (consults, therapy, legal), and anything empty after the helper-name filter (opts.clean).
     Words: a leading "Free · " and "Dan — " are dropped, [brackets] and any other dash read as " · ", booking codes go.
     opts.keepKids keeps kid items (the header glance's "Next" fallback on a kids-home day).
     Returns [{ day: "2026-10-03", label: "Sat Oct 3", items: [{ time: "8:00 AM" | "All day", text, start }] }]. */
  var AWAY_KID_RE = /\b(hayes|harris|ainsley|kids?)\b/i;
  var PRIVATE_RE = /\b(consult\w*|therap\w*|counsel\w*|lpc|lcsw|psych\w*|legal|court|attorney|lawyer|custody|mediat\w*)\b/i;
  function awayDays(cal, opts) {
    opts = opts || {};
    var now = nowMs(opts.now), clean = typeof opts.clean === "function" ? opts.clean : function (t) { return t; };
    if (!cal || !Array.isArray(cal.upcomingLeaves)) return [];
    var today = ctDayOf(now), last = ctDayOf(now + 7 * 864e5), until = parse(opts.until);
    if (until) { var ud = ctDayOf(until); if (ud < last) last = ud; }
    var byDay = {}, order = [], seen = {};
    cal.upcomingLeaves.forEach(function (e) {
      var t = parse(e && e.start); if (!e || !t) return;
      var end = parse(e.end) || t, day = ctDayOf(t);
      if (e.allDay) { var sd = String(e.start).slice(0, 10); day = /^\d{4}-\d{2}-\d{2}$/.test(sd) ? sd : day; if (day < today) return; }
      else if (end < now) return;
      if (day < today || day > last) return;
      var raw = String(e.summary || "").trim(); if (!raw) return;
      var body = raw.replace(/^Free\s*\u00b7\s*/i, "");
      var who = body.split(/\s+\u2014\s+|\s*\[|\s+\u00b7\s+/)[0];
      if (!opts.keepKids && AWAY_KID_RE.test(who)) return;
      if (MONEY_RE.test(body) || KID_DOLLAR_RE.test(body) || PRIVATE_RE.test(body)) return;
      var text = clean(body.replace(/^Dan\s+\u2014\s+/, "").replace(/\s*#[A-Z0-9]{5,}\b/g, "")
        .replace(/\s*\[\s*/g, " \u00b7 ").replace(/\s*\]\s*/g, " ").replace(/\s*\u00b7\s*(\u00b7\s*)+/g, " \u00b7 ").replace(/\s{2,}/g, " ").trim()
        .replace(/^Dan\s+(?=[A-Z])/, "").replace(/\s*[\u2014\u2013]\s*/g, " \u00b7 ").replace(/\s*\u00b7\s*$/, ""));
      if (!text) return;
      var key = day + "|" + text.toLowerCase(); if (seen[key]) return; seen[key] = 1;
      if (!byDay[day]) { byDay[day] = []; order.push(day); }
      byDay[day].push({ time: e.allDay ? "All day" : clockOf(t), text: text, start: e.allDay ? day + "T00:00:00" : e.start, allDay: !!e.allDay });
    });
    order.sort();
    return order.map(function (d) {
      var items = byDay[d].sort(function (a, b) { return (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1) || (parse(a.start) - parse(b.start)); });
      var noon = Date.parse(d + "T12:00:00Z");
      var label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(noon)).replace(",", "");
      return { day: d, label: label, items: items };
    });
  }
  function clockOf(ms) {
    try { return new Date(ms).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; }
  }

  /* Loops derivable from feeds that exist today: Kasa light offline. */
  function lightLoops(lightsLive) {
    if (!lightsLive || lightsLive.status !== "live" || !Array.isArray(lightsLive.lights)) return [];
    return lightsLive.lights.filter(function (l) { return l && l.online === false && l.name; }).map(function (l) {
      var obj = l.name + " light";
      return { kind: "house-object", object: obj, rosterName: true, text: obj + " offline", severity: "device",
        asOf: lightsLive.fetchedAt, freshMs: FRESH.lights, href: HUB };
    });
  }

  return {
    FRESH: FRESH, MODE_KEYS: MODE_KEYS, TRAVEL_KEYS: TRAVEL_KEYS,
    camsLight: camsLight, readHouseMode: readHouseMode, isTravelWeek: isTravelWeek,
    thermoLight: thermoLight, loadDayLight: loadDayLight, travelLights: travelLights,
    laundryLight: laundryLight, laundryControls: laundryControls,
    SCENES: SCENES, scenePlan: scenePlan, sceneButtons: sceneButtons,
    ARM_MS: ARM_MS, armTap: armTap, isArmed: isArmed, isTravelThermo: isTravelThermo, travelButton: travelButton,
    statusStrip: statusStrip, nextUp: nextUp, staleFeeds: staleFeeds,
    bandsFromTemps: bandsFromTemps, pickupChain: pickupChain, whoHome: whoHome, houseDay: houseDay, packFlags: packFlags, KID_NAMES: KID_NAMES,
    isHouseLoop: isHouseLoop, openLoops: openLoops, lightLoops: lightLoops, calLoops: calLoops, awayDays: awayDays,
    _ctIso: ctIso
  };
});
