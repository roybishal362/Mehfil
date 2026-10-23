/**
 * Instant, deterministic reading of a celebration description ("A Bengali wedding in Kolkata on
 * 14 Feb 2027 for 300 guests, budget ₹18 lakh"). It powers the live "Understood" chips while the
 * user types (in English, Hindi or Bengali) and the key-less demo mode. Gemini does the full
 * extraction; this only reports clear signals and never guesses.
 */
import type { Currency, DietaryNeed, EventType } from '../schemas/primitives';
import { MAX_GUESTS } from '../schemas/brief';
import { addDays, isIsoDate } from '../utils/dates';
import { normaliseDigits, parseAmount } from '../utils/money';
import { foldForMatching } from '../utils/text';

export interface QuickParse {
  type?: EventType;
  date?: string;
  city?: string;
  guestCount?: number;
  budget?: number;
  /** Only set when the text names a currency (₹, Rs, $, €, £). */
  currency?: Currency;
  dietary: DietaryNeed[];
}

/** A case-insensitive Unicode pattern whose Hindi and Bengali words are folded like the input. */
function pattern(source: string, flags = 'iu'): RegExp {
  return new RegExp(foldForMatching(source), flags);
}

/** Indic scripts have no `\b`; these make a word match only on its own. */
const NO_LETTER_BEFORE = String.raw`(?<![\p{L}\p{M}])`;
const NO_LETTER_AFTER = String.raw`(?![\p{L}\p{M}])`;

/** Specific occasions come first: "our wedding anniversary" is an anniversary, not a wedding. */
const TYPE_PATTERNS: readonly (readonly [EventType, RegExp])[] = [
  [
    'other',
    pattern(
      String.raw`\b(?:anniversary|baby shower|godh bharai|housewarming|griha pravesh|graduation|reunion|farewell|retirement|annaprashan|mundan|naming ceremony|namkaran)\b|सालगिरह|वर्षगांठ|गृह प्रवेश|अन्नप्राशन|বার্ষিকী|অন্নপ্রাশন|গৃহপ্রবেশ`,
    ),
  ],
  [
    'wedding',
    pattern(
      String.raw`\b(?:wedding|marriage|shaadi|shadi|vivah|biye|nikah|reception|sangeet|mehendi|mehndi|haldi)\b|शादी|विवाह|বিয়ে|বিবাহ`,
    ),
  ],
  ['birthday', pattern(String.raw`\b(?:birthday|b'?day|bday)\b|जन्मदिन|জন্মদিন`)],
  [
    'community',
    pattern(
      String.raw`\b(?:puja|pooja|festival|fest|community|society|fundraiser|meetup|meet-up|mela|durga|ganesh|ganpati|diwali|holi|eid|christmas|navratri|garba|iftar)\b|पूजा|त्योहार|উৎসব|পুজো|পূজা`,
    ),
  ],
];

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

const MONTH = `(?:\\b(?:${EN_MONTH})\\b\\.?|${NO_LETTER_BEFORE}(?:${INDIC_MONTHS.flat().join('|')})(?:তে)?${NO_LETTER_AFTER})`;
/** English ordinals and the Bengali ones used in dates (১লা, ২রা, ৪ঠা, ১৪ই, ২১শে). */
const ORDINAL = String.raw`(?:st|nd|rd|th|লা|রা|ঠা|ই|শে)`;

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

/** Finds 14 Feb 2027, Feb 14, 14/02/2027, 2027-02-14 or १४ फ़रवरी; a missing year means the next one. */
function findDate(text: string, today: string): string | undefined {
  const iso = ISO_DATE.exec(text);
  if (iso && isIsoDate(iso[0])) return iso[0];

  let day: number;
  let month: number | undefined;
  let year: number | undefined;
  const dayMonth = DAY_MONTH.exec(text);
  const monthDay = dayMonth ? null : MONTH_DAY.exec(text);
  const numeric = dayMonth || monthDay ? null : NUMERIC_DATE.exec(text);
  if (dayMonth) {
    day = Number(dayMonth[1]);
    month = monthNumber(dayMonth[2] ?? '');
    year = dayMonth[3] ? Number(dayMonth[3]) : undefined;
  } else if (monthDay) {
    month = monthNumber(monthDay[1] ?? '');
    day = Number(monthDay[2]);
    year = monthDay[3] ? Number(monthDay[3]) : undefined;
  } else if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
    year = Number(numeric[3]);
  } else {
    return undefined;
  }
  if (month === undefined) return undefined;

  const thisYear = Number(today.slice(0, 4));
  const candidate = `${String(year ?? thisYear)}-${pad(month)}-${pad(day)}`;
  if (year !== undefined || candidate >= today) return isIsoDate(candidate) ? candidate : undefined;
  const nextYear = `${String(thisYear + 1)}-${pad(month)}-${pad(day)}`;
  return isIsoDate(nextYear) ? nextYear : undefined;
}

/** Cities people often name without "in". Longer names first so "New Delhi" beats "Delhi". */
const KNOWN_CITIES = [
  'New Delhi',
  'Navi Mumbai',
  'Kolkata',
  'Calcutta',
  'Mumbai',
  'Bombay',
  'Delhi',
  'Bengaluru',
  'Bangalore',
  'Chennai',
  'Hyderabad',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
  'Goa',
  'Udaipur',
  'Chandigarh',
  'Kochi',
  'Guwahati',
  'Bhubaneswar',
  'Patna',
  'Indore',
  'Surat',
  'Nagpur',
  'Siliguri',
  'Durgapur',
  'Shillong',
  'Varanasi',
  'Noida',
  'Gurugram',
  'Gurgaon',
  'Dubai',
  'Singapore',
  'London',
  'New York',
  'Toronto',
  'Sydney',
] as const;
const CITY_ALIASES: Readonly<Record<string, string>> = {
  calcutta: 'Kolkata',
  bombay: 'Mumbai',
  bangalore: 'Bengaluru',
  gurgaon: 'Gurugram',
};
const KNOWN_CITY = new RegExp(`\\b(${KNOWN_CITIES.join('|')})\\b`, 'i');
const INDIC_CITIES: readonly (readonly [string, string])[] = (
  [
    ['कोलकाता', 'Kolkata'],
    ['कलकत्ता', 'Kolkata'],
    ['কলকাতা', 'Kolkata'],
    ['दिल्ली', 'Delhi'],
    ['দিল্লি', 'Delhi'],
    ['मुंबई', 'Mumbai'],
    ['মুম্বই', 'Mumbai'],
    ['মুম্বাই', 'Mumbai'],
    ['बेंगलुरु', 'Bengaluru'],
    ['बैंगलोर', 'Bengaluru'],
    ['चेन्नई', 'Chennai'],
    ['চেন্নাই', 'Chennai'],
    ['हैदराबाद', 'Hyderabad'],
    ['पुणे', 'Pune'],
    ['जयपुर', 'Jaipur'],
    ['लखनऊ', 'Lucknow'],
    ['पटना', 'Patna'],
    ['वाराणसी', 'Varanasi'],
    ['শিলিগুড়ি', 'Siliguri'],
    ['দুর্গাপুর', 'Durgapur'],
    ['গুয়াহাটি', 'Guwahati'],
  ] as const
).map(([name, city]) => [foldForMatching(name), city] as const);

/** Capitalised words after "in" that are not places ("in March", "in the evening"). */
const NOT_PLACES = new Set(
  [
    ...['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August'],
    ...['September', 'October', 'November', 'December', 'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul'],
    ...['Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    ...['Friday', 'Saturday', 'Sunday', 'Summer', 'Winter', 'Spring', 'Autumn', 'Monsoon'],
    ...['Morning', 'Afternoon', 'Evening', 'Night', 'The', 'A', 'An', 'My', 'Our', 'Their', 'His'],
    ...['Her', 'This', 'Next', 'English', 'Hindi', 'Bengali', 'Bangla', 'Diwali', 'Person'],
  ].map((word) => word.toLowerCase()),
);
const IN_PLACE = /\bin\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/g;

function findCity(text: string): string | undefined {
  const known = KNOWN_CITY.exec(text);
  const indic = INDIC_CITIES.map(([name, city]) => ({ city, index: text.indexOf(name) }))
    .filter((hit) => hit.index >= 0)
    .sort((a, b) => a.index - b.index)[0];
  if (known?.[1] && (!indic || known.index < indic.index)) {
    const name = known[1];
    const canonical =
      KNOWN_CITIES.find((city) => city.toLowerCase() === name.toLowerCase()) ?? name;
    return CITY_ALIASES[canonical.toLowerCase()] ?? canonical;
  }
  if (indic) return indic.city;
  for (const match of text.matchAll(IN_PLACE)) {
    const [, first = '', second] = match;
    if (NOT_PLACES.has(first.toLowerCase())) continue;
    return second && !NOT_PLACES.has(second.toLowerCase()) ? `${first} ${second}` : first;
  }
  return undefined;
}

/** "guests" in English, Hindi and Bengali. A following virama would make it another word (जन्मदिन). */
const GUEST_WORD = String.raw`(?:guests?|people|persons?|pax|attendees|invitees|heads|लोग|मेहमान|अतिथि|जन|মেহমান|অতিথি|লোক|জন)(?!\p{Mn})`;
const GUESTS_AFTER_NUMBER = pattern(String.raw`(\d[\d,]*)\s*(?:\+\s*)?${GUEST_WORD}`);
const GUESTS_BEFORE_NUMBER = pattern(
  String.raw`\b(?:guests?|guest count|headcount)\s*(?:of|:|=|-|~)?\s*(?:about|around|approx\.?|roughly)?\s*(\d[\d,]*)(?![\d./:-])(?!\s*${MONTH})`,
);

function findGuests(text: string): number | undefined {
  for (const regex of [GUESTS_AFTER_NUMBER, GUESTS_BEFORE_NUMBER]) {
    const digits = regex.exec(text)?.[1];
    if (!digits) continue;
    const value = Number(digits.replace(/,/g, ''));
    if (value >= 1 && value <= MAX_GUESTS) return value;
  }
  return undefined;
}

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

/** The first amount with a currency or scale word, else a plain number right after "budget". */
function findBudget(text: string): { amount: number; currency?: Currency } | undefined {
  let nearBudgetWord: number | undefined;
  for (const match of text.matchAll(AMOUNT)) {
    const [whole, currency, rawDigits = '', unit] = match;
    const digits = rawDigits.replace(/,+$/, '');
    const before = text.slice(Math.max(0, match.index - 24), match.index);
    const after = text.slice(match.index + whole.length);
    // The year of 14-02-2027 is not money; the "20 lakh" of "18-20 lakh" is.
    if (NOT_MONEY_AFTER.test(after) || /\d[/.-]\d{1,2}[/.-]$/.test(before)) continue;
    const amount = parseAmount(`${digits}${unit ?? ''}`);
    if (amount === null || amount < 1000) continue;
    if (currency) return { amount, currency: currencyOf(currency) };
    if (unit) return { amount };
    if (nearBudgetWord === undefined && BUDGET_WORD_BEFORE.test(before)) nearBudgetWord = amount;
  }
  return nearBudgetWord === undefined ? undefined : { amount: nearBudgetWord };
}

const NON_VEG = pattern(String.raw`\bnon[- ]?veg|मांसाहारी|আমিষ`);
const STRICTLY_VEG = pattern(String.raw`\b(?:pure[- ]veg|veg[- ]only|only veg|strictly veg)`);
const DIET_PATTERNS: readonly (readonly [DietaryNeed, RegExp])[] = [
  ['jain', pattern(String.raw`\bjain\b|जैन|জৈন`)],
  ['vegan', pattern(String.raw`\bvegan\b`)],
  ['vegetarian', pattern(String.raw`\b(?:veg|vegetarian)\b|शाकाहारी|নিরামিষ`)],
  ['halal', pattern(String.raw`\bhalal\b|हलाल|হালাল`)],
  [
    'no_onion_garlic',
    pattern(String.raw`\b(?:no|without)\s+(?:onion|garlic)|बिना प्याज|পেঁয়াজ ছাড়া`),
  ],
  ['gluten_free', pattern(String.raw`\bgluten[- ]free\b`)],
  ['nut_free', pattern(String.raw`\bnut[- ]free\b|\bnut allerg`)],
];

function findDietary(text: string): DietaryNeed[] {
  const needs: DietaryNeed[] = [];
  // "veg and non-veg food" is a mixed menu, not a vegetarian one.
  const mixedMenu = NON_VEG.test(text) && !STRICTLY_VEG.test(text);
  for (const [need, regex] of DIET_PATTERNS) {
    if (need === 'vegetarian' && (mixedMenu || needs.includes('vegan'))) continue;
    if (regex.test(text)) needs.push(need);
  }
  return needs;
}

export function quickParse(raw: string, today: string): QuickParse {
  const text = foldForMatching(normaliseDigits(raw));
  const result: QuickParse = { dietary: findDietary(text) };
  const type = TYPE_PATTERNS.find(([, regex]) => regex.test(text))?.[0];
  if (type) result.type = type;
  const date = findDate(text, today);
  if (date && date >= today && date <= addDays(today, 3 * 365)) result.date = date;
  const city = findCity(text);
  if (city) result.city = city;
  const guestCount = findGuests(text);
  if (guestCount !== undefined) result.guestCount = guestCount;
  const budget = findBudget(text);
  if (budget) {
    result.budget = budget.amount;
    if (budget.currency) result.currency = budget.currency;
  }
  return result;
}
