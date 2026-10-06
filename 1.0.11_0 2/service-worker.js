import {
  coordinateKey,
  getServedCoordinateKey,
  isNewCoordinate,
  markServedCoordinate,
  servedCoordinateStorageKey,
} from "./round-coordinate-history.js";

let analysisInProgress = false;
let configPromise = null;
let analyticsFlushTimer = null;
let analyticsFlushTimerDueAt = 0;
let analyticsFlushPromise = null;
let analyticsFlushController = null;
let analyticsQueueMutation = Promise.resolve();
let analyticsNetworkQuietUntil = 0;
let pendingAnalyticsEvents = [];
let uninstallRegistrationRunId = 0;
const landCheckCache = new Map();

const FREE_STARTER_GUESS_LIMIT = 5;
const FREE_DAILY_GUESS_LIMIT = 1;
const PAYWALL_EXPERIMENT_ID = "one_time_passes_v1";
const PAYWALL_VARIANTS = new Set(["A", "B"]);
const ADMIN_PROMO_CODE = "ADMIN_TEST_UNLIMITED";
const ANALYTICS_QUEUE_LIMIT = 200;
const ANALYTICS_BATCH_SIZE = 20;
const ANALYTICS_BATCH_TRIGGER = 10;
const ANALYTICS_MAX_EVENTS_PER_HOUR = 200;
const ANALYTICS_FLUSH_DELAY_MS = 1800;
const ANALYTICS_FLUSH_TIMEOUT_MS = 7000;
const UNINSTALL_REGISTRATION_TIMEOUT_MS = 7000;
const ANALYTICS_FLUSH_ALARM = "geoboost-analytics-flush";
const ANALYTICS_RETRY_DELAYS_MS = [30000, 60000, 120000, 300000];
const PLACEMENT_CLICK_MIN = 1;
const PLACEMENT_CLICK_MAX = 3;
const LAND_CHECK_ATTEMPTS = 5;
const ROUND_COORDINATE_SYNC_WAIT_MS = 5500;
const ROUND_COORDINATE_RETRY_DELAY_MS = 150;
const WATER_TERMS = [
  "bay",
  "canal",
  "channel",
  "fjord",
  "gulf",
  "lake",
  "lagoon",
  "ocean",
  "reservoir",
  "river",
  "sea",
  "sound",
  "strait",
  "water",
];
const ANALYTICS_EVENT_TYPES = new Set([
  "extension_installed",
  "extension_updated",
  "sidepanel_opened",
  "onboarding_completed",
  "setting_changed",
  "supported_round_detected",
  "guess_requested",
  "guess_completed",
  "guess_failed",
  "auto_place_completed",
  "auto_guess_completed",
  "map_preview_opened",
  "free_guess_used",
  "free_limit_reached",
  "paywall_viewed",
  "plan_selected",
  "checkout_started",
  "checkout_failed",
  "crypto_payment_opened",
  "crypto_payment_requested",
  "crypto_payment_failed",
  "crypto_support_email_opened",
  "restore_started",
  "restore_code_sent",
  "restore_completed",
  "restore_failed",
  "portal_opened",
  "portal_failed",
  "referral_code_created",
  "referral_email_code_sent",
  "referral_email_verified",
  "referral_applied",
  "referral_reward_unlocked",
  "affiliate_enrolled",
  "affiliate_code_copied",
  "affiliate_share_created",
  "affiliate_share_failed",
  "affiliate_payout_requested",
  "affiliate_payout_request_failed",
  "referral_code_submitted",
  "referral_code_applied",
  "share_guess_copied",
  "share_guess_failed",
]);
const DEFAULT_SETTINGS = {
  autoPlace: true,
  autoGuess: false,
  smartZoom: true,
  rangeEnabled: false,
  scoreMin: 3750,
  scoreMax: 4900,
  smartZoomSpeed: 5,
};

chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await initializeDefaults();
  await registerExternalLifecyclePages();
  void recoverAnalyticsDelivery();
  if (details.reason === "install") {
    trackEvent("extension_installed", {
      version: chrome.runtime.getManifest().version,
    });
    await chrome.tabs.create({ url: await buildWebsiteUrl("/welcome") });
  } else if (details.reason === "update") {
    trackEvent("extension_updated", {
      version: chrome.runtime.getManifest().version,
      previous_version: details.previousVersion || "",
    });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await initializeDefaults();
  await registerExternalLifecyclePages();
  void recoverAnalyticsDelivery();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ANALYTICS_FLUSH_ALARM) return;
  void resumeAnalyticsDelivery();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove(servedCoordinateStorageKey(tabId));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "trigger-analysis") {
    runAnalysis()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "ensure-hotkey") {
    ensureHotkeyOnActiveTab()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "hotkey-analysis") {
    runAnalysis(sender.tab).catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "coordinates-extracted") {
    persistCoordinates(message.coordinates);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "usage") {
    getUsage()
      .then((usage) => sendResponse({ ok: true, usage }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "paywall-experiment") {
    getPaywallExperimentAssignment()
      .then((assignment) => sendResponse({ ok: true, ...assignment }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "redeem-promo") {
    redeemPromo(message.code)
      .then((usage) => sendResponse({ ok: true, usage }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "start-checkout") {
    startCheckout(message.email, message.plan, message.source)
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "submit-crypto-payment-request") {
    submitCryptoPaymentRequest(message.email, message.plan, message.country, message.company)
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "crypto-payment-request-status") {
    getCryptoPaymentRequestStatus()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "refresh-billing-status") {
    refreshBillingStatus()
      .then(() => getUsage())
      .then((usage) => sendResponse({ ok: true, usage }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "request-restore-code") {
    requestRestoreCode(message.email)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "confirm-restore-code") {
    confirmRestoreCode(message.email, message.code)
      .then((usage) => sendResponse({ ok: true, usage }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "manage-subscription") {
    manageSubscription()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "referral-status") {
    referralStatus()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "request-referral-email-code") {
    requestReferralEmailCode(message.email)
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "confirm-referral-email-code") {
    confirmReferralEmailCode(message.email, message.code)
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "apply-referral-code") {
    applyReferralCode(message.code)
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "affiliate-status") {
    affiliateStatus()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "affiliate-enroll") {
    affiliateEnroll(message.email, message.code)
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "affiliate-payout-request") {
    affiliatePayoutRequest(message.asset, message.network, message.wallet_address)
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "affiliate-payout-list") {
    affiliatePayoutList()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "track-event") {
    trackEvent(message.event_type, message.event_properties, message.options);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "set-analytics-opt-out") {
    setAnalyticsOptOut(Boolean(message.enabled))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }

  if (message.type === "analytics-settings") {
    getAnalyticsSettings()
      .then((settings) => sendResponse({ ok: true, ...settings }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }
});

void recoverAnalyticsDelivery();

async function initializeDefaults() {
  const stored = await chrome.storage.local.get([
    ...Object.keys(DEFAULT_SETTINGS),
    "paywallExperimentId",
    "paywallVariant",
  ]);
  const update = {};
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (stored[key] === undefined) update[key] = value;
  }
  if (stored.scoreMin === 4900 && stored.scoreMax === 5000) {
    update.scoreMin = DEFAULT_SETTINGS.scoreMin;
    update.scoreMax = DEFAULT_SETTINGS.scoreMax;
  }
  if (
    stored.paywallExperimentId !== PAYWALL_EXPERIMENT_ID ||
    !PAYWALL_VARIANTS.has(stored.paywallVariant)
  ) {
    const bucket = new Uint8Array(1);
    crypto.getRandomValues(bucket);
    update.paywallExperimentId = PAYWALL_EXPERIMENT_ID;
    update.paywallVariant = bucket[0] < 128 ? "A" : "B";
    update.paywallAssignedAt = Date.now();
  }
  if (Object.keys(update).length) await chrome.storage.local.set(update);
}

async function getPaywallExperimentAssignment() {
  await initializeDefaults();
  const stored = await chrome.storage.local.get([
    "paywallExperimentId",
    "paywallVariant",
    "paywallAssignedAt",
  ]);
  return {
    experiment: stored.paywallExperimentId || PAYWALL_EXPERIMENT_ID,
    variant: PAYWALL_VARIANTS.has(stored.paywallVariant) ? stored.paywallVariant : "A",
    assigned_at: Number(stored.paywallAssignedAt || Date.now()),
  };
}

async function runAnalysis(providedTab = null) {
  if (analysisInProgress) {
    const message = "Analysis is already running.";
    broadcast({ type: "analysis-error", error: message });
    throw new Error(message);
  }

  analysisInProgress = true;
  analyticsNetworkQuietUntil = Date.now() + 30000;
  try {
    broadcast({ type: "analysis-started" });
    const usagePromise = getUsage();
    const tab = await getActiveTab(providedTab);
    const coordinatesPromise = getCoordinatesFromTab(tab);
    const [usage, coordinates] = await Promise.all([usagePromise, coordinatesPromise]);
    if (!usage.canGuess) {
      const message = "Free guesses used for today. Upgrade to Pro for unlimited guesses.";
      trackEvent("free_limit_reached", usageProperties(usage));
      broadcast({ type: "usage-limit", usage, error: message });
      throw new Error(message);
    }
    trackEvent("guess_requested", usageProperties(usage));
    const rawSettings = await getSettings();
    const settings = effectiveSettingsForUsage(rawSettings, usage);
    if (isSupportedGameUrl(tab.url)) {
      trackEvent("supported_round_detected", gameProperties(tab.url));
    }

    if (!coordinates) {
      throw new Error("Coordinates were not found. Reload the game page and try again.");
    }

    const usageCompletion = completeUsage(usage);
    let result = await createCoordinateResult(coordinates);
    result = await addPlacementMetadata(result, settings);
    await chrome.storage.session.set({
      lastAnalysis: { result, createdAt: Date.now() },
    });

    const nextUsage = await usageCompletion;
    broadcast({ type: "usage", usage: nextUsage });
    broadcast({ type: "analysis-result", result });
    trackEvent("guess_completed", {
      ...usageProperties(nextUsage),
      ...featureProperties(settings),
      country_code: String(result.country_code || "").toUpperCase(),
      coordinate_source: result.meta?.source || "page",
    });
    if (!nextUsage.subscribed) {
      trackEvent("free_guess_used", usageProperties(nextUsage));
    }

    if (settings.autoPlace) {
      await placeGuess(tab.id, result, settings);
      trackEvent("auto_place_completed", {
        smart_zoom: settings.smartZoom !== false,
        range_enabled: settings.rangeEnabled !== false,
        free_mode: usage.freeMode || "",
      });
    }
  } catch (error) {
    const readable = readableError(error);
    broadcast({ type: "analysis-error", error: readable });
    trackEvent("guess_failed", { error_code: analyticsErrorCode(readable) });
    throw new Error(readable);
  } finally {
    analysisInProgress = false;
    analyticsNetworkQuietUntil = Date.now() + 10000;
    flushPendingAnalyticsEvents();
  }
}

async function getActiveTab(providedTab = null) {
  const [activeTab] = providedTab?.id
    ? [providedTab]
    : await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) throw new Error("Active tab was not found.");
  return activeTab;
}

async function getCoordinatesFromTab(tab) {
  if (!tab?.id || !isSupportedGameUrl(tab.url)) return null;
  await ensureHotkeyOnTab(tab).catch(() => {});
  const messageOptions = isGeoGuessrUrl(tab.url) ? { frameId: 0 } : undefined;

  if (isGeoGuessrUrl(tab.url)) {
    const deadline = Date.now() + 1200;
    do {
      const response = await chrome.tabs
        .sendMessage(tab.id, { type: "get-coordinates" }, messageOptions)
        .catch(() => null);
      if (response?.ok && isValidCoordinates(response.coordinates)) {
        await persistCoordinates(response.coordinates);
        return response.coordinates;
      }
      if (Date.now() >= deadline) break;
      await wait(ROUND_COORDINATE_RETRY_DELAY_MS);
    } while (Date.now() < deadline);
    return null;
  }

  const previousCoordinateKey = await getServedCoordinateKey(chrome.storage.session, tab);
  const deadline = Date.now() + ROUND_COORDINATE_SYNC_WAIT_MS;

  do {
    const response = await chrome.tabs
      .sendMessage(tab.id, { type: "get-coordinates" }, messageOptions)
      .catch(() => null);
    if (response?.ok && isValidCoordinates(response.coordinates)) {
      const nextCoordinateKey = coordinateKey(response.coordinates);
      if (isNewCoordinate(previousCoordinateKey, response.coordinates)) {
        await Promise.all([
          persistCoordinates(response.coordinates),
          markServedCoordinate(chrome.storage.session, tab, nextCoordinateKey),
        ]);
        return response.coordinates;
      }
    }
    if (Date.now() >= deadline) break;
    await wait(ROUND_COORDINATE_RETRY_DELAY_MS);
  } while (Date.now() < deadline);

  return null;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isGeoGuessrUrl(url) {
  try {
    return /(^|\.)geoguessr\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function persistCoordinates(coordinates) {
  if (!isValidCoordinates(coordinates)) return;
  await chrome.storage.session.set({
    lastCoordinates: {
      lat: Number(coordinates.lat),
      lng: Number(coordinates.lng),
      source: coordinates.source || "page",
      timestamp: Number(coordinates.timestamp) || Date.now(),
    },
  });
}

async function createCoordinateResult(coordinates) {
  const stored = await chrome.storage.local.get("uiLanguage");
  const language = stored.uiLanguage || "en";
  const text = coordinateResultText(language);
  const lat = Number(coordinates.lat);
  const lng = Number(coordinates.lng);
  const place = await reverseGeocode(lat, lng, language).catch(() => null);
  const placeName = place ? formatPlaceName(place.address, place.display_name) : "";
  const countryCode = normalizeCountryCode(place?.address?.country_code || "XX", place?.address || {});
  const localClues = getLocalClues(countryCode, place?.address, language, { latitude: lat, longitude: lng });
  return {
    best_guess: placeName || text.bestGuess,
    country_code: countryCode,
    confidence: 100,
    summary: "",
    evidence: [],
    local_clues: localClues,
    alternatives: [],
    next_focus: [],
    latitude: lat,
    longitude: lng,
    map_span_degrees: 2,
    meta: {
      cache_hit: false,
      mode: "coordinates",
      source: coordinates.source || "page",
      reverse_geocoded: Boolean(placeName),
      language,
      latency_ms: 0,
    },
  };
}

function coordinateResultText(language) {
  const values = {
    ru: {
      bestGuess: "Точка на карте",
      summary: "",
      evidence: "",
    },
    fr: {
      bestGuess: "Coordonnées exactes",
      summary: "",
      evidence: "",
    },
    de: {
      bestGuess: "Exakte Koordinaten",
      summary: "",
      evidence: "",
    },
    pl: {
      bestGuess: "Dokładne współrzędne",
      summary: "",
      evidence: "",
    },
    es: {
      bestGuess: "Coordenadas exactas",
      summary: "",
      evidence: "",
    },
    pt: {
      bestGuess: "Coordenadas exatas",
      summary: "",
      evidence: "",
    },
    nl: {
      bestGuess: "Exacte coördinaten",
      summary: "",
      evidence: "",
    },
    sv: {
      bestGuess: "Exakta koordinater",
      summary: "",
      evidence: "",
    },
  };
  return (
    values[language] || {
      bestGuess: "Map point",
      summary: "",
      evidence: "",
    }
  );
}

async function reverseGeocode(lat, lng, language, zoom = "14") {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
    addressdetails: "1",
    zoom: String(zoom),
    "accept-language": localeForReverseGeocode(language),
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  if (!body || body.error) return null;
  return body;
}

function localeForReverseGeocode(language) {
  return {
    en: "en",
    fr: "fr",
    de: "de",
    ru: "ru",
    pl: "pl",
    es: "es",
    pt: "pt",
    nl: "nl",
    sv: "sv",
  }[language] || "en";
}

function formatPlaceName(address = {}, displayName = "") {
  const parts = [
    address.road,
    address.village || address.town || address.city || address.hamlet || address.municipality,
    address.county || address.province || address.state,
    address.country,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const unique = [];
  for (const part of parts) {
    if (!unique.some((item) => item.toLowerCase() === part.toLowerCase())) {
      unique.push(part);
    }
  }
  if (unique.length) return unique.slice(0, 4).join(", ");
  return String(displayName || "").split(",").slice(0, 4).map((item) => item.trim()).filter(Boolean).join(", ");
}

const COUNTRY_CODE_ALIASES = {
  EL: "GR",
  UK: "GB",
};

const COUNTRY_NAME_TO_CODE = {
  "united states": "US",
  usa: "US",
  "united kingdom": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  ireland: "IE",
  france: "FR",
  germany: "DE",
  spain: "ES",
  portugal: "PT",
  italy: "IT",
  netherlands: "NL",
  belgium: "BE",
  switzerland: "CH",
  austria: "AT",
  poland: "PL",
  czechia: "CZ",
  "czech republic": "CZ",
  slovakia: "SK",
  hungary: "HU",
  romania: "RO",
  bulgaria: "BG",
  croatia: "HR",
  slovenia: "SI",
  serbia: "RS",
  greece: "GR",
  turkey: "TR",
  russia: "RU",
  ukraine: "UA",
  sweden: "SE",
  norway: "NO",
  finland: "FI",
  denmark: "DK",
  iceland: "IS",
  estonia: "EE",
  latvia: "LV",
  lithuania: "LT",
  canada: "CA",
  mexico: "MX",
  brazil: "BR",
  argentina: "AR",
  chile: "CL",
  peru: "PE",
  bolivia: "BO",
  colombia: "CO",
  ecuador: "EC",
  uruguay: "UY",
  paraguay: "PY",
  "costa rica": "CR",
  guatemala: "GT",
  "dominican republic": "DO",
  "puerto rico": "PR",
  australia: "AU",
  "new zealand": "NZ",
  japan: "JP",
  "south korea": "KR",
  korea: "KR",
  taiwan: "TW",
  thailand: "TH",
  malaysia: "MY",
  indonesia: "ID",
  singapore: "SG",
  philippines: "PH",
  india: "IN",
  bangladesh: "BD",
  "south africa": "ZA",
  kenya: "KE",
  ghana: "GH",
  nigeria: "NG",
  uganda: "UG",
  rwanda: "RW",
  botswana: "BW",
  lesotho: "LS",
  eswatini: "SZ",
  morocco: "MA",
  tunisia: "TN",
  israel: "IL",
  jordan: "JO",
  "united arab emirates": "AE",
  uae: "AE",
};

function normalizeCountryCode(countryCode, address = {}, result = {}) {
  const raw = String(countryCode || address.country_code || "").trim().toUpperCase();
  const direct = COUNTRY_CODE_ALIASES[raw] || raw;
  if (/^[A-Z]{2}$/.test(direct) && direct !== "XX") return direct;
  const haystack = [
    address.country,
    address.display_name,
    result.best_guess,
    result.summary,
  ]
    .map((item) => String(item || "").toLowerCase())
    .join(" ");
  for (const [name, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (haystack.includes(name)) return code;
  }
  return /^[A-Z]{2}$/.test(direct) ? direct : "XX";
}

function getCoordinateClues(latitude, longitude, language = "en") {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const clues = [];
  const absLat = Math.abs(lat);
  if (absLat >= 55) {
    clues.push(
      language === "ru"
        ? "Высокая широта: ищите хвойные леса, низкое солнце, прохладный климат и длинные тени."
        : "High latitude: expect conifer forests, lower sun, cooler climate, and longer shadows.",
    );
  } else if (absLat <= 23.5) {
    clues.push(
      language === "ru"
        ? "Тропическая широта: проверяйте влажность, яркую растительность, тип крыш и дорожное покрытие."
        : "Tropical latitude: check humidity, lush vegetation, roof styles, and road-surface quality.",
    );
  } else if (absLat >= 35) {
    clues.push(
      language === "ru"
        ? "Умеренная широта: сравнивайте деревья, сельскую архитектуру, разметку и форму дорожных знаков."
        : "Temperate latitude: compare trees, rural architecture, lane markings, and road-sign shapes.",
    );
  }
  if (lat < -5) {
    clues.push(
      language === "ru"
        ? "Южное полушарие: солнце чаще находится севернее, а сезоны противоположны Европе и США."
        : "Southern Hemisphere: the sun is often to the north, and seasons are opposite Europe and the US.",
    );
  }
  if (Math.abs(lng) > 120) {
    clues.push(
      language === "ru"
        ? "Долгота указывает на Азию или Океанию: проверьте сторону движения, письменность и дорожные столбы."
        : "Far-east longitude: verify driving side, scripts, utility poles, and road furniture.",
    );
  }
  return clues;
}

function getLocalClues(countryCode, address = {}, language = "en", result = {}) {
  const normalizedCode = normalizeCountryCode(countryCode, address, result);
  const tips = LOCAL_CLUES[normalizedCode]?.[language] || LOCAL_CLUES[normalizedCode]?.en || [];
  const region = String(address.state || address.province || address.county || "").toLowerCase();
  const country = String(address.country || normalizedCode || "").trim();
  const regional = [];
  if (normalizedCode === "BO" && /oruro|potos|la paz/.test(region)) {
    regional.push(
      language === "ru"
        ? "Высокогорный Альтиплано: сухой ландшафт, редкая растительность и длинные прямые дороги."
        : "Altiplano setting: dry highland terrain, sparse vegetation, and long straight roads are common.",
    );
  }
  if (normalizedCode === "US" && /hawaii|honolulu|maui|kauai/.test(region)) {
    regional.push(
      language === "ru"
        ? "Гавайи: тропическая растительность, вулканический рельеф, американские знаки и океанические дороги."
        : "Hawaii clue: tropical vegetation, volcanic terrain, US signage, and ocean roads often appear together.",
    );
  }
  if (normalizedCode === "CA" && /quebec|montréal|montreal/.test(region)) {
    regional.push(
      language === "ru"
        ? "Квебек: французские вывески вместе с североамериканской дорожной инфраструктурой."
        : "Quebec clue: French signs paired with North American road design.",
    );
  }
  const coordinateClues = getCoordinateClues(result.latitude, result.longitude, language);
  const fallback = country
    ? [
        language === "ru"
          ? `Проверяйте дорожные знаки, разметку, архитектуру и растительность, чтобы подтвердить ${country}.`
          : `Check road signs, lane markings, architecture, and vegetation to confirm ${country}.`,
      ]
    : [];
  const seen = new Set();
  return [...regional, ...tips, ...coordinateClues, ...fallback]
    .filter((item) => {
      const key = String(item || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

const LOCAL_CLUES = {
  BO: {
    en: [
      "Bolivia often has Spanish signage, dry Andean landscapes, and unfinished brick/adobe buildings.",
      "Highland areas around Oruro and Potosí commonly look arid, open, and mountainous.",
    ],
    ru: [
      "Для Боливии типичны испанские вывески, сухие андские пейзажи и кирпичные/саманные постройки без отделки.",
      "Районы Оруро и Потоси часто выглядят сухими, открытыми и высокогорными.",
    ],
  },
  PE: {
    en: ["Peru often shows dry coastal/desert terrain, Andean mountains, Spanish signs, and many brick buildings."],
    ru: ["В Перу часто встречаются сухие пустынные или андские пейзажи, испанские надписи и много кирпичных зданий."],
  },
  CL: {
    en: ["Chile is recognizable by long north-south geography: desert north, Mediterranean center, and cooler southern landscapes."],
    ru: ["Чили тянется с севера на юг: пустынный север, более средиземноморский центр и прохладный юг."],
  },
  AR: {
    en: ["Argentina often has wide roads, Spanish signs, flat pampas in many areas, and varied climates by latitude."],
    ru: ["В Аргентине часто широкие дороги, испанские знаки, равнинные пампасы и сильная смена климата по широте."],
  },
  BR: {
    en: ["Brazil uses Portuguese; look for red soil, tropical vegetation, and distinct Brazilian road signage."],
    ru: ["В Бразилии португальский язык; часто помогают красная почва, тропическая растительность и местные дорожные знаки."],
  },
  MX: {
    en: ["Mexico commonly has Spanish signs, concrete utility poles, dry highlands in the north/center, and colorful buildings."],
    ru: ["Для Мексики типичны испанские знаки, бетонные столбы, сухие плато на севере/в центре и яркие здания."],
  },
  CO: {
    en: [
      "Colombia usually has Spanish signs, tropical-to-Andean terrain, yellow license plates, and dense mountain roads.",
      "Look for green hills, concrete houses, and road signs with Colombian department or municipality names.",
    ],
    ru: [
      "В Колумбии испанские знаки, тропики и Анды, жёлтые номера и плотные горные дороги.",
      "Помогают зелёные холмы, бетонные дома и знаки с названиями департаментов или муниципалитетов.",
    ],
  },
  EC: {
    en: [
      "Ecuador mixes Andean highlands, lush tropical areas, Spanish signs, and frequent mountainous roads.",
      "Yellow license plates and compact towns with painted concrete buildings are useful clues.",
    ],
    ru: [
      "В Эквадоре смешиваются Анды, влажные тропики, испанские вывески и горные дороги.",
      "Полезны жёлтые номера и компактные города с окрашенными бетонными зданиями.",
    ],
  },
  UY: {
    en: [
      "Uruguay often feels flatter and calmer than Argentina, with Spanish signs, green fields, and low-density towns.",
      "Look for white lane markings, modest roads, and pampas-like countryside near small settlements.",
    ],
    ru: [
      "Уругвай часто более ровный и спокойный, чем Аргентина: испанские знаки, зелёные поля и небольшие города.",
      "Помогают белая разметка, скромные дороги и сельский пейзаж пампасного типа.",
    ],
  },
  PY: {
    en: [
      "Paraguay often has red dirt roads, subtropical vegetation, Spanish/Guarani context, and simple rural infrastructure.",
      "Look for flat warm landscapes, brick buildings, and less polished roads than nearby Argentina or Uruguay.",
    ],
    ru: [
      "В Парагвае часто красная грунтовка, субтропическая растительность, испанско-гуаранийский контекст и простая инфраструктура.",
      "Ищите ровные тёплые ландшафты, кирпичные здания и менее аккуратные дороги, чем в Аргентине или Уругвае.",
    ],
  },
  CR: {
    en: [
      "Costa Rica is tropical and green, with Spanish signs, hilly roads, and frequent lush roadside vegetation.",
      "Look for narrow paved roads, drainage ditches, and Central American town layouts.",
    ],
    ru: [
      "Коста-Рика обычно зелёная и тропическая: испанские знаки, холмистые дороги и густая растительность.",
      "Помогают узкие асфальтовые дороги, дренажные канавы и планировка городков Центральной Америки.",
    ],
  },
  GT: {
    en: [
      "Guatemala often shows Spanish signs, volcanic highlands, colorful buildings, and dense towns.",
      "Mountain roads, painted buses, and Mayan place-name patterns can be useful confirmation clues.",
    ],
    ru: [
      "В Гватемале часто испанские знаки, вулканические горы, яркие здания и плотная городская застройка.",
      "Горные дороги, яркие автобусы и майянские топонимы помогают подтвердить страну.",
    ],
  },
  DO: {
    en: [
      "Dominican Republic has Caribbean vegetation, Spanish signs, concrete houses, and many motorcycles.",
      "Look for tropical roads, bright buildings, and island infrastructure rather than continental Latin America.",
    ],
    ru: [
      "В Доминикане карибская растительность, испанские знаки, бетонные дома и много мотоциклов.",
      "Помогают тропические дороги, яркие здания и островная инфраструктура.",
    ],
  },
  PR: {
    en: [
      "Puerto Rico mixes US road design with Spanish signs, tropical vegetation, and Caribbean architecture.",
      "Look for US-style route shields, mile markers, and Spanish place names together.",
    ],
    ru: [
      "Пуэрто-Рико сочетает американскую дорожную систему, испанские знаки, тропики и карибскую архитектуру.",
      "Полезны US-style щиты дорог, mile markers и испанские топонимы вместе.",
    ],
  },
  US: {
    en: ["United States clues include wide lane markings, frequent road shields, wooden utility poles, and state-specific signs."],
    ru: ["В США помогают широкая разметка, дорожные щиты, деревянные столбы и знаки, отличающиеся по штатам."],
  },
  CA: {
    en: ["Canada often has wide roads, bilingual signs in some regions, conifer forests, and province-specific road shields."],
    ru: ["В Канаде часто широкие дороги, местами двуязычные знаки, хвойные леса и дорожные щиты провинций."],
  },
  IS: {
    en: [
      "Iceland often has treeless volcanic landscapes, black lava fields, mountains, and sparse roads.",
      "Look for yellow bollards, low vegetation, and Nordic signs in very open terrain.",
    ],
    ru: [
      "В Исландии часто безлесные вулканические пейзажи, чёрные лавовые поля, горы и редкие дороги.",
      "Помогают жёлтые столбики, низкая растительность и северные знаки на открытом ландшафте.",
    ],
  },
  DK: {
    en: [
      "Denmark is usually flat, tidy, and agricultural, with Danish road signs and many cycle lanes.",
      "Look for red-brick houses, coastal villages, wind turbines, and clean road markings.",
    ],
    ru: [
      "Дания обычно ровная, аккуратная и сельскохозяйственная, с датскими знаками и велодорожками.",
      "Помогают краснокирпичные дома, прибрежные деревни, ветряки и чистая разметка.",
    ],
  },
  IE: {
    en: [
      "Ireland drives on the left and often has green hedgerows, narrow rural roads, and bilingual Irish/English signs.",
      "Look for stone walls, wet climate, and yellow center lines on small roads.",
    ],
    ru: [
      "В Ирландии левостороннее движение, зелёные живые изгороди, узкие дороги и ирландско-английские знаки.",
      "Помогают каменные стены, влажный климат и жёлтая осевая на малых дорогах.",
    ],
  },
  SE: {
    en: ["Sweden often has Nordic road signs, clean lane markings, dense forests, and red wooden rural buildings."],
    ru: ["В Швеции часто скандинавские знаки, аккуратная разметка, густые леса и красные деревянные дома."],
  },
  FI: {
    en: ["Finland is known for flat forested roads, Finnish/Swedish place names, and many lakes or wetland areas."],
    ru: ["В Финляндии часто ровные лесные дороги, финские/шведские топонимы, озёра и болотистые места."],
  },
  NO: {
    en: ["Norway often shows fjords, mountains, tunnels, yellow center lines, and very rugged coastal terrain."],
    ru: ["В Норвегии часто фьорды, горы, тоннели, жёлтая осевая разметка и суровый береговой рельеф."],
  },
  EE: {
    en: [
      "Estonia often has flat forests, Baltic road signs, wooden houses, and clean northern villages.",
      "Look for Estonian language, EU-style plates, and rural roads through pine or birch forest.",
    ],
    ru: [
      "В Эстонии часто ровные леса, балтийские знаки, деревянные дома и аккуратные северные деревни.",
      "Помогают эстонский язык, номера ЕС и сельские дороги через сосны или берёзы.",
    ],
  },
  LV: {
    en: [
      "Latvia has Baltic forests, flat countryside, Latvian diacritics, and many modest rural roads.",
      "Look for wooden houses, wide verges, and place names ending in Latvian patterns.",
    ],
    ru: [
      "Латвия: балтийские леса, ровная сельская местность, латышские диакритики и скромные дороги.",
      "Помогают деревянные дома, широкие обочины и характерные латышские окончания топонимов.",
    ],
  },
  LT: {
    en: [
      "Lithuania often has flat fields, Catholic roadside crosses, Lithuanian signs, and tidy villages.",
      "Look for Baltic road furniture, EU plates, and a mix of forests and open farmland.",
    ],
    ru: [
      "В Литве часто ровные поля, придорожные кресты, литовские знаки и аккуратные деревни.",
      "Помогают балтийская дорожная инфраструктура, номера ЕС, леса и открытые поля.",
    ],
  },
  PL: {
    en: ["Poland commonly has red-roof villages, concrete utility poles, Polish diacritics, and flat-to-rolling terrain."],
    ru: ["В Польше часто деревни с красными крышами, бетонные столбы, польские диакритики и равнинный/холмистый рельеф."],
  },
  CZ: {
    en: [
      "Czechia often has red-roof villages, rolling fields, Czech diacritics, and compact central-European towns.",
      "Look for road signs with blue/white direction boards and dense village networks.",
    ],
    ru: [
      "В Чехии часто красные крыши, холмистые поля, чешские диакритики и компактные центральноевропейские города.",
      "Помогают сине-белые указатели и плотная сеть деревень.",
    ],
  },
  SK: {
    en: [
      "Slovakia often looks hillier than Czechia, with Carpathian villages, Slovak diacritics, and red roofs.",
      "Look for mountain backdrops, compact towns, and central-European road signs.",
    ],
    ru: [
      "Словакия часто более гористая, чем Чехия: карпатские деревни, словацкие диакритики и красные крыши.",
      "Помогают горы на горизонте, компактные города и центральноевропейские знаки.",
    ],
  },
  HU: {
    en: [
      "Hungary is often flat, with Hungarian language, red-roof villages, and long straight rural roads.",
      "Look for unique Hungarian words, open plains, and orderly central-European towns.",
    ],
    ru: [
      "В Венгрии часто равнины, венгерский язык, деревни с красными крышами и длинные прямые дороги.",
      "Помогают уникальные венгерские слова, открытые поля и аккуратные города.",
    ],
  },
  RO: {
    en: [
      "Romania often has rolling hills, concrete utility poles, Orthodox churches, and Romanian signs.",
      "Look for villages with roadside houses, mountains in parts of the country, and less polished roads.",
    ],
    ru: [
      "В Румынии часто холмы, бетонные столбы, православные церкви и румынские знаки.",
      "Помогают деревни с домами вдоль дороги, горы в ряде регионов и менее идеальные дороги.",
    ],
  },
  BG: {
    en: [
      "Bulgaria uses Cyrillic, often has Balkan mountains, dry summers, and concrete roadside infrastructure.",
      "Look for Orthodox churches, yellowish fields, and road signs in Bulgarian Cyrillic.",
    ],
    ru: [
      "В Болгарии кириллица, балканские горы, сухое лето и бетонная дорожная инфраструктура.",
      "Помогают православные церкви, желтоватые поля и болгарская кириллица на знаках.",
    ],
  },
  HR: {
    en: [
      "Croatia often has Adriatic limestone, red roofs, Balkan road signs, and coastal mountains.",
      "Look for Croatian diacritics, stone villages, and Mediterranean vegetation near the coast.",
    ],
    ru: [
      "Хорватия: адриатический известняк, красные крыши, балканские знаки и прибрежные горы.",
      "Помогают хорватские диакритики, каменные деревни и средиземноморская растительность у побережья.",
    ],
  },
  SI: {
    en: [
      "Slovenia often looks alpine and tidy, with Slovene signs, red roofs, forests, and mountains.",
      "Look for compact villages, high-quality roads, and a mix of Alpine and Balkan clues.",
    ],
    ru: [
      "Словения часто выглядит альпийской и аккуратной: словенские знаки, красные крыши, леса и горы.",
      "Помогают компактные деревни, хорошие дороги и смесь альпийских и балканских признаков.",
    ],
  },
  RS: {
    en: [
      "Serbia commonly uses both Cyrillic and Latin scripts, with Balkan villages, rolling fields, and Orthodox churches.",
      "Look for Serbian road signs, concrete poles, and dry continental landscapes.",
    ],
    ru: [
      "В Сербии встречаются кириллица и латиница, балканские деревни, холмы и православные церкви.",
      "Помогают сербские дорожные знаки, бетонные столбы и сухие континентальные пейзажи.",
    ],
  },
  CH: {
    en: [
      "Switzerland often has pristine roads, Alpine scenery, multilingual signs, and very orderly villages.",
      "Look for Swiss road signs, tunnels, mountains, and clean lane markings.",
    ],
    ru: [
      "Швейцария: идеальные дороги, Альпы, многоязычные знаки и очень аккуратные деревни.",
      "Помогают швейцарские знаки, тоннели, горы и чистая разметка.",
    ],
  },
  AT: {
    en: [
      "Austria often has Alpine villages, German signs, red roofs, and excellent road quality.",
      "Look for mountains, tidy towns, and Austrian-style direction signs.",
    ],
    ru: [
      "В Австрии часто альпийские деревни, немецкие знаки, красные крыши и отличные дороги.",
      "Помогают горы, аккуратные города и австрийские указатели.",
    ],
  },
  DE: {
    en: ["Germany often has precise road signs, no Google car blur artifacts in many places, orderly villages, and dense road networks."],
    ru: ["В Германии часто аккуратные дорожные знаки, упорядоченные деревни и плотная дорожная сеть."],
  },
  FR: {
    en: ["France often has D-road signs, stone villages, plane-tree roads, and regional architecture differences."],
    ru: ["Во Франции помогают D-дороги, каменные деревни, платаны вдоль дорог и региональная архитектура."],
  },
  ES: {
    en: ["Spain often has dry hills, Spanish road signs, white villages in the south, and varied regional road markers."],
    ru: ["В Испании часто сухие холмы, испанские знаки, белые деревни на юге и региональные дорожные маркеры."],
  },
  PT: {
    en: ["Portugal commonly has Portuguese signs, tiled buildings, dry rural roads, and distinctive black-white roadside posts."],
    ru: ["В Португалии часто португальские надписи, плитка на зданиях, сухие сельские дороги и чёрно-белые столбики."],
  },
  IT: {
    en: [
      "Italy often has narrow roads, stone or stucco villages, Italian signs, and Mediterranean vegetation.",
      "Look for blue direction signs, historic town centers, and varied terrain from Alpine to coastal.",
    ],
    ru: [
      "В Италии часто узкие дороги, каменные или оштукатуренные деревни, итальянские знаки и средиземноморская растительность.",
      "Помогают синие указатели, старые центры городов и рельеф от Альп до побережья.",
    ],
  },
  GR: {
    en: [
      "Greece uses Greek script, has dry Mediterranean hills, white buildings in some areas, and rugged coastal roads.",
      "Look for olive trees, rocky terrain, and blue/white road signs with Greek lettering.",
    ],
    ru: [
      "В Греции греческая письменность, сухие средиземноморские холмы, белые здания и скалистые прибрежные дороги.",
      "Помогают оливы, каменистый рельеф и сине-белые знаки с греческими буквами.",
    ],
  },
  TR: {
    en: [
      "Turkey often has Turkish signs, dry hills or dense cities, red-roof villages, and distinctive mosque minarets.",
      "Look for dotted Turkish letters, wide roads, and varied landscapes from coastal to Anatolian plateau.",
    ],
    ru: [
      "В Турции турецкие знаки, сухие холмы или плотные города, красные крыши и минареты.",
      "Помогают турецкие буквы с точками, широкие дороги и смена ландшафта от побережья до Анатолии.",
    ],
  },
  RU: {
    en: [
      "Russia uses Cyrillic, often has wide roads, birch or pine forests, apartment blocks, and long-distance highways.",
      "Look for Russian road signs, dashcam-like road context, and large open landscapes.",
    ],
    ru: [
      "В России кириллица, широкие дороги, берёзы/сосны, панельные дома и длинные трассы.",
      "Помогают российские знаки, контекст больших расстояний и открытые ландшафты.",
    ],
  },
  UA: {
    en: [
      "Ukraine uses Cyrillic, with flat fields, villages along roads, Orthodox churches, and Eastern European infrastructure.",
      "Look for Ukrainian letters such as ї/є, wide rural roads, and black-soil farmland.",
    ],
    ru: [
      "В Украине кириллица, ровные поля, деревни вдоль дорог, православные церкви и восточноевропейская инфраструктура.",
      "Помогают украинские буквы ї/є, широкие сельские дороги и чернозёмные поля.",
    ],
  },
  ZA: {
    en: ["South Africa drives on the left and often shows dry landscapes, yellow shoulder lines, and English/Afrikaans signs."],
    ru: ["В ЮАР левостороннее движение, сухие пейзажи, жёлтые линии обочины и английские/африкаанс знаки."],
  },
  KE: {
    en: [
      "Kenya drives on the left and often has red soil, dry savanna, English/Swahili signs, and white road edge lines.",
      "Look for acacia trees, plateaus, and East African town layouts.",
    ],
    ru: [
      "В Кении левостороннее движение, красная почва, сухая саванна, английские/суахили знаки и белые края дороги.",
      "Помогают акации, плато и восточноафриканская планировка городков.",
    ],
  },
  UG: {
    en: [
      "Uganda drives on the left, with lush equatorial vegetation, red dirt, English signs, and busy roadside towns.",
      "Look for tropical hills, motorcycles, and East African road conditions.",
    ],
    ru: [
      "В Уганде левостороннее движение, влажная экваториальная растительность, красная земля, английские знаки и оживлённые дороги.",
      "Помогают тропические холмы, мотоциклы и восточноафриканское состояние дорог.",
    ],
  },
  RW: {
    en: [
      "Rwanda is hilly and green, with tidy roads, dense settlements, and English/French/Kinyarwanda context.",
      "Look for terraced hillsides, red soil, and compact villages.",
    ],
    ru: [
      "Руанда зелёная и холмистая, с аккуратными дорогами, плотной застройкой и английско-французским контекстом.",
      "Помогают террасированные склоны, красная почва и компактные деревни.",
    ],
  },
  GH: {
    en: [
      "Ghana often has English signs, tropical vegetation, red soil, open drainage, and busy roadside shops.",
      "Look for West African town layouts, concrete houses, and warm humid scenery.",
    ],
    ru: [
      "В Гане английские знаки, тропическая растительность, красная почва, открытый дренаж и придорожные магазины.",
      "Помогают западноафриканская застройка, бетонные дома и тёплый влажный пейзаж.",
    ],
  },
  NG: {
    en: [
      "Nigeria often shows English signs, dense urban roads, tropical vegetation, and busy commercial streets.",
      "Look for West African road conditions, concrete buildings, and local business signage.",
    ],
    ru: [
      "В Нигерии английские знаки, плотные городские дороги, тропическая растительность и оживлённые коммерческие улицы.",
      "Помогают западноафриканские дороги, бетонные здания и местные вывески.",
    ],
  },
  BW: {
    en: [
      "Botswana drives on the left and often has flat dry landscapes, sparse vegetation, and long straight roads.",
      "Look for sandy shoulders, low population density, and southern African road signs.",
    ],
    ru: [
      "В Ботсване левостороннее движение, ровные сухие ландшафты, редкая растительность и длинные прямые дороги.",
      "Помогают песчаные обочины, низкая плотность населения и южноафриканские знаки.",
    ],
  },
  LS: {
    en: [
      "Lesotho is mountainous and high-altitude, with dry grasslands, left-side driving, and stone or simple rural houses.",
      "Look for dramatic hills, sparse trees, and southern African road design.",
    ],
    ru: [
      "Лесото гористое и высокогорное: сухие луга, левостороннее движение, каменные или простые сельские дома.",
      "Помогают резкие холмы, мало деревьев и южноафриканская дорожная система.",
    ],
  },
  SZ: {
    en: [
      "Eswatini drives on the left and often has hilly green landscapes, southern African roads, and modest towns.",
      "Look for sugarcane or green valleys, mountains, and English road signs.",
    ],
    ru: [
      "В Эсватини левостороннее движение, зелёные холмы, южноафриканские дороги и небольшие города.",
      "Помогают сахарный тростник или зелёные долины, горы и английские дорожные знаки.",
    ],
  },
  MA: {
    en: [
      "Morocco often has Arabic/French signs, dry landscapes, red or tan buildings, and North African road design.",
      "Look for desert edges, mountains, and French-style place-name signs.",
    ],
    ru: [
      "Марокко: арабско-французские знаки, сухие ландшафты, красно-песочные здания и североафриканские дороги.",
      "Помогают пустынные окраины, горы и французские топонимы на знаках.",
    ],
  },
  TN: {
    en: [
      "Tunisia often shows Arabic/French signs, dry Mediterranean scenery, white buildings, and North African roads.",
      "Look for olive groves, flat coastal areas, and French/Arabic place names.",
    ],
    ru: [
      "В Тунисе арабско-французские знаки, сухой средиземноморский пейзаж, белые здания и североафриканские дороги.",
      "Помогают оливковые рощи, ровные прибрежные зоны и французско-арабские топонимы.",
    ],
  },
  AU: {
    en: ["Australia drives on the left; look for dry eucalyptus landscapes, wide roads, and yellow diamond warning signs."],
    ru: ["В Австралии левостороннее движение; помогают сухие эвкалиптовые пейзажи, широкие дороги и жёлтые предупреждающие знаки."],
  },
  GB: {
    en: [
      "The United Kingdom drives on the left; look for narrow roads, yellow rear plates, and UK-style road signs.",
      "Stone walls, hedgerows, and compact villages are common rural clues, especially outside major cities.",
    ],
    ru: [
      "В Великобритании левостороннее движение; помогают узкие дороги, жёлтые задние номера и британские дорожные знаки.",
      "Каменные стены, живые изгороди и компактные деревни часто встречаются за пределами крупных городов.",
    ],
  },
  UK: {
    en: [
      "The United Kingdom drives on the left; look for narrow roads, yellow rear plates, and UK-style road signs.",
      "Stone walls, hedgerows, and compact villages are common rural clues, especially outside major cities.",
    ],
    ru: [
      "В Великобритании левостороннее движение; помогают узкие дороги, жёлтые задние номера и британские дорожные знаки.",
      "Каменные стены, живые изгороди и компактные деревни часто встречаются за пределами крупных городов.",
    ],
  },
  NZ: {
    en: ["New Zealand drives on the left and often has lush hills, sheep country, and distinctive black-yellow warning signs."],
    ru: ["В Новой Зеландии левостороннее движение, зелёные холмы, пастбища и характерные чёрно-жёлтые предупреждающие знаки."],
  },
  JP: {
    en: ["Japan drives on the left; look for dense utility wires, narrow roads, Japanese script, and convex mirrors."],
    ru: ["В Японии левостороннее движение; часто узкие дороги, японская письменность, провода и дорожные зеркала."],
  },
  KR: {
    en: [
      "South Korea has Korean Hangul signs, dense cities, mountains, and very organized road infrastructure.",
      "Look for blue/red route shields, apartment towers, and Korean utility poles.",
    ],
    ru: [
      "В Южной Корее корейская письменность, плотные города, горы и очень организованная дорожная инфраструктура.",
      "Помогают сине-красные щиты дорог, высотные дома и корейские столбы.",
    ],
  },
  TW: {
    en: [
      "Taiwan has Traditional Chinese signs, scooters, lush mountains, and dense urban streets.",
      "Look for tropical vegetation, tiled buildings, right-side driving, and dense utility lines.",
    ],
    ru: [
      "На Тайване традиционные китайские знаки, скутеры, зелёные горы и плотные городские улицы.",
      "Помогают тропическая растительность, плиточные здания и правостороннее движение.",
    ],
  },
  TH: {
    en: [
      "Thailand drives on the left, with Thai script, tropical vegetation, concrete poles, and many motorcycles.",
      "Look for ornate temples, roadside shops, and warm humid landscapes.",
    ],
    ru: [
      "В Таиланде левостороннее движение, тайская письменность, тропическая растительность, бетонные столбы и много мотоциклов.",
      "Помогают храмы, придорожные магазины и тёплый влажный пейзаж.",
    ],
  },
  MY: {
    en: [
      "Malaysia drives on the left, with Malay/English signs, tropical vegetation, and modern highways near cities.",
      "Look for palm plantations, Islamic architecture, and humid roadside greenery.",
    ],
    ru: [
      "В Малайзии левостороннее движение, малайско-английские знаки, тропики и современные трассы у городов.",
      "Помогают пальмовые плантации, исламская архитектура и влажная зелень вдоль дорог.",
    ],
  },
  ID: {
    en: [
      "Indonesia drives on the left and often has tropical villages, Indonesian signs, motorcycles, and dense roadside life.",
      "Look for tiled roofs, mosques, palm trees, and less formal road markings.",
    ],
    ru: [
      "В Индонезии левостороннее движение, тропические деревни, индонезийские знаки, мотоциклы и плотная жизнь у дорог.",
      "Помогают черепичные крыши, мечети, пальмы и менее строгая разметка.",
    ],
  },
  SG: {
    en: [
      "Singapore drives on the left, with English signs, pristine roads, tropical greenery, and dense high-rise blocks.",
      "Look for very clean infrastructure, lane discipline, and urban expressways.",
    ],
    ru: [
      "В Сингапуре левостороннее движение, английские знаки, идеальные дороги, тропическая зелень и высотки.",
      "Помогают очень чистая инфраструктура, аккуратные полосы и городские экспрессвеи.",
    ],
  },
  PH: {
    en: [
      "The Philippines drives on the right, with English/Tagalog signs, tropical scenery, tricycles, and busy roadside towns.",
      "Look for concrete houses, colorful shops, and Southeast Asian road clutter.",
    ],
    ru: [
      "На Филиппинах правостороннее движение, английско-тагальские знаки, тропики, трициклы и оживлённые дороги.",
      "Помогают бетонные дома, яркие магазины и плотная дорожная среда Юго-Восточной Азии.",
    ],
  },
  IN: {
    en: [
      "India drives on the left, with English/local scripts, dense roadside activity, and varied road quality.",
      "Look for auto-rickshaws, concrete buildings, tropical or dry climates, and state-specific scripts.",
    ],
    ru: [
      "В Индии левостороннее движение, английские/местные письменности, плотная жизнь у дороги и разное качество дорог.",
      "Помогают авторикши, бетонные здания, тропический или сухой климат и письменность штата.",
    ],
  },
  BD: {
    en: [
      "Bangladesh has Bengali script, very flat terrain, dense villages, rickshaws, and lush lowland vegetation.",
      "Look for water, rice fields, busy roads, and South Asian building styles.",
    ],
    ru: [
      "В Бангладеш бенгальская письменность, очень ровный рельеф, плотные деревни, рикши и низинная зелень.",
      "Помогают вода, рисовые поля, оживлённые дороги и южноазиатская застройка.",
    ],
  },
  IL: {
    en: [
      "Israel has Hebrew/Arabic/English signs, dry Mediterranean landscapes, modern roads, and yellow license plates.",
      "Look for right-side driving, rocky hills, and mixed-language direction signs.",
    ],
    ru: [
      "В Израиле иврит/арабский/английский на знаках, сухой средиземноморский пейзаж, современные дороги и жёлтые номера.",
      "Помогают правостороннее движение, каменистые холмы и многоязычные указатели.",
    ],
  },
  JO: {
    en: [
      "Jordan has Arabic signs, dry desert or rocky hills, right-side driving, and beige stone buildings.",
      "Look for arid terrain, modern highways, and Middle Eastern road furniture.",
    ],
    ru: [
      "В Иордании арабские знаки, сухая пустыня или каменистые холмы, правостороннее движение и бежевые каменные здания.",
      "Помогают аридный рельеф, современные трассы и ближневосточная дорожная инфраструктура.",
    ],
  },
  AE: {
    en: [
      "United Arab Emirates has Arabic/English signs, desert surroundings, immaculate highways, and modern urban areas.",
      "Look for wide multi-lane roads, palm landscaping, and Gulf-style architecture.",
    ],
    ru: [
      "В ОАЭ арабско-английские знаки, пустыня, идеальные трассы и современные города.",
      "Помогают широкие многополосные дороги, пальмовый ландшафтинг и архитектура Залива.",
    ],
  },
};

async function addPlacementMetadata(result, settings) {
  const placement = await computePlacement(
    result.latitude,
    result.longitude,
    settings,
    result.meta?.language || "en",
  );
  const countryCode = normalizeCountryCode(result.country_code || result.countryCode || "", {}, result);
  const resultClues = Array.isArray(result.local_clues) ? result.local_clues : [];
  const localClues = resultClues.length
    ? resultClues
    : getLocalClues(countryCode, {}, result.meta?.language || "en", result);
  return {
    ...result,
    local_clues: localClues,
    meta: {
      ...result.meta,
      placement,
    },
  };
}

async function computePlacement(latitude, longitude, settings, language = "en") {
  const exact = { lat: Number(latitude), lng: Number(longitude) };
  if (!isValidCoordinates(exact)) return null;
  if (!settings.rangeEnabled) {
    return { lat: exact.lat, lng: exact.lng, range_enabled: false };
  }
  const minScore = clampScore(settings.scoreMin);
  const maxScore = clampScore(settings.scoreMax);
  const lowScore = Math.min(minScore, maxScore);
  const highScore = Math.max(minScore, maxScore);
  const innerKm = scoreToDistanceKm(highScore);
  const outerKm = Math.max(innerKm, scoreToDistanceKm(lowScore));
  const offset = await randomLandPointInRing(exact, innerKm, outerKm, language);
  return {
    ...offset,
    range_enabled: true,
    score_min: lowScore,
    score_max: highScore,
    radius_min_km: Math.round(innerKm * 10) / 10,
    radius_max_km: Math.round(outerKm * 10) / 10,
  };
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 5000;
  return Math.max(0, Math.min(5000, score));
}

function scoreToDistanceKm(score) {
  if (score >= 5000) return 0;
  if (score <= 0) return 15000;
  return Math.max(0, -Math.log(score / 5000) * 14931 / 10);
}

function randomPointInRing(lat, lng, innerKm, outerKm) {
  const distance = innerKm + Math.random() * Math.max(0, outerKm - innerKm);
  const bearing = Math.random() * Math.PI * 2;
  const earthKm = 6371;
  const angular = distance / earthKm;
  const lat1 = lat * Math.PI / 180;
  const lng1 = lng * Math.PI / 180;
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

async function randomLandPointInRing(origin, innerKm, outerKm, language) {
  if (outerKm <= 0) return { lat: origin.lat, lng: origin.lng };
  let fallback = null;
  for (let attempt = 0; attempt < LAND_CHECK_ATTEMPTS; attempt += 1) {
    const candidate = randomPointInRing(origin.lat, origin.lng, innerKm, outerKm);
    fallback = fallback || candidate;
    if (await isLikelyLandCoordinate(candidate, language)) return candidate;
  }
  return fallback || { lat: origin.lat, lng: origin.lng };
}

async function isLikelyLandCoordinate(point, language) {
  if (!isValidCoordinates(point)) return false;
  const key = `${Number(point.lat).toFixed(3)},${Number(point.lng).toFixed(3)}`;
  if (landCheckCache.has(key)) return landCheckCache.get(key);
  const place = await reverseGeocode(point.lat, point.lng, language, "14").catch(() => null);
  const likelyLand = Boolean(place) && !isLikelyWaterPlace(place);
  landCheckCache.set(key, likelyLand);
  if (landCheckCache.size > 300) landCheckCache.delete(landCheckCache.keys().next().value);
  return likelyLand;
}

function isLikelyWaterPlace(place) {
  const address = place?.address || {};
  const waterFields = [
    place?.category,
    place?.type,
    place?.addresstype,
    place?.name,
    address.water,
    address.waterway,
    address.sea,
    address.ocean,
    address.bay,
    address.lake,
    address.river,
    address.reservoir,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return WATER_TERMS.some((term) => new RegExp(`\\b${term}\\b`).test(waterFields));
}

async function placementClickSequence(target, language) {
  const roll = Math.random();
  const total = roll < 0.2 ? PLACEMENT_CLICK_MIN : roll < 0.7 ? 2 : PLACEMENT_CLICK_MAX;
  const sequence = [];
  for (let index = 1; index < total; index += 1) {
    sequence.push(await randomNearbyLandPoint(target, language));
  }
  sequence.push({ lat: target.lat, lng: target.lng });
  return sequence;
}

async function randomNearbyLandPoint(origin, language) {
  let fallback = null;
  for (let attempt = 0; attempt < LAND_CHECK_ATTEMPTS; attempt += 1) {
    const candidate = randomPointInRing(origin.lat, origin.lng, 4, 32);
    fallback = fallback || candidate;
    if (await isLikelyLandCoordinate(candidate, language)) return candidate;
  }
  return fallback || { lat: origin.lat, lng: origin.lng };
}

async function placeGuess(tabId, result, settings) {
  const placement = result.meta?.placement;
  const target = placement || { lat: result.latitude, lng: result.longitude };
  if (!isValidCoordinates(target)) return;
  const shouldUseMultiClick = target.range_enabled === true && settings.smartZoom !== false;
  const clickSequence = shouldUseMultiClick
    ? await placementClickSequence(target, result.meta?.language || "en")
    : [{ lat: target.lat, lng: target.lng }];
  await chrome.tabs
    .sendMessage(tabId, {
      type: "place-guess",
      payload: {
        lat: target.lat,
        lng: target.lng,
        clickSequence,
        smartZoom: settings.smartZoom,
        smartZoomSpeed: settings.smartZoomSpeed,
        autoGuess: settings.autoGuess === true,
      },
    }, { frameId: 0 })
    .catch(() => null);
}

async function ensureHotkeyOnActiveTab() {
  const tab = await getActiveTab();
  return ensureHotkeyOnTab(tab);
}

async function ensureHotkeyOnTab(tab) {
  if (!tab?.id || !isSupportedGameUrl(tab.url)) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ["page-probe.js"],
    world: "MAIN",
  }).catch(() => {});
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ["content-script.js"],
  });
}

async function getUsage() {
  const stored = await chrome.storage.local.get([
    "freeGuessCount",
    "freeStarterCompletedDate",
    "freeDailyGuessDate",
    "freeDailyGuessCount",
    "unlimitedPromoCode",
    "lastBillingStatus",
    "lastServerUsage",
    "freeUsageServerMigrated",
  ]);
  const adminUnlimited = String(stored.unlimitedPromoCode || "").toUpperCase() === ADMIN_PROMO_CODE;
  try {
    const website = await getWebsiteUrl();
    const identity = await getBillingIdentity();
    const today = localDateKey();
    const response = await fetch(`${website}/api/usage/status`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...identity,
        migration: stored.freeUsageServerMigrated ? undefined : {
          starter_used: Math.max(0, Number(stored.freeGuessCount || 0)),
          starter_completed_date: String(stored.freeStarterCompletedDate || ""),
          daily_date: String(stored.freeDailyGuessDate || ""),
          daily_used:
            String(stored.freeDailyGuessDate || "") === today
              ? Math.max(0, Number(stored.freeDailyGuessCount || 0))
              : 0,
        },
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Could not load usage status.");
    const usage = adminUnlimited
      ? { ...body, subscribed: true, canGuess: true, billingStatus: "admin_test" }
      : body;
    await cacheServerUsage(usage);
    return usage;
  } catch (error) {
    const cached = stored.lastServerUsage;
    if (cached && typeof cached === "object" && adminUnlimited) {
      return { ...cached, subscribed: true, canGuess: true, billingStatus: "admin_test" };
    }
    if (
      cached &&
      typeof cached === "object" &&
      cached.serverManaged &&
      cached.subscribed &&
      Date.parse(cached.accessUntil) > Date.now()
    ) {
      return cached;
    }
  }

  return localUsageFallback(stored, adminUnlimited);
}

async function cacheServerUsage(usage) {
  const update = {
    lastServerUsage: usage,
    freeUsageServerMigrated: true,
    freeGuessCount: Number(usage.starterUsed || 0),
    freeStarterCompletedDate: String(usage.starterCompletedDate || ""),
    freeDailyGuessDate: usage.dailyUsed ? localDateKey() : "",
    freeDailyGuessCount: Number(usage.dailyUsed || 0),
  };
  if (usage.billingStatus) {
    update.lastBillingStatus = {
      subscribed: Boolean(usage.subscribed),
      status: usage.billingStatus,
      plan: usage.billingPlan || "",
      source: usage.billingSource || "",
      email: usage.billingEmail || "",
      access_until: usage.accessUntil || null,
    };
  }
  await chrome.storage.local.set(update);
}

function localUsageFallback(stored, adminUnlimited = false) {
  const used = Math.max(0, Number(stored.freeGuessCount || 0));
  const today = localDateKey();
  const starterCompletedDate = String(stored.freeStarterCompletedDate || "");
  const dailyDate = String(stored.freeDailyGuessDate || "");
  const dailyUsed = dailyDate === today ? Math.max(0, Number(stored.freeDailyGuessCount || 0)) : 0;
  const billingStatus = stored.lastBillingStatus;
  const subscribed =
    isActiveBillingStatus(billingStatus) ||
    adminUnlimited;
  const starterRemaining = Math.max(0, FREE_STARTER_GUESS_LIMIT - used);
  const dailyUnlocked = starterRemaining <= 0 && starterCompletedDate !== today;
  const dailyRemaining = dailyUnlocked ? Math.max(0, FREE_DAILY_GUESS_LIMIT - dailyUsed) : 0;
  const freeMode = starterRemaining > 0 ? "starter" : "daily";
  return {
    used,
    limit: freeMode === "starter" ? FREE_STARTER_GUESS_LIMIT : FREE_DAILY_GUESS_LIMIT,
    remaining: subscribed ? Infinity : (freeMode === "starter" ? starterRemaining : dailyRemaining),
    starterUsed: used,
    starterLimit: FREE_STARTER_GUESS_LIMIT,
    starterRemaining,
    starterCompletedDate,
    dailyUsed,
    dailyLimit: FREE_DAILY_GUESS_LIMIT,
    dailyRemaining,
    dailyUnlocked,
    freeMode,
    subscribed,
    billingStatus: billingStatus?.status || null,
    accessUntil: billingStatus?.access_until || null,
    restoreAvailable: Boolean(stored.lastServerUsage?.restoreAvailable),
    canGuess: subscribed || starterRemaining > 0 || dailyRemaining > 0,
    serverManaged: false,
  };
}

async function completeUsage(previousUsage) {
  if (previousUsage?.billingStatus === "admin_test") return previousUsage;
  try {
    const website = await getWebsiteUrl();
    const identity = await getBillingIdentity();
    const response = await fetch(`${website}/api/usage/complete`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identity),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.completed) {
      throw new Error(body.error || "Free guesses used for today. Upgrade to Pro for unlimited guesses.");
    }
    const usage = previousUsage?.restoreAvailable
      ? { ...body, restoreAvailable: true }
      : body;
    await cacheServerUsage(usage);
    return usage;
  } catch (error) {
    if (previousUsage?.subscribed && previousUsage?.serverManaged) {
      return previousUsage;
    }
    throw error;
  }
}

async function refreshBillingStatus() {
  const website = await getWebsiteUrl();
  const identity = await getBillingIdentity();
  const response = await fetch(`${website}/api/billing/status`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(identity),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Could not refresh Pro status.");
  await chrome.storage.local.set({ lastBillingStatus: body });
  void registerExternalLifecyclePages();
  return body;
}

function isActiveBillingStatus(status) {
  if (!status?.subscribed) return false;
  return Date.parse(status.access_until) > Date.now();
}

async function redeemPromo(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (normalized !== ADMIN_PROMO_CODE) {
    throw new Error("Invalid promo code.");
  }
  await chrome.storage.local.set({
    unlimitedPromoCode: ADMIN_PROMO_CODE,
  });
  return getUsage();
}

async function startCheckout(email, plan = "monthly", source = "unknown") {
  const website = await getWebsiteUrl();
  const identity = await getBillingIdentity();
  const analytics = await getAnalyticsSettings();
  const experiment = await getPaywallExperimentAssignment();
  const response = await fetch(`${website}/api/billing/checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identity,
      email,
      plan,
      analytics_opt_out: analytics.analyticsOptOut,
      paywall_experiment: experiment.experiment,
      paywall_variant: experiment.variant,
      paywall_surface: source === "prompt" ? "limit_prompt" : "main_card",
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.checkout_url) {
    if (body.restore_required || body.code === "restore_required") {
      return {
        restoreRequired: true,
        error: body.error || "Active Pro access was found. Restore it instead of purchasing again.",
      };
    }
    // Failures with a stage were already recorded by the backend. Client-side
    // tracking is only the fallback for validation/configuration failures.
    if (!body.stage) {
      trackEvent("checkout_failed", {
        plan,
        source,
        stage: "checkout",
      });
    }
    throw new Error(body.error || "Could not open payment.");
  }
  await chrome.storage.local.set({
    checkoutEmail: email,
    lastCheckoutRequestId: body.request_id || null,
  });
  await chrome.tabs.create({ url: body.checkout_url });
  return {
    checkoutUrl: body.checkout_url,
    requestId: body.request_id || null,
  };
}

async function submitCryptoPaymentRequest(email, plan = "annual", country = "", company = "") {
  const website = await getWebsiteUrl();
  const identity = await getBillingIdentity();
  const analytics = await getAnalyticsSettings();
  const response = await fetch(`${website}/api/billing/crypto-request`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identity,
      email,
      plan,
      country,
      company,
      analytics_opt_out: analytics.analyticsOptOut,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.request?.request_id) {
    throw new Error(body.error || "Could not submit the payment request.");
  }
  await chrome.storage.local.set({
    lastCryptoPaymentRequest: body.request,
    cryptoPaymentEmail: email,
    cryptoPaymentCountry: country,
  });
  return {
    request: body.request,
    duplicate: Boolean(body.duplicate),
  };
}

async function getCryptoPaymentRequestStatus() {
  const website = await getWebsiteUrl();
  const identity = await getBillingIdentity();
  const response = await fetch(`${website}/api/billing/crypto-request/status`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(identity),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Could not check the payment request.");
  }
  if (body.request) {
    await chrome.storage.local.set({ lastCryptoPaymentRequest: body.request });
  }
  return { request: body.request || null };
}

async function requestRestoreCode(email) {
  const website = await getWebsiteUrl();
  const identity = await getBillingIdentity();
  trackEvent("restore_started", {});
  const response = await fetch(`${website}/api/billing/restore/request`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identity,
      email,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    trackEvent("restore_failed", { stage: "request" });
    throw new Error(body.error || "Could not send restore code.");
  }
  await chrome.storage.local.set({ restoreEmail: email });
  trackEvent("restore_code_sent", {});
}

async function confirmRestoreCode(email, code) {
  const website = await getWebsiteUrl();
  const identity = await getBillingIdentity();
  const response = await fetch(`${website}/api/billing/restore/confirm`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identity,
      email,
      code,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    trackEvent("restore_failed", { stage: "confirm" });
    throw new Error(body.error || "Could not restore Pro access.");
  }
  await chrome.storage.local.set({
    lastBillingStatus: body,
    restoreEmail: email,
  });
  void registerExternalLifecyclePages();
  trackEvent("restore_completed", {
    subscribed: Boolean(body.subscribed),
    status: body.status || "",
    plan: body.plan || "",
  });
  return getUsage();
}

async function manageSubscription() {
  const website = await getWebsiteUrl();
  const identity = await getBillingIdentity();
  const response = await fetch(`${website}/api/billing/portal`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(identity),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.portal_url) {
    trackEvent("portal_failed", { status: body.error ? "error" : "missing_url" });
    throw new Error(body.error || "Could not open subscription management.");
  }
  trackEvent("portal_opened", {});
  await chrome.tabs.create({ url: body.portal_url });
  return { portalUrl: body.portal_url };
}

async function referralStatus() {
  const website = await getWebsiteUrl();
  const identity = await getBillingIdentity();
  const response = await fetch(`${website}/api/referrals/status`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(identity),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Could not load invite status.");
  }
  await chrome.storage.local.set({ lastReferralStatus: body });
  return body;
}

async function requestReferralEmailCode(email) {
  const website = await getWebsiteUrl();
  const identity = await getBillingIdentity();
  const response = await fetch(`${website}/api/referrals/email/request`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identity,
      email,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Could not send verification code.");
  }
  trackEvent("referral_email_code_sent", {});
  return body;
}

async function confirmReferralEmailCode(email, code) {
  const website = await getWebsiteUrl();
  const identity = await getBillingIdentity();
  const response = await fetch(`${website}/api/referrals/email/confirm`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identity,
      email,
      code,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Could not verify email.");
  }
  await chrome.storage.local.set({ lastReferralStatus: body });
  trackEvent("referral_email_verified", {});
  return body;
}

async function applyReferralCode(code) {
  const website = await getWebsiteUrl();
  const identity = await getBillingIdentity();
  const response = await fetch(`${website}/api/referrals/apply`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identity,
      code,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Could not apply invite code.");
  }
  await chrome.storage.local.set({ lastReferralStatus: body });
  trackEvent("referral_applied", {
    already_applied: Boolean(body.already_applied),
    reward_unlocked: Boolean(body.reward_unlocked),
  });
  return body;
}

async function affiliateApi(path, payload = {}) {
  const website = await getWebsiteUrl();
  const identity = await getBillingIdentity();
  const response = await fetch(`${website}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...identity, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Affiliate request failed.");
  }
  return body;
}

async function affiliateStatus() {
  const body = await affiliateApi("/api/affiliates/status");
  await chrome.storage.local.set({ lastAffiliateStatus: body });
  return body;
}

async function affiliateEnroll(email, code) {
  const body = await affiliateApi("/api/affiliates/enroll", { email, code });
  await chrome.storage.local.set({ lastAffiliateStatus: body, affiliateEmail: email });
  return body;
}

async function affiliatePayoutRequest(asset, network, walletAddress) {
  const body = await affiliateApi("/api/affiliates/payouts/request", {
    asset,
    network,
    wallet_address: walletAddress,
  });
  return body;
}

async function affiliatePayoutList() {
  return affiliateApi("/api/affiliates/payouts/list");
}

async function getBillingIdentity() {
  const stored = await chrome.storage.local.get([
    "billingInstallationId",
    "billingInstallationSecret",
  ]);
  const update = {};
  let installationId = stored.billingInstallationId;
  let installationSecret = stored.billingInstallationSecret;
  if (!installationId) {
    installationId = crypto.randomUUID();
    update.billingInstallationId = installationId;
  }
  if (!installationSecret) {
    installationSecret = randomSecret();
    update.billingInstallationSecret = installationSecret;
  }
  if (Object.keys(update).length) await chrome.storage.local.set(update);
  return {
    installation_id: installationId,
    installation_secret: installationSecret,
  };
}

function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function incrementUsage() {
  const usage = await getUsage();
  if (usage.subscribed) return usage;
  if (usage.starterRemaining > 0) {
    const nextCount = Math.min(FREE_STARTER_GUESS_LIMIT, usage.starterUsed + 1);
    const update = { freeGuessCount: nextCount };
    if (nextCount >= FREE_STARTER_GUESS_LIMIT && !usage.starterCompletedDate) {
      update.freeStarterCompletedDate = localDateKey();
    }
    await chrome.storage.local.set(update);
    return getUsage();
  }
  if (usage.dailyRemaining > 0) {
    await chrome.storage.local.set({
      freeDailyGuessDate: localDateKey(),
      freeDailyGuessCount: Math.min(FREE_DAILY_GUESS_LIMIT, usage.dailyUsed + 1),
    });
    return getUsage();
  }
  return getUsage();
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getWebsiteUrl() {
  if (!configPromise) {
    configPromise = fetch(chrome.runtime.getURL("config.json"))
      .then((response) => response.json())
      .catch(() => ({}));
  }
  const config = await configPromise;
  return String(config.websiteUrl || "https://geoboost.win").replace(/\/+$/, "");
}

async function buildWebsiteUrl(path) {
  const website = await getWebsiteUrl();
  return `${website}${path}`;
}

async function registerExternalLifecyclePages() {
  const runId = ++uninstallRegistrationRunId;
  const extensionVersion = chrome.runtime.getManifest().version;
  const version = encodeURIComponent(extensionVersion);
  const website = await getWebsiteUrl();
  const fallbackUrl = `${website}/uninstall?version=${version}`;
  await chrome.runtime.setUninstallURL(fallbackUrl);

  const stored = await chrome.storage.local.get([
    "analyticsOptOut",
    "uninstallTrackingToken",
  ]);
  if (stored.analyticsOptOut) return;

  const token = String(stored.uninstallTrackingToken || randomSecret());
  if (!stored.uninstallTrackingToken) {
    await chrome.storage.local.set({ uninstallTrackingToken: token });
  }
  const identity = await getBillingIdentity();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UNINSTALL_REGISTRATION_TIMEOUT_MS);
  try {
    const response = await fetch(`${website}/api/uninstall/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        ...identity,
        token,
        extension_version: extensionVersion,
        analytics_opt_out: false,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);

    const uninstallUrl = new URL(String(body.uninstall_url || ""));
    const websiteUrl = new URL(website);
    const latest = await chrome.storage.local.get("analyticsOptOut");
    if (
      runId !== uninstallRegistrationRunId ||
      latest.analyticsOptOut ||
      uninstallUrl.origin !== websiteUrl.origin ||
      !uninstallUrl.pathname.startsWith("/u/")
    ) {
      return;
    }
    await chrome.runtime.setUninstallURL(uninstallUrl.href);
    await chrome.storage.local.set({
      uninstallTrackingRegisteredAt: Date.now(),
      uninstallTrackingRegisteredVersion: extensionVersion,
    });
    await chrome.storage.local.remove("uninstallTrackingLastError");
  } catch (error) {
    await chrome.storage.local.set({
      uninstallTrackingLastError: readableError(error).slice(0, 160),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(
      Object.entries(stored).filter(([, value]) => value !== undefined),
    ),
  };
}

function effectiveSettingsForUsage(settings, usage) {
  return settings;
}

function trackEvent(eventType, eventProperties = {}, options = {}) {
  const normalizedType = String(eventType || "").trim().toLowerCase();
  if (!ANALYTICS_EVENT_TYPES.has(normalizedType)) return Promise.resolve();

  const captured = {
    eventType: normalizedType,
    eventProperties: { ...(eventProperties || {}) },
    options: { ...(options || {}) },
    time: Date.now(),
  };
  if (analysisInProgress) {
    pendingAnalyticsEvents.push(captured);
  } else {
    queueCapturedAnalyticsEvents([captured]);
  }

  // Callers must never wait for analytics storage or network work.
  return Promise.resolve();
}

function flushPendingAnalyticsEvents() {
  if (!pendingAnalyticsEvents.length) return;
  const captured = pendingAnalyticsEvents;
  pendingAnalyticsEvents = [];
  queueCapturedAnalyticsEvents(captured);
}

function queueCapturedAnalyticsEvents(capturedEvents) {
  const operation = mutateAnalyticsQueue(() => enqueueAnalyticsEvents(capturedEvents));
  void operation.catch((error) => recordAnalyticsTransportError("queue", error));
}

async function enqueueAnalyticsEvents(capturedEvents) {
  const settings = await getAnalyticsSettings();
  if (settings.analyticsOptOut) return;
  const filtered = [];
  for (const captured of capturedEvents) {
    if (
      captured.options?.dedupe_minutes &&
      !(await consumeAnalyticsDedupe(captured.eventType, captured.options.dedupe_minutes))
    ) {
      continue;
    }
    filtered.push(captured);
  }
  if (!filtered.length) return;

  const availableSlots = await consumeLocalAnalyticsLimit(filtered.length);
  if (availableSlots <= 0) return;
  const acceptedCaptured = filtered.slice(0, availableSlots);

  const identity = await getBillingIdentity();
  const stored = await chrome.storage.local.get([
    "uiLanguage",
    "lastBillingStatus",
    "paywallExperimentId",
    "paywallVariant",
    "analyticsQueue",
    "analyticsDroppedCount",
  ]);
  const queue = Array.isArray(stored.analyticsQueue) ? stored.analyticsQueue : [];
  const events = acceptedCaptured.map((captured) => ({
    event_type: captured.eventType,
    time: captured.time,
    insert_id: `${identity.installation_id}:${captured.eventType}:${captured.time}:${Math.random().toString(16).slice(2)}`,
    event_properties: sanitizeAnalyticsProperties({
      ...captured.eventProperties,
      subscribed: isActiveBillingStatus(stored.lastBillingStatus),
      paywall_experiment: stored.paywallExperimentId || PAYWALL_EXPERIMENT_ID,
      paywall_variant: PAYWALL_VARIANTS.has(stored.paywallVariant) ? stored.paywallVariant : "A",
    }),
    user_properties: sanitizeAnalyticsProperties({
      extension_version: chrome.runtime.getManifest().version,
      language: stored.uiLanguage || "en",
      billing_status: stored.lastBillingStatus?.status || "unknown",
      plan: stored.lastBillingStatus?.plan || "none",
      paywall_experiment: stored.paywallExperimentId || PAYWALL_EXPERIMENT_ID,
      paywall_variant: PAYWALL_VARIANTS.has(stored.paywallVariant) ? stored.paywallVariant : "A",
    }),
  }));
  queue.push(...events);
  const droppedNow = Math.max(0, queue.length - ANALYTICS_QUEUE_LIMIT);
  const nextQueue = queue.slice(-ANALYTICS_QUEUE_LIMIT);
  await chrome.storage.local.set({
    analyticsQueue: nextQueue,
    analyticsQueueLength: nextQueue.length,
    analyticsDroppedCount: Number(stored.analyticsDroppedCount || 0) + droppedNow,
  });
  const batchDelay = nextQueue.length >= ANALYTICS_BATCH_TRIGGER ? 0 : ANALYTICS_FLUSH_DELAY_MS;
  const quietDelay = Math.max(0, analyticsNetworkQuietUntil - Date.now());
  scheduleAnalyticsFlush(Math.max(batchDelay, quietDelay));
}

function mutateAnalyticsQueue(task) {
  const operation = analyticsQueueMutation.then(task, task);
  analyticsQueueMutation = operation.catch(() => null);
  return operation;
}

function scheduleAnalyticsFlush(delayMs = ANALYTICS_FLUSH_DELAY_MS) {
  const normalizedDelay = Math.max(0, Number(delayMs) || 0);
  const dueAt = Date.now() + normalizedDelay;
  if (analyticsFlushTimer && analyticsFlushTimerDueAt <= dueAt) return;
  if (analyticsFlushTimer) clearTimeout(analyticsFlushTimer);
  analyticsFlushTimerDueAt = dueAt;
  analyticsFlushTimer = setTimeout(() => {
    analyticsFlushTimer = null;
    analyticsFlushTimerDueAt = 0;
    void flushAnalyticsQueue();
  }, normalizedDelay);
}

function flushAnalyticsQueue() {
  if (analyticsFlushPromise) return analyticsFlushPromise;
  analyticsFlushPromise = performAnalyticsFlush()
    .catch(() => null)
    .finally(() => {
      analyticsFlushPromise = null;
    });
  return analyticsFlushPromise;
}

async function performAnalyticsFlush() {
  const quietDelay = Math.max(0, analyticsNetworkQuietUntil - Date.now());
  if (analysisInProgress || quietDelay > 0) {
    scheduleAnalyticsFlush(Math.max(quietDelay, ANALYTICS_FLUSH_DELAY_MS));
    return;
  }
  const snapshot = await mutateAnalyticsQueue(async () => {
    const stored = await chrome.storage.local.get([
      "analyticsQueue",
      "analyticsOptOut",
      "analyticsRetryAt",
    ]);
    return {
      queue: Array.isArray(stored.analyticsQueue) ? stored.analyticsQueue : [],
      analyticsOptOut: Boolean(stored.analyticsOptOut),
      retryAt: Number(stored.analyticsRetryAt || 0),
    };
  });
  if (!snapshot.queue.length || snapshot.analyticsOptOut) return;
  if (snapshot.retryAt > Date.now()) {
    scheduleAnalyticsFlush(snapshot.retryAt - Date.now());
    return;
  }

  const batch = snapshot.queue.slice(0, ANALYTICS_BATCH_SIZE);
  let timeoutId = null;
  try {
    const identity = await getBillingIdentity();
    const website = await getWebsiteUrl();
    const controller = new AbortController();
    analyticsFlushController = controller;
    timeoutId = setTimeout(() => controller.abort(), ANALYTICS_FLUSH_TIMEOUT_MS);
    const response = await fetch(`${website}/api/analytics/events`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        installation_id: identity.installation_id,
        installation_secret: identity.installation_secret,
        events: batch,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Analytics backend returned HTTP ${response.status}.`);
    }
    const accepted = Math.max(0, Math.min(batch.length, Number(body.accepted) || 0));
    if (accepted > 0) {
      const acceptedIds = new Set(batch.slice(0, accepted).map((event) => event.insert_id));
      const remaining = await mutateAnalyticsQueue(async () => {
        const latest = await chrome.storage.local.get("analyticsQueue");
        const latestQueue = Array.isArray(latest.analyticsQueue) ? latest.analyticsQueue : [];
        const nextQueue = latestQueue.filter((event) => !acceptedIds.has(event?.insert_id));
        await chrome.storage.local.set({
          analyticsQueue: nextQueue,
          analyticsQueueLength: nextQueue.length,
          analyticsLastFlushAt: Date.now(),
          analyticsLastSuccessAt: Date.now(),
          analyticsRetryCount: 0,
          analyticsRetryAt: 0,
        });
        await chrome.storage.local.remove("analyticsLastError");
        return nextQueue.length;
      });
      if (remaining > 0) scheduleAnalyticsFlush(1000);
      return;
    }

    const reason = body.rate_limited
      ? "rate_limited"
      : body.configured === false
        ? "not_configured"
        : body.deferred
          ? "deferred"
          : body.dropped
            ? "dropped"
            : "not_accepted";
    await scheduleAnalyticsRetry(reason);
  } catch (error) {
    await scheduleAnalyticsRetry(error?.name === "AbortError" ? "timeout" : readableError(error));
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    analyticsFlushController = null;
  }
}

async function ensureAnalyticsAlarm() {
  const existing = await chrome.alarms.get(ANALYTICS_FLUSH_ALARM);
  if (existing) return;
  await chrome.alarms.create(ANALYTICS_FLUSH_ALARM, { periodInMinutes: 1 });
}

async function recoverAnalyticsDelivery() {
  await ensureAnalyticsAlarm().catch(() => null);
  await chrome.storage.local.remove("analyticsFlushInProgress");
  await resumeAnalyticsDelivery();
}

async function resumeAnalyticsDelivery() {
  const stored = await chrome.storage.local.get([
    "analyticsQueue",
    "analyticsOptOut",
    "analyticsRetryAt",
  ]);
  const queue = Array.isArray(stored.analyticsQueue) ? stored.analyticsQueue : [];
  if (!queue.length || stored.analyticsOptOut) return;
  const delay = Math.max(0, Number(stored.analyticsRetryAt || 0) - Date.now());
  scheduleAnalyticsFlush(delay);
}

async function scheduleAnalyticsRetry(reason) {
  const stored = await chrome.storage.local.get("analyticsRetryCount");
  const previousCount = Math.max(0, Number(stored.analyticsRetryCount || 0));
  const retryCount = Math.min(previousCount + 1, ANALYTICS_RETRY_DELAYS_MS.length);
  const baseDelay = ANALYTICS_RETRY_DELAYS_MS[retryCount - 1];
  const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
  const retryAt = Date.now() + delay;
  await chrome.storage.local.set({
    analyticsRetryCount: retryCount,
    analyticsRetryAt: retryAt,
    analyticsLastError: String(reason || "unknown").slice(0, 160),
  });
  scheduleAnalyticsFlush(delay);
}

async function recordAnalyticsTransportError(stage, error) {
  await chrome.storage.local.set({
    analyticsLastError: `${stage}:${readableError(error)}`.slice(0, 160),
  });
}

async function getAnalyticsSettings() {
  const stored = await chrome.storage.local.get("analyticsOptOut");
  return { analyticsOptOut: Boolean(stored.analyticsOptOut) };
}

async function setAnalyticsOptOut(enabled) {
  if (enabled && analyticsFlushController) analyticsFlushController.abort();
  if (enabled && analyticsFlushTimer) {
    clearTimeout(analyticsFlushTimer);
    analyticsFlushTimer = null;
    analyticsFlushTimerDueAt = 0;
  }
  await mutateAnalyticsQueue(async () => {
    await chrome.storage.local.set({
      analyticsOptOut: Boolean(enabled),
      analyticsQueue: [],
      analyticsQueueLength: 0,
      analyticsRetryCount: 0,
      analyticsRetryAt: 0,
    });
  });
  await registerExternalLifecyclePages();
  if (!enabled) void recoverAnalyticsDelivery();
}

async function consumeAnalyticsDedupe(eventType, minutes) {
  const key = `analyticsDedupe:${eventType}`;
  const stored = await chrome.storage.local.get(key);
  const last = Number(stored[key] || 0);
  const now = Date.now();
  if (last && now - last < Number(minutes) * 60 * 1000) return false;
  await chrome.storage.local.set({ [key]: now });
  return true;
}

async function consumeLocalAnalyticsLimit(requestedCount = 1) {
  const now = Date.now();
  const hour = Math.floor(now / 3600000);
  const stored = await chrome.storage.local.get(["analyticsRateHour", "analyticsRateCount"]);
  const count = stored.analyticsRateHour === hour ? Number(stored.analyticsRateCount || 0) : 0;
  const available = Math.max(0, ANALYTICS_MAX_EVENTS_PER_HOUR - count);
  const reserved = Math.min(available, Math.max(1, Number(requestedCount) || 1));
  if (reserved <= 0) return 0;
  await chrome.storage.local.set({
    analyticsRateHour: hour,
    analyticsRateCount: count + reserved,
  });
  return reserved;
}

function sanitizeAnalyticsProperties(properties = {}) {
  const blocked = new Set([
    "email",
    "lat",
    "latitude",
    "lng",
    "lon",
    "longitude",
    "coordinates",
    "url",
    "checkout_url",
    "portal_url",
    "secret",
    "token",
    "code",
  ]);
  const clean = {};
  for (const [key, rawValue] of Object.entries(properties || {})) {
    const normalizedKey = String(key || "").replace(/[^a-zA-Z0-9_.-]+/g, "_").slice(0, 64);
    if (!normalizedKey || blocked.has(normalizedKey.toLowerCase())) continue;
    if (typeof rawValue === "boolean" || typeof rawValue === "number") {
      clean[normalizedKey] = rawValue;
    } else if (rawValue !== undefined && rawValue !== null) {
      clean[normalizedKey] = String(rawValue).slice(0, 160);
    }
  }
  return clean;
}

function usageProperties(usage = {}) {
  return {
    used: Number(usage.used || 0),
    limit: Number(usage.limit || FREE_STARTER_GUESS_LIMIT),
    remaining: Number.isFinite(Number(usage.remaining)) ? Number(usage.remaining) : -1,
    starter_used: Number(usage.starterUsed || 0),
    starter_remaining: Number(usage.starterRemaining || 0),
    daily_used: Number(usage.dailyUsed || 0),
    daily_remaining: Number(usage.dailyRemaining || 0),
    daily_unlocked: Boolean(usage.dailyUnlocked),
    free_mode: usage.freeMode || "",
    subscribed: Boolean(usage.subscribed),
    billing_status: usage.billingStatus || "",
  };
}

function featureProperties(settings = {}) {
  return {
    auto_place: settings.autoPlace !== false,
    auto_guess: settings.autoGuess === true,
    smart_zoom: settings.smartZoom !== false,
    range_enabled: settings.rangeEnabled !== false,
    score_min: Number(settings.scoreMin ?? DEFAULT_SETTINGS.scoreMin),
    score_max: Number(settings.scoreMax ?? DEFAULT_SETTINGS.scoreMax),
  };
}

function gameProperties(urlValue) {
  try {
    const url = new URL(urlValue);
    const game = [
      "geoguessr",
      "openguessr",
      "geotastic",
      "worldguessr",
      "freeguessr",
    ].find((candidate) => url.hostname.includes(candidate));
    return {
      game_host: url.hostname,
      game: game || "unknown",
    };
  } catch {
    return {};
  }
}

function analyticsErrorCode(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("free guesses")) return "free_limit";
  if (text.includes("coordinates")) return "coordinates_missing";
  if (text.includes("unsupported") || text.includes("not supported")) return "unsupported_page";
  if (text.includes("unavailable") || text.includes("failed to fetch")) return "network_unavailable";
  return "unknown";
}

function broadcast(message) {
  chrome.runtime.sendMessage(message, () => void chrome.runtime.lastError);
}

function isSupportedGameUrl(value) {
  try {
    const url = new URL(value);
    return new Set([
      "www.geoguessr.com",
      "openguessr.com",
      "www.openguessr.com",
      "geotastic.net",
      "www.geotastic.net",
      "worldguessr.com",
      "www.worldguessr.com",
      "freeguessr.com",
      "www.freeguessr.com",
    ]).has(url.hostname);
  } catch {
    return false;
  }
}

function isValidCoordinates(value) {
  const lat = Number(value?.lat ?? value?.latitude);
  const lng = Number(value?.lng ?? value?.lon ?? value?.longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function readableError(error) {
  const message = String(error?.message || error);
  if (message.includes("Free guesses used")) {
    return "Free guesses used for today. Upgrade to Pro for unlimited guesses.";
  }
  if (message.includes("Coordinates were not found")) {
    return "Coordinates were not found. Reload the game page and try again.";
  }
  if (message.includes("Cannot access contents")) {
    return "This page is not supported. Open a supported geography game.";
  }
  if (message.includes("Failed to fetch")) {
    return "Place name lookup is temporarily unavailable. Try again.";
  }
  return message;
}
