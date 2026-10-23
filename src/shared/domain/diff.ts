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

export function diffPlans(before: EventPlan, after: EventPlan): PlanChange[] {
  const changes: PlanChange[] = [];

  if (before.brief.date !== after.brief.date) {
    changes.push({ kind: 'event_date', before: before.brief.date, after: after.brief.date });
  }
  if (before.brief.guestCount !== after.brief.guestCount) {
    changes.push({
      kind: 'guest_count',
      before: before.brief.guestCount,
      after: after.brief.guestCount,
    });
  }
  if (before.budget.total !== after.budget.total) {
    changes.push({ kind: 'budget_total', before: before.budget.total, after: after.budget.total });
  }

  const oldLines = byId(before.budget.lines);
  const newLines = byId(after.budget.lines);
  for (const line of after.budget.lines) {
    const old = oldLines.get(line.id);
    if (!old) {
      changes.push({
        kind: 'line_added',
        id: line.id,
        label: line.label ?? line.category,
        planned: line.planned,
      });
    } else if (old.planned !== line.planned) {
      changes.push({
        kind: 'line_changed',
        id: line.id,
        category: line.category,
        ...(line.label ? { label: line.label } : {}),
        before: old.planned,
        after: line.planned,
      });
    }
  }
  for (const line of before.budget.lines) {
    if (!newLines.has(line.id)) {
      changes.push({
        kind: 'line_removed',
        id: line.id,
        category: line.category,
        ...(line.label ? { label: line.label } : {}),
        planned: line.planned,
      });
    }
  }

  const oldTasks = byId(before.tasks);
  const newTasks = byId(after.tasks);
  for (const task of after.tasks) {
    const old = oldTasks.get(task.id);
    if (!old) {
      changes.push({ kind: 'task_added', id: task.id, title: task.title, dueDate: task.dueDate });
      continue;
    }
    for (const field of ['title', 'dueDate', 'priority', 'status'] as const) {
      if (old[field] !== task[field]) {
        changes.push({
          kind: 'task_changed',
          id: task.id,
          title: task.title,
          field,
          before: old[field],
          after: task[field],
        });
      }
    }
  }
  for (const task of before.tasks) {
    if (!newTasks.has(task.id))
      changes.push({ kind: 'task_removed', id: task.id, title: task.title });
  }

  const oldVendors = byId(before.vendors);
  for (const vendor of after.vendors) {
    const old = oldVendors.get(vendor.id);
    if (!old) {
      changes.push({ kind: 'vendor_added', id: vendor.id, label: vendor.label ?? vendor.category });
      continue;
    }
    for (const field of ['status', 'bookBy'] as const) {
      if (old[field] !== vendor[field]) {
        changes.push({
          kind: 'vendor_changed',
          id: vendor.id,
          category: vendor.category,
          ...(vendor.label ? { label: vendor.label } : {}),
          field,
          before: old[field],
          after: vendor[field],
        });
      }
    }
  }

  const oldIdeas = new Set(before.ideas.map((i) => i.id));
  for (const idea of after.ideas) {
    if (!oldIdeas.has(idea.id))
      changes.push({ kind: 'idea_added', id: idea.id, title: idea.title });
  }

  const oldSlots = new Set(before.schedule.map((s) => s.id));
  for (const item of after.schedule) {
    if (!oldSlots.has(item.id)) {
      changes.push({
        kind: 'schedule_added',
        id: item.id,
        day: item.day,
        time: item.time,
        title: item.title,
      });
    }
  }

  return changes;
}
