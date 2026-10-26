/**
 * The step-by-step form's rules, kept free of React so they are easy to test: field values,
 * per-step validation (with the same limits as the shared brief schema) and conversion to a
 * brief draft.
 */
import { MAX_EVENT_DAYS, MAX_GUESTS, MIN_BUDGET } from '../../../shared/schemas/brief';
import type {
  Currency,
  DietaryNeed,
  EventType,
  OutputLanguage,
  VenueType,
} from '../../../shared/schemas/primitives';
import { addDays, isIsoDate } from '../../../shared/utils/dates';
import { parseAmount } from '../../../shared/utils/money';
import { en } from '../../i18n/en';
import type { Messages } from '../../i18n/types';
import type { DraftBrief } from './intake';

export const STYLE_KEYS = [
  'traditional',
  'modern',
  'minimal',
  'grand',
  'intimate',
  'eco',
  'fun',
  'elegant',
] as const;
type StyleKey = (typeof STYLE_KEYS)[number];

/** Names of the AI output languages in their own scripts. */
export const LANGUAGE_ENDONYMS: Readonly<Record<OutputLanguage, string>> = {
  en: 'English',
  hi: 'हिन्दी',
  bn: 'বাংলা',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  mr: 'मराठी',
  gu: 'ગુજરાતી',
  kn: 'ಕನ್ನಡ',
  ml: 'മലയാളം',
  pa: 'ਪੰਜਾਬੀ',
  or: 'ଓଡ଼ିଆ',
  as: 'অসমীয়া',
  ur: 'اردو',
  es: 'Español',
  fr: 'Français',
  ar: 'العربية',
};

export interface WizardValues {
  type: EventType | '';
  title: string;
  subtype: string;
  date: string;
  endDate: string;
  startTime: string;
  city: string;
  venueType: VenueType;
  guestCount: string;
  /** As typed: "18 lakh", "1.5 crore", "50k" … */
  budget: string;
  currency: Currency;
  styles: StyleKey[];
  traditions: string;
  dietary: DietaryNeed[];
  accessibility: string;
  notes: string;
  language: OutputLanguage;
}

export type WizardField = keyof WizardValues;
type WizardError = keyof Messages['wizard']['errors'];
export type WizardErrors = Partial<Record<WizardField, WizardError>>;

/** The fields each step checks before moving on. */
const STEP_FIELDS: readonly (readonly WizardField[])[] = [
  ['type', 'title', 'date', 'endDate', 'city'],
  ['guestCount', 'budget'],
  [],
];
export const STEP_COUNT = STEP_FIELDS.length;

const MAX_DAYS_AHEAD = 3 * 365;

type Problem = WizardError | null;

/** A real date from today up to three years ahead. */
function dateProblem(date: string, today: string): Problem {
  if (!isIsoDate(date) || date < today) return 'date';
  return date > addDays(today, MAX_DAYS_AHEAD) ? 'dateTooFar' : null;
}

/** The end date is optional; when given, the celebration may last up to MAX_EVENT_DAYS. */
function endDateProblem({ date, endDate }: WizardValues): Problem {
  if (!endDate) return null;
  if (!isIsoDate(endDate)) return 'endDate';
  if (!isIsoDate(date)) return null;
  return endDate < date || endDate > addDays(date, MAX_EVENT_DAYS) ? 'endDate' : null;
}

function guestCountProblem(text: string): Problem {
  const guests = Number(text);
  return Number.isInteger(guests) && guests >= 1 && guests <= MAX_GUESTS ? null : 'guestCount';
}

function budgetProblem(text: string): Problem {
  const budget = parseAmount(text);
  return budget !== null && budget >= MIN_BUDGET ? null : 'budget';
}

/** Each checked field's rule, with the same limits as the shared brief schema. */
const FIELD_RULES: Partial<Record<WizardField, (values: WizardValues, today: string) => Problem>> =
  {
    type: (values) => (values.type ? null : 'type'),
    title: (values) => (values.title.trim() ? null : 'title'),
    date: (values, today) => dateProblem(values.date, today),
    endDate: (values) => endDateProblem(values),
    city: (values) => (values.city.trim() ? null : 'city'),
    guestCount: (values) => guestCountProblem(values.guestCount),
    budget: (values) => budgetProblem(values.budget),
  };

export function validateStep(step: number, values: WizardValues, today: string): WizardErrors {
  const errors: WizardErrors = {};
  for (const field of STEP_FIELDS[step] ?? []) {
    const problem = FIELD_RULES[field]?.(values, today);
    if (problem) errors[field] = problem;
  }
  return errors;
}

/** Every step's problems, and the first step that has any. */
export function validateAll(
  values: WizardValues,
  today: string,
): { errors: WizardErrors; step: number } {
  let errors: WizardErrors = {};
  let first = -1;
  for (let step = 0; step < STEP_COUNT; step += 1) {
    const stepErrors = validateStep(step, values, today);
    if (first < 0 && Object.keys(stepErrors).length > 0) first = step;
    errors = { ...errors, ...stepErrors };
  }
  return { errors, step: first };
}

const STYLE_BY_ENGLISH = new Map(STYLE_KEYS.map((key) => [en.styles[key].toLowerCase(), key]));

type TextField =
  'title' | 'date' | 'endDate' | 'startTime' | 'city' | 'traditions' | 'accessibility' | 'notes';

/** Text fields start empty when the draft does not have them. */
function textValues(draft: DraftBrief): Pick<WizardValues, TextField> {
  return {
    title: draft.title ?? '',
    date: draft.date ?? '',
    endDate: draft.endDate ?? '',
    startTime: draft.startTime ?? '',
    city: draft.city ?? '',
    traditions: draft.traditions ?? '',
    accessibility: draft.accessibility ?? '',
    notes: draft.notes ?? '',
  };
}

/** Numbers as the user would type them, empty when unknown; amounts default to rupees. */
function numberValues(draft: DraftBrief): Pick<WizardValues, 'guestCount' | 'budget' | 'currency'> {
  return {
    guestCount: draft.guestCount ? String(draft.guestCount) : '',
    budget: draft.budget ? String(draft.budget) : '',
    currency: draft.currency ?? 'INR',
  };
}

export function valuesFromDraft(
  draft: DraftBrief,
  defaults: { language: OutputLanguage; type?: EventType; subtype?: string },
): WizardValues {
  const type = draft.type ?? defaults.type;
  return {
    ...textValues(draft),
    ...numberValues(draft),
    type: type ?? '',
    subtype: draft.subtype ?? defaults.subtype ?? '',
    venueType: draft.venueType ?? (type === 'community' ? 'community_hall' : 'banquet_hall'),
    styles: (draft.styles ?? [])
      .map((style) => STYLE_BY_ENGLISH.get(style.toLowerCase()))
      .filter((key) => key !== undefined),
    dietary: draft.dietary ?? [],
    language: draft.language ?? defaults.language,
  };
}

/** `{ key: value }` when the trimmed text is not empty, otherwise nothing. */
function optional<K extends string>(key: K, value: string): Partial<Record<K, string>> {
  const trimmed = value.trim();
  return trimmed ? ({ [key]: trimmed } as Partial<Record<K, string>>) : {};
}

/** The brief draft the form describes. Styles are stored in English for the AI prompt. */
export function draftFromValues(values: WizardValues): DraftBrief {
  const budget = parseAmount(values.budget);
  return {
    ...(values.type ? { type: values.type } : {}),
    title: values.title.trim(),
    ...optional('subtype', values.subtype),
    date: values.date,
    ...optional('endDate', values.endDate),
    ...optional('startTime', values.startTime),
    city: values.city.trim(),
    venueType: values.venueType,
    guestCount: Number(values.guestCount),
    ...(budget !== null ? { budget } : {}),
    currency: values.currency,
    styles: values.styles.map((key) => en.styles[key]),
    ...optional('traditions', values.traditions),
    dietary: values.dietary,
    ...optional('accessibility', values.accessibility),
    ...optional('notes', values.notes),
    language: values.language,
  };
}
