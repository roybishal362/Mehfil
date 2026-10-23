/**
 * Builds a complete plan from a brief using only the built-in templates.
 * It renders instantly, works offline and is the fallback whenever Gemini is unavailable;
 * Gemini then personalises it section by section (see `merge.ts`).
 */
import type { EventBrief } from '../schemas/brief';
import { PLAN_SCHEMA_VERSION, type EventPlan, type ScheduleItem, type Task } from '../schemas/plan';
import { getTemplate } from '../templates';
import { pickText, type EventTemplate } from '../templates/types';
import { zipWith } from '../utils/collections';
import { addDays, clampDate, clockToMinutes, minutesToClock } from '../utils/dates';
import type { IdFactory } from '../utils/ids';
import { adjustedShares, createBudgetLines } from './budget';
import { scheduleLeadTimes } from './timeline';
import { createVendors } from './vendors';

export interface PlanContext {
  /** The user's local date (YYYY-MM-DD). */
  today: string;
  /** Current timestamp (ISO 8601). */
  now: string;
  makeId: IdFactory;
}

/** Template tasks scheduled backward from the event date, in the plan's language. */
export function createTasks(template: EventTemplate, brief: EventBrief, ctx: PlanContext): Task[] {
  const dates = scheduleLeadTimes(
    template.tasks.map((t) => t.daysBefore),
    brief.date,
    ctx.today,
  );
  return zipWith(template.tasks, dates, (t, scheduled) => ({
    id: ctx.makeId('task'),
    title: pickText(t.title, brief.language),
    dueDate: scheduled.dueDate,
    daysBefore: t.daysBefore,
    priority: t.priority,
    status: 'todo',
    category: t.category,
    compressed: scheduled.compressed,
    source: 'template',
  }));
}

/**
 * The day-of run sheet. When the brief has a start time, the whole sheet shifts so that the
 * template's "guests arrive" item lines up with it.
 */
export function createSchedule(
  template: EventTemplate,
  brief: EventBrief,
  makeId: IdFactory,
): ScheduleItem[] {
  const anchor = template.schedule.find((item) => item.anchor);
  const shift =
    brief.startTime && anchor ? clockToMinutes(brief.startTime) - clockToMinutes(anchor.time) : 0;
  const lastDay = brief.endDate ?? brief.date;
  return template.schedule
    .map((item) => ({
      id: makeId('slot'),
      day: clampDate(addDays(brief.date, item.dayOffset), brief.date, lastDay),
      time: minutesToClock(clockToMinutes(item.time) + shift),
      durationMinutes: item.durationMinutes,
      title: pickText(item.title, brief.language),
      source: 'template' as const,
    }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time));
}

export function createBaselinePlan(brief: EventBrief, ctx: PlanContext): EventPlan {
  const template = getTemplate(brief.type);
  const shares = adjustedShares(template, brief);
  return {
    id: ctx.makeId('evt'),
    schemaVersion: PLAN_SCHEMA_VERSION,
    brief,
    budget: {
      currency: brief.currency,
      total: brief.budget,
      lines: createBudgetLines(brief.budget, template.budget, shares, ctx.makeId, 'template'),
      savingTips: [],
    },
    tasks: createTasks(template, brief, ctx),
    vendors: createVendors(template, brief.date, ctx.today, ctx.makeId),
    ideas: [],
    guests: [],
    schedule: createSchedule(template, brief, ctx.makeId),
    risks: [],
    ai: {
      sections: {
        budget: { status: 'template' },
        timeline: { status: 'template' },
        vendors: { status: 'template' },
        ideas: { status: 'template' },
      },
    },
    createdAt: ctx.now,
    updatedAt: ctx.now,
    revision: 0,
  };
}
