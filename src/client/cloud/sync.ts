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
import { reconcile, type SyncActions, type SyncConflict } from './reconcile';
import type { CloudBackend } from './types';

type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

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
  private readonly unsubscribe: () => void;

  constructor(options: Required<SyncOptions>) {
    this.options = options;
    this.key = baseKey(options.uid);
    this.base = new Map(Object.entries(readBase(options.storage, this.key)));
    this.unsubscribe = options.store.subscribe((state, previous) => {
      if (state.plans !== previous.plans || state.order !== previous.order) this.schedulePush();
    });
    window.addEventListener('online', this.onOnline);
    document.addEventListener('visibilitychange', this.onVisible);
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
    this.options.store.getState().putPlans(this.settledPlans(local, remote, choice, copyTitle));
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
    this.unsubscribe();
    window.removeEventListener('online', this.onOnline);
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  private readonly onOnline = () => void this.enqueue(() => this.push());

  private readonly onVisible = () => {
    const due = Date.now() - this.lastPull > this.options.pullIntervalMs;
    if (document.visibilityState === 'visible' && due) void this.enqueue(() => this.pull());
  };

  /** What to store for a settled conflict: one side, a newer copy of ours, or both plans. */
  private settledPlans(
    local: EventPlan,
    remote: EventPlan,
    choice: ConflictChoice,
    copyTitle: string,
  ): EventPlan[] {
    const at = this.options.now().toISOString();
    if (choice === 'remote') return [remote];
    if (choice === 'local') {
      return [{ ...local, revision: Math.max(local.revision, remote.revision) + 1, updatedAt: at }];
    }
    const copy: EventPlan = {
      ...local,
      id: createId('evt'),
      brief: { ...local.brief, title: copyTitle },
      revision: 0,
      createdAt: at,
      updatedAt: at,
    };
    return [remote, copy];
  }

  private update(patch: Partial<SyncSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.options.onChange(this.snapshot);
  }

  private saveBase(): void {
    try {
      this.options.storage?.setItem(this.key, JSON.stringify(Object.fromEntries(this.base)));
    } catch {
      // Without storage the next sync compares more, but nothing is lost.
    }
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
    this.lastPull = Date.now();
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
  ...options
}: SyncOptions): SyncEngine {
  return new SyncSession({ ...options, now, delayMs, pullIntervalMs });
}
