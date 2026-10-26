/**
 * Two-way sync between this device's plans and the account's plans in Firestore.
 *
 * Every plan carries a revision that goes up with each change. For each plan, this device
 * remembers the revision it last synced (its base). Comparing both copies with the base shows
 * which side changed: one side → copy it to the other; both → a conflict the user settles; a
 * plan that was synced before and is now missing on one side was deleted there. Work is never
 * dropped silently: a plan edited on one side after being deleted on the other is kept.
 */
import type { EventPlan } from '../../shared/schemas/plan';

/** The revision of each plan as last synced from this device, by plan ID. */
export type SyncBase = Readonly<Record<string, number>>;

export interface SyncConflict {
  local: EventPlan;
  remote: EventPlan;
}

export interface SyncActions {
  /** Plans to save to the cloud, with the revision the cloud copy must still have. */
  upload: { plan: EventPlan; expected: number | null }[];
  /** Cloud copies to store on this device. */
  download: EventPlan[];
  /** Plans that were deleted on another device. */
  removeLocal: string[];
  /** Plans that were deleted on this device. */
  removeRemote: string[];
  /** Identical copies on both sides that only need their base recorded. */
  adopt: { id: string; revision: number }[];
  /** Plans gone from both sides: their base can be dropped. */
  forget: string[];
  conflicts: SyncConflict[];
}

/** JSON with object keys sorted, so equal plans compare equal whatever their key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, field: unknown) =>
    field && typeof field === 'object' && !Array.isArray(field)
      ? Object.fromEntries(Object.entries(field).sort(([a], [b]) => a.localeCompare(b)))
      : field,
  );
}

/** Both copies exist: copy whichever side changed since the last sync, or ask if both did. */
function reconcileBoth(
  actions: SyncActions,
  here: EventPlan,
  there: EventPlan,
  synced: number | undefined,
): void {
  if (synced === undefined) {
    // On both sides but never synced from here (for example, after site data was cleared).
    const same = here.revision === there.revision && canonical(here) === canonical(there);
    if (same) actions.adopt.push({ id: here.id, revision: there.revision });
    else actions.conflicts.push({ local: here, remote: there });
    return;
  }
  const changedHere = here.revision !== synced;
  const changedThere = there.revision !== synced;
  if (changedHere && changedThere) actions.conflicts.push({ local: here, remote: there });
  else if (changedHere) actions.upload.push({ plan: here, expected: synced });
  else if (changedThere) actions.download.push(there);
}

/** Only this device has it: new here, edited here after a deletion elsewhere, or deleted there. */
function reconcileHere(actions: SyncActions, here: EventPlan, synced: number | undefined): void {
  if (synced === undefined || here.revision !== synced) {
    actions.upload.push({ plan: here, expected: null });
  } else {
    actions.removeLocal.push(here.id);
  }
}

/** Only the cloud has it: new elsewhere, edited there after a deletion here, or deleted here. */
function reconcileThere(actions: SyncActions, there: EventPlan, synced: number | undefined): void {
  if (synced === undefined || there.revision !== synced) actions.download.push(there);
  else actions.removeRemote.push(there.id);
}

/**
 * Works out what to copy, delete or ask about. `unreadable` lists cloud plans that failed
 * validation: they are left alone rather than treated as deleted.
 */
export function reconcile(
  local: readonly EventPlan[],
  remote: readonly EventPlan[],
  base: SyncBase,
  unreadable: ReadonlySet<string> = new Set(),
): SyncActions {
  const actions: SyncActions = {
    upload: [],
    download: [],
    removeLocal: [],
    removeRemote: [],
    adopt: [],
    forget: [],
    conflicts: [],
  };
  const mine = new Map(local.map((plan) => [plan.id, plan]));
  const theirs = new Map(remote.map((plan) => [plan.id, plan]));
  const ids = new Set([...mine.keys(), ...theirs.keys(), ...Object.keys(base)]);
  for (const id of [...ids].filter((planId) => !unreadable.has(planId))) {
    const here = mine.get(id);
    const there = theirs.get(id);
    if (here && there) reconcileBoth(actions, here, there, base[id]);
    else if (here) reconcileHere(actions, here, base[id]);
    else if (there) reconcileThere(actions, there, base[id]);
    else actions.forget.push(id);
  }
  return actions;
}
