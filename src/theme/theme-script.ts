/**
 * Tiny inline script that sets data-theme on <html> BEFORE the first paint
 * so there is no flash of wrong theme. Runs synchronously in <head>.
 *
 * Logic:
 *  1. Try to read document.cookie for a persisted explicit choice.
 *  2. For first-time visitors (no cookie) fall back to prefers-color-scheme.
 *  3. Default to "dark" when neither is available.
 */
export const themeScript = `(function(){
  function p(v){return v==='dark'||v==='light'?v:'dark'}
  var m=document.cookie.match(/(?:^|;\\s*)theme=([^;]+)/);
  var t=m?p(decodeURIComponent(m[1]))
    :(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
  document.documentElement.dataset.theme=t;
})();`;
