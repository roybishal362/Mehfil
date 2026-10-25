/**
 * The budget's what-if tools: rebalance every line to a new total, or change the guest count
 * (per-guest lines scale; the total can stay fixed). Both go through typed, undoable edits.
 */
import { Users } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { MAX_GUESTS, MIN_BUDGET } from '../../../shared/schemas/brief';
import type { EventPlan } from '../../../shared/schemas/plan';
import { parseAmount } from '../../../shared/utils/money';
import { announce, toast } from '../../app/feedback';
import { Field } from '../../components/Field';
import { useI18n } from '../../i18n';
import { useEdit } from '../plan/use-edit';

export function RebalanceForm({ plan, onInvalid }: { plan: EventPlan; onInvalid: () => void }) {
  const { t, f } = useI18n();
  const edit = useEdit(plan.id);
  const [newTotal, setNewTotal] = useState('');

  const changeTotal = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const total = parseAmount(newTotal);
    if (total === null || total < MIN_BUDGET) {
      onInvalid();
      return;
    }
    if (edit({ type: 'budget.setTotal', total })) {
      setNewTotal('');
      announce(t.budgetSection.rebalanced);
    }
  };

  return (
    <form className="card grid gap-3" onSubmit={changeTotal}>
      <h3 className="text-2xl">{t.budgetSection.changeTotal}</h3>
      <Field id="new-total" label={t.budgetSection.newTotal} hint={t.wizard.budgetHint}>
        {(control) => (
          <input
            {...control}
            className="input"
            inputMode="decimal"
            autoComplete="off"
            placeholder={f.number(plan.budget.total)}
            value={newTotal}
            onChange={(event) => {
              setNewTotal(event.target.value);
            }}
          />
        )}
      </Field>
      <button type="submit" className="btn btn--ghost btn--sm justify-self-start">
        {t.budgetSection.rebalance}
      </button>
    </form>
  );
}

export function GuestCountForm({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const edit = useEdit(plan.id);
  const [guests, setGuests] = useState(String(plan.brief.guestCount));
  const [keepTotal, setKeepTotal] = useState(true);

  const changeGuests = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const count = Number(guests);
    if (!Number.isInteger(count) || count < 1 || count > MAX_GUESTS) {
      toast(t.wizard.errors.guestCount, { tone: 'error' });
      return;
    }
    if (edit({ type: 'guests.setCount', guestCount: count, keepBudget: keepTotal })) {
      announce(t.budgetSection.guestsUpdated(f.number(count)));
    }
  };

  return (
    <form className="card grid gap-3" onSubmit={changeGuests}>
      <h3 className="text-2xl">{t.budgetSection.whatIf}</h3>
      <Field id="what-if-guests" label={t.budgetSection.guestsLabel}>
        {(control) => (
          <input
            {...control}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_GUESTS}
            className="input"
            value={guests}
            onChange={(event) => {
              setGuests(event.target.value);
            }}
          />
        )}
      </Field>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="check"
          checked={keepTotal}
          onChange={(event) => {
            setKeepTotal(event.target.checked);
          }}
        />
        {t.budgetSection.keepTotal}
      </label>
      <button type="submit" className="btn btn--ghost btn--sm justify-self-start">
        <Users />
        {t.budgetSection.applyGuests}
      </button>
    </form>
  );
}
