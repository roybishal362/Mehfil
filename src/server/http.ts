/** Request helpers shared by the routes. */
import type { Context } from 'hono';
import type { z } from 'zod';
import { AppError, badRequest } from './errors';

/** Field paths of validation problems, without echoing any submitted values. */
export function describeIssues(error: z.ZodError): string {
  const paths = [...new Set(error.issues.map((issue) => issue.path.join('.') || 'body'))];
  return `Check these fields: ${paths.slice(0, 8).join(', ')}`;
}

/** Reads and validates a JSON body: 415 for other content types, 400 for invalid data. */
export async function readJson<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new AppError(
      415,
      'unsupported_media_type',
      'Send JSON with Content-Type: application/json',
    );
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest('The request body is not valid JSON');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest(describeIssues(parsed.error));
  return parsed.data;
}
