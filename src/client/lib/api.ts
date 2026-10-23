/**
 * The browser's side of the Mehfil API. Every response is validated with the shared schemas
 * (the browser never trusts a payload's shape), failures become an ApiError carrying the
 * server's stable error code, and every call can be cancelled with an AbortSignal.
 */
import { z } from 'zod';

export class ApiError extends Error {
  /** HTTP status, or 0 when the server could not be reached. */
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, code: string, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const ErrorBody = z.object({ code: z.string(), message: z.string() }).partial();

/** Supplies a Firebase ID token once the user is signed in (see the cloud features). */
export type TokenProvider = () => Promise<string | null>;
let tokenProvider: TokenProvider | null = null;

export function setTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider;
}

async function requestHeaders(withJsonBody: boolean): Promise<Headers> {
  const headers = new Headers({ Accept: 'application/json' });
  if (withJsonBody) headers.set('Content-Type', 'application/json');
  const token = tokenProvider ? await tokenProvider() : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function send(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError(0, 'network', 'Could not reach Mehfil. Check your connection.');
  }
  if (response.ok) return response;
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error bodies (e.g. a proxy's HTML page) fall back to a generic message.
  }
  const parsed = ErrorBody.safeParse(body);
  const retryAfter = Number(response.headers.get('Retry-After'));
  throw new ApiError(
    response.status,
    (parsed.success ? parsed.data.code : undefined) ?? 'http_error',
    (parsed.success ? parsed.data.message : undefined) ?? 'Something went wrong. Please try again.',
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  );
}

function validated<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(200, 'invalid_response', 'The server sent an unexpected answer.');
  }
  return result.data;
}

export async function getJson<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await send(path, {
    method: 'GET',
    headers: await requestHeaders(false),
    ...(signal ? { signal } : {}),
  });
  return validated(schema, await response.json());
}

export async function postJson<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await send(path, {
    method: 'POST',
    headers: await requestHeaders(true),
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  return validated(schema, await response.json());
}

/**
 * Reads newline-delimited JSON from a stream, calling `onLine` for each complete line as soon
 * as it arrives. Chunks may split a line anywhere, including inside a multi-byte character.
 */
export async function readNdjson(
  stream: ReadableStream<Uint8Array>,
  onLine: (value: unknown) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const emit = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch {
      throw new ApiError(200, 'invalid_response', 'The server sent an unexpected answer.');
    }
    onLine(value);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      emit(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
    }
  }
  emit(buffer + decoder.decode());
}

/** POSTs JSON and streams the NDJSON answer, validating each line with `schema`. */
export async function postNdjson<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  onEvent: (event: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await send(path, {
    method: 'POST',
    headers: await requestHeaders(true),
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (!response.body) throw new ApiError(200, 'invalid_response', 'The server sent no data.');
  await readNdjson(response.body, (value) => {
    onEvent(validated(schema, value));
  });
}
