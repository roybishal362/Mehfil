// Applies the saved theme and language before first paint, so the page never flashes.
// Kept as an external file so the Content-Security-Policy never needs 'unsafe-inline'.
(function () {
  var root = document.documentElement;
  try {
    // A saved choice wins; on a first visit the device's light or dark setting decides.
    var theme = localStorage.getItem('mehfil:theme');
    var night = theme
      ? theme === 'night'
      : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', night ? 'night' : 'day');
    var lang = localStorage.getItem('mehfil:lang');
    if (lang === 'en' || lang === 'hi' || lang === 'bn') root.setAttribute('lang', lang);
    // index.html carries a prerendered English home page; hide it where it would be wrong.
    if (location.pathname !== '/' || (lang && lang !== 'en'))
      root.setAttribute('data-prerender', 'hidden');
  } catch (_error) {
    // Storage can be unavailable (private mode, blocked cookies): use the day theme.
    root.setAttribute('data-theme', 'day');
  }
})();
