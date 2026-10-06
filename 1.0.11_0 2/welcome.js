async function applyWebsiteLinks() {
  const fallback = "https://geoboost.win";
  const config = await fetch(chrome.runtime.getURL("config.json"))
    .then((response) => response.json())
    .catch(() => ({}));
  const website = String(config.websiteUrl || fallback).replace(/\/+$/, "");
  document.querySelector("#privacyLink").href = `${website}/privacy`;
  document.querySelector("#termsLink").href = `${website}/terms`;
}

applyWebsiteLinks();
