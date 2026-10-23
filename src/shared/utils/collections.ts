/** Small collection helpers that keep index-aligned arrays type-safe. */

/**
 * Combines two arrays element by element. Both arrays must have the same length; a mismatch is
 * a programming error, so it throws instead of silently filling gaps.
 */
export function zipWith<A, B, R>(
  left: readonly A[],
  right: readonly B[],
  combine: (a: A, b: B, index: number) => R,
): R[] {
  if (left.length !== right.length) {
    throw new RangeError(
      `zipWith: length mismatch (${String(left.length)} vs ${String(right.length)})`,
    );
  }
  const rightValues = right[Symbol.iterator]();
  return left.map((a, index) => {
    const next = rightValues.next();
    if (next.done) throw new RangeError('zipWith: right side ended early');
    return combine(a, next.value, index);
  });
}

/** A copy of an object without one key (records keyed by id, error maps). Never mutates. */
export function omitKey<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  Reflect.deleteProperty(copy, key);
  return copy;
}
