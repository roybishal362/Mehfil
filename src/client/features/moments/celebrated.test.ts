import { describe, expect, it, vi } from 'vitest';
import { hasMoment, rememberCelebrated, shouldAutoPlay, wasCelebrated } from './celebrated';

/** A Storage backed by a Map, so each test starts empty. */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => {
      items.clear();
    },
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

function prefersReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: reduce && query.includes('reduce'), media: query })),
  );
}

describe('remembering celebrated plans', () => {
  it('remembers a plan once it has had its moment', () => {
    const storage = memoryStorage();
    expect(wasCelebrated('evt_1', storage)).toBe(false);
    rememberCelebrated('evt_1', storage);
    expect(wasCelebrated('evt_1', storage)).toBe(true);
    expect(wasCelebrated('evt_2', storage)).toBe(false);
  });

  it('keeps the newest sixty plans without duplicates', () => {
    const storage = memoryStorage();
    for (let index = 0; index < 70; index += 1) rememberCelebrated(`evt_${String(index)}`, storage);
    rememberCelebrated('evt_69', storage);
    const ids = JSON.parse(storage.getItem('mehfil:celebrated') ?? '[]') as string[];
    expect(ids).toHaveLength(60);
    expect(new Set(ids).size).toBe(60);
    expect(ids[0]).toBe('evt_69');
    expect(wasCelebrated('evt_5', storage)).toBe(false);
  });

  it('copes with damaged or unavailable storage', () => {
    const storage = memoryStorage();
    storage.setItem('mehfil:celebrated', '{not json');
    expect(wasCelebrated('evt_1', storage)).toBe(false);
    storage.setItem('mehfil:celebrated', JSON.stringify({ evt_1: true }));
    expect(wasCelebrated('evt_1', storage)).toBe(false);
    const full = memoryStorage();
    full.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => {
      rememberCelebrated('evt_1', full);
    }).not.toThrow();
    expect(wasCelebrated('evt_1', null)).toBe(false);
  });
});

describe('when a moment plays by itself', () => {
  it('never plays for people who ask for reduced motion', () => {
    prefersReducedMotion(true);
    expect(shouldAutoPlay('evt_quiet', 'diwali')).toBe(false);
  });

  it('plays on a plan’s first opening only, and never for the neutral look', () => {
    prefersReducedMotion(false);
    expect(hasMoment('neutral')).toBe(false);
    expect(hasMoment('diwali')).toBe(true);
    expect(shouldAutoPlay('evt_1', 'neutral')).toBe(false);
    expect(shouldAutoPlay('evt_1', 'wedding')).toBe(true);
    rememberCelebrated('evt_1');
    expect(shouldAutoPlay('evt_1', 'wedding')).toBe(false);
  });
});
