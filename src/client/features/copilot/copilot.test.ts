import { describe, expect, it } from 'vitest';
import { CopilotPlanContext } from '../../../shared/schemas/ai';
import { META } from '../../test/ai-fixtures';
import { jsonResponse, mockApi, seedPlan } from '../../test/helpers';
import { plansStore } from '../../state/plans';
import {
  applyProposal,
  askCopilot,
  copilotContext,
  dismissProposal,
  previewProposal,
  selectedOperations,
  toggleProposal,
  useCopilot,
} from './copilot';

const conversation = (planId: string) => useCopilot.getState().conversations[planId];

describe('copilotContext', () => {
  it('sends a compact, valid view of the plan, open tasks first', () => {
    const plan = seedPlan();
    const [first] = plan.tasks;
    if (!first) throw new Error('fixture has no tasks');
    plansStore
      .getState()
      .apply(plan.id, [{ type: 'task.update', id: first.id, patch: { status: 'done' } }]);
    const updated = plansStore.getState().plans[plan.id];
    if (!updated) throw new Error('plan missing');
    const context = copilotContext(updated);
    expect(CopilotPlanContext.safeParse(context).success).toBe(true);
    expect(context.tasks.at(-1)?.id).toBe(first.id);
    expect(context.budget.lines.find((line) => line.name === 'Catering')).toBeDefined();
  });
});

describe('Copilot conversation', () => {
  it('turns an answer into a proposal the user reviews before applying', async () => {
    const plan = seedPlan();
    const { calls } = mockApi({
      '/api/ai/copilot': () =>
        jsonResponse({
          reply: 'I will plan for 350 guests.',
          operations: [
            { type: 'guests.setCount', guestCount: 350, keepBudget: true },
            {
              type: 'idea.add',
              idea: { kind: 'food', title: 'Mishti doi', description: 'Clay pots.' },
            },
          ],
          dropped: 1,
          meta: META,
        }),
    });
    await askCopilot(plan.id, '  We now expect 350 guests  ');
    expect(calls[0]?.body).toMatchObject({ message: 'We now expect 350 guests', history: [] });
    const proposal = conversation(plan.id)?.proposal;
    expect(conversation(plan.id)?.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(proposal?.dropped).toBe(1);
    if (!proposal) throw new Error('no proposal');

    const before = plansStore.getState().plans[plan.id];
    if (!before) throw new Error('plan missing');
    expect(previewProposal(before, proposal)?.brief.guestCount).toBe(350);
    expect(plansStore.getState().plans[plan.id]?.brief.guestCount).toBe(300);

    toggleProposal(plan.id, 1);
    const toggled = conversation(plan.id)?.proposal;
    if (!toggled) throw new Error('no proposal');
    expect(selectedOperations(toggled)).toHaveLength(1);
    expect(applyProposal(plan.id)).toBe(1);
    expect(plansStore.getState().plans[plan.id]?.brief.guestCount).toBe(350);
    expect(plansStore.getState().plans[plan.id]?.ideas).toHaveLength(0);
    expect(conversation(plan.id)?.proposal).toBeNull();
    expect(applyProposal(plan.id)).toBeNull();

    // The next question carries the history.
    await askCopilot(plan.id, 'Thanks');
    expect(calls[1]?.body).toMatchObject({ history: [{ role: 'user' }, { role: 'assistant' }] });
  });

  it('flags failures without touching the plan, and ignores empty questions', async () => {
    const plan = seedPlan();
    mockApi({
      '/api/ai/copilot': () => jsonResponse({ code: 'ai_unavailable', message: 'x' }, 503),
    });
    await askCopilot(plan.id, '   ');
    expect(conversation(plan.id)).toBeUndefined();
    await askCopilot(plan.id, 'Hello');
    expect(conversation(plan.id)).toMatchObject({ busy: false, failed: true, proposal: null });
    await askCopilot('evt_missing', 'Hello');
  });

  it('can dismiss a proposal, and refuses one that no longer fits', async () => {
    const plan = seedPlan();
    mockApi({
      '/api/ai/copilot': () =>
        jsonResponse({
          reply: 'Removing that task.',
          operations: [{ type: 'task.remove', id: plan.tasks[0]?.id ?? 'x' }],
          dropped: 0,
          meta: META,
        }),
    });
    await askCopilot(plan.id, 'Remove the first task');
    dismissProposal(plan.id);
    expect(conversation(plan.id)?.proposal).toBeNull();
    toggleProposal(plan.id, 0);

    await askCopilot(plan.id, 'Remove the first task');
    plansStore.getState().apply(plan.id, [{ type: 'task.remove', id: plan.tasks[0]?.id ?? 'x' }]);
    const proposal = conversation(plan.id)?.proposal;
    const current = plansStore.getState().plans[plan.id];
    if (!proposal || !current) throw new Error('missing state');
    expect(previewProposal(current, proposal)).toBeNull();
    expect(applyProposal(plan.id)).toBeNull();
  });
});
