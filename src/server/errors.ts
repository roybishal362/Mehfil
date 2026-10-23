/** HTTP-facing errors with stable codes. Messages are safe to show; details are never echoed. */

export type ErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'rate_limited'
  | 'ai_unavailable'
  | 'ai_blocked'
  | 'internal';

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, code: ErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const badRequest = (message = 'The request was not valid') =>
  new AppError(400, 'bad_request', message);
export const unauthorized = (message = 'Sign-in is required') =>
  new AppError(401, 'unauthorized', message);
export const notFound = (message = 'Not found') => new AppError(404, 'not_found', message);
export const tooManyRequests = (retryAfterSeconds: number) =>
  new AppError(
    429,
    'rate_limited',
    'Too many requests. Please wait a moment and try again.',
    retryAfterSeconds,
  );
