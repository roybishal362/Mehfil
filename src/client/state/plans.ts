/**
 * All plans on this device, with undo and redo per plan.
 *
 * Every user edit is a typed PlanOperation applied by the shared, pure `applyOperations`, the
 * same function the Copilot's proposals go through, so there is exactly one way to change a
 * plan. AI section merges use `transform` and are not undoable steps of their own.
 */
import { createStore, useStore } from 'zustand';
import { OperationError, applyOperations } from '../../shared/domain/operations';
import { PlanOperation, type PlanOperationInput } from '../../shared/schemas/operations';
import type { EventPlan } from '../../shared/schemas/plan';
import type { Source } from '../../shared/schemas/primitives';
import { localToday } from '../../shared/utils/dates';
import { omitKey } from '../../shared/utils/collections';
import { createId } from '../../shared/utils/ids';

/** How many undo steps each plan keeps. */
export const HISTORY_LIMIT = 50;

interface History {
  past: EventPlan[];
  future: EventPlan[];
}

export type ApplyResult =
  | { ok: true; plan: EventPlan }
  | { ok: false; code: 'not_found' | 'limit' | 'invalid' | 'unknown_plan'; message: string };

export interface PlansState {
  plans: Readonly<Record<string, EventPlan>>;
  /** Plan ids, most recently created first. */
  order: readonly string[];
  history: Readonly<Record<string, History>>;
  /** Replaces everything (used once, when plans are loaded from storage). */
  hydrate: (plans: readonly EventPlan[]) => void;
  addPlan: (plan: EventPlan) => void;
  removePlan: (id: string) => EventPlan | undefined;
  /** Puts back a deleted plan (for "Undo" after a delete). */
  restorePlan: (plan: EventPlan) => void;
  /** Stores plans exactly as given (from another device): no new revision, no undo history. */
  putPlans: (plans: readonly EventPlan[]) => void;
  /** Validates and applies edits as one undoable step. */
  apply: (id: string, operations: readonly PlanOperationInput[], source?: Source) => ApplyResult;
  /** Replaces a plan with a computed version (AI merges). `undoable` records it in history. */
  transform: (
    id: string,
    update: (plan: EventPlan) => EventPlan,
    options?: { undoable?: boolean },
  ) => void;
  undo: (id: string) => boolean;
  redo: (id: string) => boolean;
}

export interface PlansStoreOptions {
  now?: () => Date;
}

/**
 * Marks `next` as the plan that replaces `current`: the next revision and a fresh timestamp.
 * Revisions only ever go up (an undo is a new revision too), which is what sync relies on to
 * tell a changed plan from an unchanged one.
 */
function touch(next: EventPlan, current: EventPlan, now: Date): EventPlan {
  return { ...next, revision: current.revision + 1, updatedAt: now.toISOString() };
}

export function createPlansStore({ now = () => new Date() }: PlansStoreOptions = {}) {
  return createStore<PlansState>()((set, get) => ({
    plans: {},
    order: [],
    history: {},

    hydrate: (plans) => {
      const sorted = [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      set({
        plans: Object.fromEntries(sorted.map((plan) => [plan.id, plan])),
        order: sorted.map((plan) => plan.id),
        history: {},
      });
    },

    addPlan: (plan) => {
      set((state) => ({
        plans: { ...state.plans, [plan.id]: plan },
        order: [plan.id, ...state.order.filter((id) => id !== plan.id)],
      }));
    },

    removePlan: (id) => {
      const plan = get().plans[id];
      if (!plan) return undefined;
      set((state) => ({
        plans: omitKey(state.plans, id),
        history: omitKey(state.history, id),
        order: state.order.filter((other) => other !== id),
      }));
      return plan;
    },

    restorePlan: (plan) => {
      get().hydrate([...Object.values(get().plans), plan]);
    },

    putPlans: (incoming) => {
      if (incoming.length === 0) return;
      set((state) => {
        const plans = { ...state.plans };
        let history = state.history;
        for (const plan of incoming) {
          plans[plan.id] = plan;
          history = omitKey(history, plan.id);
        }
        const order = Object.values(plans)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((plan) => plan.id);
        return { plans, order, history };
      });
    },

    apply: (id, operations, source = 'user') => {
      const plan = get().plans[id];
      if (!plan) return { ok: false, code: 'unknown_plan', message: `Plan ${id} was not found` };
      const parsed = PlanOperation.array().safeParse(operations);
      if (!parsed.success) {
        return { ok: false, code: 'invalid', message: 'That change does not fit this plan' };
      }
      try {
        const next = touch(
          applyOperations(plan, parsed.data, {
            today: localToday(now()),
            makeId: createId,
            source,
          }),
          plan,
          now(),
        );
        set((state) => {
          const past = [...(state.history[id]?.past ?? []), plan].slice(-HISTORY_LIMIT);
          return {
            plans: { ...state.plans, [id]: next },
            history: { ...state.history, [id]: { past, future: [] } },
          };
        });
        return { ok: true, plan: next };
      } catch (error) {
        if (error instanceof OperationError) {
          return { ok: false, code: error.code, message: error.message };
        }
        // A schema failure means the edit would have produced an invalid plan: refuse it.
        return { ok: false, code: 'invalid', message: 'That change does not fit this plan' };
      }
    },

    transform: (id, update, { undoable = false } = {}) => {
      const plan = get().plans[id];
      if (!plan) return;
      const next = touch(update(plan), plan, now());
      set((state) => ({
        plans: { ...state.plans, [id]: next },
        ...(undoable
          ? {
              history: {
                ...state.history,
                [id]: {
                  past: [...(state.history[id]?.past ?? []), plan].slice(-HISTORY_LIMIT),
                  future: [],
                },
              },
            }
          : {}),
      }));
    },

    undo: (id) => {
      const { plans, history } = get();
      const plan = plans[id];
      const previous = history[id]?.past.at(-1);
      if (!plan || !previous) return false;
      set((state) => ({
        plans: { ...state.plans, [id]: touch(previous, plan, now()) },
        history: {
          ...state.history,
          [id]: {
            past: state.history[id]?.past.slice(0, -1) ?? [],
            future: [plan, ...(state.history[id]?.future ?? [])].slice(0, HISTORY_LIMIT),
          },
        },
      }));
      return true;
    },

    redo: (id) => {
      const { plans, history } = get();
      const plan = plans[id];
      const following = history[id]?.future[0];
      if (!plan || !following) return false;
      set((state) => ({
        plans: { ...state.plans, [id]: touch(following, plan, now()) },
        history: {
          ...state.history,
          [id]: {
            past: [...(state.history[id]?.past ?? []), plan].slice(-HISTORY_LIMIT),
            future: state.history[id]?.future.slice(1) ?? [],
          },
        },
      }));
      return true;
    },
  }));
}

export type PlansStore = ReturnType<typeof createPlansStore>;

/** The app's single plans store. */
export const plansStore = createPlansStore();

export function usePlans<T>(selector: (state: PlansState) => T): T {
  return useStore(plansStore, selector);
}

export function usePlan(id: string | undefined): EventPlan | undefined {
  return usePlans((state) => (id ? state.plans[id] : undefined));
}
