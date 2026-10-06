(() => {
  if (globalThis.__geoboostPageProbeInstalled) return;
  globalThis.__geoboostPageProbeInstalled = true;

  const MESSAGE_SOURCE = "GEOBOOST_PAGE";
  const AUTOPLACE_DIRECT_ZOOM = 10;
  const AUTOPLACE_FINAL_ZOOM = 11;
  const AUTOPLACE_PREFLIGHT_ZOOM = 4;
  const AUTOPLACE_CLICK_MIN = 1;
  const AUTOPLACE_CLICK_MAX = 3;
  const AUTOPLACE_MIN_FRAME_MS = 62;
  const AUTOPLACE_LOW_POWER_FRAME_MS = 82;
  const AUTOPLACE_MAX_DURATION_MS = 15_000;
  const AUTOPLACE_MAX_STALLED_STEPS = 2;
  const LEAFLET_TILE_SIZE = 256;
  const LEAFLET_MAX_PAN_PASSES = 8;
  const IS_GEOGUESSR = /(^|\.)geoguessr\.com$/i.test(location.hostname);
  let lastCoordinates = null;
  let lastBroadcastKey = "";
  let leafletMap = null;
  const leafletMaps = new Set();
  const inspectedLeafletModuleUrls = new Set();
  const subscribedLeafletStores = new WeakSet();
  let leafletModuleDiscoveryPromise = null;
  let placementRunId = 0;
  let placementDeadline = 0;

  function broadcastCoordinates(coords, source = "page") {
    const normalized = normalizeCoordinates(coords);
    if (!normalized) return;
    const key = `${normalized.lat.toFixed(7)},${normalized.lng.toFixed(7)},${source}`;
    if (key === lastBroadcastKey) return;
    lastBroadcastKey = key;
    lastCoordinates = { ...normalized, source, timestamp: Date.now() };
    globalThis.__geoboostLastCoordinates = lastCoordinates;
    try {
      localStorage.setItem("GEOBOOST_LAST_COORDS", JSON.stringify(lastCoordinates));
    } catch {
      // Storage can be blocked in iframes.
    }
    window.postMessage(
      { source: MESSAGE_SOURCE, type: "coordinates", payload: lastCoordinates },
      "*",
    );
  }

  function normalizeCoordinates(value) {
    if (!value || typeof value !== "object") return null;
    const lat = Number(value.lat ?? value.latitude);
    const lng = Number(value.lng ?? value.lon ?? value.long ?? value.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return null;
    return { lat, lng };
  }

  function normalizeKnownCoordinateValue(value) {
    if (Array.isArray(value) && value.length >= 2) {
      return normalizeCoordinates({ lat: value[0], lng: value[1] });
    }
    return normalizeCoordinates(value);
  }

  function scanForCoordinates(value, depth = 0, seen = new WeakSet()) {
    if (depth > 7 || value == null) return null;
    if (typeof value !== "object") return null;
    if (seen.has(value)) return null;
    seen.add(value);

    const activeRound = scanActiveRound(value, depth, seen);
    if (activeRound) return activeRound;

    const direct = normalizeCoordinates(value);
    if (direct) return direct;

    const priorityKeys = [
      "activeTargetDrop",
      "targetDrop",
      "activeTargetLatLng",
      "targetLocation",
      "correctLocation",
      "roundLocation",
      "activeDrop",
      "currentDrop",
      "drop",
      "target",
      "round",
      "location",
      "loc",
      "latLong",
      "latLng",
      "position",
      "coords",
      "coordinates",
      "answer",
      "correctAnswer",
      "solution",
      "streetView",
      "pano",
      "panorama",
    ];
    for (const key of priorityKeys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const directKnown = normalizeKnownCoordinateValue(value[key]);
        if (directKnown) return directKnown;
        const found = scanForCoordinates(value[key], depth + 1, seen);
        if (found) return found;
      }
    }

    if (depth >= 4) return null;
    for (const key of Object.keys(value).slice(0, 120)) {
      if (priorityKeys.includes(key) || key === "rounds") continue;
      const found = scanForCoordinates(value[key], depth + 1, seen);
      if (found) return found;
    }
    return null;
  }

  function scanGeoGuessrCoordinates(value, depth = 0, seen = new WeakSet()) {
    if (depth > 7 || value == null || typeof value !== "object") return null;
    if (seen.has(value)) return null;
    seen.add(value);

    const activeRound = scanActiveRound(value, depth, seen);
    if (activeRound) return activeRound;

    const roundKeys = ["round", "currentRoundData", "roundData"];
    for (const key of roundKeys) {
      const round = value[key];
      if (!round || typeof round !== "object") continue;
      const found = scanForCoordinates(round, depth + 1, new WeakSet());
      if (found) return found;
    }

    const wrapperKeys = ["game", "gameData", "data", "payload", "result", "state"];
    for (const key of wrapperKeys) {
      const child = value[key];
      if (!child || typeof child !== "object") continue;
      const found = scanGeoGuessrCoordinates(child, depth + 1, seen);
      if (found) return found;
    }

    if (depth >= 5) return null;
    for (const key of Object.keys(value).slice(0, 100)) {
      const child = value[key];
      if (!child || typeof child !== "object") continue;
      const found = scanGeoGuessrCoordinates(child, depth + 1, seen);
      if (found) return found;
    }
    return null;
  }

  function scanPayloadForCoordinates(value) {
    if (!IS_GEOGUESSR) return scanForCoordinates(value);
    // Keep the structured round parser first, but preserve the legacy direct
    // payload fallback that GeoGuessr used before the multi-site adapters.
    return scanGeoGuessrCoordinates(value) || scanForCoordinates(value);
  }

  function scanActiveRound(value, depth, seen) {
    if (!Array.isArray(value.rounds) || !value.rounds.length) return null;

    const oneBasedRound = firstInteger(
      typeof value.round === "number" ? value.round : null,
      value.currentRound,
      value.roundNumber,
      value.currentRoundNumber,
    );
    if (oneBasedRound !== null && oneBasedRound >= 1 && oneBasedRound <= value.rounds.length) {
      return scanForCoordinates(value.rounds[oneBasedRound - 1], depth + 1, seen);
    }

    const zeroBasedRound = firstInteger(value.roundIndex, value.currentRoundIndex);
    if (zeroBasedRound !== null && zeroBasedRound >= 0 && zeroBasedRound < value.rounds.length) {
      return scanForCoordinates(value.rounds[zeroBasedRound], depth + 1, seen);
    }

    // A multi-round collection without an active index is ambiguous. Returning
    // its first item can silently repeat an earlier round.
    if (value.rounds.length === 1) {
      return scanForCoordinates(value.rounds[0], depth + 1, seen);
    }
    return null;
  }

  function firstInteger(...values) {
    for (const value of values) {
      if (value === null || value === undefined || value === "") continue;
      const number = Number(value);
      if (Number.isInteger(number)) return number;
    }
    return null;
  }

  function shouldScanUrl(url) {
    const value = String(url || "").toLowerCase();
    if (!value) return true;
    return (
      value.includes("geoguessr") ||
      value.includes("openguessr") ||
      value.includes("geotastic") ||
      value.includes("worldguessr") ||
      value.includes("freeguessr") ||
      value.includes("google") ||
      value.includes("/api/") ||
      value.includes("/game") ||
      value.includes("/round") ||
      value.includes("/challenge") ||
      value.includes("streetview") ||
      value.includes("photometa") ||
      value.includes("geo")
    );
  }

  function tryParsePayload(text, source) {
    if (!text || text.length > 3_000_000) return;
    try {
      const parsed = JSON.parse(text);
      const coords = scanPayloadForCoordinates(parsed);
      if (coords) broadcastCoordinates(coords, source);
    } catch {
      const jsonStart = String(text).search(/[\[{]/);
      if (jsonStart > 0) {
        try {
          const parsed = JSON.parse(String(text).slice(jsonStart));
          const coords = scanPayloadForCoordinates(parsed);
          if (coords) {
            broadcastCoordinates(coords, source);
            return;
          }
        } catch {
          // Some socket protocols use non-JSON frames; regex scanning still applies.
        }
      }
      if (!IS_GEOGUESSR) scanTextForCoordinates(text, source);
    }
  }

  function scanTextForCoordinates(text, source) {
    const value = String(text || "");
    if (!value || value.length > 3_000_000) return;
    const values = [value];
    try {
      const decoded = decodeURIComponent(value);
      if (decoded !== value) values.push(decoded);
    } catch {
      // Malformed percent escapes do not prevent scanning the original value.
    }
    const patterns = [
      /"lat(?:itude)?"\s*:\s*(-?\d{1,2}\.\d+)\s*,\s*"(?:lng|lon|long|longitude)"\s*:\s*(-?\d{1,3}\.\d+)/i,
      /"(?:lng|lon|long|longitude)"\s*:\s*(-?\d{1,3}\.\d+)\s*,\s*"lat(?:itude)?"\s*:\s*(-?\d{1,2}\.\d+)/i,
      /(?:location|center|viewpoint|ll)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/i,
      /[?#&](?:l|location)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/i,
      /[?#&](?:lt|lat)=(-?\d{1,2}\.\d+)&(?:ln|lng)=(-?\d{1,3}\.\d+)/i,
      /\/maps\/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/i,
      /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/i,
      /!2d(-?\d{1,3}\.\d+)!3d(-?\d{1,2}\.\d+)/i,
    ];
    for (const candidate of values) {
      for (const pattern of patterns) {
        const match = candidate.match(pattern);
        if (!match) continue;
        let lat = Number(match[1]);
        let lng = Number(match[2]);
        if (pattern.source.includes("!2d")) {
          [lat, lng] = [lng, lat];
        }
        const coords = normalizeCoordinates({ lat, lng });
        if (coords) {
          broadcastCoordinates(coords, source);
          return;
        }
      }
    }
  }

  function hookNetwork() {
    const originalFetch = window.fetch;
    if (typeof originalFetch === "function") {
      window.fetch = async function geoboostFetchHook(...args) {
        const response = await originalFetch.apply(this, args);
        try {
          const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
          if (shouldScanUrl(url)) {
            response.clone().text().then((text) => tryParsePayload(text, "network")).catch(() => {});
          }
        } catch {
          // Keep page fetch behavior unchanged.
        }
        return response;
      };
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function geoboostXhrOpen(method, url, ...rest) {
      this.__geoboostUrl = url;
      return originalOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function geoboostXhrSend(...args) {
      try {
        this.addEventListener("readystatechange", () => {
          if (this.readyState !== 4 || !shouldScanUrl(this.__geoboostUrl)) return;
          try {
            const responseType = String(this.responseType || "").toLowerCase();
            if (responseType === "json") {
              const coords = scanPayloadForCoordinates(this.response);
              if (coords) broadcastCoordinates(coords, "network");
              return;
            }
            if (responseType !== "" && responseType !== "text") return;
            const text = typeof this.responseText === "string" ? this.responseText : "";
            tryParsePayload(text, "network");
          } catch {
            // Binary and browser-restricted XHR responses are not readable as text.
          }
        });
      } catch {
        // Keep page XHR behavior unchanged.
      }
      return originalSend.apply(this, args);
    };
  }

  function hookWebSocket() {
    // GeoGuessr's socket carries UI/map state in addition to round data. The
    // fetch/XHR responses are the stable source used before 1.0.5.
    if (IS_GEOGUESSR) return;
    const NativeWebSocket = window.WebSocket;
    if (typeof NativeWebSocket !== "function" || NativeWebSocket.__geoboostWrapped) return;

    class GeoBoostWebSocket extends NativeWebSocket {
      constructor(...args) {
        super(...args);
        this.addEventListener("message", (event) => {
          scanSocketPayload(event.data);
        });
      }
    }
    GeoBoostWebSocket.__geoboostWrapped = true;
    window.WebSocket = GeoBoostWebSocket;
  }

  function scanSocketPayload(payload) {
    if (typeof payload === "string") {
      tryParsePayload(payload, "websocket");
      return;
    }
    if (payload instanceof Blob) {
      if (payload.size > 3_000_000) return;
      payload.text().then((text) => tryParsePayload(text, "websocket")).catch(() => {});
      return;
    }
    const buffer = payload instanceof ArrayBuffer
      ? payload
      : ArrayBuffer.isView(payload)
        ? payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength)
        : null;
    if (!buffer || buffer.byteLength > 3_000_000) return;
    try {
      tryParsePayload(new TextDecoder().decode(buffer), "websocket");
    } catch {
      // Binary game frames that are not text are ignored.
    }
  }

  function pollStreetViewPosition() {
    const pos = findStreetViewPosition();
    if (pos) broadcastCoordinates(pos, "streetview");
  }

  function findStreetViewPosition() {
    const candidates = [];
    try {
      candidates.push(window.google?.maps);
    } catch {
      // ignored
    }
    const targetedNodes = document.querySelectorAll(
      '.streetview-map, .iframeWithStreetView, .gm-style, [class*="streetview"], ' +
        '[class*="panorama"], [id*="streetview"], [id*="panorama"]',
    );
    const nodes = [
      ...targetedNodes,
      ...Array.from(document.querySelectorAll("div")).slice(0, 700),
    ];
    for (const element of new Set(nodes)) {
      for (const key of safeOwnPropertyNames(element).slice(0, 70)) {
        try {
          candidates.push(element[key]);
        } catch {
          // ignored
        }
      }
    }
    for (const candidate of candidates) {
      const coords = extractPositionFromObject(candidate);
      if (coords) return coords;
    }
    return null;
  }

  function extractPositionFromObject(obj, depth = 0, seen = new WeakSet()) {
    if (!obj || typeof obj !== "object" || depth > 3 || seen.has(obj)) return null;
    seen.add(obj);
    try {
      if (typeof obj.getPosition === "function") {
        const pos = obj.getPosition();
        const coords = latLngToPlain(pos);
        if (coords) return coords;
      }
      if (typeof obj.getStreetView === "function") {
        const sv = obj.getStreetView();
        if (sv && typeof sv.getPosition === "function") {
          const coords = latLngToPlain(sv.getPosition());
          if (coords) return coords;
        }
      }
    } catch {
      // ignored
    }
    for (const key of Object.keys(obj).slice(0, 40)) {
      let child;
      try {
        child = obj[key];
      } catch {
        continue;
      }
      const coords = extractPositionFromObject(child, depth + 1, seen);
      if (coords) return coords;
    }
    return null;
  }

  function latLngToPlain(value) {
    if (!value) return null;
    const lat = typeof value.lat === "function" ? value.lat() : value.lat;
    const lng = typeof value.lng === "function" ? value.lng() : value.lng;
    return normalizeCoordinates({ lat, lng });
  }

  function pollIframeUrls() {
    if (IS_GEOGUESSR) {
      for (const iframe of document.querySelectorAll("iframe")) {
        scanTextForCoordinates(iframe.src || "", "iframe");
      }
      return;
    }
    const elements = [
      ...document.querySelectorAll(
        '.streetview-container a[href*="google.com/maps"], ' +
          '.street-map a[href*="google.com/maps"], iframe, object',
      ),
    ];
    for (const element of elements) {
      const values = [
        element.href,
        element.src,
        element.data,
        element.getAttribute?.("href"),
        element.getAttribute?.("src"),
        element.getAttribute?.("data"),
        element.getAttribute?.("srcdoc"),
      ];
      for (const value of values) {
        scanTextForCoordinates(value || "", "embed");
      }
    }
  }

  function pollFrameworkCoordinates() {
    // GeoGuessr exposes several unrelated map states in its React tree while a
    // round is loading. The fetch/XHR payload is authoritative there;
    // framework scanning can otherwise alternate the real round with a default
    // map location such as San Francisco.
    if (IS_GEOGUESSR) return;

    const selectors = [
      ".streetview-map",
      ".iframeWithStreetView",
      ".target-area",
      '[class*="streetview"]',
      '[class*="panorama"]',
      '[id*="streetview"]',
      '[id*="panorama"]',
      "#root",
      "#app",
    ];
    const nodes = [document.body];
    for (const selector of selectors) {
      nodes.push(...document.querySelectorAll(selector));
    }
    for (const element of new Set(nodes.filter(Boolean))) {
      for (const key of safeOwnPropertyNames(element).slice(0, 100)) {
        if (!isFrameworkStateKey(key)) continue;
        let value;
        try {
          value = element[key];
        } catch {
          continue;
        }
        const coords = scanPayloadForCoordinates(value);
        if (coords) {
          broadcastCoordinates(coords, "framework");
          return;
        }
      }
    }
  }

  function isFrameworkStateKey(key) {
    return (
      key === "__vue__" ||
      key === "__vueParentComponent" ||
      key === "__ngContext__" ||
      key.startsWith("__reactFiber$") ||
      key.startsWith("__reactProps$")
    );
  }

  function safeOwnPropertyNames(value) {
    try {
      return Object.getOwnPropertyNames(value);
    } catch {
      return [];
    }
  }

  function hookLeaflet() {
    const shouldPrimeModules = () =>
      location.hostname.toLowerCase().includes("freeguessr");
    const install = () => {
      const L = window.L;
      if (L) hookLeafletNamespace(L);
    };
    install();
    if (shouldPrimeModules()) void discoverLeafletModules();
    setInterval(() => {
      install();
      if (shouldPrimeModules()) void discoverLeafletModules();
      if (!leafletMap) leafletMap = findLeafletMap();
    }, 1200);
    if (shouldPrimeModules()) {
      const observer = new MutationObserver(() => {
        if (leafletModuleUrls().some((url) => !inspectedLeafletModuleUrls.has(url))) {
          void discoverLeafletModules();
        }
      });
      const observeModules = () => {
        if (document.documentElement) {
          observer.observe(document.documentElement, { childList: true, subtree: true });
        } else {
          setTimeout(observeModules, 0);
        }
      };
      observeModules();
    }
  }

  function rememberLeafletMap(map) {
    if (!isLeafletMap(map)) return null;
    leafletMap = map;
    leafletMaps.add(map);
    return map;
  }

  function hookLeafletNamespace(value) {
    const candidates = [value, value?.default].filter(Boolean);
    for (const L of candidates) {
      try {
        if (typeof L.map === "function" && !L.map.__geoboostWrapped) {
          const originalMap = L.map;
          L.map = function geoboostLeafletMap(...args) {
            const map = originalMap.apply(this, args);
            rememberLeafletMap(map);
            return map;
          };
          L.map.__geoboostWrapped = true;
        }
      } catch {
        // Some module namespace objects are read-only.
      }
      try {
        const prototype = L.Map?.prototype;
        if (
          prototype &&
          typeof prototype.initialize === "function" &&
          !prototype.initialize.__geoboostWrapped
        ) {
          const originalInitialize = prototype.initialize;
          prototype.initialize = function geoboostLeafletInitialize(...args) {
            const result = originalInitialize.apply(this, args);
            rememberLeafletMap(this);
            return result;
          };
          prototype.initialize.__geoboostWrapped = true;
        }
      } catch {
        // The prototype can be sealed by the host application.
      }
    }
  }

  function inspectLeafletModuleValue(value) {
    if (!value) return;
    if (isLeafletMap(value)) {
      rememberLeafletMap(value);
      return;
    }
    if ((typeof value === "object" || typeof value === "function") && value.Map) {
      hookLeafletNamespace(value);
    }
    if (
      typeof value === "object" &&
      typeof value.subscribe === "function" &&
      !subscribedLeafletStores.has(value)
    ) {
      subscribedLeafletStores.add(value);
      try {
        const unsubscribe = value.subscribe((current) => {
          if (isLeafletMap(current)) rememberLeafletMap(current);
        });
        if (typeof unsubscribe === "function") unsubscribe();
      } catch {
        // Not every subscribe-shaped export is a Svelte store.
      }
    }
  }

  function leafletModuleUrls() {
    const hostname = location.hostname.toLowerCase();
    const urls = new Set();
    for (const element of document.querySelectorAll('link[href], script[src]')) {
      const rawUrl = element.href || element.src;
      if (!rawUrl) continue;
      let url;
      try {
        url = new URL(rawUrl, location.href);
      } catch {
        continue;
      }
      if (
        hostname.includes("openguessr") &&
        url.origin === location.origin &&
        /\/_app\/immutable\/chunks\/[^/]+\.js$/.test(url.pathname)
      ) {
        urls.add(url.href);
      }
      if (
        hostname.includes("freeguessr") &&
        /\/assets\/maps-vendor-[^/]+\.js$/.test(url.pathname)
      ) {
        urls.add(url.href);
      }
    }
    return Array.from(urls);
  }

  async function discoverLeafletModules() {
    if (leafletModuleDiscoveryPromise) return leafletModuleDiscoveryPromise;
    const pendingUrls = leafletModuleUrls().filter(
      (url) => !inspectedLeafletModuleUrls.has(url),
    );
    if (!pendingUrls.length) return findLeafletMap();
    leafletModuleDiscoveryPromise = (async () => {
      const batchSize = location.hostname.toLowerCase().includes("openguessr") ? 8 : 2;
      for (let offset = 0; offset < pendingUrls.length; offset += batchSize) {
        const batch = pendingUrls.slice(offset, offset + batchSize);
        await Promise.all(
          batch.map(async (url) => {
            inspectedLeafletModuleUrls.add(url);
            try {
              const module = await import(url);
              for (const [key, value] of Object.entries(module)) {
                inspectLeafletModuleValue(value);
                if (
                  location.hostname.toLowerCase().includes("freeguessr") &&
                  key === "h" &&
                  typeof value === "function"
                ) {
                  try {
                    inspectLeafletModuleValue(value());
                  } catch {
                    // Current FreeGuessr bundles expose Leaflet through this factory.
                  }
                }
              }
            } catch {
              inspectedLeafletModuleUrls.delete(url);
            }
          }),
        );
        const discovered = findLeafletMap();
        if (discovered) return discovered;
      }
      return findLeafletMap();
    })();
    try {
      return await leafletModuleDiscoveryPromise;
    } finally {
      leafletModuleDiscoveryPromise = null;
    }
  }

  function isLeafletMap(value) {
    return Boolean(
      value &&
        typeof value === "object" &&
        typeof value.setView === "function" &&
        typeof value.latLngToContainerPoint === "function" &&
        typeof value.fire === "function",
    );
  }

  function findLeafletMap() {
    const containers = Array.from(document.querySelectorAll(".leaflet-container"))
      .filter(isVisibleMapContainer)
      .sort((a, b) => mapContainerArea(b) - mapContainerArea(a));
    for (const container of containers) {
      const map = scanNodeForLeafletMap(container);
      if (map) {
        return rememberLeafletMap(map);
      }
    }
    if (isUsableLeafletMap(leafletMap)) return leafletMap;
    for (const map of leafletMaps) {
      if (isUsableLeafletMap(map)) {
        leafletMap = map;
        return map;
      }
      leafletMaps.delete(map);
    }
    for (const key of Object.keys(window).slice(0, 1000)) {
      try {
        if (isLeafletMap(window[key])) {
          return rememberLeafletMap(window[key]);
        }
      } catch {
        // ignored
      }
    }
    return null;
  }

  function isUsableLeafletMap(map) {
    if (!isLeafletMap(map)) return false;
    try {
      const container = map.getContainer?.();
      return !container || (container.isConnected && isVisibleMapContainer(container));
    } catch {
      return false;
    }
  }

  function scanNodeForLeafletMap(node) {
    let current = node;
    const budget = { remaining: 1_500 };
    for (let level = 0; current && level < 4; level += 1, current = current.parentElement) {
      for (const key of safeOwnPropertyNames(current).slice(0, 120)) {
        let value;
        try {
          value = current[key];
        } catch {
          continue;
        }
        const map = scanForLeafletMap(value, 0, new WeakSet(), budget);
        if (map) return map;
      }
    }
    return null;
  }

  function scanForLeafletMap(value, depth = 0, seen = new WeakSet(), budget = { remaining: 1_500 }) {
    if (
      !value ||
      typeof value !== "object" ||
      depth > 6 ||
      seen.has(value) ||
      budget.remaining <= 0
    ) return null;
    budget.remaining -= 1;
    seen.add(value);
    if (isLeafletMap(value)) return value;
    for (const key of safeOwnPropertyNames(value).slice(0, 100)) {
      let child;
      try {
        child = value[key];
      } catch {
        continue;
      }
      const map = scanForLeafletMap(child, depth + 1, seen, budget);
      if (map) return map;
    }
    return null;
  }

  function isVisibleMapContainer(container) {
    if (!(container instanceof Element) || !container.isConnected) return false;
    const rect = container.getBoundingClientRect();
    const style = getComputedStyle(container);
    return (
      rect.width >= 90 &&
      rect.height >= 70 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || 1) !== 0
    );
  }

  function mapContainerArea(container) {
    const rect = container.getBoundingClientRect();
    return rect.width * rect.height;
  }

  function findGoogleMap() {
    const selectors = [
      '[data-qa="guess-map"]',
      '[data-qa="guess-map-canvas"]',
      '[class*="guess-map"]',
      'div[aria-roledescription="map"]',
    ];
    const targetedNodes = [];
    for (const selector of selectors) {
      targetedNodes.push(...document.querySelectorAll(selector));
    }
    for (const node of new Set(targetedNodes)) {
      const found = scanNodeForGoogleMap(node, 7, 120);
      if (found) return found;
    }
    return null;
  }

  function scanNodeForGoogleMap(node, maxDepth, maxKeys) {
    let current = node;
    const budget = { remaining: maxDepth > 3 ? 2_500 : 500 };
    for (let level = 0; current && level < 4; level += 1, current = current.parentElement) {
      for (const key of safeOwnPropertyNames(current).slice(0, maxKeys)) {
        let value;
        try {
          value = current[key];
        } catch {
          continue;
        }
        const map = scanForGoogleMap(
          value,
          0,
          new WeakSet(),
          maxDepth,
          maxKeys,
          budget,
          node,
        );
        if (map) return map;
      }
    }
    return null;
  }

  function scanForGoogleMap(value, depth, seen, maxDepth, maxKeys, budget, targetNode) {
    if (
      !value ||
      typeof value !== "object" ||
      depth > maxDepth ||
      seen.has(value) ||
      budget.remaining <= 0
    ) return null;
    budget.remaining -= 1;
    seen.add(value);
    if (
      typeof value.getCenter === "function" &&
      typeof value.setCenter === "function" &&
      typeof value.getZoom === "function" &&
      typeof value.setZoom === "function"
    ) {
      let mapDiv = null;
      try {
        mapDiv = value.getDiv?.() || null;
      } catch {
        mapDiv = null;
      }
      if (
        !mapDiv ||
        mapDiv === targetNode ||
        targetNode.contains(mapDiv) ||
        mapDiv.contains?.(targetNode)
      ) {
        return value;
      }
      return null;
    }
    for (const key of safeOwnPropertyNames(value).slice(0, maxKeys)) {
      let child;
      try {
        child = value[key];
      } catch {
        continue;
      }
      const map = scanForGoogleMap(
        child,
        depth + 1,
        seen,
        maxDepth,
        maxKeys,
        budget,
        targetNode,
      );
      if (map) return map;
    }
    return null;
  }

  function handlePlacement(payload) {
    const coords = normalizeCoordinates(payload);
    if (!coords) return;
    const runId = ++placementRunId;
    placementDeadline = Date.now() + AUTOPLACE_MAX_DURATION_MS;
    const smartZoom = payload.smartZoom !== false;
    const autoGuess = payload.autoGuess === true;
    const speed = Number(payload.smartZoomSpeed) || 5;
    const clickSequence = payload.clickSequence;
    const map = findLeafletMap();
    if (map) {
      void placeOnLeaflet(map, coords, smartZoom, speed, clickSequence, runId, autoGuess);
      return;
    }
    if (leafletModuleUrls().length) {
      void discoverLeafletModules().then((discoveredMap) => {
        if (!isPlacementActive(runId)) return;
        if (discoveredMap) {
          void placeOnLeaflet(
            discoveredMap,
            coords,
            smartZoom,
            speed,
            clickSequence,
            runId,
            autoGuess,
          );
          return;
        }
        const fallback = findLeafletDomMap();
        if (fallback) {
          void placeOnLeafletDom(
            fallback,
            coords,
            smartZoom,
            speed,
            clickSequence,
            runId,
            autoGuess,
          );
        }
      });
      return;
    }
    const leafletDom = findLeafletDomMap();
    if (leafletDom) {
      void placeOnLeafletDom(leafletDom, coords, smartZoom, speed, clickSequence, runId, autoGuess);
      return;
    }
    const googleMap = findGoogleMap();
    if (googleMap && window.google?.maps) {
      void placeOnGoogleMap(googleMap, coords, smartZoom, speed, clickSequence, runId, autoGuess);
      return;
    }
    const googleDomMap = findGoogleDomMap();
    if (googleDomMap) {
      void placeOnGoogleDomMap(googleDomMap, coords, smartZoom, speed, clickSequence, runId, autoGuess);
    }
  }

  async function placeOnLeaflet(map, coords, smartZoom, speed, clickSequence, runId, autoGuess) {
    const target = { lat: coords.lat, lng: coords.lng };
    const sequence = placementClickSequence(target, clickSequence);
    const motion = createMotionProfile(speed);
    const click = (point) => {
      const containerPoint = map.latLngToContainerPoint(point);
      let latlng = point;
      try {
        if (typeof map.containerPointToLatLng === "function") {
          latlng = map.containerPointToLatLng(containerPoint);
        } else if (typeof map.options?.crs?.wrapLatLng === "function") {
          latlng = map.options.crs.wrapLatLng(point);
        }
      } catch {
        latlng = point;
      }
      map.fire("click", {
        latlng,
        layerPoint: map.latLngToLayerPoint ? map.latLngToLayerPoint(latlng) : undefined,
        containerPoint,
        originalEvent: new MouseEvent("click", { bubbles: true }),
      });
    };
    if (!smartZoom) {
      const point = sequence[sequence.length - 1];
      map.setView([point.lat, point.lng], AUTOPLACE_DIRECT_ZOOM);
      await placementPause(180, runId);
      if (isPlacementActive(runId)) {
        click(point);
        scheduleAutoGuess(runId, autoGuess);
      }
      return;
    }
    for (let index = 0; index < sequence.length; index += 1) {
      if (!isPlacementActive(runId)) return;
      const point = sequence[index];
      const waypoint = cameraWaypoint(point);
      if (index === 0) {
        await runLeafletMotion(
          map,
          () => map.panTo([point.lat, point.lng], { animate: true, duration: motion.panMs / 1000 }),
          motion.panMs,
          runId,
        );
        await placementPause(randomBetween(140, 320), runId);
        await runLeafletMotion(
          map,
          () => map.flyTo([point.lat, point.lng], AUTOPLACE_FINAL_ZOOM, {
            animate: true,
            duration: motion.zoomMs / 1000,
          }),
          motion.zoomMs,
          runId,
        );
      } else {
        await runLeafletMotion(
          map,
          () => map.flyTo([waypoint.lat, waypoint.lng], waypoint.zoom, {
            animate: true,
            duration: motion.transitionMs / 1000,
          }),
          motion.transitionMs,
          runId,
        );
        await placementPause(randomBetween(90, 220), runId);
        await runLeafletMotion(
          map,
          () => map.flyTo([point.lat, point.lng], AUTOPLACE_FINAL_ZOOM, {
            animate: true,
            duration: motion.zoomMs / 1000,
          }),
          motion.zoomMs,
          runId,
        );
      }
      await placementPause(randomBetween(260, 520), runId);
      if (!isPlacementActive(runId)) return;
      click(point);
      if (index === sequence.length - 1) scheduleAutoGuess(runId, autoGuess);
      if (index < sequence.length - 1) {
        await placementPause(randomBetween(420, 760), runId);
      }
    }
  }

  async function placeOnGoogleMap(map, coords, smartZoom, speed, clickSequence, runId, autoGuess) {
    const LatLng = window.google.maps.LatLng;
    const target = { lat: coords.lat, lng: coords.lng };
    const sequence = placementClickSequence(target, clickSequence);
    const motion = createMotionProfile(speed);
    const click = (latLng) => {
      window.google.maps.event.trigger(map, "click", {
        latLng,
        domEvent: new MouseEvent("click", { bubbles: true }),
      });
    };
    if (!smartZoom) {
      const point = sequence[sequence.length - 1];
      const latLng = new LatLng(point.lat, point.lng);
      map.setCenter(latLng);
      map.setZoom(AUTOPLACE_DIRECT_ZOOM);
      await placementPause(180, runId);
      if (isPlacementActive(runId)) {
        click(latLng);
        scheduleAutoGuess(runId, autoGuess);
      }
      return;
    }
    let previousCenter = googleMapCenter(map) || sequence[0];
    let previousZoom = googleMapZoom(map) ?? AUTOPLACE_PREFLIGHT_ZOOM;
    for (let index = 0; index < sequence.length; index += 1) {
      if (!isPlacementActive(runId)) return;
      const point = sequence[index];
      const waypoint = cameraWaypoint(point);
      const targetLatLng = new LatLng(point.lat, point.lng);
      if (index === 0) {
        await animateGoogleCamera(
          map,
          LatLng,
          previousCenter,
          point,
          previousZoom,
          previousZoom,
          motion.panMs,
          motion.frameMs,
          runId,
        );
        await waitForGoogleIdle(map, randomBetween(140, 300), runId);
        await animateGoogleCamera(
          map,
          LatLng,
          point,
          point,
          previousZoom,
          AUTOPLACE_FINAL_ZOOM,
          motion.zoomMs,
          motion.frameMs,
          runId,
        );
      } else {
        await animateGoogleCamera(
          map,
          LatLng,
          previousCenter,
          waypoint,
          previousZoom,
          waypoint.zoom,
          motion.transitionMs,
          motion.frameMs,
          runId,
        );
        await waitForGoogleIdle(map, randomBetween(90, 210), runId);
        await animateGoogleCamera(
          map,
          LatLng,
          waypoint,
          point,
          waypoint.zoom,
          AUTOPLACE_FINAL_ZOOM,
          motion.zoomMs,
          motion.frameMs,
          runId,
        );
      }
      await waitForGoogleIdle(map, randomBetween(250, 480), runId);
      if (!isPlacementActive(runId)) return;
      click(targetLatLng);
      if (index === sequence.length - 1) scheduleAutoGuess(runId, autoGuess);
      previousCenter = point;
      previousZoom = AUTOPLACE_FINAL_ZOOM;
      if (index < sequence.length - 1) {
        await placementPause(randomBetween(420, 760), runId);
      }
    }
  }

  function findLeafletDomMap() {
    const candidates = Array.from(document.querySelectorAll(".leaflet-container"));
    let best = null;
    let bestArea = 0;
    for (const container of candidates) {
      const rect = container.getBoundingClientRect();
      const style = getComputedStyle(container);
      const area = rect.width * rect.height;
      if (
        area < 4_000 ||
        rect.width < 90 ||
        rect.height < 70 ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity || 1) === 0
      ) {
        continue;
      }
      if (!readLeafletDomState(container)) continue;
      if (area > bestArea) {
        best = container;
        bestArea = area;
      }
    }
    return best;
  }

  async function placeOnLeafletDom(container, coords, smartZoom, speed, clickSequence, runId, autoGuess) {
    const target = { lat: coords.lat, lng: coords.lng };
    const sequence = placementClickSequence(target, clickSequence);
    const motion = createMotionProfile(speed);
    const finalZoom = smartZoom ? AUTOPLACE_FINAL_ZOOM : AUTOPLACE_DIRECT_ZOOM;

    for (let index = 0; index < sequence.length; index += 1) {
      if (!isPlacementActive(runId)) return;
      const point = sequence[index];

      if (smartZoom && index > 0) {
        await setLeafletDomZoom(container, Math.max(7, finalZoom - 3), motion, runId);
      }
      const centered = await centerLeafletDomMap(container, point, motion, runId);
      if (!centered || !isPlacementActive(runId)) return;

      if (smartZoom) {
        await setLeafletDomZoom(container, finalZoom, motion, runId);
      }
      if (!isDomPointNearCenter(container, leafletDomPoint(container, point))) {
        const recentered = await centerLeafletDomMap(container, point, motion, runId);
        if (!recentered) return;
      }
      await placementPause(randomBetween(180, 340), runId);
      if (!isPlacementActive(runId)) return;

      if (!clickLeafletDomAtCoordinates(container, point)) return;
      if (index === sequence.length - 1) scheduleAutoGuess(runId, autoGuess);
      if (index < sequence.length - 1) {
        await placementPause(randomBetween(420, 760), runId);
      }
    }
  }

  async function centerLeafletDomMap(container, coords, motion, runId) {
    let stalledSteps = 0;
    for (let pass = 0; pass < LEAFLET_MAX_PAN_PASSES; pass += 1) {
      if (!isPlacementActive(runId)) return false;
      const point = leafletDomPoint(container, coords);
      if (!point) return false;
      const rect = container.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const delta = {
        x: center.x - point.x,
        y: center.y - point.y,
      };
      const distance = Math.hypot(delta.x, delta.y);
      if (Math.abs(delta.x) <= 7 && Math.abs(delta.y) <= 7) return true;

      const drag = {
        x: clamp(delta.x, -rect.width * 0.42, rect.width * 0.42),
        y: clamp(delta.y, -rect.height * 0.42, rect.height * 0.42),
      };
      const passDuration = Math.max(260, Math.round(motion.panMs * 0.58));
      await dragLeafletDomMap(container, center, drag, passDuration, runId);
      await placementPause(randomBetween(90, 170), runId);
      const nextPoint = leafletDomPoint(container, coords);
      if (!nextPoint) return false;
      const nextDistance = Math.hypot(center.x - nextPoint.x, center.y - nextPoint.y);
      stalledSteps = nextDistance >= distance - 3 ? stalledSteps + 1 : 0;
      if (stalledSteps >= AUTOPLACE_MAX_STALLED_STEPS) return false;
    }
    const finalPoint = leafletDomPoint(container, coords);
    if (!finalPoint) return false;
    const rect = container.getBoundingClientRect();
    return (
      finalPoint.x >= rect.left &&
      finalPoint.x <= rect.right &&
      finalPoint.y >= rect.top &&
      finalPoint.y <= rect.bottom
    );
  }

  async function dragLeafletDomMap(container, start, delta, duration, runId) {
    const target = document.elementFromPoint(start.x, start.y) || container;
    const steps = Math.max(6, Math.min(14, Math.round(duration / 70)));
    dispatchPointerMouseEvent(target, "mousemove", start.x, start.y, 0);
    dispatchPointerMouseEvent(target, "mousedown", start.x, start.y, 1);
    for (let step = 1; step <= steps; step += 1) {
      if (!isPlacementActive(runId)) return;
      const progress = easeInOut(step / steps);
      const x = start.x + delta.x * progress;
      const y = start.y + delta.y * progress;
      dispatchPointerMouseEvent(document, "mousemove", x, y, 1);
      await placementPause(duration / steps, runId);
    }
    const endX = start.x + delta.x;
    const endY = start.y + delta.y;
    dispatchPointerMouseEvent(document, "mouseup", endX, endY, 0);
  }

  async function setLeafletDomZoom(container, targetZoom, motion, runId) {
    let stalledSteps = 0;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (!isPlacementActive(runId)) return false;
      const state = readLeafletDomState(container);
      if (!state) return false;
      if (state.zoom === targetZoom) return true;
      const zoomIn = state.zoom < targetZoom;
      const control = container.querySelector(
        zoomIn ? ".leaflet-control-zoom-in" : ".leaflet-control-zoom-out",
      );
      if (control && control.getAttribute("aria-disabled") !== "true") {
        control.click();
      } else {
        dispatchDomMapWheel(container, zoomIn, false);
      }
      await placementPause(
        Math.max(120, Math.round(motion.zoomMs / Math.max(4, Math.abs(targetZoom - state.zoom) + 1))),
        runId,
      );
      let nextState = readLeafletDomState(container);
      if (!nextState) return false;
      if (nextState.zoom === state.zoom && !control) {
        dispatchLeafletDomDoubleClick(container, !zoomIn);
        await placementPause(
          Math.max(120, Math.round(motion.zoomMs / 5)),
          runId,
        );
        nextState = readLeafletDomState(container);
        if (!nextState) return false;
      }
      stalledSteps = nextState.zoom === state.zoom ? stalledSteps + 1 : 0;
      if (stalledSteps >= AUTOPLACE_MAX_STALLED_STEPS) return false;
    }
    return readLeafletDomState(container)?.zoom === targetZoom;
  }

  function findGoogleDomMap() {
    const candidates = [
      ...document.querySelectorAll(
        '#guess-map, .guess-map, [data-qa="guess-map"], [data-qa="guess-map-canvas"]',
      ),
    ];
    let best = null;
    let bestArea = 0;
    for (const container of new Set(candidates)) {
      const rect = container.getBoundingClientRect();
      const style = getComputedStyle(container);
      const area = rect.width * rect.height;
      if (
        area < 4_000 ||
        rect.width < 90 ||
        rect.height < 70 ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity || 1) === 0
      ) {
        continue;
      }
      if (!readGoogleDomState(container)) continue;
      if (area > bestArea) {
        best = container;
        bestArea = area;
      }
    }
    return best;
  }

  async function placeOnGoogleDomMap(container, coords, smartZoom, speed, clickSequence, runId, autoGuess) {
    const target = { lat: coords.lat, lng: coords.lng };
    const sequence = placementClickSequence(target, clickSequence);
    const motion = createMotionProfile(speed);
    const finalZoom = smartZoom ? AUTOPLACE_FINAL_ZOOM : AUTOPLACE_DIRECT_ZOOM;

    for (let index = 0; index < sequence.length; index += 1) {
      if (!isPlacementActive(runId)) return;
      const point = sequence[index];

      if (smartZoom && index > 0) {
        await setGoogleDomZoom(container, Math.max(4, finalZoom - 3), motion, runId);
      }
      const centered = await centerGoogleDomMap(container, point, motion, runId);
      if (!centered || !isPlacementActive(runId)) return;

      if (smartZoom) {
        await setGoogleDomZoom(container, finalZoom, motion, runId);
      }
      if (!isDomPointNearCenter(container, googleDomPoint(container, point))) {
        const recentered = await centerGoogleDomMap(container, point, motion, runId);
        if (!recentered) return;
      }
      await placementPause(randomBetween(180, 340), runId);
      if (!isPlacementActive(runId)) return;

      if (!clickGoogleDomAtCoordinates(container, point)) return;
      if (index === sequence.length - 1) scheduleAutoGuess(runId, autoGuess);
      if (index < sequence.length - 1) {
        await placementPause(randomBetween(420, 760), runId);
      }
    }
  }

  async function centerGoogleDomMap(container, coords, motion, runId) {
    let stalledSteps = 0;
    let eventFamily = "pointer";
    for (let pass = 0; pass < LEAFLET_MAX_PAN_PASSES; pass += 1) {
      if (!isPlacementActive(runId)) return false;
      const point = googleDomPoint(container, coords);
      if (!point) return false;
      const rect = container.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const delta = {
        x: center.x - point.x,
        y: center.y - point.y,
      };
      const distance = Math.hypot(delta.x, delta.y);
      if (Math.abs(delta.x) <= 7 && Math.abs(delta.y) <= 7) return true;

      const drag = {
        x: clamp(delta.x, -rect.width * 0.42, rect.width * 0.42),
        y: clamp(delta.y, -rect.height * 0.42, rect.height * 0.42),
      };
      const passDuration = Math.max(260, Math.round(motion.panMs * 0.58));
      await dragGoogleDomMap(container, center, drag, passDuration, runId, eventFamily);
      await placementPause(randomBetween(90, 170), runId);
      const nextPoint = googleDomPoint(container, coords);
      if (!nextPoint) return false;
      const nextDistance = Math.hypot(center.x - nextPoint.x, center.y - nextPoint.y);
      if (nextDistance >= distance - 3 && pass === 0 && eventFamily === "pointer") {
        eventFamily = "mouse";
        stalledSteps = 0;
        continue;
      }
      stalledSteps = nextDistance >= distance - 3 ? stalledSteps + 1 : 0;
      if (stalledSteps >= AUTOPLACE_MAX_STALLED_STEPS) return false;
    }
    const finalPoint = googleDomPoint(container, coords);
    if (!finalPoint) return false;
    const rect = container.getBoundingClientRect();
    return (
      finalPoint.x >= rect.left &&
      finalPoint.x <= rect.right &&
      finalPoint.y >= rect.top &&
      finalPoint.y <= rect.bottom
    );
  }

  async function dragGoogleDomMap(container, start, delta, duration, runId, eventFamily) {
    const usePointer = eventFamily === "pointer" && typeof PointerEvent === "function";
    const target = document.elementFromPoint(start.x, start.y) || container;
    const steps = Math.max(6, Math.min(14, Math.round(duration / 70)));
    const moveType = usePointer ? "pointermove" : "mousemove";
    const downType = usePointer ? "pointerdown" : "mousedown";
    const upType = usePointer ? "pointerup" : "mouseup";
    dispatchPointerMouseEvent(target, moveType, start.x, start.y, 0);
    dispatchPointerMouseEvent(target, downType, start.x, start.y, 1);
    for (let step = 1; step <= steps; step += 1) {
      if (!isPlacementActive(runId)) return;
      const progress = easeInOut(step / steps);
      const x = start.x + delta.x * progress;
      const y = start.y + delta.y * progress;
      dispatchPointerMouseEvent(document, moveType, x, y, 1);
      await placementPause(duration / steps, runId);
    }
    dispatchPointerMouseEvent(
      document,
      upType,
      start.x + delta.x,
      start.y + delta.y,
      0,
    );
  }

  async function setGoogleDomZoom(container, targetZoom, motion, runId) {
    let stalledSteps = 0;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (!isPlacementActive(runId)) return false;
      const state = readGoogleDomState(container);
      if (!state) return false;
      if (state.zoom === targetZoom) return true;
      dispatchDomMapWheel(container, state.zoom < targetZoom, true);
      await placementPause(
        Math.max(140, Math.round(motion.zoomMs / Math.max(4, Math.abs(targetZoom - state.zoom) + 1))),
        runId,
      );
      const nextState = readGoogleDomState(container);
      if (!nextState) return false;
      stalledSteps = nextState.zoom === state.zoom ? stalledSteps + 1 : 0;
      if (stalledSteps >= AUTOPLACE_MAX_STALLED_STEPS) return false;
    }
    return readGoogleDomState(container)?.zoom === targetZoom;
  }

  function dispatchDomMapWheel(container, zoomIn, ctrlKey) {
    const rect = container.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const target = document.elementFromPoint(clientX, clientY) || container;
    target.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX,
        clientY,
        ctrlKey,
        deltaMode: 0,
        deltaY: zoomIn ? -80 : 80,
      }),
    );
  }

  function dispatchLeafletDomDoubleClick(container, shiftKey) {
    const rect = container.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const target = document.elementFromPoint(clientX, clientY) || container;
    target.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX,
        clientY,
        button: 0,
        buttons: 0,
        detail: 2,
        shiftKey,
      }),
    );
  }

  function isDomPointNearCenter(container, point, tolerance = 28) {
    if (!point) return false;
    const rect = container.getBoundingClientRect();
    return Math.hypot(
      point.x - (rect.left + rect.width / 2),
      point.y - (rect.top + rect.height / 2),
    ) <= tolerance;
  }

  function clickGoogleDomAtCoordinates(container, coords) {
    const point = googleDomPoint(container, coords);
    if (!point) return false;
    const rect = container.getBoundingClientRect();
    if (
      point.x < rect.left + 2 ||
      point.x > rect.right - 2 ||
      point.y < rect.top + 2 ||
      point.y > rect.bottom - 2
    ) {
      return false;
    }
    const target = document.elementFromPoint(point.x, point.y) || container;
    if (typeof PointerEvent === "function") {
      dispatchPointerMouseEvent(target, "pointermove", point.x, point.y, 0);
      dispatchPointerMouseEvent(target, "pointerdown", point.x, point.y, 1);
    }
    dispatchPointerMouseEvent(target, "mousemove", point.x, point.y, 0);
    dispatchPointerMouseEvent(target, "mousedown", point.x, point.y, 1);
    if (typeof PointerEvent === "function") {
      dispatchPointerMouseEvent(target, "pointerup", point.x, point.y, 0);
    }
    dispatchPointerMouseEvent(target, "mouseup", point.x, point.y, 0);
    dispatchPointerMouseEvent(target, "click", point.x, point.y, 0);
    return true;
  }

  function googleDomPoint(container, coords) {
    const state = readGoogleDomState(container);
    if (!state) return null;
    const worldSize = LEAFLET_TILE_SIZE * 2 ** state.zoom;
    const projected = projectWebMercator(coords, state.zoom);
    const tileOriginX = state.tileX * LEAFLET_TILE_SIZE;
    const tileOriginY = state.tileY * LEAFLET_TILE_SIZE;
    const scaleX = state.tileRect.width / LEAFLET_TILE_SIZE;
    const scaleY = state.tileRect.height / LEAFLET_TILE_SIZE;
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;
    const xCandidates = [-worldSize, 0, worldSize].map(
      (wrap) => state.tileRect.left + (projected.x + wrap - tileOriginX) * scaleX,
    );
    const x = xCandidates.reduce((best, candidate) =>
      Math.abs(candidate - centerX) < Math.abs(best - centerX) ? candidate : best,
    );
    return {
      x,
      y: state.tileRect.top + (projected.y - tileOriginY) * scaleY,
      zoom: state.zoom,
    };
  }

  function readGoogleDomState(container) {
    const containerRect = container.getBoundingClientRect();
    const groups = new Map();
    for (const tile of container.querySelectorAll('img[src*="maps.googleapis.com/maps/vt"]')) {
      const parsed = parseGoogleDomTileCoordinates(tile.currentSrc || tile.src);
      if (!parsed) continue;
      const rect = tile.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      const overlapX = Math.max(0, Math.min(rect.right, containerRect.right) - Math.max(rect.left, containerRect.left));
      const overlapY = Math.max(0, Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top));
      const visibleArea = overlapX * overlapY;
      if (visibleArea <= 0) continue;
      const current = groups.get(parsed.zoom) || { score: 0, tiles: [] };
      current.score += visibleArea;
      current.tiles.push({ ...parsed, tileRect: rect });
      groups.set(parsed.zoom, current);
    }
    const bestGroup = Array.from(groups.entries()).sort((a, b) => b[1].score - a[1].score)[0];
    if (!bestGroup) return null;
    const [zoom, group] = bestGroup;
    const center = {
      x: containerRect.left + containerRect.width / 2,
      y: containerRect.top + containerRect.height / 2,
    };
    const tile = group.tiles.sort((a, b) => {
      const aDistance = Math.hypot(
        a.tileRect.left + a.tileRect.width / 2 - center.x,
        a.tileRect.top + a.tileRect.height / 2 - center.y,
      );
      const bDistance = Math.hypot(
        b.tileRect.left + b.tileRect.width / 2 - center.x,
        b.tileRect.top + b.tileRect.height / 2 - center.y,
      );
      return aDistance - bDistance;
    })[0];
    return { ...tile, zoom };
  }

  function parseGoogleDomTileCoordinates(source) {
    const match = String(source || "").match(
      /!1m5!1m4!1i(-?\d+)!2i(-?\d+)!3i(-?\d+)!4i256/i,
    );
    if (!match) return null;
    return {
      zoom: Number(match[1]),
      tileX: Number(match[2]),
      tileY: Number(match[3]),
    };
  }

  function clickLeafletDomAtCoordinates(container, coords) {
    const point = leafletDomPoint(container, coords);
    if (!point) return false;
    const rect = container.getBoundingClientRect();
    if (
      point.x < rect.left + 2 ||
      point.x > rect.right - 2 ||
      point.y < rect.top + 2 ||
      point.y > rect.bottom - 2
    ) {
      return false;
    }
    const target = document.elementFromPoint(point.x, point.y) || container;
    dispatchPointerMouseEvent(target, "mousemove", point.x, point.y, 0);
    dispatchPointerMouseEvent(target, "mousedown", point.x, point.y, 1);
    dispatchPointerMouseEvent(target, "mouseup", point.x, point.y, 0);
    dispatchPointerMouseEvent(target, "click", point.x, point.y, 0);
    return true;
  }

  function dispatchPointerMouseEvent(target, type, clientX, clientY, buttons) {
    const EventClass = type.startsWith("pointer") && typeof PointerEvent === "function"
      ? PointerEvent
      : MouseEvent;
    target.dispatchEvent(
      new EventClass(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX,
        clientY,
        button: 0,
        buttons,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
  }

  function leafletDomPoint(container, coords) {
    const state = readLeafletDomState(container);
    if (!state) return null;
    const worldSize = LEAFLET_TILE_SIZE * 2 ** state.zoom;
    const projected = projectWebMercator(coords, state.zoom);
    const tileOriginX = state.tileX * LEAFLET_TILE_SIZE;
    const tileOriginY = state.tileY * LEAFLET_TILE_SIZE;
    const scaleX = state.tileRect.width / LEAFLET_TILE_SIZE;
    const scaleY = state.tileRect.height / LEAFLET_TILE_SIZE;
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;
    const xCandidates = [-worldSize, 0, worldSize].map(
      (wrap) => state.tileRect.left + (projected.x + wrap - tileOriginX) * scaleX,
    );
    const x = xCandidates.reduce((best, candidate) =>
      Math.abs(candidate - centerX) < Math.abs(best - centerX) ? candidate : best,
    );
    return {
      x,
      y: state.tileRect.top + (projected.y - tileOriginY) * scaleY,
      zoom: state.zoom,
    };
  }

  function readLeafletDomState(container) {
    const containerRect = container.getBoundingClientRect();
    const groups = new Map();
    for (const tile of container.querySelectorAll(".leaflet-tile")) {
      const parsed = parseLeafletTileCoordinates(tile.currentSrc || tile.src);
      if (!parsed) continue;
      const rect = tile.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      const overlapX = Math.max(0, Math.min(rect.right, containerRect.right) - Math.max(rect.left, containerRect.left));
      const overlapY = Math.max(0, Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top));
      const visibleArea = overlapX * overlapY;
      if (visibleArea <= 0) continue;
      const current = groups.get(parsed.zoom) || { score: 0, tiles: [] };
      current.score += visibleArea;
      current.tiles.push({ ...parsed, tileRect: rect });
      groups.set(parsed.zoom, current);
    }
    const bestGroup = Array.from(groups.entries()).sort((a, b) => b[1].score - a[1].score)[0];
    if (!bestGroup) return null;
    const [zoom, group] = bestGroup;
    const center = {
      x: containerRect.left + containerRect.width / 2,
      y: containerRect.top + containerRect.height / 2,
    };
    const tile = group.tiles.sort((a, b) => {
      const aDistance = Math.hypot(
        a.tileRect.left + a.tileRect.width / 2 - center.x,
        a.tileRect.top + a.tileRect.height / 2 - center.y,
      );
      const bDistance = Math.hypot(
        b.tileRect.left + b.tileRect.width / 2 - center.x,
        b.tileRect.top + b.tileRect.height / 2 - center.y,
      );
      return aDistance - bDistance;
    })[0];
    return { ...tile, zoom };
  }

  function parseLeafletTileCoordinates(source) {
    if (!source) return null;
    try {
      const url = new URL(source, location.href);
      const hasQueryCoordinates = ["x", "y", "z"].every((key) => url.searchParams.has(key));
      const queryX = Number(url.searchParams.get("x"));
      const queryY = Number(url.searchParams.get("y"));
      const queryZ = Number(url.searchParams.get("z"));
      if (hasQueryCoordinates && [queryX, queryY, queryZ].every(Number.isInteger)) {
        return { tileX: queryX, tileY: queryY, zoom: queryZ };
      }
      const providerX = source.match(/[?&]x=(-?\d+)/i);
      const providerY = source.match(/[?&]y=(-?\d+)/i);
      const providerZ = source.match(/[?&]z=(-?\d+)/i);
      if (providerX && providerY && providerZ) {
        return {
          tileX: Number(providerX[1]),
          tileY: Number(providerY[1]),
          zoom: Number(providerZ[1]),
        };
      }
      const match = url.pathname.match(/\/(\d+)\/(\d+)\/(\d+)(?:\.[a-z0-9]+)?(?:\/|$)/i);
      if (match) {
        return {
          zoom: Number(match[1]),
          tileX: Number(match[2]),
          tileY: Number(match[3]),
        };
      }
    } catch {
      // Invalid or provider-specific tile URLs are ignored.
    }
    return null;
  }

  function projectWebMercator(coords, zoom) {
    const worldSize = LEAFLET_TILE_SIZE * 2 ** zoom;
    const lat = clamp(coords.lat, -85.05112878, 85.05112878);
    const sin = Math.sin(lat * Math.PI / 180);
    return {
      x: (coords.lng + 180) / 360 * worldSize,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize,
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function cameraWaypoint(origin) {
    const seed = Math.abs(Math.sin(origin.lat * 12.9898 + origin.lng * 78.233));
    const distanceKm = 9 + seed * 8;
    const bearing = (seed * Math.PI * 2 + Math.PI / 5) % (Math.PI * 2);
    const earthKm = 6371;
    const angular = distanceKm / earthKm;
    const lat1 = origin.lat * Math.PI / 180;
    const lng1 = origin.lng * Math.PI / 180;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) +
        Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
      );
    return {
      lat: Math.max(-85, Math.min(85, lat2 * 180 / Math.PI)),
      lng: ((lng2 * 180 / Math.PI + 540) % 360) - 180,
      zoom: 7 + Math.floor(seed * 3),
    };
  }

  function googleMapCenter(map) {
    const center = map.getCenter?.();
    if (!center) return null;
    const lat = typeof center.lat === "function" ? center.lat() : center.lat;
    const lng = typeof center.lng === "function" ? center.lng() : center.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  function googleMapZoom(map) {
    const zoom = Number(map.getZoom?.());
    return Number.isFinite(zoom) ? zoom : null;
  }

  async function animateGoogleCamera(
    map,
    LatLng,
    from,
    to,
    fromZoom,
    toZoom,
    duration,
    frameMs,
    runId,
  ) {
    const steps = Math.max(7, Math.min(frameMs >= AUTOPLACE_LOW_POWER_FRAME_MS ? 11 : 16, Math.round(duration / frameMs)));
    let lastZoom = null;
    for (let step = 1; step <= steps; step += 1) {
      if (!isPlacementActive(runId)) return false;
      const progress = step / steps;
      const eased = easeInOut(progress);
      const point = interpolatePoint(from, to, eased);
      const zoom = fromZoom + (toZoom - fromZoom) * eased;
      const started = performance.now();
      const center = new LatLng(point.lat, point.lng);
      if (typeof map.moveCamera === "function") {
        map.moveCamera({ center, zoom });
      } else {
        const roundedZoom = Math.round(zoom);
        map.setCenter(center);
        if (roundedZoom !== lastZoom) {
          map.setZoom(roundedZoom);
          lastZoom = roundedZoom;
        }
      }
      const renderCost = performance.now() - started;
      await placementPause(Math.max(28, duration / steps - renderCost), runId);
    }
    return isPlacementActive(runId);
  }

  function createMotionProfile(speed) {
    const normalizedSpeed = Math.max(1, Math.min(10, Number(speed) || 5));
    const runVariance = randomBetween(0.88, 1.12);
    const baseMs = (620 + normalizedSpeed * 58) * runVariance;
    const lowPower = Number(navigator.hardwareConcurrency || 4) <= 4;
    return {
      panMs: Math.round(baseMs * randomBetween(0.95, 1.08)),
      transitionMs: Math.round(baseMs * randomBetween(1.02, 1.16)),
      zoomMs: Math.round(baseMs * randomBetween(0.82, 0.98)),
      frameMs: lowPower ? AUTOPLACE_LOW_POWER_FRAME_MS : AUTOPLACE_MIN_FRAME_MS,
    };
  }

  function runLeafletMotion(map, action, duration, runId) {
    return new Promise((resolve) => {
      if (!isPlacementActive(runId)) {
        resolve(false);
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        map.off?.("moveend", finish);
        resolve(isPlacementActive(runId));
      };
      map.once?.("moveend", finish);
      action();
      setTimeout(finish, duration + 260);
    });
  }

  function waitForGoogleIdle(map, fallbackMs, runId) {
    return new Promise((resolve) => {
      if (!isPlacementActive(runId)) {
        resolve(false);
        return;
      }
      let settled = false;
      let listener = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (listener) window.google.maps.event.removeListener(listener);
        resolve(isPlacementActive(runId));
      };
      listener = window.google.maps.event.addListenerOnce(map, "idle", finish);
      setTimeout(finish, fallbackMs);
    });
  }

  function placementPause(duration, runId) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(isPlacementActive(runId)), Math.max(0, duration));
    });
  }

  function isPlacementActive(runId) {
    return runId === placementRunId && Date.now() <= placementDeadline;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function scheduleAutoGuess(runId, enabled) {
    if (!enabled || runId !== placementRunId) return;
    const delayMs = Math.round(randomBetween(1000, 3000));
    setTimeout(() => {
      if (runId !== placementRunId) return;
      const button = findGuessSubmitButton();
      if (!button) return;
      button.click();
      window.postMessage(
        { source: MESSAGE_SOURCE, type: "auto-guess-completed", payload: {} },
        "*",
      );
    }, delayMs);
  }

  function findGuessSubmitButton() {
    const stableSelectors = [
      'button[data-qa="perform-guess"]',
      'button[data-testid="guess-button"]',
      'button[data-testid="submit-guess"]',
      'button#guess-button',
      "button.guessBtn",
      "#confirm-button",
    ];
    for (const selector of stableSelectors) {
      const match = Array.from(document.querySelectorAll(selector)).find(isUsableGuessControl);
      if (match) return match;
    }
    const labels = new Set([
      "guess",
      "submit guess",
      "make guess",
      "confirm guess",
      "confirm answer",
      "submit answer",
      "place guess",
      "finish guess",
      "gissa",
      "bekrafta svaret",
      "bekräfta svaret",
      "raten",
      "antwort bestätigen",
      "deviner",
      "confirmer la réponse",
      "adivinar",
      "confirmar respuesta",
      "confirmar resposta",
      "zgadnij",
      "potwierdź odpowiedź",
      "raad",
      "antwoord bevestigen",
      "угадать",
      "подтвердить ответ",
    ]);
    const labelMatches = (control) => {
      const label = String(control.textContent || "").trim().replace(/\s+/g, " ").toLowerCase();
      return labels.has(label) && isUsableGuessControl(control);
    };
    const classMatch = Array.from(
      document.querySelectorAll(
        'button.guess-button, button[class*="guessButton"], button[class*="guess-button"]',
      ),
    ).find(labelMatches);
    return classMatch ||
      Array.from(document.querySelectorAll('button, [role="button"]')).find(labelMatches) ||
      null;
  }

  function isUsableGuessControl(control) {
    if (!(control instanceof HTMLElement) || !control.isConnected) return false;
    if (control instanceof HTMLButtonElement && control.disabled) return false;
    if (control.getAttribute("aria-disabled") === "true") return false;
    if (/\b(?:disabled|unavailable|v-btn--disabled|mui-disabled)\b/i.test(control.className || "")) {
      return false;
    }
    const rect = control.getBoundingClientRect();
    const style = getComputedStyle(control);
    return rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.pointerEvents !== "none" &&
      Number(style.opacity || 1) !== 0;
  }

  function interpolatePoint(from, to, progress) {
    const lngDelta = ((((to.lng - from.lng) % 360) + 540) % 360) - 180;
    return {
      lat: from.lat + (to.lat - from.lat) * progress,
      lng: ((from.lng + lngDelta * progress + 540) % 360) - 180,
    };
  }

  function easeInOut(progress) {
    return progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  }

  function placementClickSequence(target, payloadSequence) {
    const normalized = normalizeClickSequence(payloadSequence);
    if (normalized.length) return normalized;
    const total = weightedPlacementClickCount();
    const sequence = [];
    for (let index = 1; index < total; index += 1) {
      sequence.push(randomNearbyPoint(target));
    }
    sequence.push(target);
    return sequence;
  }

  function weightedPlacementClickCount() {
    const roll = Math.random();
    if (roll < 0.2) return AUTOPLACE_CLICK_MIN;
    if (roll < 0.7) return 2;
    return AUTOPLACE_CLICK_MAX;
  }

  function normalizeClickSequence(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => normalizeCoordinates(item))
      .filter(Boolean)
      .slice(0, AUTOPLACE_CLICK_MAX);
  }

  function randomNearbyPoint(origin) {
    const distanceKm = 4 + Math.random() * 28;
    const bearing = Math.random() * Math.PI * 2;
    const earthKm = 6371;
    const angular = distanceKm / earthKm;
    const lat1 = origin.lat * Math.PI / 180;
    const lng1 = origin.lng * Math.PI / 180;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) +
        Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
      );
    return {
      lat: Math.max(-85, Math.min(85, lat2 * 180 / Math.PI)),
      lng: ((lng2 * 180 / Math.PI + 540) % 360) - 180,
    };
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data) return;
    if (data.source !== "GEOBOOST_EXTENSION") {
      if (data.source === MESSAGE_SOURCE) return;
      // GeoGuessr posts unrelated map/UI objects on window. Scanning those was
      // introduced with the multi-site adapters and can surface default map
      // coordinates instead of the active round.
      if (IS_GEOGUESSR) return;
      if (typeof data === "string") {
        tryParsePayload(data, "message");
      } else {
        const coords = scanPayloadForCoordinates(data);
        if (coords) broadcastCoordinates(coords, "message");
      }
      return;
    }
    if (data.type === "request-coordinates" && lastCoordinates) {
      window.postMessage(
        { source: MESSAGE_SOURCE, type: "coordinates", payload: lastCoordinates },
        "*",
      );
    }
    if (data.type === "place-guess") {
      handlePlacement(data.payload || {});
    }
  });

  if (globalThis.__geoboostTestMode === true) {
    globalThis.__geoboostProbeTest = Object.freeze({
      hookLeafletNamespace,
      normalizeCoordinates,
      parseLeafletTileCoordinates,
      parseGoogleDomTileCoordinates,
      projectWebMercator,
      findGuessSubmitButton,
      scanForCoordinates,
      scanGeoGuessrCoordinates,
    });
  }

  hookNetwork();
  hookWebSocket();
  hookLeaflet();
  setInterval(pollStreetViewPosition, 1400);
  setInterval(pollIframeUrls, 1200);
  setInterval(pollFrameworkCoordinates, 1600);
  setTimeout(pollStreetViewPosition, 300);
  setTimeout(pollIframeUrls, 500);
  setTimeout(pollFrameworkCoordinates, 700);
})();
