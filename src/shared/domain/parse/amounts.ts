/** The budget a description names ("₹18 lakh", "Rs. 5,00,000", "50k", "बजट 2 लाख"). */
import type { Currency } from '../../schemas/primitives';
import { parseAmount } from '../../utils/money';
import { MONTH, ORDINAL } from './dates';
import { GUEST_WORD } from './guests';
import { NO_LETTER_AFTER, pattern } from './patterns';

const CURRENCY = String.raw`₹|\$|€|£|\b(?:rs|inr|usd|eur|gbp)\b\.?`;
const UNIT = String.raw`crores?|cr|lakhs?|lacs?|thousand|million|mn|k|l|लाख|करोड़|हज़ार|লাখ|লক্ষ|কোটি|হাজার`;
/** An amount: optional currency, digits, optional scale word ("₹18 lakh", "Rs. 5,00,000", "50k"). */
const AMOUNT = pattern(
  String.raw`(?:(${CURRENCY})\s*|(?<![\p{L}\p{M}\d.,]))(\d[\d,]*(?:\.\d+)?)(?:\s*(${UNIT})${NO_LETTER_AFTER})?`,
  'giu',
);
/** Numbers that belong to a date or a head count, not to a budget. */
const NOT_MONEY_AFTER = pattern(
  String.raw`^(?:${ORDINAL}|[/.:-]\d|\s*(?:\+\s*)?${GUEST_WORD}|[\s-]*(?:of\s+)?${MONTH})`,
);
const BUDGET_WORD_BEFORE = pattern(
  String.raw`(?:budget|cost|spend|spending|खर्च|बजट|বাজেট|খরচ)\D{0,16}$`,
);

function currencyOf(symbol: string): Currency {
  const key = symbol.toLowerCase().replace('.', '');
  if (key === '$' || key === 'usd') return 'USD';
  if (key === '€' || key === 'eur') return 'EUR';
  if (key === '£' || key === 'gbp') return 'GBP';
  return 'INR';
}

/** An amount found in the text, with how it was written and the words just before it. */
interface AmountHit {
  amount: number;
  currency: string | undefined;
  unit: string | undefined;
  before: string;
}

/** Reads one AMOUNT match, unless it is really part of a date or a head count. */
function readAmount(text: string, match: RegExpExecArray): AmountHit | undefined {
  const [whole, currency, digits = '', unit] = match;
  const before = text.slice(Math.max(0, match.index - 24), match.index);
  const after = text.slice(match.index + whole.length);
  // The year of 14-02-2027 is not money; the "20 lakh" of "18-20 lakh" is.
  if (NOT_MONEY_AFTER.test(after) || /\d[/.-]\d{1,2}[/.-]$/.test(before)) return undefined;
  const amount = parseAmount(`${digits.replace(/,+$/, '')}${unit ?? ''}`);
  if (amount === null || amount < 1000) return undefined;
  return { amount, currency, unit, before };
}

/** The first amount with a currency or scale word, else a plain number right after "budget". */
export function findBudget(text: string): { amount: number; currency?: Currency } | undefined {
  let nearBudgetWord: number | undefined;
  for (const match of text.matchAll(AMOUNT)) {
    const hit = readAmount(text, match);
    if (!hit) continue;
    if (hit.currency) return { amount: hit.amount, currency: currencyOf(hit.currency) };
    if (hit.unit) return { amount: hit.amount };
    if (nearBudgetWord === undefined && BUDGET_WORD_BEFORE.test(hit.before)) {
      nearBudgetWord = hit.amount;
    }
  }
  return nearBudgetWord === undefined ? undefined : { amount: nearBudgetWord };
}
