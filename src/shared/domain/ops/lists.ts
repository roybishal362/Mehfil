/** The plain lists in a plan: ideas, guests, the day-of schedule and risks. */
import { LIMITS, type EventPlan } from '../../schemas/plan';
import { ensureRoom, removeById, replaceById, type ApplyContext, type Op } from './core';

export function addIdea(plan: EventPlan, op: Op<'idea.add'>, ctx: ApplyContext): EventPlan {
  ensureRoom(plan.ideas.length, 1, LIMITS.ideas, 'ideas');
  const idea = { id: ctx.makeId('idea'), ...op.idea, favorite: false, source: ctx.source };
  return { ...plan, ideas: [...plan.ideas, idea] };
}

export function updateIdea(plan: EventPlan, op: Op<'idea.update'>): EventPlan {
  return {
    ...plan,
    ideas: replaceById(plan.ideas, op.id, 'Idea', (idea) => ({ ...idea, ...op.patch })),
  };
}

export function removeIdea(plan: EventPlan, op: Op<'idea.remove'>): EventPlan {
  return { ...plan, ideas: removeById(plan.ideas, op.id, 'Idea') };
}

export function addGuest(plan: EventPlan, op: Op<'guest.add'>, ctx: ApplyContext): EventPlan {
  ensureRoom(plan.guests.length, 1, LIMITS.guests, 'guests');
  return { ...plan, guests: [...plan.guests, { id: ctx.makeId('guest'), ...op.guest }] };
}

export function updateGuest(plan: EventPlan, op: Op<'guest.update'>): EventPlan {
  return {
    ...plan,
    guests: replaceById(plan.guests, op.id, 'Guest', (guest) => ({ ...guest, ...op.patch })),
  };
}

export function removeGuest(plan: EventPlan, op: Op<'guest.remove'>): EventPlan {
  return { ...plan, guests: removeById(plan.guests, op.id, 'Guest') };
}

/** Adds every imported guest or none, so a too-long list never half-imports. */
export function importGuests(
  plan: EventPlan,
  op: Op<'guests.import'>,
  ctx: ApplyContext,
): EventPlan {
  ensureRoom(plan.guests.length, op.guests.length, LIMITS.guests, 'guests');
  const added = op.guests.map((guest) => ({ id: ctx.makeId('guest'), ...guest }));
  return { ...plan, guests: [...plan.guests, ...added] };
}

export function addScheduleItem(
  plan: EventPlan,
  op: Op<'schedule.add'>,
  ctx: ApplyContext,
): EventPlan {
  ensureRoom(plan.schedule.length, 1, LIMITS.schedule, 'schedule items');
  const item = { id: ctx.makeId('slot'), ...op.item, source: ctx.source };
  return { ...plan, schedule: [...plan.schedule, item] };
}

export function updateScheduleItem(plan: EventPlan, op: Op<'schedule.update'>): EventPlan {
  return {
    ...plan,
    schedule: replaceById(plan.schedule, op.id, 'Schedule item', (item) => ({
      ...item,
      ...op.patch,
    })),
  };
}

export function removeScheduleItem(plan: EventPlan, op: Op<'schedule.remove'>): EventPlan {
  return { ...plan, schedule: removeById(plan.schedule, op.id, 'Schedule item') };
}

export function removeRisk(plan: EventPlan, op: Op<'risk.remove'>): EventPlan {
  return { ...plan, risks: removeById(plan.risks, op.id, 'Risk') };
}
