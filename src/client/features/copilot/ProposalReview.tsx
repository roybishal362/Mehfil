/**
 * The Copilot's proposed changes: a checklist of operations, the before → after effect on the
 * plan, and Apply / Dismiss. Nothing changes until the user applies.
 */
import { diffPlans, type PlanChange } from '../../../shared/domain/diff';
import type { EventPlan } from '../../../shared/schemas/plan';
import { toast } from '../../app/feedback';
import { useI18n } from '../../i18n';
import { plansStore } from '../../state/plans';
import {
  applyProposal,
  dismissProposal,
  previewProposal,
  selectedOperations,
  toggleProposal,
  type Proposal,
} from './copilot';
import { describeChange, describeOperation } from './describe';

function ProposalList({ plan, proposal }: { plan: EventPlan; proposal: Proposal }) {
  const { t, f } = useI18n();
  return (
    <>
      <p className="text-ink-2">{t.copilot.review}</p>
      <ul className="proposals" aria-label={t.copilotOps.proposalsLabel}>
        {proposal.operations.map((op, index) => {
          const described = describeOperation(op, plan, t, f);
          return (
            // Proposals are fixed once received, so their index is a stable key.
            <li key={index}>
              <label>
                <input
                  type="checkbox"
                  className="check"
                  checked={proposal.selected[index] ?? false}
                  onChange={() => {
                    toggleProposal(plan.id, index);
                  }}
                />
                <span>
                  <span className="what">{described.what}</span>
                  {described.detail && <span className="vals">{described.detail}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** What the selected changes would do, line by line, with money moved up or down. */
function ChangeList({ plan, changes }: { plan: EventPlan; changes: readonly PlanChange[] }) {
  const { t, f } = useI18n();
  return (
    <details className="changes">
      <summary>{t.copilotOps.changesTitle}</summary>
      <ul className="legend">
        {changes.map((change) => {
          const { what, detail, delta } = describeChange(change, plan, t, f);
          return (
            <li key={`${change.kind}-${'id' in change ? change.id : what}`}>
              <span>
                {what}: {detail}
              </span>
              {delta !== undefined && delta !== 0 && (
                <b className={delta > 0 ? 'delta delta--up' : 'delta delta--down'}>
                  {delta > 0 ? '+' : '−'}
                  {f.money(Math.abs(delta), plan.budget.currency)}
                </b>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function ProposalReview({ plan, proposal }: { plan: EventPlan; proposal: Proposal }) {
  const { t, f } = useI18n();
  const preview = previewProposal(plan, proposal);
  const changes = preview ? diffPlans(plan, preview) : [];
  const selectedCount = selectedOperations(proposal).length;

  const apply = () => {
    const applied = applyProposal(plan.id);
    if (applied === null) {
      toast(t.copilot.error, { tone: 'error' });
      return;
    }
    const undo = {
      label: t.common.undo,
      run: () => {
        plansStore.getState().undo(plan.id);
      },
    };
    toast(t.copilot.applied(f.number(applied), applied), { action: undo });
  };

  return (
    <div className="grid gap-3">
      {proposal.operations.length > 0 && <ProposalList plan={plan} proposal={proposal} />}
      {changes.length > 0 && <ChangeList plan={plan} changes={changes} />}
      {proposal.dropped > 0 && (
        <p className="note">{t.copilot.dropped(f.number(proposal.dropped), proposal.dropped)}</p>
      )}
      <div className="co-actions">
        {proposal.operations.length > 0 && (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={selectedCount === 0 || preview === null}
            onClick={apply}
          >
            {t.copilot.apply(f.number(selectedCount), selectedCount)}
          </button>
        )}
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            dismissProposal(plan.id);
          }}
        >
          {t.common.dismiss}
        </button>
      </div>
    </div>
  );
}
