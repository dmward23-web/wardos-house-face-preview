/* House Face · Nest WebRTC client
   Builds Nest-legal SDP offer (audio/video/application · recvonly · trailing NL),
   POSTs to nest-webrtc-proxy, sets answer, plays <video>.
   NESTVID1: when QS/LS empty, load nestProxy + nestProxyToken from data/nest-live.json
   (public CF URL baked by nest-fetch — LIGHTS6 pattern). SDM secrets stay on box.
   Proxy auth token may be on Pages by design; Nest OAuth never is. */
(function (global) {
  "use strict";

  var ICE_SERVERS = {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    ],
    iceCandidatePoolSize: 10,
  };

  var LIVE_URL = "data/nest-live.json";
  var PROXY_LS_KEY = "wardosNestProxy";
  var PROXY_TOKEN_LS_KEY = "wardosNestProxyToken";
  var _liveProxy = null; /* { nestProxy, nestProxyToken } from nest-live.json */
  var _liveProxyPromise = null;

  function qs(name) {
    try {
      return new URLSearchParams(location.search).get(name);
    } catch (_) {
      return null;
    }
  }

  function isPagesHost() {
    try {
      var h = location.hostname || "";
      return /github\.io$/i.test(h) || /pages\.dev$/i.test(h);
    } catch (_) {
      return false;
    }
  }

  function isLoopbackProxy(url) {
    try {
      var u = new URL(url, location.href);
      return u.hostname === "127.0.0.1" || u.hostname === "localhost";
    } catch (_) {
      return /127\.0\.0\.1|localhost/.test(String(url || ""));
    }
  }

  function ingestLiveProxy(data) {
    if (!data) return;
    try {
      var wp = data.nestProxy ? String(data.nestProxy).replace(/\/$/, "") : "";
      var tok = data.nestProxyToken ? String(data.nestProxyToken) : "";
      if (!wp || (isPagesHost() && isLoopbackProxy(wp))) return;
      _liveProxy = { nestProxy: wp, nestProxyToken: tok || "" };
      if (!localStorage.getItem(PROXY_LS_KEY)) localStorage.setItem(PROXY_LS_KEY, wp);
      if (tok && !localStorage.getItem(PROXY_TOKEN_LS_KEY)) {
        localStorage.setItem(PROXY_TOKEN_LS_KEY, tok);
      }
    } catch (_) {}
  }

  /** NESTVID1: pull baked nestProxy from nest-live.json once (Pages hard-refresh). */
  function ensureProxyFromLive() {
    if (_liveProxy && _liveProxy.nestProxy) return Promise.resolve(_liveProxy);
    if (_liveProxyPromise) return _liveProxyPromise;
    _liveProxyPromise = fetch(LIVE_URL + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        ingestLiveProxy(data);
        return _liveProxy;
      })
      .catch(function () { return _liveProxy; })
      .then(function (v) {
        _liveProxyPromise = null;
        return v;
      });
    return _liveProxyPromise;
  }

  function proxyBase() {
    var fromQs = qs("proxy") || qs("nestProxy");
    if (fromQs) {
      try {
        localStorage.setItem(PROXY_LS_KEY, fromQs.replace(/\/$/, ""));
      } catch (_) {}
      return fromQs.replace(/\/$/, "");
    }
    // PROXYFOLLOW1: newest public address from nest-live.json beats a saved one
    // (the tunnel address changes when Atlas's computer restarts).
    if (location.port === "8787") return location.origin; // served by the proxy itself
    if (_liveProxy && _liveProxy.nestProxy && /^https:\/\//i.test(_liveProxy.nestProxy)) {
      try { localStorage.setItem(PROXY_LS_KEY, _liveProxy.nestProxy); } catch (_) {}
      return _liveProxy.nestProxy;
    }
    try {
      var saved = localStorage.getItem(PROXY_LS_KEY);
      if (saved) {
        var lsUrl = saved.replace(/\/$/, "");
        if (!(isPagesHost() && isLoopbackProxy(lsUrl))) return lsUrl;
      }
    } catch (_) {}
    if (_liveProxy && _liveProxy.nestProxy) {
      var wp = _liveProxy.nestProxy;
      if (!(isPagesHost() && isLoopbackProxy(wp))) return wp;
    }
    // Same-origin when served by the proxy itself (box / LAN)
    if (location.port === "8787" || (location.protocol === "http:" && /nest-webrtc/.test(location.pathname) && !isPagesHost())) {
      return location.origin;
    }
    // GitHub Pages / phone: 127.0.0.1 is THE PHONE, not Atlas — refuse silent black.
    if (isPagesHost()) {
      return "";
    }
    return "http://127.0.0.1:8787";
  }

  function proxyUnreachableHint(base) {
    if (!base) {
      return (
        "NEED PROXY · Live WebRTC needs the Atlas nest-webrtc-proxy.\n\n" +
        "This page is on GitHub Pages — http://127.0.0.1:8787 is YOUR phone, not the house box.\n\n" +
        "Normal open: data/nest-live.json should bake nestProxy (public CF URL).\n" +
        "If missing: Atlas run nest-fetch after nest-webrtc-proxy.url is set.\n" +
        "Pads stills remain on sheet-google-home.html — never silent black."
      );
    }
    if (isPagesHost() && isLoopbackProxy(base)) {
      return (
        "NEED PROXY · Proxy is set to " + base + " but you are on Pages/phone.\n" +
        "That address is this device, not Atlas. Clear localStorage wardosNestProxy\n" +
        "or wait for nestProxy in nest-live.json. Pads stills remain on sheet-google-home.html."
      );
    }
    return null;
  }

  function proxyToken() {
    var t = qs("proxyToken") || qs("nestProxyToken") || qs("token");
    if (t) {
      try {
        localStorage.setItem(PROXY_TOKEN_LS_KEY, t);
      } catch (_) {}
      return t;
    }
    try {
      var ls = localStorage.getItem(PROXY_TOKEN_LS_KEY);
      if (ls) return ls;
    } catch (_) {}
    if (_liveProxy && _liveProxy.nestProxyToken) return _liveProxy.nestProxyToken;
    return "";
  }

  function authHeaders() {
    var h = { "Content-Type": "application/json", Accept: "application/json" };
    var t = proxyToken();
    if (t) {
      h["X-Nest-Proxy-Token"] = t;
      h["Authorization"] = "Bearer " + t;
    }
    return h;
  }

  /** Reorder SDP m-lines to Nest-required: audio, video, application. */
  function reorderSdp(sdp) {
    var lines = sdp.replace(/\r\n/g, "\n").split("\n");
    var session = [];
    var media = [];
    var cur = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf("m=") === 0) {
        cur = { lines: [line] };
        media.push(cur);
      } else if (cur) {
        cur.lines.push(line);
      } else {
        session.push(line);
      }
    }
    function kind(block) {
      var m = block.lines[0] || "";
      if (m.indexOf("m=audio") === 0) return "audio";
      if (m.indexOf("m=video") === 0) return "video";
      if (m.indexOf("m=application") === 0) return "application";
      return "other";
    }
    var order = ["audio", "video", "application"];
    var sorted = [];
    for (var o = 0; o < order.length; o++) {
      for (var j = 0; j < media.length; j++) {
        if (kind(media[j]) === order[o]) sorted.push(media[j]);
      }
    }
    for (var k = 0; k < media.length; k++) {
      if (order.indexOf(kind(media[k])) < 0) sorted.push(media[k]);
    }
    // Fix BUNDLE group mid order to match
    var mids = [];
    for (var s = 0; s < sorted.length; s++) {
      for (var li = 0; li < sorted[s].lines.length; li++) {
        var ml = sorted[s].lines[li];
        if (ml.indexOf("a=mid:") === 0) {
          mids.push(ml.slice(6).trim());
          break;
        }
      }
    }
    for (var si = 0; si < session.length; si++) {
      if (session[si].indexOf("a=group:BUNDLE") === 0 && mids.length) {
        session[si] = "a=group:BUNDLE " + mids.join(" ");
      }
    }
    var out = session.join("\n");
    for (var b = 0; b < sorted.length; b++) {
      out += "\n" + sorted[b].lines.join("\n");
    }
    if (!out.endsWith("\n")) out += "\n";
    return out;
  }

  /** Force recvonly on audio/video sections; keep application as-is. */
  function forceRecvonly(sdp) {
    var parts = sdp.replace(/\r\n/g, "\n").split(/\nm=/);
    var rebuilt = parts[0];
    for (var i = 1; i < parts.length; i++) {
      var section = "m=" + parts[i];
      if (/^m=audio|^m=video/.test(section)) {
        section = section
          .replace(/\na=sendrecv/g, "\na=recvonly")
          .replace(/\na=sendonly/g, "\na=recvonly")
          .replace(/\na=inactive/g, "\na=recvonly");
        if (!/\na=recvonly/.test(section)) {
          // insert after mid if present
          section = section.replace(/(\na=mid:[^\n]+)/, "$1\na=recvonly");
        }
      }
      rebuilt += (rebuilt.endsWith("\n") ? "" : "\n") + section;
      if (i < parts.length - 1 && !rebuilt.endsWith("\n")) rebuilt += "\n";
    }
    // join was split on \nm= so first chunk may not have trailing; normalize
    var fixed = reorderSdp(rebuilt);
    return fixed.endsWith("\n") ? fixed : fixed + "\n";
  }

  function waitIceComplete(pc, timeoutMs) {
    return new Promise(function (resolve) {
      if (pc.iceGatheringState === "complete") return resolve();
      var done = false;
      var t = setTimeout(function () {
        if (!done) {
          done = true;
          resolve();
        }
      }, timeoutMs || 5000);
      pc.addEventListener("icegatheringstatechange", function () {
        if (pc.iceGatheringState === "complete" && !done) {
          done = true;
          clearTimeout(t);
          resolve();
        }
      });
    });
  }

  async function buildOffer() {
    var pc = new RTCPeerConnection(ICE_SERVERS);
    // Nest requires a data channel in the offer (application m-line)
    pc.createDataChannel("dataSendChannel");
    pc.addTransceiver("audio", { direction: "recvonly" });
    pc.addTransceiver("video", { direction: "recvonly" });

    var offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIceComplete(pc, 6000);

    var sdp = pc.localDescription && pc.localDescription.sdp;
    if (!sdp) {
      pc.close();
      throw new Error("no local SDP");
    }
    sdp = forceRecvonly(sdp);
    // Nest (2026) rejects offers with zero ICE candidates. Sandbox STUN often fails —
    // inject UDP host candidates so GenerateWebRtcStream accepts the offer.
    if (!/a=candidate:/m.test(sdp)) {
      var host = "172.30.0.2";
      try {
        if (location.hostname && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
          host = location.hostname;
        }
      } catch (e) {}
      var candLine =
        "a=candidate:1 1 UDP 2122260223 " + host + " 9 typ host generation 0\r\n" +
        "a=candidate:1 2 UDP 2122260222 " + host + " 10 typ host generation 0";
      if (/\na=ice-options:[^\n]+/.test(sdp)) {
        sdp = sdp.replace(/\na=ice-options:[^\n]+/g, function (m) {
          return m + "\n" + candLine;
        });
      } else {
        sdp = sdp.replace(/\na=setup:actpass/g, "\n" + candLine + "\na=setup:actpass");
      }
      if (!sdp.endsWith("\n")) sdp += "\n";
    }
    // Keep pc alive until answer is set — caller owns lifecycle
    return { pc: pc, offerSdp: sdp };
  }

  async function fetchCameras() {
    await ensureProxyFromLive();
    var base = proxyBase();
    var hint = proxyUnreachableHint(base);
    if (!base || hint) {
      var err = new Error(hint || "no nest proxy URL");
      err.code = "NEST_PROXY_UNREACHABLE";
      throw err;
    }
    if (!proxyToken()) { var ek = new Error("NEED KEY"); ek.code = "NEED_KEY"; throw ek; } /* CAMKEY1 · no keyless calls */
    var r = await fetch(base + "/api/cameras", { headers: authHeaders(), cache: "no-store" });
    if (!r.ok) throw new Error("cameras HTTP " + r.status);
    return r.json();
  }

  async function exchangeOffer(deviceId, offerSdp) {
    var base = proxyBase();
    if (!proxyToken()) { var ek = new Error("NEED KEY"); ek.code = "NEED_KEY"; throw ek; } /* CAMKEY1 · no keyless calls */
    var r = await fetch(base + "/api/webrtc", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ deviceId: deviceId, offerSdp: offerSdp }),
    });
    var text = await r.text();
    var data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error("webrtc bad JSON: " + text.slice(0, 200));
    }
    if (!r.ok) throw new Error(data.error || "webrtc HTTP " + r.status);
    if (!data.answerSdp) throw new Error("missing answerSdp");
    return data;
  }

  async function extendSession(deviceId, mediaSessionId) {
    var base = proxyBase();
    var r = await fetch(base + "/api/webrtc/extend", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ deviceId: deviceId, mediaSessionId: mediaSessionId }),
    });
    if (!r.ok) {
      var t = await r.text();
      throw new Error("extend HTTP " + r.status + " " + t.slice(0, 120));
    }
    return r.json();
  }

  async function stopSession(deviceId, mediaSessionId) {
    try {
      var base = proxyBase();
      await fetch(base + "/api/webrtc/stop", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ deviceId: deviceId, mediaSessionId: mediaSessionId }),
      });
    } catch (_) {}
  }

  /**
   * Start live stream into videoEl for deviceId.
   * Returns { pc, mediaSessionId, stop, iceState }.
   */
  async function startStream(deviceId, videoEl, onStatus) {
    function status(s) {
      if (typeof onStatus === "function") onStatus(s);
    }
    await ensureProxyFromLive();
    status("building offer…");
    var built = await buildOffer();
    var pc = built.pc;
    var remoteStream = new MediaStream();
    if (videoEl) {
      videoEl.srcObject = remoteStream;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.autoplay = true;
    }

    pc.ontrack = function (ev) {
      if (ev.track) remoteStream.addTrack(ev.track);
      status("track " + (ev.track && ev.track.kind));
      if (videoEl) {
        videoEl.play().catch(function () {});
      }
    };

    var iceState = { connection: "new", gathering: pc.iceGatheringState };
    pc.oniceconnectionstatechange = function () {
      iceState.connection = pc.iceConnectionState;
      status("ICE " + pc.iceConnectionState);
    };
    pc.onconnectionstatechange = function () {
      status("PC " + pc.connectionState);
    };

    status("exchanging SDP…");
    var result = await exchangeOffer(deviceId, built.offerSdp);
    status("answer · setting remote…");
    await pc.setRemoteDescription({ type: "answer", sdp: result.answerSdp });
    status("remote set · waiting ICE…");

    var mediaSessionId = result.mediaSessionId;
    var extendTimer = null;
    if (mediaSessionId) {
      // extend every ~4 min (sessions ~5 min)
      extendTimer = setInterval(function () {
        extendSession(deviceId, mediaSessionId).catch(function (e) {
          status("extend fail: " + (e && e.message));
        });
      }, 4 * 60 * 1000);
    }

    function stop() {
      if (extendTimer) clearInterval(extendTimer);
      if (mediaSessionId) stopSession(deviceId, mediaSessionId);
      try {
        pc.close();
      } catch (_) {}
      if (videoEl) videoEl.srcObject = null;
    }

    return {
      pc: pc,
      mediaSessionId: mediaSessionId,
      expiresAt: result.expiresAt,
      name: result.name,
      iceState: iceState,
      stop: stop,
      remoteStream: remoteStream,
    };
  }

  global.NestWebRtc = {
    proxyBase: proxyBase,
    proxyToken: proxyToken,
    proxyUnreachableHint: proxyUnreachableHint,
    ensureProxyFromLive: ensureProxyFromLive,
    ingestLiveProxy: ingestLiveProxy,
    isPagesHost: isPagesHost,
    isLoopbackProxy: isLoopbackProxy,
    fetchCameras: fetchCameras,
    startStream: startStream,
    forceRecvonly: forceRecvonly,
    reorderSdp: reorderSdp,
  };
})(typeof window !== "undefined" ? window : globalThis);
