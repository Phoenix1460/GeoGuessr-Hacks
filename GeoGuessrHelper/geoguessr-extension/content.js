(() => {
  const DEFAULT_HOTKEY = { code: "KeyP", label: "P" };
  const PAGE_SOURCE = "GEOBOOST_PAGE";
  const EXTENSION_SOURCE = "GEOBOOST_EXTENSION";
  const COORDINATE_TTL_MS = 2 * 60 * 1000;
  const ROUND_SYNC_WAIT_MS = 4500;
  const IS_GEOGUESSR = /(^|\.)geoguessr\.com$/i.test(location.hostname);
  let hotkey = DEFAULT_HOTKEY;
  let lastCoordinates = null;
  let lastServedCoordinateKey = "";
  let pendingCoordinateResolvers = [];

  installPageProbe();
  installHotkey();
  installCoordinateBridge();
  installRuntimeBridge();

  function installPageProbe() {
    if (globalThis.__geoboostProbeInjected) return;
    globalThis.__geoboostProbeInjected = true;
    const inject = () => {
      if (document.documentElement?.dataset.geoboostProbeInjected === "true") return;
      if (document.documentElement) {
        document.documentElement.dataset.geoboostProbeInjected = "true";
      }
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("page-probe.js");
      script.async = false;
      script.onload = () => script.remove();
      (document.documentElement || document.head || document.body)?.appendChild(script);
    };
    if (document.documentElement || document.head || document.body) {
      inject();
    } else {
      document.addEventListener("DOMContentLoaded", inject, { once: true });
    }
  }

  function installHotkey() {
    if (globalThis.__geoHelperHotkeyInstalled) return;
    globalThis.__geoHelperHotkeyInstalled = true;

    chrome.storage.local.get("analysisHotkey").then((stored) => {
      hotkey = stored.analysisHotkey || DEFAULT_HOTKEY;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.analysisHotkey) {
        hotkey = changes.analysisHotkey.newValue || DEFAULT_HOTKEY;
      }
    });

    window.addEventListener(
      "keydown",
      (event) => {
        if (
          event.repeat ||
          event.ctrlKey ||
          event.altKey ||
          event.metaKey ||
          event.shiftKey ||
          event.code !== hotkey.code ||
          isTypingTarget(event.target)
        ) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        chrome.runtime.sendMessage({ type: "hotkey-analysis" });
      },
      { capture: true },
    );
  }

  function installCoordinateBridge() {
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== PAGE_SOURCE) return;
      if (data.type === "auto-guess-completed") {
        const gameHost = String(location.hostname || "").toLowerCase();
        const game = ["geoguessr", "openguessr", "geotastic", "worldguessr", "freeguessr"]
          .find((candidate) => gameHost.includes(candidate)) || "unknown";
        chrome.runtime.sendMessage({
          type: "track-event",
          event_type: "auto_guess_completed",
          event_properties: {
            game,
            game_host: gameHost,
          },
        });
        return;
      }
      if (data.type !== "coordinates") return;
      const coordinates = normalizeCoordinates(data.payload);
      if (!coordinates) return;
      lastCoordinates = {
        ...coordinates,
        source: data.payload.source || "page",
        timestamp: Number(data.payload.timestamp) || Date.now(),
      };
      chrome.runtime.sendMessage({
        type: "coordinates-extracted",
        coordinates: lastCoordinates,
      });
      resolvePending(lastCoordinates);
    });
  }

  function installRuntimeBridge() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "get-coordinates") {
        getRecentCoordinates()
          .then((coordinates) => sendResponse({ ok: Boolean(coordinates), coordinates }))
          .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
        return true;
      }

      if (message.type === "place-guess") {
        if (window !== window.top) {
          sendResponse({ ok: false, ignored: "non-top-frame" });
          return false;
        }
        window.postMessage(
          {
            source: EXTENSION_SOURCE,
            type: "place-guess",
            payload: message.payload,
          },
          "*",
        );
        sendResponse({ ok: true });
        return false;
      }
    });
  }

  async function getRecentCoordinates() {
    // A repeated request can be an intentional retry in the same GeoGuessr
    // round. 1.0.5 treated it as a new round and rejected the valid coordinate.
    // GeoGuessr already publishes the next round through its network response,
    // so retain the proven pre-1.0.5 behavior on this host.
    if (IS_GEOGUESSR && isFresh(lastCoordinates)) return lastCoordinates;

    const initialCoordinates = isFresh(lastCoordinates) ? lastCoordinates : null;
    const initialKey = coordinateKey(initialCoordinates);
    if (initialCoordinates && initialKey !== lastServedCoordinateKey) {
      lastServedCoordinateKey = initialKey;
      return initialCoordinates;
    }

    window.postMessage({ source: EXTENSION_SOURCE, type: "request-coordinates" }, "*");
    return new Promise((resolve) => {
      let settled = false;
      const finish = (coordinates) => {
        if (settled) return true;
        settled = true;
        clearTimeout(timer);
        pendingCoordinateResolvers = pendingCoordinateResolvers.filter((item) => item !== done);
        if (coordinates) lastServedCoordinateKey = coordinateKey(coordinates);
        resolve(coordinates);
        return true;
      };
      const timer = setTimeout(() => {
        // A coordinate that was already served belongs to the previous round.
        // Returning it here recreates the stale-round bug this wait prevents.
        finish(initialCoordinates ? null : isFresh(lastCoordinates) ? lastCoordinates : null);
      }, initialCoordinates ? ROUND_SYNC_WAIT_MS : 1100);
      const done = (coordinates) => {
        if (!isFresh(coordinates)) return false;
        if (initialCoordinates && coordinateKey(coordinates) === initialKey) return false;
        return finish(coordinates);
      };
      pendingCoordinateResolvers.push(done);
    });
  }

  function resolvePending(coordinates) {
    const resolvers = pendingCoordinateResolvers;
    pendingCoordinateResolvers = resolvers.filter((resolve) => !resolve(coordinates));
  }

  function coordinateKey(coordinates) {
    if (!coordinates) return "";
    return `${Number(coordinates.lat).toFixed(7)},${Number(coordinates.lng).toFixed(7)}`;
  }

  function isFresh(coordinates) {
    return Boolean(
      coordinates &&
        Number.isFinite(coordinates.lat) &&
        Number.isFinite(coordinates.lng) &&
        Date.now() - Number(coordinates.timestamp || 0) < COORDINATE_TTL_MS,
    );
  }

  function normalizeCoordinates(value) {
    if (!value || typeof value !== "object") return null;
    const lat = Number(value.lat ?? value.latitude);
    const lng = Number(value.lng ?? value.lon ?? value.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }

  function isTypingTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "input, textarea, select, [contenteditable='true'], [role='textbox']",
      ),
    );
  }
})();
