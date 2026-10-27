/** The city or place a description names, in English, Hindi or Bengali script. */
import { foldForMatching } from '../../utils/text';

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

interface CityHit {
  city: string;
  index: number;
}

/** A well-known city in English spelling, under its current name (Bombay is Mumbai). */
function knownCity(text: string): CityHit | undefined {
  const known = KNOWN_CITY.exec(text);
  const name = known?.[1];
  if (!known || !name) return undefined;
  const canonical = KNOWN_CITIES.find((city) => city.toLowerCase() === name.toLowerCase()) ?? name;
  return { city: CITY_ALIASES[canonical.toLowerCase()] ?? canonical, index: known.index };
}

/** The earliest city named in Hindi or Bengali script. */
function indicCity(text: string): CityHit | undefined {
  return INDIC_CITIES.map(([name, city]) => ({ city, index: text.indexOf(name) }))
    .filter((hit) => hit.index >= 0)
    .sort((a, b) => a.index - b.index)[0];
}

/** Any other place, from "in Shimla" or "in Bodh Gaya" (not "in March" or "in the evening"). */
function placeAfterIn(text: string): string | undefined {
  for (const [, first = '', second] of text.matchAll(IN_PLACE)) {
    if (NOT_PLACES.has(first.toLowerCase())) continue;
    return second && !NOT_PLACES.has(second.toLowerCase()) ? `${first} ${second}` : first;
  }
  return undefined;
}

/** The city named first, whichever script it is written in. */
export function findCity(text: string): string | undefined {
  const known = knownCity(text);
  const indic = indicCity(text);
  if (known && (!indic || known.index < indic.index)) return known.city;
  return indic?.city ?? placeAfterIn(text);
}
