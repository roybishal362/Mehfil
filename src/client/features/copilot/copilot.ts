/**
 * The Copilot conversation for each plan. Gemini answers with typed operations; they are shown
 * as a reviewable proposal and applied only when the user approves them, through the same
 * `applyOperations` as every other edit (so they can be undone).
 */
import { create } from 'zustand';
import { applyOperations } from '../../../shared/domain/operations';
import {
  CopilotApiResponse,
  type CopilotMessage,
  type CopilotPlanContext,
} from '../../../shared/schemas/ai';
import type { PlanOperation } from '../../../shared/schemas/operations';
import type { EventPlan } from '../../../shared/schemas/plan';
import { localToday } from '../../../shared/utils/dates';
import { createId } from '../../../shared/utils/ids';
import { en } from '../../i18n/en';
import { postJson } from '../../lib/api';
import { plansStore } from '../../state/plans';

export interface Proposal {
  operations: PlanOperation[];
  selected: boolean[];
  dropped: number;
}

export interface Conversation {
  messages: CopilotMessage[];
  proposal: Proposal | null;
  busy: boolean;
  failed: boolean;
}

const EMPTY: Conversation = { messages: [], proposal: null, busy: false, failed: false };
const HISTORY_SENT = 8;

interface CopilotState {
  conversations: Readonly<Record<string, Conversation>>;
}

export const useCopilot = create<CopilotState>()(() => ({ conversations: {} }));

export function useConversation(planId: string): Conversation {
  return useCopilot((state) => state.conversations[planId] ?? EMPTY);
}

function update(planId: string, change: (conversation: Conversation) => Conversation): void {
  useCopilot.setState((state) => ({
    conversations: {
      ...state.conversations,
      [planId]: change(state.conversations[planId] ?? EMPTY),
    },
  }));
}

/** The compact, id-bearing view of a plan that the Copilot reasons over. */
export function copilotContext(plan: EventPlan): CopilotPlanContext {
  const tasks = [...plan.tasks]
    .sort(
      (a, b) =>
        Number(a.status === 'done') - Number(b.status === 'done') ||
        a.dueDate.localeCompare(b.dueDate),
    )
    .slice(0, 80);
  return {
    budget: {
      total: plan.budget.total,
      lines: plan.budget.lines.slice(0, 40).map((line) => ({
        id: line.id,
        name: (line.label ?? en.budgetCategories[line.category]).slice(0, 60),
        planned: line.planned,
        spent: line.spent,
        perGuest: line.perGuest,
      })),
    },
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
    })),
    vendors: plan.vendors.slice(0, 40).map((vendor) => ({
      id: vendor.id,
      name: (vendor.label ?? en.vendorCategories[vendor.category]).slice(0, 60),
      status: vendor.status,
      bookBy: vendor.bookBy,
    })),
  };
}

export async function askCopilot(planId: string, message: string): Promise<void> {
  const plan = plansStore.getState().plans[planId];
  const text = message.trim();
  if (!plan || !text) return;
  const history = (useCopilot.getState().conversations[planId] ?? EMPTY).messages.slice(
    -HISTORY_SENT,
  );
  update(planId, (conversation) => ({
    ...conversation,
    messages: [...conversation.messages, { role: 'user', text }],
    proposal: null,
    busy: true,
    failed: false,
  }));
  try {
    const response = await postJson(
      '/api/ai/copilot',
      {
        brief: plan.brief,
        today: localToday(),
        plan: copilotContext(plan),
        history,
        message: text,
      },
      CopilotApiResponse,
    );
    update(planId, (conversation) => ({
      ...conversation,
      busy: false,
      messages: [...conversation.messages, { role: 'assistant', text: response.reply }],
      proposal:
        response.operations.length > 0 || response.dropped > 0
          ? {
              operations: response.operations,
              selected: response.operations.map(() => true),
              dropped: response.dropped,
            }
          : null,
    }));
  } catch {
    update(planId, (conversation) => ({ ...conversation, busy: false, failed: true }));
  }
}

export function toggleProposal(planId: string, index: number): void {
  update(planId, (conversation) =>
    conversation.proposal
      ? {
          ...conversation,
          proposal: {
            ...conversation.proposal,
            selected: conversation.proposal.selected.map((value, i) =>
              i === index ? !value : value,
            ),
          },
        }
      : conversation,
  );
}

export function selectedOperations(proposal: Proposal): PlanOperation[] {
  return proposal.operations.filter((_, index) => proposal.selected[index]);
}

/** The plan as it would look with the selected changes, or null if they no longer fit. */
export function previewProposal(plan: EventPlan, proposal: Proposal): EventPlan | null {
  try {
    return applyOperations(plan, selectedOperations(proposal), {
      today: localToday(),
      makeId: createId,
      source: 'ai',
    });
  } catch {
    return null;
  }
}

/** Applies the selected changes. Returns how many were applied, or null if they failed. */
export function applyProposal(planId: string): number | null {
  const proposal = useCopilot.getState().conversations[planId]?.proposal;
  if (!proposal) return null;
  const operations = selectedOperations(proposal);
  const result = plansStore.getState().apply(planId, operations, 'ai');
  if (!result.ok) return null;
  update(planId, (conversation) => ({ ...conversation, proposal: null }));
  return operations.length;
}

export function dismissProposal(planId: string): void {
  update(planId, (conversation) => ({ ...conversation, proposal: null }));
}
