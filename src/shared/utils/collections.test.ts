import { describe, expect, it } from 'vitest';
import { omitKey, zipWith } from './collections';

describe('omitKey', () => {
  it('copies an object without one key, leaving the original alone', () => {
    const original = { a: 1, b: 2 };
    expect(omitKey(original, 'a')).toEqual({ b: 2 });
    expect(original).toEqual({ a: 1, b: 2 });
  });
});

describe('zipWith', () => {
  it('combines arrays element by element', () => {
    expect(
      zipWith(['a', 'b'], [1, 2], (letter, n, i) => `${letter}${String(n)}${String(i)}`),
    ).toEqual(['a10', 'b21']);
    expect(zipWith([], [], () => 1)).toEqual([]);
  });

  it('throws when the arrays differ in length', () => {
    expect(() => zipWith([1, 2], [1], (a, b) => a + b)).toThrow(RangeError);
  });
});
