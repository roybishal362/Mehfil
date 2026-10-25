/**
 * The mood of a celebration: which look the app takes on for it. Weddings and birthdays go by
 * their type; Durga Puja, Ganpati and Diwali are recognised from the name, the kind of
 * celebration and the traditions, in English, Hindi or Bengali. Other community events get the
 * festival look, and anything else stays neutral, like the home page.
 */
import type { EventBrief } from '../schemas/brief';

export const MOODS = [
  'neutral',
  'wedding',
  'birthday',
  'durga',
  'ganpati',
  'diwali',
  'utsav',
] as const;
export type Mood = (typeof MOODS)[number];

/** Checked in order; the first festival named wins. */
const FESTIVALS: readonly (readonly [Mood, RegExp])[] = [
  [
    'diwali',
    /diwali|divali|deepavali|deepawali|dipawali|kali\s*puj|दिवाली|दीपावली|দীপাবলি|দিওয়ালি|কালী\s*পুজো/iu,
  ],
  [
    'durga',
    /durga|navaratri|navratri|dussehra|dasara|sharod|pujo\b|दुर्गा|नवरात्र|দুর্গা|শারদ|পুজো/iu,
  ],
  ['ganpati', /ganpati|ganesh|vinayak|chaturthi|गणपति|गणेश|গণেশ|গণপতি/iu],
];

export function moodFor(
  brief: Pick<EventBrief, 'type' | 'title' | 'subtype' | 'traditions'>,
): Mood {
  if (brief.type === 'wedding') return 'wedding';
  if (brief.type === 'birthday') return 'birthday';
  const text = [brief.subtype, brief.title, brief.traditions].filter(Boolean).join(' ');
  for (const [mood, pattern] of FESTIVALS) {
    if (pattern.test(text)) return mood;
  }
  return brief.type === 'community' ? 'utsav' : 'neutral';
}
