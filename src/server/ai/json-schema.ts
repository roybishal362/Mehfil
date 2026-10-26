/**
 * Converts Zod schemas to the JSON Schema subset Gemini's structured output accepts.
 * Zod is the single source of truth; this strips keywords Gemini rejects or ignores
 * (e.g. `$schema`, `pattern`, `maxLength`) so a schema change can never break generation.
 */
import * as z from '../../shared/zod';

/** Keywords Gemini's `responseJsonSchema` supports and we rely on. */
const ALLOWED_KEYS = new Set([
  'type',
  'properties',
  'required',
  'items',
  'enum',
  'description',
  'minimum',
  'maximum',
  'minItems',
  'maxItems',
  'additionalProperties',
  'anyOf',
  'format',
  'title',
]);

const ALLOWED_FORMATS = new Set(['date', 'date-time', 'time']);

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const isObject = (value: Json): value is Record<string, Json> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Whether Gemini accepts this keyword with this value. */
function isSupported(key: string, value: Json): boolean {
  if (!ALLOWED_KEYS.has(key)) return false;
  return key !== 'format' || (typeof value === 'string' && ALLOWED_FORMATS.has(value));
}

/** Recursively removes unsupported keywords from a JSON Schema object. */
export function sanitiseJsonSchema(node: Json): Json {
  if (Array.isArray(node)) return node.map(sanitiseJsonSchema);
  if (!isObject(node)) return node;
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!isSupported(key, value)) continue;
    // Property names are data, not keywords: keep every name and sanitise each schema.
    out[key] =
      key === 'properties' && isObject(value)
        ? Object.fromEntries(
            Object.entries(value).map(([name, schema]) => [name, sanitiseJsonSchema(schema)]),
          )
        : sanitiseJsonSchema(value);
  }
  return out;
}

/** The Gemini-ready JSON Schema for a Zod schema. */
export function toGeminiSchema(schema: z.ZodType): Json {
  return sanitiseJsonSchema(z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Json);
}
