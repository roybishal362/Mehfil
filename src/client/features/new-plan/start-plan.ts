/**
 * Creating a plan: the deterministic baseline appears instantly, then Gemini personalises it
 * section by section in the background.
 */
import { createBaselinePlan } from '../../../shared/domain/baseline';
import type { EventBrief } from '../../../shared/schemas/brief';
import type { AiSection } from '../../../shared/schemas/primitives';
import { localToday } from '../../../shared/utils/dates';
import { createId } from '../../../shared/utils/ids';
import { personalizePlan } from '../../state/ai';
import { plansStore } from '../../state/plans';

export interface StartPlanOptions {
  onSection?: (section: AiSection, state: 'done' | 'failed') => void;
}

/** Saves a new plan and starts personalising it. Returns the plan's id. */
export function startPlan(brief: EventBrief, { onSection }: StartPlanOptions = {}): string {
  const plan = createBaselinePlan(brief, {
    today: localToday(),
    now: new Date().toISOString(),
    makeId: createId,
  });
  plansStore.getState().addPlan(plan);
  void personalizePlan(plan.id, onSection ? { onSection } : {});
  return plan.id;
}
