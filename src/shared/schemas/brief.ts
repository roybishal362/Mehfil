/**
 * The event brief: everything the planner knows about the celebration.
 * Produced by the step-by-step wizard or by Gemini from a free-text description,
 * and always validated with this schema before a plan is built.
 */
import { z } from 'zod';
import {
  ClockTime,
  Currency,
  DietaryNeed,
  EventType,
  IsoDate,
  Money,
  OutputLanguage,
  VenueType,
  requiredText,
  text,
} from './primitives';

export const MAX_GUESTS = 5000;
export const MIN_BUDGET = 1000;
/** Longest supported span for multi-day celebrations (e.g. a four-day wedding). */
export const MAX_EVENT_DAYS = 14;

/** Field definitions without defaults, so partial patches never invent values. */
const briefFields = {
  type: EventType,
  subtype: text(60).optional(),
  title: requiredText(80),
  date: IsoDate,
  endDate: IsoDate.optional(),
  startTime: ClockTime.optional(),
  city: requiredText(80),
  country: text(60),
  venueType: VenueType,
  guestCount: z.number().int().min(1).max(MAX_GUESTS),
  budget: Money.min(MIN_BUDGET),
  currency: Currency,
  styles: z.array(requiredText(30)).max(6),
  traditions: text(200).optional(),
  dietary: z.array(DietaryNeed).max(8),
  accessibility: text(200).optional(),
  mustHaves: text(300).optional(),
  avoid: text(300).optional(),
  notes: text(500).optional(),
  language: OutputLanguage,
};

/** Returns an issue message when `endDate` is before `date` or the span is too long. */
export function eventSpanProblem(date: string, endDate: string | undefined): string | null {
  if (!endDate) return null;
  const span = (Date.parse(endDate) - Date.parse(date)) / 86_400_000;
  if (span < 0) return 'End date must be on or after the start date';
  if (span > MAX_EVENT_DAYS) {
    return `A celebration can span at most ${String(MAX_EVENT_DAYS)} days`;
  }
  return null;
}

/** A complete, validated brief. Optional preferences fall back to sensible defaults. */
export const EventBrief = z
  .object({
    ...briefFields,
    country: briefFields.country.default('India'),
    venueType: briefFields.venueType.default('banquet_hall'),
    currency: briefFields.currency.default('INR'),
    styles: briefFields.styles.default([]),
    dietary: briefFields.dietary.default([]),
    language: briefFields.language.default('en'),
  })
  .superRefine((brief, ctx) => {
    const problem = eventSpanProblem(brief.date, brief.endDate);
    if (problem) ctx.addIssue({ code: 'custom', path: ['endDate'], message: problem });
  });
export type EventBrief = z.infer<typeof EventBrief>;
/** Input form of the brief: fields with defaults may be omitted. */
export type EventBriefInput = z.input<typeof EventBrief>;

/** Every field optional and no defaults: used for edits and for AI extraction results. */
export const PartialBrief = z.object(briefFields).partial();
export type PartialBrief = z.infer<typeof PartialBrief>;
