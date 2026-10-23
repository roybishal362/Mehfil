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

export interface AiRun {
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

/** Streams AI sections into a plan. Resolves when the stream ends; never throws. */
export async function personalizePlan(
  planId: string,
  { sections = AI_SECTIONS, onSection }: PersonalizeOptions = {},
): Promise<void> {
  const plan = plansStore.getState().plans[planId];
  if (!plan) return;
  controllers.get(planId)?.abort();
  const controller = new AbortController();
  controllers.set(planId, controller);

  const { update } = useAiRuns.getState();
  const settle = (section: AiSection, state: Exclude<SectionState, 'pending'>) => {
    update(planId, (run) => ({ ...run, sections: { ...run.sections, [section]: state } }));
    onSection?.(section, state);
  };
  update(planId, (run) => ({
    running: true,
    sections: { ...run.sections, ...Object.fromEntries(sections.map((s) => [s, 'pending'])) },
  }));

  const today = localToday();
  try {
    await postNdjson(
      '/api/ai/personalize',
      { brief: plan.brief, today, sections },
      PersonalizeEvent,
      (event) => {
        if (event.type === 'section') {
          plansStore.getState().transform(planId, (current) =>
            mergeSection(current, event, {
              today,
              now: new Date().toISOString(),
              makeId: createId,
              model: event.meta.model,
            }),
          );
          settle(event.section, 'done');
        } else if (event.type === 'section_error') {
          plansStore
            .getState()
            .transform(planId, (current) => markSectionFailed(current, event.section));
          settle(event.section, 'failed');
        }
      },
      controller.signal,
    );
  } catch {
    if (controller.signal.aborted) return;
    // Network or server failure: every section still pending keeps the template plan.
    const pending = useAiRuns.getState().runs[planId]?.sections ?? {};
    for (const section of sections) {
      if (pending[section] !== 'pending') continue;
      plansStore.getState().transform(planId, (current) => markSectionFailed(current, section));
      settle(section, 'failed');
    }
  } finally {
    if (controllers.get(planId) === controller) controllers.delete(planId);
    // A newer run for the same plan owns the state now; otherwise this run is over.
    if (!controllers.has(planId)) update(planId, (run) => ({ ...run, running: false }));
  }
}

/** Stops a running personalisation (e.g. when the plan is deleted). */
export function cancelPersonalization(planId: string): void {
  controllers.get(planId)?.abort();
  controllers.delete(planId);
}

/** Titles already in a section, so Gemini offers something new. */
export function existingTitles(plan: EventPlan, section: AiSection): string[] {
  const titles =
    section === 'ideas'
      ? plan.ideas.map((idea) => idea.title)
      : section === 'timeline'
        ? plan.tasks.map((task) => task.title)
        : section === 'vendors'
          ? plan.vendors.map((vendor) => vendor.label ?? vendor.category)
          : plan.budget.lines.map((line) => line.label ?? line.category);
  return titles.slice(0, 40).map((title) => title.slice(0, 160));
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
