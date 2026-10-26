/**
 * The budget lines: planned, spent and paid for each line, editable in place, with a form to
 * add a line. Spent counts the chosen quotes of booked vendors, so overspending shows early.
 */
import { Info, Plus, Trash2 } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import type { BudgetLine, EventPlan } from '../../../shared/schemas/plan';
import { parseAmount } from '../../../shared/utils/money';
import { AmountInput } from '../../components/AmountInput';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n';
import { writtenIn } from '../../i18n/written-in';
import { useEdit, type Edit } from '../plan/use-edit';

interface BudgetLinesProps {
  plan: EventPlan;
  /** Spent per line, including what booked vendors have committed. */
  spentByLine: readonly number[];
  onInvalid: () => void;
}

interface LineRowProps {
  plan: EventPlan;
  line: BudgetLine;
  /** Spent on this line, including what booked vendors have committed. */
  spent: number;
  edit: Edit;
  onInvalid: () => void;
}

/** The line's name, its share of the total, its badges and Gemini's reason for it. */
function LineName({ plan, line, spent }: Pick<LineRowProps, 'plan' | 'line' | 'spent'>) {
  const { t, f } = useI18n();
  const { total } = plan.budget;
  return (
    <th scope="row">
      <span className="line-name">{line.label ?? t.budgetCategories[line.category]}</span>
      <span className="line-meta">
        {f.percent(total > 0 ? line.planned / total : 0)}
        {line.perGuest && <span className="pill pill--plain">{t.budgetSection.perGuestBadge}</span>}
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
  );
}

function LineRow({ plan, line, spent, edit, onInvalid }: LineRowProps) {
  const { t } = useI18n();
  const label = line.label ?? t.budgetCategories[line.category];
  const amountLabel = (column: string) => t.budgetSection.editLine(label, column);
  return (
    <tr>
      <LineName plan={plan} line={line} spent={spent} />
      <td>
        <AmountInput
          value={line.planned}
          label={amountLabel(t.budgetSection.planned)}
          onCommit={(planned) =>
            edit({ type: 'budget.updateLine', id: line.id, patch: { planned } })
          }
          onInvalid={onInvalid}
        />
      </td>
      <td>
        <AmountInput
          value={line.spent}
          label={amountLabel(t.budgetSection.spent)}
          onCommit={(value) =>
            edit({ type: 'budget.updateLine', id: line.id, patch: { spent: value } })
          }
          onInvalid={onInvalid}
        />
      </td>
      <td>
        <AmountInput
          value={line.paid}
          label={amountLabel(t.budgetSection.paid)}
          onCommit={(paid) => edit({ type: 'budget.updateLine', id: line.id, patch: { paid } })}
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
}

function AddLineForm({ edit, onInvalid }: { edit: Edit; onInvalid: () => void }) {
  const { t } = useI18n();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');

  const addLine = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const planned = parseAmount(amount);
    if (!label.trim() || planned === null) {
      onInvalid();
      return;
    }
    if (edit({ type: 'budget.addLine', line: { label: label.trim(), planned } })) {
      setLabel('');
      setAmount('');
    }
  };

  return (
    <form className="add-row" onSubmit={addLine}>
      <TextField
        id="line-label"
        label={t.budgetSection.lineLabel}
        maxLength={60}
        value={label}
        onChange={setLabel}
      />
      <TextField
        id="line-amount"
        label={t.budgetSection.lineAmount}
        inputMode="decimal"
        value={amount}
        onChange={setAmount}
      />
      <button type="submit" className="btn btn--ghost btn--sm">
        <Plus />
        {t.budgetSection.addLine}
      </button>
    </form>
  );
}

export function BudgetLines({ plan, spentByLine, onInvalid }: BudgetLinesProps) {
  const { t } = useI18n();
  const edit = useEdit(plan.id);
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
            {plan.budget.lines.map((line, index) => (
              <LineRow
                key={line.id}
                plan={plan}
                line={line}
                spent={spentByLine[index] ?? line.spent}
                edit={edit}
                onInvalid={onInvalid}
              />
            ))}
          </tbody>
        </table>
      </div>
      <AddLineForm edit={edit} onInvalid={onInvalid} />
      <p className="note">
        <Info />
        {t.common.estimate}
      </p>
    </div>
  );
}
