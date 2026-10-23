/** Applying edits from the UI, with a friendly message when an edit cannot be made. */
import type { PlanOperationInput } from '../../../shared/schemas/operations';
import { toast } from '../../app/feedback';
import { useI18n } from '../../i18n';
import { plansStore } from '../../state/plans';

export function useEdit(planId: string): (...operations: PlanOperationInput[]) => boolean {
  const { t } = useI18n();
  return (...operations) => {
    const result = plansStore.getState().apply(planId, operations);
    if (!result.ok)
      toast(result.code === 'limit' ? t.edit.limit : t.edit.failed, { tone: 'error' });
    return result.ok;
  };
}
