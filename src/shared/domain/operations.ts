/**
 * Applies plan operations. Pure: returns a new plan and never mutates its input, so the UI can
 * keep the previous plan for undo and the Copilot can preview changes before they are applied.
 */
import { EventBrief } from '../schemas/brief';
import type { PlanOperation } from '../schemas/operations';
import { LIMITS, type EventPlan, type Task } from '../schemas/plan';
import type { Source } from '../schemas/primitives';
import { addDays, clampDate, diffDays, maxDate } from '../utils/dates';
import type { IdFactory } from '../utils/ids';
import { rebalanceLines, scaleForGuests } from './budget';
import { rescheduleTasks } from './timeline';
import { isSecured } from './vendors';

export class OperationError extends Error {
  readonly code: 'not_found' | 'limit' | 'invalid';

  constructor(code: 'not_found' | 'limit' | 'invalid', message: string) {
    super(message);
    this.name = 'OperationError';
    this.code = code;
  }
}

export interface OperationContext {
  /** The user's local date, for re-scheduling. */
  today: string;
  makeId: IdFactory;
  /** Who made the change. Copilot proposals are recorded as `ai`. */
  source?: Source;
}

interface WithId {
  id: string;
}

function findOrThrow<T extends WithId>(list: readonly T[], id: string, what: string): T {
  const item = list.find((entry) => entry.id === id);
  if (!item) throw new OperationError('not_found', `${what} ${id} was not found`);
  return item;
}

function replaceById<T extends WithId>(
  list: readonly T[],
  id: string,
  what: string,
  update: (item: T) => T,
): T[] {
  findOrThrow(list, id, what);
  return list.map((item) => (item.id === id ? update(item) : item));
}

function removeById<T extends WithId>(list: readonly T[], id: string, what: string): T[] {
  findOrThrow(list, id, what);
  return list.filter((item) => item.id !== id);
}

function ensureRoom(current: number, adding: number, limit: number, what: string): void {
  if (current + adding > limit) {
    throw new OperationError('limit', `A plan can hold at most ${String(limit)} ${what}`);
  }
}

const clampLead = (days: number) => Math.min(730, Math.max(-90, days));

/** Applies one operation and returns the new plan. Throws `OperationError` on bad references. */
export function applyOperation(
  plan: EventPlan,
  op: PlanOperation,
  ctx: OperationContext,
): EventPlan {
  const source: Source = ctx.source ?? 'user';
  const eventDate = plan.brief.date;

  switch (op.type) {
    case 'brief.update': {
      const parsed = EventBrief.safeParse({ ...plan.brief, ...op.patch });
      if (!parsed.success) {
        throw new OperationError('invalid', parsed.error.issues[0]?.message ?? 'Invalid details');
      }
      const brief = parsed.data;
      let { tasks, vendors, schedule } = plan;
      if (brief.date !== plan.brief.date) {
        const shift = diffDays(brief.date, plan.brief.date);
        tasks = rescheduleTasks(tasks, brief.date, ctx.today);
        vendors = vendors.map((v) =>
          isSecured(v) ? v : { ...v, bookBy: maxDate(addDays(v.bookBy, shift), ctx.today) },
        );
        schedule = schedule.map((item) => ({ ...item, day: addDays(item.day, shift) }));
      }
      const lastDay = brief.endDate ?? brief.date;
      schedule = schedule.map((item) => ({
        ...item,
        day: clampDate(item.day, addDays(brief.date, -1), lastDay),
      }));
      return { ...plan, brief, tasks, vendors, schedule };
    }

    case 'task.add': {
      ensureRoom(plan.tasks.length, 1, LIMITS.tasks, 'tasks');
      const task: Task = {
        id: ctx.makeId('task'),
        title: op.task.title,
        ...(op.task.notes ? { notes: op.task.notes } : {}),
        dueDate: op.task.dueDate,
        daysBefore: clampLead(diffDays(eventDate, op.task.dueDate)),
        priority: op.task.priority,
        status: 'todo',
        category: op.task.category,
        compressed: false,
        source,
      };
      return { ...plan, tasks: [...plan.tasks, task] };
    }

    case 'task.update':
      return {
        ...plan,
        tasks: replaceById(plan.tasks, op.id, 'Task', (task) => ({
          ...task,
          ...op.patch,
          ...(op.patch.dueDate
            ? { daysBefore: clampLead(diffDays(eventDate, op.patch.dueDate)), compressed: false }
            : {}),
        })),
      };

    case 'task.remove':
      return { ...plan, tasks: removeById(plan.tasks, op.id, 'Task') };

    case 'budget.setTotal':
      return {
        ...plan,
        budget: {
          ...plan.budget,
          total: op.total,
          lines: rebalanceLines(plan.budget.lines, op.total, op.protectIds),
        },
      };

    case 'budget.updateLine':
      return {
        ...plan,
        budget: {
          ...plan.budget,
          lines: replaceById(plan.budget.lines, op.id, 'Budget line', (line) => ({
            ...line,
            ...op.patch,
            ...(op.patch.planned !== undefined && op.patch.planned !== line.planned
              ? { source }
              : {}),
          })),
        },
      };

    case 'budget.addLine':
      ensureRoom(plan.budget.lines.length, 1, LIMITS.budgetLines, 'budget lines');
      return {
        ...plan,
        budget: {
          ...plan.budget,
          lines: [
            ...plan.budget.lines,
            {
              id: ctx.makeId('line'),
              category: 'custom',
              label: op.line.label,
              planned: op.line.planned,
              spent: 0,
              paid: 0,
              perGuest: false,
              source,
            },
          ],
        },
      };

    case 'budget.removeLine':
      return {
        ...plan,
        budget: { ...plan.budget, lines: removeById(plan.budget.lines, op.id, 'Budget line') },
      };

    case 'guests.setCount':
      return {
        ...plan,
        brief: { ...plan.brief, guestCount: op.guestCount },
        budget: scaleForGuests(plan.budget, plan.brief.guestCount, op.guestCount, op.keepBudget),
      };

    case 'vendor.update':
      return {
        ...plan,
        vendors: replaceById(plan.vendors, op.id, 'Vendor', (vendor) => {
          const { selectedOptionId, ...rest } = op.patch;
          const next = { ...vendor, ...rest };
          if (selectedOptionId === null) {
            const { selectedOptionId: _removed, ...withoutSelection } = next;
            return withoutSelection;
          }
          if (selectedOptionId !== undefined) {
            findOrThrow(vendor.options, selectedOptionId, 'Vendor option');
            return { ...next, selectedOptionId };
          }
          return next;
        }),
      };

    case 'vendor.add':
      ensureRoom(plan.vendors.length, 1, LIMITS.vendors, 'vendors');
      return {
        ...plan,
        vendors: [
          ...plan.vendors,
          {
            id: ctx.makeId('vendor'),
            category: 'custom',
            label: op.vendor.label,
            priority: op.vendor.priority,
            bookBy: op.vendor.bookBy,
            status: 'not_started',
            questions: [],
            redFlags: [],
            options: [],
            source,
          },
        ],
      };

    case 'vendor.remove':
      return { ...plan, vendors: removeById(plan.vendors, op.id, 'Vendor') };

    case 'vendor.addOption':
      return {
        ...plan,
        vendors: replaceById(plan.vendors, op.vendorId, 'Vendor', (vendor) => {
          ensureRoom(vendor.options.length, 1, LIMITS.vendorOptions, 'options per vendor');
          return {
            ...vendor,
            options: [...vendor.options, { id: ctx.makeId('opt'), ...op.option }],
          };
        }),
      };

    case 'vendor.updateOption':
      return {
        ...plan,
        vendors: replaceById(plan.vendors, op.vendorId, 'Vendor', (vendor) => ({
          ...vendor,
          options: replaceById(vendor.options, op.optionId, 'Vendor option', (option) => ({
            ...option,
            ...op.patch,
          })),
        })),
      };

    case 'vendor.removeOption':
      return {
        ...plan,
        vendors: replaceById(plan.vendors, op.vendorId, 'Vendor', (vendor) => {
          const options = removeById(vendor.options, op.optionId, 'Vendor option');
          if (vendor.selectedOptionId !== op.optionId) return { ...vendor, options };
          const { selectedOptionId: _removed, ...rest } = vendor;
          return { ...rest, options };
        }),
      };

    case 'idea.add':
      ensureRoom(plan.ideas.length, 1, LIMITS.ideas, 'ideas');
      return {
        ...plan,
        ideas: [...plan.ideas, { id: ctx.makeId('idea'), ...op.idea, favorite: false, source }],
      };

    case 'idea.update':
      return {
        ...plan,
        ideas: replaceById(plan.ideas, op.id, 'Idea', (idea) => ({ ...idea, ...op.patch })),
      };

    case 'idea.remove':
      return { ...plan, ideas: removeById(plan.ideas, op.id, 'Idea') };

    case 'guest.add':
      ensureRoom(plan.guests.length, 1, LIMITS.guests, 'guests');
      return { ...plan, guests: [...plan.guests, { id: ctx.makeId('guest'), ...op.guest }] };

    case 'guest.update':
      return {
        ...plan,
        guests: replaceById(plan.guests, op.id, 'Guest', (guest) => ({ ...guest, ...op.patch })),
      };

    case 'guest.remove':
      return { ...plan, guests: removeById(plan.guests, op.id, 'Guest') };

    case 'guests.import':
      ensureRoom(plan.guests.length, op.guests.length, LIMITS.guests, 'guests');
      return {
        ...plan,
        guests: [
          ...plan.guests,
          ...op.guests.map((guest) => ({ id: ctx.makeId('guest'), ...guest })),
        ],
      };

    case 'schedule.add':
      ensureRoom(plan.schedule.length, 1, LIMITS.schedule, 'schedule items');
      return {
        ...plan,
        schedule: [...plan.schedule, { id: ctx.makeId('slot'), ...op.item, source }],
      };

    case 'schedule.update':
      return {
        ...plan,
        schedule: replaceById(plan.schedule, op.id, 'Schedule item', (item) => ({
          ...item,
          ...op.patch,
        })),
      };

    case 'schedule.remove':
      return { ...plan, schedule: removeById(plan.schedule, op.id, 'Schedule item') };

    case 'risk.remove':
      return { ...plan, risks: removeById(plan.risks, op.id, 'Risk') };
  }
}

/** Applies operations in order. If any fails, nothing is applied (the error propagates). */
export function applyOperations(
  plan: EventPlan,
  ops: readonly PlanOperation[],
  ctx: OperationContext,
): EventPlan {
  return ops.reduce((current, op) => applyOperation(current, op, ctx), plan);
}
