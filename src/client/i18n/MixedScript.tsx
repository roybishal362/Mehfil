/**
 * Text in one language that names another, such as "in English, हिन्दी or বাংলা". Hindi and
 * Bengali words that are not in the page's language are marked with their own `lang`, so
 * screen readers pronounce them properly (WCAG 3.1.2), and they use the system's fonts
 * (base.css), so a page does not download a whole script's web font for one word.
 */
import { useI18n, type Locale } from '.';

/** Runs of Devanagari or of Bengali letters. The danda (।) is shared, so it starts no run. */
const RUNS =
  /([\u0900-\u0963\u0966-\u097F]+(?:\s+[\u0900-\u0963\u0966-\u097F]+)*)|([\u0980-\u09FF]+(?:\s+[\u0980-\u09FF]+)*)/gu;

export function MixedScript({ text }: { text: string }) {
  const { locale } = useI18n();
  return <>{splitByScript(text, locale)}</>;
}

/** The text as plain strings and <span lang> elements, for rendering. */
export function splitByScript(text: string, locale: Locale): (string | React.JSX.Element)[] {
  const parts: (string | React.JSX.Element)[] = [];
  let last = 0;
  for (const match of text.matchAll(RUNS)) {
    const lang = match[1] ? 'hi' : 'bn';
    if (lang === locale) continue;
    parts.push(text.slice(last, match.index));
    parts.push(
      <span key={match.index} lang={lang} className="native">
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return parts.filter((part) => part !== '');
}
