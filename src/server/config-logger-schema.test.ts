import { describe, expect, it, vi } from 'vitest';
import * as z from 'zod';
import {
  BriefExtraction,
  IdeasSectionData,
  InvitationDraft,
  TimelineSectionData,
  budgetSectionSchema,
  vendorsSectionSchema,
} from '../shared/schemas/ai';
import { sanitiseJsonSchema, toGeminiSchema } from './ai/json-schema';
import { ConfigError, loadConfig } from './config';
import { createLogger, silentLogger } from './logger';
import { contentSecurityPolicy, securityHeaders } from './security/headers';

describe('loadConfig', () => {
  it('runs in mock mode without a Gemini key', () => {
    const config = loadConfig({});
    expect(config.ai.provider).toBe('mock');
    expect(config.firebase).toBeNull();
    expect(config.requireAuthForAi).toBe(false);
    expect(config.clientIp).toBe('socket');
    expect(config.ai.models).toEqual({ smart: 'gemini-3.8-flash', fast: 'gemini-3.5-flash-lite' });
  });

  it('uses Gemini when a key is present and Firebase when fully configured', () => {
    const config = loadConfig({
      GEMINI_API_KEY: 'test-key',
      FIREBASE_PROJECT_ID: 'mehfil-demo',
      FIREBASE_API_KEY: 'public-web-key',
      FIREBASE_AUTH_DOMAIN: 'mehfil-demo.firebaseapp.com',
      VERCEL: '1',
      AI_MAX_RPM: '20',
    });
    expect(config.ai).toMatchObject({
      provider: 'gemini',
      apiKey: 'test-key',
      maxRequestsPerMinute: 20,
    });
    expect(config.firebase?.projectId).toBe('mehfil-demo');
    expect(config.requireAuthForAi).toBe(true);
    expect(config.clientIp).toBe('vercel');
    expect(
      loadConfig({
        FIREBASE_PROJECT_ID: 'p',
        FIREBASE_API_KEY: 'k',
        FIREBASE_AUTH_DOMAIN: 'd',
        REQUIRE_AUTH_FOR_AI: 'false',
      }).requireAuthForAi,
    ).toBe(false);
  });

  it('rejects inconsistent or invalid settings', () => {
    expect(() => loadConfig({ AI_PROVIDER: 'gemini' })).toThrow(ConfigError);
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/PORT/);
  });
});

describe('logger', () => {
  it('writes one JSON line per event and respects the level', () => {
    const lines: string[] = [];
    const logger = createLogger('info', (line) => lines.push(line));
    logger.debug('hidden');
    logger.info('shown', { requestId: 'r1', skipped: undefined });
    logger.warn('warned');
    logger.error('failed', { code: 500 });
    expect(lines).toHaveLength(3);
    const first = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(first).toMatchObject({ severity: 'INFO', message: 'shown', requestId: 'r1' });
    expect(first).not.toHaveProperty('skipped');
    expect(() => {
      silentLogger.info('nothing');
    }).not.toThrow();
  });
});

describe('default log sink', () => {
  it('writes information to stdout and problems to stderr', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const logger = createLogger('info');
      logger.debug('hidden');
      logger.info('started', { port: 8787 });
      logger.warn('slow');
      logger.error('failed');
      expect(stdout).toHaveBeenCalledTimes(1);
      expect(String(stdout.mock.calls[0]?.[0])).toContain('"port":8787');
      expect(stderr).toHaveBeenCalledTimes(2);
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });
});

describe('security headers', () => {
  it('builds a strict CSP without unsafe-inline', () => {
    const csp = contentSecurityPolicy({ production: true });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).not.toContain('unsafe-inline');
    expect(contentSecurityPolicy({ production: false })).toContain('ws://localhost:*');
  });

  it('adds HSTS only in production', () => {
    expect(securityHeaders({ production: true })['Strict-Transport-Security']).toMatch(
      /max-age=63072000/,
    );
    expect(securityHeaders({ production: false })).not.toHaveProperty('Strict-Transport-Security');
  });
});

describe('Gemini JSON schemas', () => {
  const allowed = new Set([
    'type',
    'properties',
    'required',
    'items',
    'enum',
    'description',
    'minimum',
    'maximum',
    'minItems',
    'maxItems',
    'additionalProperties',
    'anyOf',
    'format',
    'title',
  ]);

  function keywords(node: unknown, found = new Set<string>()): Set<string> {
    if (Array.isArray(node)) node.forEach((n) => keywords(n, found));
    else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (key === 'properties' && value && typeof value === 'object') {
          Object.values(value).forEach((v) => keywords(v, found));
        } else {
          found.add(key);
          keywords(value, found);
        }
      }
    }
    return found;
  }

  it.each([
    ['budget', budgetSectionSchema(['venue', 'catering'])],
    ['timeline', TimelineSectionData],
    ['vendors', vendorsSectionSchema(['caterer'])],
    ['ideas', IdeasSectionData],
    ['brief', BriefExtraction],
    ['invitation', InvitationDraft],
  ] as const)('converts the %s schema to supported keywords only', (_name, schema) => {
    const json = toGeminiSchema(schema);
    for (const key of keywords(json)) expect(allowed.has(key)).toBe(true);
    expect(JSON.stringify(json)).not.toContain('$schema');
  });

  it('keeps property names that look like keywords and drops unsupported formats', () => {
    const schema = z.object({ pattern: z.string().regex(/x/), when: z.string().describe('d') });
    const json = toGeminiSchema(schema) as { properties: Record<string, Record<string, unknown>> };
    expect(Object.keys(json.properties)).toEqual(['pattern', 'when']);
    expect(json.properties.pattern).not.toHaveProperty('pattern');
    expect(sanitiseJsonSchema({ type: 'string', format: 'email' })).toEqual({ type: 'string' });
    expect(sanitiseJsonSchema({ type: 'string', format: 'date' })).toEqual({
      type: 'string',
      format: 'date',
    });
  });
});
