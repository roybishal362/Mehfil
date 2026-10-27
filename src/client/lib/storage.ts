/**
 * The one way the app touches localStorage. Private windows, site settings and a full quota can
 * all make storage throw, and the app has to keep working when they do: reads then find nothing,
 * writes report that they failed, and a choice lasts only for the visit.
 */
import { parseJson } from '../../shared/utils/json';

/** localStorage, or null where the browser blocks it or there is no browser (prerendering). */
export function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The text stored under `key`, or null when there is none or storage refuses the read. */
export function readText(key: string, storage = browserStorage()): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** The JSON stored under `key`, or undefined when there is none or it does not parse. */
export function readJson(key: string, storage = browserStorage()): unknown {
  const text = readText(key, storage);
  return text === null ? undefined : parseJson(text);
}

/** Stores `value` under `key`. Returns false when storage is blocked or full. */
export function writeText(key: string, value: string, storage = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Removes `key`. Blocked storage holds nothing to remove, so failure is ignored. */
export function removeKey(key: string, storage = browserStorage()): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Nothing was stored, so there is nothing to clean up.
  }
}
