/* House Face · WHOSUP3 · kid flip · who’s up leave-window · hide scroll chrome · tap/OPEN → board
   WHOSUP2: prep/reminder items (pack · snacks · get/buy …) never own Who's up / Next leave —
   they bridge to the next REAL leave they feed; Who's up names every kid on that leave
   (Boys / SRE drop·pickup with no kid named → Hayes + Harris). Never invents events.
   LIVE only · WardKids · HUBTOK1 atoms. Bind-once · swipe flips · tap/OPEN navigates · claims safe.
   No leaveby/cam/nest/sensi JSON. */
(function (global) {
  "use strict";

  var KIDS = ["ainsley", "hayes", "harris"];
  /* WALLKIT9 · KL-05: Ainsley has a seat, not a score. No streak/day count anywhere on her seat (dropped, not relabeled).
     CHORELAW1 (Dan 8:01 PM CT): Ainsley has NO stars and NO counts. Her tile is trusted-with: no Stars face, no Musts n/n,
     no Today n/n, no progress glass. Atlas's rare, specific trusted-with line goes in [data-kf-trusted] (slot only: no copy here). */
  var SEAT_ONLY = { ainsley: true };
  function facesFor(kidId) { return SEAT_ONLY[kidId] ? FACES.filter(function (f) { return f !== "stars"; }) : FACES; }
  var FACES = ["day", "stars", "chores", "leave"];
  var FACE_LABEL = { day: "Day", stars: "Stars", chores: "Chores", leave: "Leave" };
  /* CHORELAW2 · ONE chore copy on the kid tiles: the Chores face, the Musts count and the run read Atlas's chore law
     (data/kid-seats.json via HouseWallKid), not the old kids-week.json quest chart. Quest data stays (Atlas retires it). */
  var LAW = null;
  var lawStore = { get: function (k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { global.localStorage.setItem(k, v); } catch (e) { /* */ } } };
  function HW() { return global.HouseWallKid || null; }
  function loadLaw(cb) {
    if (typeof fetch !== "function") { if (cb) cb(); return; }
    fetch("data/kid-seats.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (j) { LAW = j; if (cb) cb(); });
  }
  function lawMusts(kidId) { var w = HW(); return w && LAW ? w.musts(LAW, lawStore, kidId, Date.now()) : null; }
  function lawCount(kidId) { var m = lawMusts(kidId); return m ? { done: m.done, need: m.items.length } : { done: 0, need: 0 }; }
  function lawRun(kidId) { var w = HW(), r = w && LAW ? w.reward(LAW, kidId, Date.now()) : null; return r && r.days ? w.runText(r.days) : ""; }
  var HREF = {
    ainsley: "kid-ainsley.html",
    hayes: "kid-hayes.html",
    harris: "kid-harris.html"
  };
  var ACCENT = {
    ainsley: { rail: "#f098d4", ink: "#e8a0d0", name: "Ainsley" },
    hayes: { rail: "#5ec8e8", ink: "#7dd3e8", name: "Hayes" },
    harris: { rail: "#7ed492", ink: "#8ad49a", name: "Harris" }
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function kidsSafe(s) {
    var t = String(s == null ? "" : s);
    t = t.replace(/\bCUSTODY\b/gi, "WITH DAD");
    t = t.replace(/\bcustody\b/gi, "Dad week");
    return t;
  }

  function sfxTap() {
    try {
      if (global.HouseSfx && typeof HouseSfx.unlockAudio === "function") HouseSfx.unlockAudio();
      if (global.HouseSfx && typeof HouseSfx.tap === "function") HouseSfx.tap();
    } catch (e) { /* */ }
  }

  function sfxQuest(el) {
    try {
      if (global.HouseSfx && typeof HouseSfx.unlockAudio === "function") HouseSfx.unlockAudio();
      if (global.HouseSfx && typeof HouseSfx.quest === "function") {
        /* questPop path via boom + quest tone */
        if (typeof HouseSfx.boomAt === "function" && el) HouseSfx.boomAt(el);
        HouseSfx.quest();
      } else if (global.HouseSfx && typeof HouseSfx.tap === "function") {
        HouseSfx.tap();
      }
    } catch (e) { /* */ }
  }

  function sfxFlip() {
    sfxTap();
  }

  function WK() {
    return global.WardKids || null;
  }

  function data() {
    var w = WK();
    return (w && w._data) || null;
  }

  function dayIso() {
    var w = WK();
    return (w && w.DAY_ISO) || "";
  }

  function addDaysIso(iso, days) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return "";
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    d.setDate(d.getDate() + days);
    function pad(n) { return String(n).padStart(2, "0"); }
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function kidObj(kidId) {
    var d = data();
    return (d && d.kids && d.kids[kidId]) || null;
  }

  function mustQuests(kidId) {
    var w = WK();
    if (w && typeof w.mustQuests === "function") return w.mustQuests(kidId, data()) || [];
    var kid = kidObj(kidId);
    if (!kid || !kid.quests) return [];
    return kid.quests.filter(function (q) {
      return !(q.optional || q.cadence === "addon");
    });
  }

  /* CHORELAW3: must-* ids are shared by the three kids; a kid-scoped call qualifies them ("hayes:must-bed") */
  function Q(kidId, id) { var w = WK(); return (w && typeof w.qid === "function") ? w.qid(kidId, id) : id; }
  function getCheck(id, iso) {
    var w = WK();
    if (!w || typeof w.getCheck !== "function") return false;
    return !!w.getCheck(id, data(), iso || dayIso());
  }

  function setCheck(id, done, iso) {
    var w = WK();
    if (!w || typeof w.setCheck !== "function") return null;
    return w.setCheck(id, !!done, data(), iso || dayIso());
  }

  function mustProgress(kidId) {
    var w = WK();
    if (w && typeof w.mustProgress === "function") return w.mustProgress(kidId, data());
    return { done: 0, need: 0, complete: false };
  }

  function bankView(kidId) {
    var w = WK();
    if (w && typeof w.getBankView === "function") return w.getBankView(kidId, data());
    return null;
  }

  /** Honest LIVE streak: consecutive Chicago days where ALL daily musts were tapped. */
  function streakDays(kidId) {
    var qs = mustQuests(kidId).filter(function (q) {
      return (q.cadence || "daily") === "daily";
    });
    if (!qs.length) return 0;
    var today = dayIso();
    if (!today) return 0;

    function dayHit(iso) {
      for (var i = 0; i < qs.length; i++) {
        if (!getCheck(Q(kidId, qs[i].id), iso)) return false;
      }
      return true;
    }

    var start = today;
    if (!dayHit(today)) start = addDaysIso(today, -1);
    var n = 0;
    var cur = start;
    for (var i = 0; i < 28; i++) {
      if (!dayHit(cur)) break;
      n += 1;
      cur = addDaysIso(cur, -1);
      if (!cur) break;
    }
    return n;
  }

  function todayMustProgress(kidId) {
    var qs = mustQuests(kidId).filter(function (q) {
      return (q.cadence || "daily") === "daily";
    });
    var weekly = mustQuests(kidId).filter(function (q) {
      return (q.cadence || "") === "weekly";
    });
    var done = 0;
    var need = qs.length + weekly.length;
    var iso = dayIso();
    qs.forEach(function (q) { if (getCheck(Q(kidId, q.id), iso)) done += 1; });
    weekly.forEach(function (q) { if (getCheck(Q(kidId, q.id))) done += 1; });
    return { done: done, need: need, complete: need > 0 && done >= need };
  }

  function whoInSummary(summary) {
    var s = String(summary || "");
    var out = [];
    if (/\bAinsley\b/i.test(s)) out.push("ainsley");
    if (/\bHayes\b/i.test(s)) out.push("hayes");
    if (/\bHarris\b/i.test(s)) out.push("harris");
    /* Boys / shared SRE-style titles → both boys when neither named alone */
    var boys = /\bBoys\b/i.test(s) || /\bboth\s+boys\b/i.test(s);
    /* SRE (Sunset Ridge Elementary) drop / pickup with no kid named = the boys' school run */
    if (!out.length && /\bSRE\b|Sunset\s+Ridge/i.test(s) && /\bdrop\b|drop-?off|pick\s*-?up/i.test(s)) boys = true;
    if (boys) {
      if (out.indexOf("hayes") < 0) out.push("hayes");
      if (out.indexOf("harris") < 0) out.push("harris");
    }
    return out;
  }

  /* WHOSUP2 · prep / reminder items (pack snacks, get/buy X, reminders) are not leaves.
     Strip leading "Hayes — " / "Hayes + Harris · " then test the action verb. */
  var PREP_VERB_RE = /^(pack|packing|prep|get|buy|grab|bring|order|remind|reminder|charge|sign|print|refill|restock|label|lay\s+out)\b/i;
  function isPrepItem(item) {
    if (!item) return false;
    if (item.kind === "prep" || item.kind === "reminder") return true;
    var raw = String(item.summary || item.place || item.what || item.title || "").trim();
    if (!raw || /^Leave\b/i.test(raw)) return false;
    var act = raw.replace(/^(?:(?:Ainsley|Hayes|Harris|Boys|Kids|Dan|Dad)\s*(?:\+|&|,|and)?\s*)+[—–\-:·]\s*/i, "");
    if (PREP_VERB_RE.test(act)) return true;
    if (/^reminder\b|\breminder\s*[·:]/i.test(raw)) return true;
    if (/\bsnacks?\b/i.test(act) && !/\b(drop|pick\s*-?up|practice|game|swim|class)\b/i.test(act)) return true;
    return false;
  }

  /* QARELAY1 · RIDES law on kid NEXT UP: Dad logistics (kind leave/ride, "Pick up …" / "Drop …")
     are Dad-seat items, never a kid's next thing. */
  function isDadLogistics(item) {
    if (!item) return false;
    if (item.kind === "leave" || item.kind === "ride") return true;
    var raw = String(item.summary || item.place || item.what || item.title || "").trim();
    return /^(Pick\s*-?\s*up|Drop)\b/i.test(raw);
  }

  function shortTitle(summary) {
    var s = kidsSafe(String(summary || "").trim());
    s = s.replace(/^Leave\s*[·•\-–—]\s*/i, "");
    s = s.replace(/\(\s*Mom[^)]*\)/gi, "");
    s = s.replace(/\s{2,}/g, " ").trim();
    /* CLIP1: a long title is cut at a whole word, never mid-word and never with an ellipsis; an open bracket left alone is dropped */
    if (s.length > 48) { s = s.slice(0, 47).replace(/\s+\S*$/, ""); if (s.lastIndexOf("(") > s.lastIndexOf(")")) s = s.slice(0, s.lastIndexOf("(")); s = s.replace(/[\s·,;:(\-]+$/, ""); }
    return s;
  }

  /** Clean CT wall time · "8:10 AM" (HUBFMT1). */
  function clockFromIso(iso) {
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

  /** Prefer ISO→CT; if bare "8:10" only, keep it (no invent AM/PM without ISO). */
  function cleanWallTime(time, iso) {
    var fromIso = clockFromIso(iso);
    if (fromIso) return fromIso;
    var s = String(time || "").trim();
    if (!s) return "";
    /* Already has AM/PM */
    if (/[ap]\.?m\.?/i.test(s)) return s.replace(/\s+/g, " ");
    /* Reject ISO / 24h junk on glass */
    if (/T\d{2}:|\d{4}-\d{2}-\d{2}/.test(s)) return clockFromIso(s) || "";
    return s;
  }

  function minsUntilIso(iso) {
    var t = Date.parse(iso || "");
    if (!Number.isFinite(t)) return null;
    return Math.round((t - Date.now()) / 60000);
  }

  function fmtLeave(mins) {
    if (mins == null) return "NEXT";
    if (mins <= 5) return "LEAVE · NOW";
    if (mins <= 45) return "LEAVE · " + mins + "m";
    if (mins <= 120) return "LEAVE · " + Math.round(mins / 5) * 5 + "m";
    return "UPCOMING";
  }

  /** Active leave window: within 45m before start through event end. Not tomorrow's next. */
  var LEAVE_PRE_MS = 45 * 60 * 1000;

  function inLeaveWindow(leave) {
    if (!leave || leave.source === "hottest") return false;
    var start = leave.start || Date.parse(leave.startIso || "") || 0;
    if (!start) return false;
    var end = Date.parse(leave.endIso || "") || 0;
    if (!end) end = start + 90 * 60 * 1000;
    var now = Date.now();
    return now >= (start - LEAVE_PRE_MS) && now <= end;
  }

  function sameLeave(a, b) {
    if (!a || !b) return false;
    if (a.startIso && b.startIso && a.startIso === b.startIso) return true;
    if (a.start && b.start && a.start === b.start && a.title === b.title) return true;
    return false;
  }

  function formatWhoNames(kidIds) {
    var names = [];
    (kidIds || []).forEach(function (id) {
      if (ACCENT[id] && ACCENT[id].name) names.push(ACCENT[id].name);
    });
    if (names.length === 2 && names.indexOf("Hayes") >= 0 && names.indexOf("Harris") >= 0) {
      return "Hayes + Harris";
    }
    if (names.length <= 1) return names[0] || "";
    if (names.length === 2) return names[0] + " + " + names[1];
    return names.slice(0, -1).join(", ") + " + " + names[names.length - 1];
  }

  /** Next leave/event for a kid from embedded boardStrip.queue or kid hottest. */
  function nextLeaveFor(kidId, opts) {
    var wantPrep = !!(opts && opts.prepOnly);
    var d = data();
    var name = ACCENT[kidId] && ACCENT[kidId].name;
    var now = Date.now();
    var best = null;

    function consider(item) {
      if (!item) return;
      if (isDadLogistics(item)) return;
      if (isPrepItem(item) !== wantPrep) return;
      var start = Date.parse(item.startIso || item.start || "") || 0;
      var end = Date.parse(item.endIso || item.end || "") || 0;
      if (end && end < now) return;
      if (!end && start && start + 90 * 60 * 1000 < now) return;
      if (start && best && best.start && start >= best.start) return;
      if (start && best && !best.start) { /* prefer timed */ }
      else if (best && best.start && !start) return;
      best = {
        start: start || 0,
        startIso: item.startIso || item.start || "",
        endIso: item.endIso || item.end || "",
        time: cleanWallTime(item.time, item.startIso || item.start),
        badge: item.badge || "",
        title: shortTitle(item.place || item.summary || item.what || item.title || "Next up"),
        summary: shortTitle(item.summary || item.hint || ""),
        who: whoInSummary((item.summary || "") + " " + (item.place || "")),
        prep: wantPrep
      };
    }

    var queue = (d && d.boardStrip && d.boardStrip.queue) || [];
    for (var i = 0; i < queue.length; i++) {
      var it = queue[i];
      var who = whoInSummary(it.summary || it.place || "");
      if (who.indexOf(kidId) >= 0 || (name && new RegExp("\\b" + name + "\\b", "i").test(it.summary || it.place || ""))) {
        consider(it);
      }
    }

    /* cal-live cache if board strip already painted it onto window */
    try {
      var calQ = global.__wardosCalLeaves;
      if (Array.isArray(calQ)) {
        for (var c = 0; c < calQ.length; c++) {
          var ev = calQ[c];
          var wh2 = whoInSummary(ev.summary || "");
          if (wh2.indexOf(kidId) < 0) continue;
          consider({
            startIso: ev.start,
            endIso: ev.end,
            summary: ev.summary,
            place: ev.summary,
            time: cleanWallTime("", ev.start)
          });
        }
      }
    } catch (e) { /* */ }

    if (!best && !wantPrep) {
      var kid = kidObj(kidId);
      if (kid && kid.hottest) {
        return {
          start: 0,
          startIso: "",
          time: String(kid.hottest.when || "").split("·").pop().trim(),
          badge: String(kid.hottest.when || "").split("·")[0].trim(),
          title: shortTitle(kid.hottest.what || "Next up"),
          summary: shortTitle(kid.hottest.where || ""),
          source: "hottest"
        };
      }
    }
    return best;
  }

  /* WHOSUP2 · a prep item that is live now (e.g. 7:30 "Hayes — pack snacks") lights the
     REAL leave it feeds (8:10 boys SRE drop) when that leave starts within PREP_BRIDGE_MS. */
  var PREP_BRIDGE_MS = 2 * 60 * 60 * 1000;
  function prepBridges(kidId, leave) {
    if (!leave || !leave.start) return false;
    var prep = nextLeaveFor(kidId, { prepOnly: true });
    if (!prep || !prep.start || !inLeaveWindow(prep)) return false;
    return prep.start <= leave.start && (leave.start - prep.start) <= PREP_BRIDGE_MS;
  }

  function soonestWhoUp() {
    /* Only light when someone is IN an active leave window — quiet otherwise.
       Prep/reminder items never win; shared events (Hayes + Harris SRE) name ALL kids on that leave. */
    /* WHOSUP3 · UPCOMING beats UNDERWAY: once a leave's time has passed (swim 4:25 in progress)
       and a later leave's window is open (flag 5:40), the upcoming one owns Who's up.
       Upcoming → soonest first. All underway → most recent departure first. */
    var best = null;
    var now = Date.now();
    function rank(leave) {
      var st = leave.start || 0;
      if (!st) return [2, 0];
      return st > now ? [0, st] : [1, -st];
    }
    function better(ra, rb) {
      return ra[0] !== rb[0] ? ra[0] < rb[0] : ra[1] < rb[1];
    }
    for (var i = 0; i < KIDS.length; i++) {
      var id = KIDS[i];
      var leave = nextLeaveFor(id);
      if (!leave) continue;
      if (!inLeaveWindow(leave) && !prepBridges(id, leave)) continue;
      var r = rank(leave);
      if (!best || better(r, best.rank)) {
        best = { kidId: id, kidIds: [id], leave: leave, rank: r, score: leave.start || Number.MAX_SAFE_INTEGER };
      } else if (sameLeave(best.leave, leave)) {
        if (best.kidIds.indexOf(id) < 0) best.kidIds.push(id);
      }
    }
    if (best) {
      /* Everyone the chosen leave names (title parse) + anyone whose own next leave is it */
      var named = (best.leave && best.leave.who) || [];
      var ids = [];
      for (var k = 0; k < KIDS.length; k++) {
        var kid = KIDS[k];
        if (best.kidIds.indexOf(kid) >= 0 || named.indexOf(kid) >= 0) ids.push(kid);
        else if (sameLeave(best.leave, nextLeaveFor(kid))) ids.push(kid);
      }
      best.kidIds = ids;
      best.kidId = ids[0] || best.kidId;
    }
    return best;
  }

  function faceIndex(face, kidId) {
    var i = facesFor(kidId).indexOf(face);
    return i < 0 ? 0 : i;
  }

  /* AUDIT1 · kicker says TODAY only when the hottest item is today; TOMORROW / NEXT otherwise */
  function ctDowShort(ms) {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short" })
        .format(new Date(ms)).toUpperCase().slice(0, 3);
    } catch (e) { return ""; }
  }
  function dayKicker(hot) {
    var d = String((hot && hot.badges && hot.badges[0]) || (hot && hot.when) || "").split("·")[0].trim().toUpperCase().slice(0, 3);
    if (!/^(SUN|MON|TUE|WED|THU|FRI|SAT)$/.test(d)) return "Today";
    var now = Date.now();
    if (d === ctDowShort(now)) return "Today";
    if (d === ctDowShort(now + 864e5)) return "Tomorrow";
    return "Next";
  }

  function paintFace(kidId, face) {
    var kid = kidObj(kidId) || { name: ACCENT[kidId].name };
    var accent = ACCENT[kidId];
    var html = "";

    if (face === "stars" && SEAT_ONLY[kidId]) face = "day"; /* CHORELAW1: no stars on a seat */
    if (face === "day") {
      var hot = kid.hottest || {};
      var todayBits = (kid.today || []).slice(0, 2);
      html += '<div class="kf-face kf-day">';
      html += '<div class="kf-kicker">' + esc(dayKicker(hot)) + "</div>";
      html += '<div class="kf-loud">' + esc(hot.when || "Dad week") + "</div>";
      html += '<div class="kf-title">' + esc(shortTitle(hot.what || "On deck")) + "</div>";
      if (todayBits.length) {
        html += '<div class="kf-rows">';
        todayBits.forEach(function (row) {
          html += '<div class="kf-row"><span class="kf-mt">' + esc(row.when || "") +
            '</span><span class="kf-md">' + esc(shortTitle(row.what || "")) + "</span></div>";
        });
        html += "</div>";
      }
      html += "</div>";
      return html;
    }

    if (face === "stars") {
      var bank = bankView(kidId);
      var gate = mustProgress(kidId);
      var streak = streakDays(kidId);
      var sym = (bank && bank.currency && bank.currency.symbol) || "★";
      var week = bank ? bank.week : 0;
      var need = bank ? bank.need : 0;
      var pct = bank ? bank.pct : 0;
      var locked = bank && !bank.mustComplete;
      html += '<div class="kf-face kf-stars">';
      html += '<div class="kf-kicker">Stars</div>';
      html += '<div class="kf-loud">' + esc(sym) + " " + esc(String(week)) +
        (need ? (" / " + esc(String(need))) : "") + "</div>";
      html += '<div class="kf-xp" aria-label="Must progress">';
      html += '<div class="kf-xp-fill" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></div>';
      html += "</div>";
      html += '<div class="kf-meta">' +
        (function () { var lc = lawCount(kidId); return lc.need ? (lc.done < lc.need ? ("Musts " + lc.done + "/" + lc.need) : "Musts clear") : ""; })() +
        "</div>"; /* CHORELAW2: Musts from the chore law (4), not the old quest gate */
      var run = lawRun(kidId);
      if (!SEAT_ONLY[kidId] && run) html += '<div class="kf-streak" data-run>' + esc(run) + "</div>"; /* Atlas's run wording; none on a seat */
      html += "</div>";
      return html;
    }

    if (face === "chores") {
      /* CHORELAW2: the chore law's 4 MUSTS + the CHOICE claim from data/kid-seats.json. No quest chart here. */
      var w = HW(), lm = lawMusts(kidId), now = Date.now();
      html += '<div class="kf-face kf-chores">';
      html += '<div class="kf-kicker">Chores' + (SEAT_ONLY[kidId] || !lm ? "" : ' <span class="kf-chip">' +
        lm.done + "/" + lm.items.length + "</span>") + "</div>"; /* no count on a seat */
      html += '<div class="kf-claim-list" role="list">';
      function lawBtn(attr, id, word, on) {
        return '<button type="button" class="kf-claim' + (on ? " is-done" : "") + '" ' + attr + '="' + esc(kidId) + '"' + (id ? ' data-law-id="' + esc(id) + '"' : "") +
          ' data-kid="' + esc(kidId) + '" aria-pressed="' + (on ? "true" : "false") + '"><span class="kf-claim-ring">' + (on ? "✓" : "·") + "</span>" +
          '<span class="kf-claim-what">' + esc(word) + "</span></button>";
      }
      if (lm && lm.items.length) {
        lm.items.forEach(function (m) { html += lawBtn("data-law-must", m.id, m.word, m.closed); });
        var c = w.choice(LAW, lawStore, kidId, now);
        if (c && c.open) html += lawBtn("data-law-claim", "", c.job.word, false);
        else if (c && c.mine) html += lawBtn("data-law-choice-done", "", c.job.word, c.done);
      } else html += '<div class="kf-empty">No musts on board</div>';
      html += "</div></div>";
      return html;
    }

    /* leave */
    var leave = nextLeaveFor(kidId);
    html += '<div class="kf-face kf-leave">';
    html += '<div class="kf-kicker">Next leave</div>';
    if (!leave) {
      html += '<div class="kf-loud">Clear</div><div class="kf-title">Nothing queued</div>';
    } else {
      var mins = minsUntilIso(leave.startIso);
      html += '<div class="kf-loud">' + esc(leave.time || leave.badge || "—") + "</div>";
      html += '<div class="kf-title">' + esc(leave.title) + "</div>";
      html += '<div class="kf-chip kf-chip--hot">' + esc(fmtLeave(mins)) + "</div>";
      if (leave.summary && leave.summary !== leave.title) {
        html += '<div class="kf-meta">' + esc(leave.summary) + "</div>";
      }
    }
    html += "</div>";
    return html;
  }

  function paintTile(root) {
    var kidId = root.getAttribute("data-kid-flip");
    if (KIDS.indexOf(kidId) < 0) return;
    var face = root.getAttribute("data-face") || "day";
    if (facesFor(kidId).indexOf(face) < 0) face = "day";
    var stage = root.querySelector("[data-kf-stage]");
    var dots = root.querySelector("[data-kf-dots]");
    var streakEl = root.querySelector("[data-kf-streak]");
    var sub = root.querySelector("[data-kf-sub]");
    if (stage) stage.innerHTML = paintFace(kidId, face);
    if (dots) {
      dots.innerHTML = facesFor(kidId).map(function (f) {
        return '<i class="' + (f === face ? "is-on" : "") + '" data-face-dot="' + f + '"></i>';
      }).join("");
    }
    if (streakEl) {
      streakEl.hidden = !!SEAT_ONLY[kidId]; /* CHORELAW1: no Musts n/n on a seat */
      var lc = lawCount(kidId), lr = lawRun(kidId); /* CHORELAW2: the law's 4 MUSTS + Atlas's run, not the quest chart */
      streakEl.textContent = SEAT_ONLY[kidId] || !lc.need ? "" : ((lr ? lr + " · " : "") + "Musts " + lc.done + "/" + lc.need);
    }
    if (sub) {
      var leave = nextLeaveFor(kidId);
      if (face === "day" && leave) sub.textContent = (leave.time || "") + " · " + leave.title;
      else if (kidObj(kidId) && kidObj(kidId).themeLabel) sub.textContent = kidObj(kidId).themeLabel;
    }
    root.setAttribute("data-face", face);
    root.setAttribute("aria-label", (ACCENT[kidId].name) + " · " + (FACE_LABEL[face] || face) + " · tap OPEN · swipe to flip");
  }

  function setFace(root, face, playSound) {
    if (facesFor(root.getAttribute("data-kid-flip")).indexOf(face) < 0) return;
    var prev = root.getAttribute("data-face");
    root.setAttribute("data-face", face);
    paintTile(root);
    if (playSound && face !== prev) sfxFlip();
    root.classList.remove("kf-bump");
    void root.offsetWidth;
    root.classList.add("kf-bump");
  }

  function cycleFace(root, dir) {
    var face = root.getAttribute("data-face") || "day";
    var fs = facesFor(root.getAttribute("data-kid-flip"));
    var i = faceIndex(face, root.getAttribute("data-kid-flip"));
    var next = fs[(i + dir + fs.length) % fs.length];
    setFace(root, next, true);
  }

  var __kfNavLock = 0;
  function openKidBoard(root, ev) {
    var kidId = root && root.getAttribute("data-kid-flip");
    var go = root && root.querySelector(".kid-flip-go");
    var href = (go && go.getAttribute("href")) || (kidId && HREF[kidId]) || "";
    if (!href || href === "#") return false;
    var now = Date.now();
    if (now - __kfNavLock < 600) {
      if (ev) {
        try { ev.preventDefault(); } catch (eL) { /* */ }
        try { ev.stopPropagation(); } catch (eL2) { /* */ }
      }
      return true;
    }
    __kfNavLock = now;
    if (ev) {
      try { ev.preventDefault(); } catch (e0) { /* */ }
      try { ev.stopPropagation(); } catch (e1) { /* */ }
    }
    sfxTap();
    try { global.location.assign(href); } catch (e) {
      try { global.location.href = href; } catch (e2) { /* */ }
    }
    return true;
  }

  function bindSwipe(root) {
    if (root.getAttribute("data-kf-swipe") === "1") return;
    root.setAttribute("data-kf-swipe", "1");
    var sx = 0, sy = 0, armed = false, moved = false, scrolled = false;
    root.addEventListener("pointerdown", function (ev) {
      if (ev.target && ev.target.closest && (
        ev.target.closest(".kf-claim") ||
        ev.target.closest(".kid-flip-go") ||
        ev.target.closest("[data-face-dot]") ||
        ev.target.closest(".hub-quest-claim")
      )) return;
      armed = true;
      moved = false;
      scrolled = false;
      sx = ev.clientX;
      sy = ev.clientY;
      /* Do not setPointerCapture — it steals pan-y scroll on kf-stage and kills OPEN clicks on wall */
    });
    root.addEventListener("pointermove", function (ev) {
      if (!armed) return;
      var dx = ev.clientX - sx;
      var dy = ev.clientY - sy;
      if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.2) moved = true;
      if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) {
        moved = true;
        scrolled = true; /* vertical scroll on stage — not a tap-open */
      }
    });
    function end(ev) {
      if (!armed) return;
      armed = false;
      var dx = (ev.clientX || 0) - sx;
      var dy = (ev.clientY || 0) - sy;
      /* Horizontal swipe flips faces — keep claims/dots/OPEN alone */
      if (moved && !scrolled && Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy)) {
        ev.preventDefault();
        cycleFace(root, dx < 0 ? 1 : -1);
        return;
      }
      /* Tap (no meaningful drag) → open kid board (Ainsley/Hayes/Harris) */
      if (!moved && !scrolled && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        var t = ev.target;
        if (t && t.closest && (
          t.closest(".kf-claim") ||
          t.closest(".kid-flip-go") ||
          t.closest("[data-face-dot]")
        )) return;
        openKidBoard(root, ev);
      }
    }
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", function () { armed = false; });
  }

  function bindClaims(root) {
    if (root.getAttribute("data-kf-claims") === "1") return;
    root.setAttribute("data-kf-claims", "1");
    root.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest(".kf-claim");
      if (!btn || !root.contains(btn)) return;
      ev.preventDefault();
      ev.stopPropagation();
      var lawAttr = ["data-law-must", "data-law-claim", "data-law-choice-done"].filter(function (a) { return btn.hasAttribute(a); })[0];
      if (lawAttr) { /* CHORELAW2: same keys as the wall (house-checkoffs:<kid>:<day>, law ids) */
        var hw = HW(), lk = btn.getAttribute(lawAttr), tnow = Date.now(), res = null;
        if (hw && LAW) {
          if (lawAttr === "data-law-must") res = hw.tapMust(lawStore, LAW, lk, btn.getAttribute("data-law-id"), tnow);
          else if (lawAttr === "data-law-claim") res = hw.claimChoice(lawStore, LAW, lk, tnow);
          else res = hw.choiceDone(lawStore, LAW, lk, tnow);
        }
        if (res && res.ok) sfxQuest(btn); else sfxTap();
        paintTile(root);
        return;
      }
      var id = btn.getAttribute("data-claim");
      var cadence = btn.getAttribute("data-cadence") || "daily";
      var kidId = btn.getAttribute("data-kid") || root.getAttribute("data-kid-flip");
      if (!id) return;
      var iso = cadence === "daily" ? dayIso() : undefined;
      id = Q(kidId, id);
      var was = getCheck(id, iso);
      var next = !was;
      setCheck(id, next, iso);
      if (next) {
        sfxQuest(btn);
        try {
          if (global.HouseSfx && typeof HouseSfx.floatPopup === "function") {
            HouseSfx.floatPopup(btn, "CLAIMED");
          }
          if (global.HouseSfx && typeof HouseSfx.streakSparks === "function") {
            HouseSfx.streakSparks(root);
          }
        } catch (e) { /* */ }
      } else {
        sfxTap();
      }
      paintTile(root);
      paintWhoUp();
      paintDailyQuest();
      paintBoardStreak(kidId);
      try { document.dispatchEvent(new CustomEvent("house:earn", { detail: { id: id, done: next } })); } catch (e2) { /* */ }
    });
  }

  function bindDots(root) {
    if (root.getAttribute("data-kf-dotbind") === "1") return;
    root.setAttribute("data-kf-dotbind", "1");
    root.addEventListener("click", function (ev) {
      var dot = ev.target && ev.target.closest && ev.target.closest("[data-face-dot]");
      if (!dot || !root.contains(dot)) return;
      ev.preventDefault();
      ev.stopPropagation();
      setFace(root, dot.getAttribute("data-face-dot"), true);
    });
  }

  function bindOpen(root) {
    if (root.getAttribute("data-kf-open") === "1") return;
    root.setAttribute("data-kf-open", "1");
    var go = root.querySelector(".kid-flip-go");
    if (!go) {
      /* Allow retry after paint injects OPEN */
      root.removeAttribute("data-kf-open");
      return;
    }
    function goNav(ev) {
      openKidBoard(root, ev);
    }
    go.addEventListener("pointerdown", function () { sfxTap(); }, { passive: true });
    /* pointerup + click — wall WebViews sometimes drop one or the other after tile replace */
    go.addEventListener("pointerup", function (ev) {
      if (ev.button != null && ev.button !== 0) return;
      goNav(ev);
    });
    go.addEventListener("click", goNav);
  }

  function enhanceTile(anchor) {
    var kidId = null;
    if (anchor.classList.contains("ainsley")) kidId = "ainsley";
    else if (anchor.classList.contains("hayes")) kidId = "hayes";
    else if (anchor.classList.contains("harris")) kidId = "harris";
    if (!kidId) return null;
    if (anchor.getAttribute("data-kid-flip")) {
      paintTile(anchor);
      return anchor;
    }

    var href = anchor.getAttribute("href") || HREF[kidId];
    var label = (ACCENT[kidId] && ACCENT[kidId].name) || kidId;
    var iconHTML = "";
    var icon = anchor.querySelector(".tile-icon");
    if (icon) iconHTML = icon.outerHTML;

    var wrap = document.createElement("div");
    wrap.className = anchor.className + " kid-flip";
    wrap.setAttribute("data-kid-flip", kidId);
    wrap.setAttribute("data-face", "day");
    wrap.setAttribute("role", "group");
    wrap.tabIndex = 0;

    wrap.innerHTML =
      '<div class="tile-top">' +
      iconHTML +
      '<div class="tile-titles">' +
      '<div class="tile-label">' + esc(label) + "</div>" +
      '<div class="tile-sub" data-kf-sub>Live board</div>' +
      "</div>" +
      '<div class="kf-dots" data-kf-dots aria-hidden="true"></div>' +
      "</div>" +
      '<div class="kf-stage" data-kf-stage></div>' +
      '<div class="tile-foot">' +
      (SEAT_ONLY[kidId]
        ? '<span class="tile-fact" data-kf-trusted hidden></span>' /* CHORELAW1 slot: Atlas's trusted-with line (data next round) */
        : '<span class="tile-fact kf-streak-chip" data-kf-streak>Musts</span>') +
      '<a class="tile-tap kid-flip-go" href="' + esc(href) + '">OPEN</a>' +
      "</div>";

    anchor.parentNode.replaceChild(wrap, anchor);
    paintTile(wrap);
    bindSwipe(wrap);
    bindClaims(wrap);
    bindDots(wrap);
    bindOpen(wrap);
    wrap.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowRight") { ev.preventDefault(); cycleFace(wrap, 1); }
      if (ev.key === "ArrowLeft") { ev.preventDefault(); cycleFace(wrap, -1); }
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openKidBoard(wrap, ev);
      }
    });
    return wrap;
  }

  function ensureWhoUpHost() {
    var existing = document.querySelector("[data-who-up]");
    if (existing) return existing;
    var grid = document.querySelector(".grid-wrap");
    if (!grid || !grid.parentNode) return null;
    var sec = document.createElement("section");
    sec.className = "who-up";
    sec.setAttribute("data-who-up", "1");
    sec.setAttribute("aria-label", "Who's up next");
    sec.innerHTML =
      '<div class="who-up-accent" aria-hidden="true"></div>' +
      '<div class="who-up-body">' +
      '<div class="who-up-kicker">Who\'s up</div>' +
      '<div class="who-up-main" data-who-main>…</div>' +
      '<div class="who-up-meta" data-who-meta></div>' +
      '</div>' +
      '<a class="who-up-go" data-who-go href="sheet-today.html">OPEN</a>';
    grid.parentNode.insertBefore(sec, grid);
    return sec;
  }

  function pickQuestKid() {
    var who = soonestWhoUp();
    if (who && who.kidId) return who.kidId;
    for (var i = 0; i < KIDS.length; i++) {
      var tp = todayMustProgress(KIDS[i]);
      if (tp.need && tp.done < tp.need) return KIDS[i];
    }
    return KIDS[0];
  }

  /** Main hub face (sheet-index roster) — quest belongs on kid boards only. */
  function isMainHubFace() {
    return !!document.querySelector(".tile-grid--cams, .tile-grid[aria-label*=\"sheet index\"]");
  }

  function ensureQuestHost() {
    var existing = document.querySelector("[data-hub-quest]");
    /* HUBQUESTOFF · never paint / keep daily quest on main hub board */
    if (isMainHubFace() || (document.body && !document.body.getAttribute("data-kid") && document.querySelector("[data-who-up]"))) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return null;
    }
    if (existing) return existing;
    /* Kid boards already own musts/quests — do not inject a hub-quest strip elsewhere. */
    return null;
  }

  function paintDailyQuest() {
    var host = ensureQuestHost();
    if (!host) return;
    var kidId = pickQuestKid();
    var accent = ACCENT[kidId] || ACCENT.hayes;
    var tp = todayMustProgress(kidId);
    var streak = streakDays(kidId);
    var qs = mustQuests(kidId).filter(function (q) {
      return (q.cadence || "daily") === "daily";
    }).slice(0, 4);
    host.setAttribute("data-kid", kidId);
    host.classList.toggle("is-empty", !tp.need);
    var title = host.querySelector("[data-hq-title]");
    var musts = host.querySelector("[data-hq-musts]");
    var streakEl = host.querySelector("[data-hq-streak]");
    var claims = host.querySelector("[data-hq-claims]");
    var go = host.querySelector("[data-hq-go]");
    if (title) title.textContent = accent.name + " · musts";
    if (musts) { musts.hidden = !!SEAT_ONLY[kidId]; musts.textContent = SEAT_ONLY[kidId] ? "" : (tp.need ? (tp.done + "/" + tp.need) : "—"); } /* CHORELAW1 */
    if (streakEl) {
      streakEl.hidden = !!SEAT_ONLY[kidId]; /* WALLKIT9: a seat shows no streak line */
      streakEl.textContent = SEAT_ONLY[kidId] ? "" : (streak > 0 ? ("Week " + streak) : "Week · tap musts"); /* KIDPATH2 */
    }
    if (go) {
      go.setAttribute("href", HREF[kidId]);
      go.textContent = "CLAIM · " + accent.name.toUpperCase();
      if (go.getAttribute("data-sfx") !== "1") {
        go.setAttribute("data-sfx", "1");
        go.addEventListener("pointerdown", function () { sfxTap(); }, { passive: true });
      }
    }
    if (claims) {
      if (!qs.length) {
        claims.innerHTML = '<span class="hub-quest-streak">No daily musts queued</span>';
      } else {
        var html = "";
        qs.forEach(function (q) {
          var done = getCheck(Q(kidId, q.id));
          html +=
            '<button type="button" class="hub-quest-claim' + (done ? " is-done" : "") + '" data-hq-claim="' + esc(Q(kidId, q.id)) + '">' +
            '<span class="kf-claim-ring">' + (done ? "✓" : "○") + "</span>" +
            "<span>" + esc(kidsSafe(q.title || q.what || q.id)) + "</span></button>";
        });
        claims.innerHTML = html;
        if (claims.getAttribute("data-bound") !== "1") {
          claims.setAttribute("data-bound", "1");
          claims.addEventListener("click", function (ev) {
            var btn = ev.target && ev.target.closest ? ev.target.closest("[data-hq-claim]") : null;
            if (!btn) return;
            var id = btn.getAttribute("data-hq-claim");
            if (!id) return;
            var next = !getCheck(id);
            setCheck(id, next);
            sfxQuest(btn);
            try { if (next && global.HouseSfx && HouseSfx.questPop) HouseSfx.questPop(btn); } catch (e) {}
            paintDailyQuest();
            refreshAll();
            try { document.dispatchEvent(new CustomEvent("house:earn", { detail: { id: id, done: next } })); } catch (e2) {}
          });
        }
      }
    }
  }

  /* AUDIT1 · whole Who's Up card taps through to Today (its OPEN link is hidden) */
  function bindWhoUpTap(host) {
    if (!host || host.getAttribute("data-tap-bound") === "1") return;
    host.setAttribute("data-tap-bound", "1");
    host.setAttribute("role", "link");
    host.setAttribute("tabindex", "0");
    host.style.cursor = "pointer";
    function go() {
      var a = host.querySelector("[data-who-go]");
      var href = (a && a.getAttribute("href")) || "sheet-today.html";
      try { sfxTap(); } catch (e) { /* ok */ }
      global.location.href = href;
    }
    host.addEventListener("click", function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest("a[href]")) return;
      go();
    });
    host.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); }
    });
  }

  function paintWhoUp() {
    var host = ensureWhoUpHost();
    if (!host) return;
    bindWhoUpTap(host);
    var pick = soonestWhoUp();
    var main = host.querySelector("[data-who-main]");
    var meta = host.querySelector("[data-who-meta]");
    var go = host.querySelector("[data-who-go]");
    if (!pick) {
      host.setAttribute("data-kid", "");
      host.removeAttribute("data-kids");
      host.classList.add("is-quiet");
      if (main) main.innerHTML = '<span class="who-up-name">Quiet</span><span class="who-up-what">No leave window</span>';
      if (meta) meta.textContent = "LIVE cal";
      if (go) { go.setAttribute("href", "sheet-today.html"); go.hidden = true; }
      return;
    }
    var kidIds = (pick.kidIds && pick.kidIds.length) ? pick.kidIds.slice() : [pick.kidId];
    var id = kidIds[0];
    var leave = pick.leave;
    var mins = minsUntilIso(leave.startIso);
    var label = formatWhoNames(kidIds);
    host.classList.remove("is-quiet");
    host.setAttribute("data-kid", kidIds.length === 1 ? id : kidIds.join(" "));
    host.setAttribute("data-kids", kidIds.join(","));
    if (main) {
      main.innerHTML =
        '<span class="who-up-name">' + esc(label) + "</span>" +
        '<span class="who-up-time">' + esc(leave.time || leave.badge || "") + "</span>" +
        '<span class="who-up-what">' + esc(leave.title) + "</span>";
    }
    if (meta) meta.textContent = fmtLeave(mins) + " · LIVE";
    if (go) {
      go.hidden = false;
      go.setAttribute("href", HREF[id]);
      if (kidIds.length === 2 && kidIds.indexOf("hayes") >= 0 && kidIds.indexOf("harris") >= 0) {
        go.textContent = "OPEN · BOYS";
      } else if (kidIds.length > 1) {
        go.textContent = "OPEN";
      } else {
        go.textContent = "OPEN · " + ACCENT[id].name.toUpperCase();
      }
    }
  }

  function paintBoardStreak(kidId) {
    var bodyKid = document.body && document.body.getAttribute("data-kid");
    if (!bodyKid) return;
    if (kidId && kidId !== bodyKid) return;
    kidId = bodyKid;
    var streak = streakDays(kidId);
    var tp = todayMustProgress(kidId);
    var gate = mustProgress(kidId);
    var label = document.querySelector("[data-streak-label]");
    if (label && SEAT_ONLY[kidId]) { label.textContent = ""; label.hidden = true; } /* CHORELAW1: no streak, no Today n/n on a seat */
    else if (label) {
      label.classList.add("streak-sparks");
      label.setAttribute("data-streak", "1");
      label.textContent = streak > 0
        ? ("Week " + streak + " · today " + tp.done + "/" + tp.need)
        : ("Week · today " + tp.done + "/" + tp.need); /* KIDPATH2 */
    }
    var glass = document.querySelector("[data-xp-glass]");
    if (SEAT_ONLY[kidId]) { if (glass && glass.parentNode) glass.parentNode.removeChild(glass); return; } /* CHORELAW1: no Musts today n/n */
    if (!glass) {
      var hdr = document.querySelector(".sec-chores .sec-hdr");
      if (hdr) {
        glass = document.createElement("div");
        glass.className = "xp-glass";
        glass.setAttribute("data-xp-glass", "1");
        hdr.appendChild(glass);
      }
    }
    if (glass) {
      var pct = tp.need ? Math.round((tp.done / tp.need) * 100) : 0;
      glass.innerHTML =
        '<div class="xp-glass-lab">Musts today</div>' +
        '<div class="xp-glass-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="xp-glass-meta">' + tp.done + "/" + tp.need +
        "</div>"; /* KIDPATH1: no jar wording */
    }
  }

  function prefetchCalLeaves(cb) {
    var urls = ["data/cal-live.json?v=" + Date.now(), "data/cal-live.json"];
    var i = 0;
    function next() {
      if (i >= urls.length) { if (cb) cb(null); return; }
      var url = urls[i++];
      fetch(url, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("bad");
        return r.json();
      }).then(function (cal) {
        if (cal && Array.isArray(cal.upcomingLeaves)) {
          /* SOFTGONE1 · no Who's up / leave for TBD, canceled, done, backup */
          global.__wardosCalLeaves = cal.upcomingLeaves.filter(function (e) {
            return !(e && /(^\s*[\[(]?\s*(cancel+ed|cxl|done|backup|tentative)\b)|\btbd\b|\bcancel if\b/i.test(String(e.summary || "")));
          });
        }
        if (cb) cb(cal);
      }).catch(function () { next(); });
    }
    next();
  }

  function enhanceHub() {
    if (!document.querySelector(".tile.ainsley, .tile.hayes, .tile.harris, [data-kid-flip]")) return;
    document.querySelectorAll("a.tile.ainsley, a.tile.hayes, a.tile.harris").forEach(enhanceTile);
    /* Bind-once guards inside bind* — safe to call; paint every time */
    document.querySelectorAll("[data-kid-flip]").forEach(function (el) {
      bindSwipe(el);
      bindClaims(el);
      bindDots(el);
      bindOpen(el);
      paintTile(el);
    });
    paintWhoUp();
    paintDailyQuest();
    var go = document.querySelector("[data-who-go]");
    if (go && go.getAttribute("data-sfx") !== "1") {
      go.setAttribute("data-sfx", "1");
      go.addEventListener("pointerdown", function () { sfxTap(); }, { passive: true });
      go.addEventListener("click", function (ev) {
        var href = go.getAttribute("href");
        if (!href || href === "#" || go.hidden) return;
        ev.preventDefault();
        ev.stopPropagation();
        try { global.location.assign(href); } catch (e) {
          try { global.location.href = href; } catch (e2) { /* */ }
        }
      });
    }
  }

  function enhanceBoard() {
    var kidId = document.body && document.body.getAttribute("data-kid");
    if (!kidId || KIDS.indexOf(kidId) < 0) return;
    paintBoardStreak(kidId);
  }

  function refreshAll() {
    document.querySelectorAll("[data-kid-flip]").forEach(paintTile);
    paintWhoUp();
    paintDailyQuest();
    enhanceBoard();
  }

  function onDataReady() {
    /* Paint shells now so who’s-up / quest never sit on … waiting on cal */
    enhanceHub();
    enhanceBoard();
    prefetchCalLeaves(function () {
      enhanceHub();
      enhanceBoard();
    });
  }

  function boot() {
    enhanceBoard();
    loadLaw(function () { document.querySelectorAll("[data-kid-flip]").forEach(paintTile); }); /* CHORELAW2 */
    var w = WK();
    if (w && w._data) {
      onDataReady();
    } else if (w && typeof w.loadJSON === "function") {
      w.loadJSON(function (err, d) {
        if (!err && d) {
          try { w._data = d; } catch (e) { /* */ }
        }
        onDataReady();
      });
    } else if (w && typeof w.boot === "function") {
      /* kid pages call boot themselves; hub just waits for event */
      document.addEventListener("house:kids-data-ready", onDataReady, { once: true });
      /* hub: load without kid id */
      w.loadJSON(function (err, d) {
        if (!err && d) {
          try { w._data = d; } catch (e) { /* */ }
          try {
            document.dispatchEvent(new CustomEvent("house:kids-data-ready", { detail: { data: d } }));
          } catch (e2) { /* */ }
        }
        onDataReady();
      });
    } else {
      onDataReady();
    }

    document.addEventListener("house:kids-data-ready", function () {
      refreshAll();
    });
    document.addEventListener("house:kid-rendered", function () {
      enhanceBoard();
    });
    document.addEventListener("house:earn", function () {
      refreshAll();
    });
    document.addEventListener("house:cleared", function () {
      refreshAll();
    });

    /* Re-paint who’s up on the minute so leave countdown stays honest */
    setInterval(function () {
      paintWhoUp();
      paintDailyQuest();
      document.querySelectorAll('[data-kid-flip][data-face="leave"], [data-kid-flip][data-face="stars"]').forEach(paintTile);
      enhanceBoard();
    }, 60 * 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  global.HouseKidEngage = {
    refresh: refreshAll,
    streakDays: streakDays,
    nextLeaveFor: nextLeaveFor,
    soonestWhoUp: soonestWhoUp,
    isPrepItem: isPrepItem,
    inLeaveWindow: inLeaveWindow,
    paintDailyQuest: paintDailyQuest,
    FACES: FACES
  };
})(window);
