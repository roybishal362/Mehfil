/** The budget at a glance: total, health and a zari-striped split of the biggest lines. */
import { Info, Wallet } from 'lucide-react';
import { Link } from 'wouter';
import { budgetHealth, summariseBudget } from '../../../shared/domain/budget';
import { committedByCategory } from '../../../shared/domain/vendors';
import type { EventPlan } from '../../../shared/schemas/plan';
import { paths } from '../../app/routing';
import { useI18n } from '../../i18n';

const SEGMENT_COLORS = ['#F28C28', '#E0457B', '#2CB6B0', '#9B7BF0', '#33A46F'];
const OTHERS_COLOR = '#C9A15A';
const SHOWN_LINES = 5;

const HEALTH_PILL = { healthy: 'pill--ok', watch: 'pill--warn', over: 'pill--danger' } as const;

export function BudgetCard({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const { budget } = plan;
  const summary = summariseBudget(budget, plan.brief.guestCount, committedByCategory(plan.vendors));
  const health = budgetHealth(summary);
  const lines = [...budget.lines]
    .filter((line) => line.planned > 0)
    .sort((a, b) => b.planned - a.planned);
  const shown = lines.slice(0, SHOWN_LINES);
  const rest = lines.slice(SHOWN_LINES);
  const restTotal = rest.reduce((total, line) => total + line.planned, 0);
  const base = Math.max(1, summary.planned);
  const segments = [
    ...shown.map((line, index) => ({
      key: line.id,
      label: line.label ?? t.budgetCategories[line.category],
      amount: line.planned,
      color: SEGMENT_COLORS[index] ?? OTHERS_COLOR,
    })),
    ...(rest.length > 0
      ? [
          {
            key: 'others',
            label: t.overview.others(f.number(rest.length)),
            amount: restTotal,
            color: OTHERS_COLOR,
          },
        ]
      : []),
  ];
  const split = segments
    .map((segment) => `${segment.label} ${f.percent(segment.amount / base)}`)
    .join(', ');

  return (
    <article className="card" aria-labelledby="budget-card-title">
      <header className="card-head">
        <span className="badge">
          <Wallet />
        </span>
        <h2 id="budget-card-title">{t.overview.budgetTitle}</h2>
        <Link className="more" href={paths.plan(plan.id, 'budget')}>
          {t.overview.open}
          <span className="sr-only">: {t.sections.budget}</span>
        </Link>
      </header>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="big">{f.money(budget.total, budget.currency)}</p>
          <p className="note mt-1.5">
            {t.overview.plannedAcross(f.number(lines.length), lines.length)}
          </p>
        </div>
        <span className={`pill ${HEALTH_PILL[health]}`}>{t.overview.health[health]}</span>
      </div>
      <div className="zari" role="img" aria-label={t.overview.budgetSplitLabel(split)}>
        {segments.map((segment) => (
          <i
            key={segment.key}
            style={{
              width: `${String((segment.amount / base) * 100)}%`,
              background: segment.color,
            }}
          />
        ))}
      </div>
      <ul className="legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <i style={{ background: segment.color }} />
            <span>{segment.label}</span>
            <b>{f.money(segment.amount, budget.currency)}</b>
          </li>
        ))}
      </ul>
      <p className="note">
        <Info />
        {t.common.estimate}
      </p>
    </article>
  );
}
