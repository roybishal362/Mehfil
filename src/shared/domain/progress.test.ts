import { describe, expect, it } from 'vitest';
import { TODAY, editContext, weddingPlan } from '../test/fixtures';
import { applyOperations } from './operations';
import { PROGRESS_PARTS, planProgress } from './progress';

describe('planProgress', () => {
  it('starts a fresh plan with only its drafted budget under way', () => {
    const progress = planProgress(weddingPlan(), TODAY);
    expect(Object.keys(progress)).toEqual([...PROGRESS_PARTS]);
    expect(progress).toEqual({
      budget: 0.6,
      timeline: 0,
      vendors: 0,
      ideas: 0,
      guests: 0,
      dayOf: 0,
    });
  });

  it('fills each part as the plan comes together', () => {
    const plan = weddingPlan();
    const [firstTask] = plan.tasks;
    const [firstVendor] = plan.vendors;
    const [firstSlot] = plan.schedule;
    if (!firstTask || !firstVendor || !firstSlot) throw new Error('fixture plan is empty');
    const updated = applyOperations(
      plan,
      [
        { type: 'task.update', id: firstTask.id, patch: { status: 'done' } },
        { type: 'vendor.update', id: firstVendor.id, patch: { status: 'booked' } },
        {
          type: 'idea.add',
          idea: { kind: 'decor', title: 'Marigold torans', description: 'Over every door.' },
        },
        { type: 'guest.add', guest: { name: 'Mashi', partySize: 30, rsvp: 'pending' } },
        { type: 'schedule.update', id: firstSlot.id, patch: { owner: 'Rohan' } },
      ],
      editContext(),
    );
    const progress = planProgress(updated, TODAY);
    expect(progress.timeline).toBeGreaterThan(0);
    expect(progress.vendors).toBeGreaterThan(0);
    expect(progress.ideas).toBeCloseTo(1 / 12, 2);
    expect(progress.guests).toBe(0.1);
    expect(progress.dayOf).toBeGreaterThan(0);
    for (const value of Object.values(progress)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('caps every part at full', () => {
    const plan = weddingPlan({ guestCount: 10 });
    const guests = applyOperations(
      plan,
      [{ type: 'guest.add', guest: { name: 'The whole para', partySize: 20, rsvp: 'pending' } }],
      editContext(),
    );
    expect(planProgress(guests, TODAY).guests).toBe(1);
    expect(planProgress({ ...plan, schedule: [] }, TODAY).dayOf).toBe(0);
  });
});
