/* OCT8-2 · sheet-status.html#status-feeds: the live per-feed status every freshness tap opens.
 * Each row reads the feed file itself (data/<name>.json, no cache) and shows the time stamped IN that file
 * (fetchedAt / updatedAt / generatedAt / refreshedAt), its age, and fresh / behind against the wall's own
 * 2 hour line. No stamp in the file = UNKNOWN. File not there = missing. Nothing here is typed by hand. */
(function (w, d) {
  "use strict";
  var TZ = "America/Chicago", MAX_MS = 2 * 60 * 60 * 1000; /* = wall.html FEED_MAX_MS */
  var FEEDS = [
    ["Calendar", "cal-live.json"], ["Kids week", "kids-week.json"], ["Thermostat (Sensi)", "sensi-live.json"],
    ["Cameras (Nest)", "nest-live.json"], ["Lights (Kasa)", "lights-live.json"], ["House mode", "house-mode.json"],
    ["Next up", "next-up.json"], ["Kid seats", "kid-seats.json"], ["Unlocks", "unlocks.json"], ["Pickups", "pickup-chain.json"],
    ["School night", "school-night.json"], ["Taps", "logistics-taps.json"], ["Who's home", "who-home.json"],
    ["Groceries", "grocery-list.json"], ["Pack flags", "pack-flags.json"], ["Month", "cal-months.json"]];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function stampOf(j) { return j && (j.fetchedAt || j.updatedAt || j.generatedAt || j.refreshedAt) || ""; }
  function day(ms) { return new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ }); }
  function when(ms, now) {
    var t = new Date(ms).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
    if (day(ms) === day(now)) return "Today " + t;
    return new Date(ms).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }) + " " + t;
  }
  function age(ms, now) {
    var m = Math.round((now - ms) / 60000);
    if (m < 0) return "time is ahead of this screen's clock";
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    var h = Math.floor(m / 60); if (h < 48) return h + " h " + (m % 60) + " min ago";
    return Math.floor(h / 24) + " days ago";
  }
  function row(f, now) {
    var cls, tag, line;
    if (!f.ok) { cls = "need"; tag = "Missing"; line = "data/" + f.file + " not found on this site"; }
    else {
      var ms = Date.parse(f.stamp);
      if (!f.stamp || !isFinite(ms)) { cls = "need"; tag = "UNKNOWN"; line = "No time in the file"; }
      else {
        var fresh = now - ms <= MAX_MS && now - ms >= -5 * 60000;
        cls = fresh ? "live" : "need"; tag = fresh ? "Fresh" : "Behind";
        line = when(ms, now) + " · " + age(ms, now);
      }
      if (f.status && f.status !== "live") line += " · says " + f.status;
    }
    return '<div class="gap-row" data-feed="' + esc(f.file) + '" data-feed-state="' + esc(tag.toLowerCase()) + '"><div><div class="t">' + esc(f.label) +
      '</div><div class="d">' + esc(line) + '</div></div><span class="tag ' + (cls === "live" ? "closed cmd-pill cmd-pill--live" : "open cmd-pill cmd-pill--need") + '">' + esc(tag) + "</span></div>";
  }
  function paint(list) {
    var now = Date.now(), host = d.getElementById("status-feed-list"), sum = d.getElementById("status-feed-sum");
    if (!host) return;
    host.innerHTML = list.map(function (f) { return row(f, now); }).join("");
    var fresh = host.querySelectorAll('[data-feed-state="fresh"]').length, n = list.length;
    if (sum) sum.textContent = fresh + " of " + n + " feeds fresh · checked " + when(now, now);
  }
  function load() {
    Promise.all(FEEDS.map(function (x) {
      return fetch("data/" + x[1] + "?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json().then(function (j) { return { ok: true, j: j }; }, function () { return { ok: true, j: null }; }) : { ok: false }; })
        .catch(function () { return { ok: false }; })
        .then(function (r) { return { label: x[0], file: x[1], ok: r.ok, stamp: stampOf(r.j), status: r.j && typeof r.j.status === "string" ? r.j.status : "" }; });
    })).then(paint);
  }
  w.HouseStatusFeeds = { load: load, stampOf: stampOf, FEEDS: FEEDS };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", load); else load();
  setInterval(load, 60000);
})(window, document);
