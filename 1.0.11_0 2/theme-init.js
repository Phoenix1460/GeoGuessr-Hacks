(() => {
  chrome.storage.local
    .get("uiTheme")
    .then(({ uiTheme }) => {
      document.documentElement.dataset.theme = uiTheme === "dark" ? "dark" : "light";
    })
    .catch(() => {
      document.documentElement.dataset.theme = "light";
    });
})();
