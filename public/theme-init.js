// Apply the saved theme before first paint to avoid a light/dark flash.
try {
  var t = JSON.parse(localStorage.getItem("flowdesk.prefs") || "{}").theme;
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
