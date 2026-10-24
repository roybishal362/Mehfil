/**
 * Shared Zod primitives and enumerations.
 * These are the single source of truth for validation on the client, on the server,
 * and for the JSON schemas sent to Gemini.
 */
import * as z from '../zod';

/** Calendar date in `YYYY-MM-DD` form. Validated as a real date (no 2026-02-30). */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'Not a valid calendar date');
export type IsoDate = z.infer<typeof IsoDate>;

/** Wall-clock time `HH:MM` (24-hour). */
export const ClockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the HH:MM format');

/** Opaque identifier: short, URL-safe and never user-controlled HTML. */
export const Id = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid identifier');

/** Whole currency units (no paise/cents); capped at 1,000 crore to block absurd inputs. */
export const Money = z.number().int().min(0).max(10_000_000_000);

/** Trimmed single-line text with a hard length cap. */
export const text = (max: number) => z.string().trim().max(max);
/** Trimmed text that must not be empty. */
export const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');

export const EVENT_TYPES = ['wedding', 'birthday', 'community', 'other'] as const;
export const EventType = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventType>;

export function isEventType(value: unknown): value is EventType {
  return EventType.safeParse(value).success;
}

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'] as const;
export const Currency = z.enum(CURRENCIES);
export type Currency = z.infer<typeof Currency>;

/** Languages Gemini can write the plan in (BCP-47 primary subtags). */
export const OUTPUT_LANGUAGES = [
  'en',
  'hi',
  'bn',
  'ta',
  'te',
  'mr',
  'gu',
  'kn',
  'ml',
  'pa',
  'or',
  'as',
  'ur',
  'es',
  'fr',
  'ar',
] as const;
export const OutputLanguage = z.enum(OUTPUT_LANGUAGES);
export type OutputLanguage = z.infer<typeof OutputLanguage>;

/** Languages written right-to-left among the supported output languages. */
export const RTL_LANGUAGES: ReadonlySet<OutputLanguage> = new Set(['ur', 'ar']);

export const VENUE_TYPES = [
  'banquet_hall',
  'hotel',
  'outdoor',
  'home',
  'community_hall',
  'restaurant',
  'religious_venue',
  'destination',
  'other',
] as const;
export const VenueType = z.enum(VENUE_TYPES);
export type VenueType = z.infer<typeof VenueType>;

export const DIETARY_NEEDS = [
  'vegetarian',
  'vegan',
  'jain',
  'halal',
  'no_onion_garlic',
  'gluten_free',
  'nut_free',
  'non_vegetarian',
] as const;
export const DietaryNeed = z.enum(DIETARY_NEEDS);
export type DietaryNeed = z.infer<typeof DietaryNeed>;

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export const Priority = z.enum(PRIORITIES);
export type Priority = z.infer<typeof Priority>;

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export const TaskStatus = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TASK_CATEGORIES = [
  'planning',
  'venue',
  'vendors',
  'guests',
  'attire',
  'rituals',
  'logistics',
  'day_of',
  'after',
] as const;
export const TaskCategory = z.enum(TASK_CATEGORIES);
export type TaskCategory = z.infer<typeof TaskCategory>;

export const VENDOR_STATUSES = [
  'not_started',
  'researching',
  'contacted',
  'quoted',
  'booked',
  'paid',
] as const;
export const VendorStatus = z.enum(VENDOR_STATUSES);
export type VendorStatus = z.infer<typeof VendorStatus>;

export const RSVP_STATUSES = ['pending', 'yes', 'maybe', 'no'] as const;
export const RsvpStatus = z.enum(RSVP_STATUSES);
export type RsvpStatus = z.infer<typeof RsvpStatus>;

export const IDEA_KINDS = [
  'theme',
  'decor',
  'food',
  'entertainment',
  'activity',
  'personal',
  'favor',
  'sustainability',
] as const;
export const IdeaKind = z.enum(IDEA_KINDS);
export type IdeaKind = z.infer<typeof IdeaKind>;

export const COST_LEVELS = ['low', 'medium', 'high'] as const;
export const CostLevel = z.enum(COST_LEVELS);
export type CostLevel = z.infer<typeof CostLevel>;

export const LIKELIHOODS = ['low', 'medium', 'high'] as const;
export const Likelihood = z.enum(LIKELIHOODS);
export type Likelihood = z.infer<typeof Likelihood>;

/** Where a piece of the plan came from: the built-in template, Gemini, or the user. */
export const SOURCES = ['template', 'ai', 'user'] as const;
export const Source = z.enum(SOURCES);
export type Source = z.infer<typeof Source>;

/** The plan sections Gemini personalises independently. */
export const AI_SECTIONS = ['budget', 'timeline', 'vendors', 'ideas'] as const;
export const AiSection = z.enum(AI_SECTIONS);
export type AiSection = z.infer<typeof AiSection>;
