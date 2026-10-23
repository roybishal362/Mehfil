/** Human-readable descriptions of Copilot operations and their effects on the plan. */
import type { PlanChange } from '../../../shared/domain/diff';
import type { PlanOperation } from '../../../shared/schemas/operations';
import type { EventPlan } from '../../../shared/schemas/plan';
import { VENDOR_STATUSES } from '../../../shared/schemas/primitives';
import type { Formatters, Messages } from '../../i18n';

export interface Described {
  what: string;
  detail: string;
}

const arrow = (before: string, after: string) => `${before} → ${after}`;

function statusLabel(value: string, t: Messages): string {
  const status = VENDOR_STATUSES.find((entry) => entry === value);
  return status ? t.vendorStatuses[status] : value;
}

export function describeOperation(
  op: PlanOperation,
  plan: EventPlan,
  t: Messages,
  f: Formatters,
): Described {
  const money = (amount: number) => f.money(amount, plan.budget.currency);
  switch (op.type) {
    case 'guests.setCount':
      return {
        what: t.copilotOps.guests,
        detail: arrow(f.number(plan.brief.guestCount), f.number(op.guestCount)),
      };
    case 'budget.setTotal':
      return { what: t.copilotOps.total, detail: arrow(money(plan.budget.total), money(op.total)) };
    case 'budget.updateLine': {
      const line = plan.budget.lines.find((entry) => entry.id === op.id);
      const name = line ? (line.label ?? t.budgetCategories[line.category]) : t.copilotOps.total;
      const planned = op.patch.planned;
      return {
        what: name,
        detail: planned !== undefined && line ? arrow(money(line.planned), money(planned)) : '',
      };
    }
    case 'budget.addLine':
      return {
        what: t.copilotOps.newLine,
        detail: `${op.line.label} · ${money(op.line.planned)}`,
      };
    case 'task.add':
      return {
        what: t.copilotOps.newTask,
        detail: `${op.task.title} · ${f.dateShort(op.task.dueDate)}`,
      };
    case 'task.update': {
      const task = plan.tasks.find((entry) => entry.id === op.id);
      const parts: string[] = [];
      if (op.patch.status) parts.push(t.taskStatuses[op.patch.status]);
      if (op.patch.dueDate) parts.push(f.dateShort(op.patch.dueDate));
      if (op.patch.priority) parts.push(t.priorities[op.patch.priority]);
      return { what: task?.title ?? t.copilotOps.newTask, detail: parts.join(' · ') };
    }
    case 'task.remove':
      return {
        what: t.copilotOps.removeTask,
        detail: plan.tasks.find((entry) => entry.id === op.id)?.title ?? '',
      };
    case 'vendor.update': {
      const vendor = plan.vendors.find((entry) => entry.id === op.id);
      const parts: string[] = [];
      if (op.patch.status) parts.push(t.vendorStatuses[op.patch.status]);
      if (op.patch.bookBy) parts.push(f.dateShort(op.patch.bookBy));
      return {
        what: vendor
          ? (vendor.label ?? t.vendorCategories[vendor.category])
          : t.copilotOps.newVendor,
        detail: parts.join(' · '),
      };
    }
    case 'idea.add':
      return { what: t.copilotOps.newIdea, detail: op.idea.title };
    case 'schedule.add':
      return {
        what: t.copilotOps.newSlot,
        detail: `${f.dateShort(op.item.day)} ${f.time(op.item.time)} · ${op.item.title}`,
      };
    // The Copilot proposes only the operations above; these describe direct edits.
    case 'brief.update':
      return { what: t.copilotOps.details, detail: '' };
    case 'budget.removeLine': {
      const line = plan.budget.lines.find((entry) => entry.id === op.id);
      return {
        what: t.copilotOps.removeLine,
        detail: line ? (line.label ?? t.budgetCategories[line.category]) : '',
      };
    }
    case 'guest.add':
    case 'guest.update':
    case 'guest.remove':
    case 'guests.import':
      return { what: t.copilotOps.guestList, detail: '' };
    case 'vendor.add':
      return { what: t.copilotOps.newVendor, detail: op.vendor.label };
    case 'vendor.remove':
    case 'vendor.addOption':
    case 'vendor.updateOption':
    case 'vendor.removeOption':
      return { what: t.sections.vendors, detail: '' };
    case 'idea.update':
    case 'idea.remove':
      return { what: t.sections.ideas, detail: '' };
    case 'schedule.update':
    case 'schedule.remove':
      return { what: t.copilotOps.newSlot, detail: '' };
    case 'risk.remove':
      return { what: t.dayOfSection.planB, detail: '' };
  }
}

export interface DescribedChange extends Described {
  /** Signed change in money, for budget lines. */
  delta?: number;
}

export function describeChange(
  change: PlanChange,
  plan: EventPlan,
  t: Messages,
  f: Formatters,
): DescribedChange {
  const money = (amount: number) => f.money(amount, plan.budget.currency);
  switch (change.kind) {
    case 'budget_total':
      return {
        what: t.copilotOps.total,
        detail: arrow(money(change.before), money(change.after)),
        delta: change.after - change.before,
      };
    case 'guest_count':
      return {
        what: t.copilotOps.guests,
        detail: arrow(f.number(change.before), f.number(change.after)),
      };
    case 'event_date':
      return {
        what: t.copilotOps.eventDate,
        detail: arrow(f.date(change.before), f.date(change.after)),
      };
    case 'line_changed':
      return {
        what: change.label ?? t.budgetCategories[change.category],
        detail: arrow(money(change.before), money(change.after)),
        delta: change.after - change.before,
      };
    case 'line_added':
      return {
        what: t.copilotOps.newLine,
        detail: `${change.label} · ${money(change.planned)}`,
        delta: change.planned,
      };
    case 'line_removed':
      return {
        what: change.label ?? t.budgetCategories[change.category],
        detail: money(change.planned),
        delta: -change.planned,
      };
    case 'task_added':
      return {
        what: t.copilotOps.newTask,
        detail: `${change.title} · ${f.dateShort(change.dueDate)}`,
      };
    case 'task_removed':
      return { what: t.copilotOps.removeTask, detail: change.title };
    case 'task_changed':
      return {
        what: change.title,
        detail:
          change.field === 'dueDate'
            ? arrow(f.dateShort(change.before), f.dateShort(change.after))
            : arrow(change.before, change.after),
      };
    case 'vendor_changed':
      return {
        what: change.label ?? t.vendorCategories[change.category],
        detail:
          change.field === 'bookBy'
            ? arrow(f.dateShort(change.before), f.dateShort(change.after))
            : arrow(statusLabel(change.before, t), statusLabel(change.after, t)),
      };
    case 'vendor_added':
      return { what: t.copilotOps.newVendor, detail: change.label };
    case 'idea_added':
      return { what: t.copilotOps.newIdea, detail: change.title };
    case 'schedule_added':
      return {
        what: t.copilotOps.newSlot,
        detail: `${f.dateShort(change.day)} ${f.time(change.time)} · ${change.title}`,
      };
  }
}
