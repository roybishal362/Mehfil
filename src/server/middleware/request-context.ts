/** Request IDs, security headers and access logging for every request. */
import type { MiddlewareHandler } from 'hono';
import type { Logger } from '../logger';
import { securityHeaders } from '../security/headers';
import type { AppEnv } from '../types';

const SAFE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Reuses a well-formed incoming X-Request-Id (e.g. from a proxy) or creates one. */
export function requestId(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const incoming = c.req.header('x-request-id');
    const id = incoming && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
    c.set('requestId', id);
    c.header('X-Request-Id', id);
    await next();
  };
}

export function applySecurityHeaders(production: boolean): MiddlewareHandler<AppEnv> {
  const headers = securityHeaders({ production });
  return async (c, next) => {
    await next();
    for (const [name, value] of Object.entries(headers)) c.res.headers.set(name, value);
  };
}

/** One structured line per API request: method, path, status and duration. Never bodies. */
export function accessLog(logger: Logger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const started = performance.now();
    await next();
    logger.info('http.request', {
      requestId: c.get('requestId'),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - started),
      signedIn: Boolean(c.get('uid')),
    });
  };
}
