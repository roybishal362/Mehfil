/**
 * Editing the brief. When the date moves, open tasks, unbooked vendors and the day-of schedule
 * move with it, so the plan never points at the old date.
 */
import { EventBrief } from '../../schemas/brief';
import type { EventPlan } from '../../schemas/plan';
import { addDays, clampDate, diffDays, maxDate } from '../../utils/dates';
import { rescheduleTasks } from '../timeline';
import { isSecured } from '../vendors';
import { OperationError, type ApplyContext, type Op } from './core';

export function updateBrief(plan: EventPlan, op: Op<'brief.update'>, ctx: ApplyContext): EventPlan {
  const parsed = EventBrief.safeParse({ ...plan.brief, ...op.patch });
  if (!parsed.success) {
    throw new OperationError('invalid', parsed.error.issues[0]?.message ?? 'Invalid details');
  }
  const brief = parsed.data;
  const moved = brief.date === plan.brief.date ? plan : moveToDate(plan, brief.date, ctx.today);
  return { ...moved, brief, schedule: keepScheduleInRange(moved.schedule, brief) };
}

/** Shifts everything dated by the move. Booked vendors keep their dates. */
function moveToDate(plan: EventPlan, date: string, today: string): EventPlan {
  const shift = diffDays(date, plan.brief.date);
  return {
    ...plan,
    tasks: rescheduleTasks(plan.tasks, date, today),
    vendors: plan.vendors.map((vendor) =>
      isSecured(vendor)
        ? vendor
        : { ...vendor, bookBy: maxDate(addDays(vendor.bookBy, shift), today) },
    ),
    schedule: plan.schedule.map((item) => ({ ...item, day: addDays(item.day, shift) })),
  };
}

/** Day-of items stay between the eve of the event and its last day. */
function keepScheduleInRange(
  schedule: EventPlan['schedule'],
  brief: EventBrief,
): EventPlan['schedule'] {
  const lastDay = brief.endDate ?? brief.date;
  return schedule.map((item) => ({
    ...item,
    day: clampDate(item.day, addDays(brief.date, -1), lastDay),
  }));
}
