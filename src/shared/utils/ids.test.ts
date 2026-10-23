import { describe, expect, it } from 'vitest';
import { Id } from '../schemas/primitives';
import { createId, randomId, secureToken, sequentialIds } from './ids';

describe('ids', () => {
  it('creates prefixed IDs that satisfy the Id schema', () => {
    const id = createId('task');
    expect(id).toMatch(/^task_[0-9a-zA-Z]{10}$/);
    expect(Id.safeParse(id).success).toBe(true);
  });

  it('creates distinct random IDs', () => {
    const ids = new Set(Array.from({ length: 500 }, () => randomId()));
    expect(ids.size).toBe(500);
  });

  it('creates predictable sequential IDs per prefix', () => {
    const next = sequentialIds();
    expect([next('task'), next('task'), next('line')]).toEqual(['task_1', 'task_2', 'line_1']);
  });

  it('creates 128-bit base64url share tokens', () => {
    const token = secureToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(secureToken()).not.toBe(token);
  });
});
