import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { silentLogger } from '../logger';
import { AiGateway } from './gateway';
import {
  AiError,
  type AiProvider,
  type AiResult,
  type JsonRequest,
  type ToolRequest,
  type ToolResponse,
} from './provider';

type Script = (model: string, call: number) => unknown;

/** A provider whose answers (or failures) are scripted per model and call number. */
class ScriptedProvider implements AiProvider {
  readonly name = 'gemini';
  readonly calls: string[] = [];
  private readonly script: Script;

  constructor(script: Script) {
    this.script = script;
  }

  generateJson<T>(request: JsonRequest<T>): Promise<AiResult<T>> {
    this.calls.push(request.model);
    try {
      const value = this.script(request.model, this.calls.length);
      return Promise.resolve({
        data: request.schema.parse(value),
        model: request.model,
        usage: { inputTokens: 10 },
      });
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  generateWithTools(request: ToolRequest): Promise<AiResult<ToolResponse>> {
    this.calls.push(request.model);
    return Promise.resolve({ data: { text: 'ok', calls: [] }, model: request.model, usage: {} });
  }
}

const MODELS = { smart: 'smart-model', fast: 'fast-model' };

function makeGateway(script: Script, options: { maxRpm?: number; now?: () => number } = {}) {
  const provider = new ScriptedProvider(script);
  const gateway = new AiGateway({
    provider,
    models: MODELS,
    maxRequestsPerMinute: options.maxRpm ?? 100,
    logger: silentLogger,
    sleep: () => Promise.resolve(),
    random: () => 0,
    ...(options.now ? { now: options.now } : {}),
  });
  return { gateway, provider };
}

const schema = z.object({ answer: z.string() });
const request = (prompt = 'p'): JsonRequest<{ answer: string }> => ({
  task: 'brief',
  model: MODELS.fast,
  system: 's',
  prompt,
  schema,
  temperature: 0,
  maxOutputTokens: 100,
  thinking: 'minimal',
  timeoutMs: 10_000,
});

describe('AiGateway', () => {
  it('answers identical requests from the cache', async () => {
    const { gateway, provider } = makeGateway(() => ({ answer: 'hi' }));
    const first = await gateway.json(request(), 20_000);
    const second = await gateway.json(request(), 20_000);
    expect(first).toMatchObject({ data: { answer: 'hi' }, cached: false, model: MODELS.fast });
    expect(second.cached).toBe(true);
    expect(provider.calls).toHaveLength(1);
    await gateway.json(request('different'), 20_000);
    expect(provider.calls).toHaveLength(2);
  });

  it('switches to the other model when the first is rate limited', async () => {
    const { gateway, provider } = makeGateway((model) => {
      if (model === MODELS.fast) throw new AiError('rate_limited', 'slow down');
      return { answer: 'from smart' };
    });
    const outcome = await gateway.json(request(), 20_000);
    expect(outcome).toMatchObject({ data: { answer: 'from smart' }, model: MODELS.smart });
    expect(provider.calls).toEqual([MODELS.fast, MODELS.smart]);
  });

  it('retries a transient failure once on the same model', async () => {
    const { gateway, provider } = makeGateway((_model, call) => {
      if (call === 1) throw new AiError('timeout', 'slow');
      return { answer: 'second try' };
    });
    expect((await gateway.json(request(), 20_000)).data.answer).toBe('second try');
    expect(provider.calls).toEqual([MODELS.fast, MODELS.fast]);
  });

  it('gives up immediately on auth errors and safety blocks', async () => {
    for (const kind of ['auth', 'blocked'] as const) {
      const { gateway, provider } = makeGateway(() => {
        throw new AiError(kind, kind);
      });
      await expect(gateway.json(request(), 20_000)).rejects.toMatchObject({ kind });
      expect(provider.calls).toHaveLength(1);
    }
  });

  it('propagates cancellation without trying other models', async () => {
    const { gateway, provider } = makeGateway(() => {
      throw new AiError('aborted', 'cancelled');
    });
    await expect(gateway.json(request(), 20_000)).rejects.toMatchObject({ kind: 'aborted' });
    expect(provider.calls).toHaveLength(1);
  });

  it('wraps unexpected errors and reports the last failure', async () => {
    const { gateway } = makeGateway(() => {
      throw new Error('socket hang up');
    });
    await expect(gateway.json(request(), 20_000)).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('skips a model whose circuit is open', async () => {
    let failFast = true;
    const { gateway, provider } = makeGateway((model) => {
      if (model === MODELS.fast && failFast) throw new AiError('unavailable', 'down');
      return { answer: model };
    });
    // Three requests: each fails twice on fast (retry) before falling back; the circuit then opens.
    for (const prompt of ['a', 'b']) await gateway.json(request(prompt), 20_000);
    provider.calls.length = 0;
    failFast = false;
    const outcome = await gateway.json(request('c'), 20_000);
    expect(outcome.model).toBe(MODELS.smart);
    expect(provider.calls).toEqual([MODELS.smart]);
  });

  it('lets a model recover after a trial call that ended without a verdict', async () => {
    let time = 0;
    let fast: 'down' | 'garbled' | 'up' = 'down';
    const { gateway, provider } = makeGateway(
      (model) => {
        if (model === MODELS.fast && fast === 'down') throw new AiError('unavailable', 'down');
        if (model === MODELS.fast && fast === 'garbled') {
          throw new AiError('invalid_output', 'not JSON');
        }
        return { answer: model };
      },
      { now: () => time },
    );
    // Two requests, two attempts each: the third failure opens the fast model's circuit.
    for (const prompt of ['a', 'b']) await gateway.json(request(prompt), 20_000);
    time += 60_000; // half-open: one trial call is allowed
    fast = 'garbled'; // the trial neither proves nor disproves the model's health
    expect((await gateway.json(request('c'), 20_000)).model).toBe(MODELS.smart);
    fast = 'up';
    provider.calls.length = 0;
    expect((await gateway.json(request('d'), 20_000)).model).toBe(MODELS.fast);
    expect(provider.calls).toEqual([MODELS.fast]);
  });

  it('falls back from the smart model to the fast one', async () => {
    const { gateway, provider } = makeGateway((model) => {
      if (model === MODELS.smart) throw new AiError('unavailable', 'down');
      return { answer: model };
    });
    const outcome = await gateway.json({ ...request(), model: MODELS.smart }, 20_000);
    expect(outcome.model).toBe(MODELS.fast);
    expect(provider.calls).toEqual([MODELS.smart, MODELS.smart, MODELS.fast]);
  });

  it('respects the per-minute budget and falls back when it is spent', async () => {
    const { gateway, provider } = makeGateway((model) => ({ answer: model }), { maxRpm: 1 });
    expect((await gateway.json(request('one'), 20_000)).model).toBe(MODELS.fast);
    expect((await gateway.json(request('two'), 20_000)).model).toBe(MODELS.smart);
    await expect(gateway.json(request('three'), 20_000)).rejects.toMatchObject({
      kind: 'rate_limited',
    });
    expect(provider.calls).toEqual([MODELS.fast, MODELS.smart]);
  });

  it('stops when the overall deadline is too short', async () => {
    const { gateway } = makeGateway(() => ({ answer: 'never' }));
    await expect(gateway.json(request(), 1000)).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('routes tool calls through the same fallback chain', async () => {
    const { gateway } = makeGateway(() => ({ answer: 'x' }));
    const outcome = await gateway.tools(
      {
        task: 'copilot',
        model: MODELS.smart,
        system: 's',
        contents: [{ role: 'user', text: 'hi' }],
        tools: [],
        temperature: 0,
        maxOutputTokens: 10,
        thinking: 'low',
        timeoutMs: 10_000,
      },
      20_000,
    );
    expect(outcome).toMatchObject({ data: { text: 'ok' }, model: MODELS.smart, cached: false });
  });
});
