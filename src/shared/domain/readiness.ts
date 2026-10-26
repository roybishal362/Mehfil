/**
 * Plan readiness: one score that blends task progress, vendor bookings and budget health,
 * plus the items that need attention today.
 */
import type { EventPlan, Vendor } from '../schemas/plan';
import { budgetHealth, summariseBudget, type BudgetSummary } from './budget';
import { PRIORITY_WEIGHT, taskState, taskStats } from './timeline';
import { STATUS_PROGRESS, committedByCategory, vendorState } from './vendors';

type AttentionItem =
  | { kind: 'task_overdue'; id: string }
  | { kind: 'vendor_overdue'; id: string }
  | { kind: 'line_overspent'; id: string }
  | { kind: 'budget_over' };

export interface Readiness {
  /** 0–100. */
  score: number;
  tasks: number;
  vendors: number;
  budget: number;
  attention: AttentionItem[];
}

const READINESS_WEIGHTS = { tasks: 0.5, vendors: 0.3, budget: 0.2 } as const;

/** Booking progress, weighting high-priority vendors more. A plan with no vendors is ready. */
function vendorProgress(vendors: EventPlan['vendors']): number {
  const weight = (vendor: Vendor) => PRIORITY_WEIGHT[vendor.priority];
  const total = vendors.reduce((sum, vendor) => sum + weight(vendor), 0);
  const done = vendors.reduce(
    (sum, vendor) => sum + weight(vendor) * STATUS_PROGRESS[vendor.status],
    0,
  );
  return total ? done / total : 1;
}

/** 1 when spending and planning fit the total; lower the further either goes over it. */
function budgetScore({ total, spent, planned }: BudgetSummary): number {
  if (total > 0 && spent > total) return Math.max(0, 1 - (spent - total) / total);
  if (planned > total && planned > 0) return total / planned;
  return 1;
}

function attentionItems(plan: EventPlan, summary: BudgetSummary, today: string): AttentionItem[] {
  return [
    ...(budgetHealth(summary) === 'over' ? [{ kind: 'budget_over' as const }] : []),
    ...plan.tasks
      .filter((task) => taskState(task, today) === 'overdue')
      .map((task) => ({ kind: 'task_overdue' as const, id: task.id })),
    ...plan.vendors
      .filter((vendor) => vendorState(vendor, today) === 'overdue')
      .map((vendor) => ({ kind: 'vendor_overdue' as const, id: vendor.id })),
    ...summary.overspentLineIds.map((id) => ({ kind: 'line_overspent' as const, id })),
  ];
}

export function readiness(plan: EventPlan, today: string): Readiness {
  const summary = summariseBudget(
    plan.budget,
    plan.brief.guestCount,
    committedByCategory(plan.vendors),
  );
  const tasks = taskStats(plan.tasks, today).progress;
  const vendors = vendorProgress(plan.vendors);
  const budget = budgetScore(summary);
  const score = Math.round(
    100 *
      (READINESS_WEIGHTS.tasks * tasks +
        READINESS_WEIGHTS.vendors * vendors +
        READINESS_WEIGHTS.budget * budget),
  );
  return { score, tasks, vendors, budget, attention: attentionItems(plan, summary, today) };
}
