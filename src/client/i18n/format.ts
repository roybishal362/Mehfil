/**
 * Locale-aware formatting for numbers, money, dates and times. Indian locales group numbers in
 * lakhs and crores (18,00,000), and Bengali shows Bengali digits. Dates in plans are date-only
 * strings, so they are always formatted in UTC to avoid timezone shifts.
 */
import type { Currency } from '../../shared/schemas/primitives';
import { formatMoney, formatMoneyCompact, formattingLocale } from '../../shared/utils/money';
import type { Locale } from './types';

const INTL_LOCALE: Readonly<Record<Locale, string>> = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN' };

export interface Formatters {
  locale: Locale;
  /** BCP 47 tag used for Intl (e.g. bn-IN). */
  intl: string;
  number(value: number): string;
  /** 0.42 → "42%". */
  percent(fraction: number): string;
  money(amount: number, currency: Currency): string;
  moneyCompact(amount: number, currency: Currency): string;
  /** 14 Feb 2027 */
  date(iso: string): string;
  /** Sunday, 14 February 2027 */
  dateLong(iso: string): string;
  /** 14 Feb */
  dateShort(iso: string): string;
  /** Sunday */
  weekday(iso: string): string;
  /** 14 */
  day(iso: string): string;
  /** Feb 2027 */
  monthYear(iso: string): string;
  /** "18:30" → "6:30 pm" */
  time(clock: string): string;
  /** ["a", "b", "c"] → "a, b and c" */
  list(items: readonly string[]): string;
}

const cache = new Map<Locale, Formatters>();

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Builds a value on first use. Creating an Intl formatter is costly and most pages need few. */
function lazy<T>(create: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= create());
}

export function formatters(locale: Locale): Formatters {
  const cached = cache.get(locale);
  if (cached) return cached;
  const intl = INTL_LOCALE[locale];
  const dateFormat = (options: Intl.DateTimeFormatOptions) =>
    lazy(() => new Intl.DateTimeFormat(intl, { timeZone: 'UTC', ...options }));
  const number = lazy(() => new Intl.NumberFormat(intl, { maximumFractionDigits: 0 }));
  const percent = lazy(
    () => new Intl.NumberFormat(intl, { style: 'percent', maximumFractionDigits: 0 }),
  );
  const medium = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' });
  const long = dateFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const short = dateFormat({ day: 'numeric', month: 'short' });
  const weekday = dateFormat({ weekday: 'long' });
  const day = dateFormat({ day: 'numeric' });
  const monthYear = dateFormat({ month: 'short', year: 'numeric' });
  const time = dateFormat({ hour: 'numeric', minute: '2-digit' });
  const list = lazy(() => new Intl.ListFormat(intl, { type: 'conjunction' }));

  const formats: Formatters = {
    locale,
    intl,
    number: (value) => number().format(value),
    percent: (fraction) => percent().format(fraction),
    money: (amount, currency) => formatMoney(amount, currency, formattingLocale(locale, currency)),
    moneyCompact: (amount, currency) =>
      formatMoneyCompact(amount, currency, formattingLocale(locale, currency)),
    date: (iso) => medium().format(toDate(iso)),
    dateLong: (iso) => long().format(toDate(iso)),
    dateShort: (iso) => short().format(toDate(iso)),
    weekday: (iso) => weekday().format(toDate(iso)),
    day: (iso) => day().format(toDate(iso)),
    monthYear: (iso) => monthYear().format(toDate(iso)),
    time: (clock) => time().format(new Date(`1970-01-01T${clock}:00Z`)),
    list: (items) => list().format(items),
  };
  cache.set(locale, formats);
  return formats;
}
