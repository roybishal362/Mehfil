/**
 * Currency formatting and a forgiving amount parser.
 * Amounts are whole currency units; formatting follows the reader's locale, so Indian rupees
 * are grouped in lakhs and crores (₹18,00,000) and Bengali readers see Bengali digits.
 */
import type { Currency } from '../schemas/primitives';

/** Maps the app's UI language and currency to the best formatting locale. */
export function formattingLocale(uiLanguage: string, currency: Currency): string {
  if (uiLanguage === 'hi') return 'hi-IN';
  if (uiLanguage === 'bn') return 'bn-IN';
  return currency === 'INR' ? 'en-IN' : 'en';
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let cached = formatterCache.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, cached);
  }
  return cached;
}

/** `₹18,00,000` — full amount without decimals. */
export function formatMoney(amount: number, currency: Currency, locale = 'en-IN'): string {
  return formatter(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    amount,
  );
}

/** `₹18L` / `$12K` — short form for charts and badges. */
export function formatMoneyCompact(amount: number, currency: Currency, locale = 'en-IN'): string {
  return formatter(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(amount);
}

/** Plain grouped number (`18,00,000`) for inputs and tables. */
export function formatNumber(value: number, locale = 'en-IN'): string {
  return formatter(locale, { maximumFractionDigits: 0 }).format(value);
}

const MAX_AMOUNT = 10_000_000_000;

/** Multipliers for written-out scales in English, Hindi and Bengali. */
const SCALE_WORDS: readonly [RegExp, number][] = [
  [/^(?:crores?|cr|करोड़|करोड|কোটি)$/u, 10_000_000],
  [/^(?:lakhs?|lacs?|lac|l|लाख|লাখ|লক্ষ)$/u, 100_000],
  [/^(?:millions?|mn|m)$/u, 1_000_000],
  [/^(?:thousands?|k|हज़ार|हजार|হাজার)$/u, 1_000],
];

/** Converts Devanagari and Bengali digits to ASCII so `१८` and `১৮` read as 18. */
export function normaliseDigits(input: string): string {
  return input.replace(/[०-९০-৯]/gu, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    const base = code >= 0x09e6 ? 0x09e6 : 0x0966;
    return String(code - base);
  });
}

/**
 * Parses amounts the way people type them: "18L", "18 lakh", "1.5 crore", "50k", "₹1,50,000",
 * "2 million", "१८ लाख". Returns whole units, or `null` when the text is not an amount.
 */
export function parseAmount(raw: string): number | null {
  const cleaned = normaliseDigits(raw)
    .toLowerCase()
    .replace(/[₹$€£]|rs\.?|inr|usd|rupees?|টাকা|रुपये|रुपए/gu, ' ')
    .replace(/(\d),(?=\d)/g, '$1')
    .trim();
  const match = /^(\d+(?:\.\d+)?)\s*([^\s\d.]+)?$/u.exec(cleaned);
  if (!match) return null;
  const [, numberPart, unit] = match as unknown as [string, string, string | undefined];
  let value = Number(numberPart);
  if (unit) {
    const scale = SCALE_WORDS.find(([pattern]) => pattern.test(unit));
    if (!scale) return null;
    value *= scale[1];
  }
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) return null;
  return Math.round(value);
}
