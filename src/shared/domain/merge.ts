/**
 * Folds Gemini's section output into a plan. The model only suggests: percentages, lead times,
 * wording. The engine decides amounts and dates, keeps everything the user edited, de-duplicates
 * tasks and ideas, and cleans every string before it reaches the plan.
 */
import type {
  BudgetSectionData,
  IdeasSectionData,
  SectionData,
  TimelineSectionData,
  VendorsSectionData,
} from '../schemas/ai';
import {
  LIMITS,
  type EventPlan,
  type Idea,
  type Risk,
  type ScheduleItem,
  type Task,
  type Vendor,
} from '../schemas/plan';
import type { AiSection } from '../schemas/primitives';
import { getTemplate } from '../templates';
import { addDays, clampDate, diffDays, isClockTime } from '../utils/dates';
import { zipWith } from '../utils/collections';
import { cleanModelText, titleSimilarity } from '../utils/text';
import type { PlanContext } from './baseline';
import { balanceShares, splitBudget } from './budget';
import { compressLeadTimes, scheduleLeadTimes } from './timeline';

export interface MergeContext extends PlanContext {
  model?: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const DUPLICATE_THRESHOLD = 0.6;

/** Recursively cleans every string in model output (contact details removed, length-capped). */
export function deepCleanStrings<T>(value: T, max = 600): T {
  if (typeof value === 'string') return cleanModelText(value, max) as T;
  if (Array.isArray(value)) return value.map((item: unknown) => deepCleanStrings(item, max)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepCleanStrings(item, max)]),
    ) as T;
  }
  return value;
}

function isDuplicateTitle(title: string, existing: readonly string[]): boolean {
  return existing.some((other) => titleSimilarity(title, other) >= DUPLICATE_THRESHOLD);
}

function withSectionMeta(plan: EventPlan, section: AiSection, ctx: MergeContext): EventPlan['ai'] {
  return {
    sections: {
      ...plan.ai.sections,
      [section]: { status: 'ai', ...(ctx.model ? { model: ctx.model } : {}), updatedAt: ctx.now },
    },
  };
}

/** Marks a section as failed so the UI can offer a retry; the plan content is untouched. */
export function markSectionFailed(plan: EventPlan, section: AiSection): EventPlan {
  return {
    ...plan,
    ai: { sections: { ...plan.ai.sections, [section]: { status: 'failed' } } },
  };
}

function mergeBudget(plan: EventPlan, data: BudgetSectionData, ctx: MergeContext): EventPlan {
  const template = getTemplate(plan.brief.type).budget;
  const suggested = new Map(data.allocations.map((a) => [a.category, a]));
  const lines = plan.budget.lines;
  // Lines the AI may re-plan: not edited by the user and belonging to the event's template.
  const flexible = lines.flatMap((line) => {
    const row = template.find((t) => t.category === line.category);
    return line.source !== 'user' && row ? [{ line, row }] : [];
  });
  const flexibleIds = new Set(flexible.map(({ line }) => line.id));
  const fixedTotal = lines
    .filter((line) => !flexibleIds.has(line.id))
    .reduce((sum, line) => sum + line.planned, 0);
  const pool = Math.max(0, plan.budget.total - fixedTotal);

  const raw = flexible.map(({ line, row }) => suggested.get(line.category)?.percent ?? row.weight);
  // Template bounds are shares of the whole budget, so they only apply when nothing is user-fixed.
  const bounds = flexible.map(({ row }) =>
    fixedTotal === 0 ? { min: row.min, max: row.max } : { min: 0, max: 100 },
  );
  const shares = balanceShares(raw, bounds);
  const contingency = flexible.findIndex(({ line }) => line.category === 'contingency');
  const amounts = splitBudget(pool, shares, contingency >= 0 ? contingency : undefined);
  const updates = new Map(
    zipWith(flexible, amounts, ({ line }, amount) => [line.id, amount] as const),
  );

  const nextLines = lines.map((line) => {
    const planned = updates.get(line.id);
    if (planned === undefined) return line;
    const rationale = cleanModelText(suggested.get(line.category)?.rationale ?? '', 200);
    return { ...line, planned, source: 'ai' as const, ...(rationale ? { rationale } : {}) };
  });

  const savingTips = data.savingTips
    .map((t) => ({ tip: cleanModelText(t.tip, 220), category: t.category }))
    .filter((t) => t.tip.length > 0)
    .slice(0, LIMITS.savingTips)
    .map((t) => ({
      id: ctx.makeId('tip'),
      tip: t.tip,
      ...(t.category ? { category: t.category } : {}),
    }));
  const note = cleanModelText(data.assessment.note, 260);

  const { assessment: _previous, ...budgetRest } = plan.budget;
  return {
    ...plan,
    budget: {
      ...budgetRest,
      lines: nextLines,
      savingTips,
      ...(note ? { assessment: { level: data.assessment.level, note } } : {}),
    },
    ai: withSectionMeta(plan, 'budget', ctx),
  };
}

type SuggestedTask = Pick<Task, 'title' | 'daysBefore' | 'priority' | 'category'> & {
  notes: string;
};

/** Gemini's tasks, cleaned, without any that repeat a kept task or each other. */
function freshTasks(data: TimelineSectionData, kept: readonly Task[]): SuggestedTask[] {
  const fresh: SuggestedTask[] = [];
  const titles = kept.map((task) => task.title);
  for (const item of data.tasks) {
    const title = cleanModelText(item.title, 120);
    if (!title || isDuplicateTitle(title, titles)) continue;
    titles.push(title);
    const { daysBefore, priority, category } = item;
    fresh.push({
      title,
      notes: cleanModelText(item.notes ?? '', 500),
      daysBefore,
      priority,
      category,
    });
  }
  return fresh;
}

/**
 * Dates the new tasks. Their lead times are compressed together with the open tasks already in
 * the plan, so the order stays coherent when the event is close.
 */
function scheduleTasks(
  plan: EventPlan,
  kept: readonly Task[],
  fresh: readonly SuggestedTask[],
  ctx: MergeContext,
): Task[] {
  const openLeads = kept.filter((task) => task.status !== 'done').map((task) => task.daysBefore);
  const daysLeft = diffDays(plan.brief.date, ctx.today);
  const leads = compressLeadTimes(
    [...openLeads, ...fresh.map((task) => task.daysBefore)],
    daysLeft,
  ).slice(openLeads.length);
  const room = Math.max(0, LIMITS.tasks - kept.length);
  return zipWith(fresh.slice(0, room), leads.slice(0, room), (task, lead) => ({
    id: ctx.makeId('task'),
    title: task.title,
    ...(task.notes ? { notes: task.notes } : {}),
    dueDate: addDays(plan.brief.date, -lead),
    daysBefore: task.daysBefore,
    priority: task.priority,
    status: 'todo' as const,
    category: task.category,
    compressed: lead !== task.daysBefore,
    source: 'ai' as const,
  }));
}

/** The new run sheet, or the current one if Gemini returned too little to be useful. */
function mergeSchedule(
  plan: EventPlan,
  data: TimelineSectionData,
  ctx: MergeContext,
): ScheduleItem[] {
  const { brief } = plan;
  const lastDay = brief.endDate ?? brief.date;
  const aiSchedule: ScheduleItem[] = data.schedule
    .filter((slot) => isClockTime(slot.time))
    .map((slot) => {
      const owner = cleanModelText(slot.owner ?? '', 60);
      return {
        id: ctx.makeId('slot'),
        day: clampDate(addDays(brief.date, slot.dayOffset), addDays(brief.date, -1), lastDay),
        time: slot.time,
        durationMinutes: slot.durationMinutes,
        title: cleanModelText(slot.title, 100),
        ...(owner ? { owner } : {}),
        source: 'ai' as const,
      };
    })
    .filter((slot) => slot.title.length > 0);
  if (aiSchedule.length < 3) return plan.schedule;
  const userSlots = plan.schedule.filter((slot) => slot.source === 'user');
  return [...userSlots, ...aiSchedule]
    .slice(0, LIMITS.schedule)
    .sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time));
}

/** The user's own risks, then Gemini's (each needs a title and a way to reduce it). */
function mergeRisks(plan: EventPlan, data: TimelineSectionData, ctx: MergeContext): Risk[] {
  const suggested = data.risks
    .map((risk) => ({
      id: ctx.makeId('risk'),
      title: cleanModelText(risk.title, 100),
      likelihood: risk.likelihood,
      mitigation: cleanModelText(risk.mitigation, 300),
      source: 'ai' as const,
    }))
    .filter((risk) => risk.title && risk.mitigation);
  return [...plan.risks.filter((risk) => risk.source === 'user'), ...suggested].slice(
    0,
    LIMITS.risks,
  );
}

function mergeTimeline(plan: EventPlan, data: TimelineSectionData, ctx: MergeContext): EventPlan {
  // Regeneration replaces earlier AI tasks that are still open; user and finished tasks stay.
  const kept = plan.tasks.filter((task) => task.source !== 'ai' || task.status === 'done');
  return {
    ...plan,
    tasks: [...kept, ...scheduleTasks(plan, kept, freshTasks(data, kept), ctx)],
    schedule: mergeSchedule(plan, data, ctx),
    risks: mergeRisks(plan, data, ctx),
    ai: withSectionMeta(plan, 'timeline', ctx),
  };
}

function cleanList(items: readonly string[], max: number, limit: number): string[] {
  const out: string[] = [];
  for (const item of items) {
    const text = cleanModelText(item, max);
    if (text && !out.some((o) => o.toLowerCase() === text.toLowerCase())) out.push(text);
    if (out.length === limit) break;
  }
  return out;
}

function mergeVendors(plan: EventPlan, data: VendorsSectionData, ctx: MergeContext): EventPlan {
  const advice = new Map(data.vendors.map((v) => [v.category, v]));
  const enriched: Vendor[] = plan.vendors
    // Earlier AI-suggested extra vendors that the user never touched are replaced.
    .filter(
      (v) =>
        !(
          v.source === 'ai' &&
          v.category === 'custom' &&
          v.status === 'not_started' &&
          v.options.length === 0
        ),
    )
    .map((vendor) => {
      const tips = advice.get(vendor.category);
      if (!tips || vendor.category === 'custom') return vendor;
      const tip = cleanModelText(tips.tip, 220);
      return {
        ...vendor,
        questions: cleanList(tips.questions, 160, 5),
        redFlags: cleanList(tips.redFlags, 160, 3),
        ...(tip ? { tip } : {}),
      };
    });

  const labels = enriched.map((v) => v.label ?? v.category.replaceAll('_', ' '));
  const extras = data.extraCategories
    .map((extra) => ({
      ...extra,
      label: cleanModelText(extra.label, 60),
      reason: cleanModelText(extra.reason, 220),
    }))
    .filter((extra) => extra.label && !isDuplicateTitle(extra.label, labels))
    .slice(0, Math.max(0, LIMITS.vendors - enriched.length));
  const dates = scheduleLeadTimes(
    extras.map((e) => e.daysBefore),
    plan.brief.date,
    ctx.today,
  );
  const added: Vendor[] = zipWith(extras, dates, (extra, scheduled) => ({
    id: ctx.makeId('vendor'),
    category: 'custom',
    label: extra.label,
    priority: extra.priority,
    bookBy: scheduled.dueDate,
    status: 'not_started',
    questions: [],
    redFlags: [],
    ...(extra.reason ? { tip: extra.reason } : {}),
    options: [],
    source: 'ai',
  }));

  return { ...plan, vendors: [...enriched, ...added], ai: withSectionMeta(plan, 'vendors', ctx) };
}

function mergeIdeas(plan: EventPlan, data: IdeasSectionData, ctx: MergeContext): EventPlan {
  const kept = plan.ideas.filter((idea) => idea.favorite || idea.source === 'user');
  const titles = kept.map((idea) => idea.title);
  const fresh: Idea[] = [];
  const consider = (idea: Omit<Idea, 'id'>) => {
    if (!idea.title || !idea.description) return;
    if (isDuplicateTitle(idea.title, [...titles, ...fresh.map((f) => f.title)])) return;
    fresh.push({ id: ctx.makeId('idea'), ...idea });
  };
  for (const theme of data.themes) {
    const palette = theme.palette.filter((c) => HEX.test(c)).slice(0, 5);
    consider({
      kind: 'theme',
      title: cleanModelText(theme.title, 80),
      description: cleanModelText(theme.description, 420),
      ...(palette.length >= 2 ? { palette } : {}),
      favorite: false,
      source: 'ai',
    });
  }
  for (const idea of data.ideas) {
    consider({
      kind: idea.kind,
      title: cleanModelText(idea.title, 80),
      description: cleanModelText(idea.description, 420),
      costLevel: idea.costLevel,
      favorite: false,
      source: 'ai',
    });
  }
  const summary = cleanModelText(data.summary, 800);
  return {
    ...plan,
    ...(summary ? { summary } : {}),
    ideas: [...kept, ...fresh].slice(0, LIMITS.ideas),
    ai: withSectionMeta(plan, 'ideas', ctx),
  };
}

/** Merges one AI section into the plan. Pure: returns a new plan. */
export function mergeSection(plan: EventPlan, input: SectionData, ctx: MergeContext): EventPlan {
  switch (input.section) {
    case 'budget':
      return mergeBudget(plan, input.data, ctx);
    case 'timeline':
      return mergeTimeline(plan, input.data, ctx);
    case 'vendors':
      return mergeVendors(plan, input.data, ctx);
    case 'ideas':
      return mergeIdeas(plan, input.data, ctx);
  }
}
