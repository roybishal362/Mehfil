import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Budget, BudgetLine } from '../schemas/plan';
import { getTemplate } from '../templates';
import { sequentialIds } from '../utils/ids';
import {
  adjustedShares,
  allocateByWeights,
  balanceShares,
  budgetHealth,
  createBudgetLines,
  rebalanceLines,
  roundingStep,
  scaleForGuests,
  splitBudget,
  summariseBudget,
} from './budget';

const sum = (values: readonly number[]) => values.reduce((s, v) => s + v, 0);

function line(partial: Partial<BudgetLine> & Pick<BudgetLine, 'id' | 'planned'>): BudgetLine {
  return {
    category: 'decor',
    spent: 0,
    paid: 0,
    perGuest: false,
    source: 'template',
    ...partial,
  };
}

describe('allocateByWeights', () => {
  it('splits exactly with the largest-remainder method', () => {
    expect(allocateByWeights(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateByWeights(10, [0.5, 0.25, 0.25])).toEqual([5, 3, 2]);
  });

  it('splits evenly when every weight is zero or invalid', () => {
    expect(allocateByWeights(9, [0, -1, Number.NaN])).toEqual([3, 3, 3]);
  });

  it('rejects negative or fractional totals', () => {
    expect(() => allocateByWeights(-1, [1])).toThrow(RangeError);
    expect(() => allocateByWeights(1.5, [1])).toThrow(RangeError);
  });

  it('always sums to the total and never goes negative (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000_000 }),
        fc.array(fc.double({ min: 0, max: 1000, noNaN: true }), { minLength: 1, maxLength: 25 }),
        (total, weights) => {
          const parts = allocateByWeights(total, weights);
          expect(sum(parts)).toBe(total);
          expect(parts.every((p) => Number.isInteger(p) && p >= 0)).toBe(true);
        },
      ),
    );
  });
});

describe('splitBudget', () => {
  it('rounds to friendly steps and keeps the exact total', () => {
    const parts = splitBudget(1_800_000, [30, 22, 11, 37]);
    expect(sum(parts)).toBe(1_800_000);
    expect(parts.every((p) => p % 1000 === 0)).toBe(true);
  });

  it('puts the sub-step leftover on the chosen line', () => {
    const parts = splitBudget(60_050, [50, 50], 1);
    expect(parts).toEqual([30_000, 30_050]);
  });

  it('keeps the exact total for any amount (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 100_000_000 }),
        fc.array(fc.integer({ min: 1, max: 60 }), { minLength: 2, maxLength: 12 }),
        (total, weights) => {
          expect(sum(splitBudget(total, weights))).toBe(total);
        },
      ),
    );
  });
});

describe('roundingStep', () => {
  it('scales with the size of the budget', () => {
    expect(roundingStep(2_500_000)).toBe(1000);
    expect(roundingStep(250_000)).toBe(500);
    expect(roundingStep(60_000)).toBe(100);
    expect(roundingStep(5000)).toBe(10);
    expect(roundingStep(500)).toBe(1);
  });
});

describe('balanceShares', () => {
  const bounds = [
    { min: 10, max: 50 },
    { min: 10, max: 50 },
    { min: 0, max: 30 },
  ];

  it('clamps out-of-range shares and renormalises to 100', () => {
    const shares = balanceShares([90, 5, 5], bounds);
    expect(sum(shares)).toBeCloseTo(100, 9);
    expect(shares[0]).toBeLessThanOrEqual(50);
    expect(shares[1]).toBeGreaterThanOrEqual(10);
  });

  it('leaves already-valid shares alone', () => {
    expect(balanceShares([40, 40, 20], bounds)).toEqual([40, 40, 20]);
  });

  it('stays within bounds and sums to 100 for any input (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -50, max: 200, noNaN: true }), { minLength: 3, maxLength: 3 }),
        (raw) => {
          const shares = balanceShares(raw, bounds);
          expect(sum(shares)).toBeCloseTo(100, 6);
          shares.forEach((share, i) => {
            expect(share).toBeGreaterThanOrEqual((bounds[i]?.min ?? 0) - 1e-9);
            expect(share).toBeLessThanOrEqual((bounds[i]?.max ?? 100) + 1e-9);
          });
        },
      ),
    );
  });
});

describe('adjustedShares', () => {
  it('shrinks the venue share for a home celebration', () => {
    const template = getTemplate('birthday');
    const venueIndex = template.budget.findIndex((l) => l.category === 'venue');
    const atHome = adjustedShares(template, { venueType: 'home' });
    const atHall = adjustedShares(template, { venueType: 'banquet_hall' });
    expect(atHome[venueIndex]).toBeLessThan(atHall[venueIndex] ?? 0);
    expect(sum(atHome)).toBeCloseTo(100, 6);
  });

  it('grows accommodation for a destination wedding', () => {
    const template = getTemplate('wedding');
    const index = template.budget.findIndex((l) => l.category === 'accommodation');
    const destination = adjustedShares(template, { venueType: 'destination' });
    expect(destination[index]).toBeGreaterThan(template.budget[index]?.weight ?? 0);
  });

  it('adds weather contingency for outdoor events', () => {
    const template = getTemplate('other');
    const index = template.budget.findIndex((l) => l.category === 'contingency');
    expect(adjustedShares(template, { venueType: 'outdoor' })[index]).toBeGreaterThan(5);
  });

  it('reduces venue costs at community halls', () => {
    const template = getTemplate('community');
    const index = template.budget.findIndex((l) => l.category === 'venue_permits');
    expect(adjustedShares(template, { venueType: 'community_hall' })[index]).toBeLessThan(15);
  });
});

describe('createBudgetLines', () => {
  it('creates one line per template category that sums to the total', () => {
    const template = getTemplate('wedding');
    const lines = createBudgetLines({
      total: 1_800_000,
      template: template.budget,
      shares: template.budget.map((l) => l.weight),
      makeId: sequentialIds(),
      source: 'template',
    });
    expect(lines).toHaveLength(template.budget.length);
    expect(sum(lines.map((l) => l.planned))).toBe(1_800_000);
    expect(lines.find((l) => l.category === 'catering')?.perGuest).toBe(true);
    expect(lines[0]?.id).toBe('line_1');
  });
});

describe('summariseBudget and budgetHealth', () => {
  const budget: Budget = {
    currency: 'INR',
    total: 100_000,
    savingTips: [],
    lines: [
      line({ id: 'a', planned: 60_000, spent: 70_000, paid: 20_000 }),
      line({ id: 'b', planned: 40_000, spent: 10_000 }),
    ],
  };

  it('totals planned, spent and paid amounts', () => {
    const summary = summariseBudget(budget, 50);
    expect(summary).toMatchObject({
      planned: 100_000,
      spent: 80_000,
      paid: 20_000,
      remaining: 20_000,
      unallocated: 0,
      perGuestPlanned: 2000,
      overBudget: false,
      overspentLineIds: ['a'],
    });
    expect(budgetHealth(summary)).toBe('watch');
  });

  it('flags spending beyond the total', () => {
    const over = { ...budget, total: 50_000 };
    expect(budgetHealth(summariseBudget(over, 0))).toBe('over');
    expect(summariseBudget(over, 0).perGuestPlanned).toBe(0);
  });

  it('reports a healthy budget', () => {
    const calm: Budget = { ...budget, lines: [line({ id: 'x', planned: 100_000, spent: 5000 })] };
    expect(budgetHealth(summariseBudget(calm, 10))).toBe('healthy');
  });
});

describe('rebalanceLines', () => {
  const lines = [
    line({ id: 'cat', planned: 50_000, category: 'catering' }),
    line({ id: 'dec', planned: 30_000 }),
    line({ id: 'con', planned: 20_000, category: 'contingency' }),
  ];

  it('rescales unprotected lines to a new total', () => {
    const next = rebalanceLines(lines, 90_000, ['cat']);
    expect(next.find((l) => l.id === 'cat')?.planned).toBe(50_000);
    expect(sum(next.map((l) => l.planned))).toBe(90_000);
  });

  it('rescales everything when protected lines exceed the new total', () => {
    const next = rebalanceLines(lines, 40_000, ['cat']);
    expect(sum(next.map((l) => l.planned))).toBe(40_000);
    expect(next.find((l) => l.id === 'cat')?.planned).toBeLessThan(50_000);
  });
});

describe('scaleForGuests', () => {
  const base: Budget = {
    currency: 'INR',
    total: 1_800_000,
    savingTips: [],
    lines: [
      line({ id: 'cat', planned: 560_000, category: 'catering', perGuest: true }),
      line({ id: 'fav', planned: 72_000, category: 'invitations_favors', perGuest: true }),
      line({ id: 'ven', planned: 400_000, category: 'venue', spent: 400_000 }),
      line({ id: 'dec', planned: 500_000 }),
      line({ id: 'con', planned: 268_000, category: 'contingency' }),
    ],
  };

  it('grows per-guest lines and absorbs the cost elsewhere when the total is fixed', () => {
    const next = scaleForGuests(base, 300, 350, true);
    expect(next.total).toBe(1_800_000);
    expect(sum(next.lines.map((l) => l.planned))).toBe(1_800_000);
    expect(next.lines.find((l) => l.id === 'cat')?.planned).toBe(653_000);
    // The venue is already paid for, so it is not cut.
    expect(next.lines.find((l) => l.id === 'ven')?.planned).toBe(400_000);
    expect(next.lines.find((l) => l.id === 'dec')?.planned).toBeLessThan(500_000);
  });

  it('raises the total instead when asked to', () => {
    const next = scaleForGuests(base, 300, 350, false);
    expect(next.total).toBeGreaterThan(1_800_000);
    expect(sum(next.lines.map((l) => l.planned))).toBe(next.total);
  });

  it('does nothing for an unchanged or invalid count', () => {
    expect(scaleForGuests(base, 300, 300, true)).toBe(base);
    expect(scaleForGuests(base, 0, 300, true)).toBe(base);
  });
});

describe('balanceShares with nothing to scale', () => {
  it('splits evenly when every movable share is zero', () => {
    expect(
      balanceShares(
        [0, 0],
        [
          { min: 0, max: 100 },
          { min: 0, max: 100 },
        ],
      ),
    ).toEqual([50, 50]);
  });
});
