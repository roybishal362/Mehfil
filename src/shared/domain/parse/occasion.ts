/** Which kind of celebration a description is about. */
import type { EventType } from '../../schemas/primitives';
import { pattern } from './patterns';

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

/** The occasion the text names, if any. */
export function findType(text: string): EventType | undefined {
  return TYPE_PATTERNS.find(([, regex]) => regex.test(text))?.[0];
}
