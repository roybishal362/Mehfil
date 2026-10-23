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
export type StyleKey = (typeof STYLE_KEYS)[number];

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
export type WizardError = keyof Messages['wizard']['errors'];
export type WizardErrors = Partial<Record<WizardField, WizardError>>;

/** The fields each step checks before moving on. */
export const STEP_FIELDS: readonly (readonly WizardField[])[] = [
  ['type', 'title', 'date', 'endDate', 'city'],
  ['guestCount', 'budget'],
  [],
];
export const STEP_COUNT = STEP_FIELDS.length;

const MAX_DAYS_AHEAD = 3 * 365;

export function validateStep(step: number, values: WizardValues, today: string): WizardErrors {
  const errors: WizardErrors = {};
  const fields = STEP_FIELDS[step] ?? [];
  const check = (field: WizardField, problem: WizardError | null) => {
    if (fields.includes(field) && problem) errors[field] = problem;
  };

  check('type', values.type ? null : 'type');
  check('title', values.title.trim() ? null : 'title');
  check(
    'date',
    !isIsoDate(values.date) || values.date < today
      ? 'date'
      : values.date > addDays(today, MAX_DAYS_AHEAD)
        ? 'dateTooFar'
        : null,
  );
  check(
    'endDate',
    values.endDate &&
      (!isIsoDate(values.endDate) ||
        (isIsoDate(values.date) &&
          (values.endDate < values.date || values.endDate > addDays(values.date, MAX_EVENT_DAYS))))
      ? 'endDate'
      : null,
  );
  check('city', values.city.trim() ? null : 'city');
  const guests = Number(values.guestCount);
  check(
    'guestCount',
    Number.isInteger(guests) && guests >= 1 && guests <= MAX_GUESTS ? null : 'guestCount',
  );
  const budget = parseAmount(values.budget);
  check('budget', budget !== null && budget >= MIN_BUDGET ? null : 'budget');
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

export function valuesFromDraft(
  draft: DraftBrief,
  defaults: { language: OutputLanguage; type?: EventType },
): WizardValues {
  return {
    type: draft.type ?? defaults.type ?? '',
    title: draft.title ?? '',
    subtype: draft.subtype ?? '',
    date: draft.date ?? '',
    endDate: draft.endDate ?? '',
    startTime: draft.startTime ?? '',
    city: draft.city ?? '',
    venueType: draft.venueType ?? (draft.type === 'community' ? 'community_hall' : 'banquet_hall'),
    guestCount: draft.guestCount ? String(draft.guestCount) : '',
    budget: draft.budget ? String(draft.budget) : '',
    currency: draft.currency ?? 'INR',
    styles: (draft.styles ?? [])
      .map((style) => STYLE_BY_ENGLISH.get(style.toLowerCase()))
      .filter((key) => key !== undefined),
    traditions: draft.traditions ?? '',
    dietary: draft.dietary ?? [],
    accessibility: draft.accessibility ?? '',
    notes: draft.notes ?? '',
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
