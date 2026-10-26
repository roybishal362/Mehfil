/**
 * The photographs on disk: every file is credited, and they stay small enough for a fast first
 * screen and a small repository (under 150 KB each and 1.4 MB in all).
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PHOTO_CREDITS } from '../src/client/photos/credits.ts';

const DIR = join(import.meta.dirname, '../src/client/photos');
const FILES = readdirSync(DIR).filter((name) => name.endsWith('.webp'));

/** "wedding-480.webp" is the wedding photo; "wedding-moment.webp" the wedding moment's. */
function photoName(file: string): string {
  return file.replace(/\.webp$/, '').replace(/-\d+$/, '');
}

describe('the photograph files', () => {
  it('are all credited', () => {
    const credited = new Set(
      PHOTO_CREDITS.flatMap((credit) => credit.photo.split(',').map((name) => name.trim())),
    );
    expect(FILES.length).toBeGreaterThan(20);
    for (const file of FILES) expect(credited, file).toContain(photoName(file));
  });

  it('stay under 150 KB each and 1.4 MB in all', () => {
    const sizes = FILES.map((file) => statSync(join(DIR, file)).size);
    for (const [index, size] of sizes.entries()) {
      expect(size, FILES[index]).toBeLessThanOrEqual(150 * 1024);
    }
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(1.4 * 1024 * 1024);
  });
});
