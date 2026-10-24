import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { EventPlan } from '../../shared/schemas/plan';
import { weddingPlan } from '../../shared/test/fixtures';
import { reconcile, type SyncActions, type SyncBase } from './reconcile';

const template = weddingPlan();
const plan = (id: string, revision: number, summary = 'A plan'): EventPlan => ({
  ...template,
  id,
  revision,
  summary,
});

describe('reconcile', () => {
  it('copies one-sided changes and leaves unchanged plans alone', () => {
    const base: SyncBase = { same: 3, mine: 3, theirs: 3 };
    const actions = reconcile(
      [plan('same', 3), plan('mine', 4), plan('theirs', 3)],
      [plan('same', 3), plan('mine', 3), plan('theirs', 5)],
      base,
    );
    expect(actions.upload).toEqual([{ plan: plan('mine', 4), expected: 3 }]);
    expect(actions.download).toEqual([plan('theirs', 5)]);
    expect(actions.conflicts).toEqual([]);
  });

  it('reports a conflict when both copies changed since the last sync', () => {
    const actions = reconcile([plan('p', 5, 'Here')], [plan('p', 4, 'There')], { p: 3 });
    expect(actions.conflicts).toEqual([
      { local: plan('p', 5, 'Here'), remote: plan('p', 4, 'There') },
    ]);
    expect(actions.upload).toEqual([]);
    expect(actions.download).toEqual([]);
  });

  it('uploads new plans and downloads plans made on other devices', () => {
    const actions = reconcile([plan('new-here', 0)], [plan('new-there', 2)], {});
    expect(actions.upload).toEqual([{ plan: plan('new-here', 0), expected: null }]);
    expect(actions.download).toEqual([plan('new-there', 2)]);
  });

  it('passes deletions on, unless the other side kept working on the plan', () => {
    const actions = reconcile(
      [plan('deleted-there', 3), plan('edited-after-delete-there', 4)],
      [plan('deleted-here', 3), plan('edited-after-delete-here', 6)],
      {
        'deleted-there': 3,
        'edited-after-delete-there': 3,
        'deleted-here': 3,
        'edited-after-delete-here': 3,
        'gone-everywhere': 2,
      },
    );
    expect(actions.removeLocal).toEqual(['deleted-there']);
    expect(actions.removeRemote).toEqual(['deleted-here']);
    expect(actions.upload).toEqual([
      { plan: plan('edited-after-delete-there', 4), expected: null },
    ]);
    expect(actions.download).toEqual([plan('edited-after-delete-here', 6)]);
    expect(actions.forget).toEqual(['gone-everywhere']);
  });

  it('adopts identical copies that were never synced from this device', () => {
    const reordered = Object.fromEntries(Object.entries(plan('p', 2)).reverse()) as EventPlan;
    const actions = reconcile([plan('p', 2)], [reordered], {});
    expect(actions.adopt).toEqual([{ id: 'p', revision: 2 }]);
    const differing = reconcile([plan('p', 2, 'Here')], [plan('p', 2, 'There')], {});
    expect(differing.conflicts).toHaveLength(1);
  });

  it('leaves unreadable cloud copies alone instead of treating them as deleted', () => {
    const actions = reconcile([plan('p', 3)], [], { p: 3 }, new Set(['p']));
    expect(actions.removeLocal).toEqual([]);
    expect(actions.upload).toEqual([]);
  });

  it('never drops a changed plan and leaves both sides equal apart from conflicts', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const side = fc.dictionary(fc.constantFrom(...ids), fc.integer({ min: 0, max: 4 }), {
      maxKeys: 4,
    });
    fc.assert(
      fc.property(side, side, side, (localRevs, remoteRevs, base) => {
        const local = Object.entries(localRevs).map(([id, rev]) => plan(id, rev));
        const remote = Object.entries(remoteRevs).map(([id, rev]) => plan(id, rev));
        const actions = reconcile(local, remote, base);
        const after = apply(actions, localRevs, remoteRevs);
        const conflicted = new Set(actions.conflicts.map((conflict) => conflict.local.id));
        for (const id of ids) {
          if (conflicted.has(id)) continue;
          expect(after.local[id]).toBe(after.remote[id]);
          const changedHere = id in localRevs && localRevs[id] !== base[id];
          const changedThere = id in remoteRevs && remoteRevs[id] !== base[id];
          if (changedHere || changedThere) expect(after.local[id]).toBeDefined();
        }
      }),
    );
  });
});

/** Simulates the actions on revision maps (conflicts left untouched). */
function apply(
  actions: SyncActions,
  local: Readonly<Record<string, number>>,
  remote: Readonly<Record<string, number>>,
) {
  const mine = new Map(Object.entries(local));
  const theirs = new Map(Object.entries(remote));
  for (const { plan: uploaded } of actions.upload) theirs.set(uploaded.id, uploaded.revision);
  for (const downloaded of actions.download) mine.set(downloaded.id, downloaded.revision);
  for (const id of actions.removeLocal) mine.delete(id);
  for (const id of actions.removeRemote) theirs.delete(id);
  return { local: Object.fromEntries(mine), remote: Object.fromEntries(theirs) };
}
