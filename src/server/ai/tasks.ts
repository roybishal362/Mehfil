/**
 * The AI tasks behind the gateway's routes. Each builds a prompt, calls the model through the
 * resilient gateway, then validates and sanitises the answer before it leaves the server.
 */
import * as z from '../../shared/zod';
import { deepCleanStrings } from '../../shared/domain/merge';
import {
  BriefExtraction,
  IdeasSectionData,
  InvitationDraft,
  TimelineSectionData,
  budgetSectionSchema,
  vendorsSectionSchema,
  type AiMetaInfo,
  type BriefRequest,
  type BriefResponse,
  type CopilotRequest,
  type CopilotResponse,
  type InvitationRequest,
  type SectionData,
} from '../../shared/schemas/ai';
import { PartialBrief, type EventBrief } from '../../shared/schemas/brief';
import { COPILOT_OPERATION_TYPES, PlanOperation } from '../../shared/schemas/operations';
import {
  IdeaKind,
  Priority,
  TaskStatus,
  VendorStatus,
  type AiSection,
  type OutputLanguage,
} from '../../shared/schemas/primitives';
import { getTemplate } from '../../shared/templates';
import { addDays } from '../../shared/utils/dates';
import { cleanModelText, cleanMultilineText, cleanText } from '../../shared/utils/text';
import type { AiGateway, AiOutcome } from './gateway';
import {
  briefPrompt,
  copilotSystemPrompt,
  copilotTurnText,
  invitationPrompt,
  refinePrompt,
  sectionPrompt,
  systemPrompt,
} from './prompts';
import type { ChatTurn, ToolCall, ToolDeclaration } from './provider';

function meta(outcome: AiOutcome<unknown>, mode: AiGateway['mode']): AiMetaInfo {
  return { model: outcome.model, mode, cached: outcome.cached, ms: outcome.ms };
}

// ------------------------------------------------------------------------------------------
// Brief extraction
// ------------------------------------------------------------------------------------------

/** Keeps only the extracted fields that pass validation on their own. */
export function validExtractedFields(
  raw: BriefExtraction['brief'],
  today: string,
): BriefResponse['brief'] {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const cleaned = typeof value === 'string' ? cleanText(value, 300) : value;
    if (cleaned === '') continue;
    const single = PartialBrief.safeParse({ [key]: cleaned });
    if (single.success && key in single.data) out[key] = cleaned;
  }
  const brief = PartialBrief.parse(out);
  if (brief.date && brief.date < today) delete brief.date;
  if (brief.endDate && (!brief.date || brief.endDate < brief.date)) delete brief.endDate;
  return brief;
}

export async function extractBrief(
  gateway: AiGateway,
  request: BriefRequest,
  signal?: AbortSignal,
): Promise<{ response: BriefResponse; meta: AiMetaInfo }> {
  const language: OutputLanguage = request.uiLanguage;
  const outcome = await gateway.json(
    {
      task: 'brief',
      model: gateway.models.fast,
      system: systemPrompt(language),
      prompt: briefPrompt(request.text, request.today),
      schema: BriefExtraction,
      temperature: 0.1,
      maxOutputTokens: 1024,
      thinking: 'minimal',
      timeoutMs: 12_000,
      input: request,
      ...(signal ? { signal } : {}),
    },
    15_000,
  );
  const brief = validExtractedFields(outcome.data.brief, request.today);
  const missing = (['type', 'date', 'city', 'guestCount', 'budget'] as const).filter(
    (field) => brief[field] === undefined,
  );
  const question = outcome.data.question ? cleanModelText(outcome.data.question, 200) : '';
  return {
    response: { brief, missing, ...(question && missing.length ? { question } : {}) },
    meta: meta(outcome, gateway.mode),
  };
}

// ------------------------------------------------------------------------------------------
// Plan sections
// ------------------------------------------------------------------------------------------

interface SectionSettings {
  smart: boolean;
  temperature: number;
  maxOutputTokens: number;
}

const SECTION_SETTINGS: Readonly<Record<AiSection, SectionSettings>> = {
  budget: { smart: false, temperature: 0.3, maxOutputTokens: 2048 },
  timeline: { smart: false, temperature: 0.4, maxOutputTokens: 3072 },
  vendors: { smart: false, temperature: 0.4, maxOutputTokens: 3072 },
  ideas: { smart: true, temperature: 0.9, maxOutputTokens: 4096 },
};

function sectionSchema(section: AiSection, brief: EventBrief): z.ZodType<SectionData['data']> {
  const template = getTemplate(brief.type);
  switch (section) {
    case 'budget': {
      const [first, ...rest] = template.budget.map((line) => line.category);
      return budgetSectionSchema(first ? [first, ...rest] : ['contingency']);
    }
    case 'vendors': {
      const [first, ...rest] = template.vendors.map((vendor) => vendor.category);
      return vendorsSectionSchema(first ? [first, ...rest] : ['custom']);
    }
    case 'timeline':
      return TimelineSectionData;
    case 'ideas':
      return IdeasSectionData;
  }
}

export interface SectionRequest {
  section: AiSection;
  brief: EventBrief;
  today: string;
  /** Present when the user asked for changes ("more budget-friendly"). */
  instruction?: string;
  existing?: readonly string[];
  signal?: AbortSignal;
}

export async function generateSection(
  gateway: AiGateway,
  { section, brief, today, instruction, existing = [], signal }: SectionRequest,
): Promise<{ result: SectionData; meta: AiMetaInfo }> {
  const settings = SECTION_SETTINGS[section];
  const smart = settings.smart || instruction !== undefined;
  const outcome = await gateway.json(
    {
      task: `section.${section}`,
      model: smart ? gateway.models.smart : gateway.models.fast,
      system: systemPrompt(brief.language),
      prompt: instruction
        ? refinePrompt(section, brief, today, instruction, existing)
        : sectionPrompt(section, brief, today),
      schema: sectionSchema(section, brief),
      temperature: settings.temperature,
      maxOutputTokens: settings.maxOutputTokens,
      thinking: smart ? 'low' : 'minimal',
      timeoutMs: 25_000,
      input: { brief, today, ...(instruction ? { instruction } : {}) },
      ...(signal ? { signal } : {}),
    },
    30_000,
  );
  // Server-side sanitising before anything reaches the browser: no contacts, bounded lengths.
  const result = { section, data: deepCleanStrings(outcome.data) } as SectionData;
  return { result, meta: meta(outcome, gateway.mode) };
}

// ------------------------------------------------------------------------------------------
// Invitations
// ------------------------------------------------------------------------------------------

export async function draftInvitation(
  gateway: AiGateway,
  request: InvitationRequest,
  signal?: AbortSignal,
): Promise<{ variants: InvitationDraft['variants']; meta: AiMetaInfo }> {
  const outcome = await gateway.json(
    {
      task: 'invitation',
      model: gateway.models.fast,
      system: systemPrompt(request.language),
      prompt: invitationPrompt(request),
      schema: InvitationDraft,
      temperature: 0.8,
      maxOutputTokens: 2048,
      thinking: 'minimal',
      timeoutMs: 15_000,
      input: request,
      ...(signal ? { signal } : {}),
    },
    20_000,
  );
  const variants = outcome.data.variants
    .map((v) => ({ label: cleanModelText(v.label, 40), text: cleanMultilineText(v.text, 1200) }))
    .filter((v) => v.label && v.text);
  return { variants, meta: meta(outcome, gateway.mode) };
}

// ------------------------------------------------------------------------------------------
// Copilot
// ------------------------------------------------------------------------------------------

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

/**
 * The conversation as Gemini expects it: starting with the user, then alternating. A failed
 * request leaves two questions in a row, so neighbouring turns from one side are joined.
 */
export function copilotTurns(request: CopilotRequest): ChatTurn[] {
  const turns: ChatTurn[] = [];
  const all: ChatTurn[] = [
    ...request.history.map((turn) => ({
      role: turn.role === 'assistant' ? ('model' as const) : ('user' as const),
      text: turn.text,
    })),
    {
      role: 'user',
      text: copilotTurnText(request.brief, request.today, request.plan, request.message),
    },
  ];
  for (const turn of all) {
    const last = turns.at(-1);
    if (last?.role === turn.role) {
      turns[turns.length - 1] = { role: turn.role, text: `${last.text}\n\n${turn.text}` };
    } else if (last || turn.role === 'user') {
      turns.push(turn);
    }
  }
  return turns;
}

export async function runCopilot(
  gateway: AiGateway,
  request: CopilotRequest,
  signal?: AbortSignal,
): Promise<{ response: CopilotResponse; meta: AiMetaInfo }> {
  const outcome = await gateway.tools(
    {
      task: 'copilot',
      model: gateway.models.smart,
      system: copilotSystemPrompt(request.brief.language),
      contents: copilotTurns(request),
      tools: COPILOT_TOOLS,
      temperature: 0.4,
      maxOutputTokens: 2048,
      thinking: 'low',
      timeoutMs: 25_000,
      input: request,
      ...(signal ? { signal } : {}),
    },
    30_000,
  );
  const operations: PlanOperation[] = [];
  let dropped = 0;
  for (const call of outcome.data.calls.slice(0, 12)) {
    const operation = toOperation(call, request);
    if (operation) operations.push(operation);
    else dropped += 1;
  }
  return {
    response: {
      reply: cleanModelText(outcome.data.text, 800),
      operations: operations.slice(0, 6),
      dropped,
    },
    meta: meta(outcome, gateway.mode),
  };
}
