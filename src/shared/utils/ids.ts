/** Identifier helpers. Uses the Web Crypto API, available in browsers and Node 20+. */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Short random identifier (base62). Suitable for record IDs, not for secrets. */
export function randomId(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) out += ALPHABET.charAt(byte % ALPHABET.length);
  return out;
}

/** Creates IDs such as `task_k3J9xQ2mZp`. Injected so tests can use predictable IDs. */
export type IdFactory = (prefix: string) => string;

export const createId: IdFactory = (prefix) => `${prefix}_${randomId()}`;

/** Deterministic factory for tests and fixtures: `task_1`, `task_2`, … */
export function sequentialIds(): IdFactory {
  const counters = new Map<string, number>();
  return (prefix) => {
    const next = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, next);
    return `${prefix}_${String(next)}`;
  };
}

/**
 * Unguessable token for capability links (share links): 128 random bits, base64url, no padding.
 */
export function secureToken(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
