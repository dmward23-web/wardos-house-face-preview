/* House Face · Nest / Google Home cams
   Poll data/nest-live.json (Atlas nest-fetch → Pages).
   NEVER invent video. Roster LIVE when status=live + fresh.
   CAMLIVE2: hub deck WebRTC <video> · LIVE pill ONLY when frames play (never on JPEG).
   Still images only when snapshotUrl is a real Pages-servable path.
   NESTVID1: when localStorage empty, auto-use nestProxy + nestProxyToken
   from nest-live.json (public CF URL). No ?proxy= seed required.
   See NEST-LIVE.md
   Keys: wardosNestProxy · wardosNestProxyToken */
(function (global) {
  "use strict";

  var LIVE_URL = "data/nest-live.json";
  var LIVE_FRESH_MS = 30 * 60 * 1000;
  var LIVE_POLL_MS = 60 * 1000;
  var DOCS = "NEST-LIVE.md";
  var PROXY_LS_KEY = "wardosNestProxy";
  var PROXY_TOKEN_LS_KEY = "wardosNestProxyToken";
  var DEFAULT_PROXY = "http://127.0.0.1:8787";

  var _liveCache = null;
  var _listeners = [];

  function parseUpdatedAt(iso) {
    if (!iso) return 0;
    var t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }

  function ageMs(data) {
    if (!data) return Infinity;
    var t = parseUpdatedAt(data.fetchedAt || data.updatedAt);
    if (!t) return Infinity;
    return Date.now() - t;
  }

  function countSnaps(data) {
    var cams = (data && data.cameras) || [];
    var n = 0;
    for (var i = 0; i < cams.length; i++) {
      if (cams[i] && cams[i].snapshotUrl) n++;
    }
    return n;
  }

  function hasFreshSnapshots(data) {
    if (!data || data.status !== "live") return false;
    if (ageMs(data) > LIVE_FRESH_MS) return false;
    return countSnaps(data) > 0;
  }

  /**
   * Gate for UI.
   * live=true when SDM roster is fresh (status=live) — device names OK.
   * hasSnaps=true only when ≥1 embeddable snapshotUrl (Pages-safe path).
   * Never invent video.
   */
  function gate(data) {
    /* NEED TOKEN only when status===need_token. status=live ⇒ live (aging OK). */
    if (!data) {
      return {
        live: false,
        hasSnaps: false,
        needToken: false,
        label: "STUB · NO JSON",
        reason: "missing nest-live.json",
        deviceCount: 0,
      };
    }
    if (data.status === "need_token") {
      return {
        live: false,
        hasSnaps: false,
        needToken: true,
        label: "NEED TOKEN",
        reason: data.error || "need SDM token",
        deviceCount: 0,
      };
    }
    if (data.status === "error") {
      return {
        live: false,
        hasSnaps: false,
        needToken: false,
        label: "ERROR",
        reason: data.error || "error",
        deviceCount: 0,
      };
    }
    if (data.status === "live") {
      var fresh = ageMs(data) <= LIVE_FRESH_MS;
      var cams = data.cameras || [];
      var real = 0;
      for (var i = 0; i < cams.length; i++) {
        if (cams[i] && !String(cams[i].id || "").startsWith("stub-")) real++;
      }
      var deviceCount = data.cameraCount != null ? data.cameraCount : real;
      var snaps = countSnaps(data);
      var hasSnaps = snaps > 0;
      if (!fresh) {
        return {
          live: true,
          hasSnaps: hasSnaps,
          needToken: false,
          label: hasSnaps ? "LIVE · aging" : "LIVE · aging · no still",
          reason: "nest-live.json aging (>30m)",
          deviceCount: deviceCount,
        };
      }
      if (hasSnaps) {
        return {
          live: true,
          hasSnaps: true,
          needToken: false,
          label: "LIVE",
          reason: null,
          deviceCount: deviceCount,
        };
      }
      return {
        live: true,
        hasSnaps: false,
        needToken: false,
        label: "LIVE · NO STILL",
        reason:
          "SDM live · " +
          deviceCount +
          " cam(s) · stills pending (WEB_RTC-only · GenerateImage needs event + auth proxy)",
        deviceCount: deviceCount,
      };
    }
    return {
      live: false,
      hasSnaps: false,
      needToken: false,
      label: "STUB",
      reason: "unknown status",
      deviceCount: 0,
    };
  }

  function notify() {
    for (var i = 0; i < _listeners.length; i++) {
      try {
        _listeners[i]();
      } catch (e) {
        /* */
      }
    }
  }

  function onChange(fn) {
    if (typeof fn === "function") _listeners.push(fn);
  }

  function cachedData() {
    return _liveCache && _liveCache.data ? _liveCache.data : null;
  }

  function fetchLive() {
    return fetch(LIVE_URL + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        _liveCache = { at: Date.now(), data: data };
        notify();
        return data;
      })
      .catch(function () {
        if (!_liveCache) _liveCache = { at: Date.now(), data: null };
        notify();
        return null;
      });
  }

  var _pollTimer = null;
  function startPolling() {
    fetchLive();
    if (_pollTimer) return;
    _pollTimer = setInterval(fetchLive, LIVE_POLL_MS);
  }

  function glyphFor(cam) {
    var n = String((cam && (cam.where || cam.name)) || "").toLowerCase();
    if (/entry|front|door|doorbell/.test(n)) return "🚪";
    if (/drive/.test(n)) return "🚗";
    if (/yard|back|patio/.test(n)) return "🌳";
    if (/garage/.test(n)) return "🏠";
    if (/kitchen/.test(n)) return "🍳";
    if (/living|family|inside/.test(n)) return "🛋";
    return "📷";
  }

  function shortName(cam) {
    var n = String((cam && cam.name) || "Nest cam").replace(/\s+camera$/i, "").trim();
    return n || "Nest cam";
  }

  function ensurePads(grid, count) {
    var articles = grid.querySelectorAll(".cam");
    while (articles.length < count) {
      var art = document.createElement("article");
      art.className = "cam";
      art.setAttribute("aria-label", "camera");
      art.innerHTML =
        '<div class="cam-feed">' +
        '<span class="cam-live stub"><i></i>…</span>' +
        '<span class="cam-glyph" aria-hidden="true">📷</span>' +
        '<span class="cam-stub"></span>' +
        "</div>" +
        '<div class="cam-meta">' +
        '<div class="cam-name">Cam</div>' +
        '<div class="cam-where">Cam</div>' +
        "</div>";
      grid.appendChild(art);
      art.addEventListener(
        "pointerdown",
        function () {
          try {
            if (window.HouseSfx && HouseSfx.tap) HouseSfx.tap();
          } catch (e) {}
        },
        { passive: true }
      );
      articles = grid.querySelectorAll(".cam");
    }
    while (articles.length > count && articles.length > 0) {
      grid.removeChild(articles[articles.length - 1]);
      articles = grid.querySelectorAll(".cam");
    }
    if (count <= 4) {
      grid.style.gridTemplateColumns = "1fr 1fr";
      grid.style.gridTemplateRows = "1fr 1fr";
    } else if (count === 5) {
      grid.style.gridTemplateColumns = "1fr 1fr 1fr";
      grid.style.gridTemplateRows = "1fr 1fr";
    } else {
      grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(220px, 1fr))";
      grid.style.gridTemplateRows = "auto";
    }
    return grid.querySelectorAll(".cam");
  }

  function paintPads(root) {
    ingestProxyFromLive(cachedData());
    root = root || document;
    var grid = root.querySelector(".cam-grid");
    if (!grid) return;
    var data = cachedData();
    var g = gate(data);
    var cams = data && data.cameras && data.cameras.length ? data.cameras : null;
    var want = cams && g.live ? cams.length : cams && !g.needToken ? cams.length : 4;
    if (want < 4) want = 4;
    var articles = ensurePads(grid, want);

    var zoneMeta = root.querySelector(".cam-zone .zone-meta");
    if (zoneMeta) {
      if (g.live && g.hasSnaps) {
        zoneMeta.textContent = g.deviceCount + " cams · LIVE · stills";
      } else if (g.live) {
        zoneMeta.textContent = g.deviceCount + " cams · LIVE · still pending";
      } else if (g.needToken) {
        zoneMeta.textContent = "4 pads · STUB · need SDM token";
      } else {
        zoneMeta.textContent = g.label;
      }
    }

    var path = root.querySelector(".cam-path");
    if (path) {
      if (g.live && g.hasSnaps) {
        path.textContent =
          "Nest SDM live · Pages stills from data/nest-snaps · see " + DOCS;
      } else if (g.live) {
        path.innerHTML =
          "Nest SDM <strong>LIVE</strong> · " +
          g.deviceCount +
          " cams · <strong>tap pad → WebRTC video</strong> (nestProxy from live JSON) · SDM tokens off Pages · " +
          DOCS;
      } else if (g.needToken) {
        path.innerHTML =
          "WORKING path staged · no fake LIVE video · hand Atlas Nest refresh_token via secret-request → <code>~/.config/wardos/nest-refresh.token</code> + <code>nest-sdm.json</code> · see <code>" +
          DOCS +
          "</code>";
      } else {
        path.textContent = g.label + (g.reason ? " · " + g.reason : "") + " · " + DOCS;
      }
    }

    var note = root.getElementById("cam-next-step");
    if (note) {
      if (g.live && g.hasSnaps) {
        note.innerHTML =
          "<strong>Cams = LIVE + stills.</strong> Snapshots from nest-live.json → data/nest-snaps · polling ~60s.";
      } else if (g.live) {
        note.innerHTML =
          "<strong>Cams = LIVE · tap pad for video.</strong> SDM roster (" +
          g.deviceCount +
          "). Tap a pad → <code>nest-webrtc.html</code> via box proxy <code>scripts/nest-webrtc-proxy.mjs</code> (:8787). Tokens stay off Pages. See <code>" +
          DOCS +
          "</code>.";
      } else if (g.needToken) {
        note.innerHTML =
          "<strong>Cams = STUB (need token).</strong> Stage ready: <code>scripts/nest-fetch.mjs</code> + <code>" +
          DOCS +
          "</code>. Dan: enable Google Device Access (SDM) → hand Atlas refresh_token via <em>secret-request</em> (masked). Until then pads stay honest STUB — no invented video.";
      } else {
        note.innerHTML =
          "<strong>Cams = " +
          g.label +
          ".</strong> " +
          (g.reason || "") +
          " · see <code>" +
          DOCS +
          "</code>.";
      }
    }

    if (!articles || !articles.length) return;

    for (var i = 0; i < articles.length; i++) {
      var el = articles[i];
      var cam = cams && cams[i] ? cams[i] : null;
      var feed = el.querySelector(".cam-feed");
      var liveEl = el.querySelector(".cam-live");
      var stubEl = el.querySelector(".cam-stub");
      var glyph = el.querySelector(".cam-glyph");
      var nameEl = el.querySelector(".cam-name");
      var whereEl = el.querySelector(".cam-where");
      var img = feed && feed.querySelector("img.cam-snap");

      if (cam) {
        if (nameEl) nameEl.textContent = shortName(cam);
        if (whereEl) {
          var whereBit = cam.where || "Cam";
          if (cam.online === true) whereBit += " · online";
          else if (cam.online === false) whereBit += " · offline";
          whereEl.textContent = whereBit;
        }
        if (glyph) glyph.textContent = glyphFor(cam);
        el.setAttribute("aria-label", shortName(cam) + " camera");
      }

      var showSnap = g.live && g.hasSnaps && cam && cam.snapshotUrl;
      var realCam = cam && !String(cam.id || "").startsWith("stub-");

      if (liveEl) {
        if (showSnap) {
          liveEl.className = "cam-live on";
          liveEl.innerHTML = "<i></i>LIVE";
        } else if (g.live && realCam) {
          liveEl.className = "cam-live on dim";
          liveEl.innerHTML = "<i></i>LIVE · NO STILL";
        } else if (g.needToken) {
          liveEl.className = "cam-live stub";
          liveEl.innerHTML = "<i></i>STUB · NO FEED";
        } else {
          liveEl.className = "cam-live stub";
          liveEl.innerHTML = "<i></i>" + (g.label || "STUB");
        }
      }

      if (stubEl) {
        if (showSnap) stubEl.textContent = "SDM · still";
        else if (g.live && realCam) stubEl.textContent = "TAP · WebRTC live";
        else if (g.needToken) stubEl.textContent = "Need SDM token";
        else stubEl.textContent = g.label;
      }

      if (feed) {
        if (showSnap) {
          if (!img) {
            img = document.createElement("img");
            img.className = "cam-snap";
            img.alt = shortName(cam) || "Nest snapshot";
            img.decoding = "async";
            feed.insertBefore(img, feed.firstChild);
          }
          if (img.getAttribute("src") !== cam.snapshotUrl) img.src = cam.snapshotUrl;
          if (glyph) glyph.style.display = "none";
        } else {
          if (img) img.remove();
          if (glyph) glyph.style.display = "";
        }
      }
    }

    var bannerTitle = root.querySelector(".banner-title");
    var bannerSub = root.querySelector(".banner-sub");
    if (bannerTitle) {
      if (g.live && g.hasSnaps) bannerTitle.textContent = "Climate + Nest cams LIVE";
      else if (g.live) bannerTitle.textContent = "Climate LIVE · Nest LIVE · still pending";
      else bannerTitle.textContent = "Climate LIVE glass · Nest cams STUB";
    }
    wirePadClicks(root);

    if (bannerSub) {
      if (g.live && g.hasSnaps) {
        bannerSub.textContent = "Sensi + Nest stills · Elo 3202L";
      } else if (g.live) {
        bannerSub.textContent =
          "Sensi live · Nest SDM roster (" +
          g.deviceCount +
          ") · stills need event/WebRTC bridge · no fake video";
      } else {
        bannerSub.textContent =
          "Sensi polls live JSON · Nest needs SDM token · no fake video";
      }
    }
  }


  function qs(name) {
    try {
      return new URL(location.href).searchParams.get(name);
    } catch (e) {
      return null;
    }
  }

  function isPagesHost() {
    try {
      var h = location.hostname || "";
      return /github\.io$/i.test(h) || /pages\.dev$/i.test(h);
    } catch (e) {
      return false;
    }
  }

  function isLoopbackProxy(url) {
    try {
      var u = new URL(url, location.href);
      return u.hostname === "127.0.0.1" || u.hostname === "localhost";
    } catch (e) {
      return /127\.0\.0\.1|localhost/.test(String(url || ""));
    }
  }

  /** Optional override: seed proxy URL/token from ?proxy= into localStorage. */
  function ingestProxyFromQuery() {
    try {
      var p = qs("proxy") || qs("nestProxy");
      var t = qs("proxyToken") || qs("nestProxyToken") || qs("token");
      if (p) localStorage.setItem(PROXY_LS_KEY, String(p).replace(/\/$/, ""));
      if (t) localStorage.setItem(PROXY_TOKEN_LS_KEY, String(t));
    } catch (e) { /* */ }
  }

  /**
   * NESTVID1: after live JSON loads, if LS empty and JSON has a public nestProxy
   * (+ token), persist once. Never persist loopback on Pages.
   */
  function ingestProxyFromLive(data) {
    if (!data) return;
    try {
      var wp = data.nestProxy ? String(data.nestProxy).replace(/\/$/, "") : "";
      var tok = data.nestProxyToken ? String(data.nestProxyToken) : "";
      if (!wp || (isPagesHost() && isLoopbackProxy(wp))) return;
      // PROXYFOLLOW1: the tunnel address can change when Atlas's computer
      // restarts; always follow the newest public address from live JSON.
      if (/^https:\/\//i.test(wp) || !localStorage.getItem(PROXY_LS_KEY)) {
        if (localStorage.getItem(PROXY_LS_KEY) !== wp) localStorage.setItem(PROXY_LS_KEY, wp);
      }
      if (tok && !localStorage.getItem(PROXY_TOKEN_LS_KEY)) {
        localStorage.setItem(PROXY_TOKEN_LS_KEY, tok);
      }
    } catch (e) { /* */ }
  }

  function proxyBaseGuess() {
    ingestProxyFromQuery();
    var fromQs = qs("proxy") || qs("nestProxy");
    if (fromQs) return String(fromQs).replace(/\/$/, "");
    try {
      var saved = localStorage.getItem(PROXY_LS_KEY);
      if (saved) {
        var lsUrl = String(saved).replace(/\/$/, "");
        if (!(isPagesHost() && isLoopbackProxy(lsUrl))) return lsUrl;
      }
    } catch (e) {}
    var data = cachedData();
    if (data && data.nestProxy) {
      var wp = String(data.nestProxy).replace(/\/$/, "");
      if (!(isPagesHost() && isLoopbackProxy(wp))) return wp;
    }
    // On Pages/phone, do NOT default to 127.0.0.1 (that is the phone).
    if (isPagesHost()) return "";
    return DEFAULT_PROXY;
  }

  function proxyTokenGuess() {
    ingestProxyFromQuery();
    var fromQs = qs("proxyToken") || qs("nestProxyToken") || qs("token");
    if (fromQs) return String(fromQs);
    try {
      var ls = localStorage.getItem(PROXY_TOKEN_LS_KEY);
      if (ls) return String(ls);
    } catch (e) {}
    var data = cachedData();
    if (data && data.nestProxyToken) return String(data.nestProxyToken);
    return "";
  }

  /** Tap-to-open live WebRTC viewer. NESTVID1: nestProxy from live JSON when LS empty. */
  function openViewer(cam) {
    var id = cam && (cam.id || cam.name) ? encodeURIComponent(cam.id || cam.name) : "";
    ingestProxyFromLive(cachedData());
    var proxy = proxyBaseGuess();
    var token = proxyTokenGuess();
    // Pages + loopback/missing proxy → NEED PROXY + still (not silent black).
    var url = "nest-webrtc.html?cam=" + id + "&v=NESTVID1";
    if (proxy && !(isPagesHost() && isLoopbackProxy(proxy))) {
      url += "&proxy=" + encodeURIComponent(proxy);
      if (token) url += "&proxyToken=" + encodeURIComponent(token);
    }
    try {
      if (window.HouseSfx && HouseSfx.tap) HouseSfx.tap();
    } catch (e) {}
    location.href = url;
  }

  function wirePadClicks(root) {
    root = root || document;
    var grid = root.querySelector(".cam-grid");
    if (!grid || grid._nestWire) return;
    grid._nestWire = true;
    grid.addEventListener("click", function (ev) {
      var art = ev.target && ev.target.closest ? ev.target.closest(".cam") : null;
      if (!art) return;
      var data = cachedData();
      var g = gate(data);
      if (!g.live) return;
      var cams = (data && data.cameras) || [];
      var articles = grid.querySelectorAll(".cam");
      var idx = -1;
      for (var i = 0; i < articles.length; i++) {
        if (articles[i] === art) {
          idx = i;
          break;
        }
      }
      var cam = idx >= 0 ? cams[idx] : null;
      if (cam && !String(cam.id || "").startsWith("stub-")) openViewer(cam);
    });
  }


  /* ── CAMDECK1 · hub still tiles (Front / Garage / Backyard only) ── */
  var HUB_CAMS = [
    {
      key: "front",
      label: "Front door",
      snap: "data/nest-snaps/front-door.jpg",
      match: /front|door|doorbell/i
    },
    {
      key: "garage",
      label: "Garage",
      snap: "data/nest-snaps/garage.jpg",
      match: /garage/i
    },
    {
      key: "backyard",
      label: "Backyard",
      snap: "data/nest-snaps/backyard.jpg",
      match: /backyard|yard|patio/i
    }
  ];

  var SNAP_FRESH_MS = 30 * 60 * 1000;

  function findCamForHub(slot, cams) {
    cams = cams || [];
    for (var i = 0; i < cams.length; i++) {
      var c = cams[i];
      if (!c) continue;
      var blob = String((c.name || "") + " " + (c.where || ""));
      if (slot.match.test(blob)) return c;
    }
    return null;
  }

  /**
   * Honest ONE status for a hub tile (HUBFMT1 / CAMLIVE2).
   * Default while still-only = STILL / STALE / NEED TOKEN / STUB / NEED PROXY.
   * LIVE is applied later ONLY when NestWebRtc <video> is actually playing
   * (see markHubCamLive). Never fake LIVE on a JPEG. Never silent black.
   */
  function hubCamHonesty(slot, cam, g, data) {
    if (g && g.needToken) {
      return { pill: "NEED TOKEN", cls: "hub-cam-stub", pillCls: "is-need", kind: "need" };
    }
    if (!g || !g.live) {
      return { pill: g && g.label ? g.label : "STUB", cls: "hub-cam-stub", pillCls: "is-stub", kind: "stub" };
    }
    var snapUrl = (cam && cam.snapshotUrl) || (slot && slot.snap) || null;
    if (!snapUrl) {
      return { pill: "NEED PROXY", cls: "hub-cam-stub", pillCls: "is-need", kind: "need" };
    }
    var captured = 0;
    if (cam && cam.snapCapturedAt) captured = parseUpdatedAt(cam.snapCapturedAt);
    if (!captured && data) captured = parseUpdatedAt(data.fetchedAt || data.updatedAt);
    var age = captured ? Date.now() - captured : Infinity;
    if (!Number.isFinite(age) || age > SNAP_FRESH_MS) {
      return {
        pill: "STALE",
        cls: "hub-cam-stale",
        pillCls: "is-stale",
        kind: "stale",
        snapUrl: snapUrl
      };
    }
    /* Still snapshot on hub = STILL only (one status · never LIVE+STILL). */
    return {
      pill: "STILL",
      cls: "hub-cam-still",
      pillCls: "is-still",
      kind: "still",
      snapUrl: snapUrl
    };
  }

  function paintHubCamDeck(doc) {
    ingestProxyFromLive(cachedData());
    doc = doc || document;
    var deck = doc.getElementById("hub-cam-deck");
    if (!deck) return;
    var data = cachedData();
    var g = gate(data);
    var cams = (data && data.cameras) || [];
    var tiles = deck.querySelectorAll(".hub-cam");
    for (var i = 0; i < HUB_CAMS.length; i++) {
      var slot = HUB_CAMS[i];
      var el = tiles[i] || null;
      if (!el) continue;
      var cam = findCamForHub(slot, cams);
      /* CAMLIVE2 · never clobber a proven LIVE playing tile with STILL on poll */
      if (el._hubLivePlaying && el.classList.contains("hub-cam-live")) {
        if (cam && !String(cam.id || "").startsWith("stub-")) {
          el.setAttribute("data-cam-id", cam.id);
          el.setAttribute("href", viewerHref(cam));
          el.setAttribute("aria-label", slot.label + " camera · LIVE");
        }
        continue;
      }
      var h = hubCamHonesty(slot, cam, g, data);
      el.classList.remove("hub-cam-live", "hub-cam-still", "hub-cam-stale", "hub-cam-stub");
      el.classList.add(h.cls);
      el.setAttribute("aria-label", slot.label + " camera · " + h.pill);
      if (cam && !String(cam.id || "").startsWith("stub-")) {
        el.setAttribute("data-cam-id", cam.id);
        el.setAttribute("href", viewerHref(cam));
      } else {
        el.removeAttribute("data-cam-id");
        el.setAttribute("href", "sheet-google-home.html");
      }

      var pill = el.querySelector(".hub-cam-pill");
      if (pill) {
        pill.textContent = h.pill;
        pill.classList.remove("is-live", "is-still", "is-stale", "is-stub", "is-need");
        pill.classList.add(h.pillCls);
      }
      var label = el.querySelector(".hub-cam-label");
      if (label) label.textContent = slot.label;
      /* HUBFMT1 · one status only — pill owns it; hide foot kind duplicate */
      var kind = el.querySelector(".hub-cam-kind");
      if (kind) {
        kind.textContent = h.pill;
        kind.setAttribute("hidden", "");
        kind.setAttribute("aria-hidden", "true");
      }

      var mediaWrap = el.querySelector(".hub-cam-media-wrap");
      var img = el.querySelector("img.hub-cam-media");
      var voidEl = el.querySelector(".hub-cam-stub-void");
      var vid = el.querySelector("video.hub-cam-video");
      /* Prefer real still path; fall back to known NESTSTILL1 slot file so wall never goes black */
      var snapUrl = h.snapUrl || slot.snap || null;
      var showStill = !!snapUrl;

      if (showStill) {
        if (!img && mediaWrap) {
          img = doc.createElement("img");
          img.className = "hub-cam-media";
          img.alt = slot.label + " still";
          mediaWrap.insertBefore(img, mediaWrap.firstChild);
        }
        if (img) {
          var bust = snapUrl + (snapUrl.indexOf("?") >= 0 ? "&" : "?") + "v=CAMLIVE2";
          if (img.getAttribute("src") !== bust) img.setAttribute("src", bust);
          /* Keep still visible until LIVE video proves frames */
          if (!el._hubLivePlaying) img.style.display = "block";
          img.onerror = (function (wrap, image) {
            return function () {
              image.style.display = "none";
              if (wrap && !wrap.querySelector(".hub-cam-stub-void")) {
                var v = doc.createElement("div");
                v.className = "hub-cam-media hub-cam-stub-void";
                v.setAttribute("aria-hidden", "true");
                wrap.insertBefore(v, wrap.firstChild);
              }
              var p = wrap && wrap.parentNode && wrap.parentNode.querySelector(".hub-cam-pill");
              if (p && !wrap.parentNode._hubLivePlaying) {
                p.textContent = "NEED PROXY";
                p.classList.remove("is-live", "is-still", "is-stale", "is-stub");
                p.classList.add("is-need");
              }
              if (wrap && wrap.parentNode && !wrap.parentNode._hubLivePlaying) {
                wrap.parentNode.classList.remove("hub-cam-live", "hub-cam-still", "hub-cam-stale");
                wrap.parentNode.classList.add("hub-cam-stub");
              }
            };
          })(mediaWrap, img);
        }
        if (voidEl) voidEl.style.display = "none";
      } else {
        if (img && !el._hubLivePlaying) img.style.display = "none";
        if (!voidEl && mediaWrap) {
          voidEl = doc.createElement("div");
          voidEl.className = "hub-cam-media hub-cam-stub-void";
          voidEl.setAttribute("aria-hidden", "true");
          mediaWrap.insertBefore(voidEl, mediaWrap.firstChild);
        }
        if (voidEl && !el._hubLivePlaying) voidEl.style.display = "block";
      }
      /* Ensure video element exists for CAMLIVE2 (hidden until playing) */
      if (mediaWrap && !vid) {
        vid = doc.createElement("video");
        vid.className = "hub-cam-media hub-cam-video";
        vid.setAttribute("playsinline", "");
        vid.setAttribute("muted", "");
        vid.muted = true;
        vid.autoplay = true;
        vid.playsInline = true;
        vid.setAttribute("aria-label", slot.label + " live");
        vid.style.display = "none";
        mediaWrap.insertBefore(vid, mediaWrap.firstChild);
      }
    }
    /* Kick WebRTC after still paint — LIVE only when frames play */
    startHubLiveStreams(doc);
  }

  function viewerHref(cam) {
    ingestProxyFromLive(cachedData());
    var id = cam && (cam.id || cam.name) ? encodeURIComponent(cam.id || cam.name) : "";
    var url = "nest-webrtc.html?cam=" + id + "&v=CAMLIVE2";
    var proxy = proxyBaseGuess();
    var token = proxyTokenGuess();
    if (proxy && !(isPagesHost() && isLoopbackProxy(proxy))) {
      url += "&proxy=" + encodeURIComponent(proxy);
      if (token) url += "&proxyToken=" + encodeURIComponent(token);
    }
    return url;
  }

  /* CAMLIVE2 · sessions keyed by cam id — never restart a healthy stream on poll */
  var _hubLiveSessions = Object.create(null);
  var _hubLiveStarting = false;
  var _hubLiveKickTimer = null;

  /* CAMIOS1 · iPhone Safari will not start a muted autoplay <video> that is
   * display:none, so hub tiles never went LIVE on the phone. Keep the video
   * rendered (invisible, under the still) while it connects. */
  function armHubVid(vid) {
    if (!vid) return;
    vid.style.display = "block";
    vid.style.position = "absolute";
    vid.style.inset = "0";
    vid.style.opacity = "0";
    vid.style.pointerEvents = "none";
    vid.muted = true;
    vid.playsInline = true;
    vid.autoplay = true;
  }

  function markHubCamLive(el, slotLabel) {
    if (!el) return;
    el._hubLivePlaying = true;
    el.classList.remove("hub-cam-still", "hub-cam-stale", "hub-cam-stub");
    el.classList.add("hub-cam-live");
    el.setAttribute("aria-label", (slotLabel || "Cam") + " camera · LIVE");
    var pill = el.querySelector(".hub-cam-pill");
    if (pill) {
      pill.textContent = "LIVE";
      pill.classList.remove("is-still", "is-stale", "is-stub", "is-need");
      pill.classList.add("is-live");
    }
    var kind = el.querySelector(".hub-cam-kind");
    if (kind) {
      kind.textContent = "LIVE";
      kind.setAttribute("hidden", "");
      kind.setAttribute("aria-hidden", "true");
    }
    var img = el.querySelector("img.hub-cam-media");
    if (img) img.style.display = "none";
    var voidEl = el.querySelector(".hub-cam-stub-void");
    if (voidEl) voidEl.style.display = "none";
    var vid = el.querySelector("video.hub-cam-video");
    if (vid) {
      vid.style.display = "block";
      vid.style.opacity = "1";
      vid.style.position = "";
      vid.style.inset = "";
    }
  }

  function markHubCamNotLive(el, reason) {
    if (!el) return;
    el._hubLivePlaying = false;
    var vid = el.querySelector("video.hub-cam-video");
    if (vid) {
      try { vid.srcObject = null; } catch (_) {}
      vid.style.display = "none";
    }
    /* Revert to still honesty — never leave a fake LIVE label */
    if (el.classList.contains("hub-cam-live")) {
      el.classList.remove("hub-cam-live");
      var data = cachedData();
      var g = gate(data);
      var cams = (data && data.cameras) || [];
      var deck = el.closest ? el.closest("#hub-cam-deck") : null;
      var tiles = deck ? deck.querySelectorAll(".hub-cam") : [];
      var idx = -1;
      for (var i = 0; i < tiles.length; i++) {
        if (tiles[i] === el) { idx = i; break; }
      }
      var slot = idx >= 0 ? HUB_CAMS[idx] : null;
      if (slot) {
        var cam = findCamForHub(slot, cams);
        var h = hubCamHonesty(slot, cam, g, data);
        el.classList.remove("hub-cam-still", "hub-cam-stale", "hub-cam-stub");
        el.classList.add(h.cls);
        el.setAttribute("aria-label", slot.label + " camera · " + h.pill);
        var pill = el.querySelector(".hub-cam-pill");
        if (pill) {
          pill.textContent = h.pill;
          pill.classList.remove("is-live", "is-still", "is-stale", "is-stub", "is-need");
          pill.classList.add(h.pillCls);
        }
        var img = el.querySelector("img.hub-cam-media");
        if (img && h.snapUrl) img.style.display = "block";
      }
    }
    /* CAMKEY1: proxy says this screen has no/old camera key — say so, not STALE. */
    if (reason && /unauthorized|\b401\b/i.test(String(reason))) {
      var kp = el.querySelector(".hub-cam-pill");
      if (kp) {
        kp.textContent = "NEED KEY";
        kp.classList.remove("is-live", "is-still", "is-stale", "is-stub");
        kp.classList.add("is-need");
      }
      var lbl = el.getAttribute("aria-label") || "";
      el.setAttribute("aria-label", lbl.replace(/·.*$/, "· NEED KEY"));
    }
    if (reason && typeof console !== "undefined" && console.info) {
      try { console.info("[CAMLIVE2] hub not LIVE:", reason); } catch (_) {}
    }
  }

  function waitVideoPlaying(videoEl, timeoutMs) {
    return new Promise(function (resolve) {
      if (!videoEl) return resolve(false);
      var done = false;
      var t = setTimeout(function () {
        if (!done) {
          done = true;
          resolve(!!(videoEl.videoWidth > 0 && !videoEl.paused));
        }
      }, timeoutMs || 20000);
      function check() {
        if (done) return;
        /* CAMIOS2: a paused first frame is not live */
        if (videoEl.videoWidth > 0 && videoEl.readyState >= 2 && !videoEl.paused) {
          done = true;
          clearTimeout(t);
          resolve(true);
        }
      }
      videoEl.addEventListener("playing", check);
      videoEl.addEventListener("loadeddata", check);
      videoEl.addEventListener("resize", check);
      videoEl.addEventListener("timeupdate", check);
      /* already playing? */
      check();
    });
  }

  function startHubLiveStreams(doc) {
    doc = doc || document;
    if (typeof global.NestWebRtc === "undefined" || !global.NestWebRtc.startStream) {
      return; /* client not loaded — stay STILL honestly */
    }
    if (_hubLiveKickTimer) clearTimeout(_hubLiveKickTimer);
    _hubLiveKickTimer = setTimeout(function () {
      _hubLiveKickTimer = null;
      runHubLiveStreams(doc);
    }, 120);
  }

  /* CAMIOS2 · start the cams that can stream first (front-door battery bell
   * last), back off a cam Google says can't stream, and if the iPhone won't
   * autoplay, show "TAP FOR LIVE" and start every hub video on the first tap. */
  var HUB_ORDER = [1, 2, 0];
  var _hubCamBackoff = {};
  var _hubTapArmed = false;
  function hubVideoHasTrack(vid) {
    try {
      var so = vid && vid.srcObject;
      var vt = so && so.getVideoTracks ? so.getVideoTracks() : [];
      return !!(vt.length && vt[0].readyState === "live");
    } catch (_) { return false; }
  }
  function armHubTapToPlay(doc, el, slot) {
    var pill = el.querySelector(".hub-cam-pill");
    if (pill) pill.textContent = "TAP FOR LIVE";
    el._hubNeedsTap = true;
    var vid = el.querySelector("video.hub-cam-video");
    if (vid && !vid._hubTapHook) {
      vid._hubTapHook = true;
      vid.addEventListener("playing", function () {
        if (el._hubNeedsTap && vid.videoWidth > 0) {
          el._hubNeedsTap = false;
          markHubCamLive(el, slot.label);
        }
      });
    }
    if (_hubTapArmed) return;
    _hubTapArmed = true;
    function onFirstTap(ev) {
      var deck = doc.getElementById("hub-cam-deck");
      var waiting = deck ? deck.querySelectorAll(".hub-cam") : [];
      var any = false;
      for (var k = 0; k < waiting.length; k++) {
        if (!waiting[k]._hubNeedsTap) continue;
        any = true;
        var v = waiting[k].querySelector("video.hub-cam-video");
        if (v) {
          v.muted = true;
          try { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (_) {}
        }
      }
      if (!any) return;
      /* this tap only starts video; the next tap opens the camera */
      if (ev && deck && deck.contains(ev.target)) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      _hubTapArmed = false;
      doc.removeEventListener("click", onFirstTap, true);
      doc.removeEventListener("touchend", onFirstTap, true);
    }
    doc.addEventListener("click", onFirstTap, true);
    doc.addEventListener("touchend", onFirstTap, true);
  }

  function runHubLiveStreams(doc) {
    if (_hubLiveStarting) return;
    var deck = doc.getElementById("hub-cam-deck");
    if (!deck) return;
    var data = cachedData();
    var g = gate(data);
    if (!g || !g.live) return;
    ingestProxyFromLive(data);
    var proxy = proxyBaseGuess();
    if (!proxy || (isPagesHost() && isLoopbackProxy(proxy))) {
      /* NEED PROXY — leave STILL/NEED PROXY from honesty; never fake LIVE */
      return;
    }
    var NWR = global.NestWebRtc;
    var cams = (data && data.cameras) || [];
    var tiles = deck.querySelectorAll(".hub-cam");
    _hubLiveStarting = true;

    function startOne(n) {
      if (n >= HUB_ORDER.length) {
        _hubLiveStarting = false;
        return;
      }
      var i = HUB_ORDER[n];
      var next = function () { startOne(n + 1); };
      var slot = HUB_CAMS[i];
      var el = tiles[i] || null;
      var cam = slot ? findCamForHub(slot, cams) : null;
      if (!el || !cam || String(cam.id || "").startsWith("stub-")) {
        return next();
      }
      var deviceId = cam.id;
      if (_hubCamBackoff[deviceId] && Date.now() < _hubCamBackoff[deviceId]) return next();
      var existing = _hubLiveSessions[deviceId];
      if (existing && existing.ok && el._hubLivePlaying) {
        return next();
      }
      if (existing && el._hubNeedsTap) return next(); /* waiting on a tap */
      if (existing && existing.stop) {
        try { existing.stop(); } catch (_) {}
        delete _hubLiveSessions[deviceId];
      }
      var mediaWrap = el.querySelector(".hub-cam-media-wrap");
      var vid = el.querySelector("video.hub-cam-video");
      if (!vid && mediaWrap) {
        vid = doc.createElement("video");
        vid.className = "hub-cam-media hub-cam-video";
        vid.setAttribute("playsinline", "");
        vid.setAttribute("muted", "");
        vid.muted = true;
        vid.autoplay = true;
        vid.playsInline = true;
        vid.style.display = "none";
        mediaWrap.insertBefore(vid, mediaWrap.firstChild);
      }
      if (!vid) return next();
      armHubVid(vid);

      NWR.startStream(deviceId, vid, function (/* status */) {})
        .then(function (session) {
          _hubLiveSessions[deviceId] = session;
          try {
            var pp = vid.play();
            if (pp && pp.catch) pp.catch(function (e) {
              /* phone refused autoplay: ask for the tap right away */
              if (e && e.name === "NotAllowedError") armHubTapToPlay(doc, el, slot);
            });
          } catch (_) {}
          return waitVideoPlaying(vid, el._hubNeedsTap ? 4000 : 12000).then(function (ok) {
            session.ok = !!ok;
            if (!ok && hubVideoHasTrack(vid)) {
              /* video is arriving but the phone won't autoplay it */
              session.ok = true;
              armHubTapToPlay(doc, el, slot);
              return next();
            }
            if (ok) {
              markHubCamLive(el, slot.label);
              /* Drop to STILL if ICE dies later */
              try {
                if (session.pc) {
                  session.pc.addEventListener("connectionstatechange", function () {
                    var st = session.pc.connectionState;
                    if (st === "failed" || st === "closed" || st === "disconnected") {
                      markHubCamNotLive(el, "ICE " + st);
                      try { session.stop(); } catch (_) {}
                      delete _hubLiveSessions[deviceId];
                    }
                  });
                }
              } catch (_) {}
            } else {
              try { session.stop(); } catch (_) {}
              delete _hubLiveSessions[deviceId];
              markHubCamNotLive(el, "no frames " + slot.label);
            }
            next();
          });
        })
        .catch(function (err) {
          var msg = (err && err.message) || "stream fail";
          if (/not available for streaming/i.test(msg)) _hubCamBackoff[deviceId] = Date.now() + 30 * 60 * 1000;
          markHubCamNotLive(el, msg);
          next();
        });
    }
    startOne(0);
  }

  function mountHubCamDeck(selector) {
    var el =
      typeof selector === "string"
        ? document.querySelector(selector)
        : selector || document.getElementById("hub-cam-deck");
    if (!el) return;
    paintHubCamDeck(el.ownerDocument || document);
    onChange(function () {
      paintHubCamDeck(el.ownerDocument || document);
    });
    startPolling();
  }

  /* CAMIOS1 · re-kick hub streams when the screen comes back (back button,
   * app switch, bfcache) and every 90 s for any tile that dropped. Healthy
   * sessions are skipped inside runHubLiveStreams. */
  try {
    global.addEventListener("pageshow", function () { startHubLiveStreams(document); });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") startHubLiveStreams(document);
    });
    setInterval(function () {
      if (document.visibilityState === "visible") startHubLiveStreams(document);
    }, 90000);
  } catch (_) {}

  global.HouseNest = {
    gate: function () {
      return gate(cachedData());
    },
    cachedData: cachedData,
    fetchLive: fetchLive,
    startPolling: startPolling,
    onChange: onChange,
    paintPads: paintPads,
    paintHubCamDeck: paintHubCamDeck,
    mountHubCamDeck: mountHubCamDeck,
    startHubLiveStreams: startHubLiveStreams,
    openViewer: openViewer,
    wirePadClicks: wirePadClicks,
    proxyBaseGuess: proxyBaseGuess,
    proxyTokenGuess: proxyTokenGuess,
    ingestProxyFromLive: ingestProxyFromLive,
    docs: DOCS,
  };
})(typeof window !== "undefined" ? window : globalThis);
