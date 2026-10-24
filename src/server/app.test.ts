/**
 * Integration tests: the real app, in-process, with the deterministic mock AI provider.
 * They cover the HTTP contract (status codes, headers, streaming) and the security behaviour.
 */
import { describe, expect, it } from 'vitest';
import {
  AiMetaInfo,
  BriefResponse,
  CopilotResponse,
  InvitationDraft,
  SECTION_DATA_SCHEMAS,
  type PersonalizeEvent,
} from '../shared/schemas/ai';
import type { AiSection } from '../shared/schemas/primitives';
import { weddingBriefInput } from '../shared/test/fixtures';
import { AiGateway } from './ai/gateway';
import { MockProvider } from './ai/mock-provider';
import {
  AiError,
  type AiErrorKind,
  type AiProvider,
  type AiResult,
  type AiTask,
  type JsonRequest,
  type ToolRequest,
  type ToolResponse,
} from './ai/provider';
import { createApp } from './app';
import { loadConfig } from './config';
import { createLogger, silentLogger, type Logger } from './logger';
import type { TokenVerifier } from './middleware/auth';

const TODAY = '2026-10-23';
const FIXED_NOW = Date.UTC(2026, 9, 23, 10, 0, 0);
const FIREBASE_ENV = {
  FIREBASE_PROJECT_ID: 'mehfil-demo',
  FIREBASE_API_KEY: 'public-web-api-key',
  FIREBASE_AUTH_DOMAIN: 'mehfil-demo.firebaseapp.com',
};

/** Accepts tokens of the form `valid-<uid>`. */
const fakeVerifier: TokenVerifier = (token) =>
  token.startsWith('valid-')
    ? Promise.resolve({ uid: token.slice(6), anonymous: true })
    : Promise.reject(new Error('invalid token'));

/** The mock provider, except that chosen tasks fail or have their answers rewritten. */
class ScriptedMock implements AiProvider {
  readonly name = 'gemini';
  private readonly inner = new MockProvider();
  private readonly failures: Partial<Record<AiTask, AiErrorKind>>;
  private readonly rewrite: (task: AiTask, data: unknown) => unknown;

  constructor(
    failures: Partial<Record<AiTask, AiErrorKind>> = {},
    rewrite: (task: AiTask, data: unknown) => unknown = (_task, data) => data,
  ) {
    this.failures = failures;
    this.rewrite = rewrite;
  }

  async generateJson<T>(request: JsonRequest<T>): Promise<AiResult<T>> {
    const kind = this.failures[request.task];
    if (kind) throw new AiError(kind, 'upstream detail: quota project 1234 exhausted');
    const result = await this.inner.generateJson(request);
    return { ...result, data: this.rewrite(request.task, result.data) as T };
  }

  async generateWithTools(request: ToolRequest): Promise<AiResult<ToolResponse>> {
    const kind = this.failures[request.task];
    if (kind) throw new AiError(kind, 'upstream detail: quota project 1234 exhausted');
    return this.inner.generateWithTools(request);
  }
}

interface Setup {
  env?: Record<string, string>;
  provider?: AiProvider;
  verifier?: TokenVerifier | null;
  logger?: Logger;
}

function setup({
  env = {},
  provider = new MockProvider(),
  verifier = null,
  logger = silentLogger,
}: Setup = {}) {
  const config = loadConfig({ NODE_ENV: 'production', AI_PROVIDER: 'mock', ...env });
  const gateway = new AiGateway({
    provider,
    models: config.ai.models,
    maxRequestsPerMinute: 1000,
    logger,
    sleep: () => Promise.resolve(),
  });
  return createApp({ config, logger, gateway, verifier, now: () => FIXED_NOW });
}

const post = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const briefBody = {
  text: 'A Bengali wedding in Kolkata on 14 Feb 2027 for 300 guests, budget ₹18 lakh',
  today: TODAY,
};
const personalizeBody = (sections?: AiSection[]) => ({
  brief: weddingBriefInput,
  today: TODAY,
  ...(sections ? { sections } : {}),
});
const copilotBody = {
  brief: weddingBriefInput,
  today: TODAY,
  plan: {
    budget: {
      total: 1_800_000,
      lines: [{ id: 'line_1', name: 'Catering', planned: 560_000, spent: 0, perGuest: true }],
    },
    tasks: [
      {
        id: 'task_1',
        title: 'Book the venue',
        dueDate: '2026-11-01',
        priority: 'high',
        status: 'todo',
      },
    ],
    vendors: [{ id: 'vendor_1', name: 'Venue', status: 'researching', bookBy: '2026-11-01' }],
  },
  message: 'We are now expecting 350 guests',
};

async function readEvents(response: Response): Promise<PersonalizeEvent[]> {
  const text = await response.text();
  return text
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as PersonalizeEvent);
}

describe('platform endpoints', () => {
  it('reports health without caching', async () => {
    const res = await setup().request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: 'ok',
      name: 'Mehfil',
      ai: { mode: 'mock', models: { smart: 'gemini-3.5-flash', fast: 'gemini-3.5-flash-lite' } },
      time: new Date(FIXED_NOW).toISOString(),
    });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('RateLimit-Limit')).toBe('120');
  });

  it('exposes only public configuration', async () => {
    const plain = await setup().request('/api/config');
    expect(await plain.json()).toEqual({
      ai: { mode: 'mock', requiresSignIn: false },
      firebase: null,
      features: { cloudSync: false },
    });
    expect(plain.headers.get('Cache-Control')).toBe('public, max-age=300');

    const app = setup({ env: { ...FIREBASE_ENV, GEMINI_API_KEY: 'server-only-secret-value' } });
    const body = await (await app.request('/api/config')).text();
    expect(JSON.parse(body)).toEqual({
      ai: { mode: 'mock', requiresSignIn: true },
      firebase: {
        projectId: 'mehfil-demo',
        apiKey: 'public-web-api-key',
        authDomain: 'mehfil-demo.firebaseapp.com',
      },
      features: { cloudSync: true },
    });
    expect(body).not.toContain('server-only-secret-value');
  });

  it('answers unknown API paths with a JSON 404', async () => {
    const res = await setup().request('/api/nope');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string; requestId: string };
    expect(body.code).toBe('not_found');
    expect(body.requestId).toBe(res.headers.get('X-Request-Id'));
  });

  it('hides internal error details and logs them without the message', async () => {
    const lines: string[] = [];
    const app = setup({ logger: createLogger('debug', (line) => lines.push(line)) });
    app.get('/boom', () => {
      throw new Error('database password is hunter2');
    });
    const res = await app.request('/boom');
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ code: 'internal' });
    expect(text).not.toContain('hunter2');
    expect(lines.join('\n')).toContain('http.unhandled_error');
    expect(lines.join('\n')).not.toContain('hunter2');
  });
});

describe('security headers', () => {
  it('sends a strict policy on every response in production', async () => {
    const app = setup();
    for (const res of [await app.request('/api/health'), await app.request('/api/nope')]) {
      const csp = res.headers.get('Content-Security-Policy') ?? '';
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain('upgrade-insecure-requests');
      expect(csp).not.toMatch(/unsafe-(inline|eval)/);
      expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=63072000');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups');
      expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
    }
  });

  it('relaxes only HSTS and the dev-server socket in development', async () => {
    const res = await setup({ env: { NODE_ENV: 'development' } }).request('/api/health');
    expect(res.headers.get('Strict-Transport-Security')).toBeNull();
    expect(res.headers.get('Content-Security-Policy')).toContain('ws://localhost:*');
  });

  it('reuses safe request IDs and replaces unsafe ones', async () => {
    const app = setup();
    const kept = await app.request('/api/health', {
      headers: { 'X-Request-Id': 'trace_abc-12345' },
    });
    expect(kept.headers.get('X-Request-Id')).toBe('trace_abc-12345');
    for (const unsafe of ['<script>alert(1)</script>', 'short', 'has spaces in it']) {
      const res = await app.request('/api/health', { headers: { 'X-Request-Id': unsafe } });
      expect(res.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});

describe('request validation', () => {
  it('requires JSON', async () => {
    const res = await setup().request('/api/ai/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello',
    });
    expect(res.status).toBe(415);
    expect(await res.json()).toMatchObject({ code: 'unsupported_media_type' });
  });

  it('rejects malformed JSON', async () => {
    const res = await setup().request('/api/ai/brief', post('{"text": '));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: 'bad_request',
      message: 'The request body is not valid JSON',
    });
  });

  it('names invalid fields without echoing what was sent', async () => {
    const res = await setup().request(
      '/api/ai/brief',
      post({ text: '', today: '<img src=x onerror=alert(1)>' }),
    );
    expect(res.status).toBe(400);
    const { message } = (await res.json()) as { message: string };
    expect(message).toContain('text');
    expect(message).toContain('today');
    expect(message).not.toContain('onerror');
  });

  it('rejects bodies over 32 KB', async () => {
    const res = await setup().request(
      '/api/ai/brief',
      post({ text: 'x'.repeat(40_000), today: TODAY }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: 'payload_too_large' });
  });
});

describe('rate limiting', () => {
  it('limits ordinary API calls per client', async () => {
    const app = setup();
    for (let i = 0; i < 120; i += 1) expect((await app.request('/api/health')).status).toBe(200);
    const blocked = await app.request('/api/health');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
    expect(await blocked.json()).toMatchObject({ code: 'rate_limited' });
  });

  it('charges expensive AI calls more', async () => {
    const app = setup();
    for (let i = 0; i < 6; i += 1) {
      const res = await app.request('/api/ai/personalize', post(personalizeBody(['budget'])));
      expect(res.status).toBe(200);
      await res.text();
    }
    const blocked = await app.request('/api/ai/personalize', post(personalizeBody(['budget'])));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(blocked.headers.get('RateLimit-Remaining')).toBe('0');
  });
});

describe('sign-in for AI routes', () => {
  const app = () => setup({ env: FIREBASE_ENV, verifier: fakeVerifier });
  const signedIn = (uid: string) => ({ Authorization: `Bearer valid-${uid}` });

  it('requires a valid Firebase ID token when Firebase is configured', async () => {
    const shared = app();
    expect((await shared.request('/api/health')).status).toBe(200);
    const missing = await shared.request('/api/ai/brief', post(briefBody));
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({ code: 'unauthorized' });
    expect(
      (await shared.request('/api/ai/brief', post(briefBody, { Authorization: 'Bearer forged' })))
        .status,
    ).toBe(401);
    expect((await shared.request('/api/ai/brief', post(briefBody, signedIn('asha')))).status).toBe(
      200,
    );
  });

  it('can be switched off for open demos', async () => {
    const open = setup({
      env: { ...FIREBASE_ENV, REQUIRE_AUTH_FOR_AI: 'false' },
      verifier: fakeVerifier,
    });
    expect((await open.request('/api/ai/brief', post(briefBody))).status).toBe(200);
  });

  it('gives each signed-in user their own AI allowance', async () => {
    const shared = app();
    for (let i = 0; i < 6; i += 1) {
      await (
        await shared.request(
          '/api/ai/personalize',
          post(personalizeBody(['ideas']), signedIn('asha')),
        )
      ).text();
    }
    expect(
      (
        await shared.request(
          '/api/ai/personalize',
          post(personalizeBody(['ideas']), signedIn('asha')),
        )
      ).status,
    ).toBe(429);
    const other = await shared.request(
      '/api/ai/personalize',
      post(personalizeBody(['ideas']), signedIn('ravi')),
    );
    expect(other.status).toBe(200);
    await other.text();
  });
});

describe('AI routes', () => {
  it('extracts a brief from a description', async () => {
    const res = await setup().request('/api/ai/brief', post(briefBody));
    expect(res.status).toBe(200);
    const body = (await res.json()) as BriefResponse & { meta: unknown };
    expect(BriefResponse.safeParse(body).success).toBe(true);
    expect(body.brief).toMatchObject({
      type: 'wedding',
      city: 'Kolkata',
      date: '2027-02-14',
      guestCount: 300,
      budget: 1_800_000,
    });
    expect(body.missing).toEqual([]);
    expect(AiMetaInfo.parse(body.meta).mode).toBe('mock');
  });

  it('streams each plan section as NDJSON, then a done line', async () => {
    const res = await setup().request('/api/ai/personalize', post(personalizeBody()));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/x-ndjson; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const events = await readEvents(res);
    expect(events.at(-1)?.type).toBe('done');
    const sections = events.filter((event) => event.type === 'section');
    expect(sections.map((event) => event.section).sort()).toEqual([
      'budget',
      'ideas',
      'timeline',
      'vendors',
    ]);
    for (const event of sections) {
      expect(SECTION_DATA_SCHEMAS[event.section].safeParse(event.data).success).toBe(true);
      expect(AiMetaInfo.safeParse(event.meta).success).toBe(true);
    }
  });

  it('streams only the requested sections', async () => {
    const events = await readEvents(
      await setup().request('/api/ai/personalize', post(personalizeBody(['ideas', 'ideas']))),
    );
    expect(events.map((event) => event.type)).toEqual(['section', 'done']);
  });

  it('reports a failed section without failing the others or leaking details', async () => {
    const provider = new ScriptedMock({ 'section.ideas': 'unavailable' });
    const res = await setup({ provider }).request('/api/ai/personalize', post(personalizeBody()));
    const text = await res.text();
    expect(text).not.toContain('quota project');
    const events = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as PersonalizeEvent);
    expect(events.filter((event) => event.type === 'section')).toHaveLength(3);
    expect(events.find((event) => event.type === 'section_error')).toEqual({
      type: 'section_error',
      section: 'ideas',
      code: 'unavailable',
      message: 'The AI is unavailable right now. Your plan still works; try again shortly.',
    });
    expect(events.at(-1)?.type).toBe('done');
  });

  it('removes contact details a model invents before they reach the browser', async () => {
    const provider = new ScriptedMock({}, (task, data) =>
      task === 'section.ideas'
        ? JSON.parse(
            JSON.stringify(data).replaceAll(
              '"description":"',
              '"description":"Call Raj Caterers on +91 98765 43210 or raj@caterers.example, www.caterers.example. ',
            ),
          )
        : data,
    );
    const text = await (
      await setup({ provider }).request('/api/ai/personalize', post(personalizeBody(['ideas'])))
    ).text();
    expect(text).toContain('Raj Caterers');
    expect(text).not.toContain('98765');
    expect(text).not.toContain('caterers.example');
  });

  it('refines one section from an instruction', async () => {
    const res = await setup().request(
      '/api/ai/refine',
      post({
        section: 'ideas',
        brief: weddingBriefInput,
        today: TODAY,
        instruction: 'More eco-friendly ideas',
        existing: ['Memory wall'],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { section: AiSection; data: unknown };
    expect(body.section).toBe('ideas');
    expect(SECTION_DATA_SCHEMAS.ideas.safeParse(body.data).success).toBe(true);
  });

  it('returns validated Copilot proposals', async () => {
    const res = await setup().request('/api/ai/copilot', post(copilotBody));
    expect(res.status).toBe(200);
    const body = CopilotResponse.parse(await res.json());
    expect(body.operations.map((operation) => operation.type)).toContain('guests.setCount');
    expect(body.dropped).toBe(0);
  });

  it('answers unknown AI routes with a 404', async () => {
    const res = await setup().request('/api/ai/teleport', post({}));
    expect(res.status).toBe(404);
  });

  it('keeps the stream well-formed when a task fails in an unexpected way', async () => {
    const config = loadConfig({ NODE_ENV: 'production', AI_PROVIDER: 'mock' });
    const broken = {
      mode: 'mock',
      models: config.ai.models,
      json: () => Promise.reject(new TypeError('Cannot read properties of undefined')),
      tools: () => Promise.reject(new TypeError('Cannot read properties of undefined')),
    } as unknown as AiGateway;
    const app = createApp({ config, logger: silentLogger, gateway: broken, verifier: null });
    const brief = await app.request('/api/ai/brief', post(briefBody));
    expect(brief.status).toBe(500);
    expect(await brief.text()).not.toContain('Cannot read');
    const events = await readEvents(
      await app.request('/api/ai/personalize', post(personalizeBody(['budget']))),
    );
    expect(events.map((event) => event.type)).toEqual(['section_error', 'done']);
  });

  it('drafts invitation variants', async () => {
    const res = await setup().request(
      '/api/ai/invitation',
      post({
        brief: weddingBriefInput,
        tone: 'warm',
        channel: 'whatsapp',
        language: 'en',
        hosts: 'The Sen family',
      }),
    );
    expect(res.status).toBe(200);
    const { variants } = InvitationDraft.parse(await res.json());
    expect(variants[0]?.text).toContain('The Sen family');
  });

  it.each([
    ['rate_limited', 503, 'ai_unavailable', '30'],
    ['timeout', 503, 'ai_unavailable', '30'],
    ['blocked', 422, 'ai_blocked', null],
  ] as const)('turns a %s model failure into %i %s', async (kind, status, code, retryAfter) => {
    const app = setup({ provider: new ScriptedMock({ brief: kind, copilot: kind }) });
    for (const [path, body] of [
      ['/api/ai/brief', briefBody],
      ['/api/ai/copilot', copilotBody],
    ] as const) {
      const res = await app.request(path, post(body));
      expect(res.status).toBe(status);
      expect(res.headers.get('Retry-After')).toBe(retryAfter);
      const text = await res.text();
      expect(JSON.parse(text)).toMatchObject({ code });
      expect(text).not.toContain('quota project');
    }
  });

  it('never logs what users typed', async () => {
    const lines: string[] = [];
    const app = setup({ logger: createLogger('debug', (line) => lines.push(line)) });
    await app.request(
      '/api/ai/brief',
      post({ ...briefBody, text: `${briefBody.text}. Surprise for Ananya-7731` }),
    );
    const log = lines.join('\n');
    expect(log).toContain('"message":"http.request"');
    expect(log).toContain('"path":"/api/ai/brief"');
    expect(log).not.toContain('Ananya-7731');
  });
});
