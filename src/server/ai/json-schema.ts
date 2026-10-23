/**
 * Converts Zod schemas to the JSON Schema subset Gemini's structured output accepts.
 * Zod is the single source of truth; this strips keywords Gemini rejects or ignores
 * (e.g. `$schema`, `pattern`, `maxLength`) so a schema change can never break generation.
 */
import * as z from 'zod';

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

/** Recursively removes unsupported keywords from a JSON Schema object. */
export function sanitiseJsonSchema(node: Json): Json {
  if (Array.isArray(node)) return node.map(sanitiseJsonSchema);
  if (node === null || typeof node !== 'object') return node;
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (key === 'format' && (typeof value !== 'string' || !ALLOWED_FORMATS.has(value))) continue;
    if (key === 'properties' && value && typeof value === 'object' && !Array.isArray(value)) {
      // Property names are data, not keywords: keep every name and sanitise each schema.
      out[key] = Object.fromEntries(
        Object.entries(value).map(([name, schema]) => [name, sanitiseJsonSchema(schema)]),
      );
      continue;
    }
    out[key] = sanitiseJsonSchema(value);
  }
  return out;
}

/** The Gemini-ready JSON Schema for a Zod schema. */
export function toGeminiSchema(schema: z.ZodType): Json {
  return sanitiseJsonSchema(z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Json);
}
