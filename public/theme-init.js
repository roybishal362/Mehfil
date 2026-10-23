// Applies the saved theme and language before first paint.
// Kept as an external file so the Content-Security-Policy never needs 'unsafe-inline'.
(function () {
  try {
    var root = document.documentElement;
    var theme = localStorage.getItem('mehfil:theme');
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    var lang = localStorage.getItem('mehfil:lang');
    if (lang === 'en' || lang === 'hi' || lang === 'bn') root.setAttribute('lang', lang);
  } catch (_error) {
    // Storage can be unavailable (private mode, blocked cookies): fall back to system defaults.
  }
})();
