/**
 * The functions the Copilot may call, and the strict conversion of each call into a typed
 * `PlanOperation`. Calls on unknown IDs, dates outside the planning window or invalid values
 * are dropped, never repaired by guesswork.
 */
import * as z from '../../../shared/zod';
import type { CopilotRequest } from '../../../shared/schemas/ai';
import { COPILOT_OPERATION_TYPES, PlanOperation } from '../../../shared/schemas/operations';
import { IdeaKind, Priority, TaskStatus, VendorStatus } from '../../../shared/schemas/primitives';
import { addDays } from '../../../shared/utils/dates';
import { cleanModelText } from '../../../shared/utils/text';
import type { ToolCall, ToolDeclaration } from '../provider';

const DateString = z.string().describe('Date as YYYY-MM-DD');

/** Functions the Copilot may call. Each becomes a proposed `PlanOperation`. */
export const COPILOT_TOOLS: readonly ToolDeclaration[] = [
  {
    name: 'add_task',
    description: 'Add a preparation task to the timeline.',
    parameters: z.object({
      title: z.string().describe('Imperative task title, max 10 words'),
      dueDate: DateString,
      priority: Priority,
      notes: z.string().optional(),
    }),
  },
  {
    name: 'update_task',
    description: 'Change an existing task (reschedule, re-prioritise, rename or mark done).',
    parameters: z.object({
      taskId: z.string(),
      title: z.string().optional(),
      dueDate: DateString.optional(),
      priority: Priority.optional(),
      status: TaskStatus.optional(),
    }),
  },
  {
    name: 'remove_task',
    description: 'Remove a task that no longer applies.',
    parameters: z.object({ taskId: z.string() }),
  },
  {
    name: 'set_budget_line',
    description: 'Set the planned amount of one budget line.',
    parameters: z.object({ lineId: z.string(), planned: z.number().int().min(0) }),
  },
  {
    name: 'add_budget_line',
    description: 'Add a new budget line.',
    parameters: z.object({ label: z.string(), planned: z.number().int().min(0) }),
  },
  {
    name: 'set_budget_total',
    description:
      'Change the total budget; the app rescales the lines in proportion, keeping protected lines unchanged.',
    parameters: z.object({
      total: z.number().int().min(1000),
      protectLineIds: z.array(z.string()).optional(),
    }),
  },
  {
    name: 'set_guest_count',
    description:
      'Change the expected number of guests; per-guest costs scale. keepBudget true holds the total fixed.',
    parameters: z.object({
      guestCount: z.number().int().min(1).max(5000),
      keepBudget: z.boolean(),
    }),
  },
  {
    name: 'update_vendor',
    description: 'Update a vendor checklist entry (status or book-by date).',
    parameters: z.object({
      vendorId: z.string(),
      status: VendorStatus.optional(),
      bookBy: DateString.optional(),
    }),
  },
  {
    name: 'add_idea',
    description: 'Add an idea to the ideas board.',
    parameters: z.object({
      kind: IdeaKind,
      title: z.string(),
      description: z.string(),
    }),
  },
  {
    name: 'add_schedule_item',
    description: 'Add an item to the day-of run sheet.',
    parameters: z.object({
      dayOffset: z.number().int().min(-1).max(14).describe('0 is the event day'),
      time: z.string().describe('24-hour HH:MM'),
      durationMinutes: z.number().int().min(5).max(600),
      title: z.string(),
    }),
  },
];

const ARGS = Object.fromEntries(COPILOT_TOOLS.map((tool) => [tool.name, tool.parameters]));

/** Converts a model function call into a validated operation, or null if it is not acceptable. */
export function toOperation(call: ToolCall, request: CopilotRequest): PlanOperation | null {
  const schema = ARGS[call.name];
  if (!schema) return null;
  const parsed = schema.safeParse(call.args);
  if (!parsed.success) return null;
  const args = parsed.data as Record<string, unknown>;
  const { brief, today, plan } = request;
  const latest = addDays(brief.endDate ?? brief.date, 60);
  const inWindow = (date: unknown) => typeof date === 'string' && date >= today && date <= latest;
  const taskIds = new Set(plan.tasks.map((t) => t.id));
  const lineIds = new Set(plan.budget.lines.map((l) => l.id));
  const vendorIds = new Set(plan.vendors.map((v) => v.id));
  const text = (value: unknown, max: number) =>
    typeof value === 'string' ? cleanModelText(value, max) : undefined;
  /** Like `text`, but an empty answer counts as no answer. */
  const optionalText = (value: unknown, max: number) => {
    const cleaned = text(value, max);
    return cleaned === '' ? undefined : cleaned;
  };

  let candidate: unknown;
  switch (call.name) {
    case 'add_task':
      if (!inWindow(args.dueDate)) return null;
      candidate = {
        type: 'task.add',
        task: {
          title: text(args.title, 120),
          dueDate: args.dueDate,
          priority: args.priority,
          notes: optionalText(args.notes, 500),
        },
      };
      break;
    case 'update_task': {
      if (typeof args.taskId !== 'string' || !taskIds.has(args.taskId)) return null;
      if (args.dueDate !== undefined && !inWindow(args.dueDate)) return null;
      const patch = {
        title: optionalText(args.title, 120),
        dueDate: args.dueDate,
        priority: args.priority,
        status: args.status,
      };
      candidate = {
        type: 'task.update',
        id: args.taskId,
        patch: JSON.parse(JSON.stringify(patch)) as unknown,
      };
      break;
    }
    case 'remove_task':
      if (typeof args.taskId !== 'string' || !taskIds.has(args.taskId)) return null;
      candidate = { type: 'task.remove', id: args.taskId };
      break;
    case 'set_budget_line':
      if (typeof args.lineId !== 'string' || !lineIds.has(args.lineId)) return null;
      candidate = { type: 'budget.updateLine', id: args.lineId, patch: { planned: args.planned } };
      break;
    case 'add_budget_line':
      candidate = {
        type: 'budget.addLine',
        line: { label: text(args.label, 60), planned: args.planned },
      };
      break;
    case 'set_budget_total': {
      const protect = Array.isArray(args.protectLineIds)
        ? args.protectLineIds.filter(
            (id): id is string => typeof id === 'string' && lineIds.has(id),
          )
        : [];
      candidate = { type: 'budget.setTotal', total: args.total, protectIds: protect };
      break;
    }
    case 'set_guest_count':
      candidate = {
        type: 'guests.setCount',
        guestCount: args.guestCount,
        keepBudget: args.keepBudget,
      };
      break;
    case 'update_vendor': {
      if (typeof args.vendorId !== 'string' || !vendorIds.has(args.vendorId)) return null;
      if (args.bookBy !== undefined && !inWindow(args.bookBy)) return null;
      const patch = JSON.parse(
        JSON.stringify({ status: args.status, bookBy: args.bookBy }),
      ) as unknown;
      candidate = { type: 'vendor.update', id: args.vendorId, patch };
      break;
    }
    case 'add_idea':
      candidate = {
        type: 'idea.add',
        idea: {
          kind: args.kind,
          title: text(args.title, 80),
          description: text(args.description, 420),
        },
      };
      break;
    case 'add_schedule_item':
      candidate = {
        type: 'schedule.add',
        item: {
          day: addDays(brief.date, typeof args.dayOffset === 'number' ? args.dayOffset : 0),
          time: args.time,
          durationMinutes: args.durationMinutes,
          title: text(args.title, 100),
        },
      };
      break;
    default:
      return null;
  }
  const operation = PlanOperation.safeParse(candidate);
  if (!operation.success) return null;
  return (COPILOT_OPERATION_TYPES as readonly string[]).includes(operation.data.type)
    ? operation.data
    : null;
}
