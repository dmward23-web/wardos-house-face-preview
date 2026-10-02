/* House face · Prism saves · collapsed 36px bar · overlays · ★ only · no $ */
(function (global) {
  "use strict";

  var KEY = "house-saves:v1";
  /* JARMATH1 · no seeded sample saves ("Gem stash $8" etc.). Nothing DEMO:
   * a save shows only when the kid writes one in. Old seed rows are dropped. */
  var DEFAULTS = { ainsley: [], hayes: [], harris: [] };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadRoot() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveRoot(root) {
    try { localStorage.setItem(KEY, JSON.stringify(root)); } catch (e) { /* */ }
  }

  function list(kidId) {
    var root = loadRoot();
    if (root[kidId] && root[kidId].some(function (x) { return x && /^seed-/.test(String(x.id || "")); })) {
      root[kidId] = root[kidId].filter(function (x) { return x && !/^seed-/.test(String(x.id || "")); });
      saveRoot(root);
    }
    if (!root[kidId]) {
      root[kidId] = (DEFAULTS[kidId] || []).map(function (x) {
        return { id: x.id, name: x.name, need: x.need || 0, created: Date.now() };
      });
      saveRoot(root);
    }
    return root[kidId].slice();
  }

  function uid() {
    return "save-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function add(kidId, name, need) {
    name = String(name || "").trim();
    if (!name) return null;
    need = parseInt(need, 10);
    if (isNaN(need) || need < 0) need = 0;
    var root = loadRoot();
    if (!root[kidId]) root[kidId] = list(kidId);
    var item = { id: uid(), name: name, need: need, created: Date.now() };
    root[kidId].push(item);
    saveRoot(root);
    return item;
  }

  function update(kidId, id, name, need) {
    var root = loadRoot();
    var arr = root[kidId] || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        if (name != null) arr[i].name = String(name).trim() || arr[i].name;
        if (need != null) {
          var n = parseInt(need, 10);
          arr[i].need = isNaN(n) || n < 0 ? 0 : n;
        }
        saveRoot(root);
        return arr[i];
      }
    }
    return null;
  }

  function remove(kidId, id) {
    var root = loadRoot();
    root[kidId] = (root[kidId] || []).filter(function (x) { return x.id !== id; });
    saveRoot(root);
  }

  function bankToward(kidId) {
    try {
      if (global.WardKids && global.WardKids._data && global.WardKids.getBankView) {
        var b = global.WardKids.getBankView(kidId, global.WardKids._data);
        if (!b) return 0;
        /* Prefer durable balance$ + this week earn for money carry / personal saves */
        if (b.balance != null || b.weekEarn != null) {
          return (Number(b.balance) || 0) + (Number(b.weekEarn) || 0);
        }
        if (b.available != null) return Number(b.available) || 0;
        return b.lifetime || b.toward || 0;
      }
    } catch (e) { /* */ }
    return 0;
  }

  function primary(kidId) {
    var items = list(kidId);
    if (!items.length) return null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].need > 0) return items[i];
    }
    return items[0];
  }

  function shortName(name, max) {
    name = String(name || "");
    max = max || 22;
    if (name.length <= max) return name;
    return name.slice(0, max - 1) + "…";
  }

  function closeOverlays() {
    document.querySelectorAll(".saves-overlay").forEach(function (el) {
      el.remove();
    });
  }

  function openOverlay(innerHTML, onMount) {
    closeOverlays();
    var ov = document.createElement("div");
    ov.className = "saves-overlay";
    ov.innerHTML =
      '<button type="button" class="saves-backdrop" data-saves-backdrop aria-label="Close"></button>' +
      '<div class="saves-sheet" role="dialog" aria-modal="true">' + innerHTML + "</div>";
    document.body.appendChild(ov);
    function kill() { closeOverlays(); }
    ov.querySelector("[data-saves-backdrop]").addEventListener("click", kill);
    ov.addEventListener("click", function (e) {
      if (e.target === ov) kill();
    });
    if (!document._savesEsc) {
      document._savesEsc = true;
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeOverlays();
      });
    }
    if (onMount) onMount(ov);
    return ov;
  }

  function openAddSheet(kidId) {
    openOverlay(
      '<div class="saves-sheet-title">Add a save</div>' +
        '<form class="saves-add-form" data-saves-add-form autocomplete="off">' +
        '<input class="saves-add-name" type="text" name="save-name" maxlength="48" placeholder="Saving for…" required />' +
        '<input class="saves-add-need" type="number" name="save-need" min="0" max="999" inputmode="numeric" placeholder="★" title="Optional ★ target" />' +
        '<button type="submit" class="saves-add-save">Save</button>' +
        "</form>",
      function (ov) {
        var form = ov.querySelector("[data-saves-add-form]");
        var nameEl = form.querySelector(".saves-add-name");
        setTimeout(function () { nameEl.focus(); }, 40);
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var name = nameEl.value;
          var need = form.querySelector(".saves-add-need").value;
          if (!String(name).trim()) { nameEl.focus(); return; }
          add(kidId, name, need);
          closeOverlays();
          renderAll(kidId);
          if (window.HouseSfx) HouseSfx.tap();
        });
      }
    );
  }

  function openListSheet(kidId) {
    var items = list(kidId);
    var toward = bankToward(kidId);
    var rows;
    if (!items.length) {
      rows = '<div class="saves-list-empty">No saves yet — tap +</div>';
    } else {
      rows = items.map(function (it) {
        var meta = it.need > 0
          ? (Math.min(toward, it.need) + "/" + it.need + " ★") /* KIDPATH2: no $ on kid paths */
          : "★ later";
        return (
          '<div class="saves-list-row" data-save-id="' + esc(it.id) + '">' +
            '<span class="saves-list-name">' + esc(it.name) + "</span>" +
            '<span class="saves-list-meta">' + esc(meta) + "</span>" +
            '<button type="button" class="saves-list-del" data-save-del title="Remove">×</button>' +
          "</div>"
        );
      }).join("");
    }
    openOverlay(
      '<div class="saves-sheet-title">Saves</div>' +
        '<div class="saves-list-scroll">' + rows + "</div>" +
        '<button type="button" class="saves-list-add" data-saves-list-add>+ Add</button>',
      function (ov) {
        ov.querySelector("[data-saves-list-add]").addEventListener("click", function () {
          closeOverlays();
          openAddSheet(kidId);
        });
        ov.querySelector(".saves-list-scroll").addEventListener("click", function (e) {
          var del = e.target.closest("[data-save-del]");
          var row = e.target.closest(".saves-list-row");
          if (!row) return;
          var id = row.getAttribute("data-save-id");
          if (del) {
            remove(kidId, id);
            closeOverlays();
            renderAll(kidId);
            if (window.HouseSfx) HouseSfx.tap();
            return;
          }
          var items2 = list(kidId);
          var cur = null;
          for (var i = 0; i < items2.length; i++) if (items2[i].id === id) cur = items2[i];
          if (!cur) return;
          var nn = window.prompt("Save name", cur.name);
          if (nn == null) return;
          var nd = window.prompt("★ target (blank = none)", cur.need ? String(cur.need) : "");
          if (nd == null) return;
          update(kidId, id, nn, nd === "" ? 0 : nd);
          closeOverlays();
          renderAll(kidId);
          if (window.HouseSfx) HouseSfx.tap();
        });
      }
    );
  }

  function faceHTML(kidId) {
    var item = primary(kidId);
    var toward = bankToward(kidId);
    var label;
    var pct = 0;
    if (!item) {
      label = "Saves · tap + to add";
    } else if (item.need > 0) {
      var banked = Math.min(toward, item.need);
      label = "Saves · " + shortName(item.name, 20) + "  " + banked + "/" + item.need + " ★";
      pct = Math.max(0, Math.min(100, Math.round((banked / item.need) * 100)));
    } else {
      label = "Saves · " + shortName(item.name, 24) + "  ★";
    }
    return (
      '<div class="saves-face" data-saves-face>' +
        '<button type="button" class="saves-bar" data-saves-bar title="Open saves">' +
          '<span class="saves-bar-text">' + esc(label) + "</span>" +
          '<span class="saves-meter" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' +
        "</button>" +
        '<button type="button" class="saves-plus" data-saves-plus aria-label="Add a save">+</button>' +
      "</div>"
    );
  }

  function wireHost(host) {
    var kidId = host.getAttribute("data-kid");
    if (!kidId) return;
    list(kidId);
    host.className = "saves-host theme-" + kidId;
    host.setAttribute("data-saves-panel", "");
    host.setAttribute("data-kid", kidId);
    host.innerHTML = faceHTML(kidId);

    var bar = host.querySelector("[data-saves-bar]");
    var plus = host.querySelector("[data-saves-plus]");
    if (bar) {
      bar.addEventListener("click", function () {
        openListSheet(kidId);
        if (window.HouseSfx) HouseSfx.tap();
      });
    }
    if (plus) {
      plus.addEventListener("click", function (e) {
        e.stopPropagation();
        openAddSheet(kidId);
        if (window.HouseSfx) HouseSfx.tap();
      });
    }
  }

  function refreshGoalChips(kidId) {
    if (!global.WardKids || !global.WardKids.personalGoalView) return;
    try {
      var data = global.WardKids._data;
      if (!data) return;
      var bank = global.WardKids.getBankView ? global.WardKids.getBankView(kidId, data) : null;
      var gv = global.WardKids.personalGoalView(kidId, data, bank);
      document.querySelectorAll("[data-goal-chip]").forEach(function (el) {
        var scopeKid = el.getAttribute("data-kid")
          || (el.closest("[data-kid]") && el.closest("[data-kid]").getAttribute("data-kid"))
          || (el.closest("[data-bank-kid]") && el.closest("[data-bank-kid]").getAttribute("data-bank-kid"));
        if (scopeKid && scopeKid !== kidId) return;
        el.classList.remove("is-met", "is-active", "is-empty");
        if (!gv.active) {
          el.textContent = "Add a save";
          el.classList.add("is-empty");
        } else if (gv.met) {
          el.textContent = "Goal met · " + gv.name;
          el.classList.add("is-met", "is-active");
        } else {
          el.textContent = gv.name + " · " + (gv.toward || 0) + "/" + gv.need + " ★";
          el.classList.add("is-active");
        }
      });
      if (global.WardKids && global.WardKids.renderGrow && bank) {
        global.WardKids.renderGrow(document, kidId, data, bank);
      }
    } catch (e) { /* */ }
  }

  function renderAll(kidId) {
    document.querySelectorAll('[data-saves-panel][data-kid="' + kidId + '"], .saves-host[data-kid="' + kidId + '"]').forEach(wireHost);
    refreshGoalChips(kidId);
  }

  function mount(kidId) {
    var nodes = kidId
      ? document.querySelectorAll('[data-saves-panel][data-kid="' + kidId + '"], .saves-host[data-kid="' + kidId + '"]')
      : document.querySelectorAll("[data-saves-panel][data-kid], .saves-host[data-kid]");
    nodes.forEach(wireHost);
    if (kidId) refreshGoalChips(kidId);
  }

  global.HouseSaves = {
    KEY: KEY,
    list: list,
    add: add,
    update: update,
    remove: remove,
    mount: mount,
    renderAll: renderAll,
    closeOverlays: closeOverlays
  };
})(window);
