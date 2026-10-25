import { describe, expect, it } from 'vitest';
import { bn } from './bn';
import { en } from './en';
import { formatters } from './format';
import { hi } from './hi';
import { initLocale, savedLocale, useLocaleStore } from './index';
import { isLocale } from './types';

/** Every leaf of a dictionary, with its path. Functions are called with sample arguments. */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') {
    const result: unknown = (value as (...args: unknown[]) => unknown)('3', 3);
    return [[path, String(result)]];
  }
  if (Array.isArray(value))
    return value.flatMap((item, index) => leaves(item, `${path}[${String(index)}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      leaves(item, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

describe('dictionaries', () => {
  const english = new Map(leaves(en));

  it.each([
    ['hi', hi],
    ['bn', bn],
  ] as const)('%s has every English string, none empty', (_name, dictionary) => {
    const translated = leaves(dictionary);
    for (const [path, text] of translated) expect(text.trim(), path).not.toBe('');
    // Arrays (examples, suggestions) may differ in length; every other path must match.
    const keys = (entries: Iterable<string>) =>
      new Set([...entries].filter((path) => !path.includes('[')));
    expect(keys(translated.map(([path]) => path))).toEqual(keys(english.keys()));
  });

  it('uses the script of each language for the interface', () => {
    expect(hi.home.heroTitle.em).toMatch(/[ऀ-ॿ]/u);
    expect(bn.home.heroTitle.em).toMatch(/[ঀ-৿]/u);
    expect(hi.moods.greeting.diwali).toMatch(/[ऀ-ॿ]/u);
    expect(bn.moods.greeting.durga).toMatch(/[ঀ-৿]/u);
  });
});

describe('formatters', () => {
  it('groups Indian rupees in lakhs and shows Bengali digits in Bengali', () => {
    expect(formatters('en').money(1_800_000, 'INR')).toBe('₹18,00,000');
    expect(formatters('bn').number(1_800_000)).toBe('১৮,০০,০০০');
    expect(formatters('en').money(25_000, 'USD')).toBe('$25,000');
    expect(formatters('en').moneyCompact(1_800_000, 'INR')).toBe('₹18L');
  });

  it('formats date-only values without shifting the day', () => {
    const f = formatters('en');
    expect(f.date('2027-02-14')).toBe('14 Feb 2027');
    expect(f.dateLong('2027-02-14')).toBe('Sunday, 14 February 2027');
    expect(f.dateShort('2027-02-14')).toBe('14 Feb');
    expect(f.weekday('2027-02-14')).toBe('Sunday');
    expect(f.day('2027-02-14')).toBe('14');
    expect(f.monthYear('2027-02-14')).toBe('Feb 2027');
    expect(f.time('18:30')).toMatch(/6:30\s?pm/i);
    expect(f.percent(0.42)).toBe('42%');
    expect(f.list(['Venue', 'Decor', 'Catering'])).toBe('Venue, Decor and Catering');
    expect(formatters('en')).toBe(f);
  });
});

describe('locale store', () => {
  it('loads Hindi on demand and labels the document', async () => {
    await useLocaleStore.getState().setLocale('hi');
    expect(useLocaleStore.getState().messages.home.heroTitle).toEqual(hi.home.heroTitle);
    expect(document.documentElement.lang).toBe('hi');
    expect(localStorage.getItem('mehfil:lang')).toBe('hi');
    expect(savedLocale()).toBe('hi');
  });

  it('starts in the saved language and ignores unknown ones', async () => {
    document.documentElement.lang = 'bn';
    await initLocale();
    expect(useLocaleStore.getState().locale).toBe('bn');
    document.documentElement.lang = 'fr';
    expect(savedLocale()).toBe('en');
    await initLocale('en');
    expect(isLocale('hi')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });
});
