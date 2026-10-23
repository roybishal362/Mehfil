import { describe, expect, it } from 'vitest';
import { PlanOperation } from '../schemas/operations';
import { TODAY, editIds, weddingPlan } from '../test/fixtures';
import { diffPlans } from './diff';
import { applyOperations } from './operations';

const op = (input: unknown) => PlanOperation.parse(input);

describe('diffPlans', () => {
  it('reports nothing for identical plans', () => {
    const plan = weddingPlan();
    expect(diffPlans(plan, plan)).toEqual([]);
  });

  it('describes a Copilot-style proposal as before → after changes', () => {
    const before = weddingPlan();
    const task = before.tasks[0]!;
    const vendor = before.vendors[0]!;
    const after = applyOperations(
      before,
      [
        op({ type: 'guests.setCount', guestCount: 350, keepBudget: true }),
        op({
          type: 'task.add',
          task: { title: 'Confirm venue capacity for 350', dueDate: '2026-11-15' },
        }),
        op({ type: 'task.update', id: task.id, patch: { priority: 'low', status: 'done' } }),
        op({
          type: 'vendor.update',
          id: vendor.id,
          patch: { status: 'contacted', bookBy: '2026-11-30' },
        }),
        op({ type: 'budget.addLine', line: { label: 'Dhaki drummers', planned: 25_000 } }),
        op({
          type: 'idea.add',
          idea: { kind: 'food', title: 'Mishti doi bar', description: 'Clay pots of mishti doi.' },
        }),
        op({
          type: 'schedule.add',
          item: { day: '2027-02-14', time: '20:15', durationMinutes: 30, title: 'Sindoor daan' },
        }),
        op({ type: 'brief.update', patch: { date: '2027-02-15' } }),
      ],
      { today: TODAY, makeId: editIds() },
    );
    const changes = diffPlans(before, after);
    const kinds = changes.map((c) => c.kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        'event_date',
        'guest_count',
        'line_changed',
        'line_added',
        'task_added',
        'task_changed',
        'vendor_changed',
        'idea_added',
        'schedule_added',
      ]),
    );
    expect(changes.find((c) => c.kind === 'guest_count')).toEqual({
      kind: 'guest_count',
      before: 300,
      after: 350,
    });
    expect(
      changes
        .filter((c) => c.kind === 'task_changed' && c.id === task.id)
        .map((c) => 'field' in c && c.field),
    ).toEqual(expect.arrayContaining(['priority', 'status']));
  });

  it('reports removals and total changes', () => {
    const before = weddingPlan();
    const line = before.budget.lines[0]!;
    const after = applyOperations(
      before,
      [
        op({ type: 'budget.removeLine', id: line.id }),
        op({ type: 'task.remove', id: before.tasks[0]!.id }),
        op({ type: 'budget.setTotal', total: 1_500_000 }),
        op({
          type: 'vendor.add',
          vendor: { label: 'Shehnai players', priority: 'low', bookBy: '2027-01-10' },
        }),
      ],
      { today: TODAY, makeId: editIds() },
    );
    const kinds = diffPlans(before, after).map((c) => c.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(['line_removed', 'task_removed', 'budget_total', 'vendor_added']),
    );
  });
});

describe('diffPlans: labelled items', () => {
  it('carries custom labels for lines and vendors', () => {
    const base = weddingPlan();
    const withCustom = applyOperations(
      base,
      [
        op({ type: 'budget.addLine', line: { label: 'Dhaki drummers', planned: 25_000 } }),
        op({
          type: 'vendor.add',
          vendor: { label: 'Shehnai players', priority: 'low', bookBy: '2027-01-10' },
        }),
      ],
      { today: TODAY, makeId: editIds() },
    );
    const line = withCustom.budget.lines.at(-1)!;
    const vendor = withCustom.vendors.at(-1)!;
    const after = applyOperations(
      withCustom,
      [
        op({ type: 'budget.removeLine', id: line.id }),
        op({ type: 'vendor.update', id: vendor.id, patch: { status: 'contacted' } }),
        op({ type: 'budget.setTotal', total: 1_700_000 }),
      ],
      { today: TODAY, makeId: editIds() },
    );
    const changes = diffPlans(withCustom, after);
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: 'line_removed', label: 'Dhaki drummers' }),
    );
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: 'vendor_changed', label: 'Shehnai players' }),
    );
    expect(diffPlans(base, withCustom)).toContainEqual(
      expect.objectContaining({ kind: 'vendor_added', label: 'Shehnai players' }),
    );
  });
});
