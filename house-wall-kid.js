/* CHORELAW2 · house-wall-kid.js · branch wall-redesign-1 · loaded by wall.html and the hub kid tiles (not deployed).
   House Face chore law (Dan, locked Thu Oct 1 2026 8:01 PM CT · plates/2026-10-01/redesign/CHORE-LAW-2026-10-01.md).
   ONE chore copy: every id, word and window comes from Atlas's data/kid-seats.json (ATLASLANE8); nothing here invents copy.
   Controls: 4 MUSTS taps (binary, capped at 4) · CHOICE claim (first tap owns it, siblings locked out, no un-claim) ·
   CLOSE (only inside Atlas's window, each kid on their own tile) · Pack (3 items on travel weeks, dark per kid at that kid's own Bag) ·
   Mystery close (hidden until that kid's 4 MUSTS are closed; time and picks only, never money).
   Taps are written to the EXISTING hub keys house-checkoffs:<kid>:<YYYY-MM-DD> (house day, resets 3:00 AM CT) and
   house-checkoffs:<kid>:week:<Sunday> (Pack), value true; house-tapsync.js carries them to the hub when a key is saved.
   Never the bank (house-bank:*), never any jar, never money. Fixed seat order, no leaderboard.
   Also kept: the hall flash (hallFlashLightIds [] ships empty), who-home check-in, and the one-use Weekend fun unlock. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HouseWallKid = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var TZ = "America/Chicago";
  var KIDS = [{ id: "ainsley", name: "Ainsley" }, { id: "hayes", name: "Hayes" }, { id: "harris", name: "Harris" }];
  var NEVER_FLASH = ["harris-room"]; /* Dan: don't use Harris's Room */
  var DEFAULTS = { hallFlashLightIds: [], flashMs: 2000, flashCooldownMs: 15000 };
  var WHO_KEY = "wardos-wall-whohome";          /* Atlas who-home shape, per device */
  var UNLOCK_PREFIX = "wardos-wall-unlock:";

  function nowMs(n) { return n == null ? Date.now() : (n instanceof Date ? n.getTime() : Number(n)); }
  function parse(iso) { var t = Date.parse(iso || ""); return isFinite(t) ? t : 0; }
  function ctIso(ms) { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms)); }
  function houseDay(ms) { return ctIso(ms - 3 * 60 * 60 * 1000); } /* Atlas: resets 3:00 AM CT */
  function kidById(id) { return KIDS.filter(function (k) { return k.id === id; })[0] || null; }
  function memStore(init) { var m = Object.assign({}, init || {}); return { get: function (k) { return k in m ? m[k] : null; }, set: function (k, v) { m[k] = String(v); }, dump: function () { return m; } }; }

  function flashIds(cfg) {
    var ids = (cfg && Array.isArray(cfg.hallFlashLightIds)) ? cfg.hallFlashLightIds : [];
    return ids.filter(function (id, i) { return typeof id === "string" && NEVER_FLASH.indexOf(id) < 0 && ids.indexOf(id) === i; });
  }

  /* Hall flash: capture each light's prior on/off, invert for flashMs, then restore exactly. Debounced:
     no new flash while one runs or within flashCooldownMs of the last one. Unknown prior (on:null) -> that light is skipped. */
  function createFlash(deps) {
    deps = deps || {};
    var cfg = Object.assign({}, DEFAULTS, deps.config || {});
    var ids = flashIds(cfg);
    var now = deps.now || function () { return Date.now(); };
    var later = deps.setTimeout || function (fn, ms) { return setTimeout(fn, ms); };
    var L = deps.lights;
    var busy = false, lastAt = -Infinity;
    function hasKey() { return !!(deps.hasKey && deps.hasKey()); }
    function flash() {
      if (!ids.length) return { sent: 0, reason: "no hall light confirmed" };
      if (!hasKey() || !L || typeof L.setLight !== "function") return { sent: 0, reason: "NEED KEY" };
      if (typeof L.canWrite === "function" && !L.canWrite()) return { sent: 0, reason: "lights offline" };
      var t = now();
      if (busy || t - lastAt < cfg.flashCooldownMs) return { sent: 0, reason: "debounced" };
      var eff = (typeof L.effectiveLights === "function" ? L.effectiveLights() : null) || {};
      var byId = {};
      (eff.lights || []).forEach(function (x) { byId[x.id] = x; });
      var prior = ids.map(function (id) { var x = byId[id]; return x && typeof x.on === "boolean" ? { id: id, on: x.on } : null; }).filter(Boolean);
      if (!prior.length) return { sent: 0, reason: "prior state unknown" };
      busy = true; lastAt = t;
      prior.forEach(function (p) { L.setLight(p.id, { on: !p.on }); });
      later(function () {
        prior.forEach(function (p) { L.setLight(p.id, { on: p.on }); });
        busy = false; lastAt = now();
      }, cfg.flashMs);
      return { sent: prior.length * 2, prior: prior };
    }
    return { flash: flash, ids: ids, config: cfg };
  }

  /* Check-in: Atlas's who-home shape {date, resetsAt?, kids:[{id,name,checkedInAt}]} kept per device. */
  function readWho(store, now) {
    var day = houseDay(nowMs(now)), j = null;
    try { j = JSON.parse(store.get(WHO_KEY) || "null"); } catch (e) { j = null; }
    if (!j || j.date !== day || !Array.isArray(j.kids)) j = { date: day, kids: KIDS.map(function (k) { return { id: k.id, name: k.name, checkedInAt: null }; }) };
    return j;
  }
  function checkIn(store, kidId, now) {
    var t = nowMs(now), j = readWho(store, t);
    if (!kidById(kidId)) return j;
    j.kids = j.kids.map(function (k) { return k.id === kidId && !k.checkedInAt ? { id: k.id, name: k.name, checkedInAt: new Date(t).toISOString() } : k; });
    store.set(WHO_KEY, JSON.stringify(j));
    return j;
  }
  /* file (data/who-home.json) + this device: a real check-in from either counts. */
  function mergeWho(fileJson, localJson) {
    var base = localJson || fileJson; if (!base) return null;
    var out = { date: base.date, kids: KIDS.map(function (k) {
      function at(j) { var x = j && j.kids && j.kids.filter(function (y) { return y && (y.id === k.id || y.name === k.name); })[0]; return x && x.checkedInAt || null; }
      var a = localJson && localJson.date === base.date ? at(localJson) : null;
      var b = fileJson && fileJson.date === base.date ? at(fileJson) : null;
      return { id: k.id, name: k.name, checkedInAt: a || b || null };
    }) };
    return out;
  }

  /* One-use unlocks · Atlas's data (wall-redesign-atlas ATLASLANE4/5, docs/wall-redesign/ATLAS-DATA-LANE.md):
     data/unlocks.json {asOfIso, generatedAt, week:{id,startsAt,endsAt}, lit:[{id, seat, control, tile, choices?, uses:1, earnedWeek, copy}], source}
     Only lit entries are listed (dark / spent = absent). Missing / not today's / generatedAt > 24 h / no lit[] -> nothing shown (never inferred).
     Spends: Atlas's unlock-uses shape {note, uses:[{unlock, weekId (= earnedWeek), usedAt, choice?}]}, kept per device under USES_KEY. */
  var USES_KEY = "wardos-wall-unlock-uses";
  var USES_NOTE = "Per-device until a shared write path is approved. Each spend: {unlock, weekId (the week that earned it), usedAt, choice?}.";
  var CONTROL = { /* Atlas control id -> the board it opens. Chore law: Us together (10 of 12 closes) lights Weekend fun only.
                     The old per-kid dinner-vote and gallery unlocks are gone (CHORELAW2); unknown ids are not drawn. */
    "weekend-pick": { label: "Weekend fun", href: "sheet-weekend.html" }
  };
  var SEAT_KID = { Harris: "harris", Hayes: "hayes", Ainsley: "ainsley", House: "house" };
  function fileValid(j, now) {
    var t = nowMs(now);
    if (!j || typeof j !== "object" || j.asOfIso !== ctIso(t)) return false;
    var g = parse(j.generatedAt);
    return !!g && t - g <= 24 * 60 * 60 * 1000 && t - g >= -5 * 60 * 1000;
  }
  function readUses(store) {
    var u = null;
    try { u = JSON.parse(store.get(USES_KEY) || "null"); } catch (e) { u = null; }
    return u && Array.isArray(u.uses) ? u : { note: USES_NOTE, uses: [] };
  }
  function isSpent(uses, id, week) { return uses.uses.some(function (x) { return x && x.unlock === id && x.weekId === week; }); }
  function unlocks(j, store, now) {
    if (!fileValid(j, now) || !Array.isArray(j.lit)) return [];
    var uses = readUses(store);
    return j.lit.filter(function (u) { return u && typeof u.id === "string" && SEAT_KID[u.seat] && u.earnedWeek; }).map(function (u) {
      var keys = Array.isArray(u.choices) && u.choices.length ? u.choices : [u.control];
      var choices = keys.filter(function (k) { return CONTROL[k]; }).map(function (k) {
        return { key: k, label: keys.length > 1 && k === "weekend-pick" ? "Weekend pick" : CONTROL[k].label, href: CONTROL[k].href };
      });
      return { id: u.id, seat: u.seat, kid: SEAT_KID[u.seat], copy: String(u.copy || ""), earnedWeek: u.earnedWeek,
        multi: keys.length > 1, choices: choices, used: isSpent(uses, u.id, u.earnedWeek) };
    }).filter(function (u) { return u.choices.length; });
  }
  /* Spend: one use (Ainsley's two choices share it). Returns the href to open, or null when spent / not lit / bad choice. */
  function useUnlock(j, store, id, choiceKey, now) {
    var u = unlocks(j, store, now).filter(function (x) { return x.id === id; })[0];
    if (!u || u.used) return null;
    var ch = u.choices.filter(function (c) { return c.key === choiceKey; })[0] || (!u.multi ? u.choices[0] : null);
    if (!ch) return null;
    var uses = readUses(store), rec = { unlock: u.id, weekId: u.earnedWeek, usedAt: new Date(nowMs(now)).toISOString() };
    if (u.multi) rec.choice = ch.key;
    uses.uses.push(rec);
    store.set(USES_KEY, JSON.stringify(uses));
    return ch.href;
  }

  /* ---------- Chore law · data/kid-seats.json (Atlas ATLASLANE8) ----------
     {asOfIso, generatedAt, week:{id}, quiet, seats:{<kid>:{name, musts:[{id,word,closed}], today, streak?, captainTonight?,
     trustedWith?, line?, mystery?}}, choice:{date, job:{id,word}, lockAt, claimedBy, locked, done, open, exception},
     close:{date, opensAt, closesAt, open, captain, kids:{<kid>:{closed}}}, pack:{travelWeek, dark, items:[{id,word}], kids:{<kid>:{dark, items:[{id,word,done}]}}}}.
     Not today's / older than 24 h / quiet (kids away) -> null: no chore controls at all (never inferred). */
  var ORDER = ["harris", "hayes", "ainsley"]; /* Atlas's fixed order; never sorted by how anyone did */
  var NAME = { harris: "Harris", hayes: "Hayes", ainsley: "Ainsley" };
  var CHECK_PREFIX = "house-checkoffs:";
  var MUST_CAP = 4, PACK_CAP = 3;
  var MUST_RE = /^must-[a-z]+$/;
  var PACK_IDS = ["pack-dragon", "pack-bag", "pack-charger"], PACK_DONE = "pack-bag";
  var SEAT_ONLY = { ainsley: true }; /* no stars, no counts, no fill on her seat */
  var IDS = { close: "close", claim: "choice-claim", done: "choice-done" };

  function law(j, now) {
    if (!fileValid(j, now) || !j.seats || typeof j.seats !== "object" || j.quiet === true) return null;
    return j;
  }
  function dayKey(kid, day) { return CHECK_PREFIX + kid + ":" + day; }
  function weekKey(kid, weekId) { return CHECK_PREFIX + kid + ":week:" + weekId; }
  function readTaps(store, key) {
    var o = null;
    try { o = JSON.parse(store.get(key) || "null"); } catch (e) { o = null; }
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  }
  function tapOn(v) { return v === true || !!(v && typeof v === "object" && v.v === true); }
  function writeTap(store, key, id) {
    var o = readTaps(store, key);
    if (tapOn(o[id])) return false;
    o[id] = true;
    store.set(key, JSON.stringify(o));
    return true;
  }
  function kidOf(name) { for (var k in NAME) if (NAME[k] === name || k === name) return k; return null; }
  function today(now) { return houseDay(nowMs(now)); }

  /* MUSTS: Atlas's four (Dragon fed already swapped in by Atlas when the dragon is home), binary, capped at four. */
  function musts(j, store, kid, now) {
    var L = law(j, now), seat = L && L.seats[kid];
    if (!seat || !Array.isArray(seat.musts)) return null;
    var taps = readTaps(store, dayKey(kid, today(now)));
    var items = seat.musts.filter(function (m) { return m && MUST_RE.test(m.id) && typeof m.word === "string" && m.word; })
      .slice(0, MUST_CAP).map(function (m) { return { id: m.id, word: m.word, closed: m.closed === true || tapOn(taps[m.id]) }; });
    var done = items.filter(function (m) { return m.closed; }).length;
    return { kid: kid, items: items, done: done, all: items.length === MUST_CAP && done === MUST_CAP, seatOnly: !!SEAT_ONLY[kid] };
  }
  /* A MUST tap: binary (a second tap changes nothing), only Atlas's ids for that kid. Returns the state right after the
     write so the tile fills in the same paint (Harris: same minute). */
  function tapMust(store, j, kid, id, now) {
    var m = musts(j, store, kid, now);
    if (!m || !m.items.some(function (x) { return x.id === id; })) return { ok: false };
    var before = m.all;
    var first = writeTap(store, dayKey(kid, today(now)), id);
    var after = musts(j, store, kid, now);
    return { ok: true, first: first, musts: after, allNow: after.all && !before };
  }

  /* CHOICE: one shared job. First claim owns it and locks it; a sibling's tap changes nothing; there is no un-claim. */
  function choice(j, store, kid, now) {
    var L = law(j, now), c = L && L.choice;
    if (!c || !c.job || typeof c.job.word !== "string" || !c.job.word) return null;
    var day = today(now), t = nowMs(now);
    var owner = kidOf(c.claimedBy);
    if (!owner) owner = ORDER.filter(function (k) { return tapOn(readTaps(store, dayKey(k, day))[IDS.claim]); })[0] || null;
    var lockAt = parse(c.lockAt);
    var done = !!owner && (c.done === true || tapOn(readTaps(store, dayKey(owner, day))[IDS.done]));
    var open = !owner && c.exception !== true && (!lockAt || t < lockAt);
    return { job: { id: c.job.id, word: c.job.word }, owner: owner, ownerName: owner ? NAME[owner] : null,
      mine: !!owner && owner === kid, lockedOut: !!owner && owner !== kid, done: done, open: open, exception: !owner && !open };
  }
  function claimChoice(store, j, kid, now) {
    var c = choice(j, store, kid, now);
    if (!c || !NAME[kid]) return { ok: false, owner: null };
    if (c.owner) return { ok: c.owner === kid, owner: c.owner }; /* already owned: no write, no steal, no un-claim */
    if (!c.open) return { ok: false, owner: null };
    writeTap(store, dayKey(kid, today(now)), IDS.claim);
    return { ok: true, owner: kid };
  }
  function choiceDone(store, j, kid, now) {
    var c = choice(j, store, kid, now);
    if (!c || !c.mine) return { ok: false };
    return { ok: true, first: writeTap(store, dayKey(kid, today(now)), IDS.done) };
  }

  /* CLOSE: only inside Atlas's bedtime window, only for kids home tonight, each kid on their own tile. */
  function close(j, store, kid, now) {
    var L = law(j, now), c = L && L.close, t = nowMs(now);
    if (!c || !c.kids || !c.kids[kid]) return null;
    var o = parse(c.opensAt), e = parse(c.closesAt);
    if (!o || !e || t < o || t > e) return null;
    return { kid: kid, closed: c.kids[kid].closed === true || tapOn(readTaps(store, dayKey(kid, today(now)))[IDS.close]),
      captain: kidOf(c.captain) === kid };
  }
  function tapClose(store, j, kid, now) {
    var c = close(j, store, kid, now);
    if (!c) return { ok: false };
    return { ok: true, first: writeTap(store, dayKey(kid, today(now)), IDS.close) };
  }

  /* Pack: travel weeks only, three items (Atlas's words). Dark PER KID (Atlas ruling Oct 1, 9 PM CT): only this kid's own
     Bag tap (here, or in Atlas's kids[kid]) darkens this kid's Pack; a sibling's tap never does. Top-level pack.dark = not a travel week. */
  function pack(j, store, kid, now) {
    var L = law(j, now), p = L && L.pack, wk = L && L.week && L.week.id, pk = p && p.kids && typeof p.kids === "object" ? p.kids[kid] : null;
    if (!p || !NAME[kid] || p.travelWeek !== true || !/^\d{4}-\d{2}-\d{2}$/.test(wk || "")) return { dark: true, items: [] };
    if (pk ? pk.dark === true : p.dark === true) return { dark: true, items: [] };
    var src = pk && Array.isArray(pk.items) && pk.items.length ? pk.items : p.items, mine = readTaps(store, weekKey(kid, wk));
    if (!Array.isArray(src)) return { dark: true, items: [] };
    var items = src.filter(function (x) { return x && PACK_IDS.indexOf(x.id) >= 0 && typeof x.word === "string" && x.word; })
      .slice(0, PACK_CAP).map(function (x) { return { id: x.id, word: x.word, done: (!!pk && x.done === true) || tapOn(mine[x.id]) }; });
    var dark = !items.length || items.some(function (x) { return x.id === PACK_DONE && x.done; });
    return { dark: dark, items: dark ? [] : items, weekId: wk };
  }
  function tapPack(store, j, kid, id, now) {
    var p = pack(j, store, kid, now);
    if (p.dark || !NAME[kid] || !p.items.some(function (x) { return x.id === id; })) return { ok: false };
    writeTap(store, weekKey(kid, p.weekId), id);
    return { ok: true, pack: pack(j, store, kid, now) };
  }

  /* Mystery close: only on Atlas's mystery day, hidden until this kid's four MUSTS are closed (here AND in Atlas's data). */
  function mystery(j, store, kid, now) {
    var L = law(j, now), m = L && L.seats[kid] && L.seats[kid].mystery;
    if (!m) return null;
    var ms = musts(j, store, kid, now);
    if (!ms || !ms.all || m.hidden !== false || typeof m.copy !== "string" || !m.copy) return { hidden: true };
    return { hidden: false, copy: m.copy };
  }

  /* Age changes the reward, not the standard. Harris: run that pauses on a miss; Hayes: run + captain; Ainsley: trusted-with only. */
  function reward(j, kid, now) {
    var L = law(j, now), s = L && L.seats[kid];
    if (!s) return null;
    if (kid === "ainsley") return { kid: kid, trusted: (Array.isArray(s.trustedWith) ? s.trustedWith : []).filter(function (x) { return typeof x === "string" && x; }),
      line: typeof s.line === "string" && s.line ? s.line : null };
    var days = s.streak && isFinite(s.streak.days) ? Math.max(0, Math.floor(s.streak.days)) : 0;
    var out = { kid: kid, days: days };
    if (kid === "harris") out.paused = !!(s.streak && s.streak.paused === true);
    if (kid === "hayes") out.captain = s.captainTonight === true;
    return out;
  }
  /* Atlas's own wording for a run ("3 days.") and the captain ("Captain tonight."), from kid-layer-lib's Hayes copy. */
  function runText(days) { return days ? days + " " + (days === 1 ? "day" : "days") + "." : ""; }

  return { KIDS: KIDS, ORDER: ORDER, NEVER_FLASH: NEVER_FLASH, DEFAULTS: DEFAULTS, WHO_KEY: WHO_KEY, UNLOCK_PREFIX: UNLOCK_PREFIX,
    memStore: memStore, flashIds: flashIds, createFlash: createFlash,
    houseDay: houseDay, readWho: readWho, checkIn: checkIn, mergeWho: mergeWho,
    USES_KEY: USES_KEY, CONTROL: CONTROL, fileValid: fileValid, readUses: readUses, unlocks: unlocks, useUnlock: useUnlock,
    MUST_CAP: MUST_CAP, PACK_CAP: PACK_CAP, PACK_IDS: PACK_IDS, SEAT_ONLY: SEAT_ONLY, IDS: IDS,
    law: law, dayKey: dayKey, weekKey: weekKey, readTaps: readTaps, musts: musts, tapMust: tapMust,
    choice: choice, claimChoice: claimChoice, choiceDone: choiceDone, close: close, tapClose: tapClose,
    pack: pack, tapPack: tapPack, mystery: mystery, reward: reward, runText: runText };
});
