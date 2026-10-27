/**
 * Instant, deterministic reading of a celebration description ("A Bengali wedding in Kolkata on
 * 14 Feb 2027 for 300 guests, budget ₹18 lakh"). It powers the live "Understood" chips while the
 * user types (in English, Hindi or Bengali) and the key-less demo mode. Gemini does the full
 * extraction; this only reports clear signals and never guesses. Each kind of detail has its own
 * reader in ./parse.
 */
import type { Currency, DietaryNeed, EventType } from '../schemas/primitives';
import { normaliseDigits } from '../utils/money';
import { foldForMatching } from '../utils/text';
import { findBudget } from './parse/amounts';
import { plannableDate } from './parse/dates';
import { findDietary } from './parse/diet';
import { findGuests } from './parse/guests';
import { findType } from './parse/occasion';
import { findCity } from './parse/places';

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

export function quickParse(raw: string, today: string): QuickParse {
  // Nothing typed yet (the usual first render): skip compiling and running the patterns.
  if (!raw.trim()) return { dietary: [] };
  const text = foldForMatching(normaliseDigits(raw));
  const type = findType(text);
  const date = plannableDate(text, today);
  const city = findCity(text);
  const guestCount = findGuests(text);
  const budget = findBudget(text);
  // Fields only appear when found, so the chips show exactly what was understood.
  return {
    dietary: findDietary(text),
    ...(type ? { type } : {}),
    ...(date ? { date } : {}),
    ...(city ? { city } : {}),
    ...(guestCount === undefined ? {} : { guestCount }),
    ...(budget ? { budget: budget.amount } : {}),
    ...(budget?.currency ? { currency: budget.currency } : {}),
  };
}
