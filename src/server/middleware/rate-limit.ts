/** Applies a token-bucket limiter per client (signed-in user, else IP). */
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
}

export function rateLimit({
  limiter,
  clientIpMode,
  cost,
}: RateLimitOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const uid = c.get('uid');
    const key = uid ? `uid:${uid}` : `ip:${clientIp(c, clientIpMode)}`;
    const result = limiter.take(key, cost?.(c) ?? 1);
    c.header('RateLimit-Limit', String(limiter.capacity));
    c.header('RateLimit-Remaining', String(result.remaining));
    if (!result.ok) throw tooManyRequests(result.retryAfterSeconds);
    await next();
  };
}
