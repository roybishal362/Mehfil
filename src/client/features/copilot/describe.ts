/** Human-readable descriptions of Copilot operations and their effects on the plan. */
import type { PlanChange } from '../../../shared/domain/diff';
import { COPILOT_OPERATION_TYPES, type PlanOperation } from '../../../shared/schemas/operations';
import type { BudgetLine, EventPlan, Vendor } from '../../../shared/schemas/plan';
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

/** What a description needs: the plan before the change, the messages and the formatters. */
interface Context {
  plan: EventPlan;
  t: Messages;
  f: Formatters;
  money: (amount: number) => string;
}

type Op<T extends PlanOperation['type']> = Extract<PlanOperation, { type: T }>;
type Proposable = Op<(typeof COPILOT_OPERATION_TYPES)[number]>;
/** Operations the Copilot never proposes; they only describe the user's own edits. */
type DirectEdit = Exclude<PlanOperation, Proposable>;

const PROPOSABLE: ReadonlySet<string> = new Set(COPILOT_OPERATION_TYPES);
const isProposable = (op: PlanOperation): op is Proposable => PROPOSABLE.has(op.type);

const lineName = (line: BudgetLine, t: Messages) => line.label ?? t.budgetCategories[line.category];
const vendorName = (vendor: Vendor, t: Messages) =>
  vendor.label ?? t.vendorCategories[vendor.category];

/** The parts that are present, joined with a middle dot. */
const joined = (...parts: (string | undefined)[]) =>
  parts.filter((part) => part !== undefined).join(' · ');

function describeLineUpdate(op: Op<'budget.updateLine'>, { plan, t, money }: Context): Described {
  const line = plan.budget.lines.find((entry) => entry.id === op.id);
  if (!line) return { what: t.copilotOps.total, detail: '' };
  const { planned } = op.patch;
  const detail = planned === undefined ? '' : arrow(money(line.planned), money(planned));
  return { what: lineName(line, t), detail };
}

function describeTaskUpdate(op: Op<'task.update'>, { plan, t, f }: Context): Described {
  const task = plan.tasks.find((entry) => entry.id === op.id);
  const { status, dueDate, priority } = op.patch;
  return {
    what: task?.title ?? t.copilotOps.newTask,
    detail: joined(
      status && t.taskStatuses[status],
      dueDate && f.dateShort(dueDate),
      priority && t.priorities[priority],
    ),
  };
}

function describeVendorUpdate(op: Op<'vendor.update'>, { plan, t, f }: Context): Described {
  const vendor = plan.vendors.find((entry) => entry.id === op.id);
  const { status, bookBy } = op.patch;
  return {
    what: vendor ? vendorName(vendor, t) : t.copilotOps.newVendor,
    detail: joined(status && t.vendorStatuses[status], bookBy && f.dateShort(bookBy)),
  };
}

/** A short name for the user's own edits, which never need a detailed preview. */
function describeDirectEdit(op: DirectEdit, { plan, t }: Context): Described {
  switch (op.type) {
    case 'brief.update':
      return { what: t.copilotOps.details, detail: '' };
    case 'budget.removeLine': {
      const line = plan.budget.lines.find((entry) => entry.id === op.id);
      return { what: t.copilotOps.removeLine, detail: line ? lineName(line, t) : '' };
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

export function describeOperation(
  op: PlanOperation,
  plan: EventPlan,
  t: Messages,
  f: Formatters,
): Described {
  const ctx: Context = { plan, t, f, money: (amount) => f.money(amount, plan.budget.currency) };
  if (!isProposable(op)) return describeDirectEdit(op, ctx);
  switch (op.type) {
    case 'guests.setCount':
      return {
        what: t.copilotOps.guests,
        detail: arrow(f.number(plan.brief.guestCount), f.number(op.guestCount)),
      };
    case 'budget.setTotal':
      return {
        what: t.copilotOps.total,
        detail: arrow(ctx.money(plan.budget.total), ctx.money(op.total)),
      };
    case 'budget.updateLine':
      return describeLineUpdate(op, ctx);
    case 'budget.addLine':
      return {
        what: t.copilotOps.newLine,
        detail: joined(op.line.label, ctx.money(op.line.planned)),
      };
    case 'task.add':
      return {
        what: t.copilotOps.newTask,
        detail: joined(op.task.title, f.dateShort(op.task.dueDate)),
      };
    case 'task.update':
      return describeTaskUpdate(op, ctx);
    case 'task.remove':
      return {
        what: t.copilotOps.removeTask,
        detail: plan.tasks.find((entry) => entry.id === op.id)?.title ?? '',
      };
    case 'vendor.update':
      return describeVendorUpdate(op, ctx);
    case 'idea.add':
      return { what: t.copilotOps.newIdea, detail: op.idea.title };
    case 'schedule.add':
      return {
        what: t.copilotOps.newSlot,
        detail: joined(`${f.dateShort(op.item.day)} ${f.time(op.item.time)}`, op.item.title),
      };
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
