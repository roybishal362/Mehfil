/** Building blocks for the parser's patterns, which read English, Hindi and Bengali. */
import { foldForMatching } from '../../utils/text';

/** A case-insensitive Unicode pattern whose Hindi and Bengali words are folded like the input. */
export function pattern(source: string, flags = 'iu'): RegExp {
  return new RegExp(foldForMatching(source), flags);
}

/** Indic scripts have no `\b`; these make a word match only on its own. */
export const NO_LETTER_BEFORE = String.raw`(?<![\p{L}\p{M}])`;
export const NO_LETTER_AFTER = String.raw`(?![\p{L}\p{M}])`;
