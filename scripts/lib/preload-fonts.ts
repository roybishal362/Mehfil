/**
 * Vite plugin: adds <link rel="preload"> tags for the fonts the first screen needs, so they
 * arrive with the page instead of after the CSS is parsed. Without this the headline renders
 * in a fallback font first and shifts the layout when the web font swaps in.
 */
import type { Plugin } from 'vite';

/** Built font files to preload, matched by name (hashes change on every build). */
const CRITICAL_FONTS = [
  /^assets\/eczar-latin-wght-normal-[\w-]+\.woff2$/,
  /^assets\/mukta-latin-400-normal-[\w-]+\.woff2$/,
  /^assets\/mukta-latin-600-normal-[\w-]+\.woff2$/,
  /^assets\/mukta-rupee-400-normal-[\w-]+\.woff2$/,
];

export function preloadCriticalFonts(): Plugin {
  return {
    name: 'mehfil:preload-critical-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const files = Object.keys(context.bundle ?? {});
        return CRITICAL_FONTS.flatMap((pattern) => {
          const file = files.find((name) => pattern.test(name));
          return file
            ? [
                {
                  tag: 'link',
                  attrs: {
                    rel: 'preload',
                    href: `/${file}`,
                    as: 'font',
                    type: 'font/woff2',
                    crossorigin: '',
                  },
                  injectTo: 'head' as const,
                },
              ]
            : [];
        });
      },
    },
  };
}
