/**
 * The budget lines: planned, spent and paid for each line, editable in place, with a form to
 * add a line. Spent counts the chosen quotes of booked vendors, so overspending shows early.
 */
import { Info, Plus, Trash2 } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import type { EventPlan } from '../../../shared/schemas/plan';
import { parseAmount } from '../../../shared/utils/money';
import { AmountInput } from '../../components/AmountInput';
import { Field } from '../../components/Field';
import { useI18n } from '../../i18n';
import { writtenIn } from '../../i18n/written-in';
import { useEdit } from '../plan/use-edit';

interface BudgetLinesProps {
  plan: EventPlan;
  /** Spent per line, including what booked vendors have committed. */
  spentByLine: readonly number[];
  onInvalid: () => void;
}

export function BudgetLines({ plan, spentByLine, onInvalid }: BudgetLinesProps) {
  const { t, f } = useI18n();
  const edit = useEdit(plan.id);
  const { budget } = plan;
  const [lineLabel, setLineLabel] = useState('');
  const [lineAmount, setLineAmount] = useState('');

  const addLine = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const planned = parseAmount(lineAmount);
    if (!lineLabel.trim() || planned === null) {
      onInvalid();
      return;
    }
    if (edit({ type: 'budget.addLine', line: { label: lineLabel.trim(), planned } })) {
      setLineLabel('');
      setLineAmount('');
    }
  };

  return (
    <div className="card">
      <h3 className="mb-3 text-2xl">{t.budgetSection.lines}</h3>
      <div className="table-wrap">
        <table className="lines">
          <caption className="sr-only">{t.budgetSection.lines}</caption>
          <thead>
            <tr>
              <th scope="col">{t.budgetSection.category}</th>
              <th scope="col">{t.budgetSection.planned}</th>
              <th scope="col">{t.budgetSection.spent}</th>
              <th scope="col">{t.budgetSection.paid}</th>
              <th scope="col">
                <span className="sr-only">{t.budgetSection.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {budget.lines.map((line, index) => {
              const label = line.label ?? t.budgetCategories[line.category];
              const spent = spentByLine[index] ?? line.spent;
              return (
                <tr key={line.id}>
                  <th scope="row">
                    <span className="line-name">{label}</span>
                    <span className="line-meta">
                      {f.percent(budget.total > 0 ? line.planned / budget.total : 0)}
                      {line.perGuest && (
                        <span className="pill pill--plain">{t.budgetSection.perGuestBadge}</span>
                      )}
                      {spent > line.planned && (
                        <span className="pill pill--danger">{t.budgetSection.overspent}</span>
                      )}
                      {line.source === 'ai' && <span className="pill pill--ai">Gemini</span>}
                    </span>
                    {line.rationale && (
                      <span className="line-why" {...writtenIn(plan.brief.language)}>
                        {line.rationale}
                      </span>
                    )}
                  </th>
                  <td>
                    <AmountInput
                      value={line.planned}
                      label={t.budgetSection.editLine(label, t.budgetSection.planned)}
                      onCommit={(planned) =>
                        edit({ type: 'budget.updateLine', id: line.id, patch: { planned } })
                      }
                      onInvalid={onInvalid}
                    />
                  </td>
                  <td>
                    <AmountInput
                      value={line.spent}
                      label={t.budgetSection.editLine(label, t.budgetSection.spent)}
                      onCommit={(value) =>
                        edit({ type: 'budget.updateLine', id: line.id, patch: { spent: value } })
                      }
                      onInvalid={onInvalid}
                    />
                  </td>
                  <td>
                    <AmountInput
                      value={line.paid}
                      label={t.budgetSection.editLine(label, t.budgetSection.paid)}
                      onCommit={(paid) =>
                        edit({ type: 'budget.updateLine', id: line.id, patch: { paid } })
                      }
                      onInvalid={onInvalid}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={t.budgetSection.removeLine(label)}
                      onClick={() => edit({ type: 'budget.removeLine', id: line.id })}
                    >
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form className="add-row" onSubmit={addLine}>
        <Field id="line-label" label={t.budgetSection.lineLabel}>
          {(control) => (
            <input
              {...control}
              className="input"
              maxLength={60}
              value={lineLabel}
              onChange={(event) => {
                setLineLabel(event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="line-amount" label={t.budgetSection.lineAmount}>
          {(control) => (
            <input
              {...control}
              className="input"
              inputMode="decimal"
              value={lineAmount}
              onChange={(event) => {
                setLineAmount(event.target.value);
              }}
            />
          )}
        </Field>
        <button type="submit" className="btn btn--ghost btn--sm">
          <Plus />
          {t.budgetSection.addLine}
        </button>
      </form>
      <p className="note">
        <Info />
        {t.common.estimate}
      </p>
    </div>
  );
}
