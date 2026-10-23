/**
 * LRU cache with time-to-live, plus in-flight de-duplication: concurrent requests for the same
 * key share one upstream call instead of each paying for it. Identical AI requests (for example
 * several visitors trying the same sample celebration) are answered from memory.
 */

export interface CacheOptions {
  maxEntries: number;
  ttlMs: number;
  now?: () => number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class TtlCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private readonly inFlight = new Map<string, Promise<V>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor({ maxEntries, ttlMs, now = Date.now }: CacheOptions) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Refresh recency.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  /**
   * Returns the cached value, or runs `load` once even if many callers ask at the same time.
   * Failures are not cached, so the next caller retries.
   */
  async getOrLoad(key: string, load: () => Promise<V>): Promise<{ value: V; cached: boolean }> {
    const hit = this.get(key);
    if (hit !== undefined) return { value: hit, cached: true };
    const pending = this.inFlight.get(key);
    if (pending) return { value: await pending, cached: true };
    const promise = load();
    this.inFlight.set(key, promise);
    try {
      const value = await promise;
      this.set(key, value);
      return { value, cached: false };
    } finally {
      this.inFlight.delete(key);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Stable SHA-256 hex digest of any JSON-serialisable value (keys sorted). */
export async function hashKey(value: unknown): Promise<string> {
  const canonical = JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
