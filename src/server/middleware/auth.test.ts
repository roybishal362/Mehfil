import { Hono } from 'hono';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import type { AppEnv } from '../types';
import { auth, firebaseTokenVerifier, type TokenVerifier } from './auth';

const PROJECT = 'mehfil-demo';
const NOW = Date.UTC(2026, 9, 23, 10, 0, 0);
let sign: (
  claims?: JWTPayload,
  options?: { issuer?: string; audience?: string; expiresIn?: number; subject?: string | null },
) => Promise<string>;
let verifier: TokenVerifier;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256' };
  verifier = firebaseTokenVerifier(PROJECT, createLocalJWKSet({ keys: [jwk] }), () => NOW);
  sign = async (claims = {}, options = {}) => {
    const seconds = Math.floor(NOW / 1000);
    const jwt = new SignJWT({
      auth_time: seconds - 60,
      firebase: { sign_in_provider: 'anonymous' },
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(options.issuer ?? `https://securetoken.google.com/${PROJECT}`)
      .setAudience(options.audience ?? PROJECT)
      .setIssuedAt(seconds - 60)
      .setExpirationTime(seconds + (options.expiresIn ?? 3600));
    if (options.subject !== null) jwt.setSubject(options.subject ?? 'user-123');
    return jwt.sign(privateKey);
  };
});

describe('firebaseTokenVerifier', () => {
  it('accepts a valid Firebase ID token', async () => {
    await expect(verifier(await sign())).resolves.toEqual({ uid: 'user-123', anonymous: true });
    await expect(
      verifier(await sign({ firebase: { sign_in_provider: 'google.com' } })),
    ).resolves.toEqual({
      uid: 'user-123',
      anonymous: false,
    });
  });

  it.each([
    ['another project', { audience: 'someone-else' }],
    ['a different issuer', { issuer: 'https://evil.example' }],
    ['an expired token', { expiresIn: -10 }],
    ['a token without a subject', { subject: null }],
  ])('rejects %s', async (_name, options) => {
    await expect(verifier(await sign({}, options))).rejects.toThrow();
  });

  it('rejects tokens whose sign-in time is in the future', async () => {
    await expect(
      verifier(await sign({ auth_time: Math.floor(NOW / 1000) + 3600 })),
    ).rejects.toThrow(/auth_time/);
  });

  it('rejects garbage', async () => {
    await expect(verifier('not-a-jwt')).rejects.toThrow();
  });
});

describe('auth middleware', () => {
  function appWith(required: boolean, tokenVerifier: TokenVerifier | null) {
    const app = new Hono<AppEnv>();
    app.use('*', auth({ verifier: tokenVerifier, required }));
    app.get('/', (c) => c.json({ uid: c.get('uid') ?? null }));
    app.onError((error, c) =>
      error instanceof AppError ? c.json({ code: error.code }, 401) : c.json({ code: 'boom' }, 500),
    );
    return app;
  }

  it('lets anonymous requests through when sign-in is optional', async () => {
    const res = await appWith(false, verifier).request('/');
    expect(await res.json()).toEqual({ uid: null });
  });

  it('identifies the user when a valid token is sent', async () => {
    const res = await appWith(true, verifier).request('/', {
      headers: { Authorization: `Bearer ${await sign()}` },
    });
    expect(await res.json()).toEqual({ uid: 'user-123' });
  });

  it('rejects missing or invalid tokens when sign-in is required', async () => {
    expect((await appWith(true, verifier).request('/')).status).toBe(401);
    const bad = await appWith(false, verifier).request('/', {
      headers: { Authorization: 'Bearer nope' },
    });
    expect(bad.status).toBe(401);
    expect((await appWith(true, null).request('/')).status).toBe(401);
  });
});
