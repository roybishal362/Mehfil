/**
 * Budget engine. Gemini may suggest how to split a budget, but every amount is computed here:
 * splits are bounded per category, rounded to friendly steps and always sum exactly to the total.
 */
import type { EventBrief } from '../schemas/brief';
import type { BudgetCategory } from '../schemas/categories';
import type { Budget, BudgetLine } from '../schemas/plan';
import type { Source } from '../schemas/primitives';
import type { BudgetTemplateLine, EventTemplate } from '../templates/types';
import { zipWith } from '../utils/collections';
import type { IdFactory } from '../utils/ids';

/**
 * Splits an integer `total` in proportion to `weights` using the largest-remainder method,
 * so the parts are integers that sum exactly to `total`.
 */
export function allocateByWeights(total: number, weights: readonly number[]): number[] {
  if (!Number.isInteger(total) || total < 0) {
    throw new RangeError('total must be a non-negative integer');
  }
  if (weights.length === 0) return [];
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const weightSum = clean.reduce((sum, w) => sum + w, 0);
  const effective = weightSum > 0 ? clean : clean.map(() => 1);
  const effectiveSum = weightSum > 0 ? weightSum : effective.length;

  const exact = effective.map((w) => (w / effectiveSum) * total);
  const floorSum = exact.reduce((sum, value) => sum + Math.floor(value), 0);
  // The remainder is always smaller than the number of parts: give one unit to each of the
  // parts with the largest fractional remainders (ties go to the earlier part).
  const remainder = total - floorSum;
  const bonus = new Set(
    exact
      .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
      .slice(0, remainder)
      .map(({ index }) => index),
  );
  return exact.map((value, index) => Math.floor(value) + (bonus.has(index) ? 1 : 0));
}

/** Index of the largest value (the first one on ties). */
function indexOfMax(values: readonly number[]): number {
  let best = 0;
  let bestValue = -Infinity;
  values.forEach((value, index) => {
    if (value > bestValue) {
      best = index;
      bestValue = value;
    }
  });
  return best;
}

/** Friendly rounding unit: ₹18,00,000 splits into thousands, ₹60,000 into hundreds. */
export function roundingStep(total: number): number {
  if (total >= 1_000_000) return 1000;
  if (total >= 100_000) return 500;
  if (total >= 10_000) return 100;
  if (total >= 1000) return 10;
  return 1;
}

/**
 * Splits `total` by `weights` into multiples of a friendly step. Any leftover below one step
 * goes to the part at `leftoverIndex` (default: the largest weight), so the sum stays exact.
 */
export function splitBudget(
  total: number,
  weights: readonly number[],
  leftoverIndex?: number,
): number[] {
  if (weights.length === 0) return [];
  const step = roundingStep(total);
  const units = Math.floor(total / step);
  const leftover = total - units * step;
  const target = leftoverIndex ?? indexOfMax(weights);
  return allocateByWeights(units, weights).map((u, i) => u * step + (i === target ? leftover : 0));
}

export interface ShareBounds {
  min: number;
  max: number;
}

/**
 * Brings percentage shares inside their [min, max] bounds and back to a total of 100 by
 * repeatedly spreading the surplus or deficit over the shares that still have room.
 * Assumes the bounds are feasible (sum of mins ≤ 100 ≤ sum of maxes).
 */
export function balanceShares(shares: readonly number[], bounds: readonly ShareBounds[]): number[] {
  const clamp = (value: number, b: ShareBounds) =>
    Math.min(b.max, Math.max(b.min, Number.isFinite(value) ? value : b.min));
  const items = zipWith(shares, bounds, (value, b) => ({ ...b, value: clamp(value, b) }));
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const diff = 100 - items.reduce((sum, item) => sum + item.value, 0);
    if (Math.abs(diff) < 1e-9) break;
    const movable = items.filter((item) =>
      diff > 0 ? item.value < item.max - 1e-12 : item.value > item.min + 1e-12,
    );
    if (movable.length === 0) break;
    const base = movable.reduce((sum, item) => sum + item.value, 0);
    for (const item of movable) {
      const portion = base > 0 ? item.value / base : 1 / movable.length;
      item.value = clamp(item.value + diff * portion, item);
    }
  }
  return items.map((item) => item.value);
}

/** Template weights nudged by facts in the brief, before any AI involvement. */
export function adjustedShares(
  template: EventTemplate,
  brief: Pick<EventBrief, 'venueType'>,
): number[] {
  const factor = (category: BudgetCategory): number => {
    switch (brief.venueType) {
      case 'home':
        return category === 'venue' || category === 'venue_permits' ? 0.2 : 1;
      case 'community_hall':
      case 'religious_venue':
        return category === 'venue' || category === 'venue_permits' ? 0.6 : 1;
      case 'destination':
        if (category === 'accommodation') return 3;
        if (category === 'transport') return 1.6;
        return 1;
      case 'outdoor':
        if (category === 'decor') return 1.15;
        if (category === 'contingency') return 1.4;
        return 1;
      case 'banquet_hall':
      case 'hotel':
      case 'restaurant':
      case 'other':
        return 1;
    }
  };
  return balanceShares(
    template.budget.map((line) => line.weight * factor(line.category)),
    template.budget,
  );
}

/** Creates budget lines for a template, given final percentage shares. */
export function createBudgetLines(
  total: number,
  template: readonly BudgetTemplateLine[],
  shares: readonly number[],
  makeId: IdFactory,
  source: Source,
): BudgetLine[] {
  const contingency = template.findIndex((line) => line.category === 'contingency');
  const amounts = splitBudget(total, shares, contingency >= 0 ? contingency : undefined);
  return zipWith(template, amounts, (line, planned) => ({
    id: makeId('line'),
    category: line.category,
    planned,
    spent: 0,
    paid: 0,
    perGuest: line.perGuest ?? false,
    source,
  }));
}

export interface BudgetSummary {
  total: number;
  planned: number;
  spent: number;
  paid: number;
  /** Total minus spent: what is still free to commit. */
  remaining: number;
  /** Total minus planned: budget not yet assigned to any line. */
  unallocated: number;
  perGuestPlanned: number;
  overBudget: boolean;
  /** Lines whose spending exceeds their plan. */
  overspentLineIds: string[];
  /** Share of the total already spent, 0–1+ (may exceed 1). */
  utilisation: number;
}

/** Commitments from booked vendors, keyed by budget category. */
export type CommittedSpend = Partial<Record<BudgetCategory, number>>;

/**
 * Spend per line: the larger of what the user recorded and what booked vendors have committed.
 * A category's commitment counts against the first line of that category only.
 */
export function lineSpend(budget: Budget, committed: CommittedSpend = {}): number[] {
  const claimed = new Set<BudgetCategory>();
  return budget.lines.map((line) => {
    let fromVendors = 0;
    if (!claimed.has(line.category)) {
      claimed.add(line.category);
      fromVendors = committed[line.category] ?? 0;
    }
    return Math.max(line.spent, fromVendors);
  });
}

export function summariseBudget(
  budget: Budget,
  guestCount: number,
  committed: CommittedSpend = {},
): BudgetSummary {
  const spendByLine = lineSpend(budget, committed);
  const planned = budget.lines.reduce((total, line) => total + line.planned, 0);
  const spent = spendByLine.reduce((total, value) => total + value, 0);
  const paid = budget.lines.reduce((total, line) => total + line.paid, 0);
  return {
    total: budget.total,
    planned,
    spent,
    paid,
    remaining: budget.total - spent,
    unallocated: budget.total - planned,
    perGuestPlanned: guestCount > 0 ? Math.round(planned / guestCount) : 0,
    overBudget: spent > budget.total || planned > budget.total,
    overspentLineIds: zipWith(budget.lines, spendByLine, (line, value) =>
      value > line.planned ? line.id : null,
    ).filter((id): id is string => id !== null),
    utilisation: budget.total > 0 ? spent / budget.total : 0,
  };
}

export type BudgetHealth = 'healthy' | 'watch' | 'over';

export function budgetHealth(summary: BudgetSummary): BudgetHealth {
  if (summary.overBudget) return 'over';
  if (summary.utilisation > 0.9 || summary.overspentLineIds.length > 0) return 'watch';
  return 'healthy';
}

/**
 * Re-plans lines for a new total. Protected lines keep their amounts; the rest are rescaled in
 * proportion to their current plan. When the protected lines alone exceed the new total,
 * every line is rescaled instead. Lines never drop below what is already spent if avoidable.
 */
export function rebalanceLines(
  lines: readonly BudgetLine[],
  newTotal: number,
  protectIds: readonly string[] = [],
): BudgetLine[] {
  const isProtected = (line: BudgetLine) => protectIds.includes(line.id);
  const protectedSum = lines.filter(isProtected).reduce((s, l) => s + l.planned, 0);
  const keepProtected = protectedSum <= newTotal;
  const flexible = lines.filter((line) => !keepProtected || !isProtected(line));
  const pool = keepProtected ? newTotal - protectedSum : newTotal;
  const contingency = flexible.findIndex((l) => l.category === 'contingency');
  const amounts = splitBudget(
    pool,
    flexible.map((l) => Math.max(l.planned, 1)),
    contingency >= 0 ? contingency : undefined,
  );
  const byId = new Map(zipWith(flexible, amounts, (line, amount) => [line.id, amount] as const));
  return lines.map((line) => {
    const next = byId.get(line.id);
    return next === undefined ? line : { ...line, planned: next };
  });
}

/**
 * Applies a new guest count. Per-guest lines (catering, favours…) scale with the count.
 * With `keepTotal`, the difference is absorbed by the other flexible lines in proportion to
 * their plan (never below what they have already spent); otherwise the total moves.
 */
export function scaleForGuests(
  budget: Budget,
  oldCount: number,
  newCount: number,
  keepTotal: boolean,
): Budget {
  if (oldCount <= 0 || newCount <= 0 || oldCount === newCount) return budget;
  const ratio = newCount / oldCount;
  const step = roundingStep(budget.total);
  const scaled = budget.lines.map((line) =>
    line.perGuest ? { ...line, planned: Math.round((line.planned * ratio) / step) * step } : line,
  );
  const delta =
    scaled.reduce((s, l) => s + l.planned, 0) - budget.lines.reduce((s, l) => s + l.planned, 0);

  if (!keepTotal) {
    return { ...budget, total: Math.max(0, budget.total + delta), lines: scaled };
  }

  const absorbers = scaled.filter((line) => !line.perGuest);
  const absorberPool = absorbers.reduce((s, l) => s + l.planned, 0);
  const target = Math.max(0, absorberPool - delta);
  const floors = absorbers.map((l) => Math.min(l.spent, l.planned));
  const floorSum = floors.reduce((s, f) => s + f, 0);
  const adjustable = Math.max(0, target - floorSum);
  const amounts = splitBudget(
    adjustable,
    zipWith(absorbers, floors, (line, floor) => Math.max(line.planned - floor, 0)),
  );
  const totals = zipWith(floors, amounts, (floor, amount) => floor + amount);
  const byId = new Map(zipWith(absorbers, totals, (line, value) => [line.id, value] as const));
  return {
    ...budget,
    lines: scaled.map((line) => {
      const next = byId.get(line.id);
      return next === undefined ? line : { ...line, planned: next };
    }),
  };
}
