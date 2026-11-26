/* Sets data-theme before the popup paints: the theme chosen in the CLR app (content.js
   copies it from the dashboard into chrome.storage as appTheme), else the browser's
   colour scheme. Runs in <head>, so dark users never see a flash. */
(function () {
  var root = document.documentElement;
  var mq = window.matchMedia("(prefers-color-scheme: light)");
  var chosen = null;
  function apply() {
    root.setAttribute("data-theme", chosen || (mq.matches ? "light" : "dark"));
  }
  apply();
  mq.addEventListener("change", apply);
  chrome.storage.local.get("appTheme", function (s) {
    chosen = s.appTheme === "light" || s.appTheme === "dark" ? s.appTheme : null;
    apply();
  });
})();
