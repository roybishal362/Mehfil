/**
 * Node entry: local production runs (`npm start`), Docker and end-to-end tests.
 * Serves the built client from dist/client and the API from the same origin.
 */
import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { buildServerApp } from './bootstrap';
import { mountStatic } from './static';

// Local development convenience: load .env.local unless explicitly disabled (Docker, CI, E2E).
if (!process.env.MEHFIL_DISABLE_ENV_FILE && existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const { app, config, logger } = buildServerApp();
if (existsSync('dist/client/index.html')) mountStatic(app, 'dist/client');

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info('server.listening', {
    port: info.port,
    url: `http://localhost:${String(info.port)}`,
  });
});

function shutdown(signal: string): void {
  logger.info('server.shutdown', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
