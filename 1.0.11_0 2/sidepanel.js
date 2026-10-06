const DEFAULT_HOTKEY = { code: "KeyG", label: "G" };
const PRIVACY_CONSENT_VERSION = 2;
const PAYWALL_EXPERIMENT_ID = "one_time_passes_v1";
const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/detail/geoguessr-boost/offeainbmjpcckfpnbibokgblikpbchp";
const DEFAULT_SETTINGS = {
  autoPlace: true,
  autoGuess: false,
  smartZoom: true,
  rangeEnabled: false,
  scoreMin: 3750,
  scoreMax: 4900,
};

const analyzeButton = document.querySelector("#analyzeButton");
const message = document.querySelector("#message");
const loading = document.querySelector("#loading");
const result = document.querySelector("#result");
const guessMap = document.querySelector("#guessMap");
const mapZoomInButton = document.querySelector("#mapZoomIn");
const mapZoomOutButton = document.querySelector("#mapZoomOut");
const shareGuessButton = document.querySelector("#shareGuessButton");
const shareGuessMessage = document.querySelector("#shareGuessMessage");
const hotkeyBadge = document.querySelector("#hotkeyBadge");
const hotkeyRecorder = document.querySelector("#hotkeyRecorder");
const languageSelect = document.querySelector("#languageSelect");
const usagePill = document.querySelector("#usagePill");
const limitBodyText = document.querySelector("#limitBodyText");
const autoPlaceToggle = document.querySelector("#autoPlaceToggle");
const autoGuessToggle = document.querySelector("#autoGuessToggle");
const smartZoomToggle = document.querySelector("#smartZoomToggle");
const rangeToggle = document.querySelector("#rangeToggle");
const analyticsOptOutToggle = document.querySelector("#analyticsOptOutToggle");
const darkThemeToggle = document.querySelector("#darkThemeToggle");
const rangeControls = document.querySelector("#rangeControls");
const scoreMinInput = document.querySelector("#scoreMinInput");
const scoreMaxInput = document.querySelector("#scoreMaxInput");
const proCard = document.querySelector(".pro-card");
const subscriptionPrompt = document.querySelector("#subscriptionPrompt");
const promoCodeInput = document.querySelector("#promoCodeInput");
const promoMessage = document.querySelector("#promoMessage");
const proEmailInput = document.querySelector("#proEmailInput");
const proMessage = document.querySelector("#proMessage");
const goProButton = document.querySelector("#startProCheckout");
const restoreCodeInput = document.querySelector("#restoreCodeInput");
const restoreCodeRow = document.querySelector("#restoreCodeRow");
const requestRestoreButton = document.querySelector("#requestRestore");
const confirmRestoreButton = document.querySelector("#confirmRestore");
const mainProEmailInput = document.querySelector("#mainProEmailInput");
const mainProMessage = document.querySelector("#mainProMessage");
const mainGoProButton = document.querySelector("#mainGoPro");
const mainProEmailLabel = document.querySelector("#mainProEmailLabel");
const promptProEmailLabel = document.querySelector("#promptProEmailLabel");
const mainRestoreDetected = document.querySelector("#mainRestoreDetected");
const promptRestoreDetected = document.querySelector("#promptRestoreDetected");
const mainCryptoPaymentLink = document.querySelector("#mainCryptoPaymentLink");
const promptCryptoPaymentLink = document.querySelector("#promptCryptoPaymentLink");
const mainCryptoRequestStatus = document.querySelector("#mainCryptoRequestStatus");
const promptCryptoRequestStatus = document.querySelector("#promptCryptoRequestStatus");
const cryptoPaymentPrompt = document.querySelector("#cryptoPaymentPrompt");
const cryptoPaymentFormState = document.querySelector("#cryptoPaymentFormState");
const cryptoPaymentSuccessState = document.querySelector("#cryptoPaymentSuccessState");
const cryptoPaymentForm = document.querySelector("#cryptoPaymentForm");
const cryptoPaymentEmail = document.querySelector("#cryptoPaymentEmail");
const cryptoPaymentPlan = document.querySelector("#cryptoPaymentPlan");
const cryptoPaymentCountry = document.querySelector("#cryptoPaymentCountry");
const cryptoPaymentCompany = document.querySelector("#cryptoPaymentCompany");
const cryptoPaymentMessage = document.querySelector("#cryptoPaymentMessage");
const submitCryptoPaymentRequestButton = document.querySelector("#submitCryptoPaymentRequest");
const cryptoPaymentRequestId = document.querySelector("#cryptoPaymentRequestId");
const cryptoSupportEmailLink = document.querySelector("#cryptoSupportEmailLink");
const cryptoSuccessSupportEmailLink = document.querySelector("#cryptoSuccessSupportEmailLink");
const mainRestoreCodeInput = document.querySelector("#mainRestoreCodeInput");
const mainRestoreCodeRow = document.querySelector("#mainRestoreCodeRow");
const mainRequestRestoreButton = document.querySelector("#mainRequestRestore");
const mainConfirmRestoreButton = document.querySelector("#mainConfirmRestore");
const refreshProStatusButton = document.querySelector("#refreshProStatus");
const refreshProStatusMainButton = document.querySelector("#refreshProStatusMain");
const billingSettings = document.querySelector("#billingSettings");
const manageSubscriptionButton = document.querySelector("#manageSubscription");
const manageSubscriptionMessage = document.querySelector("#manageSubscriptionMessage");
const discordInviteLink = document.querySelector("#discordInviteLink");
const affiliateCard = document.querySelector("#affiliateCard");
const affiliateCardLoading = document.querySelector("#affiliateCardLoading");
const affiliateEnrollState = document.querySelector("#affiliateEnrollState");
const affiliateVerifyState = document.querySelector("#affiliateVerifyState");
const affiliateShareState = document.querySelector("#affiliateShareState");
const affiliateEmailInput = document.querySelector("#affiliateEmailInput");
const affiliateVerificationInput = document.querySelector("#affiliateVerificationInput");
const affiliateRequestCodeButton = document.querySelector("#affiliateRequestCode");
const affiliateConfirmCodeButton = document.querySelector("#affiliateConfirmCode");
const affiliateResendCodeButton = document.querySelector("#affiliateResendCode");
const affiliateCode = document.querySelector("#affiliateCode");
const affiliateCopyCodeButton = document.querySelector("#affiliateCopyCode");
const affiliateShareGeoBoostButton = document.querySelector("#affiliateShareGeoBoost");
const affiliateViewStatsButton = document.querySelector("#affiliateViewStats");
const affiliateCardMessage = document.querySelector("#affiliateCardMessage");
const affiliateDashboard = document.querySelector("#affiliateDashboard");
const affiliateDashboardStatus = document.querySelector("#affiliateDashboardStatus");
const affiliateDashboardEnrollButton = document.querySelector("#affiliateDashboardEnroll");
const affiliateStats = document.querySelector("#affiliateStats");
const affiliateReferredUsers = document.querySelector("#affiliateReferredUsers");
const affiliatePayingReferrals = document.querySelector("#affiliatePayingReferrals");
const affiliatePendingAmount = document.querySelector("#affiliatePendingAmount");
const affiliateAvailableAmount = document.querySelector("#affiliateAvailableAmount");
const affiliateLifetimeEarned = document.querySelector("#affiliateLifetimeEarned");
const affiliatePaidAmount = document.querySelector("#affiliatePaidAmount");
const affiliateDashboardCodeRow = document.querySelector("#affiliateDashboardCodeRow");
const affiliateDashboardCode = document.querySelector("#affiliateDashboardCode");
const affiliateDashboardCopyCodeButton = document.querySelector("#affiliateDashboardCopyCode");
const affiliateDashboardShareButton = document.querySelector("#affiliateDashboardShare");
const affiliateCommissionExplanation = document.querySelector("#affiliateCommissionExplanation");
const affiliatePayoutSection = document.querySelector("#affiliatePayoutSection");
const affiliatePayoutMinimum = document.querySelector("#affiliatePayoutMinimum");
const affiliateOpenPayoutButton = document.querySelector("#affiliateOpenPayout");
const affiliatePayoutForm = document.querySelector("#affiliatePayoutForm");
const affiliatePayoutAsset = document.querySelector("#affiliatePayoutAsset");
const affiliatePayoutNetwork = document.querySelector("#affiliatePayoutNetwork");
const affiliateWalletInput = document.querySelector("#affiliateWalletInput");
const affiliatePayoutConfirm = document.querySelector("#affiliatePayoutConfirm");
const affiliateRequestPayoutButton = document.querySelector("#affiliateRequestPayout");
const affiliatePayoutMessage = document.querySelector("#affiliatePayoutMessage");
const affiliatePayoutHistory = document.querySelector("#affiliatePayoutHistory");
const onboardingInviteCode = document.querySelector("#onboardingInviteCode");
const onboardingApplyInviteButton = document.querySelector("#onboardingApplyInvite");
const onboardingInviteMessage = document.querySelector("#onboardingInviteMessage");
const selectedPlans = {
  main: "monthly",
  prompt: "monthly",
};

let onboardingStep = 0;
const ONBOARDING_FINAL_STEP = 1;
let recordingHotkey = false;
let currentHotkey = DEFAULT_HOTKEY;
let currentLanguage = "en";
let currentUsage = null;
let currentSettings = { ...DEFAULT_SETTINGS };
let currentCryptoPaymentRequest = null;
let currentResult = null;
let currentMapView = null;
let paywallTracked = false;
let currentPaywallVariant = "A";
let currentAffiliateStatus = null;
let affiliateVerificationPending = false;
let mainScrollBeforeAffiliateSettings = 0;

async function initialize() {
  document.querySelector("#privacyPolicyLink").href = "https://geoboost.win/privacy";
  const paywallExperiment = await sendMessage({ type: "paywall-experiment" }).catch(() => null);
  applyPaywallExperiment(paywallExperiment);
  const settings = await chrome.storage.local.get([
    "analysisHotkey",
    "onboardingComplete",
    "uiLanguage",
    "uiTheme",
    "privacyConsentVersion",
    "analyticsOptOut",
    "lastCryptoPaymentRequest",
    "cryptoPaymentEmail",
    "cryptoPaymentCountry",
    "affiliateEmail",
    "affiliateVerificationPending",
    "lastAffiliateStatus",
    ...Object.keys(DEFAULT_SETTINGS),
  ]).catch(() => ({}));
  currentHotkey = settings.analysisHotkey || DEFAULT_HOTKEY;
  currentLanguage = GEO_I18N[settings.uiLanguage] ? settings.uiLanguage : "en";
  languageSelect.value = currentLanguage;

  applyTranslations();
  renderNotice();
  renderHotkey();
  renderSettings(settings);
  renderAnalyticsSettings(settings);
  currentCryptoPaymentRequest = settings.lastCryptoPaymentRequest || null;
  renderCryptoPaymentRequest(currentCryptoPaymentRequest);
  if (settings.cryptoPaymentEmail) cryptoPaymentEmail.value = settings.cryptoPaymentEmail;
  if (settings.cryptoPaymentCountry) cryptoPaymentCountry.value = settings.cryptoPaymentCountry;
  if (settings.affiliateEmail) affiliateEmailInput.value = settings.affiliateEmail;
  affiliateVerificationPending = Boolean(settings.affiliateVerificationPending);
  currentAffiliateStatus = settings.lastAffiliateStatus || null;
  renderAffiliateStatus(currentAffiliateStatus);

  if (!settings.onboardingComplete) {
    showOnboarding();
  } else if (settings.privacyConsentVersion !== PRIVACY_CONSENT_VERSION) {
    showOnboarding();
    onboardingStep = ONBOARDING_FINAL_STEP;
    renderOnboardingStep();
  }

  document.body.classList.remove("booting");
  void hydrateRemoteState();
}

function applyPaywallExperiment(assignment) {
  currentPaywallVariant =
    assignment?.experiment === PAYWALL_EXPERIMENT_ID && assignment?.variant === "B"
      ? "B"
      : "A";
  document.documentElement.dataset.paywallVariant = currentPaywallVariant;
  document.querySelectorAll(".plan-variant-b-option").forEach((option) => {
    option.disabled = currentPaywallVariant !== "B";
    option.hidden = currentPaywallVariant !== "B";
  });
  selectPlan("main", currentPaywallVariant === "B" ? "weekly" : "monthly", false);
  selectPlan("prompt", currentPaywallVariant === "B" ? "weekly" : "monthly", false);
}

async function hydrateRemoteState() {
  const config = await fetch(chrome.runtime.getURL("config.json"))
    .then((response) => response.json())
    .catch(() => ({}));
  const websiteUrl = String(config.websiteUrl || "https://geoboost.win").replace(/\/+$/, "");
  document.querySelector("#privacyPolicyLink").href = `${websiteUrl}/privacy`;
  setDiscordInviteUrl(config.discordInviteUrl);
  void loadPublicConfig(websiteUrl).then((publicConfig) => {
    setDiscordInviteUrl(publicConfig.discord_invite_url);
  }).catch(() => null);

  void sendMessage({ type: "ensure-hotkey" }).catch(() => null);
  void refreshUsage().finally(() => {
    observePaywallVisibility();
    trackEvent("sidepanel_opened", currentUsage ? {
      subscribed: Boolean(currentUsage.subscribed),
      used: Number(currentUsage.used || 0),
    } : {}, { dedupe_minutes: 30 });
  });
  void refreshAffiliateStatus();
  void refreshCryptoPaymentRequestStatus();

  const session = await chrome.storage.session.get("lastAnalysis").catch(() => ({}));
  if (
    session.lastAnalysis?.result &&
    session.lastAnalysis.result.meta?.language === currentLanguage
  ) {
    renderResult(session.lastAnalysis.result);
  }
}

async function loadPublicConfig(websiteUrl) {
  const response = await fetch(`${websiteUrl}/api/public-config`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Public config HTTP ${response.status}`);
  return response.json();
}

function setDiscordInviteUrl(value) {
  const url = String(value || "").trim();
  if (!discordInviteLink || !isSafeDiscordUrl(url)) return;
  discordInviteLink.href = url;
}

function isSafeDiscordUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "discord.gg" ||
        (url.hostname === "discord.com" && url.pathname.startsWith("/invite/")))
    );
  } catch {
    return false;
  }
}

async function refreshUsage() {
  const response = await sendMessage({ type: "usage" }).catch(() => null);
  if (response?.ok) {
    currentUsage = response.usage;
    renderUsage(response.usage);
  }
}

function renderUsage(usage) {
  if (!usagePill || !usage) return;
  const subscribed = Boolean(usage.subscribed);
  const canManageBilling = subscribed && usage.billingSource === "stripe";
  const exhausted = !subscribed && !usage.canGuess;
  const analyzeLabel = analyzeButton.querySelector("span");
  proCard?.classList.toggle("hidden", subscribed);
  billingSettings?.classList.toggle("hidden", !canManageBilling);
  renderRestoreAvailability(usage);
  analyzeButton.disabled = exhausted;
  analyzeButton.classList.toggle("limit-reached", exhausted);
  if (analyzeLabel) analyzeLabel.textContent = exhausted ? t("limitButton") : t("analyze");
  hotkeyBadge?.classList.toggle("hidden", exhausted);
  if (subscribed) {
    subscriptionPrompt?.classList.add("hidden");
  }
  if (usage.subscribed) {
    usagePill.textContent = t("proActive");
    renderFeatureAccess(usage);
    return;
  }
  usagePill.textContent =
    usage.freeMode === "daily"
      ? t("freeUsageDaily", {
          remaining: usage.dailyRemaining ?? usage.remaining,
          limit: usage.dailyLimit ?? usage.limit,
        })
      : t("freeUsageStarter", {
          remaining: usage.starterRemaining ?? usage.remaining,
          limit: usage.starterLimit ?? usage.limit,
        });
  renderFeatureAccess(usage);
  if (exhausted) {
    if (result.classList.contains("hidden") && loading.classList.contains("hidden")) {
      showMessage(t("limitBody"));
    }
    showSubscriptionPrompt();
  }
}

function renderRestoreAvailability(usage) {
  const restoreAvailable = !usage?.subscribed && Boolean(usage?.restoreAvailable);
  if (limitBodyText) {
    limitBodyText.textContent = t(restoreAvailable ? "restoreLimitBody" : "limitBody");
  }
  const scopes = [
    {
      group: "main",
      notice: mainRestoreDetected,
      label: mainProEmailLabel,
      checkout: mainGoProButton,
      crypto: mainCryptoPaymentLink,
    },
    {
      group: "prompt",
      notice: promptRestoreDetected,
      label: promptProEmailLabel,
      checkout: goProButton,
      crypto: promptCryptoPaymentLink,
    },
  ];
  scopes.forEach(({ group, notice, label, checkout, crypto }) => {
    document
      .querySelector(`.plan-options[data-plan-group="${group}"]`)
      ?.classList.toggle("hidden", restoreAvailable);
    notice?.classList.toggle("hidden", !restoreAvailable);
    checkout?.classList.toggle("hidden", restoreAvailable);
    crypto?.classList.toggle("hidden", restoreAvailable);
    if (label) {
      label.textContent = t(restoreAvailable ? "restoreEmailLabel" : "paymentLabel");
      label.classList.toggle("hidden", group === "main" && !restoreAvailable);
    }
  });
}

async function triggerAnalysis() {
  const consent = await chrome.storage.local.get("privacyConsentVersion");
  if (consent.privacyConsentVersion !== PRIVACY_CONSENT_VERSION) {
    showOnboarding();
    onboardingStep = ONBOARDING_FINAL_STEP;
    renderOnboardingStep();
    return;
  }
  if (currentUsage && !currentUsage.canGuess) {
    trackEvent("free_limit_reached", {
      used: Number(currentUsage.used || 0),
      limit: Number(currentUsage.limit || 5),
    });
    showSubscriptionPrompt();
    return;
  }
  analyzeButton.disabled = true;
  showLoading();
  try {
    const response = await sendMessage({ type: "trigger-analysis" });
    if (!response.ok) {
      const text = localizeError(response.error);
      showMessage(text, true);
      if (isLimitError(response.error)) showSubscriptionPrompt();
    }
  } catch (error) {
    const text = localizeError(error.message);
    showMessage(text, true);
    if (isLimitError(error.message)) showSubscriptionPrompt();
  }
}

function renderResult(data) {
  if (data.meta?.language && data.meta.language !== currentLanguage) {
    analyzeButton.disabled = false;
    loading.classList.add("hidden");
    result.classList.add("hidden");
    renderNotice();
    message.classList.remove("hidden");
    return;
  }
  analyzeButton.disabled = false;
  currentResult = data;
  document.querySelector("#bestGuess").textContent = data.best_guess;
  document.querySelector("#confidence").textContent = t("foundBadge");
  renderOptionalText("#summary", data.meta?.mode === "coordinates" ? "" : data.summary);
  renderLocalClues(data.local_clues || data.localClues || []);
  renderMap(data);
  loading.classList.add("hidden");
  message.classList.add("hidden");
  result.classList.remove("hidden");
}

function renderOptionalText(selector, text) {
  const element = document.querySelector(selector);
  if (!String(text || "").trim()) {
    element.textContent = "";
    element.classList.add("hidden");
    return;
  }
  element.textContent = text;
  element.classList.remove("hidden");
}

function renderLocalClues(items = []) {
  const section = document.querySelector("#localCluesSection");
  const list = document.querySelector("#localClues");
  if (!items.length) {
    section.classList.add("hidden");
    list.innerHTML = "";
    return;
  }
  section.classList.remove("hidden");
  renderList("#localClues", items);
}

function renderMap(data) {
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  const span = Math.max(0.2, Math.min(120, Number(data.map_span_degrees) || 2));
  currentMapView = {
    latitude,
    longitude,
    zoom: zoomForMapSpan(span),
  };
  renderCurrentMapTiles();
  document.querySelector("#openMapLink").href =
    `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
}

function zoomForMapSpan(span) {
  if (span >= 80) return 2;
  if (span >= 40) return 3;
  if (span >= 20) return 4;
  if (span >= 10) return 5;
  if (span >= 5) return 6;
  if (span >= 2) return 7;
  if (span >= 1) return 8;
  return 10;
}

function clampMapZoom(zoom) {
  return Math.max(2, Math.min(18, Math.round(Number(zoom) || 2)));
}

function lonLatToWorld(latitude, longitude, zoom) {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const scale = 256 * (2 ** zoom);
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function renderMapTiles(latitude, longitude, zoom) {
  const canvas = document.querySelector("#guessMap");
  const tiles = document.querySelector("#guessMapTiles");
  zoom = clampMapZoom(zoom);
  const width = canvas.clientWidth || 340;
  const height = canvas.clientHeight || 220;
  const center = lonLatToWorld(latitude, longitude, zoom);
  const topLeft = {
    x: center.x - width / 2,
    y: center.y - height / 2,
  };
  const firstTileX = Math.floor(topLeft.x / 256);
  const firstTileY = Math.floor(topLeft.y / 256);
  const lastTileX = Math.floor((topLeft.x + width) / 256);
  const lastTileY = Math.floor((topLeft.y + height) / 256);
  const tileCount = 2 ** zoom;
  const fragment = document.createDocumentFragment();
  for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
      const left = Math.round(tileX * 256 - topLeft.x);
      const top = Math.round(tileY * 256 - topLeft.y);
      const image = document.createElement("img");
      image.className = "map-tile";
      image.alt = "";
      image.draggable = false;
      image.referrerPolicy = "no-referrer";
      image.src = `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`;
      image.style.left = `${left}px`;
      image.style.top = `${top}px`;
      fragment.append(image);
    }
  }
  tiles.replaceChildren(fragment);
}

function renderCurrentMapTiles() {
  if (!currentMapView) return;
  renderMapTiles(currentMapView.latitude, currentMapView.longitude, currentMapView.zoom);
}

function changeMapZoom(delta) {
  if (!currentMapView) return;
  const nextZoom = clampMapZoom(currentMapView.zoom + delta);
  if (nextZoom === currentMapView.zoom) return;
  currentMapView = { ...currentMapView, zoom: nextZoom };
  renderCurrentMapTiles();
}

function startHotkeyRecording() {
  recordingHotkey = true;
  hotkeyRecorder.classList.add("recording");
  hotkeyRecorder.innerHTML = `<span>${escapeHtml(t("pressKey"))}</span>`;
}

async function recordHotkey(event) {
  if (!recordingHotkey) return;
  event.preventDefault();
  event.stopPropagation();
  if (isModifierKey(event.key)) return;
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
    hotkeyRecorder.innerHTML = `<span>${escapeHtml(t("oneKey"))}</span>`;
    return;
  }
  if (event.key === "Escape") {
    stopHotkeyRecording();
    return;
  }

  currentHotkey = { code: event.code, label: hotkeyLabel(event) };
  await chrome.storage.local.set({ analysisHotkey: currentHotkey });
  trackEvent("setting_changed", { setting: "analysisHotkey" });
  stopHotkeyRecording();
  renderHotkey();
}

function handlePanelHotkey(event) {
  if (
    recordingHotkey ||
    event.repeat ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.shiftKey ||
    event.code !== currentHotkey.code ||
    isTypingTarget(event.target)
  ) {
    return;
  }
  event.preventDefault();
  triggerAnalysis();
}

function stopHotkeyRecording() {
  recordingHotkey = false;
  hotkeyRecorder.classList.remove("recording");
  renderRecorder();
}

function renderHotkey() {
  hotkeyBadge.textContent = currentHotkey.label;
  renderRecorder();
  const action = message.querySelector(".notice-action");
  if (action) {
    action.innerHTML =
      formatHtml(t("frameAction", { hotkey: "__KEY__" }), currentHotkey.label);
  }
  document.querySelector("#guide3Title").textContent =
    t("guide3Title", { hotkey: currentHotkey.label });
}

function renderNotice() {
  message.classList.remove("error");
  message.innerHTML = `
    <strong>${escapeHtml(t("frameTitle"))}</strong>
    <span>${escapeHtml(t("frameBody"))}</span>
    <span class="notice-action"></span>
  `;
}

function renderRecorder() {
  hotkeyRecorder.innerHTML =
    `<span>${escapeHtml(t("currentKey"))}</span><kbd>${escapeHtml(currentHotkey.label)}</kbd>`;
}

function renderSettings(settings = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  currentSettings = merged;
  autoPlaceToggle.checked = currentSettings.autoPlace !== false;
  autoGuessToggle.checked = currentSettings.autoGuess === true;
  smartZoomToggle.checked = currentSettings.smartZoom !== false;
  rangeToggle.checked = currentSettings.rangeEnabled === true;
  scoreMinInput.value = String(merged.scoreMin ?? DEFAULT_SETTINGS.scoreMin);
  scoreMaxInput.value = String(merged.scoreMax ?? DEFAULT_SETTINGS.scoreMax);
  if (darkThemeToggle) darkThemeToggle.checked = settings.uiTheme === "dark";
  applyTheme(settings.uiTheme);
  renderFeatureAccess(currentUsage);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
}

function renderAnalyticsSettings(settings = {}) {
  if (!analyticsOptOutToggle) return;
  analyticsOptOutToggle.checked = Boolean(settings.analyticsOptOut);
}

async function saveBooleanSetting(key, value) {
  currentSettings[key] = Boolean(value);
  await chrome.storage.local.set({ [key]: value });
  trackEvent("setting_changed", { setting: key, enabled: Boolean(value) });
}

async function saveScoreSettings() {
  const scoreMin = clampScore(scoreMinInput.value);
  const scoreMax = clampScore(scoreMaxInput.value);
  scoreMinInput.value = String(scoreMin);
  scoreMaxInput.value = String(scoreMax);
  currentSettings.scoreMin = scoreMin;
  currentSettings.scoreMax = scoreMax;
  await chrome.storage.local.set({ scoreMin, scoreMax });
  trackEvent("setting_changed", {
    setting: "scoreRange",
    score_min: scoreMin,
    score_max: scoreMax,
  });
}

function syncRangeControls() {
  rangeControls.classList.toggle("hidden", !rangeToggle.checked);
}

function renderFeatureAccess(usage = currentUsage) {
  autoPlaceToggle.disabled = false;
  autoGuessToggle.disabled = autoPlaceToggle.checked === false;
  smartZoomToggle.disabled = false;
  rangeToggle.disabled = false;
  scoreMinInput.disabled = !rangeToggle.checked;
  scoreMaxInput.disabled = !rangeToggle.checked;
  autoGuessToggle.checked = currentSettings.autoGuess === true;
  smartZoomToggle.checked = currentSettings.smartZoom !== false;
  rangeToggle.checked = currentSettings.rangeEnabled === true;
  syncRangeControls();
  const autoGuessTitle = autoGuessToggle.disabled ? t("autoGuessRequiresAutoPlace") : "";
  [autoGuessToggle, autoGuessToggle.closest("label")].forEach((element) => {
    if (!element) return;
    if (autoGuessTitle) element.setAttribute("title", autoGuessTitle);
    else element.removeAttribute("title");
  });
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 5000;
  return Math.max(0, Math.min(5000, Math.round(number)));
}

function hotkeyLabel(event) {
  if (event.code === "Space") return "Space";
  if (event.key.length === 1) return event.key.toUpperCase();
  return event.key;
}

function isModifierKey(key) {
  return ["Alt", "Control", "Meta", "Shift", "AltGraph"].includes(key);
}

function isTypingTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='textbox']",
    ),
  );
}

function showOnboarding() {
  onboardingStep = 0;
  document.querySelector("#onboarding").classList.remove("hidden");
  renderOnboardingStep();
}

function renderOnboardingStep() {
  document.querySelectorAll(".onboarding-step").forEach((element) => {
    element.classList.toggle(
      "hidden",
      Number(element.dataset.step) !== onboardingStep,
    );
  });
  document.querySelectorAll(".onboarding-progress span").forEach((element, index) => {
    element.classList.toggle("active", index === onboardingStep);
  });
  document.querySelector("#nextOnboarding").textContent =
    onboardingStep === ONBOARDING_FINAL_STEP ? t("start") : t("next");
  document.querySelector("#nextOnboarding").disabled =
    onboardingStep === ONBOARDING_FINAL_STEP && !document.querySelector("#privacyConsent").checked;
}

async function finishOnboarding() {
  if (!document.querySelector("#privacyConsent").checked) return;
  await chrome.storage.local.set({
    onboardingComplete: true,
    privacyConsentVersion: PRIVACY_CONSENT_VERSION,
  });
  document.querySelector("#onboarding").classList.add("hidden");
  trackEvent("onboarding_completed", {});
  if (currentUsage && !currentUsage.subscribed && !currentUsage.canGuess) {
    showSubscriptionPrompt();
  }
}

function renderList(selector, items = [], formatter = escapeHtml) {
  document.querySelector(selector).innerHTML = items
    .map((item) => `<li>${formatter(item)}</li>`)
    .join("");
}

function showLoading() {
  message.classList.add("hidden");
  result.classList.add("hidden");
  loading.classList.remove("hidden");
}

function showMessage(text, isError = false) {
  analyzeButton.disabled = Boolean(currentUsage && !currentUsage.subscribed && !currentUsage.canGuess);
  loading.classList.add("hidden");
  result.classList.add("hidden");
  message.textContent = text;
  message.classList.toggle("error", isError);
  message.classList.remove("hidden");
}

function showSubscriptionPrompt() {
  if (!document.querySelector("#onboarding").classList.contains("hidden")) return;
  promoMessage.classList.add("hidden");
  promoMessage.classList.remove("error");
  promoMessage.textContent = "";
  proMessage.classList.add("hidden");
  proMessage.classList.remove("error");
  proMessage.textContent = "";
  subscriptionPrompt.classList.remove("hidden");
  trackPaywallView("limit_prompt");
}

function trackPaywallView(surface) {
  if (paywallTracked) return;
  paywallTracked = true;
  trackEvent("paywall_viewed", {
    surface,
    used: Number(currentUsage?.used || 0),
    limit: Number(currentUsage?.limit || 5),
  });
}

function observePaywallVisibility() {
  if (!proCard || typeof IntersectionObserver !== "function") return;
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
    observer.disconnect();
    trackPaywallView("main_card");
  }, { threshold: 0.5 });
  observer.observe(proCard);
}

async function refreshAffiliateStatus() {
  const response = await sendMessage({ type: "affiliate-status" }).catch(() => null);
  if (!response?.ok) {
    affiliateCardLoading?.classList.add("hidden");
    affiliateEnrollState?.classList.remove("hidden");
    setAffiliateMessage(response?.error || t("affiliateLoadError"), true);
    return null;
  }
  currentAffiliateStatus = response;
  if (response.enrolled && affiliateVerificationPending) {
    affiliateVerificationPending = false;
    void chrome.storage.local.set({ affiliateVerificationPending: false });
  }
  renderAffiliateStatus(response);
  return response;
}

function renderAffiliateStatus(status) {
  const loaded = Boolean(status);
  const enrolled = Boolean(status?.enrolled);
  affiliateCardLoading?.classList.toggle("hidden", loaded);
  affiliateEnrollState?.classList.toggle("hidden", !loaded || enrolled || affiliateVerificationPending);
  affiliateVerifyState?.classList.toggle("hidden", !affiliateVerificationPending || enrolled);
  affiliateShareState?.classList.toggle("hidden", !enrolled);
  if (!loaded) {
    affiliateDashboardStatus.textContent = t("affiliateLoading");
    return;
  }
  if (!enrolled) {
    affiliateDashboardStatus.textContent = t("affiliateEnrollBody");
    affiliateDashboardEnrollButton.classList.remove("hidden");
    affiliateStats.classList.add("hidden");
    affiliateDashboardCodeRow.classList.add("hidden");
    affiliateCommissionExplanation.classList.add("hidden");
    affiliatePayoutSection.classList.add("hidden");
    if (status.verified_email && !affiliateEmailInput.value) {
      affiliateEmailInput.value = status.verified_email;
    }
    return;
  }
  affiliateVerificationPending = false;
  affiliateDashboardEnrollButton.classList.add("hidden");
  affiliateCode.textContent = status.code || "";
  affiliateDashboardCode.textContent = status.code || "";
  affiliateDashboardStatus.textContent =
    status.status === "suspended"
      ? t("affiliateSuspended")
      : t("affiliateRateStatus", {
          rate: Math.round(Number(status.commission_rate_bps || 0) / 100),
        });
  affiliateStats.classList.remove("hidden");
  affiliateDashboardCodeRow.classList.remove("hidden");
  affiliateCommissionExplanation.classList.remove("hidden");
  affiliatePayoutSection.classList.remove("hidden");
  affiliateReferredUsers.textContent = String(Number(status.referred_users || 0));
  affiliatePayingReferrals.textContent = String(Number(status.paying_referrals || 0));
  affiliatePendingAmount.textContent = formatMoney(status.pending_cents);
  affiliateAvailableAmount.textContent = formatMoney(status.available_cents);
  affiliateLifetimeEarned.textContent = formatMoney(status.total_earned_cents);
  affiliatePaidAmount.textContent = formatMoney(status.paid_cents);
  const minimum = Number(status.minimum_payout_cents || 2500);
  const available = Number(status.available_cents || 0);
  affiliatePayoutMinimum.textContent = available < minimum
    ? t("affiliateNeedMore", {
        remaining: formatMoney(Math.max(0, minimum - available)),
      })
    : t("affiliateMinimumBody", {
        minimum: formatMoney(minimum),
      });
  renderAffiliatePayoutOptions(status.payout_options || []);
  renderAffiliatePayoutHistory(status.payouts || []);
  affiliateShareGeoBoostButton.disabled = status.status !== "active";
  affiliateDashboardShareButton.disabled = status.status !== "active";
  affiliateOpenPayoutButton.disabled =
    status.status !== "active" || available < minimum;
  if (affiliateOpenPayoutButton.disabled) {
    affiliatePayoutForm.classList.add("hidden");
  }
  updateAffiliatePayoutButton();
}

function formatMoney(cents) {
  return new Intl.NumberFormat(currentLanguage, {
    style: "currency",
    currency: "USD",
  }).format(Number(cents || 0) / 100);
}

function setAffiliateMessage(text, error = false) {
  affiliateCardMessage.textContent = text || "";
  affiliateCardMessage.classList.toggle("error", error);
  affiliateCardMessage.classList.toggle("hidden", !text);
}

async function requestAffiliateVerification() {
  const email = affiliateEmailInput.value.trim();
  if (!affiliateEmailInput.checkValidity() || !email) {
    setAffiliateMessage(t("affiliateEnterEmail"), true);
    return;
  }
  affiliateRequestCodeButton.disabled = true;
  affiliateResendCodeButton.disabled = true;
  setAffiliateMessage("");
  try {
    const response = await sendMessage({
      type: "request-referral-email-code",
      email,
    });
    if (!response?.ok) throw new Error(response?.error || "Could not send verification code.");
    await chrome.storage.local.set({
      affiliateEmail: email,
      affiliateVerificationPending: true,
    });
    affiliateVerificationPending = true;
    renderAffiliateStatus(currentAffiliateStatus || {});
    affiliateVerificationInput.focus();
    setAffiliateMessage(t("affiliateCodeSent"));
  } catch (error) {
    setAffiliateMessage(error.message, true);
  } finally {
    affiliateRequestCodeButton.disabled = false;
    affiliateResendCodeButton.disabled = false;
  }
}

async function confirmAffiliateEnrollment() {
  const email = affiliateEmailInput.value.trim();
  const code = affiliateVerificationInput.value.trim();
  affiliateConfirmCodeButton.disabled = true;
  setAffiliateMessage("");
  try {
    const response = await sendMessage({
      type: "affiliate-enroll",
      email,
      code,
    });
    if (!response?.ok || !response.enrolled) {
      throw new Error(response?.error || "Could not activate affiliate account.");
    }
    currentAffiliateStatus = response;
    await chrome.storage.local.set({
      affiliateEmail: email,
      affiliateVerificationPending: false,
      lastAffiliateStatus: response,
    });
    renderAffiliateStatus(response);
  } catch (error) {
    setAffiliateMessage(error.message, true);
  } finally {
    affiliateConfirmCodeButton.disabled = false;
  }
}

function affiliateInviteText(code = currentAffiliateStatus?.code) {
  return [
    "GeoBoost reveals exact GeoGuessr locations and can place the pin automatically.",
    `Install GeoBoost: ${CHROME_WEB_STORE_URL}`,
    `Invite code: ${code} — enter it when you first open the extension.`,
  ].join("\n");
}

async function copyAffiliateCode(source = "card") {
  const code = currentAffiliateStatus?.code;
  if (!code) return;
  await navigator.clipboard.writeText(code);
  setAffiliateMessage(t("affiliateCodeCopied"));
  trackEvent("affiliate_code_copied", { source });
}

function openAffiliateStats() {
  mainScrollBeforeAffiliateSettings = window.scrollY;
  document.querySelector("#settingsPanel").classList.remove("hidden");
  requestAnimationFrame(() => {
    affiliateDashboard.scrollIntoView({ behavior: "smooth", block: "start" });
    affiliateDashboard.setAttribute("tabindex", "-1");
    affiliateDashboard.focus({ preventScroll: true });
  });
}

function openAffiliateEnrollment() {
  document.querySelector("#settingsPanel").classList.add("hidden");
  affiliateCard.scrollIntoView({ behavior: "smooth", block: "center" });
  affiliateEmailInput.focus({ preventScroll: true });
}

function affiliateCanShare() {
  if (!currentAffiliateStatus?.enrolled || !currentAffiliateStatus?.code) return false;
  if (currentAffiliateStatus.status === "suspended") {
    setAffiliateMessage(t("affiliateSuspended"), true);
    return false;
  }
  return true;
}

async function shareAffiliateGeoBoost() {
  if (!affiliateCanShare()) return;
  if (currentResult) {
    await shareCurrentGuess();
    return;
  }
  try {
    await navigator.clipboard.writeText(affiliateInviteText());
    setAffiliateMessage(t("affiliateInviteCopied"));
    trackEvent("affiliate_share_created", { format: "text_no_result" });
  } catch {
    setAffiliateMessage(t("shareCopyError"), true);
    trackEvent("affiliate_share_failed", { reason: "clipboard" });
  }
}

function renderAffiliatePayoutOptions(options) {
  const previousAsset = affiliatePayoutAsset.value;
  const previousNetwork = affiliatePayoutNetwork.value;
  const assets = [...new Set(options.map((item) => item.asset))];
  affiliatePayoutAsset.replaceChildren(
    ...assets.map((asset) => new Option(asset, asset, false, asset === previousAsset)),
  );
  const networks = options
    .filter((item) => item.asset === affiliatePayoutAsset.value)
    .map((item) => item.network);
  affiliatePayoutNetwork.replaceChildren(
    ...networks.map(
      (network) =>
        new Option(
          affiliatePayoutNetworkLabel(network),
          network,
          false,
          network === previousNetwork,
        ),
    ),
  );
  updateAffiliateWalletPlaceholder();
}

function affiliatePayoutNetworkLabel(network) {
  const key = {
    ETHEREUM: "affiliateNetworkEthereum",
    TRON: "affiliateNetworkTron",
    SOLANA: "affiliateNetworkSolana",
  }[network];
  return key ? t(key) : network;
}

function updateAffiliateWalletPlaceholder() {
  affiliateWalletInput.placeholder = {
    ETHEREUM: "0x…",
    TRON: "T…",
    SOLANA: "Base58",
  }[affiliatePayoutNetwork.value] || "";
}

function renderAffiliatePayoutHistory(payouts) {
  affiliatePayoutHistory.replaceChildren(
    ...payouts.slice(0, 8).map((payout) => {
      const row = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      const detail = document.createElement("small");
      const statusKey = `affiliateStatus${String(payout.status || "requested")
        .replace(/^./, (character) => character.toUpperCase())}`;
      label.textContent = `${payout.asset || ""} ${affiliatePayoutNetworkLabel(payout.network)} · ${t(statusKey)}`;
      value.textContent = formatMoney(payout.amount_cents);
      const requested = formatAffiliateDate(payout.requested_at);
      const paid = payout.paid_at ? ` · ${t("affiliatePaidDate")} ${formatAffiliateDate(payout.paid_at)}` : "";
      const wallet = payout.wallet_hint ? ` · ${payout.wallet_hint}` : "";
      const transaction = payout.transaction_hash
        ? ` · ${t("affiliateTransaction")} ${payout.transaction_hash}`
        : "";
      detail.textContent = `${t("affiliateRequestedDate")} ${requested}${paid}${wallet}${transaction}`;
      row.append(label, value, detail);
      return row;
    }),
  );
}

function formatAffiliateDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(currentLanguage, { dateStyle: "medium" }).format(date);
}

function updateAffiliatePayoutButton() {
  const status = currentAffiliateStatus || {};
  affiliateRequestPayoutButton.disabled =
    status.status !== "active" ||
    Number(status.available_cents || 0) < Number(status.minimum_payout_cents || 2500) ||
    !affiliatePayoutConfirm.checked ||
    !affiliateWalletInput.value.trim() ||
    !affiliatePayoutAsset.value ||
    !affiliatePayoutNetwork.value;
}

async function requestAffiliatePayout() {
  if (!affiliatePayoutConfirm.checked) {
    affiliatePayoutMessage.textContent = t("affiliateConfirmRequired");
    affiliatePayoutMessage.classList.add("error");
    affiliatePayoutMessage.classList.remove("hidden");
    return;
  }
  affiliatePayoutMessage.classList.add("hidden");
  affiliateRequestPayoutButton.disabled = true;
  try {
    const response = await sendMessage({
      type: "affiliate-payout-request",
      asset: affiliatePayoutAsset.value,
      network: affiliatePayoutNetwork.value,
      wallet_address: affiliateWalletInput.value.trim(),
    });
    if (!response?.ok) throw new Error(response?.error || "Could not request payout.");
    affiliatePayoutMessage.textContent = t("affiliatePayoutReceived");
    affiliatePayoutMessage.classList.remove("error", "hidden");
    affiliateWalletInput.value = "";
    affiliatePayoutConfirm.checked = false;
    affiliatePayoutForm.classList.add("hidden");
    await refreshAffiliateStatus();
  } catch (error) {
    affiliatePayoutMessage.textContent = error.message;
    affiliatePayoutMessage.classList.add("error");
    affiliatePayoutMessage.classList.remove("hidden");
  } finally {
    updateAffiliatePayoutButton();
  }
}

async function applyOnboardingInvite() {
  const code = onboardingInviteCode.value.trim();
  onboardingInviteMessage.classList.add("hidden");
  if (!code) return;
  onboardingApplyInviteButton.disabled = true;
  try {
    trackEvent("referral_code_submitted", {});
    const response = await sendMessage({ type: "apply-referral-code", code });
    if (!response?.ok) throw new Error(response?.error || "Could not apply invite code.");
    onboardingInviteMessage.textContent = t("onboardingInviteApplied");
    onboardingInviteMessage.classList.remove("error", "hidden");
    onboardingInviteCode.disabled = true;
    onboardingApplyInviteButton.disabled = true;
    trackEvent("referral_code_applied", {});
  } catch (error) {
    onboardingInviteMessage.textContent = error.message;
    onboardingInviteMessage.classList.add("error");
    onboardingInviteMessage.classList.remove("hidden");
    onboardingApplyInviteButton.disabled = false;
  }
}

async function shareCurrentGuess() {
  if (!currentResult || !shareGuessButton || !shareGuessMessage) return;
  shareGuessMessage.classList.add("hidden");
  shareGuessMessage.classList.remove("error");
  shareGuessButton.disabled = true;
  try {
    const affiliate = currentAffiliateStatus?.enrolled
      ? currentAffiliateStatus
      : await refreshAffiliateStatus();
    if (!affiliate?.enrolled || !affiliate.code) {
      affiliateCard.scrollIntoView({ behavior: "smooth", block: "center" });
      affiliateEmailInput.focus({ preventScroll: true });
      setAffiliateMessage(t("affiliateShareVerify"));
      return;
    }
    if (affiliate.status !== "active") {
      setAffiliateMessage(t("affiliateSuspended"), true);
      return;
    }
    const text = buildShareText(currentResult, affiliate.code);
    const blob = await createShareImageBlob(currentResult, affiliate.code);
    if (blob && navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      shareGuessMessage.textContent = t("shareImageCopied");
      trackEvent("share_guess_copied", {
        format: "image",
      });
      trackEvent("affiliate_share_created", { format: "image" });
    } else {
      await navigator.clipboard.writeText(text);
      shareGuessMessage.textContent = t("shareTextCopied");
      trackEvent("share_guess_copied", {
        format: "text",
      });
      trackEvent("affiliate_share_created", { format: "text" });
    }
    shareGuessMessage.classList.remove("hidden");
  } catch {
    try {
      await navigator.clipboard.writeText(
        buildShareText(currentResult, currentAffiliateStatus?.code),
      );
      shareGuessMessage.textContent = t("shareTextCopied");
      shareGuessMessage.classList.remove("hidden");
      trackEvent("share_guess_copied", {
        format: "text_fallback",
      });
      trackEvent("affiliate_share_created", { format: "text_fallback" });
    } catch {
      shareGuessMessage.textContent = t("shareCopyError");
      shareGuessMessage.classList.add("error");
      shareGuessMessage.classList.remove("hidden");
      trackEvent("share_guess_failed", {});
      trackEvent("affiliate_share_failed", { reason: "clipboard" });
    }
  } finally {
    shareGuessButton.disabled = false;
  }
}

function buildShareText(data, affiliateCode) {
  const place = sharePlace(data);
  const lines = [
    `GeoBoost found this GeoGuessr round instantly: ${place}.`,
    `Install GeoBoost: ${CHROME_WEB_STORE_URL}`,
  ];
  if (affiliateCode) {
    lines.push(`Invite code: ${affiliateCode} — enter it when you first open the extension.`);
  }
  return lines.join("\n");
}

async function createShareImageBlob(data, affiliateCode) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  await drawShareCard(ctx, canvas, data, affiliateCode);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.94);
  });
}

async function drawShareCard(ctx, canvas, data, affiliateCode) {
  const width = canvas.width;
  const height = canvas.height;
  const place = sharePlace(data);

  ctx.fillStyle = "#f5f5ef";
  ctx.fillRect(0, 0, width, height);
  drawSoftShape(ctx, 760, 45, 290, 220, "#b4f637", 0.55);
  drawSoftShape(ctx, -80, 780, 390, 250, "#d9ead0", 0.9);

  roundRect(ctx, 72, 72, 936, 936, 36);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#dfe7dc";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#111713";
  ctx.font = "800 42px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("GeoBoost", 128, 146);
  ctx.fillStyle = "#5d6861";
  ctx.font = "700 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("FOUND IN SECONDS", 128, 184);

  drawPinLogo(ctx, 812, 118, 58);

  ctx.fillStyle = "#6f9d28";
  ctx.font = "900 22px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("ROUND LOCATION", 128, 272);
  ctx.fillStyle = "#111713";
  ctx.font = "850 58px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  wrapCanvasText(ctx, place, 128, 342, 824, 64, 3);

  await drawShareMap(ctx, 128, 520, 824, 250, data);

  ctx.fillStyle = "#111713";
  ctx.font = "800 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("Exact location. One key. Auto Place.", 128, 816);

  if (affiliateCode) {
    ctx.fillStyle = "#6f9d28";
    ctx.font = "900 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillText("INVITE CODE", 128, 854);
    ctx.fillStyle = "#111713";
    ctx.font = "900 28px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillText(String(affiliateCode), 128, 886);
  }

  roundRect(ctx, 128, 910, 824, 76, 18);
  ctx.fillStyle = "#111713";
  ctx.fill();
  ctx.fillStyle = "#b4f637";
  ctx.font = "900 31px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("geoboost.win", 156, 942);
  ctx.fillStyle = "#ffffff";
  ctx.font = "750 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(
    affiliateCode
      ? "Install from Chrome Web Store. Enter the code on first launch."
      : "Install GeoBoost and press G in a supported round.",
    156,
    970,
  );
}

async function drawShareMap(ctx, x, y, width, height, data) {
  roundRect(ctx, x, y, width, height, 26);
  ctx.fillStyle = "#e8eee5";
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, width, height, 26);
  ctx.clip();

  const lat = Number(data.latitude);
  const lng = Number(data.longitude);
  const mapLoaded = Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    await drawOpenStreetMapTiles(
      ctx,
      x,
      y,
      width,
      height,
      lat,
      lng,
      data.map_span_degrees,
    );
  if (!mapLoaded) {
    ctx.fillStyle = "#e8eee5";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "#5d6861";
    ctx.font = "750 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Map preview unavailable", x + width / 2, y + height / 2);
    ctx.textAlign = "start";
  }
  drawMapPin(ctx, x + width / 2, y + height / 2 - 22);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillRect(x, y + height - 28, width, 28);
  ctx.fillStyle = "#435048";
  ctx.font = "600 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("© OpenStreetMap contributors", x + 14, y + height - 9);
  ctx.restore();
}

async function drawOpenStreetMapTiles(
  ctx,
  x,
  y,
  width,
  height,
  latitude,
  longitude,
  mapSpanDegrees,
) {
  const zoom = clampMapZoom(
    zoomForMapSpan(Number(mapSpanDegrees) || 2),
  );
  const center = lonLatToWorld(latitude, longitude, zoom);
  const topLeftX = center.x - width / 2;
  const topLeftY = center.y - height / 2;
  const firstTileX = Math.floor(topLeftX / 256);
  const firstTileY = Math.floor(topLeftY / 256);
  const lastTileX = Math.floor((topLeftX + width) / 256);
  const lastTileY = Math.floor((topLeftY + height) / 256);
  const tileCount = 2 ** zoom;
  const requests = [];

  for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
      requests.push({
        left: x + Math.round(tileX * 256 - topLeftX),
        top: y + Math.round(tileY * 256 - topLeftY),
        image: loadShareMapTile(
          `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
        ),
      });
    }
  }

  const images = await Promise.all(requests.map(async (request) => ({
    ...request,
    image: await request.image,
  })));
  let drawn = 0;
  for (const tile of images) {
    if (!tile.image) continue;
    ctx.drawImage(tile.image, tile.left, tile.top, 256, 256);
    drawn += 1;
  }
  return drawn > 0;
}

function loadShareMapTile(url) {
  return new Promise((resolve) => {
    const image = new Image();
    const timeout = setTimeout(() => resolve(null), 3500);
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => {
      clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    image.src = url;
  });
}

function drawMetric(ctx, x, y, label, value) {
  ctx.fillStyle = "#748078";
  ctx.font = "800 20px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.fillStyle = "#111713";
  ctx.font = "900 42px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(value, x, y + 54);
}

function drawMapPin(ctx, x, y) {
  ctx.fillStyle = "#111713";
  ctx.beginPath();
  ctx.arc(x, y, 42, Math.PI * 0.85, Math.PI * 2.15);
  ctx.lineTo(x, y + 72);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#b4f637";
  ctx.beginPath();
  ctx.arc(x, y, 19, 0, Math.PI * 2);
  ctx.fill();
}

function drawPinLogo(ctx, x, y, size) {
  ctx.fillStyle = "#b4f637";
  roundRect(ctx, x - size, y - size, size * 2, size * 2, 26);
  ctx.fill();
  drawMapPin(ctx, x, y - 4);
}

function drawSoftShape(ctx, x, y, width, height, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let lineCount = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lineCount += 1;
      ctx.fillText(lineCount === maxLines ? `${line}...` : line, x, y);
      if (lineCount >= maxLines) return;
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line && lineCount < maxLines) ctx.fillText(line, x, y);
}

function sharePlace(data) {
  return String(data.best_guess || data.summary || "this round").trim();
}

function shareScoreLabel(data) {
  const placement = data.meta?.placement || {};
  if (placement.range_enabled) {
    const min = Number(placement.score_min || 0);
    const max = Number(placement.score_max || 5000);
    if (min && max && min !== max) return `${Math.round(min)}-${Math.round(max)}`;
  }
  return "5,000";
}

function shareDistanceLabel(data) {
  const placement = data.meta?.placement || {};
  if (!placement.range_enabled) return "Exact";
  const max = Number(placement.radius_max_km);
  if (!Number.isFinite(max) || max <= 0) return "Exact";
  return `~${Math.round(max * 10) / 10} km`;
}

async function startProCheckout({
  input = proEmailInput,
  message = proMessage,
  button = goProButton,
  planGroup = "prompt",
} = {}) {
  const email = input.value.trim();
  const plan = selectedPlans[planGroup] || "monthly";
  message.classList.add("hidden");
  message.classList.remove("error");
  button.disabled = true;
  try {
    const response = await sendMessage({
      type: "start-checkout",
      email,
      plan,
      source: planGroup,
    });
    if (response.restoreRequired) {
      currentUsage = { ...(currentUsage || {}), restoreAvailable: true, subscribed: false };
      renderRestoreAvailability(currentUsage);
      message.textContent = t("restoreDetectedBody");
      message.classList.remove("hidden");
      return;
    }
    if (!response.ok) {
      throw new Error(response.error || t("paymentError"));
    }
    message.textContent = t("paymentStarted");
    message.classList.remove("hidden");
  } catch (error) {
    message.textContent = error.message || t("paymentError");
    message.classList.add("error");
    message.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
}

function selectPlan(group, plan, shouldTrack = true) {
  selectedPlans[group] = ["daily", "weekly", "monthly", "annual"].includes(plan) ? plan : "monthly";
  document.querySelectorAll(`.plan-options[data-plan-group="${group}"] .plan-option`).forEach((button) => {
    const selected = button.dataset.plan === selectedPlans[group];
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  updateCheckoutButton(group);
  if (shouldTrack) {
    trackEvent("plan_selected", {
      plan: selectedPlans[group],
      source: group,
    });
  }
}

function updateCheckoutButton(group) {
  const button = group === "main" ? mainGoProButton : goProButton;
  if (!button) return;
  const plan = selectedPlans[group];
  button.textContent = plan === "weekly"
    ? t("getSevenDays")
    : plan === "daily"
      ? t("getTwentyFourHours")
      : t("goPro");
}

function cryptoRequestIsPending(request) {
  return ["requested", "contacted", "awaiting_payment", "paid"].includes(
    String(request?.status || ""),
  );
}

function renderCryptoPaymentRequest(request) {
  currentCryptoPaymentRequest = request || null;
  const visible = Boolean(request?.request_id && cryptoRequestIsPending(request));
  const statusLabel = visible
    ? t("cryptoPaymentStatus", {
        id: String(request.request_id).slice(-8),
      })
    : "";
  [mainCryptoRequestStatus, promptCryptoRequestStatus].forEach((button) => {
    if (!button) return;
    button.textContent = statusLabel;
    button.classList.toggle("hidden", !visible);
  });
}

async function refreshCryptoPaymentRequestStatus() {
  const response = await sendMessage({ type: "crypto-payment-request-status" }).catch(() => null);
  if (!response?.ok) return;
  renderCryptoPaymentRequest(response.request);
}

function setCryptoSupportLinks(requestId = "") {
  const subject = encodeURIComponent(
    requestId ? `GeoBoost crypto payment ${requestId}` : "GeoBoost crypto payment",
  );
  const href = `mailto:support@geoboost.win?subject=${subject}`;
  cryptoSupportEmailLink.href = href;
  cryptoSuccessSupportEmailLink.href = href;
}

function showCryptoPaymentSuccess(request) {
  renderCryptoPaymentRequest(request);
  cryptoPaymentRequestId.textContent = String(request?.request_id || "");
  setCryptoSupportLinks(request?.request_id || "");
  cryptoPaymentFormState.classList.add("hidden");
  cryptoPaymentSuccessState.classList.remove("hidden");
}

function openCryptoPayment(source = "main") {
  const sourceInput = source === "prompt" ? proEmailInput : mainProEmailInput;
  const sourceEmail = sourceInput?.value.trim();
  if (sourceEmail) cryptoPaymentEmail.value = sourceEmail;
  cryptoPaymentPlan.value = ["daily", "weekly", "monthly", "annual"].includes(selectedPlans[source])
    ? selectedPlans[source]
    : "annual";
  cryptoPaymentMessage.classList.add("hidden");
  cryptoPaymentMessage.classList.remove("error");
  setCryptoSupportLinks();
  if (cryptoRequestIsPending(currentCryptoPaymentRequest)) {
    showCryptoPaymentSuccess(currentCryptoPaymentRequest);
  } else {
    cryptoPaymentFormState.classList.remove("hidden");
    cryptoPaymentSuccessState.classList.add("hidden");
  }
  cryptoPaymentPrompt.classList.remove("hidden");
  trackEvent("crypto_payment_opened", {
    source,
    plan: cryptoPaymentPlan.value,
  });
  if (!cryptoRequestIsPending(currentCryptoPaymentRequest)) {
    setTimeout(() => cryptoPaymentEmail.focus(), 0);
  }
}

function closeCryptoPayment() {
  cryptoPaymentPrompt.classList.add("hidden");
}

async function submitCryptoPaymentRequest(event) {
  event.preventDefault();
  const email = cryptoPaymentEmail.value.trim();
  const country = cryptoPaymentCountry.value.trim();
  const plan = ["daily", "weekly", "monthly", "annual"].includes(cryptoPaymentPlan.value)
    ? cryptoPaymentPlan.value
    : "annual";
  cryptoPaymentMessage.classList.add("hidden");
  cryptoPaymentMessage.classList.remove("error");
  if (!cryptoPaymentEmail.checkValidity() || !cryptoPaymentCountry.checkValidity()) {
    cryptoPaymentMessage.textContent = t("cryptoPaymentValidation");
    cryptoPaymentMessage.classList.add("error");
    cryptoPaymentMessage.classList.remove("hidden");
    return;
  }
  submitCryptoPaymentRequestButton.disabled = true;
  try {
    const response = await sendMessage({
      type: "submit-crypto-payment-request",
      email,
      plan,
      country,
      company: cryptoPaymentCompany.value,
    });
    if (!response?.ok || !response.request?.request_id) {
      throw new Error(response?.error || t("cryptoPaymentError"));
    }
    showCryptoPaymentSuccess(response.request);
  } catch (error) {
    cryptoPaymentMessage.textContent = t("cryptoPaymentError");
    cryptoPaymentMessage.classList.add("error");
    cryptoPaymentMessage.classList.remove("hidden");
    trackEvent("crypto_payment_failed", { plan });
  } finally {
    submitCryptoPaymentRequestButton.disabled = false;
  }
}

async function refreshProStatus(message = proMessage) {
  message.classList.add("hidden");
  message.classList.remove("error");
  try {
    const response = await sendMessage({ type: "refresh-billing-status" });
    if (!response.ok) throw new Error(response.error || t("refreshProError"));
    currentUsage = response.usage;
    renderUsage(response.usage);
    if (response.usage?.subscribed) {
      message.textContent = t("proActivated");
      message.classList.remove("hidden");
      setTimeout(() => subscriptionPrompt.classList.add("hidden"), 700);
    } else {
      message.textContent = t("proPending");
      message.classList.remove("hidden");
    }
  } catch (error) {
    message.textContent = error.message || t("refreshProError");
    message.classList.add("error");
    message.classList.remove("hidden");
  }
}

async function manageSubscription() {
  manageSubscriptionMessage.classList.add("hidden");
  manageSubscriptionMessage.classList.remove("error");
  manageSubscriptionButton.disabled = true;
  try {
    const response = await sendMessage({ type: "manage-subscription" });
    if (!response.ok) throw new Error(response.error || t("manageSubscriptionError"));
    manageSubscriptionMessage.textContent = t("manageSubscriptionStarted");
    manageSubscriptionMessage.classList.remove("hidden");
  } catch (error) {
    manageSubscriptionMessage.textContent = error.message || t("manageSubscriptionError");
    manageSubscriptionMessage.classList.add("error");
    manageSubscriptionMessage.classList.remove("hidden");
  } finally {
    manageSubscriptionButton.disabled = false;
  }
}

async function setAnalyticsOptOut(enabled) {
  if (!analyticsOptOutToggle) return;
  analyticsOptOutToggle.disabled = true;
  try {
    const response = await sendMessage({
      type: "set-analytics-opt-out",
      enabled,
    });
    if (!response.ok) throw new Error(response.error || "Could not update analytics setting.");
    await chrome.storage.local.set({ analyticsOptOut: Boolean(enabled) });
  } catch {
    analyticsOptOutToggle.checked = !enabled;
  } finally {
    analyticsOptOutToggle.disabled = false;
  }
}

async function requestRestoreCode({
  input = proEmailInput,
  codeInput = restoreCodeInput,
  codeRow = restoreCodeRow,
  message = proMessage,
  button = requestRestoreButton,
} = {}) {
  const email = input.value.trim();
  message.classList.add("hidden");
  message.classList.remove("error");
  button.disabled = true;
  try {
    const response = await sendMessage({
      type: "request-restore-code",
      email,
    });
    if (!response.ok) {
      throw new Error(response.error || t("restoreRequestError"));
    }
    codeInput.value = "";
    codeRow.classList.remove("hidden");
    message.textContent = t("restoreCodeSent");
    message.classList.remove("hidden");
  } catch (error) {
    message.textContent = error.message || t("restoreRequestError");
    message.classList.add("error");
    message.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
}

async function confirmRestoreCode({
  input = proEmailInput,
  codeInput = restoreCodeInput,
  message = proMessage,
  button = confirmRestoreButton,
} = {}) {
  const email = input.value.trim();
  const code = codeInput.value.trim();
  message.classList.add("hidden");
  message.classList.remove("error");
  button.disabled = true;
  try {
    const response = await sendMessage({
      type: "confirm-restore-code",
      email,
      code,
    });
    if (!response.ok) {
      throw new Error(response.error || t("restoreConfirmError"));
    }
    currentUsage = response.usage;
    renderUsage(response.usage);
    message.textContent = response.usage?.subscribed ? t("proActivated") : t("restoreConfirmError");
    message.classList.toggle("error", !response.usage?.subscribed);
    message.classList.remove("hidden");
    if (response.usage?.subscribed) {
      setTimeout(() => subscriptionPrompt.classList.add("hidden"), 700);
    }
  } catch (error) {
    message.textContent = error.message || t("restoreConfirmError");
    message.classList.add("error");
    message.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
}

async function applyPromoCode() {
  const code = promoCodeInput.value.trim();
  promoMessage.classList.add("hidden");
  promoMessage.classList.remove("error");
  try {
    const response = await sendMessage({ type: "redeem-promo", code });
    if (!response.ok) {
      throw new Error(response.error || "Invalid promo code.");
    }
    currentUsage = response.usage;
    renderUsage(response.usage);
    promoMessage.textContent = t("promoApplied");
    promoMessage.classList.remove("hidden");
    setTimeout(() => subscriptionPrompt.classList.add("hidden"), 700);
  } catch (error) {
    promoMessage.textContent = t("promoInvalid");
    promoMessage.classList.add("error");
    promoMessage.classList.remove("hidden");
  }
}

function trackEvent(eventType, eventProperties = {}, options = {}) {
  sendMessage({
    type: "track-event",
    event_type: eventType,
    event_properties: eventProperties,
    options,
  }).catch(() => null);
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  });
  if (currentUsage) renderUsage(currentUsage);
  if (currentCryptoPaymentRequest) renderCryptoPaymentRequest(currentCryptoPaymentRequest);
  if (currentAffiliateStatus) renderAffiliateStatus(currentAffiliateStatus);
  updateCheckoutButton("main");
  updateCheckoutButton("prompt");
}

function t(key, replacements = {}) {
  let value = GEO_I18N[currentLanguage]?.[key] ?? GEO_I18N.en[key] ?? key;
  for (const [name, replacement] of Object.entries(replacements)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

function formatHtml(template, keyLabel) {
  return escapeHtml(template).replace(
    "__KEY__",
    `<kbd>${escapeHtml(keyLabel)}</kbd>`,
  );
}

function localeTag() {
  return {
    en: "en-US", fr: "fr-FR", de: "de-DE", ru: "ru-RU", pl: "pl-PL",
    es: "es-ES", pt: "pt-PT", nl: "nl-NL", sv: "sv-SE",
  }[currentLanguage];
}

function localizeError(errorMessage) {
  const text = String(errorMessage || "");
  if (isLimitError(text)) return t("limitBody");
  if (text.includes("разреш") || text.includes("permission")) return t("permission");
  if (text.includes("изображ") || text.includes("capture")) return t("captureError");
  if (text.includes("выполня") || text.includes("running")) return t("busy");
  if (text.includes("недоступ") || text.includes("unavailable") || text.includes("fetch")) {
    return t("unavailable");
  }
  return text;
}

function isLimitError(text) {
  return String(text || "").toLowerCase().includes("free guesses");
}

function sendMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

analyzeButton.addEventListener("click", triggerAnalysis);
hotkeyRecorder.addEventListener("click", startHotkeyRecording);
mapZoomInButton.addEventListener("click", (event) => {
  event.preventDefault();
  changeMapZoom(1);
});
mapZoomOutButton.addEventListener("click", (event) => {
  event.preventDefault();
  changeMapZoom(-1);
});
guessMap.addEventListener(
  "wheel",
  (event) => {
    if (!currentMapView) return;
    event.preventDefault();
    changeMapZoom(event.deltaY < 0 ? 1 : -1);
  },
  { passive: false },
);
guessMap.addEventListener("keydown", (event) => {
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    changeMapZoom(1);
  }
  if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    changeMapZoom(-1);
  }
});
languageSelect.addEventListener("change", async () => {
  currentLanguage = languageSelect.value;
  await chrome.storage.local.set({ uiLanguage: currentLanguage });
  trackEvent("setting_changed", { setting: "uiLanguage", language: currentLanguage });
  applyTranslations();
  renderNotice();
  renderHotkey();
  renderOnboardingStep();
  result.classList.add("hidden");
  loading.classList.add("hidden");
  message.classList.remove("hidden");
});
autoPlaceToggle.addEventListener("change", async () => {
  await saveBooleanSetting("autoPlace", autoPlaceToggle.checked);
  renderFeatureAccess(currentUsage);
});
autoGuessToggle.addEventListener("change", () => {
  saveBooleanSetting("autoGuess", autoGuessToggle.checked);
});
smartZoomToggle.addEventListener("change", () => {
  saveBooleanSetting("smartZoom", smartZoomToggle.checked);
});
rangeToggle.addEventListener("change", () => {
  syncRangeControls();
  saveBooleanSetting("rangeEnabled", rangeToggle.checked);
});
analyticsOptOutToggle?.addEventListener("change", () => {
  setAnalyticsOptOut(analyticsOptOutToggle.checked);
});
darkThemeToggle?.addEventListener("change", async () => {
  const uiTheme = darkThemeToggle.checked ? "dark" : "light";
  applyTheme(uiTheme);
  await chrome.storage.local.set({ uiTheme });
  trackEvent("setting_changed", { setting: "uiTheme", value: uiTheme });
});
scoreMinInput.addEventListener("change", () => {
  saveScoreSettings();
});
scoreMaxInput.addEventListener("change", () => {
  saveScoreSettings();
});
document.querySelector("#openMapLink").addEventListener("click", () => {
  trackEvent("map_preview_opened", {});
});
shareGuessButton.addEventListener("click", shareCurrentGuess);
window.addEventListener("keydown", recordHotkey, true);
window.addEventListener("keydown", handlePanelHotkey, true);
document.querySelector("#settingsButton").addEventListener("click", () => {
  document.querySelector("#settingsPanel").classList.remove("hidden");
  void refreshAffiliateStatus();
});
document.querySelector("#closeSettings").addEventListener("click", () => {
  document.querySelector("#settingsPanel").classList.add("hidden");
  if (mainScrollBeforeAffiliateSettings) {
    window.scrollTo({ top: mainScrollBeforeAffiliateSettings, behavior: "smooth" });
    mainScrollBeforeAffiliateSettings = 0;
  }
});
document.querySelector("#showOnboarding").addEventListener("click", showOnboarding);
manageSubscriptionButton.addEventListener("click", manageSubscription);
document.querySelector("#nextOnboarding").addEventListener("click", async () => {
  if (onboardingStep === ONBOARDING_FINAL_STEP) {
    await finishOnboarding();
  } else {
    onboardingStep += 1;
    renderOnboardingStep();
  }
});
document.querySelector("#privacyConsent").addEventListener("change", () => {
  renderOnboardingStep();
});
affiliateRequestCodeButton.addEventListener("click", requestAffiliateVerification);
affiliateResendCodeButton.addEventListener("click", requestAffiliateVerification);
affiliateConfirmCodeButton.addEventListener("click", confirmAffiliateEnrollment);
affiliateVerificationInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") confirmAffiliateEnrollment();
});
affiliateCopyCodeButton.addEventListener("click", () => copyAffiliateCode("card"));
affiliateDashboardCopyCodeButton.addEventListener("click", () => copyAffiliateCode("dashboard"));
affiliateViewStatsButton.addEventListener("click", openAffiliateStats);
affiliateShareGeoBoostButton.addEventListener("click", shareAffiliateGeoBoost);
affiliateDashboardShareButton.addEventListener("click", shareAffiliateGeoBoost);
affiliateDashboardEnrollButton.addEventListener("click", openAffiliateEnrollment);
affiliateOpenPayoutButton.addEventListener("click", () => {
  affiliatePayoutForm.classList.remove("hidden");
  affiliatePayoutAsset.focus();
  trackEvent("affiliate_payout_form_opened", {});
});
affiliatePayoutAsset.addEventListener("change", () => {
  renderAffiliatePayoutOptions(currentAffiliateStatus?.payout_options || []);
  updateAffiliatePayoutButton();
});
affiliatePayoutNetwork.addEventListener("change", () => {
  updateAffiliateWalletPlaceholder();
  updateAffiliatePayoutButton();
});
affiliateWalletInput.addEventListener("input", updateAffiliatePayoutButton);
affiliatePayoutConfirm.addEventListener("change", updateAffiliatePayoutButton);
affiliateRequestPayoutButton.addEventListener("click", requestAffiliatePayout);
onboardingApplyInviteButton.addEventListener("click", applyOnboardingInvite);
onboardingInviteCode.addEventListener("keydown", (event) => {
  if (event.key === "Enter") applyOnboardingInvite();
});
document.querySelector("#closeSubscriptionPrompt").addEventListener("click", () => {
  subscriptionPrompt.classList.add("hidden");
});
document.querySelector("#applyPromoCode").addEventListener("click", applyPromoCode);
promoCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") applyPromoCode();
});
document.querySelectorAll(".plan-options").forEach((groupElement) => {
  const group = groupElement.dataset.planGroup || "prompt";
  groupElement.querySelectorAll(".plan-option").forEach((button) => {
    button.setAttribute("aria-pressed", button.classList.contains("selected") ? "true" : "false");
    button.addEventListener("click", () => selectPlan(group, button.dataset.plan));
  });
});
mainCryptoPaymentLink.addEventListener("click", () => openCryptoPayment("main"));
promptCryptoPaymentLink.addEventListener("click", () => openCryptoPayment("prompt"));
mainCryptoRequestStatus.addEventListener("click", () => openCryptoPayment("main"));
promptCryptoRequestStatus.addEventListener("click", () => openCryptoPayment("prompt"));
cryptoPaymentForm.addEventListener("submit", submitCryptoPaymentRequest);
document.querySelector("#closeCryptoPaymentPrompt").addEventListener("click", closeCryptoPayment);
document.querySelector("#closeCryptoPaymentSuccess").addEventListener("click", closeCryptoPayment);
[cryptoSupportEmailLink, cryptoSuccessSupportEmailLink].forEach((link) => {
  link.addEventListener("click", () => {
    trackEvent("crypto_support_email_opened", {
      has_request: Boolean(currentCryptoPaymentRequest?.request_id),
    });
  });
});
goProButton.addEventListener("click", () => startProCheckout());
proEmailInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (currentUsage?.restoreAvailable) requestRestoreCode();
  else startProCheckout();
});
requestRestoreButton.addEventListener("click", () => requestRestoreCode());
confirmRestoreButton.addEventListener("click", () => confirmRestoreCode());
restoreCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") confirmRestoreCode();
});
mainGoProButton.addEventListener("click", () => {
  startProCheckout({
    input: mainProEmailInput,
    message: mainProMessage,
    button: mainGoProButton,
    planGroup: "main",
  });
});
mainProEmailInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    if (currentUsage?.restoreAvailable) {
      requestRestoreCode({
        input: mainProEmailInput,
        codeInput: mainRestoreCodeInput,
        codeRow: mainRestoreCodeRow,
        message: mainProMessage,
        button: mainRequestRestoreButton,
      });
    } else {
      startProCheckout({
        input: mainProEmailInput,
        message: mainProMessage,
        button: mainGoProButton,
        planGroup: "main",
      });
    }
  }
});
mainRequestRestoreButton.addEventListener("click", () => {
  requestRestoreCode({
    input: mainProEmailInput,
    codeInput: mainRestoreCodeInput,
    codeRow: mainRestoreCodeRow,
    message: mainProMessage,
    button: mainRequestRestoreButton,
  });
});
mainConfirmRestoreButton.addEventListener("click", () => {
  confirmRestoreCode({
    input: mainProEmailInput,
    codeInput: mainRestoreCodeInput,
    message: mainProMessage,
    button: mainConfirmRestoreButton,
  });
});
mainRestoreCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    confirmRestoreCode({
      input: mainProEmailInput,
      codeInput: mainRestoreCodeInput,
      message: mainProMessage,
      button: mainConfirmRestoreButton,
    });
  }
});
refreshProStatusButton.addEventListener("click", () => refreshProStatus(proMessage));
refreshProStatusMainButton.addEventListener("click", () => refreshProStatus(mainProMessage));

chrome.runtime.onMessage.addListener((event) => {
  if (event.type === "analysis-started") {
    analyzeButton.disabled = true;
    showLoading();
  } else if (event.type === "analysis-result") {
    renderResult(event.result);
    refreshUsage();
  } else if (event.type === "analysis-error") {
    showMessage(localizeError(event.error), true);
    if (isLimitError(event.error)) showSubscriptionPrompt();
  } else if (event.type === "usage" && event.usage) {
    currentUsage = event.usage;
    renderUsage(event.usage);
  } else if (event.type === "usage-limit") {
    currentUsage = event.usage;
    renderUsage(event.usage);
    showSubscriptionPrompt();
  }
});

initialize();
