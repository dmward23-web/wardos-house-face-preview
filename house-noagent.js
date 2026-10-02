/* NOAGENT1 · House Face wall + kid boards: wall copy never names a house agent (Atlas 10/2).
   Calendar and event titles reach the glass from the family calendar with routing tags the house's helpers
   use among themselves ("donation receipts → Ledger", "-> Harbor", "(Atlas)", "[Vita]", "Prism:"). This is a
   DISPLAY filter only: it strips those tags from the text a page draws (and from tap labels), never from data.
   "Harbor Cove" (a street) is a place, not a helper, and stays. Pure display: no data, no writes, no network. */
(function (g) {
  "use strict";
  var NAMES = "Ledger|Harbor(?!\\s+Cove)|Vita|Atlas|Alfred|Prism|Wright|Grok|Daystaff|Plumb";
  var ARROW = "(?:\\u2192|->|=>|\\u27F6|\\u21D2|\\u203A|\\u00BB|>)";
  var RX = [
    /* "x → Ledger", "x -> Harbor / Vita", "x => Atlas" (the routing arrow and every helper after it) */
    new RegExp("\\s*" + ARROW + "\\s*(?:" + NAMES + ")\\b(?:\\s*(?:/|,|&|\\+|and)\\s*(?:" + NAMES + ")\\b)*", "gi"),
    /* "(Atlas)", "[Vita]", "{Prism}", "(Ledger + Alfred)", "(via Harbor)", "(for Ledger)" */
    new RegExp("\\s*[\\(\\[\\{]\\s*(?:via\\s+|for\\s+|to\\s+|from\\s+|by\\s+|owner:?\\s*)?(?:" + NAMES + ")\\b(?:\\s*(?:/|,|&|\\+|and)\\s*(?:" + NAMES + ")\\b)*\\s*[\\)\\]\\}]", "gi"),
    /* a leading tag: "Ledger: ...", "Atlas · ...", "Vita - ..." */
    new RegExp("^\\s*(?:" + NAMES + ")\\b\\s*(?::|\\u00B7|-|\\u2013|\\||/)\\s*", "i"),
    /* a trailing tag: "... · Ledger", "... - Harbor", "... | Atlas", "... @Vita", "... #ledger" */
    new RegExp("\\s*(?:\\u00B7|-|\\u2013|\\||/|@|#)\\s*(?:" + NAMES + ")\\b\\s*$", "i"),
    /* a text that is nothing but a helper's name */
    new RegExp("^\\s*(?:" + NAMES + ")\\s*$", "i")
  ];
  var ANY = new RegExp("\\b(?:" + NAMES + ")\\b", "i");
  function clean(s) {
    if (s == null) return s; s = String(s); if (!ANY.test(s)) return s;
    var out = s; for (var i = 0; i < RX.length; i++) out = out.replace(RX[i], "");
    return out.replace(/\s{2,}/g, " ").replace(/\s+([,.;:)])/g, "$1").replace(/(\u00B7\s*){2,}/g, "\u00B7 ").replace(/^\s*\u00B7\s*|\s*\u00B7\s*$/g, "");
  }
  function scrubText(n) { var v = n.nodeValue; if (v && ANY.test(v)) { var c = clean(v); if (c !== v) n.nodeValue = (/^\s/.test(v) && !/^\s/.test(c) ? " " : "") + c + (/\s$/.test(v) && !/\s$/.test(c) ? " " : ""); } }
  var ATTRS = ["aria-label", "title", "alt", "data-title"];
  function scrubEl(e) { for (var i = 0; i < ATTRS.length; i++) { var a = e.getAttribute && e.getAttribute(ATTRS[i]); if (a && ANY.test(a)) e.setAttribute(ATTRS[i], clean(a)); } }
  function skip(n) { var p = n.nodeType === 1 ? n : n.parentNode; return !p || /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(p.tagName || ""); }
  function scrub(root) {
    if (!root || skip(root)) return;
    if (root.nodeType === 3) { scrubText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) scrubEl(root);
    var tw = document.createTreeWalker(root, 5 /* SHOW_ELEMENT | SHOW_TEXT */, null), n;
    while ((n = tw.nextNode())) { if (skip(n)) continue; if (n.nodeType === 3) scrubText(n); else scrubEl(n); }
  }
  function start() {
    scrub(document.body); try { document.title = clean(document.title); } catch (e) { /* */ }
    if (!g.MutationObserver) return;
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        if (r.type === "characterData") scrubText(r.target);
        else if (r.type === "attributes") scrubEl(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) scrub(r.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  g.HouseNoAgent = { clean: clean, scrub: scrub, NAMES: NAMES };
  if (typeof module !== "undefined" && module.exports) module.exports = g.HouseNoAgent;
  if (typeof document === "undefined") return;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
