/**
 * The budget: every amount is computed by the engine, lines always add up, and edits go
 * through typed operations (so they can be undone). Gemini only suggests shares, saving tips
 * and an honest assessment.
 */
import { Info, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { budgetHealth, lineSpend, summariseBudget } from '../../../shared/domain/budget';
import { committedByCategory } from '../../../shared/domain/vendors';
import { MAX_GUESTS, MIN_BUDGET } from '../../../shared/schemas/brief';
import type { EventPlan } from '../../../shared/schemas/plan';
import { parseAmount } from '../../../shared/utils/money';
import { announce, toast } from '../../app/feedback';
import { AmountInput } from '../../components/AmountInput';
import { Field } from '../../components/Field';
import { useI18n } from '../../i18n';
import { useEdit } from '../plan/use-edit';
import { SectionHead } from './SectionHead';

const HEALTH_PILL = { healthy: 'pill--ok', watch: 'pill--warn', over: 'pill--danger' } as const;
const LEVEL_PILL = {
  comfortable: 'pill--ok',
  tight: 'pill--warn',
  very_tight: 'pill--danger',
} as const;

export function BudgetSection({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const edit = useEdit(plan.id);
  const { budget } = plan;
  const committed = committedByCategory(plan.vendors);
  const summary = summariseBudget(budget, plan.brief.guestCount, committed);
  const spentByLine = lineSpend(budget, committed);
  const health = budgetHealth(summary);
  const money = (amount: number) => f.money(amount, budget.currency);
  const invalid = () => {
    toast(t.budgetSection.invalidAmount, { tone: 'error' });
  };

  const [newTotal, setNewTotal] = useState('');
  const [guests, setGuests] = useState(String(plan.brief.guestCount));
  const [keepTotal, setKeepTotal] = useState(true);
  const [lineLabel, setLineLabel] = useState('');
  const [lineAmount, setLineAmount] = useState('');

  const changeTotal = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const total = parseAmount(newTotal);
    if (total === null || total < MIN_BUDGET) {
      invalid();
      return;
    }
    if (edit({ type: 'budget.setTotal', total })) {
      setNewTotal('');
      announce(t.budgetSection.rebalanced);
    }
  };

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

  const addLine = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const planned = parseAmount(lineAmount);
    if (!lineLabel.trim() || planned === null) {
      invalid();
      return;
    }
    if (edit({ type: 'budget.addLine', line: { label: lineLabel.trim(), planned } })) {
      setLineLabel('');
      setLineAmount('');
    }
  };

  const figures = [
    { key: 'total', label: t.budgetSection.total, value: money(summary.total) },
    { key: 'planned', label: t.budgetSection.planned, value: money(summary.planned) },
    { key: 'spent', label: t.budgetSection.spent, value: money(summary.spent) },
    { key: 'paid', label: t.budgetSection.paid, value: money(summary.paid) },
    { key: 'remaining', label: t.budgetSection.remaining, value: money(summary.remaining) },
    { key: 'perGuest', label: t.budgetSection.perGuest, value: money(summary.perGuestPlanned) },
  ];

  return (
    <section className="ws-main" aria-labelledby="section-title">
      <SectionHead title={t.budgetSection.title} intro={t.budgetSection.intro}>
        <span className={`pill ${HEALTH_PILL[health]}`}>{t.overview.health[health]}</span>
      </SectionHead>

      <div className="card">
        <dl className="figures">
          {figures.map((figure) => (
            <div key={figure.key}>
              <dt>{figure.label}</dt>
              <dd>{figure.value}</dd>
            </div>
          ))}
        </dl>
        {summary.unallocated !== 0 && (
          <p className="note">
            <Info />
            {summary.unallocated > 0
              ? t.budgetSection.unallocated(money(summary.unallocated))
              : t.budgetSection.overAllocated(money(-summary.unallocated))}
          </p>
        )}
      </div>

      {budget.assessment && (
        <div className="card">
          <header className="card-head">
            <span className="badge">
              <Sparkles />
            </span>
            <h3>{t.budgetSection.assessmentTitle}</h3>
            <span className={`pill ${LEVEL_PILL[budget.assessment.level]}`}>
              {t.budgetSection.levels[budget.assessment.level]}
            </span>
          </header>
          <p lang={plan.brief.language}>{budget.assessment.note}</p>
        </div>
      )}

      <div className="grid-2">
        <form className="card grid gap-3" onSubmit={changeTotal}>
          <h3 className="text-2xl">{t.budgetSection.changeTotal}</h3>
          <Field id="new-total" label={t.budgetSection.newTotal} hint={t.wizard.budgetHint}>
            {(control) => (
              <input
                {...control}
                className="input"
                inputMode="decimal"
                autoComplete="off"
                placeholder={f.number(budget.total)}
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
      </div>

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
                        {f.percent(summary.total > 0 ? line.planned / summary.total : 0)}
                        {line.perGuest && (
                          <span className="pill pill--plain">{t.budgetSection.perGuestBadge}</span>
                        )}
                        {spent > line.planned && (
                          <span className="pill pill--danger">{t.budgetSection.overspent}</span>
                        )}
                        {line.source === 'ai' && <span className="pill pill--ai">Gemini</span>}
                      </span>
                      {line.rationale && (
                        <span className="line-why" lang={plan.brief.language}>
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
                        onInvalid={invalid}
                      />
                    </td>
                    <td>
                      <AmountInput
                        value={line.spent}
                        label={t.budgetSection.editLine(label, t.budgetSection.spent)}
                        onCommit={(value) =>
                          edit({ type: 'budget.updateLine', id: line.id, patch: { spent: value } })
                        }
                        onInvalid={invalid}
                      />
                    </td>
                    <td>
                      <AmountInput
                        value={line.paid}
                        label={t.budgetSection.editLine(label, t.budgetSection.paid)}
                        onCommit={(paid) =>
                          edit({ type: 'budget.updateLine', id: line.id, patch: { paid } })
                        }
                        onInvalid={invalid}
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

      {budget.savingTips.length > 0 && (
        <div className="card">
          <header className="card-head">
            <span className="badge">
              <Sparkles />
            </span>
            <h3>{t.budgetSection.tips}</h3>
          </header>
          <ul className="tips" lang={plan.brief.language}>
            {budget.savingTips.map((tip) => (
              <li key={tip.id}>{tip.tip}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
