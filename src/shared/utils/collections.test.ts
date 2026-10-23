import { describe, expect, it } from 'vitest';
import { zipWith } from './collections';

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
