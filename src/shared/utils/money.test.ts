import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formattingLocale,
  normaliseDigits,
  parseAmount,
} from './money';

describe('formatMoney', () => {
  it('groups rupees in lakhs and crores', () => {
    expect(formatMoney(1_800_000, 'INR', 'en-IN')).toBe('₹18,00,000');
    expect(formatMoney(25_000_000, 'INR', 'en-IN')).toBe('₹2,50,00,000');
  });

  it('formats other currencies without decimals', () => {
    expect(formatMoney(12_500, 'USD', 'en')).toBe('$12,500');
  });

  it('uses Bengali digits for Bengali readers', () => {
    expect(formatNumber(1_800_000, 'bn-IN')).toBe('১৮,০০,০০০');
  });

  it('has a compact form for charts', () => {
    expect(formatMoneyCompact(1_800_000, 'INR', 'en-IN')).toBe('₹18L');
  });
});

describe('formattingLocale', () => {
  it('maps UI language and currency to a locale', () => {
    expect(formattingLocale('en', 'INR')).toBe('en-IN');
    expect(formattingLocale('en', 'USD')).toBe('en');
    expect(formattingLocale('hi', 'INR')).toBe('hi-IN');
    expect(formattingLocale('bn', 'INR')).toBe('bn-IN');
  });
});

describe('parseAmount', () => {
  it.each([
    ['1800000', 1_800_000],
    ['18,00,000', 1_800_000],
    ['₹1,50,000', 150_000],
    ['18L', 1_800_000],
    ['18 lakh', 1_800_000],
    ['18 lakhs rupees', 1_800_000],
    ['2.5 lacs', 250_000],
    ['1.5 crore', 15_000_000],
    ['1.5cr', 15_000_000],
    ['50k', 50_000],
    ['Rs. 75,000', 75_000],
    ['2 million', 2_000_000],
    ['$12,500', 12_500],
    ['१८ लाख', 1_800_000],
    ['১৮ লাখ', 1_800_000],
    ['২ কোটি', 20_000_000],
    ['15 हज़ार', 15_000],
  ])('parses %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', 'lots', '18 bananas', '-500', '1e9', '99999999999'])('rejects %s', (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe('normaliseDigits', () => {
  it('converts Devanagari and Bengali digits to ASCII', () => {
    expect(normaliseDigits('१२३ ৪৫৬ 789')).toBe('123 456 789');
  });
});
