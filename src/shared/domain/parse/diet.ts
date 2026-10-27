/** Food needs a description mentions: Jain, vegan, vegetarian, halal and the like. */
import type { DietaryNeed } from '../../schemas/primitives';
import { NO_LETTER_BEFORE, pattern } from './patterns';

const NON_VEG = pattern(String.raw`\bnon[- ]?veg|मांसाहारी|${NO_LETTER_BEFORE}আমিষ`);
const STRICTLY_VEG = pattern(
  String.raw`\b(?:pure[- ]veg|(?<!non[- ]?)veg[- ]only|only veg|strictly veg|no non[- ]?veg)`,
);
const DIET_PATTERNS: readonly (readonly [DietaryNeed, RegExp])[] = [
  ['jain', pattern(String.raw`\bjain\b|जैन|জৈন`)],
  ['vegan', pattern(String.raw`\bvegan\b`)],
  // "veg" on its own, not the "veg" inside "non-veg".
  ['vegetarian', pattern(String.raw`(?<!non[- ]?)\b(?:veg|vegetarian)\b|शाकाहारी|নিরামিষ`)],
  ['halal', pattern(String.raw`\bhalal\b|हलाल|হালাল`)],
  [
    'no_onion_garlic',
    pattern(String.raw`\b(?:no|without)\s+(?:onion|garlic)|बिना प्याज|পেঁয়াজ ছাড়া`),
  ],
  ['gluten_free', pattern(String.raw`\bgluten[- ]free\b`)],
  ['nut_free', pattern(String.raw`\bnut[- ]free\b|\bnut allerg`)],
];

export function findDietary(text: string): DietaryNeed[] {
  const needs: DietaryNeed[] = [];
  for (const [need, regex] of DIET_PATTERNS) {
    // Vegan already implies vegetarian.
    if (need === 'vegetarian' && needs.includes('vegan')) continue;
    if (regex.test(text)) needs.push(need);
  }
  // "veg and non-veg food" serves both; "pure veg, no non-veg" serves only vegetarian food.
  if (NON_VEG.test(text) && !STRICTLY_VEG.test(text)) needs.push('non_vegetarian');
  return needs;
}
