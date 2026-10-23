/**
 * Timeline engine: schedules tasks backward from the event date, compresses them when time is
 * short, and derives status, phase and countdown. "Today" is always supplied by the caller.
 */
import type { EventBrief } from '../schemas/brief';
import type { Task } from '../schemas/plan';
import type { Priority } from '../schemas/primitives';
import { zipWith } from '../utils/collections';
import { addDays, diffDays } from '../utils/dates';

/**
 * Maps ideal lead times (days before the event) onto the time actually left.
 * Lead times up to half the remaining window keep their ideal value; longer ones are squeezed
 * linearly into the rest of the window. The mapping is monotonic, so task order never changes,
 * and nothing is ever scheduled before today. Negative lead times (follow-ups) are untouched.
 */
export function compressLeadTimes(leads: readonly number[], daysLeft: number): number[] {
  const longest = Math.max(0, ...leads);
  if (daysLeft < 0 || longest <= daysLeft) return [...leads];
  const knee = daysLeft / 2;
  return leads.map((lead) => {
    if (lead <= knee) return lead;
    const squeezed = knee + ((lead - knee) * (daysLeft - knee)) / (longest - knee);
    return Math.min(daysLeft, Math.round(squeezed));
  });
}

export interface ScheduledDate {
  dueDate: string;
  compressed: boolean;
}

/** Due dates for a set of lead times, compressed together so their order is preserved. */
export function scheduleLeadTimes(
  leads: readonly number[],
  eventDate: string,
  today: string,
): ScheduledDate[] {
  const mapped = compressLeadTimes(leads, diffDays(eventDate, today));
  return zipWith(leads, mapped, (lead, effective) => ({
    dueDate: addDays(eventDate, -effective),
    compressed: effective !== lead,
  }));
}

/** Re-dates open tasks after the event date changes; finished tasks keep their dates. */
export function rescheduleTasks(tasks: readonly Task[], eventDate: string, today: string): Task[] {
  const open = tasks.filter((t) => t.status !== 'done');
  const dates = scheduleLeadTimes(
    open.map((t) => t.daysBefore),
    eventDate,
    today,
  );
  const byId = new Map(zipWith(open, dates, (task, date) => [task.id, date] as const));
  return tasks.map((task) => {
    const next = byId.get(task.id);
    return next ? { ...task, dueDate: next.dueDate, compressed: next.compressed } : task;
  });
}

export type TaskState = 'done' | 'overdue' | 'due_soon' | 'upcoming';

/** Where a task stands today. "Due soon" means within the next `soonDays` days. */
export function taskState(
  task: Pick<Task, 'status' | 'dueDate'>,
  today: string,
  soonDays = 7,
): TaskState {
  if (task.status === 'done') return 'done';
  const daysLeft = diffDays(task.dueDate, today);
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= soonDays) return 'due_soon';
  return 'upcoming';
}

export const PHASES = [
  'twelve_months',
  'six_months',
  'three_months',
  'one_month',
  'two_weeks',
  'final_days',
  'event_day',
  'after',
] as const;
export type Phase = (typeof PHASES)[number];

/** Planning phase of a due date relative to the event. */
export function phaseFor(dueDate: string, eventDate: string): Phase {
  const lead = diffDays(eventDate, dueDate);
  if (lead < 0) return 'after';
  if (lead === 0) return 'event_day';
  if (lead < 14) return 'final_days';
  if (lead < 30) return 'two_weeks';
  if (lead < 90) return 'one_month';
  if (lead < 180) return 'three_months';
  if (lead < 365) return 'six_months';
  return 'twelve_months';
}

/** Tasks grouped by phase in chronological order; empty phases are omitted. */
export function groupByPhase(
  tasks: readonly Task[],
  eventDate: string,
): { phase: Phase; tasks: Task[] }[] {
  const sorted = [...tasks].sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority],
  );
  const groups = new Map<Phase, Task[]>();
  for (const task of sorted) {
    const phase = phaseFor(task.dueDate, eventDate);
    const list = groups.get(phase) ?? [];
    list.push(task);
    groups.set(phase, list);
  }
  return PHASES.filter((p) => groups.has(p)).map((phase) => ({
    phase,
    tasks: groups.get(phase) ?? [],
  }));
}

export const PRIORITY_WEIGHT: Readonly<Record<Priority, number>> = { high: 3, medium: 2, low: 1 };

export interface TaskStats {
  total: number;
  done: number;
  overdue: number;
  dueSoon: number;
  /** Completion weighted by priority, 0–1. */
  progress: number;
}

export function taskStats(tasks: readonly Task[], today: string): TaskStats {
  let weightAll = 0;
  let weightDone = 0;
  let done = 0;
  let overdue = 0;
  let dueSoon = 0;
  for (const task of tasks) {
    const weight = PRIORITY_WEIGHT[task.priority];
    weightAll += weight;
    const state = taskState(task, today);
    if (state === 'done') {
      done += 1;
      weightDone += weight;
    } else if (state === 'overdue') overdue += 1;
    else if (state === 'due_soon') dueSoon += 1;
  }
  return {
    total: tasks.length,
    done,
    overdue,
    dueSoon,
    progress: weightAll ? weightDone / weightAll : 0,
  };
}

/** Open tasks ordered for a "next up" list: earliest due (so overdue) first, then priority. */
export function nextTasks(tasks: readonly Task[], limit = 5): Task[] {
  return tasks
    .filter((t) => t.status !== 'done')
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

export type Countdown =
  | { kind: 'upcoming'; days: number }
  | { kind: 'today' }
  | { kind: 'ongoing'; day: number; of: number }
  | { kind: 'past'; days: number };

/** Countdown to the event, aware of multi-day celebrations. */
export function countdown(brief: Pick<EventBrief, 'date' | 'endDate'>, today: string): Countdown {
  const untilStart = diffDays(brief.date, today);
  if (untilStart > 0) return { kind: 'upcoming', days: untilStart };
  const end = brief.endDate ?? brief.date;
  const totalDays = diffDays(end, brief.date) + 1;
  if (totalDays > 1 && diffDays(end, today) >= 0) {
    return { kind: 'ongoing', day: 1 - untilStart, of: totalDays };
  }
  if (untilStart === 0) return { kind: 'today' };
  return { kind: 'past', days: diffDays(today, end) };
}
