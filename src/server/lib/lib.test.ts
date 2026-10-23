import { describe, expect, it } from 'vitest';
import { TtlCache, hashKey } from './cache';
import { CircuitBreaker } from './circuit-breaker';
import { TokenBucketLimiter } from './rate-limiter';
import { RequestsPerMinuteGuard } from './rpm-guard';

function clock(start = 1_000_000) {
  let time = start;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

describe('TokenBucketLimiter', () => {
  it('allows bursts up to capacity, then refills over time', () => {
    const c = clock();
    const limiter = new TokenBucketLimiter({ capacity: 3, refillPerSecond: 1, now: c.now });
    expect(limiter.take('a').ok).toBe(true);
    expect(limiter.take('a', 2)).toMatchObject({ ok: true, remaining: 0 });
    const denied = limiter.take('a');
    expect(denied).toMatchObject({ ok: false, retryAfterSeconds: 1 });
    c.advance(1000);
    expect(limiter.take('a').ok).toBe(true);
  });

  it('keeps clients independent and charges expensive calls more', () => {
    const c = clock();
    const limiter = new TokenBucketLimiter({ capacity: 4, refillPerSecond: 0.1, now: c.now });
    expect(limiter.take('ip:1', 4).ok).toBe(true);
    expect(limiter.take('ip:1', 4)).toMatchObject({ ok: false, retryAfterSeconds: 40 });
    expect(limiter.take('ip:2', 4).ok).toBe(true);
  });

  it('evicts the least recently seen clients beyond maxKeys', () => {
    const limiter = new TokenBucketLimiter({ capacity: 1, refillPerSecond: 1, maxKeys: 2 });
    limiter.take('a');
    limiter.take('b');
    limiter.take('c');
    expect(limiter.size).toBe(2);
  });
});

describe('TtlCache', () => {
  it('expires entries after the TTL and evicts the oldest beyond capacity', () => {
    const c = clock();
    const cache = new TtlCache<number>({ maxEntries: 2, ttlMs: 1000, now: c.now });
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1); // refreshes "a"
    cache.set('c', 3); // evicts "b", the least recently used
    expect(cache.get('b')).toBeUndefined();
    expect(cache.size).toBe(2);
    c.advance(1001);
    expect(cache.get('a')).toBeUndefined();
  });

  it('runs a loader once for concurrent callers and caches the result', async () => {
    const cache = new TtlCache<string>({ maxEntries: 10, ttlMs: 60_000 });
    let calls = 0;
    const load = async () => {
      calls += 1;
      await Promise.resolve();
      return 'answer';
    };
    const [first, second] = await Promise.all([
      cache.getOrLoad('k', load),
      cache.getOrLoad('k', load),
    ]);
    expect(first).toEqual({ value: 'answer', cached: false });
    expect(second).toEqual({ value: 'answer', cached: true });
    expect(await cache.getOrLoad('k', load)).toEqual({ value: 'answer', cached: true });
    expect(calls).toBe(1);
  });

  it('does not cache failures', async () => {
    const cache = new TtlCache<string>({ maxEntries: 10, ttlMs: 60_000 });
    await expect(cache.getOrLoad('k', () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom',
    );
    expect(await cache.getOrLoad('k', () => Promise.resolve('ok'))).toEqual({
      value: 'ok',
      cached: false,
    });
  });

  it('hashes values independently of key order', async () => {
    expect(await hashKey({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(
      await hashKey({ b: [1, { d: 3, c: 2 }], a: 1 }),
    );
    expect(await hashKey({ a: 1 })).not.toBe(await hashKey({ a: 2 }));
    expect(await hashKey('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('CircuitBreaker', () => {
  it('opens after repeated failures, then allows one trial call', () => {
    const c = clock();
    const breaker = new CircuitBreaker({ failureThreshold: 2, openMs: 1000, now: c.now });
    expect(breaker.state).toBe('closed');
    breaker.recordFailure();
    expect(breaker.canRequest()).toBe(true);
    breaker.recordFailure();
    expect(breaker.state).toBe('open');
    expect(breaker.canRequest()).toBe(false);
    c.advance(1000);
    expect(breaker.state).toBe('half_open');
    expect(breaker.canRequest()).toBe(true);
    expect(breaker.canRequest()).toBe(false); // only one trial at a time
    breaker.recordSuccess();
    expect(breaker.state).toBe('closed');
  });

  it('re-opens when the trial call fails', () => {
    const c = clock();
    const breaker = new CircuitBreaker({ failureThreshold: 1, openMs: 500, now: c.now });
    breaker.recordFailure();
    c.advance(500);
    expect(breaker.canRequest()).toBe(true);
    breaker.recordFailure();
    expect(breaker.state).toBe('open');
  });
});

describe('RequestsPerMinuteGuard', () => {
  it('allows up to the limit in any rolling minute', () => {
    const c = clock();
    const guard = new RequestsPerMinuteGuard(2, c.now);
    expect(guard.tryAcquire()).toBe(true);
    c.advance(30_000);
    expect(guard.tryAcquire()).toBe(true);
    expect(guard.tryAcquire()).toBe(false);
    c.advance(30_001);
    expect(guard.tryAcquire()).toBe(true);
  });
});
