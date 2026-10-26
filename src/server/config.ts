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
  // Measured on the free tier (evals/models.ts): 3.5 Flash answers the ideas task in about
  // 5 seconds, while 3.7 and 3.8 Flash timed out. Override per deployment if that changes.
  GEMINI_MODEL_SMART: z.string().trim().min(1).default('gemini-3.5-flash'),
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

interface FirebaseWebConfig {
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

type Env = z.infer<typeof Env>;

/** Gemini when a key is set, the demo provider otherwise; asking for Gemini without a key fails. */
function aiConfig(env: Env): AppConfig['ai'] {
  const apiKey = env.GEMINI_API_KEY === '' ? undefined : env.GEMINI_API_KEY;
  const provider = env.AI_PROVIDER ?? (apiKey ? 'gemini' : 'mock');
  if (provider === 'gemini' && !apiKey) {
    throw new ConfigError('AI_PROVIDER=gemini needs GEMINI_API_KEY');
  }
  return {
    provider,
    ...(apiKey ? { apiKey } : {}),
    models: { smart: env.GEMINI_MODEL_SMART, fast: env.GEMINI_MODEL_FAST },
    maxRequestsPerMinute: env.AI_MAX_RPM,
    mockDelayMs: env.MOCK_AI_DELAY_MS,
    rateLimit: env.AI_RATE_LIMIT,
  };
}

/** Firebase is on only when its project, key and auth domain are all set. */
function firebaseConfig(env: Env): AppConfig['firebase'] {
  const { FIREBASE_PROJECT_ID, FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_APP_ID } = env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_API_KEY || !FIREBASE_AUTH_DOMAIN) return null;
  return {
    projectId: FIREBASE_PROJECT_ID,
    apiKey: FIREBASE_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    ...(FIREBASE_APP_ID ? { appId: FIREBASE_APP_ID } : {}),
  };
}

export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new ConfigError(`Invalid server configuration: ${fields}`);
  }
  const env = parsed.data;
  const firebase = firebaseConfig(env);
  return {
    env: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    ai: aiConfig(env),
    firebase,
    requireAuthForAi: firebase !== null && env.REQUIRE_AUTH_FOR_AI !== 'false',
    clientIp: env.VERCEL ? 'vercel' : 'socket',
  };
}
