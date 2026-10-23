import type { en } from './en';

/** The interface languages. AI output can use more (see OUTPUT_LANGUAGES). */
export const LOCALES = ['en', 'hi', 'bn'] as const;
export type Locale = (typeof LOCALES)[number];

/** Endonyms for the language switcher. */
export const LOCALE_NAMES: Readonly<Record<Locale, { short: string; name: string }>> = {
  en: { short: 'EN', name: 'English' },
  hi: { short: 'हिं', name: 'हिन्दी' },
  bn: { short: 'বাং', name: 'বাংলা' },
};

/**
 * The message shape. A function may take fewer parameters than the English one (TypeScript
 * allows it), which lets languages without plural forms ignore the count.
 */
export type Messages = typeof en;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
