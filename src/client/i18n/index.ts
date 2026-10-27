/**
 * The interface language. English ships in the main bundle; Hindi and Bengali load on demand.
 * The choice is remembered and applied to <html lang> so screen readers pronounce text
 * correctly and the right fonts load.
 */
import { create } from 'zustand';
import { writeText } from '../lib/storage';
import { en } from './en';
import { formatters, type Formatters } from './format';
import { isLocale, type Locale, type Messages } from './types';

export { LOCALES, LOCALE_NAMES, type Locale, type Messages } from './types';
export type { Formatters } from './format';

const STORAGE_KEY = 'mehfil:lang';

const loaders: Readonly<Record<Locale, () => Promise<Messages>>> = {
  en: () => Promise.resolve(en),
  hi: () => import('./hi').then((module) => module.hi),
  bn: () => import('./bn').then((module) => module.bn),
};

interface LocaleState {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => Promise<void>;
}

function remember(locale: Locale): void {
  document.documentElement.lang = locale;
  // Without storage (some private windows) the choice lasts for this visit.
  writeText(STORAGE_KEY, locale);
}

export const useLocaleStore = create<LocaleState>()((set) => ({
  locale: 'en',
  messages: en,
  setLocale: async (locale) => {
    const messages = await loaders[locale]();
    remember(locale);
    set({ locale, messages });
  },
}));

/** The locale saved from a previous visit (theme-init.js already copied it to <html lang>). */
export function savedLocale(): Locale {
  const fromDocument = document.documentElement.lang;
  return isLocale(fromDocument) ? fromDocument : 'en';
}

/** Loads the saved language before the first render, so text never flashes in English. */
export async function initLocale(locale: Locale = savedLocale()): Promise<void> {
  if (locale === 'en') return;
  try {
    await useLocaleStore.getState().setLocale(locale);
  } catch {
    // A failed chunk download falls back to English rather than blocking the app.
  }
}

export interface I18n {
  locale: Locale;
  t: Messages;
  f: Formatters;
}

export function useI18n(): I18n {
  const locale = useLocaleStore((state) => state.locale);
  const t = useLocaleStore((state) => state.messages);
  return { locale, t, f: formatters(locale) };
}
