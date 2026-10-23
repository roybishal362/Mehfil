/**
 * Read-only share snapshots. A shared link shows the plan to family or co-organisers without
 * personal data: no guest names or contacts, no vendor phone numbers, no private notes.
 * Snapshots read back from storage are untrusted and re-validated with `SharedPlan`.
 */
import * as z from 'zod';
import { summariseGuests } from '../domain/guests';
import { BudgetCategory, VendorCategory } from '../schemas/categories';
import { Idea, Risk, ScheduleItem, type EventPlan } from '../schemas/plan';
import {
  Currency,
  EventType,
  Id,
  IsoDate,
  Money,
  Priority,
  TaskStatus,
  VendorStatus,
  requiredText,
  text,
} from '../schemas/primitives';

export const SHARE_TTL_DAYS = 90;

export const SharedPlan = z.object({
  version: z.literal(1),
  title: requiredText(80),
  type: EventType,
  date: IsoDate,
  endDate: IsoDate.optional(),
  city: requiredText(80),
  guestCount: z.number().int().min(1).max(5000),
  language: z.string().max(5),
  summary: text(800).optional(),
  budget: z
    .object({
      currency: Currency,
      total: Money,
      lines: z
        .array(z.object({ category: BudgetCategory, label: text(60).optional(), planned: Money }))
        .max(40),
    })
    .optional(),
  tasks: z
    .array(
      z.object({
        title: requiredText(120),
        dueDate: IsoDate,
        status: TaskStatus,
        priority: Priority,
      }),
    )
    .max(300),
  vendors: z
    .array(
      z.object({
        category: VendorCategory,
        label: text(60).optional(),
        status: VendorStatus,
        bookBy: IsoDate,
      }),
    )
    .max(40),
  ideas: z.array(Idea.omit({ id: true, favorite: true, source: true })).max(80),
  schedule: z
    .array(ScheduleItem.omit({ id: true, source: true, owner: true, notes: true }))
    .max(80),
  risks: z.array(Risk.omit({ id: true, source: true })).max(20),
  guests: z.object({ confirmed: z.number().int().min(0), expected: z.number().int().min(0) }),
  sharedAt: z.iso.datetime(),
});
export type SharedPlan = z.infer<typeof SharedPlan>;

export interface ShareOptions {
  includeBudget: boolean;
  now: string;
}

export function toShareSnapshot(plan: EventPlan, { includeBudget, now }: ShareOptions): SharedPlan {
  const { brief } = plan;
  const guests = summariseGuests(plan.guests);
  return {
    version: 1,
    title: brief.title,
    type: brief.type,
    date: brief.date,
    ...(brief.endDate ? { endDate: brief.endDate } : {}),
    city: brief.city,
    guestCount: brief.guestCount,
    language: brief.language,
    ...(plan.summary ? { summary: plan.summary } : {}),
    ...(includeBudget
      ? {
          budget: {
            currency: plan.budget.currency,
            total: plan.budget.total,
            lines: plan.budget.lines.map((l) => ({
              category: l.category,
              ...(l.label ? { label: l.label } : {}),
              planned: l.planned,
            })),
          },
        }
      : {}),
    tasks: plan.tasks.map((t) => ({
      title: t.title,
      dueDate: t.dueDate,
      status: t.status,
      priority: t.priority,
    })),
    vendors: plan.vendors.map((v) => ({
      category: v.category,
      ...(v.label ? { label: v.label } : {}),
      status: v.status,
      bookBy: v.bookBy,
    })),
    ideas: plan.ideas.map(({ id: _id, favorite: _favorite, source: _source, ...idea }) => idea),
    schedule: plan.schedule.map(
      ({ id: _id, source: _source, owner: _owner, notes: _notes, ...slot }) => slot,
    ),
    risks: plan.risks.map(({ id: _id, source: _source, ...risk }) => risk),
    guests: {
      confirmed: guests.confirmed,
      expected: plan.guests.length > 0 ? guests.expected : brief.guestCount,
    },
    sharedAt: now,
  };
}

/** A share link's document ID must look like a 128-bit token. */
export const ShareId = Id.regex(/^[A-Za-z0-9_-]{22}$/, 'Invalid share link');
