/** Who is signed in to the cloud features and how sync is doing (read by the account UI). */
import { create } from 'zustand';
import type { SyncSnapshot } from './sync';
import type { CloudUser } from './types';

export interface CloudState {
  user: CloudUser | null;
  sync: SyncSnapshot;
  /** An account action in progress; its button shows it and the others wait. */
  busy: 'signin' | 'signout' | 'delete' | null;
  /** The user chose "Decide later" for the current conflicts. */
  conflictsDeferred: boolean;
}

export const IDLE_SYNC: SyncSnapshot = { status: 'idle', lastSyncedAt: null, conflicts: [] };

export const useCloud = create<CloudState>()(() => ({
  user: null,
  sync: IDLE_SYNC,
  busy: null,
  conflictsDeferred: false,
}));

const conflictIds = (sync: SyncSnapshot) =>
  sync.conflicts
    .map((conflict) => conflict.local.id)
    .sort()
    .join();

/** Stores a sync update; a different set of conflicts asks the user again. */
export function setSync(sync: SyncSnapshot): void {
  const changed = conflictIds(sync) !== conflictIds(useCloud.getState().sync);
  useCloud.setState(changed ? { sync, conflictsDeferred: false } : { sync });
}
