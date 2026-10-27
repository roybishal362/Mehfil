import { describe, expect, it } from 'vitest';
import { browserStorage, readJson, readText, removeKey, writeText } from './storage';

/** Storage that refuses everything, as a browser with storage blocked does. */
const blocked = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
} as unknown as Storage;

describe('storage', () => {
  it('reads and writes text and JSON in localStorage', () => {
    expect(browserStorage()).toBe(localStorage);
    expect(writeText('k', '{"a":1}')).toBe(true);
    expect(readText('k')).toBe('{"a":1}');
    expect(readJson('k')).toEqual({ a: 1 });
    removeKey('k');
    expect(readText('k')).toBeNull();
    expect(readJson('k')).toBeUndefined();
  });

  it('treats unparseable JSON as nothing stored', () => {
    writeText('k', '{oops');
    expect(readJson('k')).toBeUndefined();
  });

  it('keeps working when storage is missing or refuses every call', () => {
    for (const storage of [null, blocked]) {
      expect(readText('k', storage)).toBeNull();
      expect(readJson('k', storage)).toBeUndefined();
      expect(writeText('k', 'v', storage)).toBe(false);
      expect(() => {
        removeKey('k', storage);
      }).not.toThrow();
    }
  });
});
