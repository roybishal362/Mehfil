/**
 * Applies a token-bucket limiter per client: the signed-in user, else the address. Signed-in
 * users can also share a larger allowance per address, so creating new (anonymous) accounts
 * from one address does not multiply what it can spend.
 */
import type { Context, MiddlewareHandler } from 'hono';
import { tooManyRequests } from '../errors';
import type { TokenBucketLimiter } from '../lib/rate-limiter';
import type { AppEnv } from '../types';
import { clientIp } from './client-ip';

export interface RateLimitOptions {
  limiter: TokenBucketLimiter;
  clientIpMode: 'vercel' | 'socket';
  /** Token cost of a request (expensive AI calls cost more). */
  cost?: (c: Context<AppEnv>) => number;
  /** The allowance every signed-in user at one address shares. */
  addressLimiter?: TokenBucketLimiter;
}

export function rateLimit({
  limiter,
  clientIpMode,
  cost,
  addressLimiter,
}: RateLimitOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const uid = c.get('uid');
    const address = `ip:${clientIp(c, clientIpMode)}`;
    const amount = cost?.(c) ?? 1;
    if (uid && addressLimiter) {
      const shared = addressLimiter.take(address, amount);
      if (!shared.ok) throw tooManyRequests(shared.retryAfterSeconds);
    }
    const result = limiter.take(uid ? `uid:${uid}` : address, amount);
    c.header('RateLimit-Limit', String(limiter.capacity));
    c.header('RateLimit-Remaining', String(result.remaining));
    if (!result.ok) throw tooManyRequests(result.retryAfterSeconds);
    await next();
  };
}
