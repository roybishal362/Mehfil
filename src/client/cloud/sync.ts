/**
 * Keeps a Google account's plans in step across devices (the rules are in reconcile.ts).
 *
 * Saving on this device never waits for the network. A moment after each change the changed
 * plans are pushed, each in a transaction that only succeeds if the cloud copy is still the one
 * this device last saw; anything else becomes a full sync, which also brings in changes made on
 * other devices (on start, when the tab comes back into view, and on request). Work done offline
 * is simply "not yet synced" and goes up when the connection returns.
 */
import { EventPlan } from '../../shared/schemas/plan';
import { createId } from '../../shared/utils/ids';
import type { PlansStore } from '../state/plans';
import { reconcile, type SyncConflict } from './reconcile';
import type { CloudBackend } from './types';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncSnapshot {
  status: SyncStatus;
  lastSyncedAt: string | null;
  conflicts: readonly SyncConflict[];
}

export type ConflictChoice = 'local' | 'remote' | 'both';

export interface SyncOptions {
  backend: CloudBackend;
  store: PlansStore;
  uid: string;
  storage: Storage | null;
  onChange: (snapshot: SyncSnapshot) => void;
  now?: () => Date;
  /** Quiet time after the last edit before pushing. */
  delayMs?: number;
  /** A tab coming back into view pulls at most this often. */
  pullIntervalMs?: number;
}

export interface SyncEngine {
  /** Pulls, reconciles and pushes everything. */
  syncNow(): Promise<void>;
  /** Settles a conflict; `copyTitle` names the extra plan when keeping both. */
  resolve(id: string, choice: ConflictChoice, copyTitle: string): Promise<void>;
  /** Waits for queued work (used by tests and before signing out). */
  settle(): Promise<void>;
  stop(): void;
}

export const baseKey = (uid: string) => `mehfil:sync:${uid}`;

function readBase(storage: Storage | null, key: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(key) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => Number.isInteger(entry[1]) && entry[1] >= 0,
      ),
    );
  } catch {
    return {};
  }
}

function parsePlan(json: string): EventPlan | null {
  try {
    const result = EventPlan.safeParse(JSON.parse(json));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Network failures (offline, server unreachable) as opposed to real errors. */
function isOffline(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'unavailable' || error.code === 'deadline-exceeded')
  );
}

export function startSync({
  backend,
  store,
  uid,
  storage,
  onChange,
  now = () => new Date(),
  delayMs = 1500,
  pullIntervalMs = 30_000,
}: SyncOptions): SyncEngine {
  const key = baseKey(uid);
  const base = new Map(Object.entries(readBase(storage, key)));
  let snapshot: SyncSnapshot = { status: 'idle', lastSyncedAt: null, conflicts: [] };
  let queue: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastPull = 0;
  let stopped = false;

  const update = (patch: Partial<SyncSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    onChange(snapshot);
  };
  const saveBase = () => {
    try {
      storage?.setItem(key, JSON.stringify(Object.fromEntries(base)));
    } catch {
      // Without storage the next sync compares more, but nothing is lost.
    }
  };
  const inConflict = (id: string) => snapshot.conflicts.some((c) => c.local.id === id);
  /** Runs tasks one at a time, in order. A task returns false when it had nothing to do. */
  const enqueue = (task: () => Promise<boolean>): Promise<void> => {
    queue = queue.then(async () => {
      if (stopped) return;
      try {
        if (await task()) update({ status: 'idle', lastSyncedAt: now().toISOString() });
      } catch (error) {
        update({ status: isOffline(error) ? 'offline' : 'error' });
      }
    });
    return queue;
  };

  async function pull(): Promise<boolean> {
    lastPull = Date.now();
    update({ status: 'syncing' });
    const remote: EventPlan[] = [];
    const unreadable = new Set<string>();
    for (const doc of await backend.listPlans(uid)) {
      const plan = parsePlan(doc.json);
      if (plan?.id === doc.id) remote.push({ ...plan, revision: doc.revision });
      else unreadable.add(doc.id);
    }
    const { plans, order } = store.getState();
    const local = order.map((id) => plans[id]).filter((plan) => plan !== undefined);
    const actions = reconcile(local, remote, Object.fromEntries(base), unreadable);

    // Record the base before storing downloads, so they are not pushed straight back.
    for (const plan of actions.download) base.set(plan.id, plan.revision);
    for (const { id, revision } of actions.adopt) base.set(id, revision);
    for (const id of [...actions.removeLocal, ...actions.forget]) base.delete(id);
    saveBase();
    store.getState().putPlans(actions.download);
    for (const id of actions.removeLocal) store.getState().removePlan(id);
    update({ conflicts: actions.conflicts });

    for (const { plan, expected } of actions.upload) {
      if ((await backend.savePlan(uid, plan, expected)) === 'saved') {
        base.set(plan.id, plan.revision);
      }
    }
    for (const id of actions.removeRemote) {
      const expected = base.get(id);
      if (expected !== undefined && (await backend.deletePlan(uid, id, expected)) === 'saved') {
        base.delete(id);
      }
    }
    saveBase();
    return true;
  }

  async function push(): Promise<boolean> {
    const { plans } = store.getState();
    const changed = Object.values(plans).filter(
      (plan) => base.get(plan.id) !== plan.revision && !inConflict(plan.id),
    );
    const deleted = [...base].filter(([id]) => !plans[id]);
    // Nothing to send; still report back if an earlier attempt had failed.
    if (changed.length === 0 && deleted.length === 0) return snapshot.status !== 'idle';
    update({ status: 'syncing' });
    let stale = false;
    for (const plan of changed) {
      if ((await backend.savePlan(uid, plan, base.get(plan.id) ?? null)) === 'saved') {
        base.set(plan.id, plan.revision);
        saveBase();
      } else {
        stale = true;
      }
    }
    for (const [id, synced] of deleted) {
      if ((await backend.deletePlan(uid, id, synced)) === 'saved') {
        base.delete(id);
        saveBase();
      } else {
        stale = true;
      }
    }
    // Someone else changed a plan first: a full sync shows what happened.
    if (stale) await pull();
    return true;
  }

  const schedulePush = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void enqueue(push);
    }, delayMs);
  };

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.plans !== previous.plans || state.order !== previous.order) schedulePush();
  });
  const onOnline = () => void enqueue(push);
  const onVisible = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastPull > pullIntervalMs) {
      void enqueue(pull);
    }
  };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);

  return {
    syncNow: () => enqueue(pull),

    resolve: async (id, choice, copyTitle) => {
      const conflict = snapshot.conflicts.find((c) => c.local.id === id);
      if (!conflict) return;
      update({ conflicts: snapshot.conflicts.filter((c) => c !== conflict) });
      const { remote } = conflict;
      const local = store.getState().plans[id] ?? conflict.local;
      // The cloud copy is now the agreed starting point; what follows is pushed on top of it.
      base.set(id, remote.revision);
      saveBase();
      if (choice === 'remote') {
        store.getState().putPlans([remote]);
      } else if (choice === 'local') {
        const revision = Math.max(local.revision, remote.revision) + 1;
        store.getState().putPlans([{ ...local, revision, updatedAt: now().toISOString() }]);
      } else {
        const copy: EventPlan = {
          ...local,
          id: createId('evt'),
          brief: { ...local.brief, title: copyTitle },
          revision: 0,
          createdAt: now().toISOString(),
          updatedAt: now().toISOString(),
        };
        store.getState().putPlans([remote, copy]);
      }
      await enqueue(push);
    },

    settle: async () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
        void enqueue(push);
      }
      await queue;
    },

    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    },
  };
}
