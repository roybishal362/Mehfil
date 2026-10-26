import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { preloadCriticalFonts } from './scripts/lib/preload-fonts.ts';
import { deprioritiseScripts } from './scripts/lib/script-priority.ts';

/**
 * Vite builds the React SPA into `dist/client`.
 * In development `/api/*` is proxied to the local Hono server (`npm run dev:api`).
 */
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    preloadCriticalFonts(),
    deprioritiseScripts(),
  ],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    // Fonts stay separate files: the Content-Security-Policy's font-src allows 'self', not data:.
    // Fonts and photographs stay files: inlined, they would bloat the JavaScript and CSS that
    // every page waits for, and they cache better on their own.
    assetsInlineLimit: (file) => (/\.(?:woff2|webp)$/.test(file) ? false : undefined),
    reportCompressedSize: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: false },
    },
  },
});
