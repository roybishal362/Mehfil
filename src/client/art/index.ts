/**
 * 3D artwork: Microsoft's Fluent Emoji 3D set (MIT licence, see LICENSE in this folder),
 * chosen for Indian celebrations (diyas, marigolds, lotuses, an elephant for Ganpati) and
 * converted to WebP in two sizes: 256 px for pictures and 96 px for icons.
 */

const FILES = import.meta.glob<string>('./*.webp', { eager: true, import: 'default' });

export const ART_NAMES = [
  'balloon',
  'bouquet',
  'bulb',
  'cake',
  'calendar',
  'clipboard',
  'coconut',
  'diya',
  'elephant',
  'gift',
  'heart',
  'hibiscus',
  'kite',
  'lantern',
  'letter',
  'lotus',
  'marigold',
  'money-bag',
  'palette',
  'party-popper',
  'pin',
  'ring',
  'sparkles',
  'target',
  'warning',
] as const;
export type ArtName = (typeof ART_NAMES)[number];

/** Pictures shown at up to this size (CSS pixels) use the small file. */
const SMALL_UP_TO = 48;

export function artUrl(name: ArtName, size = 256): string {
  const file = `./${name}${size <= SMALL_UP_TO ? '-sm' : ''}.webp`;
  const url = FILES[file];
  if (url === undefined) throw new Error(`Missing artwork ${file}`);
  return url;
}
