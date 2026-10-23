import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Task } from '../schemas/plan';
import { addDays, diffDays } from '../utils/dates';
import {
  compressLeadTimes,
  countdown,
  groupByPhase,
  nextTasks,
  phaseFor,
  rescheduleTasks,
  scheduleLeadTimes,
  taskState,
  taskStats,
} from './timeline';

function task(partial: Partial<Task> & Pick<Task, 'id' | 'dueDate'>): Task {
  return {
    title: partial.id,
    daysBefore: 10,
    priority: 'medium',
    status: 'todo',
    category: 'planning',
    compressed: false,
    source: 'template',
    ...partial,
  };
}

describe('compressLeadTimes', () => {
  it('keeps ideal lead times when there is enough time', () => {
    expect(compressLeadTimes([300, 60, 7, -7], 400)).toEqual([300, 60, 7, -7]);
  });

  it('squeezes long lead times into the window but keeps short ones intact', () => {
    const mapped = compressLeadTimes([365, 300, 60, 14, 7, -14], 30);
    expect(mapped).toEqual([30, 27, 17, 14, 7, -14]);
  });

  it('puts everything on the day when the event is today', () => {
    expect(compressLeadTimes([90, 10, 0], 0)).toEqual([0, 0, 0]);
  });

  it('is monotonic and never schedules before today (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 730 }), { minLength: 1, maxLength: 30 }),
        fc.integer({ min: 0, max: 400 }),
        (leads, daysLeft) => {
          const sorted = [...leads].sort((a, b) => a - b);
          const mapped = compressLeadTimes(sorted, daysLeft);
          for (let i = 1; i < mapped.length; i += 1) {
            expect(mapped[i]).toBeGreaterThanOrEqual(mapped[i - 1] ?? 0);
          }
          mapped.forEach((m, i) => {
            expect(m).toBeLessThanOrEqual(Math.max(daysLeft, sorted[i] ?? 0));
            if ((sorted[i] ?? 0) > daysLeft) expect(m).toBeLessThanOrEqual(daysLeft);
          });
        },
      ),
    );
  });
});

describe('scheduleLeadTimes', () => {
  it('turns lead times into due dates and marks compressed ones', () => {
    const result = scheduleLeadTimes([300, 7, -14], '2027-02-14', '2026-12-16');
    expect(result[0]).toEqual({ dueDate: '2026-12-16', compressed: true });
    expect(result[1]).toEqual({ dueDate: '2027-02-07', compressed: false });
    expect(result[2]).toEqual({ dueDate: '2027-02-28', compressed: false });
  });

  it('never schedules an open task before today (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -30, max: 600 }), { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 500 }),
        (leads, daysLeft) => {
          const today = '2026-10-23';
          const eventDate = addDays(today, daysLeft);
          for (const { dueDate } of scheduleLeadTimes(leads, eventDate, today)) {
            expect(diffDays(dueDate, today)).toBeGreaterThanOrEqual(0);
          }
        },
      ),
    );
  });
});

describe('rescheduleTasks', () => {
  it('moves open tasks with the event date and leaves finished ones alone', () => {
    const tasks = [
      task({ id: 'open', dueDate: '2027-02-07', daysBefore: 7 }),
      task({ id: 'done', dueDate: '2026-11-01', daysBefore: 100, status: 'done' }),
    ];
    const next = rescheduleTasks(tasks, '2027-03-14', '2026-10-23');
    expect(next.find((t) => t.id === 'open')?.dueDate).toBe('2027-03-07');
    expect(next.find((t) => t.id === 'done')?.dueDate).toBe('2026-11-01');
  });
});

describe('taskState', () => {
  const today = '2026-10-23';
  it.each([
    [task({ id: 'a', dueDate: '2026-10-20' }), 'overdue'],
    [task({ id: 'b', dueDate: '2026-10-23' }), 'due_soon'],
    [task({ id: 'c', dueDate: '2026-10-30' }), 'due_soon'],
    [task({ id: 'd', dueDate: '2026-10-31' }), 'upcoming'],
    [task({ id: 'e', dueDate: '2026-10-01', status: 'done' }), 'done'],
  ] as const)('classifies %#', (t, expected) => {
    expect(taskState(t, today)).toBe(expected);
  });
});

describe('phases', () => {
  const eventDate = '2027-02-14';
  it.each([
    ['2026-01-01', 'twelve_months'],
    ['2026-07-01', 'six_months'],
    ['2026-11-01', 'three_months'],
    ['2026-12-20', 'one_month'],
    ['2027-01-25', 'two_weeks'],
    ['2027-02-07', 'final_days'],
    ['2027-02-14', 'event_day'],
    ['2027-02-20', 'after'],
  ])('puts %s in %s', (due, phase) => {
    expect(phaseFor(due, eventDate)).toBe(phase);
  });

  it('groups tasks chronologically and skips empty phases', () => {
    const groups = groupByPhase(
      [
        task({ id: 'late', dueDate: '2027-02-10', priority: 'low' }),
        task({ id: 'early', dueDate: '2026-11-01' }),
        task({ id: 'late-high', dueDate: '2027-02-10', priority: 'high' }),
      ],
      eventDate,
    );
    expect(groups.map((g) => g.phase)).toEqual(['three_months', 'final_days']);
    expect(groups[1]?.tasks.map((t) => t.id)).toEqual(['late-high', 'late']);
  });
});

describe('taskStats and nextTasks', () => {
  const today = '2026-10-23';
  const tasks = [
    task({ id: 'h', dueDate: '2026-10-01', priority: 'high', status: 'done' }),
    task({ id: 'm', dueDate: '2026-10-20', priority: 'medium' }),
    task({ id: 'l', dueDate: '2026-10-25', priority: 'low' }),
  ];

  it('weights progress by priority', () => {
    expect(taskStats(tasks, today)).toEqual({
      total: 3,
      done: 1,
      overdue: 1,
      dueSoon: 1,
      progress: 0.5,
    });
    expect(taskStats([], today).progress).toBe(0);
  });

  it('lists open tasks, earliest first', () => {
    expect(nextTasks(tasks).map((t) => t.id)).toEqual(['m', 'l']);
    expect(nextTasks(tasks, 1)).toHaveLength(1);
  });
});

describe('countdown', () => {
  it('counts down to a future event', () => {
    expect(countdown({ date: '2027-02-14' }, '2026-10-23')).toEqual({
      kind: 'upcoming',
      days: 114,
    });
  });
  it('recognises the day itself', () => {
    expect(countdown({ date: '2027-02-14' }, '2027-02-14')).toEqual({ kind: 'today' });
  });
  it('tracks multi-day celebrations', () => {
    const brief = { date: '2027-02-12', endDate: '2027-02-14' };
    expect(countdown(brief, '2027-02-13')).toEqual({ kind: 'ongoing', day: 2, of: 3 });
    expect(countdown(brief, '2027-02-16')).toEqual({ kind: 'past', days: 2 });
  });
});
