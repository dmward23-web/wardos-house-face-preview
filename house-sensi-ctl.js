/* SENSICTL1 · WardOS House Face · live Sensi thermostat control from the hub.
   Tap the thermostat pill → panel with mode (Heat/Cool/Auto/Off) and −/+ setpoints.
   Writes go to Atlas's lights proxy (/api/sensi/set, same screen key as lights).
   HARD LAW: nothing is ever a demo. The panel only shows what the thermostat reports;
   every change is read back from the thermostat before it shows as set. */
(function (global) {
  "use strict";
  var TOKEN_LS = "wardos-lights-proxy-token";
  var MIN_F = 50, MAX_F = 90, DEADBAND = 3, DEBOUNCE_MS = 1200;
  var st = null;          // last real thermostat state from the proxy
  var pending = null;     // { heat, cool } local edits not yet sent
  var timer = null, busy = false, root = null;

  function base() {
    try { if (global.HouseLights && HouseLights.proxyBase) return HouseLights.proxyBase() || ""; } catch (e) {}
    return "";
  }
  function token() { try { return localStorage.getItem(TOKEN_LS) || ""; } catch (e) { return ""; } }
  function headers() {
    var h = { "Content-Type": "application/json", Accept: "application/json" }, t = token();
    if (t) { h["X-Lights-Proxy-Token"] = t; h.Authorization = "Bearer " + t; }
    return h;
  }
  function api(path, body) {
    var b = base();
    if (!b || !token()) return Promise.reject(new Error("nokey"));
    return fetch(b + path, body ? { method: "POST", headers: headers(), body: JSON.stringify(body) } : { headers: headers(), cache: "no-store" })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }
  function tap() { try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {} }

  function css() {
    if (document.getElementById("sensi-ctl-css")) return;
    var s = document.createElement("style"); s.id = "sensi-ctl-css";
    s.textContent = [
      ".sctl-back{position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:16px;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}",
      ".sctl{width:min(460px,100%);background:linear-gradient(160deg,#241d12,#0f0d0a);border:1.5px solid rgba(255,200,80,.6);border-radius:26px;padding:22px 22px 18px;color:#fff3d6;box-shadow:0 0 40px rgba(255,180,40,.2);font-family:inherit}",
      ".sctl-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px}",
      ".sctl-kick{font-size:14px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,224,128,.8)}",
      ".sctl-x{background:none;border:0;color:#ffe08a;font-size:30px;line-height:1;padding:0 4px;cursor:pointer}",
      ".sctl-in{font-size:64px;font-weight:900;line-height:1;margin:8px 0 2px;color:#ffe08a;text-shadow:0 0 18px rgba(255,190,60,.5)}",
      ".sctl-in small{font-size:18px;font-weight:700;color:rgba(255,243,214,.75);margin-left:10px;text-shadow:none}",
      ".sctl-modes{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0 6px}",
      ".sctl-modes button{height:48px;border-radius:14px;border:1.5px solid rgba(255,200,80,.35);background:rgba(255,255,255,.04);color:#fff3d6;font-weight:800;font-size:16px;cursor:pointer}",
      ".sctl-modes button.on{background:linear-gradient(180deg,#ffd76a,#e8a93a);color:#1a1206;border-color:#ffd76a}",
      ".sctl-modes button[data-m=heat].on{background:linear-gradient(180deg,#ff9a4a,#d8561a);border-color:#ff9a4a}",
      ".sctl-modes button[data-m=cool].on{background:linear-gradient(180deg,#7cc8ff,#2a88d0);border-color:#7cc8ff}",
      ".sctl-row{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding:10px 12px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,200,80,.18)}",
      ".sctl-row .lab{font-size:15px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}",
      ".sctl-row[data-k=heat] .lab{color:#ffab6a}.sctl-row[data-k=cool] .lab{color:#8fd3ff}",
      ".sctl-row .val{font-size:44px;font-weight:900;min-width:92px;text-align:center}",
      ".sctl-row button{width:60px;height:60px;border-radius:50%;border:1.5px solid rgba(255,200,80,.5);background:rgba(255,255,255,.06);color:#ffe08a;font-size:34px;font-weight:700;line-height:1;cursor:pointer}",
      ".sctl-row button:active,.sctl-modes button:active{transform:scale(.95)}",
      ".sctl-msg{min-height:22px;margin-top:12px;font-size:15px;font-weight:700;color:rgba(255,243,214,.8);text-align:center}",
      ".sctl-msg.err{color:#ff8a7a}.sctl-msg.ok{color:#9dffb8}",
      ".sctl.is-busy .sctl-modes button,.sctl.is-busy .sctl-row button{opacity:.55;pointer-events:none}",
      ".sctl-off{margin-top:14px;text-align:center;font-weight:700;color:rgba(255,243,214,.6)}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function view() {
    if (!st) return { heat: null, cool: null };
    return { heat: pending && pending.heat != null ? pending.heat : st.heatSetpoint, cool: pending && pending.cool != null ? pending.cool : st.coolSetpoint };
  }
  function running() {
    if (!st || !st.demand) return "";
    if (st.demand.cool > 0) return "Cooling now";
    if (st.demand.heat > 0) return "Heating now";
    return "Idle";
  }
  function msg(text, cls) {
    var m = root && root.querySelector(".sctl-msg"); if (!m) return;
    m.textContent = text || ""; m.className = "sctl-msg" + (cls ? " " + cls : "");
  }
  function row(k, v) {
    return '<div class="sctl-row" data-k="' + k + '"><button type="button" data-d="-1" aria-label="' + k + ' down">−</button>'
      + '<div style="text-align:center"><div class="lab">' + (k === "heat" ? "Heat to" : "Cool to") + '</div><div class="val">' + (v == null ? "—" : v + "°") + "</div></div>"
      + '<button type="button" data-d="1" aria-label="' + k + ' up">+</button></div>';
  }
  function paint() {
    if (!root) return;
    var box = root.querySelector(".sctl"), body = root.querySelector(".sctl-body");
    if (!st) return;
    var v = view(), m = st.mode;
    box.classList.toggle("is-busy", busy);
    root.querySelector(".sctl-in").innerHTML = st.ambient + '°<small>inside · ' + running() + "</small>";
    var h = '<div class="sctl-modes">' + ["heat", "cool", "auto", "off"].map(function (x) {
      return '<button type="button" data-m="' + x + '" class="' + (m === x ? "on" : "") + '">' + x.charAt(0).toUpperCase() + x.slice(1) + "</button>";
    }).join("") + "</div>";
    if (m === "heat" || m === "auto") h += row("heat", v.heat);
    if (m === "cool" || m === "auto") h += row("cool", v.cool);
    if (m === "off") h += '<div class="sctl-off">System is off</div>';
    body.innerHTML = h;
  }

  function load() {
    msg("Checking the thermostat…");
    return api("/api/sensi").then(function (j) { st = j.thermostat; pending = null; paint(); msg(st.online ? "" : "Thermostat is offline", st.online ? "" : "err"); })
      .catch(function (e) { st = null; msg(e.message === "nokey" ? "This screen needs the key before it can change the thermostat." : "Can't reach the thermostat right now.", "err"); });
  }

  function send(body, okText) {
    busy = true; paint(); msg("Sending to the thermostat…");
    return api("/api/sensi/set", body).then(function (j) {
      st = j.thermostat; busy = false; pending = null; paint(); msg(okText(st), "ok");
      repaintChip();
    }).catch(function () {
      busy = false; pending = null; paint(); msg("That didn't go through. Showing what the thermostat has now.", "err");
      load();
    });
  }

  function flush() {
    timer = null;
    if (!pending || !st) return;
    var p = pending, jobs = [];
    if (p.heat != null && p.heat !== st.heatSetpoint) jobs.push({ kind: "temp", mode: "heat", temp: p.heat });
    if (p.cool != null && p.cool !== st.coolSetpoint) jobs.push({ kind: "temp", mode: "cool", temp: p.cool });
    if (!jobs.length) { pending = null; paint(); return; }
    var chain = Promise.resolve();
    jobs.forEach(function (b) {
      chain = chain.then(function () { return send(b, function (t) { return (b.mode === "heat" ? "Heat set to " + t.heatSetpoint : "Cool set to " + t.coolSetpoint) + "°"; }); });
    });
  }

  function bump(k, d) {
    if (!st || busy) return;
    var v = view(), n = (v[k] == null ? (k === "heat" ? 68 : 74) : v[k]) + d;
    n = Math.max(MIN_F, Math.min(MAX_F, n));
    if (st.mode === "auto") {
      if (k === "heat" && v.cool != null && n > v.cool - DEADBAND) { msg("Heat has to stay " + DEADBAND + "° below cool.", "err"); return; }
      if (k === "cool" && v.heat != null && n < v.heat + DEADBAND) { msg("Cool has to stay " + DEADBAND + "° above heat.", "err"); return; }
    }
    pending = pending || {}; pending[k] = n; tap(); paint(); msg("");
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  }

  function repaintChip() {
    var el = document.getElementById("index-sensi-chip");
    if (!el || !st) return;
    var t = el.querySelector(".sensi-hdr-temp"); if (t) t.textContent = st.ambient + "°";
    var s = el.querySelector(".sensi-hdr-set"); if (s) s.textContent = "set " + (/^auto$/i.test(st.mode) && st.heatSetpoint != null && st.coolSetpoint != null ? st.heatSetpoint + "–" + st.coolSetpoint : st.setpoint) + "°"; /* SENSIAUTO1 */
    el.setAttribute("data-mode", st.mode.charAt(0).toUpperCase() + st.mode.slice(1));
  }

  function close() {
    if (timer) { clearTimeout(timer); flush(); }
    if (root) { root.remove(); root = null; }
  }

  function open() {
    css(); if (root) return;
    root = document.createElement("div");
    root.className = "sctl-back";
    root.innerHTML = '<div class="sctl" role="dialog" aria-label="Thermostat"><div class="sctl-top"><div class="sctl-kick">Thermostat</div><button type="button" class="sctl-x" aria-label="Close">×</button></div>'
      + '<div class="sctl-in">—</div><div class="sctl-body"></div><div class="sctl-msg"></div></div>';
    document.body.appendChild(root);
    root.addEventListener("click", function (e) {
      if (e.target === root || e.target.closest(".sctl-x")) return close();
      var mb = e.target.closest("[data-m]");
      if (mb && st && !busy) {
        var m = mb.getAttribute("data-m"); if (m === st.mode) return;
        tap(); return send({ kind: "mode", mode: m }, function (t) { return "Mode set to " + t.mode.charAt(0).toUpperCase() + t.mode.slice(1); });
      }
      var b = e.target.closest(".sctl-row button");
      if (b) bump(b.closest(".sctl-row").getAttribute("data-k"), Number(b.getAttribute("data-d")));
    });
    if (st) paint();
    load();
  }

  function wire() {
    var el = document.getElementById("index-sensi-chip");
    if (!el || el.__sctl) return;
    el.__sctl = true;
    el.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); open(); }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
  global.HouseSensiCtl = { open: open, close: close, load: load };
})(typeof window !== "undefined" ? window : globalThis);
