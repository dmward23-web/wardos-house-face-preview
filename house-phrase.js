/* SEPWRAP1 · house-phrase.js · a ' · ' separator never starts or ends a line (Dan, Oct 2: 'Kids back Fri Oct 9 ·'
   dangling, '3:00 PM' on the next line). Every visible " · " in a text node is drawn as <span class="hp-sep"> · </span>;
   after layout, a separator at a line break (its dot is not on the same line as the words on both sides) is drawn as
   a plain space: the line then breaks at the whole phrase. Re-checked on resize, font load and every content change.
   Text the page builds on purpose as phrases (<span class="ph">) is kept whole by CSS (white-space: nowrap).
   Skips script/style/svg/inputs and anything under [data-phrase-off]. Pure layout: no data, no writes, no network. */
(function (g) {
  "use strict";
  var d = g.document; if (!d || g.HousePhrase) return;
  var SEP = /(\s\u00b7\s|^\u00b7\s|\s\u00b7$)/, SKIP = "script,style,svg,textarea,input,select,option,noscript,template,[data-phrase-off],.hp-sep";
  var st = d.createElement("style");
  st.textContent = ".ph{white-space:nowrap}.hp-sep{white-space:normal}";
  (d.head || d.documentElement).appendChild(st);
  function wrapText(t) {
    var v = t.nodeValue, p = t.parentNode;
    if (!v || v.indexOf("\u00b7") < 0 || !SEP.test(v) || !p || p.nodeType !== 1 || (p.closest && p.closest(SKIP))) return false;
    var parts = v.split(SEP), f = d.createDocumentFragment();
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2) { var s = d.createElement("span"); s.className = "hp-sep"; s.textContent = parts[i]; f.appendChild(s); }
      else f.appendChild(d.createTextNode(parts[i]));
    }
    /* SEPWRAP3 · in a flex / grid box each child is its own item: keep the run ONE item (a plain span around it) so the
       separators never split the text into stacked pieces */
    var pd = ""; try { pd = g.getComputedStyle(p).display; } catch (e) {}
    if (/flex|grid/.test(pd)) { var run = d.createElement("span"); run.className = "hp-run"; run.appendChild(f); f = run; }
    p.replaceChild(f, t); return true;
  }
  function wrapAll(root) {
    if (!root) return 0;
    if (root.nodeType === 3) return wrapText(root) ? 1 : 0;
    if (root.nodeType !== 1 || (root.closest && root.closest(SKIP))) return 0;
    var w = d.createTreeWalker(root, 4), L = [], n, k = 0;
    while ((n = w.nextNode())) if (n.nodeValue.indexOf("\u00b7") >= 0) L.push(n);
    for (var i = 0; i < L.length; i++) if (wrapText(L[i])) k++;
    return k;
  }
  function blockOf(e) {
    for (var b = e; b && b !== d.body; b = b.parentElement) { var ds = g.getComputedStyle(b).display; if (ds !== "inline" && ds !== "contents") return b; }
    return d.body;
  }
  var R = d.createRange();
  function glyph(t, i) { R.setStart(t, i); R.setEnd(t, i + 1); var q = R.getClientRects(); return q.length ? q[0] : null; }
  /* first visible non-space glyph rect before (dir -1) / after (dir 1) separator s, inside block b (not in another separator) */
  function neighbour(b, s, dir) {
    var w = d.createTreeWalker(b, 4), n, list = [], at = -1;
    while ((n = w.nextNode())) { if (n === s.firstChild) at = list.length; list.push(n); }
    if (at < 0) return null;
    for (var i = at + dir; i >= 0 && i < list.length; i += dir) {
      var t = list[i], pe = t.parentElement; if (!pe || pe.closest(".hp-sep") || blockOf(pe) !== b) continue;
      var v = t.nodeValue;
      for (var j = dir > 0 ? 0 : v.length - 1; j >= 0 && j < v.length; j += dir) { if (/\s/.test(v[j])) continue; var q = glyph(t, j); if (q && q.width > 0.3) return q; }
    }
    return null;
  }
  function sameLine(a, q) { var m = (a.top + a.bottom) / 2; return m > q.top && m < q.bottom; }
  function cutKey(seps) { var k = ""; for (var i = 0; i < seps.length; i++) k += seps[i].hasAttribute("data-cut") ? "1" : "0"; return k; }
  var repacks = 0;
  function fit() {
    var seps = d.querySelectorAll(".hp-sep"), before = cutKey(seps);
    for (var i = 0; i < seps.length; i++) if (seps[i].hasAttribute("data-cut")) { seps[i].textContent = seps[i].getAttribute("data-cut"); seps[i].removeAttribute("data-cut"); }
    /* a cut reflows its line, so a later separator can land on a break: re-check (cut only) until none moves */
    for (var pass = 0, cut = 1; pass < 4 && cut; pass++) { cut = 0;
    for (i = 0; i < seps.length; i++) {
      var s = seps[i]; if (s.hasAttribute("data-cut")) continue; if (!s.isConnected || !s.offsetParent && g.getComputedStyle(s).position !== "fixed") continue;
      var t = s.firstChild; if (!t || t.nodeType !== 3) continue;
      var k = t.nodeValue.indexOf("\u00b7"); if (k < 0) continue;
      var dot = glyph(t, k); if (!dot || dot.width < 0.3) continue;
      var b = blockOf(s.parentElement), prev = neighbour(b, s, -1), next = neighbour(b, s, 1);
      if (!prev && !next) continue;
      if ((prev && !sameLine(dot, prev)) || (next && !sameLine(dot, next)) || !prev || !next) {
        s.setAttribute("data-cut", t.nodeValue); s.textContent = " "; cut++;
      }
    }
    }
    /* SEPWRAP3 · a landscape board sized its cards' type before these breaks moved: when the set of cut separators
       changes, let the packer measure again (resize = its own re-deal), at most 3 times in a row */
    if (cutKey(seps) !== before && d.documentElement.hasAttribute("data-ls-pack") && repacks < 3) {
      repacks++; setTimeout(function () { repacks = Math.max(0, repacks - 1); }, 3000);
      setTimeout(function () { try { g.dispatchEvent(new Event("resize")); } catch (e) {} }, 0);
    }
  }
  var tm = 0;
  function later() { clearTimeout(tm); tm = setTimeout(function () { tm = 0; mo.disconnect(); try { fit(); watchBlocks(); } finally { observe(); } }, 60); }
  var mo = new MutationObserver(function (ms) {
    var k = 0;
    mo.disconnect();
    try { for (var i = 0; i < ms.length; i++) { var m = ms[i]; if (m.type === "characterData") k += wrapAll(m.target); else for (var j = 0; j < m.addedNodes.length; j++) k += wrapAll(m.addedNodes[j]); } }
    finally { observe(); }
    later();
  });
  function observe() { if (d.body) mo.observe(d.body, { childList: true, subtree: true, characterData: true }); }
  /* SEPWRAP2 · a board's packer re-deals tiles after first paint (no resize, no text change): watch every block that
     holds a separator, so a width change there re-checks its line breaks */
  var bro = null, watched = typeof WeakSet === "function" ? new WeakSet() : null;
  function watchBlocks() {
    if (!bro || !watched) return;
    var seps = d.querySelectorAll(".hp-sep");
    for (var i = 0; i < seps.length; i++) { var b = seps[i].parentElement && blockOf(seps[i].parentElement); if (b && !watched.has(b)) { watched.add(b); try { bro.observe(b); } catch (e) {} } }
  }
  function start() { wrapAll(d.body); observe(); later(); if (d.fonts && d.fonts.ready) d.fonts.ready.then(later); }
  g.addEventListener("resize", later);
  if (typeof ResizeObserver === "function") { try { new ResizeObserver(later).observe(d.documentElement); bro = new ResizeObserver(later); } catch (e) {} }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start); else start();
  g.HousePhrase = { pending: function () { return !!tm; }, fit: function () { mo.disconnect(); try { fit(); } finally { observe(); } }, wrap: wrapAll };
})(window);
