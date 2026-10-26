/** The budget at a glance: total, health and a split of the biggest lines in chart colours. */
import { Info } from 'lucide-react';
import { Link } from 'wouter';
import { budgetHealth, summariseBudget } from '../../../shared/domain/budget';
import { committedByCategory } from '../../../shared/domain/vendors';
import type { EventPlan } from '../../../shared/schemas/plan';
import { paths } from '../../app/routing';
import { useI18n } from '../../i18n';

/** Chart colour classes (tokens --c1 to --c6); the last one groups the smaller lines. */
const SEGMENT_TONES = ['c1', 'c2', 'c3', 'c4', 'c5'] as const;
const OTHERS_TONE = 'c6';
const SHOWN_LINES = 5;
/** The bar is drawn in a 1000-unit-wide SVG with a 4-unit gap between segments. */
const BAR_WIDTH = 1000;
const GAP = 4;

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
      tone: SEGMENT_TONES[index] ?? OTHERS_TONE,
    })),
    ...(rest.length > 0
      ? [
          {
            key: 'others',
            label: t.overview.others(f.number(rest.length)),
            amount: restTotal,
            tone: OTHERS_TONE,
          },
        ]
      : []),
  ];
  const widths = segments.map((segment) => (segment.amount / base) * BAR_WIDTH);
  const bars = segments.map((segment, index) => ({
    key: segment.key,
    tone: segment.tone,
    x: widths.slice(0, index).reduce((sum, width) => sum + width, 0),
    width: Math.max(0, (widths[index] ?? 0) - GAP),
  }));
  const split = segments
    .map((segment) => `${segment.label} ${f.percent(segment.amount / base)}`)
    .join(', ');

  return (
    <article className="card" aria-labelledby="budget-card-title">
      <header className="card-head">
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
      <svg
        className="budget-bar"
        viewBox={`0 0 ${String(BAR_WIDTH)} 24`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t.overview.budgetSplitLabel(split)}
      >
        {bars.map((bar) => (
          <rect
            key={bar.key}
            className={`fill-${bar.tone}`}
            x={bar.x}
            width={bar.width}
            height="24"
          />
        ))}
      </svg>
      <ul className="legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <i className={`swatch fill-bg-${segment.tone}`} />
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
