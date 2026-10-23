import { describe, expect, it, vi } from 'vitest';
import { budgetData, ideasData, META, timelineData, vendorsData } from '../test/ai-fixtures';
import { jsonResponse, mockApi, ndjsonResponse, seedPlan } from '../test/helpers';
import {
  cancelPersonalization,
  existingTitles,
  personalizePlan,
  refineSection,
  useAiRuns,
} from './ai';
import { plansStore } from './plans';

describe('personalizePlan', () => {
  it('merges each section as it streams in and announces it', async () => {
    const plan = seedPlan();
    mockApi({
      '/api/ai/personalize': () =>
        ndjsonResponse([
          { type: 'section', section: 'ideas', data: ideasData, meta: META },
          { type: 'section', section: 'budget', data: budgetData, meta: META },
          { type: 'section', section: 'timeline', data: timelineData, meta: META },
          { type: 'section_error', section: 'vendors', code: 'unavailable', message: 'Busy' },
          { type: 'done', ms: 900 },
        ]),
    });
    const onSection = vi.fn();
    await personalizePlan(plan.id, { onSection });
    const updated = plansStore.getState().plans[plan.id];
    expect(updated?.ideas.map((idea) => idea.title)).toContain('Mishti doi bar');
    expect(updated?.summary).toBe('A warm Bengali wedding lit by diyas.');
    expect(updated?.ai.sections.vendors.status).toBe('failed');
    expect(updated?.ai.sections.ideas.status).toBe('ai');
    expect(onSection).toHaveBeenCalledWith('vendors', 'failed');
    expect(useAiRuns.getState().runs[plan.id]).toEqual({
      running: false,
      sections: { budget: 'done', timeline: 'done', vendors: 'failed', ideas: 'done' },
    });
  });

  it('marks unfinished sections as failed when the connection drops', async () => {
    const plan = seedPlan();
    mockApi({
      '/api/ai/personalize': () => jsonResponse({ code: 'ai_unavailable', message: 'x' }, 503),
    });
    await personalizePlan(plan.id, { sections: ['ideas', 'vendors'] });
    const updated = plansStore.getState().plans[plan.id];
    expect(updated?.ai.sections.ideas.status).toBe('failed');
    expect(updated?.ai.sections.budget.status).toBe('template');
  });

  it('does nothing for an unknown plan and can be cancelled', async () => {
    const { fetchMock } = mockApi({});
    await personalizePlan('evt_missing');
    expect(fetchMock).not.toHaveBeenCalled();

    const plan = seedPlan();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: unknown, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            // Like the real fetch: an already-aborted signal rejects at once.
            const abort = () => {
              reject(new DOMException('Aborted', 'AbortError'));
            };
            if (init?.signal?.aborted) abort();
            init?.signal?.addEventListener('abort', abort);
          }),
      ),
    );
    const running = personalizePlan(plan.id);
    cancelPersonalization(plan.id);
    await running;
    expect(useAiRuns.getState().runs[plan.id]?.running).toBe(false);
    expect(plansStore.getState().plans[plan.id]?.ai.sections.ideas.status).toBe('template');
  });
});

describe('refineSection', () => {
  it('replaces the section in one undoable step and sends what already exists', async () => {
    const plan = seedPlan();
    const { calls } = mockApi({
      '/api/ai/refine': () => jsonResponse({ section: 'ideas', data: ideasData, meta: META }),
    });
    await refineSection(plan.id, 'ideas', 'More Bengali sweets');
    expect(calls[0]?.body).toMatchObject({
      section: 'ideas',
      instruction: 'More Bengali sweets',
      existing: [],
    });
    expect(plansStore.getState().plans[plan.id]?.ideas).toHaveLength(ideasData.ideas.length + 2);
    expect(plansStore.getState().undo(plan.id)).toBe(true);
    expect(plansStore.getState().plans[plan.id]?.ideas).toHaveLength(0);
  });

  it('lists existing titles for every section', () => {
    const plan = seedPlan();
    expect(existingTitles(plan, 'timeline')[0]).toBe(plan.tasks[0]?.title);
    expect(existingTitles(plan, 'vendors')).toContain('venue');
    expect(existingTitles(plan, 'budget')).toContain('catering');
  });

  it('passes AI failures to the caller', async () => {
    const plan = seedPlan();
    mockApi({
      '/api/ai/refine': () => jsonResponse({ code: 'ai_unavailable', message: 'x' }, 503),
    });
    await expect(refineSection(plan.id, 'ideas', 'x')).rejects.toMatchObject({ status: 503 });
    await expect(refineSection('evt_missing', 'ideas', 'x')).resolves.toBeUndefined();
    expect(vendorsData.vendors).toHaveLength(1);
  });
});
