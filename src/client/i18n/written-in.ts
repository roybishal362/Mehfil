import { RTL_LANGUAGES } from '../../shared/schemas/primitives';

export interface WrittenIn {
  lang: string;
  dir?: 'rtl';
}

/**
 * Attributes for text written in `language` (usually the plan's language, which can differ from
 * the interface's): `lang`, so screen readers pronounce it correctly, and `dir="rtl"` for Urdu
 * and Arabic, so punctuation and mixed text sit on the right side.
 */
export function writtenIn(language: string): WrittenIn {
  return (RTL_LANGUAGES as ReadonlySet<string>).has(language)
    ? { lang: language, dir: 'rtl' }
    : { lang: language };
}
