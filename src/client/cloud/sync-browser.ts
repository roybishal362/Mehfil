/**
 * What the sync engine (sync.ts) needs from the browser: the moments a sync is due, and whether
 * a failure only means the device is offline. Keeping these apart leaves the engine itself free
 * of window and document, so it can be driven directly in tests.
 */
import type { PlansStore } from '../state/plans';

export interface SyncTriggers {
  /** Plans changed on this device. */
  edited: () => void;
  /** The network came back. */
  online: () => void;
  /** The tab came back into view. */
  visible: () => void;
}

/** Starts listening for the moments a sync is due; returns a function that stops. */
export type WatchForSync = (on: SyncTriggers) => () => void;

/** Edits in the plans store, and the browser's online and visibility events. */
export function browserTriggers(store: PlansStore): WatchForSync {
  return (on) => {
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.plans !== previous.plans || state.order !== previous.order) on.edited();
    });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') on.visible();
    };
    window.addEventListener('online', on.online);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      window.removeEventListener('online', on.online);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  };
}

/** Network failures (offline, server unreachable) as opposed to real errors. */
export function isOffline(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'unavailable' || error.code === 'deadline-exceeded')
  );
}
