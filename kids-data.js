/* House face · kids shared data + bank · kids-safe · localStorage only */
(function (global) {
  "use strict";

  var DAY_ISO = (function () {
    try {
      if (typeof HouseClock !== "undefined" && HouseClock.iso) return HouseClock.iso();
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
    } catch (e) {
      try {
        var d = new Date();
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      } catch (e2) {
        return "1970-01-01";
      }
    }
  })();

  var CHECK_KEY = "house-checkoffs:chores-v2"; /* legacy flat key — migrate-read only */
  var BANK_KEY = "house-bank:v1";
  var CHECK_PREFIX = "house-checkoffs:";

  var KID_FROM_CHECK = {
    "ain-bed": "ainsley", "ain-toys": "ainsley",
    "ain-dishwasher": "ainsley", "ain-empty": "ainsley", "ain-living": "ainsley",
    "ain-bath": "ainsley", "ain-laundry": "ainsley", "ain-cubby": "ainsley", "ain-babysit": "ainsley",
    "hay-bed": "hayes", "hay-backpack": "hayes", "hay-dishes": "hayes", "hay-empty": "hayes", "hay-trash": "hayes",
    "hay-postgame": "hayes", "hay-shower": "hayes", "hay-room": "hayes", "hay-shoes": "hayes", "hay-cubby": "hayes",
    "har-bed": "harris", "har-backpack": "harris", "har-dishes": "harris", "har-empty": "harris", "har-trash": "harris",
    "har-postgame": "harris", "har-shower": "harris", "har-toys": "harris", "har-shoes": "harris", "har-cubby": "harris"
  };

  /* CHORELAW3 · the chore law's ids: every kid has the same 4 binary MUSTS (must-bed / must-hamper / must-dish /
     must-floor; Hayes's 4th swaps to must-dragon only while the dragon is home). The same id belongs to three kids,
     so a tap id is qualified "kid:must-x" (rendered as data-check) and stored plain, per kid per day, under
     house-checkoffs:<kid>:<YYYY-MM-DD> (the wall reads the same key). The old per-kid ids (har-bed, hay-dishes, ...)
     are retired: the ones that match a must map onto it (saved checkoffs carry over), the rest render nowhere. */
  var MUST_IDS = { "must-bed": 1, "must-hamper": 1, "must-dish": 1, "must-floor": 1, "must-dragon": 1 };
  var NO_STARS = { ainsley: true }; /* CHORELAW1: Ainsley has no stars, counts or currency */
  var LEGACY_TO_MUST = {
    "ain-bed": "must-bed", "hay-bed": "must-bed", "har-bed": "must-bed",
    "ain-laundry": "must-hamper",
    "ain-dishwasher": "must-dish", "hay-dishes": "must-dish", "har-dishes": "must-dish",
    "ain-living": "must-floor", "ain-toys": "must-floor", "hay-room": "must-floor", "har-toys": "must-floor"
  };
  function qid(kidId, id) {
    id = String(id == null ? "" : id);
    if (!kidId || id.indexOf(":") >= 0 || !MUST_IDS[id]) return id;
    return kidId + ":" + id;
  }
  function pageKid() {
    try { var b = document.body; var k = b && (b.getAttribute("data-kid") || ""); return KIDS_ALL[k] ? k : null; } catch (e) { return null; }
  }
  var KIDS_ALL = { harris: 1, hayes: 1, ainsley: 1 };
  /** -> { kid, id (plain, stored), legacy (old id or null), retired } ; kid null = unknown (never written) */
  function resolveCheck(checkId) {
    var raw = String(checkId == null ? "" : checkId), kid = null, id = raw;
    var c = raw.indexOf(":");
    if (c > 0 && KIDS_ALL[raw.slice(0, c)]) { kid = raw.slice(0, c); id = raw.slice(c + 1); }
    if (KID_FROM_CHECK[id]) {
      var mapped = LEGACY_TO_MUST[id] || null;
      return { kid: kid || KID_FROM_CHECK[id], id: mapped || id, legacy: id, retired: !mapped && id !== "ain-babysit" };
    }
    if (!kid && MUST_IDS[id]) kid = pageKid();
    return { kid: kid, id: id, legacy: null, retired: false };
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  /** Chicago hour 0–23 (for Fri 3:00p homeWeek handoff). */
  function chicagoHourNow() {
    try {
      var parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        hourCycle: "h23"
      }).formatToParts(new Date());
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === "hour") return Number(parts[i].value) % 24;
      }
    } catch (e) { /* */ }
    try { return new Date().getHours(); } catch (e2) { return 12; }
  }

  /**
   * homeWeek chore week = Fri 3:00p → next Fri 3:00p.
   * Day taps: Sat Sun Mon Tue Wed Thu Fri (7) — LEAVE Friday morning still counts.
   * Arrival Friday after 3:00p starts the week; leave Friday before 3:00p ends it.
   * No chore-free leave Friday.
   */
  function weekStartIso(dayIso) {
    var iso = dayIso || DAY_ISO;
    var parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    /* Noon CT anchor — box TZ is America/Chicago */
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    var dow = d.getDay(); /* 0=Sun … 5=Fri */
    var sinceFri = (dow - 5 + 7) % 7; /* Fri=0 … Thu=6 */
    d.setDate(d.getDate() - sinceFri);
    /* Friday = leave-morning of prior Dad week unless TODAY after 3:00p (new week starts). */
    if (sinceFri === 0) {
      if (iso === DAY_ISO) {
        if (chicagoHourNow() < 15) d.setDate(d.getDate() - 7);
      } else {
        /* Historical Friday date = leave-morning tap (Sat→Fri), not arrival after 3p */
        d.setDate(d.getDate() - 7);
      }
    }
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function dowIndexFromIso(iso) {
    var parts = String(iso).split("-");
    if (parts.length !== 3) return 0;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    return d.getDay();
  }

  function questMeta(kidId, checkId, data) {
    var kid = data && data.kids && data.kids[kidId];
    var base = NO_STARS[kidId] ? 0 : 1; /* CHORELAW3: no stars:1 default for Ainsley */
    var plain = resolveCheck(checkId).id;
    if (!kid || !kid.quests) return { cadence: "daily", stars: base, optional: false };
    for (var i = 0; i < kid.quests.length; i++) {
      if (kid.quests[i].id === plain) {
        var q = kid.quests[i];
        var optional = !!(q.optional || q.cadence === "addon");
        var cadence = q.cadence || (optional ? "addon" : "daily");
        var stars = (optional || NO_STARS[kidId]) ? 0 : (typeof q.stars === "number" ? q.stars : 1);
        return { cadence: cadence, stars: stars, optional: optional };
      }
    }
    return { cadence: "daily", stars: base, optional: false };
  }

  var WEEKLY_IDS = {
    "ain-bath": 1, "ain-laundry": 1, "ain-cubby": 1,
    "hay-room": 1, "hay-shoes": 1, "hay-cubby": 1,
    "har-toys": 1, "har-shoes": 1, "har-cubby": 1
  };
  var DOW_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
  var DOW_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function checkKeyFor(checkId, data, dayIso) {
    var r = resolveCheck(checkId), kidId = r.kid;
    if (!kidId) return CHECK_KEY;
    var meta = questMeta(kidId, checkId, data || (global.WardKids && global.WardKids._data));
    var weekly = meta.cadence === "weekly" || !!WEEKLY_IDS[r.legacy || r.id];
    if (MUST_IDS[r.id]) weekly = false; /* the law's MUSTS are daily, binary */
    var iso = dayIso || DAY_ISO;
    if (weekly) {
      return CHECK_PREFIX + kidId + ":week:" + weekStartIso(iso);
    }
    /* daily musts + soft/addon — keyed per Chicago day (Sat→Fri Dad-week taps) */
    return CHECK_PREFIX + kidId + ":" + iso;
  }

  /** Sat–Fri inclusive = 7 Dad-week tap days (Sat Sun Mon Tue Wed Thu Fri leave-morning). */
  var DAD_WEEK_DAYS = 7;

  function weekDayIsos(anchorIso) {
    var start = weekStartIso(anchorIso || DAY_ISO);
    var parts = String(start).split("-");
    /* First tap day = Saturday after Fri 3:00p arrival (start+1). Last = leave Friday. */
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    d.setDate(d.getDate() + 1);
    var out = [];
    for (var i = 0; i < DAD_WEEK_DAYS; i++) {
      out.push(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function dadWeekLen() {
    return weekDayIsos(DAY_ISO).length || DAD_WEEK_DAYS;
  }

  function dailyDoneCount(checkId, data) {
    var n = 0;
    var days = weekDayIsos(DAY_ISO);
    for (var i = 0; i < days.length; i++) {
      if (getCheckRaw(checkId, data, days[i])) n += 1;
    }
    return n;
  }

  function dailyWeekComplete(checkId, data) {
    return dailyDoneCount(checkId, data) >= weekDayIsos(DAY_ISO).length;
  }

  /* Stars credited to jar for a must. Daily = stars×DAD_WEEK_DAYS once Sat→Fri complete (not per-day pay). */
  function bankStarsFor(kidId, checkId, data) {
    var meta = questMeta(kidId, checkId, data);
    if (meta.optional) return 0;
    if (meta.cadence === "daily") return (meta.stars || 1) * dadWeekLen();
    return meta.stars || 1;
  }

  function recomputeDayStars(kidId, dayBag, data) {
    var sum = 0;
    if (!dayBag || !dayBag.earned) return 0;
    Object.keys(dayBag.earned).forEach(function (k) {
      if (k === MUST_GATE_FLAG) return;
      if (dayBag.earned[k]) sum += bankStarsFor(kidId, k, data);
    });
    dayBag.stars = sum;
    return sum;
  }

  function ensureDayBag(root, kidId, iso) {
    if (!root[kidId]) root[kidId] = { days: {}, lifetime: 0, balance: 0 };
    if (!root[kidId].days) root[kidId].days = {};
    if (!root[kidId].days[iso]) root[kidId].days[iso] = { stars: 0, earned: {} };
    if (!root[kidId].days[iso].earned) root[kidId].days[iso].earned = {};
    return root[kidId].days[iso];
  }

  /** MUSTGATE1 · non-optional quests that must ALL clear before jar/allowance unlocks. */
  var MUST_GATE_FLAG = "__mustgate__";

  function mustQuests(kidId, data) {
    var kid = data && data.kids && data.kids[kidId];
    if (!kid || !kid.quests) return [];
    var out = [];
    for (var i = 0; i < kid.quests.length; i++) {
      var q = kid.quests[i];
      if (q.optional || q.cadence === "addon") continue;
      out.push(q);
    }
    return out;
  }

  function mustSetComplete(kidId, data) {
    var qs = mustQuests(kidId, data);
    if (!qs.length) return false;
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i];
      var cadence = q.cadence || "daily";
      if (cadence === "daily") {
        if (!dailyWeekComplete(qid(kidId, q.id), data)) return false;
      } else if (!getCheckRaw(qid(kidId, q.id), data)) {
        return false;
      }
    }
    return true;
  }

  function mustProgress(kidId, data) {
    var qs = mustQuests(kidId, data);
    var done = 0;
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i];
      var cadence = q.cadence || "daily";
      var ok = cadence === "daily" ? dailyWeekComplete(qid(kidId, q.id), data) : getCheckRaw(qid(kidId, q.id), data);
      if (ok) done += 1;
    }
    return { done: done, need: qs.length, complete: qs.length > 0 && done >= qs.length };
  }

  function mustPayStars(kidId, data) {
    var qs = mustQuests(kidId, data);
    var pay = 0;
    for (var i = 0; i < qs.length; i++) pay += bankStarsFor(kidId, qs[i].id, data);
    return pay;
  }

  /**
   * MUSTGATE1 · jar/allowance unlocks only when EVERY must is done for the Dad week
   * (daily = all Sat→Fri taps; weekly = one tap). One chore done for the week does NOT credit $.
   * Credits all must stars onto first Sat tap day when gate opens; scrubs when gate closes.
   */
  function syncMustGateBank(kidId, data) {
    if (!kidId) return null;
    var root = loadBankRoot();
    if (!root[kidId]) root[kidId] = { days: {}, lifetime: 0, balance: 0 };
    var days = weekDayIsos(DAY_ISO);
    if (!days.length) return getBankView(kidId, data);
    var ws = days[0];
    var qs = mustQuests(kidId, data);
    var complete = mustSetComplete(kidId, data);
    var wsBag = ensureDayBag(root, kidId, ws);
    var wasGate = !!(wsBag.earned && wsBag.earned[MUST_GATE_FLAG]);
    var pay = mustPayStars(kidId, data);
    var di, qi, bag, id;

    for (di = 0; di < days.length; di++) {
      bag = ensureDayBag(root, kidId, days[di]);
      for (qi = 0; qi < qs.length; qi++) {
        id = qs[qi].id;
        if (bag.earned && bag.earned[id]) delete bag.earned[id];
      }
      if (bag.earned && bag.earned[MUST_GATE_FLAG]) delete bag.earned[MUST_GATE_FLAG];
      recomputeDayStars(kidId, bag, data);
    }

    if (complete) {
      wsBag = ensureDayBag(root, kidId, ws);
      for (qi = 0; qi < qs.length; qi++) {
        wsBag.earned[qs[qi].id] = true;
      }
      wsBag.earned[MUST_GATE_FLAG] = true;
      recomputeDayStars(kidId, wsBag, data);
    }

    if (complete && !wasGate) {
      root[kidId].lifetime = (root[kidId].lifetime || 0) + pay;
    } else if (!complete && wasGate) {
      root[kidId].lifetime = Math.max(0, (root[kidId].lifetime || 0) - pay);
    }
    saveBankRoot(root);
    return getBankView(kidId, data);
  }

  /** Legacy name — re-syncs full Must gate for the kid owning this check. */
  function syncDailyWeekBank(checkId, data) {
    var kidId = resolveCheck(checkId).kid;
    if (!kidId) return null;
    return syncMustGateBank(kidId, data);
  }

  function weekStarsFor(kidId) {
    var root = loadBankRoot();
    var bag = root[kidId];
    if (!bag || !bag.days) return 0;
    /* Sum Sat→leave-Fri tap days only (matches syncDailyWeekBank credit bucket). */
    var days = weekDayIsos(DAY_ISO);
    var sum = 0;
    for (var i = 0; i < days.length; i++) {
      var iso = days[i];
      if (bag.days[iso] && bag.days[iso].stars) sum += bag.days[iso].stars;
    }
    return sum;
  }

  /* Embedded fallback — same payload as kids-week.json (fetch preferred on Pages) */
  var EMBEDDED = {"asOf":"Fri Oct 2 2026","asOfIso":"2026-10-02","refreshedAt":"2026-10-02T11:46:00.405Z","sourceCalendar":"dmward23@gmail.com","leaveBys":{"SRE_drop":"leave 8:10 for 8:25","SRE_pickup":"leave 3:15 for 3:40","note":"sports: event START = leave-by"},"homeWeek":{"with":"Dad","place":"147th","through":"Fri Oct 2 · 3:00","throughLabel":"with Dad @ 147th · Fri Sep 25 3:00 → Fri Oct 2 · 3:00","endIso":"2026-10-02T20:00:00.000Z"},"boardStrip":{"label":"Next up · today","time":"7:00","place":"SRE specials: No Specials","detailHtml":"kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Fri","startIso":"2026-10-02T12:00:00.000Z","endIso":"2026-10-02T12:15:00.000Z","kind":"school","queue":[{"label":"Next up · today","time":"7:00","place":"SRE specials: No Specials","detailHtml":"kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Fri","startIso":"2026-10-02T12:00:00.000Z","endIso":"2026-10-02T12:15:00.000Z","kind":"school","whenLabel":"7:00","summary":"Hayes — SRE specials: No Specials"},{"label":"Next up · today","time":"7:00","place":"SRE specials: Music","detailHtml":"kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Fri","startIso":"2026-10-02T12:00:00.000Z","endIso":"2026-10-02T12:15:00.000Z","kind":"school","whenLabel":"7:00","summary":"Harris — SRE specials: Music"},{"label":"Next up · today","time":"7:30","place":"Free · Hayes — pack late-lunch snacks (headaches · Ma…","detailHtml":"kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Fri","startIso":"2026-10-02T12:30:00.000Z","endIso":"2026-10-02T12:45:00.000Z","kind":"school","whenLabel":"7:30","summary":"Free · Hayes — pack late-lunch snacks (headaches · Madi OK)"},{"label":"Next up · today","time":"8:10","place":"Boys SRE drop","detailHtml":"kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Fri","startIso":"2026-10-02T13:10:00.000Z","endIso":"2026-10-02T13:40:00.000Z","kind":"school_drop","whenLabel":"8:10","summary":"Hayes + Harris — SRE drop-off · 8:25"},{"label":"Next up · today","time":"9:00","place":"SRE field trip (museum + Meadowbrook)","detailHtml":"kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Fri","startIso":"2026-10-02T14:00:00.000Z","endIso":"2026-10-02T19:00:00.000Z","kind":"school","whenLabel":"9:00","summary":"Hayes — SRE field trip (museum + Meadowbrook)"},{"label":"Next up · today","time":"11:00","place":"Free · Ainsley — baby pic email by 3:00","detailHtml":"kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Fri","startIso":"2026-10-02T16:00:00.000Z","endIso":"2026-10-02T16:15:00.000Z","kind":"school","whenLabel":"11:00","summary":"Free · Ainsley — baby pic email by 3:00"},{"label":"Next up · today","time":"11:30","place":"SRE Tailgate Party (reading incentive)","detailHtml":"kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Fri","startIso":"2026-10-02T16:30:00.000Z","endIso":"2026-10-02T17:30:00.000Z","kind":"school","whenLabel":"11:30","summary":"Harris — SRE Tailgate Party (reading incentive)"},{"label":"Next up · today","time":"12:00","place":"SRE field trip museum+park (chaperone slots)","detailHtml":"kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Fri","startIso":"2026-10-02T17:00:00.000Z","endIso":"2026-10-02T17:00:00.000Z","kind":"school","whenLabel":"12:00","summary":"Hayes — SRE field trip museum+park (chaperone slots)"},{"label":"Next up · Sat","time":"8:30","place":"Dan DRIVE → Nashville","detailHtml":"1:00 Harris flag — vs BV Gardner (home) · kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Sat","startIso":"2026-10-03T13:30:00.000Z","endIso":"2026-10-03T22:00:00.000Z","kind":"leave","whenLabel":"Sat 8:30","summary":"Dan DRIVE → Nashville · leave 8:30 · dinner 5:30 J. Alexander's"},{"label":"Next up · Sat","time":"1:00","place":"Harris flag — vs BV Gardner (home) · arrive 1:00 · ga…","detailHtml":"8:30 leave · kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Sat","startIso":"2026-10-03T18:00:00.000Z","endIso":"2026-10-03T19:30:00.000Z","kind":"sport","whenLabel":"Sat 1:00","summary":"Harris flag — vs BV Gardner (home) · arrive 1:00 · game 1:30"},{"label":"Next up · Sat","time":"5:00","place":"Hayes birthday — J. Alexander's · 5:30","detailHtml":"8:30 leave · 1:00 Harris flag — vs BV Gardner (home) · kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Sat","startIso":"2026-10-03T22:00:00.000Z","endIso":"2026-10-04T00:30:00.000Z","kind":"other","whenLabel":"Sat 5:00","summary":"Hayes birthday — J. Alexander's · 5:30 · leave 5:00"},{"label":"Next up · Sun","time":"8:30","place":"Hayes flag — SRE Falcons vs Ridley · arrive 8:30 · ga…","detailHtml":"kids with Dad @ <strong>147th</strong> through Fri Oct 2 · 3:00","badge":"Sun","startIso":"2026-10-04T13:30:00.000Z","endIso":"2026-10-04T15:00:00.000Z","kind":"sport","whenLabel":"Sun 8:30","summary":"Hayes flag — SRE Falcons vs Ridley · arrive 8:30 · game 9:00"}]},"kids":{"harris":{"id":"harris","name":"Harris","you":"you","theme":"block-world","themeLabel":"Block World","gradeVoice":"1st grade","avatar":"H","currency":{"unit":"gem","plural":"gems","symbol":"◆","label":"Gems"},"bankGoal":{"id":"gem-jar","title":"Gems · earn then save","blurb":"Honest Dad-week musts (Fri 3:00p→Fri 3:00p · taps Sat–Fri, leave Fri morning). ALL musts required. Save what you earned.","need":10,"reward":"Goal with Dad after honest musts","dollarNeed":10,"weeklyAllowance":10,"starDollar":1},"quests":[{"id":"must-bed","what":"Bed made","cadence":"daily","must":true,"stars":1},{"id":"must-hamper","what":"Hamper in","cadence":"daily","must":true,"stars":1},{"id":"must-dish","what":"Dish to the sink","cadence":"daily","must":true,"stars":1},{"id":"must-floor","what":"Own floor clear","cadence":"daily","must":true,"stars":1}],"fun":[{"when":"Quest reward","what":"🧱 BLOCK BUILD TIME","hint":"gems · craft optional","tone":"fun"},{"when":"Outside","what":"🌳 Backyard boss fight (play)","hint":"ask Dad · run wild","tone":"fun"},{"when":"Tonight","what":"🍪 Snack chest raid","hint":"after quests · with Dad","tone":"fun"},{"when":"Base mission","what":"💎 Gems · save with Dad","hint":"FUN · craft unlock optional","tone":"fun"}],"streakLabel":"Week 3 · craft — keep smashing","missions":[{"when":"Anytime","what":"ALL musts clear = gems","hint":"ALL musts clear","tone":"fun"}],"appointmentsEmpty":"No doctor stuff on your board — lucky!!! More play time.","hottest":{"when":"FRI · 7:00","what":"SRE SPECIALS: MUSIC","where":"with Dad @ 147th · through Fri Oct 2 · 3:00","badges":["FRI","7:00"]},"today":[{"kind":"event","when":"Fri · 7:00","what":"SRE specials: Music","hint":"","tone":"act"},{"kind":"event","when":"Fri · 8:10","what":"SRE drop-off","hint":"","tone":"act"},{"kind":"event","when":"Fri · 11:30","what":"SRE Tailgate Party (reading incentive)","hint":"","tone":"act"},{"kind":"note","when":"All day","what":"🏡 YOUR BASE with Dad","hint":"through Fri Oct 2 · 3:00","tone":"hot"}],"sports":[{"when":"Sat 3 · leave 1:00","what":"Harris flag — vs BV Gardner (home) · arrive 1:00 · game 1:30","hint":"YOUR board","tone":"hot"},{"when":"Wed 7 · leave 4:45","what":"Harris flag practice · 5:30–6:30","hint":"YOUR board","tone":"hot"}],"school":[{"when":"Fri 2 · 7:00","what":"SRE specials: Music","tone":"act","hint":""},{"when":"Fri 2 · 8:10","what":"SRE drop-off","tone":"act","hint":""},{"when":"Fri 2 · 11:30","what":"SRE Tailgate Party (reading incentive)","tone":"act","hint":""},{"when":"Mon 5 · 7:00","what":"SRE specials: Music","tone":"act","hint":""},{"when":"Mon 5 · 7:00","what":"SRE spirit day: Hat Day (Peace Week)","tone":"act","hint":""},{"when":"Mon 5 · 12:00","what":"SRE Peace Week","tone":"act","hint":""},{"when":"Tue 6 · 7:00","what":"SRE spirit day: Tropical Day (Peace Week)","tone":"act","hint":""},{"when":"Tue 6 · 7:00","what":"SRE specials: PE (tennis shoes)","tone":"act","hint":""},{"when":"Wed 7 · 7:00","what":"SRE specials: Art","tone":"act","hint":""},{"when":"Wed 7 · 7:00","what":"SRE spirit day: Workout Day / team jersey (Peace Week)","tone":"act","hint":""},{"when":"Thu 8 · 7:00","what":"SRE spirit day: Crazy Socks Day (Peace Week)","tone":"act","hint":""},{"when":"Thu 8 · 7:00","what":"SRE specials: Spanish + Library checkout","tone":"act","hint":""},{"when":"Fri 9 · 12:00","what":"Ward Kids [AHH No School]","tone":"act","hint":""}],"appointments":[]},"hayes":{"id":"hayes","name":"Hayes","you":"you","theme":"drop-zone","themeLabel":"Drop Zone","gradeVoice":"3rd grade","avatar":"H","currency":{"unit":"coin","plural":"coins","symbol":"◎","label":"Victory Coins"},"bankGoal":{"id":"victory-jar","title":"Victory Coins · earn then save","blurb":"Honest Dad-week musts (Fri 3:00p→Fri 3:00p · taps Sat–Fri, leave Fri morning). ALL musts required. Save what you earned.","need":10,"reward":"Goal with Dad after honest musts","dollarNeed":10,"weeklyAllowance":10,"starDollar":1},"quests":[{"id":"must-bed","what":"Bed made","cadence":"daily","must":true,"stars":1},{"id":"must-hamper","what":"Hamper in","cadence":"daily","must":true,"stars":1},{"id":"must-dish","what":"Dish to the sink","cadence":"daily","must":true,"stars":1},{"id":"must-floor","what":"Own floor clear","cadence":"daily","must":true,"stars":1}],"fun":[{"when":"After clears","what":"👑 Victory round — game pick with Dad","hint":"coins · earn then save","tone":"fun"},{"when":"Outside","what":"⚡ Sports grind / run the yard","hint":"ask Dad","tone":"fun"},{"when":"Base mission","what":"☂️ Victory Coins · save with Dad","hint":"FUN · umbrella treat optional","tone":"fun"},{"when":"Squad","what":"🤝 Duo queue with Harris / crew","hint":"FUN","tone":"fun"}],"streakLabel":"Week 6 — don't break it","missions":[{"when":"Every clear","what":"💥 ALL musts clear = coins","hint":"ALL musts clear","tone":"fun"}],"appointmentsEmpty":"No appointments. Clear skies. GO PLAY.","hottest":{"when":"FRI · 7:00","what":"SRE SPECIALS: NO SPECIALS","where":"with Dad @ 147th · through Fri Oct 2 · 3:00","badges":["FRI","7:00"]},"today":[{"kind":"event","when":"Fri · 7:00","what":"SRE specials: No Specials","hint":"","tone":"act"},{"kind":"event","when":"Fri · 7:30","what":"Free · Hayes — pack late-lunch snacks (headaches · Madi OK)","hint":"","tone":"act"},{"kind":"event","when":"Fri · 8:10","what":"SRE drop-off","hint":"","tone":"act"},{"kind":"event","when":"Fri · 9:00","what":"SRE field trip (museum + Meadowbrook)","hint":"","tone":"act"},{"kind":"event","when":"Fri · 12:00","what":"SRE field trip museum+park (chaperone slots)","hint":"","tone":"act"},{"kind":"note","when":"All day","what":"🏡 DROP ZONE HQ with Dad","hint":"through Fri Oct 2 · 3:00","tone":"hot"}],"sports":[{"when":"Sun 4 · leave 8:30","what":"Hayes flag — SRE Falcons vs Ridley · arrive 8:30 · game 9:00","hint":"YOUR board","tone":"hot"},{"when":"Mon 5 · leave 5:30","what":"Hayes baseball — Falcons vs KC Tigers (away)","hint":"YOUR board","tone":"hot"},{"when":"Thu 8 · leave 6:00","what":"Hayes flag practice","hint":"YOUR board","tone":"hot"}],"school":[{"when":"Fri 2 · 7:00","what":"SRE specials: No Specials","tone":"act","hint":""},{"when":"Fri 2 · 7:30","what":"Free · Hayes — pack late-lunch snacks (headaches · Madi OK)","tone":"act","hint":""},{"when":"Fri 2 · 8:10","what":"SRE drop-off","tone":"act","hint":""},{"when":"Fri 2 · 9:00","what":"SRE field trip (museum + Meadowbrook)","tone":"act","hint":""},{"when":"Fri 2 · 12:00","what":"SRE field trip museum+park (chaperone slots)","tone":"act","hint":""},{"when":"Mon 5 · 7:00","what":"SRE specials: Spanish","tone":"act","hint":""},{"when":"Mon 5 · 7:00","what":"SRE spirit day: Hat Day (Peace Week)","tone":"act","hint":""},{"when":"Mon 5 · 12:00","what":"SRE Peace Week","tone":"act","hint":""},{"when":"Tue 6 · 7:00","what":"SRE spirit day: Tropical Day (Peace Week)","tone":"act","hint":""},{"when":"Tue 6 · 7:00","what":"SRE specials: Music","tone":"act","hint":""},{"when":"Wed 7 · 7:00","what":"SRE specials: PE + Library (tennis shoes, library book)","tone":"act","hint":""},{"when":"Wed 7 · 7:00","what":"SRE spirit day: Workout Day / team jersey (Peace Week)","tone":"act","hint":""},{"when":"Thu 8 · 7:00","what":"SRE spirit day: Crazy Socks Day (Peace Week)","tone":"act","hint":""},{"when":"Thu 8 · 7:00","what":"SRE specials: Art","tone":"act","hint":""},{"when":"Fri 9 · 12:00","what":"Ward Kids [AHH No School]","tone":"act","hint":""}],"appointments":[]},"ainsley":{"id":"ainsley","name":"Ainsley","you":"you","theme":"vinyl-night","themeLabel":"Ainsley","gradeVoice":"8th grade","avatar":"A","quests":[{"id":"must-bed","what":"Bed made","cadence":"daily","must":true},{"id":"must-hamper","what":"Hamper in","cadence":"daily","must":true},{"id":"must-dish","what":"Dish to the sink","cadence":"daily","must":true},{"id":"must-floor","what":"Own floor clear","cadence":"daily","must":true},{"id":"ain-babysit","what":"👶 Babysitting — optional hire (Dad books you)","cadence":"addon","optional":true,"hire":true,"hint":"Dad handout","rateLabel":"$15/hr"}],"fun":[],"streakLabel":"","missions":[{"when":"Add-on","what":"Babysitting — optional · Dad books you","hint":"hire add-on","tone":"fun"}],"bag":{"place":"Dad","label":"This week @ Dad · bag","hint":"147th through Fri Oct 2 · pack for Dad week"},"rides":[{"id":"scooter","what":"🛴 Scooter run","when":"your call","clear":true},{"id":"bv-rec","what":"🏟️ BV Rec","when":"when you're free","clear":true},{"id":"swim","what":"🏊 Ridgeview swim","when":"Tue/Thu · leave 4:25","clear":true,"hours":"leave 4:25 · 5:00"}],"appointmentsEmpty":"No appointments on your board.","sportsEmpty":"","hottest":{"when":"FRI · 11:00","what":"FREE · AINSLEY — BABY PIC EMAIL BY 3:00","where":"with Dad @ 147th · through Fri Oct 2 · 3:00","badges":["FRI","11:00"]},"today":[{"kind":"event","when":"Fri · 11:00","what":"Free · Ainsley — baby pic email by 3:00","hint":"","tone":"act"},{"kind":"note","when":"All day","what":"Base @ 147th with Dad","hint":"through Fri Oct 2 · 3:00","tone":"hot"}],"sports":[{"when":"Tue 6 · leave 5:00","what":"Ainsley swim — Coach Ann","hint":"YOUR board","tone":"hot"},{"when":"Thu 8 · leave 5:00","what":"Ainsley swim — Coach Ann","hint":"YOUR board","tone":"hot"}],"school":[{"when":"Fri 2 · 11:00","what":"Free · Ainsley — baby pic email by 3:00","tone":"act","hint":""},{"when":"Mon 5 · 3:00","what":"LKMS Homework Help","tone":"act","hint":""},{"when":"Thu 8 · 3:00","what":"LKMS Homework Help","tone":"act","hint":""},{"when":"Fri 9 · 12:00","what":"Ward Kids [AHH No School]","tone":"act","hint":""}],"appointments":[{"when":"Mon 5 · 1:40","what":"Lindsay appt","hint":"with Dad","tone":"hot"}]},"dan":{"id":"dan","name":"Dad","theme":"house-dad","themeLabel":"Dad Box","avatar":"D","note":"Kids-safe Dad box · no money · no Desk · calendar facts from dmward23 / Atlas only","picks":[{"when":"Tonight","what":"Dinner vote with crew","hint":"House · kids-safe","tone":"fun"},{"when":"This week","what":"Sports stack · Mon ball · Tue flag/swim · Wed Harris flag · Thu game/swim","hint":"Dad drives","tone":"fun"}],"leaveBys":[{"when":"Weekday school","what":"SRE drop leave 8:10 for 8:25","tone":"act"},{"when":"Weekday pickup","what":"Leave 3:15 for 3:40 boys","tone":"act"},{"when":"Sports rule","what":"Event START = your leave-by","tone":"act"}],"hottest":{"when":"Fri Oct 2 2026 · kids with you @ 147th","what":"Dad week live","where":"through Fri Oct 2 · 3:00","badges":["Dad week","147th"]},"today":[{"when":"Fri · 7:00","what":"SRE specials: No Specials","tone":"act"},{"when":"Fri · 7:00","what":"SRE specials: Music","tone":"act"},{"when":"Fri · 7:30","what":"Free · Hayes — pack late-lunch snacks (headaches · Madi OK)","tone":"act"},{"when":"Fri · 8:10","what":"SRE drop-off","tone":"act"},{"when":"Fri · 9:00","what":"SRE field trip (museum + Meadowbrook)","tone":"act"},{"when":"Fri · 11:00","what":"Free · Ainsley — baby pic email by 3:00","tone":"act"},{"when":"Fri · 11:30","what":"SRE Tailgate Party (reading incentive)","tone":"act"},{"when":"Fri · 12:00","what":"HOA Fall Garage Sale","tone":"hot"},{"when":"Fri · 12:00","what":"SRE field trip museum+park (chaperone slots)","tone":"act"},{"when":"Fri · 12:00","what":"get tree-trim bids (2–3 written)","tone":"hot"}],"week":[{"when":"Fri 2 · 7:00","what":"SRE specials: No Specials","tone":"act"},{"when":"Fri 2 · 7:00","what":"SRE specials: Music","tone":"act"},{"when":"Fri 2 · 7:30","what":"Free · Hayes — pack late-lunch snacks (headaches · Madi OK)","tone":"act"},{"when":"Fri 2 · 8:10","what":"SRE drop-off","tone":"act"},{"when":"Fri 2 · 9:00","what":"SRE field trip (museum + Meadowbrook)","tone":"act"},{"when":"Fri 2 · 11:00","what":"Free · Ainsley — baby pic email by 3:00","tone":"act"},{"when":"Fri 2 · 11:30","what":"SRE Tailgate Party (reading incentive)","tone":"act"},{"when":"Fri 2 · 12:00","what":"SRE field trip museum+park (chaperone slots)","tone":"act"},{"when":"Sat 3 · 8:30","what":"Dan DRIVE → Nashville","tone":"hot"},{"when":"Sat 3 · 1:00","what":"Harris flag — vs BV Gardner (home) · arrive 1:00 · game 1:30","tone":"hot"},{"when":"Sun 4 · 8:30","what":"Hayes flag — SRE Falcons vs Ridley · arrive 8:30 · game 9:00","tone":"hot"},{"when":"Mon 5 · 7:00","what":"SRE specials: Music","tone":"act"},{"when":"Mon 5 · 7:00","what":"SRE specials: Spanish","tone":"act"},{"when":"Mon 5 · 7:00","what":"SRE spirit day: Hat Day (Peace Week)","tone":"act"},{"when":"Mon 5 · 12:00","what":"SRE Peace Week","tone":"act"},{"when":"Mon 5 · 1:40","what":"Lindsay appt","tone":"act"},{"when":"Mon 5 · 3:00","what":"LKMS Homework Help","tone":"act"},{"when":"Mon 5 · 5:30","what":"Hayes baseball — Falcons vs KC Tigers (away)","tone":"hot"},{"when":"Tue 6 · 7:00","what":"SRE spirit day: Tropical Day (Peace Week)","tone":"act"},{"when":"Tue 6 · 7:00","what":"SRE specials: PE (tennis shoes)","tone":"act"},{"when":"Tue 6 · 7:00","what":"SRE specials: Music","tone":"act"},{"when":"Tue 6 · 5:00","what":"Ainsley swim — Coach Ann","tone":"hot"},{"when":"Wed 7 · 7:00","what":"SRE specials: Art","tone":"act"},{"when":"Wed 7 · 7:00","what":"SRE specials: PE + Library (tennis shoes, library book)","tone":"act"}]}}};

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadJSON(cb) {
    var urls = ["kids-week.json", "data/kids-week.json"];
    var i = 0;
    function tryNext() {
      if (i >= urls.length) {
        if (EMBEDDED) { cb(null, EMBEDDED); return; }
        cb(new Error("kids-week.json missing"), null);
        return;
      }
      var u = urls[i++];
      if (typeof fetch !== "function") { tryNext(); return; }
      fetch(u, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (data) {
          EMBEDDED = data;
          cb(null, data);
        })
        .catch(function () { tryNext(); });
    }
    /* CANCELGONE1 · the embedded copy rides a cached kids-data.js and can be
     * hours old. Always try the fresh kids-week.json first (3s), embedded only
     * if the network is down. */
    if (EMBEDDED && typeof fetch === "function") {
      var done = false, emb = EMBEDDED;
      var t = setTimeout(function () { if (!done) { done = true; cb(null, emb); } }, 3000);
      fetch(urls[0] + "?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (d) {
          if (done) { EMBEDDED = d; return; }
          done = true; clearTimeout(t); EMBEDDED = d; cb(null, d);
        })
        .catch(function () { if (!done) { done = true; clearTimeout(t); cb(null, emb); } });
      return;
    }
    if (EMBEDDED) { cb(null, EMBEDDED); return; }
    tryNext();
  }

  function loadKeyState(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveKeyState(key, state) {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { /* */ }
  }

  /* Legacy flat blob — only for one-shot migrate into day keys */
  function loadChecks() {
    try { return JSON.parse(localStorage.getItem(CHECK_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveChecks(state) {
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(state)); } catch (e) { /* */ }
  }

  function loadBankRoot() {
    try { return JSON.parse(localStorage.getItem(BANK_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveBankRoot(root) {
    try { localStorage.setItem(BANK_KEY, JSON.stringify(root)); } catch (e) { /* */ }
  }

  function kidDayBank(kidId) {
    var root = loadBankRoot();
    if (!root[kidId]) root[kidId] = { days: {}, lifetime: 0, balance: 0 };
    if (typeof root[kidId].balance !== "number") root[kidId].balance = Number(root[kidId].balance) || 0;
    if (typeof root[kidId].lifetime !== "number") root[kidId].lifetime = Number(root[kidId].lifetime) || 0;
    if (!root[kidId].days[DAY_ISO]) root[kidId].days[DAY_ISO] = { stars: 0, earned: {} };
    return { root: root, day: root[kidId].days[DAY_ISO], bag: root[kidId] };
  }

  function questStarsFor(kidId, checkId, data) {
    return questMeta(kidId, checkId, data).stars;
  }

  function applyCheckToBank(checkId, done, data) {
    var kidId = resolveCheck(checkId).kid;
    if (!kidId) return null;
    var meta = questMeta(kidId, checkId, data);
    /* MUSTGATE1 · optional/hire never fills jar; all musts route through full-set gate */
    if (meta.optional) return getBankView(kidId, data);
    return syncMustGateBank(kidId, data);
  }

  function allowanceCap(goal) {
    var g = goal || {};
    var cap = typeof g.weeklyAllowance === "number" ? g.weeklyAllowance : null;
    if (cap == null || isNaN(cap)) cap = typeof g.need === "number" ? g.need : 0;
    return Math.max(0, Number(cap) || 0);
  }

  function starDollarOf(goal) {
    var g = goal || {};
    return g.starDollar != null ? Number(g.starDollar) : 1;
  }

  function weekEarnDollars(kidId, data) {
    if (!mustSetComplete(kidId, data)) return 0;
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || {};
    var week = weekStarsFor(kidId);
    var sd = starDollarOf(goal);
    var cap = allowanceCap(goal);
    var raw = week * (isNaN(sd) ? 1 : sd);
    return Math.min(raw, cap);
  }

  /** Move prior (completed) weeks' stars into durable balance$ so unpaid carry survives rollover. */
  function settlePriorWeeksIntoBalance(kidId, data) {
    var pack = kidDayBank(kidId);
    var bag = pack.bag;
    if (!bag.days) return;
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || {};
    var sd = starDollarOf(goal);
    if (isNaN(sd)) sd = 1;
    var cap = allowanceCap(goal);
    var curDays = weekDayIsos(DAY_ISO);
    var curSet = {};
    for (var ci = 0; ci < curDays.length; ci++) curSet[curDays[ci]] = 1;
    var byWeek = {};
    Object.keys(bag.days).forEach(function (iso) {
      if (curSet[iso]) return; /* current Sat→Fri stays as week stars */
      var taps = weekDayIsos(iso);
      var wk = taps[0] || iso; /* first tap day = week bank key */
      if (!byWeek[wk]) byWeek[wk] = { stars: 0, taps: taps };
      byWeek[wk].stars += (bag.days[iso] && bag.days[iso].stars) ? bag.days[iso].stars : 0;
    });
    var added = 0;
    Object.keys(byWeek).forEach(function (wk) {
      var stars = byWeek[wk].stars || 0;
      if (stars <= 0) return;
      var earn = Math.min(stars * sd, cap);
      bag.balance = (bag.balance || 0) + earn;
      added += earn;
      var taps = byWeek[wk].taps || [];
      for (var i = 0; i < taps.length; i++) {
        var iso = taps[i];
        if (bag.days[iso]) bag.days[iso] = { stars: 0, earned: {} };
      }
    });
    if (added) saveBankRoot(pack.root);
    return added;
  }

  function getBankView(kidId, data) {
    settlePriorWeeksIntoBalance(kidId, data);
    var pack = kidDayBank(kidId);
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || { need: 10, title: "Goal", blurb: "", reward: "" };
    var cur = kid.currency || (NO_STARS[kidId] ? { plural: "", symbol: "", label: "" } : { plural: "stars", symbol: "★", label: "Stars" }); /* CHORELAW3: no ★ fallback for Ainsley */
    var today = pack.day.stars || 0;
    /* Week star tally → jar / weekly allowance goal (existing need $ amounts) */
    var week = weekStarsFor(kidId);
    var life = pack.bag.lifetime || 0;
    var balance = typeof pack.bag.balance === "number" ? pack.bag.balance : (Number(pack.bag.balance) || 0);
    var weeklyAllowance = allowanceCap(goal);
    var starDollar = starDollarOf(goal);
    var weekEarn = Math.min(week * (isNaN(starDollar) ? 1 : starDollar), weeklyAllowance);
    var toward = Math.min(week, goal.need);
    var pct = goal.need ? Math.round((toward / goal.need) * 100) : 0;
    /* Available $ toward jar / personal saves = carry + this week's earn */
    var available = balance + weekEarn;
    var gate = mustProgress(kidId, data);
    /* MUSTGATE1 · jar fill only when full Must set is clear (week stars already scrubbed if locked) */
    var reached = !!gate.complete && weekEarn >= weeklyAllowance && weeklyAllowance > 0;
    if (!gate.complete) {
      week = 0;
      weekEarn = 0;
      toward = 0;
      pct = 0;
      available = balance;
      reached = false;
    }
    /* BINDFIX2 · never jar-full / JAR FULL CTA at $0 */
    if (!(weekEarn > 0 || toward > 0 || (balance > 0 && gate.complete))) {
      reached = false;
    }
    return {
      kidId: kidId,
      today: today,
      week: week,
      weekEarn: weekEarn,
      balance: balance,
      available: available,
      weeklyAllowance: weeklyAllowance,
      starDollar: isNaN(starDollar) ? 1 : starDollar,
      lifetime: life,
      need: goal.need,
      toward: toward,
      pct: Math.min(100, pct),
      reached: reached,
      mustGate: gate,
      mustComplete: !!gate.complete,
      goalTitle: goal.title,
      goalBlurb: goal.blurb,
      reward: goal.reward,
      currency: cur,
      dayIso: DAY_ISO,
      weekStart: weekStartIso(DAY_ISO),
      earned: Object.assign({}, pack.day.earned)
    };
  }

  function getCheckRaw(checkId, data, dayIso) {
    var r = resolveCheck(checkId);
    if (r.retired) return false; /* retired id: nothing renders it, nothing counts it */
    if (!r.kid && MUST_IDS[r.id]) return false; /* a must with no kid is never read from a shared key */
    var key = checkKeyFor(checkId, data, dayIso);
    var state = loadKeyState(key), has = Object.prototype.hasOwnProperty;
    if (has.call(state, r.id)) return !!state[r.id];
    /* CHORELAW3 carry-over: a checkoff saved under the old id (har-bed) on this kid/day counts for its must */
    for (var old in LEGACY_TO_MUST) {
      if (LEGACY_TO_MUST[old] === r.id && KID_FROM_CHECK[old] === r.kid && has.call(state, old)) {
        state[r.id] = !!state[old]; delete state[old]; saveKeyState(key, state); return !!state[r.id];
      }
    }
    if (r.kid && key !== CHECK_KEY) checkId = r.legacy || r.id;
    if (has.call(state, checkId)) return !!state[checkId];
    /* one-shot migrate from legacy flat key into day/week key (today only) */
    if (!MUST_IDS[r.id] && (!dayIso || dayIso === DAY_ISO)) {
      var legacy = loadChecks();
      if (Object.prototype.hasOwnProperty.call(legacy, checkId)) {
        state[checkId] = !!legacy[checkId];
        saveKeyState(key, state);
        return !!state[checkId];
      }
    }
    return false;
  }

  function getCheck(checkId, data, dayIso) {
    return getCheckRaw(checkId, data, dayIso);
  }

  function setCheck(checkId, done, data, dayIso) {
    var rc = resolveCheck(checkId), kidId = rc.kid;
    if (rc.retired || (!kidId && MUST_IDS[rc.id])) return null; /* CHORELAW3: no write for a retired / kid-less id */
    var meta = kidId
      ? questMeta(kidId, checkId, data || (global.WardKids && global.WardKids._data))
      : { cadence: "daily", stars: 0, optional: false };
    var before = kidId ? getBankView(kidId, data) : null;
    var was = before ? before.reached : false;
    var beforeGate = kidId ? mustSetComplete(kidId, data) : false;

    var key = checkKeyFor(checkId, data, dayIso);
    var state = loadKeyState(key);
    if (rc.legacy && rc.legacy !== rc.id) delete state[rc.legacy];
    state[rc.id] = !!done;
    saveKeyState(key, state);
    checkId = rc.id;
    /* keep legacy blob in sync for old readers (today / weekly only) */
    try {
      if (!MUST_IDS[checkId] && (!dayIso || dayIso === DAY_ISO || meta.cadence === "weekly")) { /* a must id is never written to the shared flat key */
        var legacy = loadChecks();
        if (!!done) legacy[checkId] = true;
        else delete legacy[checkId];
        saveChecks(legacy);
      }
    } catch (eL) { /* */ }

    var bank = null;
    var newlyBanked = false;
    if (kidId && !meta.optional) {
      bank = syncMustGateBank(kidId, data);
      var afterGate = mustSetComplete(kidId, data);
      newlyBanked = afterGate && !beforeGate;
    } else if (kidId) {
      bank = getBankView(kidId, data);
    }

    if (bank && bank.reached && !was) {
      try { localStorage.setItem("house-bank-goal:" + bank.kidId, "1"); } catch (e) {}
      try {
        document.dispatchEvent(new CustomEvent("house:goal-hit", { detail: { kidId: bank.kidId, reward: bank.reward, bank: bank } }));
      } catch (e) {}
    }
    /* Flash $ only when FULL Must set unlocks jar — existing allowance cap (1★=$1) */
    if (bank && newlyBanked) {
      try {
        var bucks = weekEarnDollars(kidId, data);
        if (bucks > 0) {
          document.dispatchEvent(new CustomEvent("house:earn", {
            detail: { kidId: kidId, dollars: bucks, checkId: checkId, bank: bank, mustGate: true }
          }));
        }
      } catch (eEarn) { /* */ }
    }
    return bank;
  }

  function syncBankFromChecks(data) {
    var seen = {};
    Object.keys(KID_FROM_CHECK).forEach(function (id) {
      var kidId = KID_FROM_CHECK[id];
      if (!kidId || seen[kidId]) return;
      seen[kidId] = 1;
      syncMustGateBank(kidId, data);
    });
  }

  function cardHTML(item) {
    var tone = item.tone || "act";
    var cls = "card " + tone;
    if (item.compact) cls += " compact";
    var tag = item.href ? "a" : "div";
    var hrefAttr = item.href ? ' href="' + esc(item.href) + '"' : "";
    var html = "<" + tag + ' class="' + cls + '"' + hrefAttr + ">";
    if (item.when) html += '<div class="when">' + esc(item.when) + "</div>";
    if (item.what) html += '<div class="what">' + esc(item.what) + "</div>";
    if (item.hint) html += '<div class="hint">' + esc(item.hint) + "</div>";
    html += "</" + tag + ">";
    return html;
  }

  function quietHTML(msg) {
    return '<div class="card quiet">' + esc(msg) + "</div>";
  }

  function questHTML(q, done, kidId, data) {
    var optional = !!(q.optional || q.cadence === "addon");
    var cadence = q.cadence || (optional ? "addon" : "daily");
    var stars = (optional || NO_STARS[kidId]) ? 0 : (typeof q.stars === "number" ? q.stars : 1); /* CHORELAW3: no stars on Ainsley's board */
    var weekPay = cadence === "daily" && !optional ? stars * dadWeekLen() : stars;
    var cid = qid(kidId, q.id); /* kid-qualified tap id (must-* ids are shared by all three kids) */
    var dayCount = 0;
    var weekDone = false;
    if (cadence === "daily" && !optional) {
      dayCount = dailyDoneCount(cid, data);
      weekDone = dayCount >= weekDayIsos(DAY_ISO).length;
      done = weekDone;
    }
    var open = done ? "done" : "open";
    var ring = done ? "✓" : (optional ? "+" : "·");
    /* KIDCHORES1 · musts = title + day checks only. Jar/payout lives once at board level. */
    var hint = "";
    var earn = "";
    if (optional) {
      if (q.hire && kidId === "ainsley") {
        hint = done
          ? "hire logged · Dad handout"
          : "hire path · Dad books you";
        earn = '<span class="star-earn addon-tag">' + (done ? "$15/hr ✓" : "$15/hr") + "</span>";
      } else {
        hint = done
          ? (q.hire ? "hire logged · booked" : "logged")
          : (q.hire ? "hire path · Dad books you" : "add-on");
        earn = '<span class="star-earn addon-tag">' + (done ? "OPTIONAL ✓" : "OPTIONAL") + "</span>";
      }
    }
    var optAttr = optional ? ' data-optional="1"' : "";
    var hireAttr = (optional && q.hire) ? ' data-hire="1"' : "";
    var cadAttr = ' data-cadence="' + esc(cadence) + '"';
    var softClass = optional ? " addon soft" : "";
    var dailyClass = (cadence === "daily" && !optional) ? " daily-week" : "";
    var starsAttr = NO_STARS[kidId] ? "" : ' data-stars="' + (cadence === "daily" && !optional ? weekPay : stars) + '"';

    if (cadence === "daily" && !optional) {
      var days = weekDayIsos(DAY_ISO);
      var taps = "";
      for (var di = 0; di < days.length; di++) {
        var iso = days[di];
        var dayOn = getCheck(cid, data, iso);
        var isToday = iso === DAY_ISO;
        var cls = "day-tap" + (dayOn ? " done" : "") + (isToday ? " is-today" : "");
        taps += '<button type="button" class="' + cls + '" data-check="' + esc(cid) + '" data-day-iso="' + esc(iso) +
          '" data-kid-quest="1" data-cadence="daily"' + starsAttr +
          ' aria-label="' + DOW_LONG[dowIndexFromIso(iso)] + " · " + esc(q.what) + '" aria-pressed="' + (dayOn ? "true" : "false") + '">' +
          DOW_SHORT[dowIndexFromIso(iso)] + "</button>";
      }
      return (
        '<div class="quest ' + open + softClass + dailyClass + '" data-quest-id="' + esc(q.id) + '" data-kid-quest="1"' +
        optAttr + hireAttr + cadAttr + starsAttr + ">" +
        '<div class="quest-body"><div class="what">' + esc(q.what) + "</div>" +
        '<div class="quest-days" role="group" aria-label="Days this week">' + taps + "</div></div>" +
        "</div>"
      );
    }

    var hintBlock = hint ? '<div class="hint">' + esc(hint) + "</div>" : "";
    return (
      '<div class="quest ' + open + softClass + '" data-check="' + esc(cid) + '" data-kid-quest="1"' + optAttr + hireAttr + cadAttr + starsAttr + ' role="button" tabindex="0">' +
      '<span class="ring">' + ring + "</span>" +
      '<div><div class="what">' + esc(q.what) + "</div>" + hintBlock + "</div>" +
      earn +
      "</div>"
    );
  }

  function renderList(el, items, emptyMsg) {
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = quietHTML(emptyMsg || "none on your board yet");
      return;
    }
    el.innerHTML = items.map(cardHTML).join("");
  }

  function renderQuests(el, quests, data, kidId) {
    if (!el) return;
    el.innerHTML = (quests || []).map(function (q) {
      var optional = !!(q.optional || q.cadence === "addon");
      var cadence = q.cadence || (optional ? "addon" : "daily");
      var done = cadence === "daily" && !optional
        ? dailyWeekComplete(qid(kidId, q.id), data)
        : getCheck(qid(kidId, q.id), data);
      return questHTML(q, done, kidId, data);
    }).join("");
  }

  /** Upgrade static sheet-chores rows: daily musts get Sat→Fri Dad-week taps. */
  function enhanceSharedChores(root, data) {
    root = root || document;
    data = data || (global.WardKids && global.WardKids._data);
    if (!data) return;
    var nodes = root.querySelectorAll(".chore[data-check], .quest[data-check]");
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.classList.contains("day-tap")) return;
      if (el.querySelector(".quest-days")) return;
      var id0 = el.getAttribute("data-check");
      if (!id0) return;
      var rc = resolveCheck(id0);
      if (!rc.kid) return;
      /* CHORELAW3: a retired old chore row (backpack, trash, shoes, ...) is hidden, never a dead tap;
         an old row that matches a must is re-pointed at the kid's must (same storage as the wall) */
      if (rc.retired) { el.hidden = true; el.setAttribute("data-chore-retired", ""); return; }
      var kidId = rc.kid, id = qid(kidId, rc.id);
      if (id !== id0) el.setAttribute("data-check", id);
      var meta = questMeta(kidId, id, data);
      el.setAttribute("data-cadence", meta.cadence);
      var nDays = dadWeekLen();
      if (NO_STARS[kidId]) el.removeAttribute("data-stars");
      else el.setAttribute("data-stars", String(meta.optional ? 0 : (meta.cadence === "daily" ? meta.stars * nDays : meta.stars)));
      if (meta.optional) {
        el.setAttribute("data-optional", "1");
        var earnOpt = el.querySelector(".star-earn");
        if (earnOpt && el.getAttribute("data-check") === "ain-babysit") {
          earnOpt.classList.add("addon-tag");
          earnOpt.textContent = "$15/hr";
          earnOpt.setAttribute("data-stars", "0");
        }
        return;
      }
      if (meta.cadence === "weekly") {
        /* KIDCHORES1 · no per-row $ / jar hint on musts */
        var earnW = el.querySelector(".star-earn");
        if (earnW && !earnW.classList.contains("addon-tag")) earnW.remove();
        var hintW = el.querySelector(".hint");
        if (hintW) hintW.remove();
        return;
      }
      if (meta.cadence !== "daily") return;

      var weekPay = meta.stars * nDays;
      var dayCount = dailyDoneCount(id, data);
      var weekDone = dayCount >= weekDayIsos(DAY_ISO).length;
      var whatEl = el.querySelector(".what");
      var what = whatEl ? whatEl.textContent : id;
      var days = weekDayIsos(DAY_ISO);
      var taps = document.createElement("div");
      taps.className = "quest-days";
      taps.setAttribute("role", "group");
      taps.setAttribute("aria-label", "Days this week");
      for (var di = 0; di < days.length; di++) {
        var iso = days[di];
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "day-tap" + (getCheck(id, data, iso) ? " done" : "") + (iso === DAY_ISO ? " is-today" : "");
        btn.setAttribute("data-check", id);
        btn.setAttribute("data-day-iso", iso);
        btn.setAttribute("data-kid-quest", "1");
        btn.setAttribute("data-cadence", "daily");
        if (!NO_STARS[kidId]) btn.setAttribute("data-stars", String(weekPay));
        btn.setAttribute("aria-label", DOW_LONG[dowIndexFromIso(iso)] + " · " + what);
        btn.setAttribute("aria-pressed", getCheck(id, data, iso) ? "true" : "false");
        btn.textContent = DOW_SHORT[dowIndexFromIso(iso)];
        taps.appendChild(btn);
      }
      var txt = el.querySelector(".txt") || el;
      var hint = el.querySelector(".hint");
      if (hint) hint.remove();
      var earn = el.querySelector(".star-earn");
      if (earn && !earn.classList.contains("addon-tag")) earn.remove();
      var kids = el.children;
      for (var ri = 0; ri < kids.length; ri++) {
        if (kids[ri].classList && kids[ri].classList.contains("ring")) {
          kids[ri].style.display = "none";
          break;
        }
      }
      el.classList.add("daily-week");
      el.classList.toggle("done", weekDone);
      el.classList.toggle("open", !weekDone);
      el.removeAttribute("role");
      el.removeAttribute("tabindex");
      /* Move data-check off the row so only day-taps toggle */
      el.setAttribute("data-quest-id", id);
      el.removeAttribute("data-check");
      if (txt && txt !== el) txt.appendChild(taps);
      else el.appendChild(taps);
    });
  }


  /** Next goal day = next Friday 6:00p America/Chicago (box TZ). Ledger default (CHORELAW1: no payday wording). */
  function nextPaydayInfo(now) {
    now = now || new Date();
    var day = now.getDay();
    var hours = now.getHours();
    var daysUntilFri = (5 - day + 7) % 7;
    if (daysUntilFri === 0 && hours >= 18) daysUntilFri = 7;
    var label;
    /* CHORELAW1: no payday wording (the jar pays time and picks, never cash) */
    if (daysUntilFri === 0) label = "Tonight · Fri goal day";
    else if (daysUntilFri === 1) label = "Tomorrow · Fri goal day";
    else label = daysUntilFri + " days · Fri goal day";
    return { days: daysUntilFri, label: label, when: "Fri evening CT", rule: "Next goal day = next Friday 6:00p CT" };
  }

  function getPaidStamp(kidId) {
    try { return localStorage.getItem("house-bank-paid:" + kidId) || ""; } catch (e) { return ""; }
  }

  /**
   * Payday / jar reset.
   * 1) Convert this week's stars into durable balance$ (capped by weeklyAllowance).
   * 2) Subtract what Dad paid (optional paidAmount; default 0 = full carry).
   * 3) Clear week star buckets. Never zeros lifetime (long save goals stay intact).
   */
  function resetJarCycle(kidId, paidAmount, data) {
    data = data || (global.WardKids && global.WardKids._data) || null;
    settlePriorWeeksIntoBalance(kidId, data);
    var pack = kidDayBank(kidId);
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || {};
    var week = weekStarsFor(kidId);
    var sd = starDollarOf(goal);
    if (isNaN(sd)) sd = 1;
    var cap = allowanceCap(goal);
    var weekEarn = Math.min(week * sd, cap);
    if (typeof pack.bag.balance !== "number") pack.bag.balance = Number(pack.bag.balance) || 0;
    /* Week stars → balance (survive rollover); unpaid stays as carry */
    pack.bag.balance = (pack.bag.balance || 0) + weekEarn;
    var paid = 0;
    if (paidAmount != null && paidAmount !== "") {
      paid = Math.max(0, Number(paidAmount));
      if (isNaN(paid)) paid = 0;
    }
    paid = Math.min(paid, pack.bag.balance);
    pack.bag.balance = Math.max(0, pack.bag.balance - paid);
    /* DO NOT zero lifetime — personal long saves use lifetime/balance separately */
    /* Clear this week's Sat→Fri tap-day star buckets so jar/week bar resets */
    var taps = weekDayIsos(DAY_ISO);
    for (var i = 0; i < taps.length; i++) {
      var iso = taps[i];
      if (pack.root[kidId] && pack.root[kidId].days) {
        pack.root[kidId].days[iso] = { stars: 0, earned: {} };
      }
    }
    saveBankRoot(pack.root);
    var bal = pack.bag.balance || 0;
    var stamp = paid > 0
      ? "Paid · carry kept" /* KIDPATH1: no $ on kid paths */
      : "Week reset · carry kept";
    try {
      localStorage.removeItem("house-bank-goal:" + kidId);
      localStorage.setItem("house-bank-paid:" + kidId, stamp);
      localStorage.setItem("house-bank-paid-at:" + kidId, new Date().toISOString());
      localStorage.setItem("house-bank-paid-amount:" + kidId, String(paid));
    } catch (e) {}
    return stamp;
  }

  function personalGoalView(kidId, data, bank) {
    var kid = data && data.kids && data.kids[kidId];
    var g = (kid && kid.goal) || {};
    var placeholder = g.placeholder || "Add a save on your board";
    var name = "";
    var need = 0;
    // Kid write-in saves win (HouseSaves localStorage) — first with ★ target, else first
    if (global.HouseSaves && typeof global.HouseSaves.list === "function") {
      try {
        var saves = global.HouseSaves.list(kidId) || [];
        var pick = null;
        for (var si = 0; si < saves.length; si++) {
          if (saves[si] && saves[si].need > 0) { pick = saves[si]; break; }
        }
        if (!pick && saves.length) pick = saves[0];
        if (pick && pick.name) {
          name = String(pick.name).trim();
          need = typeof pick.need === "number" ? pick.need : (parseInt(pick.need, 10) || 0);
        }
      } catch (eS) { /* */ }
    }
    if (!name) {
      need = typeof g.need === "number" ? g.need : 0;
      name = (g.name || "").trim();
    }
    if (!name || need <= 0) {
      return { active: false, placeholder: placeholder, name: name || "", need: need || 0, toward: 0, met: false };
    }
    /* Prefer durable balance$ (+ this week earn) for money carry; lifetime stars remain available */
    var money = 0;
    if (bank) {
      if (bank.balance != null || bank.weekEarn != null) {
        money = (Number(bank.balance) || 0) + (Number(bank.weekEarn) || 0);
      } else if (bank.available != null) {
        money = Number(bank.available) || 0;
      } else {
        money = Number(bank.lifetime || bank.toward || 0) || 0;
      }
    }
    var toward = Math.min(money, need);
    return { active: true, placeholder: placeholder, name: name, need: need, toward: toward, met: toward >= need, unit: NO_STARS[kidId] ? "" : "★" };
  }

  function buildNoSurprise(kid, data) {
    var bits = [];
    var cust = data && data.homeWeek;
    if (cust) bits.push({ kind: "house", when: "Now", what: "With " + (cust.with || "Dad") + (cust.place ? " @ " + cust.place : ""), hint: cust.throughLabel || cust.through || "", tone: "hot" });
    if (kid && kid.hottest) bits.push({ kind: "next", when: kid.hottest.when || "Next", what: kid.hottest.what || "Next up", hint: kid.hottest.where || "", tone: "hot" });
    (kid && kid.today || []).slice(0, 2).forEach(function (t) {
      bits.push({ kind: "today", when: t.when || "Today", what: t.what || "", hint: t.hint || "next 24h", tone: t.tone || "act" });
    });
    (kid && kid.appointments || []).forEach(function (a) {
      var when = (a.when || "").toLowerCase();
      // surface near-term appts (Sun/Mon/today-ish labels already in data)
      if (a.tone === "hot" || /sun|mon|today|tonight/.test(when)) {
        bits.push({ kind: "appt", when: a.when, what: a.what, hint: a.hint || "on your board", tone: a.tone || "hot" });
      }
    });
    // NOSURP2 · dedupe case-insensitive (hottest vs today repeat), drop today's past items
    var seen = {};
    var now = new Date();
    var dows = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    var todayDow = dows[now.getDay()];
    function pastToday(when) {
      var w = String(when || "").toLowerCase();
      var m = w.match(/(\d{1,2}):(\d{2})\s*(am|pm|a|p)?/);
      if (!m) return false;
      var isToday = /today|tonight/.test(w) || w.indexOf(todayDow) === 0 || new RegExp("^" + todayDow + "\\b").test(w);
      if (!isToday) return false;
      var h = Number(m[1]), mi = Number(m[2]), ap = m[3] || "";
      if (/^p/.test(ap) && h < 12) h += 12;
      else if (/^a/.test(ap) && h === 12) h = 0;
      else if (!ap && h >= 1 && h <= 6) h += 12;
      var t = new Date(now); t.setHours(h, mi, 0, 0);
      return now.getTime() > t.getTime() + 30 * 60000;
    }
    return bits.filter(function (b) {
      if (!b.what) return false;
      if (b.kind !== "house" && pastToday(b.when)) return false;
      var k = String(b.what).toLowerCase().replace(/\s+/g, " ").trim() + "|" + String(b.when || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    }).slice(0, 5);
  }

  function renderBank(root, bank) {
    if (!root || !bank) return;
    if (NO_STARS[bank.kidId]) { /* CHORELAW3: Ainsley's board has no star chips, counts or goal text */
      root.querySelectorAll("[data-bank-today], [data-bank-life], [data-bank-week], [data-bank-meta], [data-bank-left], [data-bank-sym], [data-bank-unit], [data-bank-need], [data-bank-toward]").forEach(function (el) { el.textContent = ""; });
      root.querySelectorAll(".bank-meta, [data-grow-meter]").forEach(function (el) { el.hidden = true; });
      root.querySelectorAll("[data-payday-copy]").forEach(function (el) { el.textContent = "Friday drop · pick with Dad after honest musts"; });
      return;
    }
    var sym = bank.currency.symbol || "★";
    var plural = bank.currency.plural || "stars";
    root.querySelectorAll("[data-bank-today]").forEach(function (el) {
      el.textContent = String(bank.today);
    });
    root.querySelectorAll("[data-bank-life]").forEach(function (el) {
      /* Week star tally drives the jar number */
      el.textContent = String(bank.week != null ? bank.week : bank.lifetime);
    });
    root.querySelectorAll("[data-bank-week]").forEach(function (el) {
      el.textContent = String(bank.week != null ? bank.week : bank.toward);
    });
    root.querySelectorAll("[data-bank-need]").forEach(function (el) {
      el.textContent = String(bank.need);
    });
    root.querySelectorAll("[data-bank-toward]").forEach(function (el) {
      el.textContent = String(bank.toward);
    });
    root.querySelectorAll("[data-bank-pct]").forEach(function (el) {
      el.textContent = bank.pct + "%";
    });
    root.querySelectorAll("[data-bank-fill]").forEach(function (el) {
      el.style.width = bank.pct + "%";
      el.classList.toggle("is-full", bank.reached);
    });
    root.querySelectorAll("[data-bank-goal-title]").forEach(function (el) {
      el.textContent = bank.goalTitle;
    });
    root.querySelectorAll("[data-bank-goal-blurb]").forEach(function (el) {
      el.textContent = bank.goalBlurb;
    });
    root.querySelectorAll("[data-bank-reward]").forEach(function (el) {
      el.textContent = bank.reward;
    });
    root.querySelectorAll("[data-bank-unit]").forEach(function (el) {
      el.textContent = plural;
    });
    root.querySelectorAll("[data-bank-symbol]").forEach(function (el) {
      el.textContent = sym;
    });
    var dollar = true; // House override 2026-09-27 · show $ deal on kid glass
    var bal = bank.balance != null ? bank.balance : 0;
    var we = bank.weekEarn != null ? bank.weekEarn : bank.toward;
    root.querySelectorAll("[data-bank-balance]").forEach(function (el) {
      el.textContent = String(bal);
    });
    root.querySelectorAll("[data-bank-week-earn]").forEach(function (el) {
      el.textContent = String(we);
    });
    root.querySelectorAll("[data-bank-available]").forEach(function (el) {
      el.textContent = String(bank.available != null ? bank.available : (bal + we));
    });
    root.querySelectorAll("[data-bank-allowance]").forEach(function (el) {
      el.textContent = String(bank.weeklyAllowance != null ? bank.weeklyAllowance : bank.need);
    });
    function bankMetaText() {
      if (dollar) {
        if (bank.mustComplete === false) {
          var g = bank.mustGate || { done: 0, need: 0 };
          return "Musts " + g.done + "/" + g.need; /* ALFREDP0-5 + KIDPATH1: no balance, no jar */
        }
        return "Musts clear"; /* KIDPATH1: no $ on kid paths */
      }
      return "week " + bank.toward + " / " + bank.need + " ★";
    }
    var metaTxt = bankMetaText();
    root.querySelectorAll("[data-bank-meta]").forEach(function (el) {
      el.textContent = metaTxt;
    });
    /* BINDFIX1 · also paint .bank-meta hosts that lack a child span */
    root.querySelectorAll(".bank-meta").forEach(function (el) {
      var span = el.querySelector("[data-bank-meta]");
      if (span) return;
      /* keep Today sibling; only replace leading text node / empty host */
      var first = el.firstChild;
      if (first && first.nodeType === 3) {
        first.textContent = metaTxt + " ";
      } else if (!el.querySelector(".bank-meta-today")) {
        el.textContent = metaTxt;
      }
    });
    var left = Math.max(0, bank.need - bank.toward);
    root.querySelectorAll("[data-bank-left]").forEach(function (el) {
      if (bank.reached) el.textContent = "Goal met";
      else if (dollar) el.textContent = ""; /* KIDPATH1: no $ left line */
      else el.textContent = left + " ★ to unlock";
    });
    root.querySelectorAll("[data-payday-chip]").forEach(function (el) {
      var info = nextPaydayInfo();
      el.textContent = "Next goal day · " + info.label.replace(/ · Fri goal day$/, " · Fri"); /* CHORELAW1 */
      el.setAttribute("title", info.rule);
    });
    root.querySelectorAll("[data-payday-copy]").forEach(function (el) {
      el.textContent = (bank.kidId === "ainsley")
        ? "Friday drop · pick with Dad after honest musts" /* CHORELAW1: no payday */
        : "Goal with Dad after honest musts"; /* WALLKIT9: Atlas's reward string (kid-copy.mjs), no Payday */
    });
    root.querySelectorAll("[data-bank-goal-blurb]").forEach(function (el) {
      // already set above from goalBlurb — ensure cash blurbs stick
      if (bank.goalBlurb) el.textContent = bank.goalBlurb;
    });
    root.querySelectorAll("[data-unlock-cta]").forEach(function (el) {
      var full = !!bank.reached && (Number(bank.toward) > 0 || Number(bank.weekEarn) > 0 || Number(bank.available) > 0);
      /* musts incomplete OR zero toward → never jar-full chrome */
      if (!bank.mustComplete || !(Number(bank.toward) > 0 || Number(bank.weekEarn) >= Number(bank.weeklyAllowance || bank.need || 0))) {
        full = false;
      }
      full = full && !!bank.reached;
      el.hidden = !full;
      if (full) {
        el.textContent = "Goal met · show Dad";
        el.classList.add("is-loud");
      } else {
        el.textContent = ""; /* never show saved $N at $0 */
        el.classList.remove("is-loud");
      }
    });
    var paid = getPaidStamp(bank.kidId);
    root.querySelectorAll("[data-paid-stamp]").forEach(function (el) {
      if (paid) { el.hidden = false; el.textContent = paid; }
      else { el.hidden = true; }
    });
    root.querySelectorAll("[data-got-it]").forEach(function (el) {
      var full = !!bank.reached && (Number(bank.toward) > 0 || Number(bank.weekEarn) > 0 || Number(bank.available) > 0);
      if (!bank.mustComplete || !(Number(bank.toward) > 0 || Number(bank.weekEarn) >= Number(bank.weeklyAllowance || bank.need || 0))) {
        full = false;
      }
      full = full && !!bank.reached;
      el.hidden = !full;
    });
    document.body.classList.toggle("bank-goal-hit", !!bank.reached);
    try {
      renderGrow(root, bank.kidId, global.WardKids && global.WardKids._data, bank);
    } catch (eG) { /* */ }
  }


  function growGoalView(kidId, data, bank) {
    /* JARMATH1 · the jar always shows the jar's real target (bankGoal), never a
     * personal save — those live on the Saves line only. */
    var gv = personalGoalView(kidId, data, bank);
    var kid = data && data.kids && data.kids[kidId];
    var bg = (kid && kid.bankGoal) || {};
    var need = typeof bg.dollarNeed === "number" ? bg.dollarNeed : (typeof bg.need === "number" ? bg.need : 0);
    var name = String(bg.title || "Goal").split("·")[0].trim() || "Goal";
    var money = 0;
    if (bank) {
      if (bank.available != null) money = Number(bank.available) || 0;
      else money = (Number(bank.balance) || 0) + (Number(bank.weekEarn) || 0);
    }
    if (need <= 0) {
      return { active: false, placeholder: (gv && gv.placeholder) || "Add a save", name: "", need: 0, toward: 0, met: false, unit: NO_STARS[kidId] ? "" : "★" };
    }
    var toward = Math.min(money, need);
    return { active: true, placeholder: "", name: name, need: need, toward: toward, met: toward >= need, unit: NO_STARS[kidId] ? "" : "★", fallback: true };
  }

  var GROW_THEME = {
    harris: { cls: "grow-gems", token: "◆", label: "GROW · gems" },
    hayes: { cls: "grow-coins", token: "◎", label: "GROW · victory coins" },
    ainsley: { cls: "grow-jar", token: "", label: "" } /* CHORELAW3: no star token on Ainsley's board */
  };

  function renderGrow(root, kidId, data, bank) {
    if (!root || !bank) return;
    if (NO_STARS[kidId]) { root.querySelectorAll("[data-grow-meter]").forEach(function (m) { m.hidden = true; }); return; } /* CHORELAW3 */
    var theme = GROW_THEME[kidId] || GROW_THEME.harris;
    var gv = growGoalView(kidId, data || (global.WardKids && global.WardKids._data), bank);
    var bal = bank.balance != null ? Number(bank.balance) || 0 : 0;
    var we = bank.weekEarn != null ? Number(bank.weekEarn) || 0 : 0;
    var available = bank.available != null ? Number(bank.available) || 0 : (bal + we);
    var need = gv.active ? gv.need : 0;
    var toward = gv.active ? gv.toward : Math.min(available, need || available);
    var pct = need > 0 ? Math.max(0, Math.min(100, Math.round((toward / need) * 100))) : 0;

    root.querySelectorAll("[data-grow-meter]").forEach(function (meter) {
      meter.classList.remove("grow-gems", "grow-coins", "grow-jar");
      meter.classList.add("grow-meter", theme.cls);
      meter.setAttribute("data-kid", kidId);
      meter.setAttribute("aria-label", theme.label + (gv.active ? (" · " + gv.name) : ""));
      if (!meter._growWired) {
        meter._growWired = true;
        meter.addEventListener("click", function () {
          /* HouseSfx.wireGrowFx owns pointerdown poke — click = a11y fallback only */
          if (window.HouseSfx && HouseSfx.jarPoke) return;
          meter.classList.remove("is-animating", "is-poking");
          void meter.offsetWidth;
          meter.classList.add("is-animating", "is-poking");
          setTimeout(function () { meter.classList.remove("is-animating", "is-poking"); }, 750);
        });
      }
      if (window.HouseSfx && HouseSfx.wireGrowFx) HouseSfx.wireGrowFx();
    });

    var balPct = need > 0 ? Math.max(0, Math.min(100, (bal / need) * 100)) : 0;
    var weekPct = need > 0 ? Math.max(0, Math.min(100 - balPct, (we / need) * 100)) : 0;
    var jarHit = !!(gv.active && gv.met && bank.mustComplete !== false && (toward > 0));
    root.querySelectorAll("[data-grow-fill]").forEach(function (el) {
      el.style.height = pct + "%";
      el.classList.toggle("is-full", jarHit);
    });
    root.querySelectorAll("[data-grow-fill-balance]").forEach(function (el) {
      el.style.height = balPct + "%";
      el.style.bottom = "0%";
    });
    root.querySelectorAll("[data-grow-fill-week]").forEach(function (el) {
      el.style.height = weekPct + "%";
      el.style.bottom = balPct + "%";
    });
    root.querySelectorAll("[data-grow-pct]").forEach(function (el) {
      el.textContent = pct + "%";
    });
    root.querySelectorAll("[data-grow-title]").forEach(function (el) {
      el.textContent = theme.label;
    });
    root.querySelectorAll("[data-grow-jar-name]").forEach(function (el) {
      el.textContent = gv.active ? (gv.fallback ? gv.name : gv.name) : (theme.label.split("·")[0].trim() || "Goal");
      if (gv.active && !gv.fallback) {
        /* keep jar brand from theme when personal save is active — show save in Save for line */
        var brands = { harris: "Gems", hayes: "Victory Coins", ainsley: "Tour goal" };
        el.textContent = brands[kidId] || gv.name;
      } else if (gv.active) {
        el.textContent = gv.name;
      }
    });
    root.querySelectorAll("[data-grow-total]").forEach(function (el) {
      /* HTML already prints $ before the span inside .grow-total */
      el.textContent = (el.closest && el.closest(".grow-total")) ? String(toward) : String(toward);
    });
    root.querySelectorAll("[data-grow-week-rising]").forEach(function (el) {
      el.textContent = "week rising ↑";
    });
    root.querySelectorAll("[data-grow-goal-lab]").forEach(function (el) {
      el.textContent = need > 0 ? ("GOAL " + need) : "GOAL";
    });
    root.querySelectorAll("[data-grow-balance]").forEach(function (el) {
      el.textContent = ""; /* KIDPATH1: no balance on kid paths */
    });
    root.querySelectorAll("[data-grow-week]").forEach(function (el) {
      el.textContent = ""; /* KIDPATH1: no $ on kid paths */
    });
    root.querySelectorAll("[data-grow-save-name]").forEach(function (el) {
      el.textContent = gv.active ? gv.name : (gv.placeholder || "Add a save");
    });
    root.querySelectorAll("[data-grow-save-toward]").forEach(function (el) {
      el.textContent = String(gv.active ? toward : 0);
    });
    root.querySelectorAll("[data-grow-save-need]").forEach(function (el) {
      var n = gv.active ? need : 0;
      /* HTML already prints $ before both spans inside .grow-total — bare digits only */
      el.textContent = String(n);
    });
    root.querySelectorAll("[data-grow-save-line]").forEach(function (el) {
      if (!gv.active) el.textContent = gv.placeholder || "Add a save";
      else el.textContent = gv.name + " · " + toward + "/" + need;
    });

    /* Stack tokens scale with fill (max 8) */
    var n = need > 0 ? Math.max(0, Math.min(8, Math.ceil((pct / 100) * 8))) : 0;
    root.querySelectorAll("[data-grow-icons]").forEach(function (box) {
      var html = "";
      for (var i = 0; i < n; i++) {
        html += '<span class="grow-token" style="animation-delay:' + (i * 0.04) + 's">' + theme.token + "</span>";
      }
      box.innerHTML = html;
    });
  }

  function renderPersonalGoal(root, kidId, data, bank) {
    if (!root) return;
    var gv = personalGoalView(kidId, data, bank);
    root.querySelectorAll("[data-goal-chip]").forEach(function (el) {
      el.classList.remove("is-met", "is-active", "is-empty");
      if (!gv.active) {
        el.textContent = gv.placeholder;
        el.classList.add("is-empty");
      } else if (gv.met) {
        el.textContent = "Tell Dad — goal met · " + gv.name;
        el.classList.add("is-met", "is-active");
      } else {
        el.textContent = gv.name + " · " + gv.toward + "/" + gv.need;
        el.classList.add("is-active");
      }
    });
    try { renderGrow(root, kidId, data, bank || getBankView(kidId, data)); } catch (ePG) { /* */ }
  }

  function renderHarborStrips(kidId, data) {
    var kid = data.kids[kidId];
    if (!kid) return;
    var ns = document.querySelector("[data-mount-no-surprise]");
    if (ns) {
      var items = buildNoSurprise(kid, data);
      ns.innerHTML = items.length
        ? items.map(cardHTML).join("")
        : quietHTML(kidId === "ainsley" ? "side quiet · drop the needle on musts" : "quiet board · check musts");
    }
    var rides = document.querySelector("[data-mount-rides]");
    if (rides) {
      var list = kid.rides || [];
      rides.innerHTML = list.length
        ? list.map(function (r) {
            var tone = r.clear ? "fun" : "act";
            return cardHTML({ when: r.when || (r.clear ? "you're clear" : "check timing"), what: r.what, hint: r.hours || (r.clear ? "your move · no conflict flagged" : "ask Dad"), tone: tone });
          }).join("")
        : quietHTML("rides land here when set");
    }
    var bag = document.querySelector("[data-bag-strip]");
    if (bag && kid.bag) {
      bag.hidden = false;
      var lab = bag.querySelector("[data-bag-label]");
      var hint = bag.querySelector("[data-bag-hint]");
      if (lab) lab.textContent = kid.bag.label || ("This week @ " + (kid.bag.place || "Dad") + " · bag");
      if (hint) hint.textContent = kid.bag.hint || "";
    } else if (bag) {
      bag.hidden = false;
      var lab2 = bag.querySelector("[data-bag-label]");
      if (lab2) lab2.textContent = "Bag for Dad week";
    }
    var her = document.querySelector("[data-mount-her-space]");
    if (her) {
      var space = [];
      (kid.appointments || []).forEach(function (a) {
        if (a.herSpace || /vanity|jessy|room/i.test((a.what || "") + (a.hint || ""))) {
          space.push({ when: a.when, what: a.what, hint: a.hint || "your space", tone: a.tone || "hot" });
        }
      });
      // room reset quest as light status if present
      (kid.quests || []).forEach(function (q) {
        if (q.id === "ain-toys" || /room reset/i.test(q.what || "")) {
          var done = getCheck(qid(kidId, q.id));
          space.push({ when: "Room", what: done ? "Room reset · clear" : "Room reset · still open", hint: "your space · your pace", tone: done ? "fun" : "act" });
        }
      });
      her.innerHTML = space.length ? space.map(cardHTML).join("") : quietHTML(kidId === "ainsley" ? "her space · needle up" : "your space · quiet");
    }
  }



  /* GRAPHICS2 · forged SVG marks (sprite must be inlined on kid boards) */
  function g2Ico(sym) {
    return '<svg class="g2" viewBox="0 0 32 32" aria-hidden="true"><use href="#' + sym + '"/></svg>';
  }
  /* CONSUME1 · schedule consume layout (week strip · NEXT UP · HQ · routine · ahead) */
  var CONSUME_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var CONSUME_META = {
    hayes: { world: "Victory world", loadout: "Victory loadout", markSym: "g2-hayes", hqTitle: "DROP ZONE HQ with Dad", hqSym: "g2-home" },
    harris: { world: "Gem world", loadout: "Gem loadout", markSym: "g2-harris", hqTitle: "YOUR BASE with Dad", hqSym: "g2-home" },
    ainsley: { world: "Ainsley", loadout: "Musts", markSym: "g2-ainsley", hqTitle: "Home base · with Dad", hqSym: "g2-home" }
  };

  /* HUBSCROLL1 · daily SPECIAL — sourced only, never invented.
     Hayes: Ms. Allen ParentSquare / cal PE note (“Specials: Mon Art, Tue Spanish, Wed Music, Thu PE, Fri Art”).
     Harris: Kysa cal PE notes only (Thu PE · tennis shoes) — no weekly rotation in source. */
  var SRE_SPECIALS = {
    hayes: {
      source: "Ms. Allen · ParentSquare / cal PE note",
      Mon: "Art",
      Tue: "Spanish",
      Wed: "Music",
      Thu: "PE · tennis shoes",
      Fri: "Art"
    },
    harris: {
      source: "Kysa · cal PE notes",
      Thu: "PE · tennis shoes"
    }
  };

  function specialForIso(kidId, iso) {
    var map = SRE_SPECIALS[kidId];
    if (!map || !iso) return null;
    var dow = CONSUME_DOW[dowIndexFromIso(iso)];
    if (!dow || !map[dow]) return null;
    return {
      when: dow + " · Special",
      what: "Special · " + map[dow],
      hint: map.source || "",
      tone: "act",
      kind: "special"
    };
  }

  function kidsSafeGlass(s) {
    var t = String(s == null ? "" : s);
    t = t.replace(/\bCUSTODY\b/gi, "WITH DAD");
    t = t.replace(/\bcustody\b/gi, "Dad week");
    return t;
  }

  function addDaysIsoLocal(iso, days) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return "";
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function mondayOfIso(iso) {
    var parts = String(iso || DAY_ISO).split("-");
    if (parts.length !== 3) return DAY_ISO;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    var toMon = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - toMon);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function consumeIsRoutine(item) {
    var what = String((item && item.what) || "");
    var when = String((item && item.when) || "");
    var blob = what + " " + when;
    if (/Hearing\s*\/?\s*Vision|field\s*trip|PE\b|collab|Homework Help|yearbook|appointment|swim|flag|baseball|game|practice/i.test(what)) {
      if (!/SRE\s*(drop|pickup|drop-off)/i.test(what)) return false;
    }
    if (/SRE\s*(drop-?off|drop|pickup)/i.test(what)) return true;
    if (/^(Boys\s+)?SRE\s+(drop|pickup)/i.test(what)) return true;
    if (/\bdrop-?off\b/i.test(what) && /SRE|Boys/i.test(blob)) return true;
    if (/\bpickup\b/i.test(what) && /SRE|Boys/i.test(blob)) return true;
    return false;
  }

  function consumeIsHq(item) {
    if (!item) return false;
    if (item.kind === "note") return true;
    var what = String(item.what || "");
    return /DROP ZONE HQ|YOUR BASE|Base @|with Dad|Dad week|147th/i.test(what) && /All day|home|HQ|BASE|Dad/i.test((item.when || "") + " " + what);
  }

  function consumeParseWhen(when) {
    var s = String(when || "").trim();
    var out = { dow: "", dayNum: "", time: "", leave: false, raw: s };
    var m = s.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b(?:\s+(\d{1,2}))?/i);
    if (m) {
      out.dow = m[1].slice(0, 1).toUpperCase() + m[1].slice(1, 3).toLowerCase();
      if (m[2]) out.dayNum = String(Number(m[2]));
    }
    var t = s.match(/(?:leave\s*)?(\d{1,2}:\d{2})\s*(am|pm)?/i);
    if (t) {
      out.time = t[1];
      out.leave = /leave/i.test(s);
      if (t[2]) out.time += t[2].toLowerCase();
    }
    return out;
  }

  /* AUDIT1 · "4:55" / "7:00am" → minutes after midnight CT (kid-schedule hours 1–6 read as pm) */
  function consumeTimeMin(t) {
    var m = /^(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(String(t || ""));
    if (!m) return null;
    var h = +m[1] % 12;
    if (m[3]) { if (/pm/i.test(m[3])) h += 12; }
    else if (+m[1] === 12 || +m[1] <= 6) h += 12;
    return h * 60 + (+m[2]);
  }
  function consumeNowCtMin() {
    try {
      var p = {};
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      return (+p.hour % 24) * 60 + (+p.minute);
    } catch (e) { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  }

  function consumeIsoForParsed(parsed, weekIsos) {
    if (!parsed) return "";
    if (parsed.dayNum) {
      for (var i = 0; i < weekIsos.length; i++) {
        var dn = String(Number(weekIsos[i].split("-")[2]));
        if (dn === parsed.dayNum) return weekIsos[i];
      }
    }
    if (parsed.dow) {
      for (var j = 0; j < weekIsos.length; j++) {
        if (CONSUME_DOW[dowIndexFromIso(weekIsos[j])] === parsed.dow) return weekIsos[j];
      }
    }
    return "";
  }

  function consumeCollectEvents(kid) {
    var list = [];
    function push(arr, bucket) {
      (arr || []).forEach(function (it) {
        if (!it || !it.what) return;
        list.push({
          when: it.when || "",
          what: kidsSafeGlass(it.what),
          hint: kidsSafeGlass(it.hint || ""),
          tone: it.tone || "act",
          kind: it.kind || bucket,
          bucket: bucket
        });
      });
    }
    push(kid.today, "today");
    push(kid.sports, "sports");
    push(kid.school, "school");
    push(kid.appointments, "appointments");
    /* Daily SPECIAL into school strip · sourced rotation only */
    var kidId = kid && kid.id;
    if (kidId && SRE_SPECIALS[kidId]) {
      var weekStart = mondayOfIso(DAY_ISO);
      for (var si = 0; si < 7; si++) {
        var iso = addDaysIsoLocal(weekStart, si);
        var sp = specialForIso(kidId, iso);
        if (!sp) continue;
        /* Stamp day num so consumeParseWhen buckets correctly */
        var dow = CONSUME_DOW[dowIndexFromIso(iso)];
        var dn = String(Number(String(iso).split("-")[2]));
        list.push({
          when: dow + " " + dn + " · Special",
          what: kidsSafeGlass(sp.what),
          hint: kidsSafeGlass(sp.hint || ""),
          tone: "act",
          kind: "special",
          bucket: "school"
        });
      }
    }
    return list;
  }

  function consumeEventIcon(what) {
    var w = String(what || "").toLowerCase();
    if (/baseball|ball/.test(w)) return { html: '<span class="g2-lead">' + g2Ico("g2-baseball") + "</span>", text: "" };
    if (/flag/.test(w)) return { html: '<span class="g2-lead">' + g2Ico("g2-flag") + "</span>", text: "" };
    if (/swim/.test(w)) return { html: '<span class="g2-lead">' + g2Ico("g2-swim") + "</span>", text: "" };
    if (/hearing|vision|screening/.test(w)) return { html: "", text: "👁️" };
    if (/field\s*trip|museum/.test(w)) return { html: "", text: "🚌" };
    if (/special|\bart\b|spanish|music/.test(w)) return { html: "", text: "🎨" };
    if (/\bpe\b|tennis/.test(w)) return { html: "", text: "👟" };
    if (/collab|madi|provider/.test(w)) return { html: "", text: "👥" };
    if (/anxiety|midwest|doctor|appt/.test(w)) return { html: "", text: "🩺" };
    if (/homework|yearbook|school|lkms|sre/.test(w)) return { html: "", text: "📚" };
    return { html: '<span class="g2-lead">' + g2Ico("g2-next") + "</span>", text: "" };
  }

  function consumeStripKidName(what, kid) {
    var w = String(what || "");
    if (!kid) return w;
    var re = new RegExp("^" + kid.name + "\\s*[—\\-·]\\s*", "i");
    w = w.replace(re, "");
    re = new RegExp("^" + kid.name + "\\s+", "i");
    /* keep sports titles like "Hayes baseball" */
    if (/baseball|flag|swim/i.test(w)) return w;
    return w.replace(re, "");
  }

  function consumeQueueForKid(data, kidId) {
    var kid = data.kids[kidId];
    var q = (data.boardStrip && data.boardStrip.queue) || [];
    var name = (kid && kid.name) || kidId;
    var out = [];
    for (var i = 0; i < q.length; i++) {
      var item = q[i];
      var blob = ((item.summary || "") + " " + (item.place || "")).toLowerCase();
      var mine = false;
      if (kidId === "hayes") mine = /hayes/.test(blob) || (/boys|sre/.test(blob) && !/ainsley|harris flag|harris —/.test(blob));
      else if (kidId === "harris") mine = /harris/.test(blob) || (/boys|sre/.test(blob) && !/ainsley|hayes baseball|hayes flag|hayes —|madi/.test(blob));
      else if (kidId === "ainsley") mine = /ainsley/.test(blob);
      /* shared boys SRE counts for both */
      if ((kidId === "hayes" || kidId === "harris") && /hayes \+ harris|boys sre|sre (drop|pickup|hearing)/i.test(blob)) mine = true;
      if (kidId === "hayes" && /madi|provider collab/i.test(blob)) mine = true;
      if (!mine && kidId === "ainsley" && /appointment/i.test(blob)) mine = true;
      if (!mine) continue;
      /* QARELAY1 · RIDES law: Dad logistics (kind leave/ride, "Pick up …"/"Drop …") never kid NEXT UP */
      if (item.kind === "leave" || item.kind === "ride") continue;
      if (/^(Pick\s*-?\s*up|Drop)\b/i.test(String(item.summary || item.place || "").trim())) continue;
      out.push(item);
    }
    return out;
  }

  function consumePickNext(data, kidId, kid) {
    var now = Date.now();
    var queue = consumeQueueForKid(data, kidId);
    for (var i = 0; i < queue.length; i++) {
      var it = queue[i];
      var end = Date.parse(it.endIso || "") || 0;
      var start = Date.parse(it.startIso || "") || 0;
      if (end && end < now) continue;
      if (!end && start && start + 90 * 60 * 1000 < now) continue;
      if (consumeIsRoutine({ what: it.place || it.summary || "" }) && queue.length > 1) {
        /* Prefer unique over routine when another future unique exists */
        var hasUniqueLater = false;
        for (var j = i; j < queue.length; j++) {
          var jt = queue[j];
          var js = Date.parse(jt.startIso || "") || 0;
          var je = Date.parse(jt.endIso || "") || 0;
          if (je && je < now) continue;
          if (!je && js && js + 90 * 60 * 1000 < now) continue;
          if (!consumeIsRoutine({ what: jt.place || jt.summary || "" })) { hasUniqueLater = true; break; }
        }
        if (hasUniqueLater && start && start > now + 45 * 60 * 1000) continue;
      }
      return {
        whenLabel: (it.badge ? String(it.badge).toUpperCase() : "") + (it.time ? (" · " + it.time) : ""),
        time: it.time || "",
        badge: it.badge || "",
        title: kidsSafeGlass(it.place || shortConsumeTitle(it.summary) || "Next up"),
        summary: kidsSafeGlass(it.summary || ""),
        startIso: it.startIso || "",
        endIso: it.endIso || "",
        kind: it.kind || "",
        source: "queue"
      };
    }
    /* Fallback: kid hottest / first unique timed event */
    var events = consumeCollectEvents(kid).filter(function (e) {
      return !consumeIsHq(e) && !consumeIsRoutine(e);
    });
    if (events.length) {
      var e0 = events[0];
      var p = consumeParseWhen(e0.when);
      return {
        whenLabel: ((p.dow || "").toUpperCase() + (p.time ? (" · " + p.time) : "")).replace(/^\s·\s/, ""),
        time: p.time || "",
        badge: p.dow || "",
        title: e0.what,
        summary: e0.hint || "",
        startIso: "",
        endIso: "",
        kind: e0.bucket,
        source: "kid"
      };
    }
    if (kid.hottest) {
      return {
        whenLabel: String(kid.hottest.when || ""),
        time: "",
        badge: "",
        title: kidsSafeGlass(kid.hottest.what || "Next up"),
        summary: kidsSafeGlass(kid.hottest.where || ""),
        startIso: "",
        endIso: "",
        kind: "hot",
        source: "hottest"
      };
    }
    return null;
  }

  function shortConsumeTitle(summary) {
    var s = String(summary || "");
    s = s.replace(/\s·\s.*$/, "").trim();
    return s;
  }

  function consumeCountdown(next) {
    if (!next) return "";
    var start = Date.parse(next.startIso || "") || 0;
    if (!start) {
      if (/today/i.test(next.source || "") || (next.badge && /mon|tue|wed|thu|fri|sat|sun/i.test(next.badge))) {
        return "ON DECK";
      }
      return "NEXT";
    }
    var mins = Math.round((start - Date.now()) / 60000);
    if (mins <= 5) return "LEAVE · NOW";
    if (mins <= 45) return "LEAVE · " + mins + "m";
    if (mins <= 120) return "LEAVE · " + Math.round(mins / 5) * 5 + "m";
    try {
      var p = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        weekday: "short", hour: "numeric", minute: "2-digit", hour12: true
      }).formatToParts(new Date(start)).forEach(function (x) {
        if (x.type !== "literal") p[x.type] = x.value;
      });
      return (p.weekday || "").toUpperCase().slice(0, 3) + " · " + (p.hour || "") + ":" + (p.minute || "");
    } catch (e) {
      return "UPCOMING";
    }
  }

  function consumeThruChip(through) {
    var t = String(through || "");
    var m = t.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
    if (m) return "THRU " + m[1].toUpperCase().slice(0, 3);
    return "DAD WEEK";
  }

  function renderConsumeSchedule(kidId, data) {
    var root = document.querySelector(".sec-schedule.consume-sched");
    if (!root || !data || !data.kids || !data.kids[kidId]) return;
    var kid = data.kids[kidId];
    var meta = CONSUME_META[kidId] || CONSUME_META.hayes;
    var weekStart = mondayOfIso(DAY_ISO);
    var weekIsos = [];
    for (var i = 0; i < 7; i++) weekIsos.push(addDaysIsoLocal(weekStart, i));

    var selected = root.getAttribute("data-consume-sel") || DAY_ISO;
    if (weekIsos.indexOf(selected) < 0) selected = DAY_ISO;

    var all = consumeCollectEvents(kid);
    var unique = all.filter(function (e) { return !consumeIsRoutine(e) && !consumeIsHq(e); });

    /* Dedupe by what+day */
    var seen = {};
    unique = unique.filter(function (e) {
      var p = consumeParseWhen(e.when);
      var iso = consumeIsoForParsed(p, weekIsos) || e.when + "|" + e.what;
      var key = iso + "::" + String(e.what).toLowerCase().replace(/\s+/g, " ");
      if (seen[key]) return false;
      seen[key] = 1;
      return true;
    });

    var byIso = {};
    weekIsos.forEach(function (iso) { byIso[iso] = []; });
    unique.forEach(function (e) {
      var p = consumeParseWhen(e.when);
      var iso = consumeIsoForParsed(p, weekIsos);
      if (iso && byIso[iso]) byIso[iso].push({ e: e, p: p });
      else if (!p.dayNum && !p.dow && e.bucket === "today") {
        if (byIso[DAY_ISO]) byIso[DAY_ISO].push({ e: e, p: p });
      }
    });

    /* Header */
    var hdr = root.querySelector("[data-mount-consume-hdr]");
    if (hdr) {
      hdr.innerHTML =
        '<div class="consume-mark g2-mark">' + g2Ico(meta.markSym || "g2-next") + "</div>" +
        '<div class="consume-hdr-text">' +
        '<div class="consume-title">' + esc(kid.name) + " · Schedule</div>" +
        '<div class="consume-sub">Loadout · ' + esc(meta.world) + "</div>" +
        "</div>";
    }

    /* Week strip */
    var weekEl = root.querySelector("[data-mount-consume-week]");
    if (weekEl) {
      var wh = "";
      weekIsos.forEach(function (iso) {
        var dow = CONSUME_DOW[dowIndexFromIso(iso)];
        var dn = String(Number(iso.split("-")[2]));
        var bits = byIso[iso] || [];
        var sel = iso === selected ? " sel" : "";
        var dots = "";
        if (bits.length >= 2) dots = '<span class="consume-dot"></span><span class="consume-dot cyan"></span>';
        else if (bits.length === 1) dots = '<span class="consume-dot cyan"></span>';
        else dots = '<span class="consume-dot muted"></span>';
        wh += '<button type="button" class="consume-day' + sel + '" data-consume-day="' + esc(iso) + '" aria-pressed="' + (iso === selected ? "true" : "false") + '">' +
          '<span class="wd">' + dow + "</span>" +
          '<span class="dn">' + dn + "</span>" +
          '<div class="dots">' + dots + "</div></button>";
      });
      weekEl.innerHTML = wh;
      if (!weekEl._consumeWired) {
        weekEl._consumeWired = true;
        weekEl.addEventListener("click", function (ev) {
          var btn = ev.target.closest("[data-consume-day]");
          if (!btn) return;
          root.setAttribute("data-consume-sel", btn.getAttribute("data-consume-day"));
          renderConsumeSchedule(kidId, data);
        });
      }
    }

    /* NEXT UP */
    var next = consumePickNext(data, kidId, kid);
    var nextMount = root.querySelector("[data-mount-consume-next]");
    if (nextMount) {
      if (!next) {
        nextMount.className = "consume-hero empty";
        nextMount.innerHTML = '<div class="consume-hero-inner"><div class="consume-hero-title">Nothing timed next</div><div class="consume-hero-meta">Quests + Dad week still on</div></div>';
      } else {
        var cd = consumeCountdown(next);
        var title = consumeStripKidName(next.title, kid);
        var ico = consumeEventIcon(title);
        nextMount.className = "consume-hero";
        nextMount.innerHTML =
          '<div class="consume-hero-inner">' +
          '<div class="consume-hero-top">' +
          '<div class="consume-hero-when">' + esc(next.whenLabel || "NEXT") + "</div>" +
          '<div class="consume-countdown"><span class="pulse"></span><span>' + esc(cd) + "</span></div>" +
          "</div>" +
          '<div class="consume-hero-title">' + (ico.html || "") + esc(((ico.text ? ico.text + " " : "") + title)) + "</div>" +
          '<div class="consume-hero-meta">YOUR board · <b>' + esc(meta.loadout) + "</b></div>" +
          "</div>";
      }
    }

    /* Today label + HQ punch */
    var selDow = CONSUME_DOW[dowIndexFromIso(selected)];
    var selDn = String(Number(selected.split("-")[2]));
    var todayLab = root.querySelector("[data-mount-consume-today-label]");
    if (todayLab) {
      var lab = selected === DAY_ISO ? ("Today · " + selDow + " " + selDn) : (selDow + " " + selDn);
      todayLab.innerHTML = '<span class="tag">' + esc(lab) + '</span><span class="line"></span>';
    }

    var punch = root.querySelector("[data-mount-consume-punch]");
    if (punch) {
      var hw = data.homeWeek || {};
      var through = kidsSafeGlass(hw.through || hw.throughLabel || "Dad week");
      var place = hw.place ? (" @ " + hw.place) : "";
      var sub = "Multi-day · " + through + (hw.with ? "" : "");
      if (hw.with && hw.place) sub = "Multi-day · through " + through;
      punch.innerHTML =
        '<div class="consume-punch-card">' +
        '<div class="consume-punch-ico g2-mark">' + g2Ico(meta.hqSym || "g2-home") + "</div>" +
        '<div class="consume-punch-body">' +
        '<div class="consume-punch-title">' + esc(meta.hqTitle) + "</div>" +
        '<div class="consume-punch-sub">' + esc(kidsSafeGlass(sub)) + "</div>" +
        "</div>" +
        '<div class="consume-punch-chip">' + esc(consumeThruChip(through)) + "</div>" +
        "</div>";
    }

    /* Routine rail */
    var routine = root.querySelector("[data-mount-consume-routine]");
    if (routine) {
      var lb = data.leaveBys || {};
      var drop = String(lb.SRE_drop || "leave 8:10 for 8:25");
      var pick = String(lb.SRE_pickup || "leave 3:15 for 3:40");
      var dropT = (drop.match(/(\d{1,2}:\d{2})/) || [])[1] || "8:10";
      var pickT = (pick.match(/(\d{1,2}:\d{2})/) || [])[1] || "3:15";
      if (kidId === "ainsley") {
        var swimDays = unique.filter(function (e) { return /swim/i.test(e.what); });
        if (swimDays.length >= 2) {
          routine.hidden = false;
          routine.innerHTML =
            '<span class="consume-routine-ico g2-inline">' + g2Ico("g2-routine") + "</span>" +
            '<div class="consume-routine-txt"><b>Swim</b> · leave 4:25 · Coach Ann</div>' +
            '<span class="consume-routine-badge">Tue/Thu</span>';
        } else if (swimDays.length === 1) {
          routine.hidden = true;
          routine.innerHTML = "";
        } else {
          routine.hidden = true;
          routine.innerHTML = "";
        }
      } else {
        var hasSre = all.some(consumeIsRoutine);
        if (hasSre) {
          routine.hidden = false;
          routine.innerHTML =
            '<span class="consume-routine-ico g2-inline">' + g2Ico("g2-routine") + "</span>" +
            '<div class="consume-routine-txt"><b>SRE</b> · drop ' + esc(dropT) + " · pickup " + esc(pickT) + "</div>" +
            '<span class="consume-routine-badge">Tue–Fri</span>';
        } else {
          routine.hidden = true;
          routine.innerHTML = "";
        }
      }
    }

    /* Ahead · unique (not next, not routine, preferably after selected/today) */
    var ahead = root.querySelector("[data-mount-consume-ahead]");
    if (ahead) {
      var nextKey = next ? String(next.title || "").toLowerCase().replace(/\s+/g, " ") : "";
      var rows = [];
      weekIsos.forEach(function (iso) {
        if (iso < selected) return;
        (byIso[iso] || []).forEach(function (pack) {
          var e = pack.e;
          var p = pack.p;
          var titleKey = String(e.what || "").toLowerCase().replace(/\s+/g, " ");
          if (nextKey && (titleKey.indexOf(nextKey.slice(0, 18)) >= 0 || nextKey.indexOf(titleKey.slice(0, 18)) >= 0)) {
            if (iso === DAY_ISO || iso === selected) return; /* hide current next from ahead */
          }
          /* On selected=today, still show later unique same day only if not the next hero */
          rows.push({ iso: iso, e: e, p: p });
        });
      });
      /* If selected is today and next is today's event, drop first matching */
      if (next && rows.length) {
        var nk = nextKey.replace(/[^a-z0-9]+/g, "");
        rows = rows.filter(function (r, idx) {
          var tk = String(r.e.what || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
          if (idx === 0 && r.iso === DAY_ISO && nk && (tk.indexOf(nk.slice(0, 12)) >= 0 || nk.indexOf(tk.slice(0, 12)) >= 0)) return false;
          return true;
        });
      }
      /* AUDIT1 · Ahead = after now, in start order (today's past rows drop; untimed today rows drop after 5p) */
      var nowMin = consumeNowCtMin();
      rows = rows.filter(function (r) {
        if (r.iso !== DAY_ISO) return true;
        var m = consumeTimeMin(r.p.time);
        if (m == null) return nowMin < 17 * 60;
        return m > nowMin;
      });
      rows.sort(function (a, b) {
        if (a.iso !== b.iso) return a.iso < b.iso ? -1 : 1;
        var ma = consumeTimeMin(a.p.time), mb = consumeTimeMin(b.p.time);
        if (ma == null && mb == null) return 0;
        if (ma == null) return -1;
        if (mb == null) return 1;
        return ma - mb;
      });
      if (!rows.length) {
        ahead.innerHTML = '<div class="consume-ahead-empty">No unique events ahead · routines collapsed above</div>';
      } else {
        ahead.innerHTML = rows.slice(0, 8).map(function (r) {
          var dow = CONSUME_DOW[dowIndexFromIso(r.iso)].toUpperCase();
          var dn = String(Number(r.iso.split("-")[2]));
          var what = consumeStripKidName(r.e.what, kid);
          var dim = "";
          var hint = r.e.hint || "";
          if (hint && !/YOUR board/i.test(hint)) {
            dim = ' <span class="dim">· ' + esc(hint) + "</span>";
          } else {
            var paren = what.match(/\(([^)]+)\)/);
            if (paren) {
              what = what.replace(/\s*\([^)]+\)\s*$/, "").trim();
              dim = ' <span class="dim">· ' + esc(paren[1]) + "</span>";
            } else if (/·/.test(what)) {
              var parts = what.split("·");
              what = parts[0].trim();
              dim = ' <span class="dim">· ' + esc(parts.slice(1).join("·").trim()) + "</span>";
            }
          }
          var time = r.p.time || "";
          if (r.p.leave && time) time = time; /* already leave-aware in when */
          return '<div class="consume-ahead-row">' +
            '<span class="consume-ahead-day">' + esc(dow + " " + dn) + "</span>" +
            '<div class="consume-ahead-what">' + esc(what) + dim + "</div>" +
            '<span class="consume-ahead-time">' + esc(time || "—") + "</span>" +
            "</div>";
        }).join("");
      }
    }
  }

  function renderKidPage(kidId, data) {
    var kid = data.kids[kidId];
    if (!kid) return;
    syncBankFromChecks(data);
    var bank = getBankView(kidId, data);

    var hotTitle = document.querySelector("[data-hot-title]");
    if (hotTitle && kid.hottest) hotTitle.innerHTML = esc(kid.hottest.when).replace(/(\d+:\d+|Leave\s+\d+:\d+)/g, function (m) {
      return '<span class="hl">' + m + "</span>";
    });
    // simpler: just set text with hl on numbers already in template — overwrite text
    if (hotTitle && kid.hottest) {
      hotTitle.textContent = "";
      hotTitle.innerHTML = esc(kid.hottest.when);
    }
    var hotSub = document.querySelector("[data-hot-sub]");
    if (hotSub && kid.hottest) {
      hotSub.innerHTML = "<strong>" + esc(kid.hottest.what) + "</strong> · " + esc(kid.hottest.where || "");
    }
    var hotPill = document.querySelector("[data-hot-pill]");
    if (hotPill && kid.hottest) {
      hotPill.innerHTML = '<span class="spark">◆</span> ' + esc(kid.hottest.what) + " · " + esc((kid.hottest.when || "").split("·")[0].trim());
    }

    var hotLabel = document.querySelector("[data-hot-label]");
    if (hotLabel && kid.hottest) {
      var whenHead = String(kid.hottest.when || "").split("·")[0].trim();
      hotLabel.textContent = whenHead ? ("ON THE BOARD · " + whenHead) : "ON THE BOARD";
    }
    var hotBadges = document.querySelector("[data-hot-badges]");
    if (hotBadges && kid.hottest) {
      var badges = kid.hottest.badges;
      if (!badges || !badges.length) {
        badges = String(kid.hottest.when || "").split("·").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 2);
      }
      hotBadges.innerHTML = (badges || []).map(function (b) {
        return '<div class="hot-badge">' + esc(b) + "</div>";
      }).join("") || '<div class="hot-badge">…</div>';
    }

    renderQuests(document.querySelector("[data-mount-quests]"), kid.quests, data, kidId);
    if (document.querySelector(".sec-schedule.consume-sched")) {
      renderConsumeSchedule(kidId, data);
    } else {
      renderList(document.querySelector("[data-mount-today-events]"), kid.today, "easy day · your quests below");
      renderList(document.querySelector("[data-mount-sports]"), kid.sports, kid.sportsEmpty || "no sports on your board right now");
      (function () {
        var schoolRows = (kid.school || []).slice();
        var sp = specialForIso(kidId, DAY_ISO);
        if (sp) {
          schoolRows = [{ when: "Today · Special", what: sp.what, hint: sp.hint, tone: "act" }].concat(schoolRows);
        }
        renderList(document.querySelector("[data-mount-school]"), schoolRows, "school bits show up when known");
      })();
      renderList(document.querySelector("[data-mount-appointments]"), kid.appointments, kid.appointmentsEmpty || "none on your board · quiet is good");
    }
    renderList(document.querySelector("[data-mount-fun]"), kid.fun, "fun picks land here");
    renderList(document.querySelector("[data-mount-missions]"), kid.missions || kid.fun, "bonus missions land here");

    var streak = document.querySelector("[data-streak-label]");
    if (streak && kid.streakLabel) streak.textContent = kid.streakLabel;

    var prevReached = false;
    try { prevReached = localStorage.getItem("house-bank-goal:" + kidId) === "1"; } catch (e) {}
    renderBank(document, bank);
    renderPersonalGoal(document, kidId, data, bank);
    if (kidId === "ainsley") renderHarborStrips(kidId, data);
    if (bank.reached) {
      try { localStorage.setItem("house-bank-goal:" + kidId, "1"); } catch (e) {}
      document.body.classList.add("bank-goal-hit");
      var unlock = document.querySelector("[data-goal-unlock]");
      if (unlock) {
        unlock.hidden = false;
        unlock.textContent = "Goal met · show Dad"; /* CHORELAW1: no payday */
      }
      if (!prevReached) {
        try {
          document.dispatchEvent(new CustomEvent("house:goal-hit", { detail: { kidId: kidId, reward: bank.reward, bank: bank } }));
        } catch (e) {}
      }
    } else {
      var unlock2 = document.querySelector("[data-goal-unlock]");
      if (unlock2) unlock2.hidden = true;
      try { localStorage.removeItem("house-bank-goal:" + kidId); } catch (eClr) {}
      document.body.classList.remove("bank-goal-hit");
    }

    try {
      document.dispatchEvent(new CustomEvent("house:kid-rendered", { detail: { kidId: kidId, bank: bank } }));
    } catch (e) { /* */ }
  }

  function withHref(items, href) {
    return (items || []).map(function (it) {
      var o = {};
      for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) o[k] = it[k];
      if (!o.href) o.href = href;
      return o;
    });
  }

  function pickHref(item) {
    var blob = ((item && item.what) || "") + " " + ((item && item.when) || "") + " " + ((item && item.hint) || "");
    blob = blob.toLowerCase();
    if (/harris/.test(blob)) return "kid-harris.html";
    if (/hayes/.test(blob)) return "kid-hayes.html";
    if (/ainsley/.test(blob)) return "kid-ainsley.html";
    if (/jar|allowance|gem|coin|payday/.test(blob)) return "sheet-allowance.html";
    if (/chore|must/.test(blob)) return "sheet-chores.html";
    if (/pack/.test(blob)) return "sheet-pack.html";
    return "sheet-today.html";
  }

  function dedupeDanRows(items) {
    var seen = Object.create(null);
    var out = [];
    (items || []).forEach(function (it) {
      var k = String((it && it.when) || "").toLowerCase() + "|" + String((it && it.what) || "").toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      out.push(it);
    });
    return out;
  }

  function densifyDanToday(data) {
    var dan = data.kids.dan;
    var rows = dedupeDanRows((dan && dan.today) || []).slice();
    var strip = data.boardStrip || {};
    var blob = rows.map(function (r) { return ((r.when || "") + " " + (r.what || "")).toLowerCase(); }).join(" | ");
    if (strip.time && strip.place && blob.indexOf(String(strip.place).toLowerCase().slice(0, 18)) < 0) {
      rows.unshift({
        when: (strip.label || "Next") + " · " + strip.time,
        what: strip.place,
        tone: "hot",
        href: "sheet-today.html"
      });
    }
    if (blob.indexOf("must") < 0) {
      rows.splice(Math.min(2, rows.length), 0, {
        when: "Musts",
        what: "Kids clear · chores board",
        tone: "act",
        href: "sheet-chores.html"
      });
    }
    return rows.map(function (it) {
      var o = {};
      for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) o[k] = it[k];
      if (!o.href) {
        var w = ((o.what || "") + " " + (o.when || "")).toLowerCase();
        if (/must|chore/.test(w)) o.href = "sheet-chores.html";
        else if (/sre drop|sre pickup|leave|swim|flag|baseball|pack/.test(w)) o.href = "sheet-countdowns.html";
        else o.href = "sheet-today.html";
      }
      return o;
    });
  }

  function renderDanPage(data) {
    var dan = data.kids.dan;
    if (!dan) return;
    /* DADFIX1 · denser Today (next/musts/leave) · dedupe PE twins · every card → dest */
    renderList(document.querySelector("[data-mount-dan-today]"), densifyDanToday(data), "quiet day");
    renderList(document.querySelector("[data-mount-dan-week]"), withHref(dedupeDanRows(dan.week), "month.html"), "week fills from the calendar");
    renderList(document.querySelector("[data-mount-dan-leave]"), withHref(dan.leaveBys, "sheet-countdowns.html"), "leave-bys when known");
    var picks = (dan.picks || []).map(function (it) {
      var o = {};
      for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) o[k] = it[k];
      if (!o.href) o.href = pickHref(o);
      return o;
    });
    renderList(document.querySelector("[data-mount-dan-picks]"), picks, "picks later");
  }

  function boot(kidId) {
    loadJSON(function (err, data) {
      if (err || !data) {
        console.warn("[kids-data]", err);
        return;
      }
      global.WardKids._data = data;
      if (kidId === "dan") renderDanPage(data);
      else if (kidId) renderKidPage(kidId, data);
      try {
        document.dispatchEvent(new CustomEvent("house:kids-data-ready", { detail: { kidId: kidId, data: data } }));
      } catch (e) { /* */ }
    });
  }

  global.WardKids = {
    DAY_ISO: DAY_ISO,
    CHECK_KEY: CHECK_KEY,
    BANK_KEY: BANK_KEY,
    KID_FROM_CHECK: KID_FROM_CHECK,
    LEGACY_TO_MUST: LEGACY_TO_MUST,
    MUST_IDS: MUST_IDS,
    resolveCheck: resolveCheck,
    qid: qid,
    checkKeyFor: checkKeyFor,
    weekStartIso: weekStartIso,
    weekDayIsos: weekDayIsos,
    dadWeekLen: dadWeekLen,
    DAD_WEEK_DAYS: DAD_WEEK_DAYS,
    dowIndexFromIso: dowIndexFromIso,
    chicagoHourNow: chicagoHourNow,
    weekStarsFor: weekStarsFor,
    dailyDoneCount: dailyDoneCount,
    dailyWeekComplete: dailyWeekComplete,
    bankStarsFor: bankStarsFor,
    mustQuests: mustQuests,
    mustSetComplete: mustSetComplete,
    mustProgress: mustProgress,
    mustPayStars: mustPayStars,
    syncMustGateBank: syncMustGateBank,
    syncDailyWeekBank: syncDailyWeekBank,
    enhanceSharedChores: enhanceSharedChores,
    questMeta: questMeta,
    loadChecks: loadChecks,
    saveChecks: saveChecks,
    loadKeyState: loadKeyState,
    saveKeyState: saveKeyState,
    getCheck: getCheck,
    setCheck: setCheck,
    getBankView: getBankView,
    applyCheckToBank: applyCheckToBank,
    syncBankFromChecks: syncBankFromChecks,
    renderBank: renderBank,
    renderPersonalGoal: renderPersonalGoal,
    renderHarborStrips: renderHarborStrips,
    renderKidPage: renderKidPage,
    renderConsumeSchedule: renderConsumeSchedule,
    nextPaydayInfo: nextPaydayInfo,
    resetJarCycle: resetJarCycle,
    settlePriorWeeksIntoBalance: settlePriorWeeksIntoBalance,
    weekEarnDollars: weekEarnDollars,
    allowanceCap: allowanceCap,
    getPaidStamp: getPaidStamp,
    personalGoalView: personalGoalView,
    growGoalView: growGoalView,
    renderGrow: renderGrow,
    buildNoSurprise: buildNoSurprise,
    boot: boot,
    loadJSON: loadJSON,
    _data: null
  };
})(window);
