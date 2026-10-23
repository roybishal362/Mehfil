import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MockProvider } from './ai/mock-provider';
import { AiGateway } from './ai/gateway';
import { createApp } from './app';
import { loadConfig } from './config';
import { silentLogger } from './logger';
import { mountStatic, staticCachePolicy } from './static';

describe('staticCachePolicy', () => {
  it.each([
    ['/assets/index-3f9a.js', 'text/javascript', 'public, max-age=31536000, immutable'],
    ['/index.html', 'text/html; charset=utf-8', 'no-cache'],
    ['/plan/abc', 'text/html', 'no-cache'],
    ['/favicon.svg', 'image/svg+xml', 'public, max-age=3600'],
  ])('%s → %s', (path, type, policy) => {
    expect(staticCachePolicy(path, type)).toBe(policy);
  });
});

describe('mountStatic', () => {
  let root = '';
  const app = () => {
    const config = loadConfig({ NODE_ENV: 'production', AI_PROVIDER: 'mock' });
    const gateway = new AiGateway({
      provider: new MockProvider(),
      models: config.ai.models,
      maxRequestsPerMinute: 10,
      logger: silentLogger,
    });
    const server = createApp({ config, logger: silentLogger, gateway, verifier: null });
    mountStatic(server, root);
    return server;
  };

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'mehfil-static-'));
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>Mehfil</title>');
    writeFileSync(join(root, 'assets', 'index-3f9a.js'), 'console.log(1)');
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('serves hashed assets as immutable', async () => {
    const res = await app().request('/assets/index-3f9a.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });

  it('returns 404 for a missing asset instead of the HTML shell', async () => {
    const res = await app().request('/assets/missing.js');
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('<title>');
  });

  it('serves the HTML shell for app routes, revalidated on each visit', async () => {
    const res = await app().request('/plan/abc123');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Mehfil</title>');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('answers HEAD requests with the same caching, and leaves other methods alone', async () => {
    const shared = app();
    const head = await shared.request('/assets/index-3f9a.js', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    const posted = await shared.request('/plan/abc123', { method: 'POST' });
    expect(posted.status).toBe(404);
    expect(posted.headers.get('Cache-Control')).toBeNull();
  });

  it('keeps API routes ahead of the shell', async () => {
    const shared = app();
    expect((await shared.request('/api/health')).headers.get('Content-Type')).toContain(
      'application/json',
    );
    expect((await shared.request('/api/missing')).status).toBe(404);
  });
});
