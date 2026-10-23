/**
 * Static file serving for the Node entry (local production runs, Docker, E2E tests).
 * On Vercel the CDN serves these files with the same cache rules (see scripts/build-vercel.ts).
 */
import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';
import { CACHE_RULES } from './security/headers';
import type { AppEnv } from './types';

/** Cache policy for a static response: immutable hashed assets, revalidated HTML. */
export function staticCachePolicy(path: string, contentType: string): string {
  if (path.startsWith('/assets/')) return CACHE_RULES.immutable;
  if (contentType.includes('text/html')) return CACHE_RULES.document;
  return 'public, max-age=3600';
}

export function mountStatic(app: Hono<AppEnv>, root: string): void {
  app.use('*', async (c, next) => {
    await next();
    if (c.res.ok && (c.req.method === 'GET' || c.req.method === 'HEAD')) {
      c.res.headers.set(
        'Cache-Control',
        staticCachePolicy(c.req.path, c.res.headers.get('content-type') ?? ''),
      );
    }
  });
  app.use('*', serveStatic({ root, precompressed: true }));
  // A missing build asset is a real 404, never the HTML shell.
  app.get('/assets/*', (c) => c.text('Not found', 404));
  // Every other GET is an app route: serve the HTML shell and let the client router take over.
  app.get('*', serveStatic({ root, path: 'index.html', precompressed: true }));
}
