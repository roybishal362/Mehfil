import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { clientIp } from './client-ip';

function appFor(mode: 'vercel' | 'socket') {
  const app = new Hono();
  app.get('/', (c) => c.text(clientIp(c, mode)));
  return app;
}

const ipFor = async (app: Hono, headers: Record<string, string> = {}) =>
  (await app.request('/', { headers })).text();

describe('clientIp', () => {
  it("trusts Vercel's own headers on Vercel", async () => {
    const app = appFor('vercel');
    expect(await ipFor(app, { 'x-real-ip': '203.0.113.7' })).toBe('203.0.113.7');
    expect(await ipFor(app, { 'x-forwarded-for': '198.51.100.2, 10.0.0.1' })).toBe('198.51.100.2');
    expect(await ipFor(app)).toBe('unknown');
  });

  it('ignores forwarded headers elsewhere, because any client can send them', async () => {
    const app = appFor('socket');
    expect(await ipFor(app, { 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4' })).toBe(
      'local',
    );
  });
});
