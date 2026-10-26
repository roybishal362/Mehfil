import { describe, expect, it, vi } from 'vitest';
import * as z from '../../shared/zod';
import { jsonResponse, mockApi } from '../test/helpers';
import { ApiError, getJson, postJson, postNdjson, readNdjson, setTokenProvider } from './api';

const Answer = z.object({ answer: z.number() });

function streamOf(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe('readNdjson', () => {
  it('emits each line as soon as it is complete, however the chunks fall', async () => {
    const bytes = new TextEncoder().encode('{"a":1}\n{"b":"বাংলা"}\n\n{"c":3}');
    // Split inside the Bengali text so a multi-byte character spans two chunks.
    const split = bytes.indexOf(0xe0) + 1;
    const lines: unknown[] = [];
    await readNdjson(
      streamOf([bytes.slice(0, 4), bytes.slice(4, split), bytes.slice(split)]),
      (value) => {
        lines.push(value);
      },
    );
    expect(lines).toEqual([{ a: 1 }, { b: 'বাংলা' }, { c: 3 }]);
  });

  it('rejects a line that is not JSON', async () => {
    const bytes = new TextEncoder().encode('{"a":1}\nnot json\n');
    await expect(readNdjson(streamOf([bytes]), () => undefined)).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });
});

describe('getJson and postJson', () => {
  it('validates successful answers', async () => {
    mockApi({ '/api/x': () => jsonResponse({ answer: 42 }) });
    await expect(getJson('/api/x', Answer)).resolves.toEqual({ answer: 42 });
    await expect(postJson('/api/x', { q: 1 }, Answer)).resolves.toEqual({ answer: 42 });
  });

  it('refuses answers of the wrong shape', async () => {
    mockApi({ '/api/x': () => jsonResponse({ answer: 'forty-two' }) });
    await expect(getJson('/api/x', Answer)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it("turns server errors into ApiError with the server's code and Retry-After", async () => {
    mockApi({
      '/api/x': () =>
        jsonResponse({ code: 'ai_unavailable', message: 'Busy' }, 503, { 'Retry-After': '30' }),
    });
    const error = await postJson('/api/x', {}, Answer).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 503,
      code: 'ai_unavailable',
      message: 'Busy',
      retryAfterSeconds: 30,
    });
  });

  it('copes with error pages that are not JSON', async () => {
    mockApi({ '/api/x': () => new Response('<html>Bad gateway</html>', { status: 502 }) });
    await expect(getJson('/api/x', Answer)).rejects.toMatchObject({
      status: 502,
      code: 'http_error',
    });
  });

  it('reports a network failure as status 0, but lets a cancellation through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(getJson('/api/x', Answer)).rejects.toMatchObject({ status: 0, code: 'network' });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new DOMException('Aborted', 'AbortError'))),
    );
    await expect(getJson('/api/x', Answer)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('sends the signed-in user’s token when a provider is set', async () => {
    const { calls } = mockApi({ '/api/x': () => jsonResponse({ answer: 1 }) });
    setTokenProvider(() => Promise.resolve('id-token-123'));
    await postJson('/api/x', {}, Answer);
    setTokenProvider(null);
    await postJson('/api/x', {}, Answer);
    expect(calls[0]?.headers.get('Authorization')).toBe('Bearer id-token-123');
    expect(calls[0]?.headers.get('Content-Type')).toBe('application/json');
    expect(calls[1]?.headers.get('Authorization')).toBeNull();
  });
});

describe('postNdjson', () => {
  const request = { path: '/api/s', body: {}, schema: Answer, onEvent: () => undefined };

  it('validates every streamed event', async () => {
    mockApi({ '/api/s': () => new Response('{"answer":1}\n{"answer":2}\n') });
    const seen: number[] = [];
    await postNdjson({ ...request, onEvent: (event) => seen.push(event.answer) });
    expect(seen).toEqual([1, 2]);
    mockApi({ '/api/s': () => new Response('{"answer":1}\n{"oops":true}\n') });
    await expect(postNdjson(request)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('needs a body to stream', async () => {
    mockApi({ '/api/s': () => new Response(null, { status: 200 }) });
    await expect(postNdjson(request)).rejects.toBeInstanceOf(ApiError);
  });
});
