/** Turns plan data into what the plan header, the diyas and the plan tiles display. */
import { moodFor, type Mood } from '../../../shared/domain/mood';
import { PROGRESS_PARTS, planProgress, type ProgressPart } from '../../../shared/domain/progress';
import { readiness } from '../../../shared/domain/readiness';
import { countdown, type Countdown } from '../../../shared/domain/timeline';
import type { EventPlan } from '../../../shared/schemas/plan';
import type { Formatters, Messages } from '../../i18n';

/** One part of the plan (budget, timeline, …) and how far along it is. */
export interface PlanPart {
  key: ProgressPart;
  label: string;
  /** 0–1. */
  value: number;
  /** "60%" or "not started". */
  caption: string;
}

function partLabel(part: ProgressPart, t: Messages): string {
  return part === 'dayOf' ? t.sections.dayOf : t.sections[part];
}

export function partsFor(
  values: Readonly<Record<ProgressPart, number>>,
  t: Messages,
  f: Formatters,
): PlanPart[] {
  return PROGRESS_PARTS.map((part) => ({
    key: part,
    label: partLabel(part, t),
    value: values[part],
    caption: values[part] > 0 ? f.percent(values[part]) : t.plan.notStarted,
  }));
}

/** "Budget 60%, Timeline not started, …" for the diyas' accessible description. */
export function partsSummary(parts: readonly PlanPart[], t: Messages): string {
  return parts.map((part) => t.plan.partValue(part.label, part.caption)).join(', ');
}

export interface PlanView {
  parts: PlanPart[];
  /** Readiness, 0–100. */
  score: number;
  countdown: Countdown;
  mood: Mood;
}

export function planView(plan: EventPlan, today: string, t: Messages, f: Formatters): PlanView {
  return {
    parts: partsFor(planProgress(plan, today), t, f),
    score: readiness(plan, today).score,
    countdown: countdown(plan.brief, today),
    mood: moodFor(plan.brief),
  };
}

/**
 * Splits a wedding title such as "Ananya & Rohan's Wedding" or "अनन्या और रोहन की शादी" into
 * the couple's names, for the calligraphy on the invitation. Returns null for other titles.
 */
export function coupleNames(title: string): [string, string] | null {
  const match = COUPLE.exec(title);
  const first = match?.[1]?.trim();
  const second = match?.[2]?.trim();
  if (!first || !second || first.length > 24 || second.length > 24) return null;
  return [first, second];
}

/** বিয়ে ("wedding" in Bengali), whichever way the য় was typed. */
const BENGALI_WEDDING = String.raw`\u{9AC}\u{9BF}(?:\u{9DF}|\u{9AF}\u{9BC}?)\u{9C7}`;
/** Words joining two names; "and" needs spaces so "Alexandra" is not split. */
const JOIN = String.raw`(?:\s*[&+]\s*|\s+(?:and|weds|और|ও|আর)\s+)`;
/** What may follow the second name: "'s Wedding", "की शादी", "-এর বিয়ে". */
const WEDDING_TAIL = String.raw`(?:['’]s)?(?:\s*(?:wedding|shaadi|marriage|reception|की\s+शादी|का\s+विवाह|(?:ের|-?এর|র)?\s+(?:${BENGALI_WEDDING}|বিবাহ)))?`;
const COUPLE = new RegExp(String.raw`^\s*(.+?)${JOIN}(.+?)${WEDDING_TAIL}\s*$`, 'iu');

/** The seal's big text and small caption for the countdown. */
export function countdownParts(
  value: Countdown,
  t: Messages,
  f: Formatters,
): { big: string; small: string; word: boolean } {
  switch (value.kind) {
    case 'upcoming':
      return { big: f.number(value.days), small: t.invitation.daysToGo(value.days), word: false };
    case 'today':
      return { big: t.invitation.today, small: t.invitation.todayNote, word: true };
    case 'ongoing':
      return {
        big: t.invitation.dayOf(f.number(value.day), f.number(value.of)),
        small: t.invitation.todayNote,
        word: true,
      };
    case 'past':
      return { big: t.invitation.celebrated, small: '', word: true };
  }
}
