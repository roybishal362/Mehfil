import { describe, expect, it } from 'vitest';
import type { Guest, Vendor } from '../schemas/plan';
import { TODAY, weddingPlan } from '../test/fixtures';
import { summariseBudget } from './budget';
import { planningHeadcount, summariseGuests } from './guests';
import { readiness } from './readiness';
import {
  cheapestOption,
  committedAmount,
  committedByCategory,
  selectedOption,
  vendorPipeline,
  vendorState,
} from './vendors';

function vendor(partial: Partial<Vendor>): Vendor {
  return {
    id: 'v1',
    category: 'caterer',
    priority: 'high',
    bookBy: '2026-12-01',
    status: 'quoted',
    questions: [],
    redFlags: [],
    options: [
      { id: 'o1', name: 'Bhojohori', quote: 600_000 },
      { id: 'o2', name: 'Annapurna', quote: 540_000 },
      { id: 'o3', name: 'No quote yet' },
    ],
    budgetCategory: 'catering',
    source: 'template',
    ...partial,
  };
}

describe('vendors', () => {
  it('finds the cheapest quote and the selected option', () => {
    const v = vendor({ selectedOptionId: 'o1' });
    expect(cheapestOption(v)?.id).toBe('o2');
    expect(selectedOption(v)?.name).toBe('Bhojohori');
    expect(cheapestOption(vendor({ options: [] }))).toBeUndefined();
  });

  it('counts committed spend only once a vendor is booked', () => {
    expect(committedAmount(vendor({ selectedOptionId: 'o2' }))).toBe(0);
    const booked = vendor({ status: 'booked', selectedOptionId: 'o2' });
    expect(committedAmount(booked)).toBe(540_000);
    expect(
      committedByCategory([booked, vendor({ id: 'v2', status: 'paid', selectedOptionId: 'o1' })]),
    ).toEqual({
      catering: 1_140_000,
    });
  });

  it('classifies booking urgency', () => {
    expect(vendorState(vendor({ status: 'booked' }), TODAY)).toBe('secured');
    expect(vendorState(vendor({ bookBy: '2026-10-01' }), TODAY)).toBe('overdue');
    expect(vendorState(vendor({ bookBy: '2026-11-01' }), TODAY)).toBe('due_soon');
    expect(vendorState(vendor({ bookBy: '2027-01-01' }), TODAY)).toBe('open');
  });

  it('counts vendors per pipeline stage', () => {
    const counts = vendorPipeline([
      vendor({}),
      vendor({ status: 'booked' }),
      vendor({ status: 'booked' }),
    ]);
    expect(counts).toMatchObject({ quoted: 1, booked: 2, not_started: 0 });
  });

  it('reflects booked quotes in the budget summary', () => {
    const plan = weddingPlan();
    const catering = plan.budget.lines.find((l) => l.category === 'catering')!;
    const summary = summariseBudget(plan.budget, 300, { catering: catering.planned + 50_000 });
    expect(summary.spent).toBe(catering.planned + 50_000);
    expect(summary.overspentLineIds).toEqual([catering.id]);
  });
});

describe('guests', () => {
  const guests: Guest[] = [
    { id: 'g1', name: 'Meera', partySize: 2, rsvp: 'yes', dietary: 'jain' },
    { id: 'g2', name: 'Arjun', partySize: 1, rsvp: 'no', dietary: 'vegan' },
    { id: 'g3', name: 'Sen family', partySize: 4, rsvp: 'pending' },
    { id: 'g4', name: 'Tara', partySize: 1, rsvp: 'maybe', dietary: 'jain' },
  ];

  it('summarises RSVPs and dietary needs of people who may attend', () => {
    expect(summariseGuests(guests)).toEqual({
      invitations: 4,
      people: 8,
      confirmed: 2,
      maybe: 1,
      declined: 1,
      pending: 4,
      expected: 7,
      dietary: { jain: 3 },
    });
  });

  it('plans for the guest list once one exists', () => {
    expect(planningHeadcount([], 300)).toBe(300);
    expect(planningHeadcount(guests, 300)).toBe(7);
  });
});

describe('readiness', () => {
  it('starts low for a fresh plan and rises as work gets done', () => {
    const fresh = weddingPlan();
    const start = readiness(fresh, TODAY);
    expect(start.score).toBe(20);
    expect(start.attention).toEqual([]);

    const progressed = {
      ...fresh,
      tasks: fresh.tasks.map((t, i) => (i < 5 ? { ...t, status: 'done' as const } : t)),
      vendors: fresh.vendors.map((v, i) => (i < 3 ? { ...v, status: 'booked' as const } : v)),
    };
    expect(readiness(progressed, TODAY).score).toBeGreaterThan(start.score);
  });

  it('lists overdue tasks, overdue vendors and overspending', () => {
    const plan = weddingPlan();
    const line = plan.budget.lines[0]!;
    const troubled = {
      ...plan,
      tasks: [{ ...plan.tasks[0]!, dueDate: '2026-10-01' }],
      vendors: [{ ...plan.vendors[0]!, bookBy: '2026-10-01' }],
      budget: { ...plan.budget, lines: [{ ...line, spent: plan.budget.total + 1 }] },
    };
    const kinds = readiness(troubled, TODAY).attention.map((a) => a.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(['budget_over', 'task_overdue', 'vendor_overdue', 'line_overspent']),
    );
    expect(readiness(troubled, TODAY).budget).toBeLessThan(1);
  });

  it('scores an over-planned budget below full health', () => {
    const plan = weddingPlan();
    const overPlanned = { ...plan, budget: { ...plan.budget, total: 1_500_000 } };
    expect(readiness(overPlanned, TODAY).budget).toBeCloseTo(1_500_000 / 1_800_000, 5);
  });

  it('treats a plan without vendors as having nothing left to book', () => {
    expect(readiness({ ...weddingPlan(), vendors: [] }, TODAY).vendors).toBe(1);
  });
});
