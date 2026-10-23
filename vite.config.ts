import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite builds the React SPA into `dist/client`.
 * In development `/api/*` is proxied to the local Hono server (`npm run dev:api`).
 */
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
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
