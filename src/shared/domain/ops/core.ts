/**
 * What every plan-operation handler shares: the error type, the context, and list helpers that
 * fail loudly on a missing id instead of quietly changing nothing.
 */
import type { PlanOperation } from '../../schemas/operations';
import type { Source } from '../../schemas/primitives';
import type { IdFactory } from '../../utils/ids';

export class OperationError extends Error {
  readonly code: 'not_found' | 'limit' | 'invalid';

  constructor(code: 'not_found' | 'limit' | 'invalid', message: string) {
    super(message);
    this.name = 'OperationError';
    this.code = code;
  }
}

export interface OperationContext {
  /** The user's local date, for re-scheduling. */
  today: string;
  makeId: IdFactory;
  /** Who made the change. Copilot proposals are recorded as `ai`. */
  source?: Source;
}

/** The context handlers receive, with the change's source settled. */
export type ApplyContext = Required<OperationContext>;

/** One operation type's shape, for example `Op<'task.add'>`. */
export type Op<T extends PlanOperation['type']> = Extract<PlanOperation, { type: T }>;

interface WithId {
  id: string;
}

export function findOrThrow<T extends WithId>(list: readonly T[], id: string, what: string): T {
  const item = list.find((entry) => entry.id === id);
  if (!item) throw new OperationError('not_found', `${what} ${id} was not found`);
  return item;
}

export function replaceById<T extends WithId>(
  list: readonly T[],
  id: string,
  what: string,
  update: (item: T) => T,
): T[] {
  findOrThrow(list, id, what);
  return list.map((item) => (item.id === id ? update(item) : item));
}

export function removeById<T extends WithId>(list: readonly T[], id: string, what: string): T[] {
  findOrThrow(list, id, what);
  return list.filter((item) => item.id !== id);
}

export function ensureRoom(current: number, adding: number, limit: number, what: string): void {
  if (current + adding > limit) {
    throw new OperationError('limit', `A plan can hold at most ${String(limit)} ${what}`);
  }
}
