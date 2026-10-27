/** Dates written as "14 Feb 2027", "Feb 14", "14/02/2027", "2027-02-14" or "১৪ই ফেব্রুয়ারি". */
import { addDays, isIsoDate } from '../../utils/dates';
import { foldForMatching } from '../../utils/text';
import { NO_LETTER_AFTER, NO_LETTER_BEFORE, pattern } from './patterns';

const EN_MONTH = String.raw`jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?`;
const EN_MONTH_KEYS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

/** Hindi and Bengali month names, January first. */
const INDIC_MONTHS: readonly (readonly string[])[] = [
  ['जनवरी', 'জানুয়ারি', 'জানুয়ারী'],
  ['फ़रवरी', 'ফেব্রুয়ারি', 'ফেব্রুয়ারী'],
  ['मार्च', 'মার্চ'],
  ['अप्रैल', 'এপ্রিল'],
  ['मई', 'মে'],
  ['जून', 'জুন'],
  ['जुलाई', 'জুলাই'],
  ['अगस्त', 'আগস্ট', 'অগাস্ট'],
  ['सितंबर', 'सितम्बर', 'সেপ্টেম্বর'],
  ['अक्टूबर', 'अक्तूबर', 'অক্টোবর'],
  ['नवंबर', 'नवम्बर', 'নভেম্বর'],
  ['दिसंबर', 'दिसम्बर', 'ডিসেম্বর'],
].map((names) => names.map(foldForMatching));

export const MONTH = `(?:\\b(?:${EN_MONTH})\\b\\.?|${NO_LETTER_BEFORE}(?:${INDIC_MONTHS.flat().join('|')})(?:তে)?${NO_LETTER_AFTER})`;
/** English ordinals and the Bengali ones used in dates (১লা, ২রা, ৪ঠা, ১৪ই, ২১শে). */
export const ORDINAL = String.raw`(?:st|nd|rd|th|লা|রা|ঠা|ই|শে)`;

const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const DAY_MONTH = pattern(
  String.raw`\b(\d{1,2})(?:${ORDINAL}[\s-]*|[\s-]+)(?:of\s+)?(${MONTH})(?:[\s,-]+(\d{4})(?!\d))?`,
);
const MONTH_DAY = pattern(
  String.raw`(${MONTH})[\s-]+(\d{1,2})(?!\d)(?:st|nd|rd|th)?(?:,?\s+(\d{4})(?!\d))?`,
);
const NUMERIC_DATE = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/;

function monthNumber(token: string): number | undefined {
  const english = EN_MONTH_KEYS.indexOf(token.toLowerCase().slice(0, 3));
  if (english >= 0) return english + 1;
  const indic = INDIC_MONTHS.findIndex((names) => names.some((name) => token.startsWith(name)));
  return indic >= 0 ? indic + 1 : undefined;
}

const pad = (n: number) => String(n).padStart(2, '0');

interface DateParts {
  day: number;
  month: number | undefined;
  year: number | undefined;
}

const optionalYear = (digits: string | undefined) => (digits ? Number(digits) : undefined);

/** The first date written as "14 Feb 2027", "Feb 14, 2027" or "14/02/2027", in that order. */
function dateParts(text: string): DateParts | undefined {
  const dayMonth = DAY_MONTH.exec(text);
  if (dayMonth) {
    const [, day, month = '', year] = dayMonth;
    return { day: Number(day), month: monthNumber(month), year: optionalYear(year) };
  }
  const monthDay = MONTH_DAY.exec(text);
  if (monthDay) {
    const [, month = '', day, year] = monthDay;
    return { day: Number(day), month: monthNumber(month), year: optionalYear(year) };
  }
  const numeric = NUMERIC_DATE.exec(text);
  if (!numeric) return undefined;
  const [, day, month, year] = numeric;
  return { day: Number(day), month: Number(month), year: Number(year) };
}

/** The real date those parts name. Without a year it is the next time that day comes round. */
function toIsoDate({ day, month, year }: DateParts, today: string): string | undefined {
  if (month === undefined) return undefined;
  const thisYear = Number(today.slice(0, 4));
  const inYear = (y: number) => `${String(y)}-${pad(month)}-${pad(day)}`;
  const candidate = inYear(year ?? thisYear);
  const date = year !== undefined || candidate >= today ? candidate : inYear(thisYear + 1);
  return isIsoDate(date) ? date : undefined;
}

/** Finds 14 Feb 2027, Feb 14, 14/02/2027, 2027-02-14 or १४ फ़रवरी; a missing year means the next one. */
function findDate(text: string, today: string): string | undefined {
  const iso = ISO_DATE.exec(text);
  if (iso && isIsoDate(iso[0])) return iso[0];
  const parts = dateParts(text);
  return parts && toIsoDate(parts, today);
}

/** A date the planner can use: from today up to three years ahead. */
export function plannableDate(text: string, today: string): string | undefined {
  const date = findDate(text, today);
  return date && date >= today && date <= addDays(today, 3 * 365) ? date : undefined;
}
