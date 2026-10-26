/**
 * Vite plugin: fetches the app's JavaScript at low priority. The home page arrives prerendered,
 * so its first screen (the headline, the fonts and the first photograph) does not need the
 * scripts to paint; without this hint the scripts compete with the photograph on a slow network
 * and delay it. Hydration follows a moment later, as it would anyway.
 */
import type { Plugin } from 'vite';

/** Adds fetchpriority="low" to module scripts and module preloads in built HTML. */
export function lowerScriptPriority(html: string): string {
  return html.replace(
    /<(script type="module"|link rel="modulepreload")(?![^>]*fetchpriority)/g,
    '<$1 fetchpriority="low"',
  );
}

export function deprioritiseScripts(): Plugin {
  return {
    name: 'mehfil:deprioritise-scripts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: lowerScriptPriority,
    },
  };
}
