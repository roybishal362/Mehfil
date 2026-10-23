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
import { addDays, clampDate, diffDays } from '../utils/dates';
import { zipWith } from '../utils/collections';
import { cleanModelText, titleSimilarity } from '../utils/text';
import type { PlanContext } from './baseline';
import { balanceShares, splitBudget } from './budget';
import { compressLeadTimes, scheduleLeadTimes } from './timeline';

export interface MergeContext extends PlanContext {
  model?: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
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

function mergeTimeline(plan: EventPlan, data: TimelineSectionData, ctx: MergeContext): EventPlan {
  const { brief } = plan;
  // Regeneration replaces earlier AI tasks that are still open; user and finished tasks stay.
  const kept = plan.tasks.filter((t) => t.source !== 'ai' || t.status === 'done');
  const existingTitles = kept.map((t) => t.title);

  const fresh: {
    title: string;
    notes: string;
    daysBefore: number;
    priority: Task['priority'];
    category: Task['category'];
  }[] = [];
  for (const item of data.tasks) {
    const title = cleanModelText(item.title, 120);
    if (!title || isDuplicateTitle(title, [...existingTitles, ...fresh.map((f) => f.title)]))
      continue;
    fresh.push({
      title,
      notes: cleanModelText(item.notes ?? '', 500),
      daysBefore: item.daysBefore,
      priority: item.priority,
      category: item.category,
    });
  }

  // Compress AI lead times together with the open template tasks so their order stays coherent.
  const openLeads = kept.filter((t) => t.status !== 'done').map((t) => t.daysBefore);
  const daysLeft = diffDays(brief.date, ctx.today);
  const mapped = compressLeadTimes(
    [...openLeads, ...fresh.map((f) => f.daysBefore)],
    daysLeft,
  ).slice(openLeads.length);
  const room = Math.max(0, LIMITS.tasks - kept.length);
  const aiTasks: Task[] = zipWith(fresh.slice(0, room), mapped.slice(0, room), (f, lead) => {
    return {
      id: ctx.makeId('task'),
      title: f.title,
      ...(f.notes ? { notes: f.notes } : {}),
      dueDate: addDays(brief.date, -lead),
      daysBefore: f.daysBefore,
      priority: f.priority,
      status: 'todo',
      category: f.category,
      compressed: lead !== f.daysBefore,
      source: 'ai',
    };
  });

  const lastDay = brief.endDate ?? brief.date;
  const aiSchedule: ScheduleItem[] = data.schedule
    .filter((s) => CLOCK.test(s.time))
    .map((s) => ({
      id: ctx.makeId('slot'),
      day: clampDate(addDays(brief.date, s.dayOffset), addDays(brief.date, -1), lastDay),
      time: s.time,
      durationMinutes: s.durationMinutes,
      title: cleanModelText(s.title, 100),
      ...(s.owner && cleanModelText(s.owner, 60) ? { owner: cleanModelText(s.owner, 60) } : {}),
      source: 'ai' as const,
    }))
    .filter((s) => s.title.length > 0);
  const userSlots = plan.schedule.filter((s) => s.source === 'user');
  // Keep the existing run sheet if the model returned too little to be useful.
  const schedule =
    aiSchedule.length >= 3
      ? [...userSlots, ...aiSchedule]
          .slice(0, LIMITS.schedule)
          .sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time))
      : plan.schedule;

  const risks: Risk[] = [
    ...plan.risks.filter((r) => r.source === 'user'),
    ...data.risks
      .map((r) => ({
        id: ctx.makeId('risk'),
        title: cleanModelText(r.title, 100),
        likelihood: r.likelihood,
        mitigation: cleanModelText(r.mitigation, 300),
        source: 'ai' as const,
      }))
      .filter((r) => r.title && r.mitigation),
  ].slice(0, LIMITS.risks);

  return {
    ...plan,
    tasks: [...kept, ...aiTasks],
    schedule,
    risks,
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
