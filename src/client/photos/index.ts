/**
 * The festival photographs. Each occasion has one photo, cropped to the 4:5 arch window and
 * graded warm so that photos by different people read as one album, in up to three widths
 * (the file name carries the width; a small source is never enlarged). Occasions with a
 * celebration moment also have a wide photo for it. Credits are in credits.ts and CREDITS.md.
 */
import type { Mood } from '../../shared/domain/mood';
import type { MomentMood } from '../features/moments/celebrated';

const FILES = import.meta.glob<string>('./*.webp', { eager: true, import: 'default' });

/** An arch photo: everything an <img> needs to pick the right width. */
export interface ArchPhoto {
  src: string;
  srcSet: string;
  /** The largest width, for the intrinsic size (the ratio is always 4:5). */
  width: number;
  height: number;
}

function widthsOf(mood: Mood): number[] {
  const pattern = new RegExp(`^\\./${mood}-(\\d+)\\.webp$`);
  return Object.keys(FILES)
    .map((file) => pattern.exec(file)?.[1])
    .filter((width): width is string => width !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
}

function file(name: string): string {
  const url = FILES[`./${name}.webp`];
  if (url === undefined) throw new Error(`Missing photo ${name}.webp`);
  return url;
}

export function archPhoto(mood: Mood): ArchPhoto {
  const widths = widthsOf(mood);
  const largest = widths.at(-1);
  if (largest === undefined) throw new Error(`Missing photos for ${mood}`);
  return {
    src: file(`${mood}-${String(largest)}`),
    srcSet: widths
      .map((width) => `${file(`${mood}-${String(width)}`)} ${String(width)}w`)
      .join(', '),
    width: largest,
    height: Math.round((largest * 5) / 4),
  };
}

/** The wide photo a celebration moment opens onto. */
export function momentPhoto(mood: MomentMood): string {
  return file(`${mood}-moment`);
}

/** How wide a plan header's arch shows: narrower on a phone, where it sits above the title. */
export const HEADER_PHOTO_SIZES = '(max-width: 820px) 150px, 230px';

/** A clay diya's flame, for the home page's medallion and the Copilot. */
export const FLAME = file('flame-160');
