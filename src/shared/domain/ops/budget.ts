/**
 * Budget operations. A new total rebalances the lines; a new guest count scales the per-guest
 * lines. Either way the brief's budget follows, so the header and Gemini see the same number.
 */
import { MIN_BUDGET } from '../../schemas/brief';
import { LIMITS, type EventPlan } from '../../schemas/plan';
import { rebalanceLines, scaleForGuests } from '../budget';
import { ensureRoom, removeById, replaceById, type ApplyContext, type Op } from './core';

export function setBudgetTotal(plan: EventPlan, op: Op<'budget.setTotal'>): EventPlan {
  return {
    ...plan,
    brief: { ...plan.brief, budget: op.total },
    budget: {
      ...plan.budget,
      total: op.total,
      lines: rebalanceLines(plan.budget.lines, op.total, op.protectIds),
    },
  };
}

export function updateBudgetLine(
  plan: EventPlan,
  op: Op<'budget.updateLine'>,
  ctx: ApplyContext,
): EventPlan {
  const lines = replaceById(plan.budget.lines, op.id, 'Budget line', (line) => {
    // A new planned amount now belongs to whoever set it (the user, or the Copilot).
    const replanned = op.patch.planned !== undefined && op.patch.planned !== line.planned;
    return { ...line, ...op.patch, ...(replanned ? { source: ctx.source } : {}) };
  });
  return { ...plan, budget: { ...plan.budget, lines } };
}

export function addBudgetLine(
  plan: EventPlan,
  op: Op<'budget.addLine'>,
  ctx: ApplyContext,
): EventPlan {
  ensureRoom(plan.budget.lines.length, 1, LIMITS.budgetLines, 'budget lines');
  const line = {
    id: ctx.makeId('line'),
    category: 'custom' as const,
    label: op.line.label,
    planned: op.line.planned,
    spent: 0,
    paid: 0,
    perGuest: false,
    source: ctx.source,
  };
  return { ...plan, budget: { ...plan.budget, lines: [...plan.budget.lines, line] } };
}

export function removeBudgetLine(plan: EventPlan, op: Op<'budget.removeLine'>): EventPlan {
  const lines = removeById(plan.budget.lines, op.id, 'Budget line');
  return { ...plan, budget: { ...plan.budget, lines } };
}

export function setGuestCount(plan: EventPlan, op: Op<'guests.setCount'>): EventPlan {
  const budget = scaleForGuests(plan.budget, plan.brief.guestCount, op.guestCount, op.keepBudget);
  return {
    ...plan,
    brief: {
      ...plan.brief,
      guestCount: op.guestCount,
      budget: Math.max(MIN_BUDGET, budget.total),
    },
    budget,
  };
}
