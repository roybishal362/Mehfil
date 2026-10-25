/**
 * The budget: every amount is computed by the engine, lines always add up, and edits go
 * through typed operations (so they can be undone). Gemini only suggests shares, saving tips
 * and an honest assessment.
 */
import { Info, Sparkles } from 'lucide-react';
import { budgetHealth, lineSpend, summariseBudget } from '../../../shared/domain/budget';
import { committedByCategory } from '../../../shared/domain/vendors';
import type { EventPlan } from '../../../shared/schemas/plan';
import { toast } from '../../app/feedback';
import { useI18n } from '../../i18n';
import { writtenIn } from '../../i18n/written-in';
import { GuestCountForm, RebalanceForm } from './BudgetForms';
import { BudgetLines } from './BudgetLines';
import { SectionHead } from './SectionHead';

const HEALTH_PILL = { healthy: 'pill--ok', watch: 'pill--warn', over: 'pill--danger' } as const;
const LEVEL_PILL = {
  comfortable: 'pill--ok',
  tight: 'pill--warn',
  very_tight: 'pill--danger',
} as const;

export function BudgetSection({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const { budget } = plan;
  const committed = committedByCategory(plan.vendors);
  const summary = summariseBudget(budget, plan.brief.guestCount, committed);
  const health = budgetHealth(summary);
  const money = (amount: number) => f.money(amount, budget.currency);
  const invalid = () => {
    toast(t.budgetSection.invalidAmount, { tone: 'error' });
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
      <SectionHead title={t.budgetSection.title} intro={t.budgetSection.intro} art="money-bag">
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
          <p {...writtenIn(plan.brief.language)}>{budget.assessment.note}</p>
        </div>
      )}

      <div className="grid-2">
        <RebalanceForm plan={plan} onInvalid={invalid} />
        <GuestCountForm plan={plan} />
      </div>

      <BudgetLines plan={plan} spentByLine={lineSpend(budget, committed)} onInvalid={invalid} />

      {budget.savingTips.length > 0 && (
        <div className="card">
          <header className="card-head">
            <span className="badge">
              <Sparkles />
            </span>
            <h3>{t.budgetSection.tips}</h3>
          </header>
          <ul className="tips" {...writtenIn(plan.brief.language)}>
            {budget.savingTips.map((tip) => (
              <li key={tip.id}>{tip.tip}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
