import { describe, expect, it } from 'vitest';
import { weddingPlan } from '../../shared/test/fixtures';
import { HISTORY_LIMIT, createPlansStore } from './plans';

const clock = () => {
  let time = Date.UTC(2026, 9, 23, 10);
  return () => new Date((time += 1000));
};

function storeWithPlan() {
  const store = createPlansStore({ now: clock() });
  const plan = weddingPlan();
  store.getState().addPlan(plan);
  return { store, plan };
}

describe('plans store', () => {
  it('applies validated edits as one undoable step, bumping the revision', () => {
    const { store, plan } = storeWithPlan();
    const task = plan.tasks[0];
    if (!task) throw new Error('fixture has no tasks');
    const result = store.getState().apply(plan.id, [
      { type: 'task.update', id: task.id, patch: { status: 'done' } },
      { type: 'task.add', task: { title: 'Book the shehnai', dueDate: '2026-12-01' } },
    ]);
    expect(result.ok).toBe(true);
    const updated = store.getState().plans[plan.id];
    expect(updated?.revision).toBe(plan.revision + 1);
    expect(updated?.tasks.find((t) => t.id === task.id)?.status).toBe('done');
    expect(updated?.tasks.at(-1)?.priority).toBe('medium');
    expect(store.getState().undo(plan.id)).toBe(true);
    expect(store.getState().plans[plan.id]?.tasks).toHaveLength(plan.tasks.length);
    expect(store.getState().redo(plan.id)).toBe(true);
    expect(store.getState().plans[plan.id]?.tasks).toHaveLength(plan.tasks.length + 1);
  });

  it('refuses edits that are invalid or point at nothing, leaving the plan alone', () => {
    const { store, plan } = storeWithPlan();
    expect(
      store.getState().apply(plan.id, [{ type: 'task.remove', id: 'task_404' }]),
    ).toMatchObject({ ok: false, code: 'not_found' });
    expect(
      store
        .getState()
        .apply(plan.id, [{ type: 'guests.setCount', guestCount: 0, keepBudget: true }]),
    ).toMatchObject({ ok: false, code: 'invalid' });
    expect(store.getState().apply('evt_missing', [])).toMatchObject({
      ok: false,
      code: 'unknown_plan',
    });
    expect(store.getState().plans[plan.id]).toBe(plan);
    expect(store.getState().undo(plan.id)).toBe(false);
    expect(store.getState().redo(plan.id)).toBe(false);
  });

  it('keeps a bounded undo history', () => {
    const { store, plan } = storeWithPlan();
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) {
      store
        .getState()
        .apply(plan.id, [{ type: 'guests.setCount', guestCount: 100 + i, keepBudget: true }]);
    }
    expect(store.getState().history[plan.id]?.past).toHaveLength(HISTORY_LIMIT);
  });

  it('records AI merges only when asked to make them undoable', () => {
    const { store, plan } = storeWithPlan();
    store.getState().transform(plan.id, (current) => ({ ...current, summary: 'One' }));
    expect(store.getState().history[plan.id]).toBeUndefined();
    store
      .getState()
      .transform(plan.id, (current) => ({ ...current, summary: 'Two' }), { undoable: true });
    expect(store.getState().undo(plan.id)).toBe(true);
    expect(store.getState().plans[plan.id]?.summary).toBe('One');
    store.getState().transform('evt_missing', (current) => current);
  });

  it('removes and restores plans, newest first', () => {
    const store = createPlansStore({ now: clock() });
    const older = { ...weddingPlan(), id: 'evt_older', createdAt: '2026-10-01T10:00:00.000Z' };
    const newer = { ...weddingPlan(), id: 'evt_newer', createdAt: '2026-10-20T10:00:00.000Z' };
    store.getState().hydrate([older, newer]);
    expect(store.getState().order).toEqual(['evt_newer', 'evt_older']);
    const removed = store.getState().removePlan('evt_newer');
    expect(removed?.id).toBe('evt_newer');
    expect(store.getState().order).toEqual(['evt_older']);
    expect(store.getState().removePlan('evt_newer')).toBeUndefined();
    if (removed) store.getState().restorePlan(removed);
    expect(store.getState().order).toEqual(['evt_newer', 'evt_older']);
  });
});
