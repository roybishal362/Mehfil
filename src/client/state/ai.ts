/**
 * Gemini personalisation of a plan. The baseline plan is already on screen; this streams the
 * four AI sections and merges each one the moment it arrives, so the page fills in
 * progressively. A failed section keeps its template content and can be retried on its own.
 */
import { create } from 'zustand';
import { markSectionFailed, mergeSection } from '../../shared/domain/merge';
import { PersonalizeEvent, RefineApiResponse } from '../../shared/schemas/ai';
import type { EventPlan } from '../../shared/schemas/plan';
import { AI_SECTIONS, type AiSection } from '../../shared/schemas/primitives';
import { localToday } from '../../shared/utils/dates';
import { createId } from '../../shared/utils/ids';
import { postJson, postNdjson } from '../lib/api';
import { plansStore } from './plans';

export type SectionState = 'pending' | 'done' | 'failed';

interface AiRun {
  running: boolean;
  sections: Partial<Record<AiSection, SectionState>>;
}

interface AiRunsState {
  runs: Readonly<Record<string, AiRun>>;
  update: (planId: string, change: (run: AiRun) => AiRun) => void;
}

export const useAiRuns = create<AiRunsState>()((set) => ({
  runs: {},
  update: (planId, change) => {
    set((state) => ({
      runs: {
        ...state.runs,
        [planId]: change(state.runs[planId] ?? { running: false, sections: {} }),
      },
    }));
  },
}));

const controllers = new Map<string, AbortController>();

export interface PersonalizeOptions {
  sections?: readonly AiSection[];
  /** Called as each section settles, e.g. to announce it to screen readers. */
  onSection?: (section: AiSection, state: Exclude<SectionState, 'pending'>) => void;
}

type SettledState = Exclude<SectionState, 'pending'>;
type Settle = (section: AiSection, state: SettledState) => void;

/** Starts a run for a plan, cancelling any earlier one, with its sections pending. */
function beginRun(planId: string, sections: readonly AiSection[]): AbortController {
  controllers.get(planId)?.abort();
  const controller = new AbortController();
  controllers.set(planId, controller);
  useAiRuns.getState().update(planId, (run) => ({
    running: true,
    sections: { ...run.sections, ...Object.fromEntries(sections.map((s) => [s, 'pending'])) },
  }));
  return controller;
}

/** Ends a run, unless a newer run for the same plan already owns the state. */
function endRun(planId: string, controller: AbortController): void {
  if (controllers.get(planId) === controller) controllers.delete(planId);
  if (!controllers.has(planId)) {
    useAiRuns.getState().update(planId, (run) => ({ ...run, running: false }));
  }
}

/** Merges one streamed event into the plan: a tailored section, or one that failed. */
function applyEvent(planId: string, event: PersonalizeEvent, today: string, settle: Settle): void {
  const { transform } = plansStore.getState();
  if (event.type === 'section') {
    const context = { today, now: new Date().toISOString(), makeId: createId };
    transform(planId, (current) =>
      mergeSection(current, event, { ...context, model: event.meta.model }),
    );
    settle(event.section, 'done');
  } else if (event.type === 'section_error') {
    transform(planId, (current) => markSectionFailed(current, event.section));
    settle(event.section, 'failed');
  }
}

/** After a network or server failure, every section still pending keeps the template plan. */
function failPending(planId: string, sections: readonly AiSection[], settle: Settle): void {
  const states = useAiRuns.getState().runs[planId]?.sections ?? {};
  for (const section of sections.filter((name) => states[name] === 'pending')) {
    plansStore.getState().transform(planId, (current) => markSectionFailed(current, section));
    settle(section, 'failed');
  }
}

/** Streams AI sections into a plan. Resolves when the stream ends; never throws. */
export async function personalizePlan(
  planId: string,
  { sections = AI_SECTIONS, onSection }: PersonalizeOptions = {},
): Promise<void> {
  const plan = plansStore.getState().plans[planId];
  if (!plan) return;
  const controller = beginRun(planId, sections);
  const settle: Settle = (section, state) => {
    useAiRuns
      .getState()
      .update(planId, (run) => ({ ...run, sections: { ...run.sections, [section]: state } }));
    onSection?.(section, state);
  };
  const today = localToday();
  try {
    await postNdjson({
      path: '/api/ai/personalize',
      body: { brief: plan.brief, today, sections },
      schema: PersonalizeEvent,
      onEvent: (event) => {
        applyEvent(planId, event, today, settle);
      },
      signal: controller.signal,
    });
  } catch {
    if (!controller.signal.aborted) failPending(planId, sections, settle);
  } finally {
    endRun(planId, controller);
  }
}

/** Stops a running personalisation (e.g. when the plan is deleted). */
export function cancelPersonalization(planId: string): void {
  controllers.get(planId)?.abort();
  controllers.delete(planId);
}

/** Titles already in a section, so Gemini offers something new. */
export function existingTitles(plan: EventPlan, section: AiSection): string[] {
  return sectionTitles(plan, section)
    .slice(0, 40)
    .map((title) => title.slice(0, 160));
}

function sectionTitles(plan: EventPlan, section: AiSection): string[] {
  switch (section) {
    case 'ideas':
      return plan.ideas.map((idea) => idea.title);
    case 'timeline':
      return plan.tasks.map((task) => task.title);
    case 'vendors':
      return plan.vendors.map((vendor) => vendor.label ?? vendor.category);
    case 'budget':
      return plan.budget.lines.map((line) => line.label ?? line.category);
  }
}

/**
 * Regenerates one section from an instruction ("more eco-friendly ideas"). The merge is one
 * undoable step. Throws ApiError when the AI is unavailable, so the caller can say so.
 */
export async function refineSection(
  planId: string,
  section: AiSection,
  instruction: string,
  signal?: AbortSignal,
): Promise<void> {
  const plan = plansStore.getState().plans[planId];
  if (!plan) return;
  const today = localToday();
  const response = await postJson(
    '/api/ai/refine',
    { section, brief: plan.brief, today, instruction, existing: existingTitles(plan, section) },
    RefineApiResponse,
    signal,
  );
  plansStore.getState().transform(
    planId,
    (current) =>
      mergeSection(current, response, {
        today,
        now: new Date().toISOString(),
        makeId: createId,
        model: response.meta.model,
      }),
    { undoable: true },
  );
}
