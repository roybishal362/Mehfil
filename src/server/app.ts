import { Hono } from 'hono';
import { APP_NAME, APP_VERSION } from '../shared/meta';

/** Builds the HTTP application. Dependencies are injected so tests can swap them. */
export function createApp(): Hono {
  const app = new Hono();
  app.get('/api/health', (c) => c.json({ status: 'ok', name: APP_NAME, version: APP_VERSION }));
  return app;
}
