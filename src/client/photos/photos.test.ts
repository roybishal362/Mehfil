import { describe, expect, it } from 'vitest';
import { MOODS } from '../../shared/domain/mood';
import { MOMENT_DURATION, type MomentMood } from '../features/moments/celebrated';
import { archPhoto, FLAME, momentPhoto } from '.';
import { PHOTO_CREDITS } from './credits';

// File sizes and credits for every file on disk are checked in scripts/photo-budget.test.ts.
describe('the photographs', () => {
  it('give every occasion an arch photo in three widths, never enlarged past 720 pixels', () => {
    for (const mood of MOODS) {
      const photo = archPhoto(mood);
      const widths = photo.srcSet.split(', ').map((entry) => Number(/ (\d+)w$/.exec(entry)?.[1]));
      expect(widths, mood).toHaveLength(3);
      expect(widths[0], mood).toBe(240);
      expect(widths[1], mood).toBe(480);
      expect(photo.width, mood).toBe(widths[2]);
      expect(photo.width, mood).toBeGreaterThan(480);
      expect(photo.width, mood).toBeLessThanOrEqual(720);
      expect(photo.height, mood).toBe(Math.round((photo.width * 5) / 4));
      expect(photo.src, mood).toMatch(new RegExp(`${mood}-${String(photo.width)}\\.webp$`));
    }
  });

  it('give every occasion with a celebration moment its wide photo', () => {
    for (const mood of Object.keys(MOMENT_DURATION) as MomentMood[]) {
      expect(momentPhoto(mood), mood).toMatch(new RegExp(`${mood}-moment\\.webp$`));
    }
    expect(FLAME).toMatch(/flame-160\.webp$/);
  });

  it('credit each photographer with a licence and a source page', () => {
    for (const credit of PHOTO_CREDITS) {
      expect(credit.source).toMatch(/^https:\/\/(commons\.wikimedia\.org|www\.flickr\.com)\//);
      expect(credit.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
      expect(credit.author.trim()).not.toBe('');
    }
  });
});
