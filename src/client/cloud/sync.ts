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
import { parseJson } from '../../shared/utils/json';
import { readJson, writeText } from '../lib/storage';
import type { PlansStore } from '../state/plans';
import { browserTriggers, isOffline, type WatchForSync } from './sync-browser';
import {
  reconcile,
  settleConflict,
  type ConflictChoice,
  type SyncActions,
  type SyncConflict,
} from './reconcile';
import type { CloudBackend } from './types';

export type { ConflictChoice } from './reconcile';

type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncSnapshot {
  status: SyncStatus;
  lastSyncedAt: string | null;
  conflicts: readonly SyncConflict[];
}

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
  /** Tells the engine when a sync is due; by default, store edits and browser events. */
  watch?: WatchForSync;
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

/** The base saved on an earlier visit; anything that is not a revision is dropped. */
function loadBase(storage: Storage | null, key: string): Map<string, number> {
  const stored = readJson(key, storage);
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return new Map();
  return new Map(
    Object.entries(stored).filter(
      (entry): entry is [string, number] => Number.isInteger(entry[1]) && entry[1] >= 0,
    ),
  );
}

function parsePlan(json: string): EventPlan | null {
  const result = EventPlan.safeParse(parseJson(json));
  return result.success ? result.data : null;
}

/** One signed-in device's sync session. Work runs one task at a time, in order. */
class SyncSession implements SyncEngine {
  private readonly options: Required<SyncOptions>;
  private readonly key: string;
  /** The revision of each plan as last synced from this device. */
  private readonly base: Map<string, number>;
  private snapshot: SyncSnapshot = { status: 'idle', lastSyncedAt: null, conflicts: [] };
  private queue: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastPull = 0;
  private stopped = false;
  private readonly unwatch: () => void;

  constructor(options: Required<SyncOptions>) {
    this.options = options;
    this.key = baseKey(options.uid);
    this.base = loadBase(options.storage, this.key);
    this.unwatch = options.watch({
      edited: () => {
        this.schedulePush();
      },
      online: () => void this.enqueue(() => this.push()),
      visible: () => {
        const due = this.options.now().getTime() - this.lastPull > this.options.pullIntervalMs;
        if (due) void this.enqueue(() => this.pull());
      },
    });
  }

  syncNow(): Promise<void> {
    return this.enqueue(() => this.pull());
  }

  async resolve(id: string, choice: ConflictChoice, copyTitle: string): Promise<void> {
    const conflict = this.snapshot.conflicts.find((c) => c.local.id === id);
    if (!conflict) return;
    this.update({ conflicts: this.snapshot.conflicts.filter((c) => c !== conflict) });
    const { remote } = conflict;
    const local = this.options.store.getState().plans[id] ?? conflict.local;
    // The cloud copy is now the agreed starting point; what follows is pushed on top of it.
    this.base.set(id, remote.revision);
    this.saveBase();
    const at = this.options.now().toISOString();
    const copyId = createId('evt');
    const settled = settleConflict({ local, remote, choice, copyTitle, copyId, at });
    this.options.store.getState().putPlans(settled);
    await this.enqueue(() => this.push());
  }

  async settle(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
      void this.enqueue(() => this.push());
    }
    await this.queue;
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.unwatch();
  }

  private update(patch: Partial<SyncSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.options.onChange(this.snapshot);
  }

  private saveBase(): void {
    // Without storage the next sync compares more, but nothing is lost.
    writeText(this.key, JSON.stringify(Object.fromEntries(this.base)), this.options.storage);
  }

  private inConflict(id: string): boolean {
    return this.snapshot.conflicts.some((c) => c.local.id === id);
  }

  /** Queues a task. It returns false when it had nothing to do (the status stays as it is). */
  private enqueue(task: () => Promise<boolean>): Promise<void> {
    this.queue = this.queue.then(async () => {
      if (this.stopped) return;
      try {
        if (await task())
          this.update({ status: 'idle', lastSyncedAt: this.options.now().toISOString() });
      } catch (error) {
        this.update({ status: isOffline(error) ? 'offline' : 'error' });
      }
    });
    return this.queue;
  }

  private schedulePush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.enqueue(() => this.push());
    }, this.options.delayMs);
  }

  /** The cloud's plans, and the ids of any that fail validation (left alone, not deleted). */
  private async readRemote(): Promise<{ remote: EventPlan[]; unreadable: Set<string> }> {
    const remote: EventPlan[] = [];
    const unreadable = new Set<string>();
    for (const doc of await this.options.backend.listPlans(this.options.uid)) {
      const plan = parsePlan(doc.json);
      if (plan?.id === doc.id) remote.push({ ...plan, revision: doc.revision });
      else unreadable.add(doc.id);
    }
    return { remote, unreadable };
  }

  /** A full sync: compare both sides with the base, then copy, delete or ask. */
  private async pull(): Promise<boolean> {
    this.lastPull = this.options.now().getTime();
    this.update({ status: 'syncing' });
    const { remote, unreadable } = await this.readRemote();
    const { plans, order } = this.options.store.getState();
    const local = order.map((id) => plans[id]).filter((plan) => plan !== undefined);
    const actions = reconcile(local, remote, Object.fromEntries(this.base), unreadable);
    this.applyHere(actions);
    await this.applyThere(actions);
    return true;
  }

  private applyHere(actions: SyncActions): void {
    // Record the base before storing downloads, so they are not pushed straight back.
    for (const plan of actions.download) this.base.set(plan.id, plan.revision);
    for (const { id, revision } of actions.adopt) this.base.set(id, revision);
    for (const id of [...actions.removeLocal, ...actions.forget]) this.base.delete(id);
    this.saveBase();
    const state = this.options.store.getState();
    state.putPlans(actions.download);
    for (const id of actions.removeLocal) state.removePlan(id);
    this.update({ conflicts: actions.conflicts });
  }

  private async applyThere(actions: SyncActions): Promise<void> {
    const { backend, uid } = this.options;
    for (const { plan, expected } of actions.upload) {
      if ((await backend.savePlan(uid, plan, expected)) === 'saved') {
        this.base.set(plan.id, plan.revision);
      }
    }
    for (const id of actions.removeRemote) {
      const expected = this.base.get(id);
      if (expected !== undefined && (await backend.deletePlan(uid, id, expected)) === 'saved') {
        this.base.delete(id);
      }
    }
    this.saveBase();
  }

  /** Sends what changed here since the last sync; any refusal turns into a full sync. */
  private async push(): Promise<boolean> {
    const { plans } = this.options.store.getState();
    const changed = Object.values(plans).filter(
      (plan) => this.base.get(plan.id) !== plan.revision && !this.inConflict(plan.id),
    );
    const deleted = [...this.base].filter(([id]) => !plans[id]);
    // Nothing to send; still report back if an earlier attempt had failed.
    if (changed.length === 0 && deleted.length === 0) return this.snapshot.status !== 'idle';
    this.update({ status: 'syncing' });
    const saved = await this.sendChanged(changed);
    const removed = await this.sendDeleted(deleted);
    // Someone else changed a plan first: a full sync shows what happened.
    if (!saved || !removed) await this.pull();
    return true;
  }

  /** Saves each changed plan; false if the cloud refused any (it had a newer copy). */
  private async sendChanged(changed: readonly EventPlan[]): Promise<boolean> {
    let accepted = true;
    for (const plan of changed) {
      const expected = this.base.get(plan.id) ?? null;
      if ((await this.options.backend.savePlan(this.options.uid, plan, expected)) === 'saved') {
        this.base.set(plan.id, plan.revision);
        this.saveBase();
      } else {
        accepted = false;
      }
    }
    return accepted;
  }

  /** Deletes plans removed here; false if the cloud refused any (it had changed since). */
  private async sendDeleted(deleted: readonly [string, number][]): Promise<boolean> {
    let accepted = true;
    for (const [id, synced] of deleted) {
      if ((await this.options.backend.deletePlan(this.options.uid, id, synced)) === 'saved') {
        this.base.delete(id);
        this.saveBase();
      } else {
        accepted = false;
      }
    }
    return accepted;
  }
}

export function startSync({
  now = () => new Date(),
  delayMs = 1500,
  pullIntervalMs = 30_000,
  watch,
  ...options
}: SyncOptions): SyncEngine {
  return new SyncSession({
    ...options,
    now,
    delayMs,
    pullIntervalMs,
    watch: watch ?? browserTriggers(options.store),
  });
}
