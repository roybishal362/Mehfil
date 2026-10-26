/**
 * Firebase Authentication on the AI gateway.
 *
 * ID tokens are verified exactly as Firebase documents for third-party JWT libraries: RS256
 * signature against Google's published keys, issuer `https://securetoken.google.com/<project>`,
 * audience `<project>`, expiry, and a non-empty subject. No service-account secret is needed.
 */
import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { unauthorized } from '../errors';
import type { AppEnv } from '../types';

const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

interface VerifiedUser {
  uid: string;
  anonymous: boolean;
}

export type TokenVerifier = (token: string) => Promise<VerifiedUser>;

export function firebaseTokenVerifier(
  projectId: string,
  keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL)),
  now: () => number = Date.now,
): TokenVerifier {
  return async (token) => {
    const { payload } = await jwtVerify(token, keys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
      currentDate: new Date(now()),
    });
    const uid = payload.sub;
    if (typeof uid !== 'string' || uid.length === 0 || uid.length > 128) {
      throw new Error('Token has no valid subject');
    }
    const authTime = payload.auth_time;
    if (typeof authTime !== 'number' || authTime * 1000 > now() + 60_000) {
      throw new Error('Token has an invalid auth_time');
    }
    const firebase = payload.firebase as { sign_in_provider?: unknown } | undefined;
    return { uid, anonymous: firebase?.sign_in_provider === 'anonymous' };
  };
}

/**
 * Verifies `Authorization: Bearer <Firebase ID token>` when present.
 * With `required`, requests without a valid token are rejected with 401.
 */
export function auth(options: {
  verifier: TokenVerifier | null;
  required: boolean;
}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    if (!token || !options.verifier) {
      if (options.required) throw unauthorized('Sign in to use the AI planner');
      await next();
      return;
    }
    try {
      const user = await options.verifier(token);
      c.set('uid', user.uid);
    } catch {
      throw unauthorized('Your session has expired. Please sign in again.');
    }
    await next();
  };
}
