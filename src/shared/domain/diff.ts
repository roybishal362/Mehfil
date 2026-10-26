/**
 * Describes what changed between two versions of a plan. Used to preview Copilot proposals as
 * "before → after" so nothing is applied without the user seeing exactly what it does.
 */
import type { BudgetCategory, VendorCategory } from '../schemas/categories';
import type { EventPlan } from '../schemas/plan';

export type PlanChange =
  | { kind: 'budget_total'; before: number; after: number }
  | { kind: 'guest_count'; before: number; after: number }
  | { kind: 'event_date'; before: string; after: string }
  | {
      kind: 'line_changed';
      id: string;
      category: BudgetCategory;
      label?: string;
      before: number;
      after: number;
    }
  | { kind: 'line_added'; id: string; label: string; planned: number }
  | { kind: 'line_removed'; id: string; category: BudgetCategory; label?: string; planned: number }
  | { kind: 'task_added'; id: string; title: string; dueDate: string }
  | { kind: 'task_removed'; id: string; title: string }
  | {
      kind: 'task_changed';
      id: string;
      title: string;
      field: 'title' | 'dueDate' | 'priority' | 'status';
      before: string;
      after: string;
    }
  | {
      kind: 'vendor_changed';
      id: string;
      category: VendorCategory;
      label?: string;
      field: 'status' | 'bookBy';
      before: string;
      after: string;
    }
  | { kind: 'vendor_added'; id: string; label: string }
  | { kind: 'idea_added'; id: string; title: string }
  | { kind: 'schedule_added'; id: string; day: string; time: string; title: string };

function byId<T extends { id: string }>(list: readonly T[]): Map<string, T> {
  return new Map(list.map((item) => [item.id, item]));
}

/** The label a line or vendor carries, when it has one (custom items do). */
const labelOf = (item: { label?: string | undefined }) => (item.label ? { label: item.label } : {});

function diffBrief(before: EventPlan, after: EventPlan): PlanChange[] {
  const changes: PlanChange[] = [];
  if (before.brief.date !== after.brief.date) {
    changes.push({ kind: 'event_date', before: before.brief.date, after: after.brief.date });
  }
  if (before.brief.guestCount !== after.brief.guestCount) {
    const { guestCount } = before.brief;
    changes.push({ kind: 'guest_count', before: guestCount, after: after.brief.guestCount });
  }
  if (before.budget.total !== after.budget.total) {
    changes.push({ kind: 'budget_total', before: before.budget.total, after: after.budget.total });
  }
  return changes;
}

function diffBudgetLines(before: EventPlan, after: EventPlan): PlanChange[] {
  const oldLines = byId(before.budget.lines);
  const newLines = byId(after.budget.lines);
  const changes: PlanChange[] = [];
  for (const line of after.budget.lines) {
    const old = oldLines.get(line.id);
    if (!old) {
      const label = line.label ?? line.category;
      changes.push({ kind: 'line_added', id: line.id, label, planned: line.planned });
    } else if (old.planned !== line.planned) {
      const { id, category } = line;
      const amounts = { before: old.planned, after: line.planned };
      changes.push({ kind: 'line_changed', id, category, ...labelOf(line), ...amounts });
    }
  }
  for (const line of before.budget.lines) {
    if (newLines.has(line.id)) continue;
    const { id, category, planned } = line;
    changes.push({ kind: 'line_removed', id, category, ...labelOf(line), planned });
  }
  return changes;
}

const TASK_FIELDS = ['title', 'dueDate', 'priority', 'status'] as const;

function diffTasks(before: EventPlan, after: EventPlan): PlanChange[] {
  const oldTasks = byId(before.tasks);
  const newTasks = byId(after.tasks);
  const changes: PlanChange[] = [];
  for (const task of after.tasks) {
    const old = oldTasks.get(task.id);
    if (!old) {
      changes.push({ kind: 'task_added', id: task.id, title: task.title, dueDate: task.dueDate });
      continue;
    }
    for (const field of TASK_FIELDS.filter((name) => old[name] !== task[name])) {
      const { id, title } = task;
      changes.push({
        kind: 'task_changed',
        id,
        title,
        field,
        before: old[field],
        after: task[field],
      });
    }
  }
  for (const task of before.tasks) {
    if (!newTasks.has(task.id))
      changes.push({ kind: 'task_removed', id: task.id, title: task.title });
  }
  return changes;
}

const VENDOR_FIELDS = ['status', 'bookBy'] as const;

function diffVendors(before: EventPlan, after: EventPlan): PlanChange[] {
  const oldVendors = byId(before.vendors);
  const changes: PlanChange[] = [];
  for (const vendor of after.vendors) {
    const old = oldVendors.get(vendor.id);
    if (!old) {
      changes.push({ kind: 'vendor_added', id: vendor.id, label: vendor.label ?? vendor.category });
      continue;
    }
    for (const field of VENDOR_FIELDS.filter((name) => old[name] !== vendor[name])) {
      const { id, category } = vendor;
      const values = { field, before: old[field], after: vendor[field] };
      changes.push({ kind: 'vendor_changed', id, category, ...labelOf(vendor), ...values });
    }
  }
  return changes;
}

/** Ideas and schedule items the Copilot can only add, never change. */
function diffAdditions(before: EventPlan, after: EventPlan): PlanChange[] {
  const oldIdeas = new Set(before.ideas.map((idea) => idea.id));
  const oldSlots = new Set(before.schedule.map((item) => item.id));
  return [
    ...after.ideas
      .filter((idea) => !oldIdeas.has(idea.id))
      .map((idea): PlanChange => ({ kind: 'idea_added', id: idea.id, title: idea.title })),
    ...after.schedule
      .filter((item) => !oldSlots.has(item.id))
      .map(({ id, day, time, title }): PlanChange => ({
        kind: 'schedule_added',
        id,
        day,
        time,
        title,
      })),
  ];
}

export function diffPlans(before: EventPlan, after: EventPlan): PlanChange[] {
  return [
    ...diffBrief(before, after),
    ...diffBudgetLines(before, after),
    ...diffTasks(before, after),
    ...diffVendors(before, after),
    ...diffAdditions(before, after),
  ];
}
