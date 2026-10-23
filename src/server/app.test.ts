import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('GET /api/health', () => {
  it('reports the service as healthy', async () => {
    const res = await createApp().request('/api/health');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: 'ok', name: 'Mehfil' });
  });
});
