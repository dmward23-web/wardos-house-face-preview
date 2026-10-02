/* WALLKIT3 · house-wall-actions.js · branch wall-redesign-1 · loaded only by wall.html (not a live page).
   Glue for the wall's two actuators, with every side effect injected so tests can count requests:
     - Scenes: Dan's Kasa scenes through the EXISTING lights client (HouseLights.setLight).
     - Thermostat Travel / Back home through the house hub (/api/sensi/travel, same key + proxy as the hub thermostat).
   No key saved on this screen -> zero requests (same rule as lights AUDIT1 / house-sensi-ctl). */
(function (root, factory) {
  var api = factory(root.HouseWallStatus || (typeof require === "function" ? require("./house-wall-status.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HouseWallActions = api;
})(typeof self !== "undefined" ? self : this, function (S) {
  "use strict";

  function create(deps) {
    deps = deps || {};
    var now = deps.now || function () { return Date.now(); };
    var later = deps.setTimeout || function (fn, ms) { return setTimeout(fn, ms); };
    var cancel = deps.clearTimeout || function (h) { clearTimeout(h); };
    var getToken = deps.getToken || function () { return ""; };
    var getBase = deps.getBase || function () { return ""; };
    var onChange = deps.onChange || function () {};
    var st = { th: deps.initialReading || null, liveAt: null, saved: null, arm: null, busy: false, msg: "" };
    var disarmTimer = null;

    function hasKey() { return !!getToken() && !!getBase(); }
    function headers() {
      var t = getToken();
      return { "Content-Type": "application/json", Accept: "application/json", "X-Lights-Proxy-Token": t, Authorization: "Bearer " + t };
    }
    function call(path, body) {
      if (!hasKey() || !deps.fetch) return Promise.reject(new Error("nokey"));
      var opt = body ? { method: "POST", headers: headers(), body: JSON.stringify(body), cache: "no-store" } : { headers: headers(), cache: "no-store" };
      return deps.fetch(getBase() + path, opt).then(function (r) {
        return r.json().then(function (j) { if (!r.ok || !j || !j.ok) { var e = new Error((j && j.error) || ("HTTP " + r.status)); e.payload = j; throw e; } return j; });
      });
    }

    /* Scenes */
    function scene(id) {
      if (!hasKey() || !deps.lights || typeof deps.lights.setLight !== "function") return { sent: 0, reason: "NEED KEY" };
      if (typeof deps.lights.canWrite === "function" && !deps.lights.canWrite()) return { sent: 0, reason: "lights offline" };
      var plan = S.scenePlan(id);
      plan.forEach(function (w) { deps.lights.setLight(w.id, { on: w.on }); });
      return { sent: plan.length };
    }

    /* Thermostat Travel */
    function setReading(th) { st.th = th || null; onChange(st); }
    function refresh() {
      if (!hasKey()) return Promise.resolve(st);
      return call("/api/sensi/travel").then(function (j) {
        if (j.thermostat) { st.th = j.thermostat; st.liveAt = j.ts || new Date(now()).toISOString(); }
        st.saved = !!j.saved; onChange(st); return st;
      }).catch(function () { st.saved = null; onChange(st); return st; });
    }
    function button() { return S.travelButton(st.th, { hasKey: hasKey(), saved: st.saved, arm: st.arm, now: now() }); }
    function tap() {
      var b = button();
      if (b.disabled || st.busy) return Promise.resolve({ sent: false, button: b });
      var r = S.armTap(st.arm, now());
      if (!r.fire) {
        st.arm = r.arm; st.msg = "";
        if (disarmTimer) cancel(disarmTimer);
        disarmTimer = later(function () { st.arm = null; disarmTimer = null; onChange(st); }, S.ARM_MS);
        onChange(st);
        return Promise.resolve({ sent: false, armed: true, button: button() });
      }
      if (disarmTimer) { cancel(disarmTimer); disarmTimer = null; }
      st.arm = null; st.busy = true; onChange(st);
      return call("/api/sensi/travel", { action: b.action }).then(function (j) {
        st.busy = false; if (j.thermostat) { st.th = j.thermostat; st.liveAt = j.ts || new Date(now()).toISOString(); }
        st.saved = !!j.saved; st.msg = ""; onChange(st);
        return refresh().then(function () { return { sent: true, action: b.action, result: j }; });
      }).catch(function (e) {
        st.busy = false; st.saved = e && e.payload && typeof e.payload.saved === "boolean" ? e.payload.saved : st.saved;
        st.msg = e && /no saved setting/.test(e.message) ? "no saved setting" : "not sent \u00b7 try again";
        onChange(st);
        return { sent: true, action: b.action, error: e && e.message };
      });
    }
    return { hasKey: hasKey, scene: scene, sceneButtons: function () { return S.sceneButtons({ hasKey: hasKey() }); },
      setReading: setReading, refresh: refresh, button: button, tap: tap, state: function () { return st; } };
  }
  return { create: create };
});
