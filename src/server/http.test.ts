import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, badRequest, notFound, tooManyRequests, unauthorized } from './errors';
import { describeIssues, readJson } from './http';

describe('errors', () => {
  it('carry a status, a stable code and a safe default message', () => {
    expect(badRequest()).toMatchObject({ status: 400, code: 'bad_request' });
    expect(unauthorized()).toMatchObject({ status: 401, code: 'unauthorized' });
    expect(notFound()).toMatchObject({ status: 404, code: 'not_found', message: 'Not found' });
    expect(tooManyRequests(7)).toMatchObject({ status: 429, retryAfterSeconds: 7 });
    expect(badRequest('Custom')).toBeInstanceOf(AppError);
  });
});

describe('describeIssues', () => {
  it('names at most eight fields, once each, and never the values', () => {
    const schema = z.object(
      Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`field${String(i)}`, z.number()])),
    );
    const result = schema.safeParse({ field0: 'secret value' });
    expect(result.success).toBe(false);
    const message = result.error ? describeIssues(result.error) : '';
    expect(message.split(',')).toHaveLength(8);
    expect(message).not.toContain('secret value');
  });

  it('calls a problem with the whole body "body"', () => {
    const result = z.object({ a: z.string() }).safeParse([]);
    expect(result.error ? describeIssues(result.error) : '').toBe('Check these fields: body');
  });
});

describe('readJson', () => {
  const app = new Hono();
  app.post('/', async (c) => c.json(await readJson(c, z.object({ ok: z.boolean() }))));
  app.onError((error, c) =>
    c.json({ status: error instanceof AppError ? error.status : 500 }, 200),
  );

  it('requires a JSON content type, even when none is sent', async () => {
    // A byte body carries no implicit Content-Type header.
    const res = await app.request('/', {
      method: 'POST',
      body: new TextEncoder().encode('{"ok":true}'),
    });
    expect(await res.json()).toEqual({ status: 415 });
    const text = await app.request('/', { method: 'POST', body: '{"ok":true}' });
    expect(await text.json()).toEqual({ status: 415 });
  });

  it('accepts JSON with a charset parameter', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: '{"ok":true}',
    });
    expect(await res.json()).toEqual({ ok: true });
  });
});
