/**
 * The browser's side of the Mehfil API. Every response is validated with the shared schemas
 * (the browser never trusts a payload's shape), failures become an ApiError carrying the
 * server's stable error code, and every call can be cancelled with an AbortSignal.
 */
import * as z from '../../shared/zod';

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

/**
 * GET endpoints (config, health) are public and never carry a token; POSTs to the AI endpoints
 * carry one. Keeping the config request token-free also matters because the token provider
 * itself waits for the config.
 */
async function requestHeaders({
  json,
  token,
}: {
  json: boolean;
  token: boolean;
}): Promise<Headers> {
  const headers = new Headers({ Accept: 'application/json' });
  if (json) headers.set('Content-Type', 'application/json');
  const idToken = token && tokenProvider ? await tokenProvider() : null;
  if (idToken) headers.set('Authorization', `Bearer ${idToken}`);
  return headers;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** A failed response as an ApiError, with the server's stable code and safe message. */
async function errorFrom(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error bodies (e.g. a proxy's HTML page) fall back to a generic message.
  }
  const parsed = ErrorBody.safeParse(body);
  const { code = 'http_error', message = 'Something went wrong. Please try again.' } =
    parsed.success ? parsed.data : {};
  const retryAfter = Number(response.headers.get('Retry-After'));
  const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
  return new ApiError(response.status, code, message, wait);
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
  throw await errorFrom(response);
}

/** A signed-in JSON POST. */
async function postInit(body: unknown, signal: AbortSignal | undefined): Promise<RequestInit> {
  return {
    method: 'POST',
    headers: await requestHeaders({ json: true, token: true }),
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  };
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
    headers: await requestHeaders({ json: false, token: false }),
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
  const response = await send(path, await postInit(body, signal));
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

export interface NdjsonRequest<T> {
  path: string;
  body: unknown;
  /** Each line is validated with this schema before `onEvent` sees it. */
  schema: z.ZodType<T>;
  onEvent: (event: T) => void;
  signal?: AbortSignal | undefined;
}

/** POSTs JSON and streams the NDJSON answer, validating each line with `schema`. */
export async function postNdjson<T>({
  path,
  body,
  schema,
  onEvent,
  signal,
}: NdjsonRequest<T>): Promise<void> {
  const response = await send(path, await postInit(body, signal));
  if (!response.body) throw new ApiError(200, 'invalid_response', 'The server sent no data.');
  await readNdjson(response.body, (value) => {
    onEvent(validated(schema, value));
  });
}
