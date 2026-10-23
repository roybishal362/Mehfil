/**
 * Token-bucket rate limiter. Each client key holds up to `capacity` tokens that refill steadily;
 * expensive requests cost more tokens. Buckets live in memory: on Vercel's Fluid Compute an
 * instance serves many requests, so this blocks bursts and scripted abuse cheaply. The oldest
 * keys are evicted beyond `maxKeys`, so memory stays bounded under attack.
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until enough tokens are available (0 when allowed). */
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  capacity: number;
  refillPerSecond: number;
  maxKeys?: number;
  now?: () => number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class TokenBucketLimiter {
  readonly capacity: number;
  private readonly refillPerSecond: number;
  private readonly maxKeys: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, Bucket>();

  constructor({ capacity, refillPerSecond, maxKeys = 10_000, now = Date.now }: RateLimiterOptions) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.maxKeys = maxKeys;
    this.now = now;
  }

  take(key: string, cost = 1): RateLimitResult {
    const now = this.now();
    const existing = this.buckets.get(key);
    const elapsed = existing ? (now - existing.updatedAt) / 1000 : 0;
    const tokens = Math.min(
      this.capacity,
      (existing?.tokens ?? this.capacity) + elapsed * this.refillPerSecond,
    );
    // Re-insert so the Map's insertion order tracks recency for eviction.
    this.buckets.delete(key);
    if (tokens >= cost) {
      this.buckets.set(key, { tokens: tokens - cost, updatedAt: now });
      this.evict();
      return { ok: true, remaining: Math.floor(tokens - cost), retryAfterSeconds: 0 };
    }
    this.buckets.set(key, { tokens, updatedAt: now });
    this.evict();
    return {
      ok: false,
      remaining: Math.floor(tokens),
      retryAfterSeconds: Math.max(1, Math.ceil((cost - tokens) / this.refillPerSecond)),
    };
  }

  get size(): number {
    return this.buckets.size;
  }

  private evict(): void {
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next();
      if (oldest.done) return;
      this.buckets.delete(oldest.value);
    }
  }
}
