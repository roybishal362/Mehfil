/** Demo answer for reading a description: the local parser plus one follow-up question. */
import type { BriefExtraction } from '../../../shared/schemas/ai';
import type { EventBrief } from '../../../shared/schemas/brief';
import { quickParse } from '../../../shared/domain/quick-parse';

/** Festivals a description may name, as Gemini would put them in "kind of celebration". */
const FESTIVALS: readonly (readonly [RegExp, string])[] = [
  [/diwali|deepavali|दिवाली|दीपावली|দীপাবলি/iu, 'Diwali'],
  [/durga|pujo\b|दुर्गा|দুর্গা|পুজো/iu, 'Durga Puja'],
  [/ganesh|ganpati|गणेश|गणपति|গণেশ|গণপতি/iu, 'Ganesh Chaturthi'],
];

export function mockFestival(text: string): string | undefined {
  return FESTIVALS.find(([pattern]) => pattern.test(text))?.[1];
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
  const couple = /\b([A-Z][a-z]+)\s+(?:and|&|weds)\s+([A-Z][a-z]+)\b/.exec(text);
  if (type === 'wedding' && couple?.[1] && couple[2])
    return `${couple[1]} & ${couple[2]}'s Wedding`;
  const birthday = /\b([A-Z][a-z]+)['’]s\s+(\d{1,3}(?:st|nd|rd|th))\b/.exec(text);
  if (type === 'birthday' && birthday?.[1] && birthday[2]) {
    return `${birthday[1]}'s ${birthday[2]} Birthday`;
  }
  if (!type || !city) return undefined;
  const festival = type === 'wedding' || type === 'birthday' ? undefined : mockFestival(text);
  if (festival) return `${city} ${festival}`;
  const occasion = {
    wedding: 'Wedding',
    birthday: 'Birthday',
    community: 'Celebration',
    other: 'Celebration',
  }[type];
  return `${city} ${occasion}`;
}

export function mockBriefExtraction(
  text: string,
  today: string,
  uiLanguage: string,
): BriefExtraction {
  const quick = quickParse(text, today);
  const brief: BriefExtraction['brief'] = {
    ...(quick.type ? { type: quick.type } : {}),
    ...(quick.date ? { date: quick.date } : {}),
    ...(quick.city ? { city: quick.city } : {}),
    ...(quick.guestCount ? { guestCount: quick.guestCount } : {}),
    ...(quick.budget ? { budget: quick.budget, currency: quick.currency ?? 'INR' } : {}),
    ...(quick.dietary.length ? { dietary: quick.dietary } : {}),
    language: uiLanguage === 'hi' || uiLanguage === 'bn' ? uiLanguage : 'en',
  };
  const title = mockTitle(text, quick.type, quick.city);
  if (title) brief.title = title;
  const festival =
    quick.type === 'wedding' || quick.type === 'birthday' ? undefined : mockFestival(text);
  if (festival) brief.subtype = festival;
  const ritual = /(gaye holud|haldi|mehendi|mehndi|sangeet)[^,.;]*/i.exec(text);
  if (ritual) brief.traditions = ritual[0].trim();
  if (/wheelchair|elderly|grandparent|accessib/i.test(text)) {
    brief.accessibility = 'Step-free access for elderly guests and wheelchair users';
  }
  const missing = (['type', 'date', 'city', 'guestCount', 'budget'] as const).filter(
    (field) => brief[field] === undefined,
  );
  const questions: Record<(typeof missing)[number], string> = {
    type: 'What are you celebrating: a wedding, a birthday or a community event?',
    date: 'When is the celebration?',
    city: 'Which city will it be in?',
    guestCount: 'Roughly how many guests are you expecting?',
    budget: 'What total budget do you have in mind?',
  };
  const first = missing[0];
  return { brief, missing, ...(first ? { question: questions[first] } : {}) };
}
