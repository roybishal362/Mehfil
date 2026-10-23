import { describe, expect, it } from 'vitest';
import { securityHeaders } from '../../src/server/security/headers';
import { functionConfig, vercelConfig, type VercelRoute } from './vercel-output';

const routes = vercelConfig().routes;
const sourceRoutes = routes.filter(
  (route): route is Exclude<VercelRoute, { handle: string }> => 'src' in route,
);
const matches = (src: string, path: string) => new RegExp(src).test(path);

describe('vercelConfig', () => {
  it('sends the production security headers on pages and files, but not twice on the API', () => {
    const [headersRoute] = sourceRoutes;
    expect(headersRoute?.headers).toEqual(securityHeaders({ production: true }));
    expect(headersRoute?.headers?.['Content-Security-Policy']).toContain(
      'upgrade-insecure-requests',
    );
    expect(headersRoute?.continue).toBe(true);
    for (const path of ['/', '/plan/abc', '/assets/index-3f9a.js', '/apiary']) {
      expect(matches(headersRoute?.src ?? '', path)).toBe(true);
    }
    for (const path of ['/api', '/api/health', '/api/ai/brief']) {
      expect(matches(headersRoute?.src ?? '', path)).toBe(false);
    }
  });

  it('sends API paths to the function before static files are checked', () => {
    const apiIndex = routes.findIndex((route) => 'dest' in route && route.dest === '/api');
    const filesystemIndex = routes.findIndex((route) => 'handle' in route);
    expect(apiIndex).toBeGreaterThan(-1);
    expect(apiIndex).toBeLessThan(filesystemIndex);
    const api = sourceRoutes.find((route) => route.dest === '/api');
    expect(
      ['/api', '/api/health', '/api/ai/personalize'].every((path) => matches(api?.src ?? '', path)),
    ).toBe(true);
    expect(matches(api?.src ?? '', '/apiary')).toBe(false);
  });

  it('caches hashed assets forever, 404s missing ones and falls back to the app shell', () => {
    const immutable = sourceRoutes.find((route) => route.headers?.['Cache-Control']);
    expect(immutable?.headers?.['Cache-Control']).toBe('public, max-age=31536000, immutable');
    const afterFilesystem = routes.slice(routes.findIndex((route) => 'handle' in route) + 1);
    expect(afterFilesystem).toEqual([
      { src: '^/assets/.+$', status: 404 },
      { src: '^/.*$', dest: '/index.html' },
    ]);
  });
});

describe('functionConfig', () => {
  it('runs the API as a streaming Node.js function near India', () => {
    expect(functionConfig()).toMatchObject({
      runtime: 'nodejs24.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
      regions: ['bom1'],
    });
  });
});
