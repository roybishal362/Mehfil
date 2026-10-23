/**
 * index.html carries a build-time copy of the home page (scripts/prerender.ts), which React
 * hydrates. Parts that can only render in the browser wait for this hook to turn true.
 */
import { useSyncExternalStore } from 'react';

const noSubscription = () => () => undefined;

/**
 * False on the server and while React hydrates the prerendered page, true afterwards (React
 * re-renders once hydration is done). Always true for pages rendered only in the browser.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}
