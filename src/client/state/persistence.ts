/**
 * Local-first storage. Plans are saved to localStorage (debounced, and flushed when the page is
 * hidden) and every stored plan is validated with the shared schema when it is read back, so a
 * corrupted or outdated entry can never crash the app. Unreadable data is kept in a backup key
 * instead of being thrown away.
 */
import { EventPlan } from '../../shared/schemas/plan';
import { parseJson } from '../../shared/utils/json';
import { readText, writeText } from '../lib/storage';
import type { PlansStore } from './plans';

export const STORAGE_KEY = 'mehfil:plans';
export const BACKUP_KEY = 'mehfil:plans:backup';
const VERSION = 1;

interface Envelope {
  version: number;
  plans: unknown[];
}

export interface LoadResult {
  plans: EventPlan[];
  /** Entries that failed validation and were skipped. */
  skipped: number;
}

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'plans' in value &&
    Array.isArray((value as { plans: unknown }).plans)
  );
}

export function loadPlans(storage: Storage | null): LoadResult {
  const raw = readText(STORAGE_KEY, storage);
  if (!raw) return { plans: [], skipped: 0 };
  const parsed = parseJson(raw);
  if (!isEnvelope(parsed) || parsed.version > VERSION) {
    // Unknown or damaged data: keep a copy for recovery (if there is room), and start fresh.
    writeText(BACKUP_KEY, raw, storage);
    return { plans: [], skipped: 1 };
  }

  const plans: EventPlan[] = [];
  let skipped = 0;
  for (const entry of parsed.plans) {
    const result = EventPlan.safeParse(entry);
    if (result.success) plans.push(result.data);
    else skipped += 1;
  }
  return { plans, skipped };
}

/** Returns false when the browser refuses to store the data (quota or privacy settings). */
export function savePlans(storage: Storage | null, plans: readonly EventPlan[]): boolean {
  const envelope: Envelope = { version: VERSION, plans: [...plans] };
  return writeText(STORAGE_KEY, JSON.stringify(envelope), storage);
}

export interface PersistenceOptions {
  storage: Storage | null;
  delayMs?: number;
  onSaveFailed?: () => void;
}

/** Keeps storage in step with the store. Returns a function that stops syncing. */
export function connectPersistence(
  store: PlansStore,
  { storage, delayMs = 400, onSaveFailed }: PersistenceOptions,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!dirty) return;
    dirty = false;
    const { plans, order } = store.getState();
    const ordered = order.map((id) => plans[id]).filter((plan) => plan !== undefined);
    if (!savePlans(storage, ordered)) onSaveFailed?.();
  };

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.plans === previous.plans && state.order === previous.order) return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  });

  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);

  return () => {
    flush();
    unsubscribe();
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
  };
}
