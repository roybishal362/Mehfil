/**
 * How far along each part of the plan is, from 0 to 1. The home page and the invitation card
 * draw these as rangoli petals, and a diya is lit at every petal that has begun.
 */
import type { EventPlan } from '../schemas/plan';
import { summariseBudget } from './budget';
import { readiness } from './readiness';
import { committedByCategory } from './vendors';

export const PROGRESS_PARTS = [
  'budget',
  'timeline',
  'vendors',
  'ideas',
  'guests',
  'dayOf',
] as const;
export type ProgressPart = (typeof PROGRESS_PARTS)[number];
export type PlanProgress = Record<ProgressPart, number>;

/** Ideas count fully once there are about a dozen, favourites counting double. */
const IDEAS_FOR_FULL_PETAL = 12;

const round2 = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;

export function planProgress(plan: EventPlan, today: string): PlanProgress {
  const ready = readiness(plan, today);
  const summary = summariseBudget(
    plan.budget,
    plan.brief.guestCount,
    committedByCategory(plan.vendors),
  );
  // A balanced allocation is most of the budget's story; money actually committed is the rest.
  const committedShare = summary.planned > 0 ? Math.min(1, summary.spent / summary.planned) : 0;
  const favourites = plan.ideas.filter((idea) => idea.favorite).length;
  const invited = plan.guests.reduce((total, guest) => total + guest.partySize, 0);
  const owned = plan.schedule.filter((item) => item.owner).length;
  return {
    budget: round2(0.6 * ready.budget + 0.4 * committedShare),
    timeline: round2(ready.tasks),
    vendors: round2(ready.vendors),
    ideas: round2((plan.ideas.length + favourites) / IDEAS_FOR_FULL_PETAL),
    guests: round2(invited / plan.brief.guestCount),
    dayOf: plan.schedule.length ? round2(owned / plan.schedule.length) : 0,
  };
}
