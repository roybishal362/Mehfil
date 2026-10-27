import { describe, expect, it } from 'vitest';
import { parseJson } from './json';

describe('parseJson', () => {
  it('parses valid JSON, including falsy values', () => {
    expect(parseJson('{"a":[1,2]}')).toEqual({ a: [1, 2] });
    expect(parseJson('null')).toBeNull();
    expect(parseJson('0')).toBe(0);
  });

  it('returns undefined for anything that is not JSON', () => {
    expect(parseJson('{oops')).toBeUndefined();
    expect(parseJson('')).toBeUndefined();
  });
});
