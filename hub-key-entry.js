/* KEYPASTE2 · WardOS hub: paste the setup link right on the screen.
 * iOS home-screen icons keep their own storage (separate from Safari), so a
 * setup link opened in Safari never reaches the icon. Tapping a camera that
 * says NEED KEY opens this box; paste the link (or the keys) once and both the
 * lights + camera keys are saved on THIS screen. Keys never live in the repo. */
(function () {
  "use strict";
  var LIGHTS_LS = "wardos-lights-proxy-token";
  var NEST_LS = "wardosNestProxyToken";

  function parseKeys(text) {
    text = String(text || "").trim();
    var out = { lights: "", nest: "" };
    var m = text.match(/lightsProxyToken=([A-Za-z0-9_-]+)/);
    if (m) out.lights = m[1];
    m = text.match(/nestProxyToken=([A-Za-z0-9_-]+)/);
    if (m) out.nest = m[1];
    if (!out.lights) { m = text.match(/\blights-[A-Za-z0-9]{16,}\b/); if (m) out.lights = m[0]; }
    if (!out.nest) { m = text.match(/\bnest-[A-Za-z0-9]{16,}\b/); if (m) out.nest = m[0]; }
    return out;
  }

  function el(tag, css, txt) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function openBox() {
    if (document.getElementById("hub-key-entry")) return;
    var wrap = el("div", "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;");
    wrap.id = "hub-key-entry";
    var card = el("div", "width:100%;max-width:420px;background:#17120a;border:2px solid #e8b64a;border-radius:18px;padding:20px;color:#f6ead0;font:16px/1.35 -apple-system,system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6);");
    card.appendChild(el("div", "font-weight:800;font-size:20px;color:#ffd36b;margin-bottom:6px;", "Add key to this screen"));
    card.appendChild(el("div", "opacity:.85;margin-bottom:12px;", "Paste the setup link Atlas sent you. It saves the lights and camera keys on this screen only."));
    var input = el("textarea", "width:100%;box-sizing:border-box;min-height:84px;border-radius:12px;border:1px solid #8a6a2a;background:#0d0a05;color:#fff;padding:10px;font:14px/1.3 ui-monospace,monospace;");
    input.setAttribute("placeholder", "Paste link here");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("spellcheck", "false");
    card.appendChild(input);
    var msg = el("div", "min-height:20px;margin:8px 0;color:#ff9b7a;font-size:14px;", "");
    card.appendChild(msg);
    var row = el("div", "display:flex;gap:10px;");
    var cancel = el("button", "flex:1;padding:12px;border-radius:12px;border:1px solid #6b5a3a;background:#2a2217;color:#f6ead0;font-weight:700;font-size:16px;", "Cancel");
    var save = el("button", "flex:1;padding:12px;border-radius:12px;border:0;background:linear-gradient(#ffd36b,#e0a33a);color:#1b1206;font-weight:800;font-size:16px;", "Save");
    row.appendChild(cancel);
    row.appendChild(save);
    card.appendChild(row);
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    cancel.addEventListener("click", function () { wrap.remove(); });
    wrap.addEventListener("click", function (e) { if (e.target === wrap) wrap.remove(); });
    /* OCT8-3c: a read-only preview never keeps a key (the guard drops the write), so it says so instead of a fake save */
    var ro = !!window.WARDOS_PREVIEW;
    if (ro) {
      msg.style.color = "#f6ead0";
      msg.textContent = "This preview is read only. It can't keep a key. Add the key on the real board.";
      input.disabled = true; save.disabled = true; save.style.opacity = "0.45"; save.setAttribute("aria-disabled", "true");
    }
    save.addEventListener("click", function () {
      if (ro) return;
      var k = parseKeys(input.value);
      if (!k.lights && !k.nest) {
        msg.textContent = "That doesn't look like the setup link. Paste the whole link.";
        return;
      }
      try {
        if (k.lights) localStorage.setItem(LIGHTS_LS, k.lights);
        if (k.nest) localStorage.setItem(NEST_LS, k.nest);
      } catch (e) {
        msg.textContent = "This screen won't save it (private browsing?).";
        return;
      }
      msg.style.color = "#9be39b";
      msg.textContent = "Saved. Reloading…";
      var q = location.search.replace(/^\?/, "").split("&").filter(function (kv) {
        return kv && !/^(lightsProxyToken|nestProxyToken|proxyToken)=/.test(kv);
      }).join("&");
      setTimeout(function () { location.replace(location.pathname + (q ? "?" + q : "")); }, 400);
    });
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    var tile = t && t.closest ? t.closest("#hub-cam-deck .hub-cam, [data-hub-key-entry]") : null;
    if (!tile) return;
    var pill = tile.querySelector ? tile.querySelector(".hub-cam-pill") : null;
    var noKey = false;
    try { noKey = !localStorage.getItem(NEST_LS) && !/nestProxyToken=/.test(location.search); } catch (_) {}
    var need = tile.hasAttribute("data-hub-key-entry") || noKey || (pill && /NEED KEY/i.test(pill.textContent || ""));
    if (!need) return;
    e.preventDefault();
    e.stopPropagation();
    openBox();
  }, true);

  /* OCT8-1: the box never opens by itself (it used to pop 1.2 s after load on a phone with no camera key).
     It opens only when a person taps something that needs the key: a cam tile that says NEED KEY or
     [data-hub-key-entry] (the click handler above). */

  window.WardHubKeyEntry = { open: openBox, parse: parseKeys };
})();
