/** Turns plan data into what the invitation card, rangoli and tiles display. */
import { PROGRESS_PARTS, planProgress, type ProgressPart } from '../../../shared/domain/progress';
import { readiness } from '../../../shared/domain/readiness';
import { countdown, type Countdown } from '../../../shared/domain/timeline';
import type { EventPlan } from '../../../shared/schemas/plan';
import type { Formatters, Messages } from '../../i18n';
import type { RangoliPetal } from '../../motifs/Rangoli';

export const PART_COLORS: Readonly<Record<ProgressPart, string>> = {
  budget: '#F28C28',
  timeline: '#E0457B',
  vendors: '#2CB6B0',
  ideas: '#9B7BF0',
  guests: '#33A46F',
  dayOf: '#F7B500',
};

export function partLabel(part: ProgressPart, t: Messages): string {
  return part === 'dayOf' ? t.sections.dayOf : t.sections[part];
}

export function petalsFor(
  values: Readonly<Record<ProgressPart, number>>,
  t: Messages,
  f: Formatters,
): RangoliPetal[] {
  return PROGRESS_PARTS.map((part) => ({
    key: part,
    label: partLabel(part, t),
    value: values[part],
    color: PART_COLORS[part],
    caption: values[part] > 0 ? f.percent(values[part]) : t.plan.notStarted,
  }));
}

/** "Budget 60%, Timeline not started, …" for the rangoli's accessible description. */
export function petalsSummary(petals: readonly RangoliPetal[], t: Messages): string {
  return petals.map((petal) => t.plan.partValue(petal.label, petal.caption)).join(', ');
}

export interface PlanView {
  petals: RangoliPetal[];
  /** Readiness, 0–100. */
  score: number;
  countdown: Countdown;
}

export function planView(plan: EventPlan, today: string, t: Messages, f: Formatters): PlanView {
  return {
    petals: petalsFor(planProgress(plan, today), t, f),
    score: readiness(plan, today).score,
    countdown: countdown(plan.brief, today),
  };
}

/** The sample shown on the home page before any plan exists. */
export const SAMPLE_PROGRESS: Readonly<Record<ProgressPart, number>> = {
  budget: 1,
  timeline: 0.35,
  vendors: 0.2,
  ideas: 0.8,
  guests: 0.1,
  dayOf: 0,
};

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
