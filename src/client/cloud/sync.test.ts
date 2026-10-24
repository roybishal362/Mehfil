import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventPlan } from '../../shared/schemas/plan';
import { weddingPlan } from '../../shared/test/fixtures';
import { createPlansStore } from '../state/plans';
import { FakeCloud } from '../test/fake-cloud';
import { baseKey, startSync, type SyncEngine, type SyncSnapshot } from './sync';

const UID = 'uid-google';
const planWith = (id: string, extra: Partial<EventPlan> = {}): EventPlan => ({
  ...weddingPlan(),
  id,
  ...extra,
});
const START = planWith('x').revision;

let engine: SyncEngine | undefined;
afterEach(() => {
  engine?.stop();
  engine = undefined;
});

function setup({ local = [], remote = [] }: { local?: EventPlan[]; remote?: EventPlan[] } = {}) {
  const cloud = new FakeCloud();
  const store = createPlansStore();
  store.getState().hydrate(local);
  for (const plan of remote) cloud.putRemote(UID, plan);
  const snapshots: SyncSnapshot[] = [];
  const started = startSync({
    backend: cloud,
    store,
    uid: UID,
    storage: localStorage,
    onChange: (snapshot) => snapshots.push(snapshot),
    delayMs: 0,
    pullIntervalMs: 0,
  });
  engine = started;
  const edit = (id: string, summary: string) => {
    store.getState().transform(id, (plan) => ({ ...plan, summary }));
  };
  const remoteSummary = (id: string) =>
    (JSON.parse(cloud.plans.get(UID)?.get(id)?.json ?? '{}') as Partial<EventPlan>).summary;
  return { cloud, store, engine: started, edit, remoteSummary, last: () => snapshots.at(-1) };
}

describe('plan sync', () => {
  it("uploads this device's plans and brings in plans made on other devices", async () => {
    const { cloud, store, engine, last } = setup({
      local: [planWith('evt_here')],
      remote: [planWith('evt_there', { revision: 4 })],
    });
    await engine.syncNow();
    expect(cloud.remoteRevision(UID, 'evt_here')).toBe(START);
    expect(store.getState().plans.evt_there?.revision).toBe(4);
    expect(last()).toMatchObject({ status: 'idle', conflicts: [] });
    expect(JSON.parse(localStorage.getItem(baseKey(UID)) ?? '{}')).toEqual({
      evt_here: START,
      evt_there: 4,
    });
  });

  it('pushes edits and deletions shortly after they happen', async () => {
    const { cloud, store, engine, edit, remoteSummary } = setup({ local: [planWith('evt_a')] });
    await engine.syncNow();
    edit('evt_a', 'Mehendi moved to Friday');
    await engine.settle();
    expect(remoteSummary('evt_a')).toBe('Mehendi moved to Friday');
    expect(cloud.remoteRevision(UID, 'evt_a')).toBe(START + 1);
    store.getState().removePlan('evt_a');
    await engine.settle();
    expect(cloud.remoteRevision(UID, 'evt_a')).toBeUndefined();
  });

  it('shows a conflict when both devices changed a plan and keeps the chosen version', async () => {
    const { cloud, store, engine, edit, remoteSummary, last } = setup({
      local: [planWith('evt_a')],
    });
    await engine.syncNow();
    cloud.putRemote(UID, planWith('evt_a', { revision: START + 1, summary: 'From the phone' }));
    edit('evt_a', 'From the laptop');
    await engine.settle();
    expect(last()?.conflicts.map((conflict) => conflict.remote.summary)).toEqual([
      'From the phone',
    ]);
    // A plan in conflict is not pushed until the user decides.
    edit('evt_a', 'Still the laptop');
    await engine.settle();
    expect(remoteSummary('evt_a')).toBe('From the phone');

    await engine.resolve('evt_a', 'local', 'unused');
    expect(remoteSummary('evt_a')).toBe('Still the laptop');
    expect(cloud.remoteRevision(UID, 'evt_a')).toBe(store.getState().plans.evt_a?.revision);
    expect(last()?.conflicts).toEqual([]);
  });

  it("can take the other device's version, or keep both as two plans", async () => {
    const remote = planWith('evt_a', { revision: START + 3, summary: 'From the phone' });
    const { cloud, store, engine, edit } = setup({ local: [planWith('evt_a')] });
    await engine.syncNow();
    cloud.putRemote(UID, remote);
    edit('evt_a', 'From the laptop');
    await engine.syncNow();
    await engine.resolve('evt_a', 'remote', 'unused');
    expect(store.getState().plans.evt_a?.summary).toBe('From the phone');

    cloud.putRemote(UID, { ...remote, revision: START + 9, summary: 'Phone again' });
    edit('evt_a', 'Laptop again');
    await engine.syncNow();
    await engine.resolve('evt_a', 'both', 'Wedding (this device)');
    const plans = Object.values(store.getState().plans);
    expect(plans.map((plan) => plan.summary).sort()).toEqual(['Laptop again', 'Phone again']);
    const copy = plans.find((plan) => plan.id !== 'evt_a');
    expect(copy?.brief.title).toBe('Wedding (this device)');
    expect(cloud.remoteRevision(UID, copy?.id ?? '')).toBe(0);
    await engine.resolve('evt_missing', 'local', 'unused');
  });

  it('keeps working offline and catches up when the connection returns', async () => {
    const { cloud, engine, edit, remoteSummary, last } = setup({ local: [planWith('evt_a')] });
    await engine.syncNow();
    cloud.offline = true;
    edit('evt_a', 'Edited on the train');
    await engine.settle();
    expect(last()?.status).toBe('offline');
    cloud.offline = false;
    window.dispatchEvent(new Event('online'));
    await engine.settle();
    expect(last()?.status).toBe('idle');
    expect(remoteSummary('evt_a')).toBe('Edited on the train');
  });

  it('brings in changes from other devices when the tab is shown again', async () => {
    const { cloud, store, engine } = setup({ local: [planWith('evt_a')] });
    await engine.syncNow();
    cloud.putRemote(UID, planWith('evt_a', { revision: START + 2, summary: 'From the phone' }));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await engine.settle();
    expect(store.getState().plans.evt_a?.summary).toBe('From the phone');
  });

  it('follows deletions from other devices but never loses newer work', async () => {
    const { cloud, store, engine, edit } = setup({
      local: [planWith('evt_gone'), planWith('evt_kept')],
    });
    await engine.syncNow();
    cloud.plans.get(UID)?.delete('evt_gone');
    cloud.plans.get(UID)?.delete('evt_kept');
    edit('evt_kept', 'Edited after the phone deleted it');
    await engine.syncNow();
    expect(store.getState().plans.evt_gone).toBeUndefined();
    expect(cloud.remoteRevision(UID, 'evt_kept')).toBe(START + 1);
  });

  it('leaves unreadable cloud copies alone', async () => {
    const { cloud, store, engine } = setup({ local: [planWith('evt_a')] });
    await engine.syncNow();
    cloud.plans.get(UID)?.set('evt_a', { id: 'evt_a', revision: START + 5, json: '{broken' });
    await engine.syncNow();
    expect(store.getState().plans.evt_a).toBeDefined();
    expect(cloud.plans.get(UID)?.get('evt_a')?.json).toBe('{broken');
  });

  it('reports errors and stops listening once stopped', async () => {
    const { cloud, engine, edit, last } = setup({ local: [planWith('evt_a')] });
    vi.spyOn(cloud, 'listPlans').mockRejectedValueOnce(new Error('permission-denied'));
    await engine.syncNow();
    expect(last()?.status).toBe('error');
    await engine.syncNow();
    engine.stop();
    edit('evt_a', 'After sign-out');
    await engine.settle();
    expect(cloud.remoteRevision(UID, 'evt_a')).toBe(START);
  });
});
