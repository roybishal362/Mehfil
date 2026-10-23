// Applies the saved theme and language before first paint, so the page never flashes.
// Kept as an external file so the Content-Security-Policy never needs 'unsafe-inline'.
(function () {
  var root = document.documentElement;
  try {
    var theme = localStorage.getItem('mehfil:theme');
    root.setAttribute('data-theme', theme === 'day' ? 'day' : 'night');
    var lang = localStorage.getItem('mehfil:lang');
    if (lang === 'en' || lang === 'hi' || lang === 'bn') root.setAttribute('lang', lang);
  } catch (_error) {
    // Storage can be unavailable (private mode, blocked cookies): use the night theme.
    root.setAttribute('data-theme', 'night');
  }
})();
