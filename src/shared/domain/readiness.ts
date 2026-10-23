/**
 * Plan readiness: one score that blends task progress, vendor bookings and budget health,
 * plus the items that need attention today.
 */
import type { EventPlan } from '../schemas/plan';
import { budgetHealth, summariseBudget } from './budget';
import { PRIORITY_WEIGHT, taskState, taskStats } from './timeline';
import { STATUS_PROGRESS, committedByCategory, vendorState } from './vendors';

export type AttentionItem =
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

export const READINESS_WEIGHTS = { tasks: 0.5, vendors: 0.3, budget: 0.2 } as const;

export function readiness(plan: EventPlan, today: string): Readiness {
  const tasks = taskStats(plan.tasks, today).progress;

  let vendorWeight = 0;
  let vendorDone = 0;
  for (const vendor of plan.vendors) {
    const weight = PRIORITY_WEIGHT[vendor.priority];
    vendorWeight += weight;
    vendorDone += weight * STATUS_PROGRESS[vendor.status];
  }
  const vendors = vendorWeight ? vendorDone / vendorWeight : 1;

  const summary = summariseBudget(
    plan.budget,
    plan.brief.guestCount,
    committedByCategory(plan.vendors),
  );
  const health = budgetHealth(summary);
  let budget = 1;
  if (summary.total > 0 && summary.spent > summary.total) {
    budget = Math.max(0, 1 - (summary.spent - summary.total) / summary.total);
  } else if (summary.planned > summary.total && summary.planned > 0) {
    budget = summary.total / summary.planned;
  }

  const attention: AttentionItem[] = [];
  if (health === 'over') attention.push({ kind: 'budget_over' });
  for (const task of plan.tasks) {
    if (taskState(task, today) === 'overdue') attention.push({ kind: 'task_overdue', id: task.id });
  }
  for (const vendor of plan.vendors) {
    if (vendorState(vendor, today) === 'overdue')
      attention.push({ kind: 'vendor_overdue', id: vendor.id });
  }
  for (const id of summary.overspentLineIds) attention.push({ kind: 'line_overspent', id });

  const score = Math.round(
    100 *
      (READINESS_WEIGHTS.tasks * tasks +
        READINESS_WEIGHTS.vendors * vendors +
        READINESS_WEIGHTS.budget * budget),
  );
  return { score, tasks, vendors, budget, attention };
}
