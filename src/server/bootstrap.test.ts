import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildServerApp } from './bootstrap';

interface Health {
  ai: { mode: string };
}

const quiet = { LOG_LEVEL: 'error' };

describe('buildServerApp', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('runs in demo mode without a Gemini key', async () => {
    const { app, config } = buildServerApp(quiet);
    expect(config.ai.provider).toBe('mock');
    const health = (await (await app.request('/api/health')).json()) as Health;
    expect(health.ai.mode).toBe('mock');
  });

  it('uses Gemini when a key is configured, without calling it at start-up', async () => {
    const { app } = buildServerApp({ ...quiet, GEMINI_API_KEY: 'test-key-not-real' });
    const health = (await (await app.request('/api/health')).json()) as Health;
    expect(health.ai.mode).toBe('gemini');
  });

  it('requires Firebase sign-in for AI routes once Firebase is configured', async () => {
    const { app } = buildServerApp({
      ...quiet,
      FIREBASE_PROJECT_ID: 'mehfil-demo',
      FIREBASE_API_KEY: 'public-web-key',
      FIREBASE_AUTH_DOMAIN: 'mehfil-demo.firebaseapp.com',
      FIREBASE_APP_ID: '1:123:web:abc',
    });
    const config = (await (await app.request('/api/config')).json()) as { firebase: unknown };
    expect(config.firebase).toEqual({
      projectId: 'mehfil-demo',
      apiKey: 'public-web-key',
      authDomain: 'mehfil-demo.firebaseapp.com',
      appId: '1:123:web:abc',
    });
    const res = await app.request('/api/ai/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'A birthday', today: '2026-10-23' }),
    });
    expect(res.status).toBe(401);
  });

  it('reads the process environment by default', () => {
    vi.stubEnv('LOG_LEVEL', 'error');
    vi.stubEnv('AI_PROVIDER', 'mock');
    expect(buildServerApp().config.ai.provider).toBe('mock');
  });
});
