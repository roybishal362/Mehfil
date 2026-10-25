/**
 * Whether the page has finished loading and the browser has had a quiet moment (main.tsx marks
 * it, together with starting the decorative motion). Decorative pictures can wait for it, so
 * they never compete with the text and fonts of the first screen.
 */
import { useSyncExternalStore } from 'react';

let loaded = false;
const listeners = new Set<() => void>();

export function markLoaded(): void {
  if (loaded) return;
  loaded = true;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** False on the server and until the page has loaded; true after. */
export function useAfterLoad(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => loaded,
    () => false,
  );
}
