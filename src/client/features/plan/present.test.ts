import { describe, expect, it } from 'vitest';
import { TODAY, weddingPlan } from '../../../shared/test/fixtures';
import { en } from '../../i18n/en';
import { formatters } from '../../i18n/format';
import {
  countdownParts,
  coupleNames,
  petalsFor,
  petalsSummary,
  planView,
  SAMPLE_PROGRESS,
} from './present';

const f = formatters('en');

describe('coupleNames', () => {
  it.each([
    ["Ananya & Rohan's Wedding", ['Ananya', 'Rohan']],
    ['Ananya and Rohan', ['Ananya', 'Rohan']],
    ['Priya weds Arjun', ['Priya', 'Arjun']],
    ['अनन्या और रोहन की शादी', ['अनन्या', 'रोहन']],
    ['অনন্যা ও রোহনের বিয়ে', ['অনন্যা', 'রোহন']],
    ['Alexandra’s 30th', null],
    ["Mira's 7th Birthday", null],
    ['Wedding in Kolkata', null],
  ])('reads "%s"', (title, names) => {
    expect(coupleNames(title)).toEqual(names);
  });
});

describe('plan presentation', () => {
  it('turns progress into labelled petals with a readable summary', () => {
    const petals = petalsFor(SAMPLE_PROGRESS, en, f);
    expect(petals.map((petal) => petal.label)).toEqual([
      'Budget',
      'Timeline',
      'Vendors',
      'Ideas',
      'Guests',
      'Day-of',
    ]);
    expect(petals[5]?.caption).toBe('not started');
    expect(petalsSummary(petals, en)).toContain('Timeline 35%');
  });

  it('summarises a real plan', () => {
    const view = planView(weddingPlan(), TODAY, en, f);
    expect(view.countdown).toEqual({ kind: 'upcoming', days: 114 });
    expect(view.score).toBeGreaterThanOrEqual(0);
    expect(view.petals[0]?.value).toBe(0.6);
  });

  it('words the countdown seal for every stage', () => {
    expect(countdownParts({ kind: 'upcoming', days: 1 }, en, f)).toEqual({
      big: '1',
      small: 'day to go',
      word: false,
    });
    expect(countdownParts({ kind: 'today' }, en, f).big).toBe('Today!');
    expect(countdownParts({ kind: 'ongoing', day: 2, of: 3 }, en, f).big).toBe('Day 2 of 3');
    expect(countdownParts({ kind: 'past', days: 4 }, en, f).big).toBe('Celebrated');
  });
});
