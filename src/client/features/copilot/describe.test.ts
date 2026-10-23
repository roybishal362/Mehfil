import { describe, expect, it } from 'vitest';
import type { PlanChange } from '../../../shared/domain/diff';
import type { PlanOperation } from '../../../shared/schemas/operations';
import { weddingPlan } from '../../../shared/test/fixtures';
import { en } from '../../i18n/en';
import { formatters } from '../../i18n/format';
import { describeChange, describeOperation } from './describe';

const plan = weddingPlan();
const f = formatters('en');
const line = plan.budget.lines[0];
const task = plan.tasks[0];
const vendor = plan.vendors[0];
if (!line || !task || !vendor) throw new Error('fixture plan is incomplete');

describe('describeOperation', () => {
  it.each<[PlanOperation, string, string]>([
    [{ type: 'guests.setCount', guestCount: 350, keepBudget: true }, 'Guests', '300 → 350'],
    [
      { type: 'budget.setTotal', total: 1_700_000, protectIds: [] },
      'Total budget',
      '₹18,00,000 → ₹17,00,000',
    ],
    [{ type: 'budget.updateLine', id: line.id, patch: { planned: 100_000 } }, 'Venue', '₹1,00,000'],
    [{ type: 'budget.updateLine', id: 'line_404', patch: { notes: 'x' } }, 'Total budget', ''],
    [
      { type: 'budget.addLine', line: { label: 'Dhaki', planned: 20_000 } },
      'New budget line',
      'Dhaki · ₹20,000',
    ],
    [
      {
        type: 'task.add',
        task: {
          title: 'Book shehnai',
          dueDate: '2026-12-01',
          priority: 'low',
          category: 'vendors',
        },
      },
      'New task',
      'Book shehnai · 1 Dec',
    ],
    [
      {
        type: 'task.update',
        id: task.id,
        patch: { status: 'done', dueDate: '2026-11-05', priority: 'high' },
      },
      task.title,
      'Done · 5 Nov · High',
    ],
    [{ type: 'task.remove', id: task.id }, 'Remove task', task.title],
    [
      { type: 'vendor.update', id: vendor.id, patch: { status: 'booked', bookBy: '2026-11-20' } },
      'Venue',
      'Booked · 20 Nov',
    ],
    [{ type: 'vendor.update', id: 'vendor_404', patch: {} }, 'New vendor', ''],
    [
      { type: 'idea.add', idea: { kind: 'food', title: 'Mishti doi', description: 'Clay pots' } },
      'New idea',
      'Mishti doi',
    ],
    [
      {
        type: 'schedule.add',
        item: { day: '2027-02-14', time: '19:30', durationMinutes: 60, title: 'Baran' },
      },
      'Run sheet',
      '14 Feb',
    ],
    [{ type: 'brief.update', patch: { city: 'Howrah' } }, 'Event details', ''],
    [{ type: 'budget.removeLine', id: line.id }, 'Remove budget line', 'Venue'],
    [{ type: 'guest.remove', id: 'guest_1' }, 'Guest list', ''],
    [
      { type: 'vendor.add', vendor: { label: 'Dhaki', priority: 'low', bookBy: '2026-12-01' } },
      'New vendor',
      'Dhaki',
    ],
    [{ type: 'vendor.remove', id: vendor.id }, 'Vendors', ''],
    [{ type: 'idea.remove', id: 'idea_1' }, 'Ideas', ''],
    [{ type: 'schedule.remove', id: 'slot_1' }, 'Run sheet', ''],
    [{ type: 'risk.remove', id: 'risk_1' }, 'Plan B', ''],
  ])('describes %o', (op, what, detail) => {
    const described = describeOperation(op, plan, en, f);
    expect(described.what).toBe(what);
    expect(described.detail).toContain(detail);
  });
});

describe('describeChange', () => {
  it.each<[PlanChange, string, number | undefined]>([
    [{ kind: 'budget_total', before: 1_800_000, after: 1_700_000 }, 'Total budget', -100_000],
    [{ kind: 'guest_count', before: 300, after: 350 }, 'Guests', undefined],
    [{ kind: 'event_date', before: '2027-02-14', after: '2027-02-21' }, 'Event date', undefined],
    [{ kind: 'line_changed', id: 'l', category: 'decor', before: 100, after: 150 }, 'Decor', 50],
    [{ kind: 'line_added', id: 'l', label: 'Dhaki', planned: 20 }, 'New budget line', 20],
    [
      { kind: 'line_removed', id: 'l', category: 'custom', label: 'Fireworks', planned: 30 },
      'Fireworks',
      -30,
    ],
    [
      { kind: 'task_added', id: 't', title: 'Book shehnai', dueDate: '2026-12-01' },
      'New task',
      undefined,
    ],
    [{ kind: 'task_removed', id: 't', title: 'Old task' }, 'Remove task', undefined],
    [
      {
        kind: 'task_changed',
        id: 't',
        title: 'Venue',
        field: 'dueDate',
        before: '2026-11-01',
        after: '2026-11-05',
      },
      'Venue',
      undefined,
    ],
    [
      {
        kind: 'task_changed',
        id: 't',
        title: 'Venue',
        field: 'status',
        before: 'todo',
        after: 'done',
      },
      'Venue',
      undefined,
    ],
    [
      {
        kind: 'vendor_changed',
        id: 'v',
        category: 'caterer',
        field: 'status',
        before: 'quoted',
        after: 'booked',
      },
      'Caterer',
      undefined,
    ],
    [
      {
        kind: 'vendor_changed',
        id: 'v',
        category: 'caterer',
        label: 'Sen',
        field: 'status',
        before: 'odd',
        after: 'booked',
      },
      'Sen',
      undefined,
    ],
    [
      {
        kind: 'vendor_changed',
        id: 'v',
        category: 'venue',
        field: 'bookBy',
        before: '2026-11-01',
        after: '2026-11-05',
      },
      'Venue',
      undefined,
    ],
    [{ kind: 'vendor_added', id: 'v', label: 'Dhaki' }, 'New vendor', undefined],
    [{ kind: 'idea_added', id: 'i', title: 'Mishti doi' }, 'New idea', undefined],
    [
      { kind: 'schedule_added', id: 's', day: '2027-02-14', time: '19:30', title: 'Baran' },
      'Run sheet',
      undefined,
    ],
  ])('describes %o', (change, what, delta) => {
    const described = describeChange(change, plan, en, f);
    expect(described.what).toBe(what);
    expect(described.delta).toBe(delta);
    expect(described.detail.length).toBeGreaterThan(0);
  });

  it('labels vendor statuses and leaves unknown values as they are', () => {
    expect(
      describeChange(
        {
          kind: 'vendor_changed',
          id: 'v',
          category: 'caterer',
          field: 'status',
          before: 'odd',
          after: 'booked',
        },
        plan,
        en,
        f,
      ).detail,
    ).toBe('odd → Booked');
  });
});
