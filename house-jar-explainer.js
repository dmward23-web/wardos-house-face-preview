/* JARX1 · the wall's jar tap lands on sheet-index.html#jar-rules: a short explainer sheet (Atlas 10/2).
   It shows the jar's RULES only: the two locked law lines and the jar names, read from data/house-jar.json.
   Never a balance, a count, a total or money: the only fields read are ruleText, ruleLine2, jars[].name and
   earningRules.status / rules[].when (the "how it fills" lines show only once Dan's yes makes them live).
   Read-only: one GET of data/house-jar.json, no writes. Ledger's house-jar.js is not touched. */
(function (g) {
  "use strict";
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var MONEY = /[$\u00a2\u00a3\u20ac]|\bdollars?\b|\bcents?\b|\bbalance\b|\btotal\b/i;
  function safe(s) { return typeof s === "string" && s.trim() && !MONEY.test(s); }
  function view(d) {
    var out = { lines: [], jars: [], fills: [] };
    if (!d || typeof d !== "object") return out;
    if (safe(d.ruleText)) out.lines.push(d.ruleText.trim());
    if (safe(d.ruleLine2)) out.lines.push(d.ruleLine2.trim());
    (Array.isArray(d.jars) ? d.jars : []).forEach(function (j) { if (j && safe(j.name)) out.jars.push(j.name.trim()); });
    var er = d.earningRules || {}, st = String(er.status || "");
    if (st && !/pending|draft|proposed/i.test(st)) (Array.isArray(er.rules) ? er.rules : []).forEach(function (r) { if (r && safe(r.when)) out.fills.push(r.when.trim()); });
    return out;
  }
  function html(v) {
    if (!v.lines.length) return "";
    return '<h2 class="jx-h">How the jar works</h2>'
      + v.lines.map(function (l) { return '<p class="jx-rule">' + esc(l) + "</p>"; }).join("")
      + (v.fills.length ? '<ul class="jx-fills">' + v.fills.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" : "")
      + (v.jars.length ? '<p class="jx-jars"><span>Jars</span> ' + v.jars.map(esc).join(" \u00b7 ") + "</p>" : "");
  }
  function boot() {
    var host = document.getElementById("jar-rules-body"); if (!host) return;
    fetch("data/house-jar.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) {
      var h = html(view(d)); host.innerHTML = h;
      var sec = document.getElementById("jar-rules"); if (sec) sec.toggleAttribute("data-empty", !h);
    });
  }
  var api = { view: view, html: html };
  g.HouseJarExplainer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
