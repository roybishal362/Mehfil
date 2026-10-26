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

/** What a conversion may check a call against: the plan's ids and its planning window. */
interface CallContext {
  eventDate: string;
  inWindow: (date: string) => boolean;
  taskIds: ReadonlySet<string>;
  lineIds: ReadonlySet<string>;
  vendorIds: ReadonlySet<string>;
}

/** Turns a call's validated arguments into a candidate operation, or null to drop the call. */
type Convert<S extends z.ZodType> = (args: z.infer<S>, ctx: CallContext) => object | null;

interface CopilotTool {
  declaration: ToolDeclaration;
  convert: (args: unknown, ctx: CallContext) => object | null;
}

/** A tool's declaration for Gemini and its conversion, typed by the same argument schema. */
function defineTool<S extends z.ZodType>(
  declaration: { name: string; description: string; parameters: S },
  convert: Convert<S>,
): CopilotTool {
  return {
    declaration,
    convert: (args, ctx) => {
      const parsed = declaration.parameters.safeParse(args);
      return parsed.success ? convert(parsed.data, ctx) : null;
    },
  };
}

/** Text as the model wrote it, cleaned; empty text counts as none. */
function optionalText(value: string | undefined, max: number): string | undefined {
  const cleaned = cleanModelText(value ?? '', max);
  return cleaned === '' ? undefined : cleaned;
}

/** Drops absent fields, so a patch never overwrites a value with `undefined`. */
const compact = (fields: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));

const DateString = z.string().describe('Date as YYYY-MM-DD');
const Amount = z.number().int().min(0);

const TOOLS: readonly CopilotTool[] = [
  defineTool(
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
    (args, ctx) =>
      ctx.inWindow(args.dueDate)
        ? {
            type: 'task.add',
            task: {
              title: cleanModelText(args.title, 120),
              dueDate: args.dueDate,
              priority: args.priority,
              notes: optionalText(args.notes, 500),
            },
          }
        : null,
  ),
  defineTool(
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
    ({ taskId, title, dueDate, priority, status }, ctx) => {
      if (!ctx.taskIds.has(taskId)) return null;
      if (dueDate !== undefined && !ctx.inWindow(dueDate)) return null;
      const patch = compact({ title: optionalText(title, 120), dueDate, priority, status });
      return { type: 'task.update', id: taskId, patch };
    },
  ),
  defineTool(
    {
      name: 'remove_task',
      description: 'Remove a task that no longer applies.',
      parameters: z.object({ taskId: z.string() }),
    },
    ({ taskId }, ctx) => (ctx.taskIds.has(taskId) ? { type: 'task.remove', id: taskId } : null),
  ),
  defineTool(
    {
      name: 'set_budget_line',
      description: 'Set the planned amount of one budget line.',
      parameters: z.object({ lineId: z.string(), planned: Amount }),
    },
    ({ lineId, planned }, ctx) =>
      ctx.lineIds.has(lineId)
        ? { type: 'budget.updateLine', id: lineId, patch: { planned } }
        : null,
  ),
  defineTool(
    {
      name: 'add_budget_line',
      description: 'Add a new budget line.',
      parameters: z.object({ label: z.string(), planned: Amount }),
    },
    ({ label, planned }) => ({
      type: 'budget.addLine',
      line: { label: cleanModelText(label, 60), planned },
    }),
  ),
  defineTool(
    {
      name: 'set_budget_total',
      description:
        'Change the total budget; the app rescales the lines in proportion, keeping protected lines unchanged.',
      parameters: z.object({
        total: z.number().int().min(1000),
        protectLineIds: z.array(z.string()).optional(),
      }),
    },
    ({ total, protectLineIds = [] }, ctx) => ({
      type: 'budget.setTotal',
      total,
      protectIds: protectLineIds.filter((id) => ctx.lineIds.has(id)),
    }),
  ),
  defineTool(
    {
      name: 'set_guest_count',
      description:
        'Change the expected number of guests; per-guest costs scale. keepBudget true holds the total fixed.',
      parameters: z.object({
        guestCount: z.number().int().min(1).max(5000),
        keepBudget: z.boolean(),
      }),
    },
    ({ guestCount, keepBudget }) => ({ type: 'guests.setCount', guestCount, keepBudget }),
  ),
  defineTool(
    {
      name: 'update_vendor',
      description: 'Update a vendor checklist entry (status or book-by date).',
      parameters: z.object({
        vendorId: z.string(),
        status: VendorStatus.optional(),
        bookBy: DateString.optional(),
      }),
    },
    ({ vendorId, status, bookBy }, ctx) => {
      if (!ctx.vendorIds.has(vendorId)) return null;
      if (bookBy !== undefined && !ctx.inWindow(bookBy)) return null;
      return { type: 'vendor.update', id: vendorId, patch: compact({ status, bookBy }) };
    },
  ),
  defineTool(
    {
      name: 'add_idea',
      description: 'Add an idea to the ideas board.',
      parameters: z.object({ kind: IdeaKind, title: z.string(), description: z.string() }),
    },
    ({ kind, title, description }) => ({
      type: 'idea.add',
      idea: {
        kind,
        title: cleanModelText(title, 80),
        description: cleanModelText(description, 420),
      },
    }),
  ),
  defineTool(
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
    ({ dayOffset, time, durationMinutes, title }, ctx) => ({
      type: 'schedule.add',
      item: {
        day: addDays(ctx.eventDate, dayOffset),
        time,
        durationMinutes,
        title: cleanModelText(title, 100),
      },
    }),
  ),
];

/** Functions the Copilot may call. Each becomes a proposed `PlanOperation`. */
export const COPILOT_TOOLS: readonly ToolDeclaration[] = TOOLS.map((tool) => tool.declaration);

const TOOLS_BY_NAME = new Map(TOOLS.map((tool) => [tool.declaration.name, tool]));
const PROPOSABLE: ReadonlySet<string> = new Set(COPILOT_OPERATION_TYPES);

function callContext({ brief, today, plan }: CopilotRequest): CallContext {
  // Dates may run from today to two months after the event (thank-you notes, settling bills).
  const latest = addDays(brief.endDate ?? brief.date, 60);
  return {
    eventDate: brief.date,
    inWindow: (date) => date >= today && date <= latest,
    taskIds: new Set(plan.tasks.map((task) => task.id)),
    lineIds: new Set(plan.budget.lines.map((line) => line.id)),
    vendorIds: new Set(plan.vendors.map((vendor) => vendor.id)),
  };
}

/** Converts a model function call into a validated operation, or null if it is not acceptable. */
export function toOperation(call: ToolCall, request: CopilotRequest): PlanOperation | null {
  const tool = TOOLS_BY_NAME.get(call.name);
  const candidate = tool?.convert(call.args, callContext(request));
  const operation = PlanOperation.safeParse(candidate);
  return operation.success && PROPOSABLE.has(operation.data.type) ? operation.data : null;
}
