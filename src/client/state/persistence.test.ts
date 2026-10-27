import { afterEach, describe, expect, it, vi } from 'vitest';
import { weddingPlan } from '../../shared/test/fixtures';
import { BACKUP_KEY, STORAGE_KEY, connectPersistence, loadPlans, savePlans } from './persistence';
import { createPlansStore } from './plans';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadPlans and savePlans', () => {
  it('round-trips plans through storage', () => {
    const plan = weddingPlan();
    expect(savePlans(localStorage, [plan])).toBe(true);
    expect(loadPlans(localStorage)).toEqual({ plans: [plan], skipped: 0 });
  });

  it('skips entries that fail validation instead of crashing', () => {
    const plan = weddingPlan();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, plans: [plan, { id: 'evt_broken', budget: 'lots' }] }),
    );
    expect(loadPlans(localStorage)).toEqual({ plans: [plan], skipped: 1 });
  });

  it('backs up data it cannot read and starts fresh', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadPlans(localStorage)).toEqual({ plans: [], skipped: 1 });
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{not json');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, plans: [] }));
    expect(loadPlans(localStorage).skipped).toBe(1);
  });

  it('handles missing or blocked storage', () => {
    expect(loadPlans(null)).toEqual({ plans: [], skipped: 0 });
    expect(loadPlans(localStorage)).toEqual({ plans: [], skipped: 0 });
    expect(savePlans(null, [])).toBe(false);
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    } as unknown as Storage;
    expect(loadPlans(blocked)).toEqual({ plans: [], skipped: 0 });
    expect(savePlans(blocked, [weddingPlan()])).toBe(false);
  });
});

describe('connectPersistence', () => {
  it('saves after changes settle and flushes when the page is hidden', () => {
    vi.useFakeTimers();
    const store = createPlansStore();
    const stop = connectPersistence(store, { storage: localStorage, delayMs: 400 });
    const plan = weddingPlan();
    store.getState().addPlan(plan);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(400);
    expect(loadPlans(localStorage).plans).toHaveLength(1);

    store.getState().removePlan(plan.id);
    window.dispatchEvent(new Event('pagehide'));
    expect(loadPlans(localStorage).plans).toHaveLength(0);
    stop();
  });

  it('reports when saving fails', () => {
    vi.useFakeTimers();
    const onSaveFailed = vi.fn();
    const store = createPlansStore();
    const stop = connectPersistence(store, { storage: null, onSaveFailed });
    store.getState().addPlan(weddingPlan());
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onSaveFailed).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    stop();
  });
});
