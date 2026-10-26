import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PlanOperation } from '../schemas/operations';
import { EventPlan } from '../schemas/plan';
import { TODAY, editIds, weddingPlan } from '../test/fixtures';
import {
  applyOperation,
  applyOperations,
  OperationError,
  type OperationContext,
} from './operations';

const ctx = (): OperationContext => ({ today: TODAY, makeId: editIds() });
const op = (input: unknown) => PlanOperation.parse(input);

describe('brief.update', () => {
  it('moves tasks, open vendors and the run sheet when the date changes', () => {
    const plan = weddingPlan();
    const task = plan.tasks.find((t) => t.daysBefore === 7)!;
    const next = applyOperation(
      plan,
      op({ type: 'brief.update', patch: { date: '2027-02-21' } }),
      ctx(),
    );
    expect(next.brief.date).toBe('2027-02-21');
    expect(next.tasks.find((t) => t.id === task.id)?.dueDate).toBe('2027-02-14');
    expect(next.schedule.every((s) => s.day === '2027-02-21')).toBe(true);
    expect(next.vendors[0]?.bookBy).not.toBe(plan.vendors[0]?.bookBy);
  });

  it('rejects an end date before the start date', () => {
    expect(() =>
      applyOperation(
        weddingPlan(),
        op({ type: 'brief.update', patch: { endDate: '2027-02-01' } }),
        ctx(),
      ),
    ).toThrow(OperationError);
  });
});

describe('tasks', () => {
  it('adds, updates and removes tasks', () => {
    let plan = weddingPlan();
    plan = applyOperation(
      plan,
      op({
        type: 'task.add',
        task: { title: 'Book a dhaki for the procession', dueDate: '2027-01-14' },
      }),
      ctx(),
    );
    const added = plan.tasks.at(-1)!;
    expect(added).toMatchObject({
      daysBefore: 31,
      status: 'todo',
      priority: 'medium',
      source: 'user',
    });

    plan = applyOperation(
      plan,
      op({ type: 'task.update', id: added.id, patch: { dueDate: '2027-02-04', status: 'done' } }),
      ctx(),
    );
    expect(plan.tasks.at(-1)).toMatchObject({ daysBefore: 10, status: 'done' });

    plan = applyOperation(plan, op({ type: 'task.remove', id: added.id }), ctx());
    expect(plan.tasks.some((t) => t.id === added.id)).toBe(false);
  });

  it('records Copilot changes as AI-made', () => {
    const plan = applyOperation(
      weddingPlan(),
      op({
        type: 'task.add',
        task: { title: 'Confirm venue capacity for 350', dueDate: '2026-11-15' },
      }),
      { ...ctx(), source: 'ai' },
    );
    expect(plan.tasks.at(-1)?.source).toBe('ai');
  });

  it('throws a not_found error for unknown IDs', () => {
    try {
      applyOperation(weddingPlan(), op({ type: 'task.remove', id: 'task_missing' }), ctx());
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(OperationError);
      expect((error as OperationError).code).toBe('not_found');
    }
  });
});

describe('budget', () => {
  it('rebalances to a new total while protecting chosen lines', () => {
    const plan = weddingPlan();
    const catering = plan.budget.lines.find((l) => l.category === 'catering')!;
    const next = applyOperation(
      plan,
      op({ type: 'budget.setTotal', total: 1_700_000, protectIds: [catering.id] }),
      ctx(),
    );
    expect(next.budget.total).toBe(1_700_000);
    expect(next.brief.budget).toBe(1_700_000);
    expect(next.budget.lines.reduce((s, l) => s + l.planned, 0)).toBe(1_700_000);
    expect(next.budget.lines.find((l) => l.id === catering.id)?.planned).toBe(catering.planned);
  });

  it('marks a line as user-edited when its plan changes', () => {
    const plan = weddingPlan();
    const decor = plan.budget.lines.find((l) => l.category === 'decor')!;
    const next = applyOperation(
      plan,
      op({ type: 'budget.updateLine', id: decor.id, patch: { planned: 150_000, spent: 20_000 } }),
      ctx(),
    );
    expect(next.budget.lines.find((l) => l.id === decor.id)).toMatchObject({
      planned: 150_000,
      spent: 20_000,
      source: 'user',
    });
    const notesOnly = applyOperation(
      plan,
      op({
        type: 'budget.updateLine',
        id: decor.id,
        patch: { notes: 'Ask about rental marigolds' },
      }),
      ctx(),
    );
    expect(notesOnly.budget.lines.find((l) => l.id === decor.id)?.source).toBe('template');
  });

  it('adds and removes custom lines', () => {
    let plan = applyOperation(
      weddingPlan(),
      op({ type: 'budget.addLine', line: { label: 'Dhaki drummers', planned: 25_000 } }),
      ctx(),
    );
    const line = plan.budget.lines.at(-1)!;
    expect(line).toMatchObject({ category: 'custom', label: 'Dhaki drummers' });
    plan = applyOperation(plan, op({ type: 'budget.removeLine', id: line.id }), ctx());
    expect(plan.budget.lines.some((l) => l.id === line.id)).toBe(false);
  });

  it('scales per-guest costs with the guest count', () => {
    const plan = weddingPlan();
    const next = applyOperation(
      plan,
      op({ type: 'guests.setCount', guestCount: 350, keepBudget: true }),
      ctx(),
    );
    expect(next.brief.guestCount).toBe(350);
    expect(next.budget.total).toBe(1_800_000);
    expect(next.brief.budget).toBe(1_800_000);
    const cateringBefore = plan.budget.lines.find((l) => l.category === 'catering')!.planned;
    expect(next.budget.lines.find((l) => l.category === 'catering')!.planned).toBeGreaterThan(
      cateringBefore,
    );
  });
});

describe('vendors', () => {
  it('manages options and the selected quote', () => {
    let plan = weddingPlan();
    const vendor = plan.vendors[0]!;
    plan = applyOperation(
      plan,
      op({
        type: 'vendor.addOption',
        vendorId: vendor.id,
        option: { name: 'Hall A', quote: 350_000 },
      }),
      ctx(),
    );
    const option = plan.vendors[0]!.options[0]!;
    plan = applyOperation(
      plan,
      op({
        type: 'vendor.update',
        id: vendor.id,
        patch: { status: 'booked', selectedOptionId: option.id },
      }),
      ctx(),
    );
    expect(plan.vendors[0]).toMatchObject({ status: 'booked', selectedOptionId: option.id });

    plan = applyOperation(
      plan,
      op({
        type: 'vendor.updateOption',
        vendorId: vendor.id,
        optionId: option.id,
        patch: { quote: 340_000 },
      }),
      ctx(),
    );
    expect(plan.vendors[0]!.options[0]!.quote).toBe(340_000);

    plan = applyOperation(
      plan,
      op({ type: 'vendor.update', id: vendor.id, patch: { selectedOptionId: null } }),
      ctx(),
    );
    expect(plan.vendors[0]!.selectedOptionId).toBeUndefined();

    plan = applyOperation(
      plan,
      op({ type: 'vendor.update', id: vendor.id, patch: { selectedOptionId: option.id } }),
      ctx(),
    );
    plan = applyOperation(
      plan,
      op({ type: 'vendor.removeOption', vendorId: vendor.id, optionId: option.id }),
      ctx(),
    );
    expect(plan.vendors[0]!.options).toHaveLength(0);
    expect(plan.vendors[0]!.selectedOptionId).toBeUndefined();
  });

  it('refuses to select an option that does not exist', () => {
    const plan = weddingPlan();
    expect(() =>
      applyOperation(
        plan,
        op({
          type: 'vendor.update',
          id: plan.vendors[0]!.id,
          patch: { selectedOptionId: 'opt_nope' },
        }),
        ctx(),
      ),
    ).toThrow(OperationError);
  });

  it('adds and removes custom vendors', () => {
    let plan = applyOperation(
      weddingPlan(),
      op({
        type: 'vendor.add',
        vendor: { label: 'Shehnai players', priority: 'low', bookBy: '2027-01-10' },
      }),
      ctx(),
    );
    const vendor = plan.vendors.at(-1)!;
    expect(vendor).toMatchObject({ category: 'custom', status: 'not_started' });
    plan = applyOperation(plan, op({ type: 'vendor.remove', id: vendor.id }), ctx());
    expect(plan.vendors.some((v) => v.id === vendor.id)).toBe(false);
  });
});

describe('ideas, guests, schedule and risks', () => {
  it('handles the remaining collections', () => {
    let plan = weddingPlan();
    plan = applyOperation(
      plan,
      op({
        type: 'idea.add',
        idea: {
          kind: 'food',
          title: 'Mishti doi bar',
          description: 'Clay pots of mishti doi at the dessert counter.',
        },
      }),
      ctx(),
    );
    const idea = plan.ideas.at(-1)!;
    plan = applyOperation(
      plan,
      op({ type: 'idea.update', id: idea.id, patch: { favorite: true } }),
      ctx(),
    );
    expect(plan.ideas.at(-1)?.favorite).toBe(true);
    plan = applyOperation(plan, op({ type: 'idea.remove', id: idea.id }), ctx());

    plan = applyOperation(
      plan,
      op({ type: 'guest.add', guest: { name: 'Meera Sen', partySize: 2, rsvp: 'yes' } }),
      ctx(),
    );
    const guest = plan.guests.at(-1)!;
    plan = applyOperation(
      plan,
      op({ type: 'guest.update', id: guest.id, patch: { rsvp: 'maybe' } }),
      ctx(),
    );
    expect(plan.guests.at(-1)).toMatchObject({ rsvp: 'maybe', partySize: 2 });
    // A partial edit never resets the fields it does not mention.
    plan = applyOperation(
      plan,
      op({ type: 'guest.update', id: guest.id, patch: { dietary: 'jain' } }),
      ctx(),
    );
    expect(plan.guests.at(-1)).toMatchObject({ rsvp: 'maybe', partySize: 2, dietary: 'jain' });
    plan = applyOperation(plan, op({ type: 'guest.remove', id: guest.id }), ctx());
    plan = applyOperation(
      plan,
      op({ type: 'guests.import', guests: [{ name: 'A' }, { name: 'B', partySize: 3 }] }),
      ctx(),
    );
    expect(plan.guests).toHaveLength(2);

    plan = applyOperation(
      plan,
      op({
        type: 'schedule.add',
        item: { day: '2027-02-14', time: '20:15', durationMinutes: 30, title: 'Sindoor daan' },
      }),
      ctx(),
    );
    const slot = plan.schedule.at(-1)!;
    plan = applyOperation(
      plan,
      op({ type: 'schedule.update', id: slot.id, patch: { time: '20:30' } }),
      ctx(),
    );
    expect(plan.schedule.at(-1)?.time).toBe('20:30');
    plan = applyOperation(plan, op({ type: 'schedule.remove', id: slot.id }), ctx());

    const withRisk = {
      ...plan,
      risks: [
        {
          id: 'risk_1',
          title: 'Rain',
          likelihood: 'medium' as const,
          mitigation: 'Book a covered hall.',
          source: 'ai' as const,
        },
      ],
    };
    expect(
      applyOperation(withRisk, op({ type: 'risk.remove', id: 'risk_1' }), ctx()).risks,
    ).toHaveLength(0);
    expect(EventPlan.safeParse(plan).success).toBe(true);
  });

  it('enforces collection limits', () => {
    const plan = { ...weddingPlan(), guests: [] };
    const tooMany = Array.from({ length: 2001 }, (_, i) => ({ name: `Guest ${String(i)}` }));
    expect(() =>
      applyOperation(plan, op({ type: 'guests.import', guests: tooMany.slice(0, 2000) }), ctx()),
    ).not.toThrow();
    const full = applyOperation(
      plan,
      op({ type: 'guests.import', guests: tooMany.slice(0, 2000) }),
      ctx(),
    );
    expect(() =>
      applyOperation(full, op({ type: 'guest.add', guest: { name: 'One more' } }), ctx()),
    ).toThrow(/at most 2000/);
  });
});

describe('applyOperations', () => {
  it('applies operations in order', () => {
    const plan = applyOperations(
      weddingPlan(),
      [
        op({ type: 'guests.setCount', guestCount: 320, keepBudget: false }),
        op({ type: 'task.add', task: { title: 'Order 20 extra chairs', dueDate: '2027-02-01' } }),
      ],
      ctx(),
    );
    expect(plan.brief.guestCount).toBe(320);
    expect(plan.brief.budget).toBe(plan.budget.total);
    expect(plan.tasks.at(-1)?.title).toBe('Order 20 extra chairs');
  });

  it('keeps the plan valid under any sequence of edits (property)', () => {
    const recipe = fc.oneof(
      fc.record({
        kind: fc.constant('taskStatus' as const),
        index: fc.nat(),
        status: fc.constantFrom('todo', 'in_progress', 'done'),
      }),
      fc.record({
        kind: fc.constant('taskDue' as const),
        index: fc.nat(),
        offset: fc.integer({ min: -30, max: 200 }),
      }),
      fc.record({
        kind: fc.constant('linePlanned' as const),
        index: fc.nat(),
        planned: fc.integer({ min: 0, max: 900_000 }),
      }),
      fc.record({
        kind: fc.constant('total' as const),
        total: fc.integer({ min: 1000, max: 5_000_000 }),
      }),
      fc.record({
        kind: fc.constant('guests' as const),
        count: fc.integer({ min: 1, max: 1500 }),
        keep: fc.boolean(),
      }),
      fc.record({
        kind: fc.constant('vendorStatus' as const),
        index: fc.nat(),
        status: fc.constantFrom('researching', 'contacted', 'quoted', 'booked', 'paid'),
      }),
    );
    fc.assert(
      fc.property(fc.array(recipe, { maxLength: 25 }), (recipes) => {
        let plan = weddingPlan();
        for (const r of recipes) {
          const pick = <T>(list: readonly T[], index: number) => list[index % list.length]!;
          let next;
          switch (r.kind) {
            case 'taskStatus':
              next = op({
                type: 'task.update',
                id: pick(plan.tasks, r.index).id,
                patch: { status: r.status },
              });
              break;
            case 'taskDue': {
              const date = new Date(Date.UTC(2027, 1, 14) - r.offset * 86_400_000)
                .toISOString()
                .slice(0, 10);
              next = op({
                type: 'task.update',
                id: pick(plan.tasks, r.index).id,
                patch: { dueDate: date },
              });
              break;
            }
            case 'linePlanned':
              next = op({
                type: 'budget.updateLine',
                id: pick(plan.budget.lines, r.index).id,
                patch: { planned: r.planned },
              });
              break;
            case 'total':
              next = op({ type: 'budget.setTotal', total: r.total });
              break;
            case 'guests':
              next = op({ type: 'guests.setCount', guestCount: r.count, keepBudget: r.keep });
              break;
            case 'vendorStatus':
              next = op({
                type: 'vendor.update',
                id: pick(plan.vendors, r.index).id,
                patch: { status: r.status },
              });
              break;
          }
          plan = applyOperation(plan, next, ctx());
          expect(EventPlan.safeParse(plan).success).toBe(true);
          if (r.kind === 'total') {
            expect(plan.budget.lines.reduce((s, l) => s + l.planned, 0)).toBe(r.total);
          }
        }
      }),
      { numRuns: 60 },
    );
  });
});
