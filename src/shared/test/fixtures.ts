/** Shared, realistic test data: a Bengali wedding in Kolkata planned on 23 Oct 2026. */
import { createBaselinePlan, type PlanContext } from '../domain/baseline';
import { EventBrief, type EventBriefInput } from '../schemas/brief';
import type { EventPlan } from '../schemas/plan';
import { sequentialIds, type IdFactory } from '../utils/ids';

export const TODAY = '2026-10-23';
export const NOW = '2026-10-23T10:00:00.000Z';

export const weddingBriefInput: EventBriefInput = {
  type: 'wedding',
  subtype: 'Bengali Hindu wedding',
  title: "Ananya & Rohan's Wedding",
  date: '2027-02-14',
  city: 'Kolkata',
  venueType: 'banquet_hall',
  guestCount: 300,
  budget: 1_800_000,
  currency: 'INR',
  styles: ['traditional', 'warm'],
  traditions: 'Bengali Hindu rituals, Gaye Holud the day before',
  dietary: ['vegetarian', 'jain'],
  accessibility: 'Grandparents use wheelchairs',
  language: 'en',
};

export function weddingBrief(overrides: Partial<EventBriefInput> = {}): EventBrief {
  return EventBrief.parse({ ...weddingBriefInput, ...overrides });
}

export function testContext(today = TODAY): PlanContext {
  return { today, now: NOW, makeId: sequentialIds() };
}

export function weddingPlan(overrides: Partial<EventBriefInput> = {}, today = TODAY): EventPlan {
  return createBaselinePlan(weddingBrief(overrides), testContext(today));
}

/** IDs for edits made after a plan was built; distinct from the plan's own `task_1`-style IDs. */
export function editIds(): IdFactory {
  let next = 0;
  return (prefix) => `${prefix}_edit${String(++next)}`;
}

/** Context for applying operations or merges to a fixture plan without ID collisions. */
export function editContext(today = TODAY): PlanContext {
  return { today, now: NOW, makeId: editIds() };
}
