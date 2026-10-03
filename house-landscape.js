/* LANDFILL1 · House Face boards · landscape fill (Dan, Oct 1 9:3x PM CT: "the board is LANDSCAPE"; his Chrome
   on a ~1024x576 laptop window showed the hub as a narrow portrait column with black on both sides).
   On a landscape window (>= 960 wide, >= 1.25x wider than tall, not a phone screen) the board's .panel is drawn
   at a fluid type scale z = clamp(0.8, width / 1600, 1.6) and sized to the WHOLE viewport at that scale; its
   sections flow into as many columns as fit (CSS columns, about 500 design px each). Long lists scroll down the
   page; nothing is a fixed-width center column. Portrait (the 1080x1920 wall, phones) is untouched.
   Pure layout: no data, no writes, no network. Linked in <head> (sets html[data-landscape] before first paint). */
(function (g) {
  "use strict";
  var BASIS = 1600, ZMIN = 0.8, ZMAX = 1.6, COLW = 500;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function phone() { try { return Math.min(screen.width, screen.height) <= 600; } catch (e) { return false; } }
  function width() { return document.documentElement.clientWidth || g.innerWidth || 0; }
  function isLandscape() { var w = g.innerWidth || width(), h = g.innerHeight || 1; return w >= 960 && w >= h * 1.25 && !phone(); }
  function sections(panel) {
    return Array.prototype.filter.call(panel.children, function (e) {
      if (e.hasAttribute("hidden") || e.tagName === "SCRIPT" || e.tagName === "STYLE" || e.tagName === "TEMPLATE") return false;
      if (e.hasAttribute("data-ls-span")) return false;
      var cs = g.getComputedStyle(e); return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
    });
  }
  function apply() {
    var root = document.documentElement, on = isLandscape();
    if (on) root.setAttribute("data-landscape", ""); else root.removeAttribute("data-landscape");
    var panel = document.querySelector(".panel"); if (!panel) return;
    if (!on) { if (panel.hasAttribute("data-ls-zoom")) { panel.style.zoom = ""; panel.removeAttribute("data-ls-zoom"); } unpack(panel); root.removeAttribute("data-ls-pack"); return; }
    var w = width(), h = g.innerHeight || 1, z = clamp(w / BASIS, ZMIN, ZMAX);
    ["transform", "transform-origin", "margin-left", "margin-top", "margin-bottom"].forEach(function (p) { panel.style.removeProperty(p); });
    document.body.style.removeProperty("height");
    root.removeAttribute("data-ls-row");
    if (!panel.hasAttribute("data-ls-grid")) { unpack(panel); root.setAttribute("data-ls-pack", ""); }
    setZoom(panel, root, w, h, z);
    flatten(panel, h / z);
    var n = flow(panel).length;
    if (panel.hasAttribute("data-ls-grid")) { root.removeAttribute("data-ls-pack"); setCols(panel, root, colsFor(panel, w, z, n)); return; }
    pack(panel, root, w, h, z);
    sig = sign();
  }
  function setZoom(panel, root, w, h, z) {
    panel.style.zoom = String(z); panel.setAttribute("data-ls-zoom", String(Math.round(z * 1000) / 1000));
    root.style.setProperty("--ls-z", String(z));
    root.style.setProperty("--ls-w", (w / z).toFixed(2) + "px");
    root.style.setProperty("--ls-h", (h / z).toFixed(2) + "px");
  }
  function colsFor(panel, w, z, n) {
    var cols = clamp(Math.floor((w / z) / COLW), 1, Math.max(1, n));
    var force = parseInt(panel.getAttribute("data-ls-cols") || "", 10); if (force > 0) cols = Math.min(cols, force);
    if (COLS_OVR > 0) cols = clamp(COLS_OVR, 1, Math.max(1, n));
    return cols;
  }
  function setCols(panel, root, cols) { root.style.setProperty("--ls-cols", String(cols)); root.setAttribute("data-ls-cols", String(cols)); }
  /* LANDFILL2 (Atlas 10/2: "multi-column at full width", every board's first screen full, scroll ends at the last
     content). The board is a grid of N full-height columns: sections are dealt masonry-style (each to the shortest
     column, in reading order), the type scale grows (up to FITMAX x the base) while everything still fits one screen,
     and each column's cards share out what is left of the window height so no column ends in a black band.
     A board longer than the window keeps the base scale and scrolls; its columns are evened to the tallest one. */
  var ROW = 2, GAP = 12, FITMAX = 2.4, ZFIT = 2.6;
  var PLACED = "data-ls-placed";
  function unpack(panel, keepWide) {
    if (!keepWide) Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-autowide]"), function (e) { e.removeAttribute("data-ls-autowide"); });
    Array.prototype.forEach.call(panel.querySelectorAll("[" + PLACED + "]"), function (e) {
      e.style.removeProperty("grid-row"); e.style.removeProperty("grid-column"); e.removeAttribute(PLACED);
    });
    Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-zoomed]"), function (e) { e.style.zoom = ""; e.removeAttribute("data-ls-zoomed"); });
    Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-fill],[data-ls-grow],[data-ls-end],[data-ls-foot],[data-ls-spread]"), function (e) { ["data-ls-fill", "data-ls-grow", "data-ls-end", "data-ls-foot", "data-ls-spread"].forEach(function (a) { e.removeAttribute(a); }); });
  }
  /* a card that got taller shares the height out inside: its own boxes (chips, rows, tiles) grow with their
     content centred, plain text keeps its size, and what is left goes evenly between the rows. A card that
     brings its own grid or row layout keeps it (its rows already stretch). */
  function boxy(cs) {
    var bg = cs.backgroundColor, img = cs.backgroundImage;
    return (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") || (img && img !== "none") || (parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderBottomWidth) > 0);
  }
  function kidsOf(e) {
    return Array.prototype.filter.call(e.children, function (k) {
      if (k.hasAttribute("hidden") || /^(SCRIPT|STYLE|TEMPLATE)$/.test(k.tagName)) return false;
      if (k.classList && (k.classList.contains("hp-sep") || k.classList.contains("ph"))) return false; /* SEPWRAP3: a separator / phrase span is text, not a card part */
      var cs = g.getComputedStyle(k); return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
    });
  }
  function fill(e, depth) {
    var cs = g.getComputedStyle(e), d = cs.display;
    var col = /flex/.test(d) && cs.flexDirection.indexOf("column") === 0;
    if (!(d === "block" || d === "flow-root" || col)) return;
    var kids = kidsOf(e); if (!kids.length) return;
    e.setAttribute("data-ls-fill", "");
    kids.forEach(function (k) {
      var kc = g.getComputedStyle(k), r = k.getBoundingClientRect();
      if (boxy(kc) && r.height > 24 && r.width > 80) k.setAttribute("data-ls-grow", /grid/.test(kc.display) ? "grid" : /flex/.test(kc.display) ? (kc.flexDirection.indexOf("column") === 0 ? "col" : "row") : "block");
      else if (depth < 3 && kidsOf(k).length >= 2 && r.height > 48) { k.setAttribute("data-ls-grow", "wrap"); fill(k, depth + 1); }
    });
  }
  function place(e, row, col) { e.style.setProperty("grid-row", row, "important"); e.style.setProperty("grid-column", col, "important"); e.setAttribute(PLACED, ""); }
  /* do a card's words (and images / controls) still sit inside it, none cut off? */
  function fitsIn(e) {
    var r0 = e.getBoundingClientRect(), ok = true, tw = document.createTreeWalker(e, 4, null), n, rg = document.createRange();
    var boxes = [];
    while (ok && (n = tw.nextNode())) {
      if (!n.nodeValue.trim() || !n.parentElement || g.getComputedStyle(n.parentElement).visibility === "hidden") continue;
      rg.selectNodeContents(n); var rs = rg.getClientRects();
      for (var i = 0; i < rs.length; i++) {
        if (rs[i].width <= 0) continue;
        if (rs[i].bottom > r0.bottom + 1 || rs[i].right > r0.right + 1 || rs[i].top < r0.top - 1) { ok = false; break; }
        if (boxes.length < 160) boxes.push(rs[i]);
      }
    }
    if (!ok) return false;
    /* no two lines of words drawn over each other */
    for (var a = 0; a < boxes.length; a++) for (var b = a + 1; b < boxes.length; b++) {
      var A = boxes[a], B = boxes[b], ix = Math.min(A.right, B.right) - Math.max(A.left, B.left), iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
      if (ix > 2 && iy > 2 && ix * iy > 0.25 * Math.min(A.width * A.height, B.width * B.height)) return false;
    }
    var all = e.querySelectorAll("*");
    for (var j = 0; j < all.length; j++) {
      var k = all[j]; if (k.scrollWidth > k.clientWidth + 1 && k.clientWidth > 0) { var cs = g.getComputedStyle(k); if (cs.overflowX !== "visible" || cs.textOverflow === "ellipsis") return false; }
      if (/^(IMG|SVG|BUTTON|INPUT|CANVAS)$/i.test(k.tagName)) { var rk = k.getBoundingClientRect(); if (rk.bottom > r0.bottom + 1 || rk.right > r0.right + 1) return false; }
    }
    return true;
  }
  function hpx(e, z) { return e.getBoundingClientRect().height / z; }
  function leads(panel) { /* header, .hdr, [data-ls-lead], [data-ls-span]: direct children, in board order */
    return Array.prototype.filter.call(panel.children, function (e) {
      if (!e.matches(LEAD) || e.hasAttribute("hidden")) return false;
      var cs = g.getComputedStyle(e); return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
    });
  }
  function foots(panel) {
    /* an empty footer strip (no words, nothing in it) is not drawn in landscape: it would only be a black band */
    return Array.prototype.filter.call(panel.children, function (e) {
      if (!e.matches("footer, .ftr") || e.hasAttribute("hidden")) return false;
      var empty = !e.textContent.trim() && !e.querySelector("img, svg, button, a, input, canvas");
      if (empty) e.setAttribute("data-ls-skip", ""); else e.removeAttribute("data-ls-skip");
      if (empty) return false;
      var cs = g.getComputedStyle(e); return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
    });
  }
  /* lay out at scale z; returns the fit (columns, spans) without the final stretch */
  /* lay out at scale z (measure pass): the board's header and lead sections are dealt like any card (a header in
     one column has no empty middle); [data-ls-wide] (or a card taller than the window that is itself a grid of
     tiles: the month, the photo wall) runs across every column and starts a new block; a block with fewer cards
     than columns shares the width out among them; the footer strip runs across the bottom. The grid has T thin
     tracks so a block of 1 to 6 columns always divides it evenly. */
  var T = 60;
  function wideOf(e) { return e.hasAttribute("data-ls-wide") || e.hasAttribute("data-ls-autowide"); }
  function gridish(e) {
    var w = e.getBoundingClientRect().width, q = [e], d = 0;
    while (q.length && d < 4) {
      var nx = [];
      for (var i = 0; i < q.length; i++) {
        var cs = g.getComputedStyle(q[i]), r = q[i].getBoundingClientRect();
        if (r.width >= w * 0.8 && ((/grid/.test(cs.display) && cs.gridTemplateColumns.split(" ").length >= 2) || (/flex/.test(cs.display) && cs.flexWrap === "wrap" && cs.flexDirection.indexOf("row") === 0))) return true;
        Array.prototype.push.apply(nx, kidsOf(q[i]));
      }
      q = nx; d++;
    }
    return false;
  }
  function blocks(all, cols) {
    var segs = [], cur = null;
    all.forEach(function (e, i) {
      if (wideOf(e)) { segs.push({ wide: i }); cur = null; return; }
      if (!cur) { cur = { list: [] }; segs.push(cur); }
      cur.list.push(i);
    });
    segs.forEach(function (sg) { if (sg.list) sg.k = Math.min(cols, sg.list.length); });
    return segs;
  }
  function measure(panel, root, all, ft, segs, z) {
    root.setAttribute("data-ls-measure", "");
    unpack(panel, true);
    ft.forEach(function (e) { place(e, "auto", "1 / -1"); });
    segs.forEach(function (sg) {
      if (!sg.list) place(all[sg.wide], "auto", "1 / -1");
      else sg.list.forEach(function (i) { place(all[i], "auto", "1 / span " + (T / sg.k)); });
    });
    var hs = all.map(function (e) { return hpx(e, z); });
    /* FITW1: a card wider than its column at this scale (a header that will not wrap) means this scale does not fit */
    measure.wide = all.some(function (e) { return e.scrollWidth > e.clientWidth + 2; });
    root.removeAttribute("data-ls-measure");
    return hs;
  }
  /* deal a block's cards into its k columns so the tallest column is as short as it can be (every split is tried
     for a small board; a big one goes largest-first into the shortest column). The first card (the header) stays
     top-left; inside a column the cards keep board order. */
  function deal(sg, hs, all) {
    /* a bare label (a list's heading lifted out with its wrapper) rides with the card under it */
    var groups = [], pend = [];
    sg.list.forEach(function (i) {
      var e = all[i], lab = !boxy(g.getComputedStyle(e)) && hs[i] < 48 && !e.matches(LEAD);
      pend.push(i); if (!lab) { groups.push(pend); pend = []; }
    });
    if (pend.length) { if (groups.length) Array.prototype.push.apply(groups[groups.length - 1], pend); else groups.push(pend); }
    var n = groups.length, k = Math.min(sg.k, n); sg.k = k;
    var hh = groups.map(function (gr) { return gr.reduce(function (a, i) { return a + hs[i] + GAP; }, 0); }), asg = null;
    /* ORDER1 (Dan 10/2): a board marked [data-ls-order] keeps strict reading order: each column takes the next run
       of cards (column-major), so a week stays in calendar order and a list stays in its own order. The cut points
       are the ones whose tallest column is shortest. */
    if (n && (document.body.hasAttribute("data-ls-order") || sg.list.some(function (i) { return all[i].closest("[data-ls-order]"); }))) {
      var bestO = Infinity, sprO = Infinity, cuts = [];
      (function run(j, c, at, mx, mn) {
        if (c === k - 1) {
          var rest = 0; for (var q = j; q < n; q++) rest += hh[q];
          if (j >= n) return;
          var M = Math.max(mx, rest), N = Math.min(mn, rest);
          if (M < bestO - 0.5 || (Math.abs(M - bestO) <= 0.5 && M - N < sprO)) { bestO = M; sprO = M - N; asg = at.slice(); for (q = j; q < n; q++) asg[q] = c; }
          return;
        }
        var acc = 0;
        for (var e2 = j; e2 < n - (k - 1 - c); e2++) { acc += hh[e2]; at[e2] = c; if (Math.max(mx, acc) >= bestO + 0.5) break; run(e2 + 1, c + 1, at, Math.max(mx, acc), Math.min(mn, acc)); }
      })(0, 0, new Array(n), 0, Infinity);
    }
    if (!asg && Math.pow(k, n - 1) <= 6561) {
      var best = Infinity, spread = Infinity, cur = new Array(n), tot = new Array(k);
      for (var code = 0, lim = Math.pow(k, n - 1); code < lim; code++) {
        var x = code; cur[0] = 0;
        for (var j = 1; j < n; j++) { cur[j] = x % k; x = Math.floor(x / k); }
        for (var c = 0; c < k; c++) tot[c] = 0;
        for (j = 0; j < n; j++) tot[cur[j]] += hh[j];
        var mx = Math.max.apply(null, tot), mn = Math.min.apply(null, tot);
        if (mn <= 0) continue;
        if (mx < best - 0.5 || (Math.abs(mx - best) <= 0.5 && mx - mn < spread)) { best = mx; spread = mx - mn; asg = cur.slice(); }
      }
    }
    if (!asg) {
      asg = new Array(n); var t2 = []; for (var c2 = 0; c2 < k; c2++) t2.push(0);
      var ord = hh.map(function (v, j) { return j; }).sort(function (a, b) { return hh[b] - hh[a]; });
      ord.forEach(function (j) { var m = 0; for (var c3 = 1; c3 < k; c3++) if (t2[c3] < t2[m]) m = c3; asg[j] = m; t2[m] += hh[j]; });
    }
    sg.col = []; sg.tot = []; for (var c4 = 0; c4 < k; c4++) { sg.col.push([]); sg.tot.push(0); }
    for (var j2 = 0; j2 < n; j2++) { Array.prototype.push.apply(sg.col[asg[j2]], groups[j2]); sg.tot[asg[j2]] += hh[j2]; }
  }
  /* how much spare height a card takes: a header none, a card with many rows / tiles more (it spreads it thin) */
  function weight(e) {
    if (e.matches(LEAD) && !e.matches(".hot-banner")) return 0;
    if (!boxy(g.getComputedStyle(e)) && e.getBoundingClientRect().height / (parseFloat(e.closest(".panel").style.zoom) || 1) < 48) return 0;
    var n = 0, q = kidsOf(e), d = 0;
    while (q.length && d < 3 && n < 20) {
      var nx = [];
      q.forEach(function (k) { var cs = g.getComputedStyle(k); if (boxy(cs) && k.getBoundingClientRect().height > 24) n++; else Array.prototype.push.apply(nx, kidsOf(k)); });
      q = nx; d++;
    }
    return 1 + Math.min(20, n);
  }
  function trial(panel, root, w, h, z) {
    setZoom(panel, root, w, h, z);
    /* FOOTCOL1 (Dan 10/2): the footer strip is dealt as the last small card of its column (it rides under the
       board's last card), not a full-width row under every column: a lone chip in a full-width strip left a
       dead band across the whole board. A board can keep the old strip with [data-ls-footrow]. */
    var ft = foots(panel), fc = ft.length && !panel.hasAttribute("data-ls-footrow");
    var all = leads(panel).concat(flow(panel)).filter(function (e) { return !e.matches("footer, .ftr") || (fc && ft.indexOf(e) >= 0); });
    if (fc) ft = [];
    all.forEach(function (e) { e.removeAttribute("data-ls-autowide"); });
    var cols = colsFor(panel, w, z, all.length); setCols(panel, root, cols);
    var pcs = g.getComputedStyle(panel), pad = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"].reduce(function (a, k) { return a + (parseFloat(pcs[k]) || 0); }, 0);
    var segs = blocks(all, cols), hs = measure(panel, root, all, ft, segs, z), again = false;
    if (cols > 1) all.forEach(function (e, i) { if (!wideOf(e) && !e.matches(LEAD) && hs[i] > 1.5 * (h / z - pad) && gridish(e)) { e.setAttribute("data-ls-autowide", ""); again = true; } });
    if (again) { segs = blocks(all, cols); hs = measure(panel, root, all, ft, segs, z); }
    var fh = [], total = 0;
    root.setAttribute("data-ls-measure", ""); fh = ft.map(function (e) { return hpx(e, z); }); root.removeAttribute("data-ls-measure");
    segs.forEach(function (sg) {
      if (!sg.list) { sg.max = hs[sg.wide] + GAP; total += sg.max; return; }
      deal(sg, hs, all);
      sg.max = Math.max.apply(null, sg.tot); total += sg.max;
    });
    var bot = 0; fh.forEach(function (v) { bot += Math.ceil((v + 4) / ROW) * ROW; });
    var avail = h / z - pad - bot - 0.5; /* (each column's last card takes its own gap: it has no margin under it) */
    return { z: z, cols: cols, all: all, hs: hs, ft: ft, fh: fh, segs: segs, total: total, avail: avail, fits: total <= avail + 1 && !measure.wide, wide: measure.wide };
  }
  /* FITBEST1 (SPACE-01 per board, 10/2): the same empty-patch measure the gate uses (words, media and controls,
     12px halo, largest empty rectangle in the window). The board tries its column counts and keeps the layout
     whose largest empty patch is smallest; real content only, nothing is added. */
  var COLS_OVR = 0;
  function deadFrac() {
    var W = g.innerWidth, H = g.innerHeight, C = 8, D = 12, cols = Math.ceil(W / C), rows = Math.ceil(H / C), gr = new Uint8Array(cols * rows);
    function vis(e) { for (var a = e; a && a !== document.documentElement; a = a.parentElement) { var c = g.getComputedStyle(a); if (c.display === "none" || c.visibility === "hidden" || +c.opacity < 0.05 || a.hidden) return false; } return true; }
    function mark(r) {
      if (r.width <= 0 || r.height <= 0 || r.bottom < 0 || r.top > H) return;
      var x0 = Math.max(0, Math.floor((r.left - D) / C)), x1 = Math.min(cols - 1, Math.floor((r.right + D) / C)), y0 = Math.max(0, Math.floor((r.top - D) / C)), y1 = Math.min(rows - 1, Math.floor((r.bottom + D) / C));
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) gr[y * cols + x] = 1;
    }
    var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n, seen = new Map();
    while ((n = tw.nextNode())) {
      if (!n.nodeValue.trim() || !n.parentElement) continue;
      var pe = n.parentElement, ok = seen.get(pe); if (ok === undefined) { ok = vis(pe); seen.set(pe, ok); } if (!ok) continue;
      var rg = document.createRange(); rg.selectNodeContents(n); var rs = rg.getClientRects(); for (var i = 0; i < rs.length; i++) mark(rs[i]);
    }
    Array.prototype.forEach.call(document.querySelectorAll("img,svg,canvas,video,button,input,select,textarea,progress,meter,.led,[role=img],[role=progressbar]"), function (e) { if (vis(e)) mark(e.getBoundingClientRect()); });
    var hgt = new Array(cols).fill(0), best = 0, bx = 0, by = 0, bw = 0, bh = 0;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) hgt[x] = gr[y * cols + x] ? 0 : hgt[x] + 1;
      var st = [];
      for (var x2 = 0; x2 <= cols; x2++) {
        var hh = x2 < cols ? hgt[x2] : 0, sx = x2;
        while (st.length && st[st.length - 1][1] >= hh) { var t = st.pop(); sx = t[0]; var a = t[1] * (x2 - sx); if (a > best) { best = a; bx = sx; by = y - t[1] + 1; bw = x2 - sx; bh = t[1]; } }
        st.push([sx, hh]);
      }
    }
    api.rect = { x: bx * C, y: by * C, w: bw * C, h: bh * C }; api.grid = gr; api.gcols = cols;
    return best * C * C / (W * H);
  }
  /* a candidate layout only counts when no placed card spills past its own box or over a neighbour */
  function layoutOk(panel) {
    api.why0 = "";
    var els = Array.prototype.filter.call(panel.querySelectorAll("[" + PLACED + "]"), function (e) { return e.offsetParent || g.getComputedStyle(e).display !== "none"; });
    var rs = els.map(function (e) { return e.getBoundingClientRect(); });
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (rs[i].width < 1) continue;
      if (e.scrollWidth > e.clientWidth + 2) { api.why0 = "wide:" + (e.id || String(e.className).split(" ")[0]) + ":" + e.scrollWidth + "/" + e.clientWidth; return false; }
      for (var j = i + 1; j < els.length; j++) {
        var a = rs[i], b = rs[j];
        if (b.width < 1) continue;
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) { api.why0 = "overlap:" + (e.id || String(e.className).split(" ")[0]) + "x" + (els[j].id || String(els[j].className).split(" ")[0]); return false; }
      }
    }
    return document.documentElement.scrollWidth <= g.innerWidth + 2;
  }
  /* SPLIT1 (SPACE-01 systemic, 10/2). Cause found on the 17 failing boards: the patch sits INSIDE a few big
     sections (a whole list in one box): with 4-6 big boxes over 2-3 columns the columns cannot come out even, the
     one scale is set by the tallest column, and the short columns' boxes are stretched with nothing in them (or
     their short rows leave a stripe). So a big section with 2+ parts is split into its own cards (its title rides
     with the first one), the cards are dealt in strict reading order (each column takes the next run, column-major),
     and the board is packed again. Kept only when the empty patch shrinks and no card spills or overlaps. */
  function splitCands(panel) {
    var H = g.innerHeight, out = [];
    function ok(e, f) {
      if (e.matches(LEAD) || e.matches("footer, .ftr") || e.hasAttribute("data-ls-keep") || e.hasAttribute("data-ls-wide") || e.hasAttribute("data-ls-nosplit") || pictureCard(e)) return false;
      if (e.matches("a, button, [role=button], [role=link], [data-go], [onclick]")) return false; /* a press target stays one card */
      if (e.id && location.hash === "#" + e.id) return false; /* the card a wall press lands on keeps its own box */
      var ks = sections(e); if (ks.length < 2) return false;
      if (e.getBoundingClientRect().height < H * f) return false;
      var r0 = ks[0].getBoundingClientRect();
      return !ks.some(function (k) { var r = k.getBoundingClientRect(); return r.width > 0 && r.left > r0.right - 2; }); /* parts side by side: a grid card */
    }
    flow(panel).forEach(function (e) {
      if (!ok(e, 0.35)) return; out.push(e);
      sections(e).forEach(function (k) { if (ok(k, 0.3)) out.push(k); });
    });
    return out;
  }
  function pack(panel, root, w, h, z0) {
    if (panel.hasAttribute("data-ls-order-auto")) { panel.removeAttribute("data-ls-order"); panel.removeAttribute("data-ls-order-auto"); }
    Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-split]"), function (e) { e.removeAttribute("data-ls-split"); e.removeAttribute("data-ls-flat"); });
    COLS_OVR = 0; packWith(panel, root, w, h, z0);
    api.dead0 = deadFrac(); api.split = []; api.tries = [];
    if (api.dead0 > 0.018 && !panel.hasAttribute("data-ls-fixcols") && !panel.hasAttribute("data-ls-nosplit")) {
      var c0 = api.last.cols, S = splitCands(panel), mine = !panel.hasAttribute("data-ls-order");
      var setSplit = function (on) {
        S.forEach(function (e) { if (on) { e.setAttribute("data-ls-flat", ""); e.setAttribute("data-ls-split", ""); } else { e.removeAttribute("data-ls-split"); e.removeAttribute("data-ls-flat"); } });
        if (mine) { if (on) { panel.setAttribute("data-ls-order", ""); panel.setAttribute("data-ls-order-auto", ""); } else { panel.removeAttribute("data-ls-order"); panel.removeAttribute("data-ls-order-auto"); } }
      };
      /* FITBEST2: the split and the column count are tried together; the layout with the smallest empty patch wins */
      var best = { d: api.dead0, sp: false, c: 0 };
      [[false, c0 + 1], [true, 0], [true, c0 + 1]].forEach(function (cf) {
        if (cf[0] && !S.length) return;
        setSplit(cf[0]); COLS_OVR = cf[1]; packWith(panel, root, w, h, z0);
        var lo = layoutOk(panel), d = lo && api.last.fits ? deadFrac() : 1;
        api.tries.push([cf[0] ? "split" : "whole", api.last.cols, Math.round(d * 1000) / 10, lo ? "ok" : api.why0, api.last.fits]);
        if (d < best.d - 0.002) best = { d: d, sp: cf[0], c: cf[1] };
      });
      setSplit(best.sp); COLS_OVR = best.c; packWith(panel, root, w, h, z0); api.dead0 = deadFrac();
      if (best.sp) api.split = S.map(function (e) { return e.id || String(e.className).split(" ")[0] || e.tagName; });
    }
    api.dead = api.dead0; api.moves = [];
    if (api.dead0 > 0.018 && !panel.hasAttribute("data-ls-fixcols")) spreadOut(panel);
  }
  /* SPREAD1 (SPACE-01 per board, 10/2): where the largest empty patch sits inside a card (short words in a wide
     box), that card first centres its words, then lays its parts side by side across its width (wrapping), and
     takes the largest type scale that still fits. A move is kept only when the patch shrinks and every word and
     control still sits inside its card. Real content only: nothing is added. */
  function hits(panel, r) {
    return Array.prototype.filter.call(panel.querySelectorAll("[" + PLACED + "]"), function (e) { return !e.matches(LEAD) || e.matches(".hot-banner"); }).map(function (e) {
      var b = e.getBoundingClientRect(), ix = Math.min(b.right, r.x + r.w) - Math.max(b.left, r.x), iy = Math.min(b.bottom, r.y + r.h) - Math.max(b.top, r.y);
      return [e, ix > 0 && iy > 0 ? ix * iy : 0];
    }).filter(function (t) { return t[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; }).map(function (t) { return t[0]; });
  }
  /* a card that is mostly one picture (a plate, a photo) keeps its picture-over-label shape */
  function pictureCard(e) {
    var b = e.getBoundingClientRect(), a = b.width * b.height;
    return Array.prototype.some.call(e.querySelectorAll("img, video, canvas"), function (m) { var r = m.getBoundingClientRect(); return a > 0 && r.width * r.height > 0.4 * a; });
  }
  function denseOne(e) {
    e.style.zoom = ""; e.removeAttribute("data-ls-zoomed");
    if (e.clientHeight < 40 || e.clientWidth < 80) return;
    for (var q = DENSE_MAX; q > 1.05; q = q / 1.06) {
      e.style.zoom = String(q);
      if (e.scrollHeight <= e.clientHeight + 1 && e.scrollWidth <= e.clientWidth + 1 && fitsIn(e) && innerOk(e)) { e.setAttribute("data-ls-zoomed", String(Math.round(q * 100) / 100)); return; }
      e.style.zoom = "";
    }
  }
  function emptyIn(r) { /* empty cells of the last measure inside rect r */
    var C = 8, n = 0, x0 = Math.floor(r.x / C), y0 = Math.floor(r.y / C), x1 = x0 + Math.round(r.w / C), y1 = y0 + Math.round(r.h / C);
    for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) if (!api.grid[y * api.gcols + x]) n++;
    return n;
  }
  function cardOk(e) { return e.scrollHeight <= e.clientHeight + 1 && e.scrollWidth <= e.clientWidth + 1 && fitsIn(e) && innerOk(e); }
  function spreadOut(panel) {
    var done = new Set();
    for (var it = 0; it < 24 && api.dead > 0.018; it++) {
      var r = api.rect, cands = hits(panel, r).filter(function (e) { return !done.has(e) && !pictureCard(e); }).slice(0, 2), moved = false;
      for (var ci = 0; ci < cands.length && !moved; ci++) {
        var e = cands[ci], z0 = e.style.zoom, zat = e.getAttribute("data-ls-zoomed"), sp0 = e.getAttribute("data-ls-spread");
        var ORDER = ["even", "mid", "mids", "row"], steps = ORDER.slice(ORDER.indexOf(sp0) + 1);
        for (var si = 0; si < steps.length && !moved; si++) {
          e.setAttribute("data-ls-spread", steps[si]); denseOne(e);
          var d = cardOk(e) && layoutOk(panel) ? deadFrac() : 1, e0 = r.w * r.h / 64, e1 = d < 1 ? emptyIn(r) : e0;
          if (d < api.dead - 0.0005 || (d <= api.dead + 0.0002 && e1 < e0 * 0.85)) { api.moves.push([e.id || e.className.toString().split(" ")[0] || e.tagName, steps[si], Math.round(api.dead * 1000) / 10, Math.round(d * 1000) / 10]); api.dead = d; moved = true; }
        }
        if (!moved) {
          if (sp0) e.setAttribute("data-ls-spread", sp0); else e.removeAttribute("data-ls-spread");
          e.style.zoom = z0; if (zat) e.setAttribute("data-ls-zoomed", zat); else e.removeAttribute("data-ls-zoomed");
          done.add(e); deadFrac();
        }
      }
      if (!moved) { if (!cands.length) break; }
    }
  }
  function packWith(panel, root, w, h, z0) {
    var best = null, zmax = Math.min(ZFIT, z0 * FITMAX);
    for (var z = zmax; z > z0 + 0.001; z = z / 1.06) { var t = trial(panel, root, w, h, z); if (t.fits) { best = t; break; } }
    if (!best) best = trial(panel, root, w, h, z0);
    api.last = { z: best.z, cols: best.cols, total: best.total, avail: best.avail, fits: best.fits };
    unpack(panel, true);
    /* a board that fits one screen gives its spare height to its last block of columns */
    var extra = best.fits ? Math.max(0, best.avail - best.total) : 0, lastBlock = -1;
    best.segs.forEach(function (sg, i) { if (sg.list) lastBlock = i; });
    var r = 1, nseg = best.segs.length, grow = [];
    best.segs.forEach(function (sg, si) {
      if (!sg.list) {
        var s0 = Math.ceil(sg.max / ROW), e0 = best.all[sg.wide]; place(e0, r + " / span " + s0, "1 / -1"); r += s0;
        if (si === nseg - 1) e0.setAttribute("data-ls-end", ""); return;
      }
      var goal = sg.max + (si === lastBlock ? extra : 0), rows = Math.max(1, Math.floor(goal / ROW + 0.001)), span = T / sg.k;
      sg.col.forEach(function (list, c) {
        if (!list.length) return;
        var own = sg.tot[c], spare = Math.max(0, goal - own), acc = 0, prev = 0;
        var wt = list.map(function (i) { return weight(best.all[i]); }), sw = wt.reduce(function (a, b) { return a + b; }, 0);
        if (!sw) { wt = list.map(function () { return 1; }); sw = list.length; }
        list.forEach(function (i, j) {
          var add = spare * wt[j] / sw; acc += best.hs[i] + GAP + add;
          var f = (best.hs[i] + GAP + add) / (best.hs[i] + GAP);
          var end = j === list.length - 1 ? rows : Math.round(acc / ROW), s = Math.max(1, end - prev);
          place(best.all[i], (r + prev) + " / span " + s, (c * span + 1) + " / span " + span); prev += s;
          if (j === list.length - 1 && si === nseg - 1) best.all[i].setAttribute("data-ls-end", "");
          if (f > 1.02) grow.push([best.all[i], f]);
        });
      });
      r += rows;
    });
    best.ft.forEach(function (e, i) { var s = Math.ceil((best.fh[i] + 4) / ROW); place(e, r + " / span " + s, "1 / -1"); e.setAttribute("data-ls-foot", ""); r += s; });
    /* a card that got much taller first grows its type to use the room (largest scale whose words still fit
       the card), then shares out what is left inside */
    grow.forEach(function (it) {
      var e = it[0], f = it[1];
      if (f > 1.12 && !(e.matches(LEAD) && !e.matches(".hot-banner"))) {
        for (var q = Math.min(2.4, f); q > 1.04; q = q / 1.07) {
          e.style.zoom = String(q);
          if (e.scrollHeight <= e.clientHeight + 1 && e.scrollWidth <= e.clientWidth + 1 && fitsIn(e) && innerOk(e)) { e.setAttribute("data-ls-zoomed", String(Math.round(q * 100) / 100)); break; }
          e.style.zoom = "";
        }
      }
      fill(e, 0);
    });
    /* DENSE1 (SPACE-01, Atlas 10/2): every card then takes the largest type scale whose words still fit its own box,
       so a card's words reach across its room instead of leaving a dead band beside them */
    best.all.forEach(function (e) {
      if (e.hasAttribute("data-ls-zoomed") || (e.matches(LEAD) && !e.matches(".hot-banner")) || e.hasAttribute("data-ls-nodense") || pictureCard(e)) return;
      if (e.clientHeight < 40 || e.clientWidth < 80) return;
      for (var q = DENSE_MAX; q > 1.05; q = q / 1.06) {
        e.style.zoom = String(q);
        if (e.scrollHeight <= e.clientHeight + 1 && e.scrollWidth <= e.clientWidth + 1 && fitsIn(e) && innerOk(e)) { e.setAttribute("data-ls-zoomed", String(Math.round(q * 100) / 100)); return; }
        e.style.zoom = "";
      }
    });
    root.style.setProperty("--ls-rows", String(r));
  }
  var DENSE_MAX = 2.2;
  /* no inner box (a slot card, a chip) may spill its words past its own edge at the new scale */
  function innerOk(e) {
    var all = e.querySelectorAll("*");
    for (var i = 0; i < all.length && i < 600; i++) {
      var d = all[i];
      if (!d.clientHeight || !d.clientWidth) continue;
      if (d.scrollHeight > d.clientHeight + 2 || d.scrollWidth > d.clientWidth + 2) {
        var cs = getComputedStyle(d);
        if (cs.display === "inline" || cs.display === "contents") continue;
        /* a plain box (no fill, no border, overflow visible) that a line's superscript pokes out of by a few px
           shows nothing cut or spilled: the card's own fitsIn still holds every word inside the card */
        if (!boxy(cs) && cs.overflowX === "visible" && cs.overflowY === "visible" && d.scrollHeight <= d.clientHeight * 1.15 + 2 && d.scrollWidth <= d.clientWidth * 1.15 + 2) continue;
        return false;
      }
    }
    return true;
  }
  var LEAD = "header, .hdr, [data-ls-lead], [data-ls-span]";
  /* one wrapper holding most of the board (main.ds, div.body) is flattened (display: contents) so its sections
     flow into the columns; a section taller than ~70% of the window is a long list and may continue in the next
     column (its rows never split). Recomputed on every apply (resize). */
  function flatten(panel, vh) {
    Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-flat]"), function (e) { e.removeAttribute("data-ls-flat"); });
    Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-long]"), function (e) { e.removeAttribute("data-ls-long"); });
    if (panel.hasAttribute("data-ls-grid")) return; /* the board brings its own landscape grid */
    sections(panel).forEach(function (e) {
      if (e.matches(LEAD) || e.matches("footer, .ftr") || e.hasAttribute("data-ls-keep")) return;
      var kids = sections(e); if (kids.length < 2) return;
      var tag = e.tagName; if (tag === "MAIN" || e.classList.contains("body") || e.hasAttribute("data-ls-wrapper")) e.setAttribute("data-ls-flat", "");
    });
    /* SPREAD1 · a board marks a long section [data-ls-wrapper] (and its list [data-ls-wrapper]) so its cards are dealt
       one by one into the columns (no column held up by one tall section) */
    Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-wrapper]"), function (e) { if (sections(e).length >= 2) e.setAttribute("data-ls-flat", ""); });
    /* LANDFILL2 · a bare list wrapper (no card of its own) holding 3+ cards lets its cards be dealt one by one */
    if (document.documentElement.hasAttribute("data-ls-pack")) for (var pass = 0; pass < 2; pass++) flow(panel).forEach(function (e) {
      if (e.matches(LEAD) || e.matches("footer, .ftr") || e.hasAttribute("data-ls-keep") || e.hasAttribute("data-ls-wide")) return;
      if (boxy(g.getComputedStyle(e))) return;
      var kids = sections(e); if (kids.length < 3) return;
      var cards = kids.filter(function (k) { return boxy(g.getComputedStyle(k)); }).length;
      if (cards >= 3 && cards >= kids.length - 1) e.setAttribute("data-ls-flat", "");
    });
    flow(panel).forEach(function (e) { if (e.getBoundingClientRect().height / (parseFloat(panel.style.zoom) || 1) > vh * 0.7) e.setAttribute("data-ls-long", ""); });
  }
  function flow(panel) {
    var out = [];
    sections(panel).forEach(function (e) {
      if (e.matches(LEAD)) return;
      (function walk(x, d) { if (x.hasAttribute("data-ls-flat") && d < 4) sections(x).forEach(function (k) { walk(k, d + 1); }); else out.push(x); })(e, 0);
    });
    return out;
  }
  var api = { apply: apply, active: function () { return document.documentElement.hasAttribute("data-landscape"); }, isLandscape: isLandscape };
  api.pictureCard = function (e) { return pictureCard(e); };
  api.why = function (e, q) { var z0 = e.style.zoom; e.style.zoom = String(q); var r = [e.scrollHeight <= e.clientHeight + 1, e.scrollWidth <= e.clientWidth + 1, fitsIn(e), innerOk(e)]; e.style.zoom = z0; return r; };
  api.fitsIn = function (e) { return fitsIn(e); }; api.innerOk = function (e) { return innerOk(e); };
  g.HouseLandscape = api;
  if (isLandscape()) document.documentElement.setAttribute("data-landscape", "");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
  /* PRESSMAP1: a press from the wall lands on page#anchor; the landscape reflow moves it, so bring it back into view once */
  var landed = false;
  function land() {
    if (landed || !location.hash || location.hash.length < 2) return;
    var t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (!t) return;
    landed = true; try { t.scrollIntoView({ block: "start" }); } catch (e) { t.scrollIntoView(); }
  }
  g.addEventListener("load", function () { apply(); setTimeout(land, 60); setTimeout(function () { landed = false; land(); }, 900); });
  g.addEventListener("resize", apply, { passive: true });
  /* SPREAD2 · the type fit measures words: when a web font lands after load, measure again (no word left cut) */
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (isLandscape()) { apply(); sig = sign(); } }); } catch (e) {}
  /* LANDFILL2 · boards fill in their data after first paint (musts, lists, photos): deal the cards again when
     the board's content changes. Only text / child changes are watched, never the attributes apply() sets. */
  var tm = 0, busy = false;
  var sig = "";
  function sign() { var p = document.querySelector(".panel"); return p ? p.getElementsByTagName("*").length + ":" + p.textContent.length : ""; }
  function later() {
    if (busy) return; clearTimeout(tm);
    tm = setTimeout(function () { var s2 = sign(); if (s2 === sig) return; busy = true; try { apply(); } finally { sig = sign(); setTimeout(function () { busy = false; }, 0); } }, 120);
  }
  function watch() {
    var panel = document.querySelector(".panel"); if (!panel || !g.MutationObserver) return;
    new MutationObserver(function (recs) { if (!document.documentElement.hasAttribute("data-ls-pack")) return; later(); }).observe(panel, { childList: true, subtree: true, characterData: true });
    panel.addEventListener("load", function (ev) { if (ev.target && ev.target.tagName === "IMG") later(); }, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
  g.addEventListener("orientationchange", function () { setTimeout(apply, 60); });
})(window);
