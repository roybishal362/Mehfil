/**
 * Server configuration, read once from the environment and validated.
 * Secrets (the Gemini key) stay on the server; only the public Firebase web config is exposed.
 */
import * as z from '../shared/zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  AI_PROVIDER: z.enum(['gemini', 'mock']).optional(),
  GEMINI_API_KEY: z.string().trim().optional(),
  GEMINI_MODEL_SMART: z.string().trim().min(1).default('gemini-3.8-flash'),
  GEMINI_MODEL_FAST: z.string().trim().min(1).default('gemini-3.5-flash-lite'),
  AI_MAX_RPM: z.coerce.number().int().min(1).max(1000).default(12),
  /** AI tokens each visitor gets per 10 minutes (personalising a plan costs 4). */
  AI_RATE_LIMIT: z.coerce.number().int().min(1).max(100_000).default(24),
  /** Simulated latency for the mock provider, so demo mode shows the streaming UI. */
  MOCK_AI_DELAY_MS: z.coerce.number().int().min(0).max(10_000).default(0),
  FIREBASE_PROJECT_ID: z.string().trim().optional(),
  FIREBASE_API_KEY: z.string().trim().optional(),
  FIREBASE_AUTH_DOMAIN: z.string().trim().optional(),
  FIREBASE_APP_ID: z.string().trim().optional(),
  REQUIRE_AUTH_FOR_AI: z.enum(['true', 'false']).optional(),
  VERCEL: z.string().optional(),
});

export interface FirebaseWebConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  appId?: string;
}

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  ai: {
    provider: 'gemini' | 'mock';
    apiKey?: string;
    models: { smart: string; fast: string };
    maxRequestsPerMinute: number;
    mockDelayMs: number;
    /** Per-visitor allowance of AI tokens, refilled over 10 minutes. */
    rateLimit: number;
  };
  /** Public Firebase web config, or null when cloud features are not configured. */
  firebase: FirebaseWebConfig | null;
  requireAuthForAi: boolean;
  /** How to find the client IP: Vercel's trusted header, or the socket address. */
  clientIp: 'vercel' | 'socket';
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new ConfigError(`Invalid server configuration: ${fields}`);
  }
  const env = parsed.data;
  const apiKey = env.GEMINI_API_KEY === '' ? undefined : env.GEMINI_API_KEY;
  const provider = env.AI_PROVIDER ?? (apiKey ? 'gemini' : 'mock');
  if (provider === 'gemini' && !apiKey) {
    throw new ConfigError('AI_PROVIDER=gemini needs GEMINI_API_KEY');
  }
  const firebase =
    env.FIREBASE_PROJECT_ID && env.FIREBASE_API_KEY && env.FIREBASE_AUTH_DOMAIN
      ? {
          projectId: env.FIREBASE_PROJECT_ID,
          apiKey: env.FIREBASE_API_KEY,
          authDomain: env.FIREBASE_AUTH_DOMAIN,
          ...(env.FIREBASE_APP_ID ? { appId: env.FIREBASE_APP_ID } : {}),
        }
      : null;
  return {
    env: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    ai: {
      provider,
      ...(apiKey ? { apiKey } : {}),
      models: { smart: env.GEMINI_MODEL_SMART, fast: env.GEMINI_MODEL_FAST },
      maxRequestsPerMinute: env.AI_MAX_RPM,
      mockDelayMs: env.MOCK_AI_DELAY_MS,
      rateLimit: env.AI_RATE_LIMIT,
    },
    firebase,
    requireAuthForAi: firebase !== null && env.REQUIRE_AUTH_FOR_AI !== 'false',
    clientIp: env.VERCEL ? 'vercel' : 'socket',
  };
}
