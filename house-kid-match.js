/* HAYESJ1 · house-kid-match.js · the ONE kid-name matcher for event titles (Dan, Oct 2 5:3x PM CT: the
   Sat Oct 3 J. Alexander's birthday dinner is for HAYES JOHNSON, on Erin's side, not our Hayes).
   Every place that infers a kid from a calendar title uses this: the generators (scripts/house/lib.mjs kidsIn,
   scripts/calendar-refresh.mjs, scripts/cal-months.py reads the KIDNAMES block below) and the boards
   (kid pages, wall seats, NEXT UP, month, countdowns). Other people who share a kid's first name are blanked
   out of the title before any kid name is looked for. Pure: no data, no writes, no network.
   The JSON between the KIDNAMES markers is read verbatim by scripts/cal-months.py: keep it valid JSON. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HouseKidMatch = api;
})(typeof self !== "undefined" ? self : (typeof globalThis !== "undefined" ? globalThis : this), function () {
  "use strict";
  var CFG = /*KIDNAMES*/{
    "kids": [{ "id": "hayes", "name": "Hayes" }, { "id": "ainsley", "name": "Ainsley" }, { "id": "harris", "name": "Harris" }],
    "notOurs": ["Hayes\\s+Johnson(?:['\u2019]s)?", "Johnson\\s+Kids"]
  }/*END*/;
  var NOT_SRC = "\\b(?:" + CFG.notOurs.join("|") + ")(?![A-Za-z])";
  function notRe() { return new RegExp(NOT_SRC, "gi"); }
  var NAME_RE = {};
  CFG.kids.forEach(function (k) { NAME_RE[k.id] = new RegExp("\\b" + k.name + "\\b", "i"); });
  var BDAY_RE = /\b(?:birthday|b-?day)\b/i;
  /** the title with every not-our-kid name blanked (same length is not kept; callers only test it) */
  function strip(text) { return String(text == null ? "" : text).replace(notRe(), " "); }
  /** is our kid (id or name) named in this title? */
  function has(text, kid) {
    var id = String(kid || "").toLowerCase(), re = NAME_RE[id];
    return re ? re.test(strip(text)) : false;
  }
  /** our kids named in this title, in the order they appear: [{id, name}] */
  function kidsIn(text) {
    var s = strip(text), out = [];
    CFG.kids.forEach(function (k) { var m = NAME_RE[k.id].exec(s); if (m) out.push({ id: k.id, name: k.name, at: m.index }); });
    return out.sort(function (a, b) { return a.at - b.at; }).map(function (k) { return { id: k.id, name: k.name }; });
  }
  /** a birthday that belongs to our kid: the kid is named (after blanking) and the title says birthday */
  function isBirthdayFor(text, kid) { return BDAY_RE.test(String(text || "")) && has(text, kid); }
  /** does the title name someone who only shares a kid's first name? */
  function namesOther(text) { return notRe().test(String(text || "")); }
  return { CFG: CFG, NOT_SRC: NOT_SRC, strip: strip, has: has, kidsIn: kidsIn, isBirthdayFor: isBirthdayFor, namesOther: namesOther };
});
