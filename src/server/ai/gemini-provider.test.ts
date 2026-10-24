import { ApiError, FinishReason, ThinkingLevel, type GoogleGenAI } from '@google/genai';
import { describe, expect, it } from 'vitest';
import * as z from '../../shared/zod';
import { GeminiProvider, classifyError, thinkingFor } from './gemini-provider';
import { AiError, withTimeout } from './provider';

type Handler = (params: Record<string, unknown>) => Promise<unknown>;

function fakeClient(handler: Handler): GoogleGenAI {
  return { models: { generateContent: handler } } as unknown as GoogleGenAI;
}

function response(fields: Record<string, unknown>) {
  return {
    candidates: [{ finishReason: FinishReason.STOP }],
    usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40, thoughtsTokenCount: 8 },
    ...fields,
  };
}

const schema = z.object({ answer: z.string() });
const base = {
  task: 'brief' as const,
  model: 'gemini-3.5-flash-lite',
  system: 'rules',
  prompt: 'question',
  schema,
  temperature: 0.2,
  maxOutputTokens: 256,
  thinking: 'minimal' as const,
  timeoutMs: 5000,
};

describe('GeminiProvider.generateJson', () => {
  it('sends structured-output settings and validates the answer', async () => {
    let sent: Record<string, unknown> = {};
    const provider = new GeminiProvider(
      'key',
      fakeClient((params) => {
        sent = params;
        return Promise.resolve(response({ text: '{"answer":"yes"}' }));
      }),
    );
    const result = await provider.generateJson(base);
    expect(result).toEqual({
      data: { answer: 'yes' },
      model: 'gemini-3.5-flash-lite',
      usage: { inputTokens: 120, outputTokens: 40, thoughtTokens: 8 },
    });
    const config = sent.config as Record<string, unknown>;
    expect(config.responseMimeType).toBe('application/json');
    expect(config.systemInstruction).toBe('rules');
    expect(config.thinkingConfig).toEqual({ thinkingLevel: ThinkingLevel.MINIMAL });
    expect(config.responseJsonSchema).toMatchObject({ type: 'object', required: ['answer'] });
  });

  it.each([
    [
      'blocked prompt',
      response({ promptFeedback: { blockReason: 'SAFETY' }, text: '' }),
      'blocked',
    ],
    [
      'blocked answer',
      response({ candidates: [{ finishReason: FinishReason.SAFETY }], text: '' }),
      'blocked',
    ],
    [
      'cut-off answer',
      response({ candidates: [{ finishReason: FinishReason.MAX_TOKENS }], text: '{"ans' }),
      'invalid_output',
    ],
    [
      'malformed tool call',
      response({ candidates: [{ finishReason: FinishReason.MALFORMED_FUNCTION_CALL }] }),
      'invalid_output',
    ],
    ['not JSON', response({ text: 'Sure! Here you go' }), 'invalid_output'],
    ['wrong shape', response({ text: '{"answer": 42}' }), 'invalid_output'],
  ])('classifies a %s', async (_name, answer, kind) => {
    const provider = new GeminiProvider(
      'key',
      fakeClient(() => Promise.resolve(answer)),
    );
    await expect(provider.generateJson(base)).rejects.toMatchObject({ kind });
  });

  it.each([
    [429, 'rate_limited'],
    [401, 'auth'],
    [403, 'auth'],
    [400, 'bad_request'],
    [503, 'unavailable'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    const provider = new GeminiProvider(
      'key',
      fakeClient(() => Promise.reject(new ApiError({ message: 'x', status }))),
    );
    await expect(provider.generateJson(base)).rejects.toMatchObject({ kind });
  });

  it('reports cancellation and timeouts', async () => {
    const controller = new AbortController();
    controller.abort();
    const provider = new GeminiProvider(
      'key',
      fakeClient(() => Promise.reject(new Error('aborted'))),
    );
    await expect(
      provider.generateJson({ ...base, signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'aborted' });

    const timedOut = AbortSignal.abort();
    expect(classifyError(new Error('x'), timedOut).kind).toBe('timeout');
    expect(classifyError(new Error('network'), new AbortController().signal).kind).toBe(
      'unavailable',
    );
    const existing = new AiError('blocked', 'x');
    expect(classifyError(existing, new AbortController().signal)).toBe(existing);
  });
});

describe('GeminiProvider.generateWithTools', () => {
  it('declares tools and returns text plus function calls', async () => {
    let sent: Record<string, unknown> = {};
    const provider = new GeminiProvider(
      'key',
      fakeClient((params) => {
        sent = params;
        return Promise.resolve(
          response({
            text: 'Here is the plan.',
            functionCalls: [{ name: 'add_task', args: { title: 'Book a dhaki' } }, { args: {} }],
          }),
        );
      }),
    );
    const result = await provider.generateWithTools({
      ...base,
      model: 'gemini-3.8-flash',
      thinking: 'minimal',
      contents: [{ role: 'user', text: 'add a task' }],
      tools: [
        {
          name: 'add_task',
          description: 'Add a task',
          parameters: z.object({ title: z.string() }),
        },
      ],
    });
    expect(result.data).toEqual({
      text: 'Here is the plan.',
      calls: [
        { name: 'add_task', args: { title: 'Book a dhaki' } },
        { name: '', args: {} },
      ],
    });
    const config = sent.config as {
      tools: { functionDeclarations: { name: string }[] }[];
      thinkingConfig: unknown;
    };
    expect(config.tools[0]?.functionDeclarations[0]?.name).toBe('add_task');
    // 3.8 Flash has no "minimal" thinking level, so the request is upgraded to "low".
    expect(config.thinkingConfig).toEqual({ thinkingLevel: ThinkingLevel.LOW });
  });

  it('handles answers without text or calls', async () => {
    const provider = new GeminiProvider(
      'key',
      fakeClient(() => Promise.resolve(response({}))),
    );
    const result = await provider.generateWithTools({ ...base, contents: [], tools: [] });
    expect(result.data).toEqual({ text: '', calls: [] });
  });

  it('classifies tool-call failures too', async () => {
    const provider = new GeminiProvider(
      'key',
      fakeClient(() => Promise.reject(new ApiError({ message: 'x', status: 429 }))),
    );
    await expect(
      provider.generateWithTools({ ...base, contents: [], tools: [] }),
    ).rejects.toMatchObject({ kind: 'rate_limited' });
  });
});

describe('helpers', () => {
  it('maps thinking levels per model family', () => {
    expect(thinkingFor('gemini-3.5-flash-lite', 'minimal')).toBe(ThinkingLevel.MINIMAL);
    expect(thinkingFor('gemini-3.8-flash', 'minimal')).toBe(ThinkingLevel.LOW);
    expect(thinkingFor('gemini-3.8-flash', 'high')).toBe(ThinkingLevel.HIGH);
  });

  it('builds the SDK client from an API key', () => {
    expect(new GeminiProvider('key').name).toBe('gemini');
  });

  it('combines cancellation with a timeout', () => {
    const controller = new AbortController();
    const signal = withTimeout(10_000, controller.signal);
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
    expect(withTimeout(10_000).aborted).toBe(false);
  });

  it('knows which errors are worth retrying', () => {
    expect(new AiError('timeout', 'x').retryable).toBe(true);
    expect(new AiError('auth', 'x').retryable).toBe(false);
  });
});
