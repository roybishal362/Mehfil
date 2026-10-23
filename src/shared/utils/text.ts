/** Text hygiene for user input and model output. */

/* eslint-disable no-control-regex -- matching control characters is the point */
const CONTROL_CHARS =
  /[\u{0}-\u{8}\u{B}\u{C}\u{E}-\u{1F}\u{7F}\u{200B}-\u{200F}\u{202A}-\u{202E}]/gu;
/* eslint-enable no-control-regex */

/**
 * Normalises a single-line string: Unicode NFC, no control or bidi-override characters,
 * collapsed whitespace, trimmed, and cut to `max` characters on a word boundary.
 */
export function cleanText(value: string, max: number): string {
  const flat = value.normalize('NFC').replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  // If the cut already ends at a word boundary keep it whole; otherwise back up to the last space.
  const boundary = flat[max - 1] === ' ' ? cut.length : cut.lastIndexOf(' ');
  return `${(boundary > max * 0.6 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_LIKE = /\b(?:https?:\/\/|www\.)\S+/gi;
const PHONE_CANDIDATE = /\+?\d[\d\s().-]{8,}\d/g;

/**
 * Removes emails, web addresses and phone numbers from model output.
 * Gemini must never present contact details as real; real vendors come from Google Maps links.
 * A phone number needs at least 10 digits, so dates such as 14-02-2027 are left alone.
 */
export function stripContactDetails(value: string): string {
  return value
    .replace(EMAIL, '')
    .replace(URL_LIKE, '')
    .replace(PHONE_CANDIDATE, (match) => (match.replace(/\D/g, '').length >= 10 ? '' : match))
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/**
 * Like `cleanText` but keeps line breaks (for invitations and printed cards): at most one blank
 * line in a row, each line trimmed, contact details removed.
 */
export function cleanMultilineText(value: string, max: number): string {
  const lines = value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) =>
      stripContactDetails(
        line
          .replace(CONTROL_CHARS, '')
          .replace(/[ \t]+/g, ' ')
          .trim(),
      ),
    );
  const text = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Cleans model-generated text: contact details removed, then normalised and length-capped. */
export function cleanModelText(value: string, max: number): string {
  return cleanText(stripContactDetails(value), max);
}

/**
 * Makes user text safe to place inside a delimited prompt block: angle brackets become
 * look-alike characters so the text cannot close or open the `<user_input>` tags.
 */
export function escapeForPrompt(value: string): string {
  return value.replace(CONTROL_CHARS, '').replaceAll('<', '‹').replaceAll('>', '›');
}

/**
 * Folds text for keyword matching. Keyboards encode some Hindi and Bengali letters in two ways
 * (precomposed "फ़" or "फ" + nukta), so the nukta is dropped and the result normalised: "फ़रवरी"
 * and "फरवरी" then match the same pattern. Only for matching, never for display.
 */
export function foldForMatching(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u{93C}\u{9BC}]/gu, '')
    .normalize('NFC');
}

/** Words of three or more letters, lower-cased, used to compare titles. */
function wordSet(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3),
  );
}

/** Jaccard similarity of two titles' word sets, from 0 (unrelated) to 1 (same words). */
export function titleSimilarity(a: string, b: string): number {
  const left = wordSet(a);
  const right = wordSet(b);
  if (left.size === 0 && right.size === 0)
    return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}
