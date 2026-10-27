/** How many guests a description mentions ("300 guests", "headcount: 120", "৩০০ জন"). */
import { MAX_GUESTS } from '../../schemas/brief';
import { MONTH } from './dates';
import { pattern } from './patterns';

/** "guests" in English, Hindi and Bengali. A following virama would make it another word (जन्मदिन). */
export const GUEST_WORD = String.raw`(?:guests?|people|persons?|pax|attendees|invitees|heads|लोग|मेहमान|अतिथि|जन|মেহমান|অতিথি|লোক|জন)(?!\p{Mn})`;
const GUESTS_AFTER_NUMBER = pattern(String.raw`(\d[\d,]*)\s*(?:\+\s*)?${GUEST_WORD}`);
const GUESTS_BEFORE_NUMBER = pattern(
  String.raw`\b(?:guests?|guest count|headcount)\s*(?:of|:|=|-|~)?\s*(?:about|around|approx\.?|roughly)?\s*(\d[\d,]*)(?![\d./:-])(?!\s*${MONTH})`,
);

export function findGuests(text: string): number | undefined {
  for (const regex of [GUESTS_AFTER_NUMBER, GUESTS_BEFORE_NUMBER]) {
    const digits = regex.exec(text)?.[1];
    if (!digits) continue;
    const value = Number(digits.replace(/,/g, ''));
    if (value >= 1 && value <= MAX_GUESTS) return value;
  }
  return undefined;
}
