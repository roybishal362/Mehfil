/**
 * The HTTP application. All dependencies are injected so tests can run the real app in-process
 * with the mock AI provider, fake clocks and a local token verifier.
 */
import { Hono } from 'hono';
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

export function createApp({
  config,
  logger,
  gateway,
  verifier,
  now = Date.now,
}: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const production = config.env === 'production';

  // Generous for ordinary API calls, much tighter for AI calls (which cost real quota).
  const apiLimiter = new TokenBucketLimiter({ capacity: 120, refillPerSecond: 2, now });
  const aiLimiter = new TokenBucketLimiter({
    capacity: config.ai.rateLimit,
    refillPerSecond: config.ai.rateLimit / 600,
    now,
  });

  app.use('*', requestId());
  app.use('*', applySecurityHeaders(production));

  app.use('/api/*', accessLog(logger));
  app.use('/api/*', async (c, next) => {
    await next();
    if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', CACHE_RULES.api);
  });
  app.use('/api/*', rateLimit({ limiter: apiLimiter, clientIpMode: config.clientIp }));

  app.get('/api/health', (c) =>
    c.json({
      status: 'ok',
      name: APP_NAME,
      version: APP_VERSION,
      ai: { mode: gateway.mode, models: gateway.models },
      time: new Date(now()).toISOString(),
    }),
  );

  app.get('/api/config', (c) => {
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({
      ai: { mode: gateway.mode, requiresSignIn: config.requireAuthForAi },
      firebase: config.firebase,
      features: { cloudSync: config.firebase !== null },
    });
  });

  app.use('/api/ai/*', auth({ verifier, required: config.requireAuthForAi }));
  app.use(
    '/api/ai/*',
    rateLimit({
      limiter: aiLimiter,
      clientIpMode: config.clientIp,
      cost: (c) => AI_ROUTE_COST[c.req.path.split('/').pop() ?? ''] ?? 1,
    }),
  );
  app.route('/api/ai', aiRoutes(gateway, logger));

  app.all('/api/*', (c) =>
    c.json({ code: 'not_found', message: 'Not found', requestId: c.get('requestId') }, 404),
  );

  app.onError((error, c) => {
    const requestIdValue = c.get('requestId');
    if (error instanceof AppError) {
      if (error.retryAfterSeconds !== undefined)
        c.header('Retry-After', String(error.retryAfterSeconds));
      return c.json(
        { code: error.code, message: error.message, requestId: requestIdValue },
        error.status as 400 | 401 | 404 | 413 | 415 | 422 | 429 | 503,
      );
    }
    logger.error('http.unhandled_error', {
      requestId: requestIdValue,
      path: c.req.path,
      error: error instanceof Error ? error.name : 'unknown',
    });
    return c.json(
      {
        code: 'internal',
        message: 'Something went wrong on our side. Please try again.',
        requestId: requestIdValue,
      },
      500,
    );
  });

  return app;
}
