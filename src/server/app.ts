/**
 * The HTTP application. All dependencies are injected so tests can run the real app in-process
 * with the mock AI provider, fake clocks and a local token verifier.
 */
import { Hono, type ErrorHandler, type MiddlewareHandler } from 'hono';
import { APP_NAME, APP_VERSION } from '../shared/meta';
import type { AiGateway } from './ai/gateway';
import type { AppConfig } from './config';
import { AppError } from './errors';
import { TokenBucketLimiter } from './lib/rate-limiter';
import type { Logger } from './logger';
import { auth, type TokenVerifier } from './middleware/auth';
import { rateLimit } from './middleware/rate-limit';
import { accessLog, applySecurityHeaders, requestId } from './middleware/request-context';
import { AI_ROUTE_COST, aiRoutes } from './routes/ai';
import { CACHE_RULES } from './security/headers';
import type { AppEnv } from './types';

export interface AppDeps {
  config: AppConfig;
  logger: Logger;
  gateway: AiGateway;
  /** Verifies Firebase ID tokens; null when Firebase is not configured. */
  verifier: TokenVerifier | null;
  now?: () => number;
}

/** How many users' AI allowance one address shares between its signed-in users. */
const ADDRESS_SHARE = 4;

/** A bucket that holds `capacity` tokens and refills completely in ten minutes. */
const tenMinuteBucket = (capacity: number, now: () => number) =>
  new TokenBucketLimiter({ capacity, refillPerSecond: capacity / 600, now });

/** Generous for ordinary API calls, much tighter for AI calls (which cost real quota). */
function createLimiters(config: AppConfig, now: () => number) {
  return {
    api: new TokenBucketLimiter({ capacity: 120, refillPerSecond: 2, now }),
    ai: tenMinuteBucket(config.ai.rateLimit, now),
    // Every signed-in user at one address shares four users' worth, so new anonymous accounts
    // cannot multiply an address's AI allowance (offices and colleges still have room).
    aiAddress: tenMinuteBucket(config.ai.rateLimit * ADDRESS_SHARE, now),
  };
}

/** API answers are not cached unless a route says otherwise. */
const defaultCacheControl: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', CACHE_RULES.api);
};

/** Health, and the public settings the client reads before it calls the AI. */
function infoRoutes({
  config,
  gateway,
  now,
}: {
  config: AppConfig;
  gateway: AiGateway;
  now: () => number;
}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      name: APP_NAME,
      version: APP_VERSION,
      ai: { mode: gateway.mode, models: gateway.models },
      time: new Date(now()).toISOString(),
    }),
  );
  app.get('/config', (c) => {
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({
      ai: { mode: gateway.mode, requiresSignIn: config.requireAuthForAi },
      firebase: config.firebase,
      features: { cloudSync: config.firebase !== null },
    });
  });
  return app;
}

/** Known errors keep their status and safe message; anything else is logged and hidden. */
function errorHandler(logger: Logger): ErrorHandler<AppEnv> {
  return (error, c) => {
    const id = c.get('requestId');
    if (error instanceof AppError) {
      if (error.retryAfterSeconds !== undefined) {
        c.header('Retry-After', String(error.retryAfterSeconds));
      }
      return c.json({ code: error.code, message: error.message, requestId: id }, error.status);
    }
    logger.error('http.unhandled_error', {
      requestId: id,
      path: c.req.path,
      error: error instanceof Error ? error.name : 'unknown',
    });
    const message = 'Something went wrong on our side. Please try again.';
    return c.json({ code: 'internal', message, requestId: id }, 500);
  };
}

export function createApp({
  config,
  logger,
  gateway,
  verifier,
  now = Date.now,
}: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const limiters = createLimiters(config, now);

  app.use('*', requestId());
  app.use('*', applySecurityHeaders(config.env === 'production'));
  app.use('/api/*', accessLog(logger));
  app.use('/api/*', defaultCacheControl);
  app.use('/api/*', rateLimit({ limiter: limiters.api, clientIpMode: config.clientIp }));
  app.route('/api', infoRoutes({ config, gateway, now }));

  app.use('/api/ai/*', auth({ verifier, required: config.requireAuthForAi }));
  app.use(
    '/api/ai/*',
    rateLimit({
      limiter: limiters.ai,
      clientIpMode: config.clientIp,
      cost: (c) => AI_ROUTE_COST[c.req.path.split('/').pop() ?? ''] ?? 1,
      addressLimiter: limiters.aiAddress,
    }),
  );
  app.route('/api/ai', aiRoutes(gateway, logger));

  app.all('/api/*', (c) =>
    c.json({ code: 'not_found', message: 'Not found', requestId: c.get('requestId') }, 404),
  );
  app.onError(errorHandler(logger));
  return app;
}
