import { describe, expect, it } from 'vitest';
import { EventPlan } from '../schemas/plan';
import { TODAY, weddingBrief, weddingPlan } from '../test/fixtures';
import { getTemplate } from '../templates';
import { diffDays } from '../utils/dates';
import { sequentialIds } from '../utils/ids';
import { createBaselinePlan, createSchedule } from './baseline';

describe('createBaselinePlan', () => {
  const plan = weddingPlan();

  it('produces a plan that satisfies the EventPlan schema', () => {
    expect(EventPlan.safeParse(plan).success).toBe(true);
  });

  it('splits the whole budget across the template categories', () => {
    expect(plan.budget.lines.reduce((s, l) => s + l.planned, 0)).toBe(1_800_000);
    expect(plan.budget.lines).toHaveLength(getTemplate('wedding').budget.length);
  });

  it('schedules every open task on or after today', () => {
    for (const task of plan.tasks) {
      expect(diffDays(task.dueDate, TODAY)).toBeGreaterThanOrEqual(0);
    }
    // 114 days are left, so the 365-day "set the budget" task is pulled in.
    expect(plan.tasks.find((t) => t.daysBefore === 365)?.compressed).toBe(true);
    expect(plan.tasks.find((t) => t.daysBefore === 7)?.dueDate).toBe('2027-02-07');
  });

  it('marks every section as template-only until Gemini personalises it', () => {
    expect(Object.values(plan.ai.sections).every((s) => s.status === 'template')).toBe(true);
  });

  it('writes the baseline in Hindi or Bengali when asked', () => {
    const hindi = createBaselinePlan(weddingBrief({ language: 'hi' }), {
      today: TODAY,
      now: '2026-10-23T10:00:00.000Z',
      makeId: sequentialIds(),
    });
    expect(hindi.tasks[0]?.title).toMatch(/[ऀ-ॿ]/);
  });

  it('creates birthday, community and other plans too', () => {
    for (const type of ['birthday', 'community', 'other'] as const) {
      const other = weddingPlan({ type, budget: 60_000, guestCount: 40 });
      expect(EventPlan.safeParse(other).success).toBe(true);
      expect(other.budget.lines.reduce((s, l) => s + l.planned, 0)).toBe(60_000);
    }
  });
});

describe('createSchedule', () => {
  it('aligns the run sheet with the start time', () => {
    const brief = weddingBrief({ startTime: '19:30' });
    const slots = createSchedule(getTemplate('wedding'), brief, sequentialIds());
    // The anchor ("guests arrive", 18:30 in the template) now starts at 19:30.
    expect(slots.some((s) => s.time === '19:30' && s.title.includes('Guests arrive'))).toBe(true);
    expect(slots.every((s) => s.day === '2027-02-14')).toBe(true);
  });

  it('keeps the template times without a start time', () => {
    const slots = createSchedule(
      getTemplate('birthday'),
      weddingBrief({ type: 'birthday' }),
      sequentialIds(),
    );
    expect(slots[0]?.time).toBe('14:30');
  });
});
