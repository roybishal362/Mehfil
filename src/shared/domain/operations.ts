/**
 * Applies plan operations. Pure: returns a new plan and never mutates its input, so the UI can
 * keep the previous plan for undo and the Copilot can preview changes before they are applied.
 * Each operation has a small handler in ./ops; this module only routes to it.
 */
import type { PlanOperation } from '../schemas/operations';
import type { EventPlan } from '../schemas/plan';
import { updateBrief } from './ops/brief';
import {
  addBudgetLine,
  removeBudgetLine,
  setBudgetTotal,
  setGuestCount,
  updateBudgetLine,
} from './ops/budget';
import type { ApplyContext, OperationContext } from './ops/core';
import {
  addGuest,
  addIdea,
  addScheduleItem,
  importGuests,
  removeGuest,
  removeIdea,
  removeRisk,
  removeScheduleItem,
  updateGuest,
  updateIdea,
  updateScheduleItem,
} from './ops/lists';
import { addTask, removeTask, updateTask } from './ops/tasks';
import {
  addVendor,
  addVendorOption,
  removeVendor,
  removeVendorOption,
  updateVendor,
  updateVendorOption,
} from './ops/vendors';

export { OperationError, type OperationContext } from './ops/core';

/** Applies one operation and returns the new plan. Throws `OperationError` on bad references. */
export function applyOperation(
  plan: EventPlan,
  op: PlanOperation,
  context: OperationContext,
): EventPlan {
  const ctx: ApplyContext = { ...context, source: context.source ?? 'user' };
  switch (op.type) {
    case 'brief.update':
      return updateBrief(plan, op, ctx);
    case 'task.add':
      return addTask(plan, op, ctx);
    case 'task.update':
      return updateTask(plan, op);
    case 'task.remove':
      return removeTask(plan, op);
    case 'budget.setTotal':
      return setBudgetTotal(plan, op);
    case 'budget.updateLine':
      return updateBudgetLine(plan, op, ctx);
    case 'budget.addLine':
      return addBudgetLine(plan, op, ctx);
    case 'budget.removeLine':
      return removeBudgetLine(plan, op);
    case 'guests.setCount':
      return setGuestCount(plan, op);
    case 'vendor.update':
      return updateVendor(plan, op);
    case 'vendor.add':
      return addVendor(plan, op, ctx);
    case 'vendor.remove':
      return removeVendor(plan, op);
    case 'vendor.addOption':
      return addVendorOption(plan, op, ctx);
    case 'vendor.updateOption':
      return updateVendorOption(plan, op);
    case 'vendor.removeOption':
      return removeVendorOption(plan, op);
    case 'idea.add':
      return addIdea(plan, op, ctx);
    case 'idea.update':
      return updateIdea(plan, op);
    case 'idea.remove':
      return removeIdea(plan, op);
    case 'guest.add':
      return addGuest(plan, op, ctx);
    case 'guest.update':
      return updateGuest(plan, op);
    case 'guest.remove':
      return removeGuest(plan, op);
    case 'guests.import':
      return importGuests(plan, op, ctx);
    case 'schedule.add':
      return addScheduleItem(plan, op, ctx);
    case 'schedule.update':
      return updateScheduleItem(plan, op);
    case 'schedule.remove':
      return removeScheduleItem(plan, op);
    case 'risk.remove':
      return removeRisk(plan, op);
  }
}

/** Applies operations in order. If any fails, nothing is applied (the error propagates). */
export function applyOperations(
  plan: EventPlan,
  ops: readonly PlanOperation[],
  ctx: OperationContext,
): EventPlan {
  return ops.reduce((current, op) => applyOperation(current, op, ctx), plan);
}
