/* LEDGER · house-grocery-list.js · branch wall-redesign-ledger · not deployed, not wired.
   FIVE UPGRADES #2 (Dan, Oct 1): the grocery tile IS the list. Add, check and clear on the tile.
   Costco is a filter on the same list, not a second tile. Nothing links out. No dollars.
   Seed: data/grocery-list.json (Ledger writes; items start EMPTY, chips/pick list resolve via catalog). Wall state: PER DEVICE in localStorage "wardos.grocery.v1".
   Shared cross-screen store "house.grocery.shared.v1" is LAST-YES: documented only, NOT built here.
   No fetch except load(), no timers, no network writes. Contract: docs/grocery-list-CONTRACT.md */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HouseGroceryList = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var STORAGE_KEY = "wardos.grocery.v1";
  var SHARED_KEY_LAST_YES = "house.grocery.shared.v1"; /* documented only; nothing reads or writes it */
  var SEED_URL = "data/grocery-list.json";
  var STORES = ["any", "costco"];
  /* No-dollars / no-links guard: anything that looks like money, a deal, or a URL never enters the list. */
  var UNSAFE = /[$¢€£]|\b\d+\.\d{1,2}\b|https?:|www\.|\b(price|prices|total|totals|deal|deals|sale|coupon|coupons|balance|balances|bogo)\b/i;

  function isUnsafe(s) { return UNSAFE.test(String(s == null ? "" : s)); }
  function normalize(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/['\u2019]/g, "").replace(/[^a-z0-9%]+/g, " ").trim();
  }
  function slug(s) {
    return "g-" + normalize(s).replace(/%/g, "pct").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function cleanStore(s) { return STORES.indexOf(s) >= 0 ? s : null; }
  function ctNowIso(ms) {
    /* ISO with the America/Chicago offset, e.g. 2026-10-01T18:25:00-05:00 */
    var d = new Date(ms);
    var p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    var off = Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
    var sign = off < 0 ? "-" : "+", a = Math.abs(off);
    var hh = String(Math.floor(a / 60)).padStart(2, "0"), mm = String(a % 60).padStart(2, "0");
    return p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute + ":" + p.second + sign + hh + ":" + mm;
  }
  function copy(it) { return { id: it.id, name: it.name, store: it.store, checked: !!it.checked, addedAt: it.addedAt }; }
  function validItem(it) {
    return it && typeof it.id === "string" && it.id && typeof it.name === "string" && normalize(it.name) &&
      !isUnsafe(it.name) && cleanStore(it.store) !== null;
  }
  function memStorage() {
    var m = {};
    return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } };
  }

  /* create({ seed, storage, now }) -> list API. seed = parsed data/grocery-list.json (may be null).
     storage = window.localStorage (or any getItem/setItem shim); falls back to memory if it throws. */
  function create(opts) {
    opts = opts || {};
    var seed = opts.seed && typeof opts.seed === "object" ? opts.seed : {};
    var store = opts.storage || memStorage();
    var now = opts.now || function () { return Date.now(); };

    /* Catalog = everything the wall may add without a keyboard: seed items, quick-add chips, pick list. */
    var catalog = [];
    function catAdd(entry) {
      if (!entry || !entry.name || isUnsafe(entry.name)) return;
      if (catalog.some(function (c) { return c.id === entry.id || normalize(c.name) === normalize(entry.name); })) return;
      catalog.push({ id: entry.id, name: entry.name, store: cleanStore(entry.store) || "any" });
    }
    function validEntry(c) { return c && typeof c.id === "string" && /^g-[a-z0-9-]+$/.test(c.id) && typeof c.name === "string" && normalize(c.name) && cleanStore(c.store) !== null; }
    /* seed.catalog = {id, name, store} for every real item the chips and pick list may add (list starts empty). */
    (Array.isArray(seed.catalog) ? seed.catalog : []).filter(validEntry).forEach(catAdd);
    (Array.isArray(seed.items) ? seed.items : []).filter(validItem).forEach(catAdd);
    function resolveRef(ref) {
      if (ref && typeof ref === "object") ref = ref.id || ref.name;
      var s = String(ref == null ? "" : ref).trim();
      var hit = catalog.filter(function (c) { return c.id === s || normalize(c.name) === normalize(s); })[0];
      if (hit) return hit;
      if (/^g-[a-z0-9-]+$/.test(s)) return null; /* an id that is not in the catalog never becomes an item named "g-…" */
      return s && !isUnsafe(s) ? { id: slug(s), name: s, store: "any" } : null;
    }
    var quick = (Array.isArray(seed.quickAdd) ? seed.quickAdd : []).map(resolveRef).filter(Boolean);
    quick.forEach(catAdd);
    var picks = (Array.isArray(seed.pickList) ? seed.pickList : []).map(resolveRef).filter(Boolean);
    picks.forEach(catAdd);

    /* Device state: { v:1, items:[...], cleared:[ids] }. "cleared" keeps cleared seed items from coming back. */
    function read() {
      try { var raw = store.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
    }
    function write() {
      try { store.setItem(STORAGE_KEY, JSON.stringify({ v: 1, items: items.map(copy), cleared: cleared.slice() })); }
      catch (e) { store = memStorage(); store.setItem(STORAGE_KEY, JSON.stringify({ v: 1, items: items.map(copy), cleared: cleared.slice() })); }
    }
    var saved = read();
    var items = [], cleared = [];
    if (saved && saved.v === 1 && Array.isArray(saved.items)) {
      saved.items.filter(validItem).forEach(function (it) {
        if (!items.some(function (x) { return x.id === it.id || normalize(x.name) === normalize(it.name); })) items.push(copy(it));
      });
      cleared = Array.isArray(saved.cleared) ? saved.cleared.filter(function (x) { return typeof x === "string"; }) : [];
    }
    /* Merge: seed items this device has never seen (and never cleared) are appended. */
    (Array.isArray(seed.items) ? seed.items : []).filter(validItem).forEach(function (it) {
      if (cleared.indexOf(it.id) >= 0) return;
      if (items.some(function (x) { return x.id === it.id || normalize(x.name) === normalize(it.name); })) return;
      items.push({ id: it.id, name: it.name, store: it.store, checked: false, addedAt: it.addedAt || ctNowIso(now()) });
    });

    function byId(id) { return items.filter(function (x) { return x.id === id; })[0] || null; }

    /* add(nameOrId, store?) -> item copy, or null if rejected (empty, price/link-like text).
       Dedupe on normalized name: unchecked already on list = no-op; checked = unchecks it. */
    function add(nameOrId, storeArg) {
      var ref = resolveRef(nameOrId);
      if (!ref) return null;
      var existing = byId(String(nameOrId).trim()) || byId(ref.id) ||
        items.filter(function (x) { return normalize(x.name) === normalize(ref.name); })[0];
      if (existing) {
        if (existing.checked) { existing.checked = false; write(); }
        return copy(existing);
      }
      var id = ref.id, n = 2;
      while (byId(id)) id = ref.id + "-" + (n++);
      var it = { id: id, name: ref.name, store: cleanStore(storeArg) || ref.store || "any", checked: false, addedAt: ctNowIso(now()) };
      items.push(it);
      cleared = cleared.filter(function (x) { return x !== id; });
      write();
      return copy(it);
    }
    /* toggle(id) -> item copy with the new checked state, or null if unknown. */
    function toggle(id) {
      var it = byId(id);
      if (!it) return null;
      it.checked = !it.checked;
      write();
      return copy(it);
    }
    /* clearChecked() -> number removed. Removes CHECKED items only; unchecked items stay. */
    function clearChecked() {
      var gone = items.filter(function (x) { return x.checked; });
      if (!gone.length) return 0;
      gone.forEach(function (x) { if (cleared.indexOf(x.id) < 0) cleared.push(x.id); });
      items = items.filter(function (x) { return !x.checked; });
      write();
      return gone.length;
    }
    /* filter('all'|'costco') -> item copies. 'costco' = store==='costco'. Anything else = 'all'. */
    function filter(which) {
      return items.filter(function (x) { return which === "costco" ? x.store === "costco" : true; }).map(copy);
    }
    function list() { return items.map(copy); }
    /* Chips and pick list for the no-keyboard add UI. onList = an unchecked copy is already on the list. */
    function decorate(c) {
      var on = items.filter(function (x) { return normalize(x.name) === normalize(c.name) && !x.checked; })[0];
      return { id: c.id, name: c.name, store: c.store, onList: !!on };
    }
    function quickAdd() { return quick.map(decorate); }
    function pickList() { return picks.map(decorate); }

    write();
    return { add: add, toggle: toggle, clearChecked: clearChecked, filter: filter, list: list,
      quickAdd: quickAdd, pickList: pickList, asOfIso: typeof seed.asOfIso === "string" ? seed.asOfIso : null };
  }

  /* load({ fetch, storage, now, url }) -> Promise<list API>. Seed fetch failure still returns a working
     list from device state (no stale window, no error badge). */
  function load(opts) {
    opts = opts || {};
    var f = opts.fetch || (typeof fetch === "function" ? fetch : null);
    var url = (opts.url || SEED_URL) + "?t=" + Date.now();
    var go = f ? f(url, { cache: "no-store" }).then(function (r) { return r && r.ok ? r.json() : null; }) : Promise.resolve(null);
    return go.catch(function () { return null; }).then(function (seed) {
      return create({ seed: seed, storage: opts.storage || (typeof localStorage !== "undefined" ? localStorage : null), now: opts.now });
    });
  }

  return { create: create, load: load, normalize: normalize, slug: slug, isUnsafe: isUnsafe,
    STORAGE_KEY: STORAGE_KEY, SHARED_KEY_LAST_YES: SHARED_KEY_LAST_YES, SEED_URL: SEED_URL };
});
