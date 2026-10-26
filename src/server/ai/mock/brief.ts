/** Demo answer for reading a description: the local parser plus one follow-up question. */
import type { BriefExtraction } from '../../../shared/schemas/ai';
import type { EventBrief } from '../../../shared/schemas/brief';
import { quickParse, type QuickParse } from '../../../shared/domain/quick-parse';

type ExtractedBrief = BriefExtraction['brief'];
type MissingField = BriefExtraction['missing'][number];

/** Festivals a description may name, as Gemini would put them in "kind of celebration". */
const FESTIVALS: readonly (readonly [RegExp, string])[] = [
  [/diwali|deepavali|दिवाली|दीपावली|দীপাবলি/iu, 'Diwali'],
  [/durga|pujo\b|दुर्गा|দুর্গা|পুজো/iu, 'Durga Puja'],
  [/ganesh|ganpati|गणेश|गणपति|গণেশ|গণপতি/iu, 'Ganesh Chaturthi'],
];

/** The festival a community or other celebration names; weddings and birthdays have none. */
function festivalOf(text: string, type: EventBrief['type'] | undefined): string | undefined {
  if (type === 'wedding' || type === 'birthday') return undefined;
  return FESTIVALS.find(([pattern]) => pattern.test(text))?.[1];
}

const OCCASION: Record<EventBrief['type'], string> = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  community: 'Celebration',
  other: 'Celebration',
};

/** "Ananya & Rohan's Wedding" or "Aarav's 7th Birthday", when the names are given. */
function personalTitle(text: string, type: EventBrief['type'] | undefined): string | undefined {
  const couple = /\b([A-Z][a-z]+)\s+(?:and|&|weds)\s+([A-Z][a-z]+)\b/.exec(text);
  if (type === 'wedding' && couple?.[1] && couple[2]) {
    return `${couple[1]} & ${couple[2]}'s Wedding`;
  }
  const birthday = /\b([A-Z][a-z]+)['’]s\s+(\d{1,3}(?:st|nd|rd|th))\b/.exec(text);
  if (type === 'birthday' && birthday?.[1] && birthday[2]) {
    return `${birthday[1]}'s ${birthday[2]} Birthday`;
  }
  return undefined;
}

/**
 * A title the way a person would write it: the couple's or the birthday person's name if given,
 * otherwise the city and the festival or occasion.
 */
export function mockTitle(
  text: string,
  type: EventBrief['type'] | undefined,
  city: string | undefined,
): string | undefined {
  const personal = personalTitle(text, type);
  if (personal || !type || !city) return personal;
  return `${city} ${festivalOf(text, type) ?? OCCASION[type]}`;
}

/** The fields the local parser found, in the shape Gemini returns them. */
function parsedFields(quick: QuickParse, uiLanguage: string): ExtractedBrief {
  return {
    ...(quick.type ? { type: quick.type } : {}),
    ...(quick.date ? { date: quick.date } : {}),
    ...(quick.city ? { city: quick.city } : {}),
    ...(quick.guestCount ? { guestCount: quick.guestCount } : {}),
    ...(quick.budget ? { budget: quick.budget, currency: quick.currency ?? 'INR' } : {}),
    ...(quick.dietary.length ? { dietary: quick.dietary } : {}),
    language: uiLanguage === 'hi' || uiLanguage === 'bn' ? uiLanguage : 'en',
  };
}

/** Details read from the wording: a title, the festival, rituals and accessibility needs. */
function describedFields(text: string, quick: QuickParse): Partial<ExtractedBrief> {
  const title = mockTitle(text, quick.type, quick.city);
  const subtype = festivalOf(text, quick.type);
  const traditions = /(gaye holud|haldi|mehendi|mehndi|sangeet)[^,.;]*/i.exec(text)?.[0].trim();
  const accessible = /wheelchair|elderly|grandparent|accessib/i.test(text);
  return {
    ...(title ? { title } : {}),
    ...(subtype ? { subtype } : {}),
    ...(traditions ? { traditions } : {}),
    ...(accessible
      ? { accessibility: 'Step-free access for elderly guests and wheelchair users' }
      : {}),
  };
}

const QUESTIONS: Record<MissingField, string> = {
  type: 'What are you celebrating: a wedding, a birthday or a community event?',
  date: 'When is the celebration?',
  city: 'Which city will it be in?',
  guestCount: 'Roughly how many guests are you expecting?',
  budget: 'What total budget do you have in mind?',
};

export function mockBriefExtraction(
  text: string,
  today: string,
  uiLanguage: string,
): BriefExtraction {
  const quick = quickParse(text, today);
  const brief: ExtractedBrief = {
    ...parsedFields(quick, uiLanguage),
    ...describedFields(text, quick),
  };
  const missing = (['type', 'date', 'city', 'guestCount', 'budget'] as const).filter(
    (field) => brief[field] === undefined,
  );
  const first = missing[0];
  return { brief, missing, ...(first ? { question: QUESTIONS[first] } : {}) };
}
