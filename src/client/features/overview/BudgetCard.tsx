/** The budget at a glance: total, health and a split of the biggest lines in chart colours. */
import { Info } from 'lucide-react';
import { Link } from 'wouter';
import { budgetHealth, summariseBudget } from '../../../shared/domain/budget';
import { committedByCategory } from '../../../shared/domain/vendors';
import type { BudgetLine, EventPlan } from '../../../shared/schemas/plan';
import { paths } from '../../app/routing';
import { useI18n, type I18n } from '../../i18n';

/** Chart colour classes (tokens --c1 to --c6); the last one groups the smaller lines. */
const SEGMENT_TONES = ['c1', 'c2', 'c3', 'c4', 'c5'] as const;
const OTHERS_TONE = 'c6';
const SHOWN_LINES = 5;
/** The bar is drawn in a 1000-unit-wide SVG with a 4-unit gap between segments. */
const BAR_WIDTH = 1000;
const GAP = 4;

const HEALTH_PILL = { healthy: 'pill--ok', watch: 'pill--warn', over: 'pill--danger' } as const;

interface Segment {
  key: string;
  label: string;
  amount: number;
  tone: string;
}

/** The five biggest lines in their own colours, and the rest together as "others". */
function segmentsOf(lines: readonly BudgetLine[], { t, f }: I18n): Segment[] {
  const shown = lines.slice(0, SHOWN_LINES).map((line, index) => ({
    key: line.id,
    label: line.label ?? t.budgetCategories[line.category],
    amount: line.planned,
    tone: SEGMENT_TONES[index] ?? OTHERS_TONE,
  }));
  const rest = lines.slice(SHOWN_LINES);
  if (rest.length === 0) return shown;
  const others = {
    key: 'others',
    label: t.overview.others(f.number(rest.length)),
    amount: rest.reduce((total, line) => total + line.planned, 0),
    tone: OTHERS_TONE,
  };
  return [...shown, others];
}

/** The split as one bar; screen readers get the same split as text. */
function BudgetBar({ segments, base }: { segments: readonly Segment[]; base: number }) {
  const { t, f } = useI18n();
  const widths = segments.map((segment) => (segment.amount / base) * BAR_WIDTH);
  const split = segments
    .map((segment) => `${segment.label} ${f.percent(segment.amount / base)}`)
    .join(', ');
  return (
    <svg
      className="budget-bar"
      viewBox={`0 0 ${String(BAR_WIDTH)} 24`}
      preserveAspectRatio="none"
      role="img"
      aria-label={t.overview.budgetSplitLabel(split)}
    >
      {segments.map((segment, index) => (
        <rect
          key={segment.key}
          className={`fill-${segment.tone}`}
          x={widths.slice(0, index).reduce((sum, width) => sum + width, 0)}
          width={Math.max(0, (widths[index] ?? 0) - GAP)}
          height="24"
        />
      ))}
    </svg>
  );
}

export function BudgetCard({ plan }: { plan: EventPlan }) {
  const i18n = useI18n();
  const { t, f } = i18n;
  const { budget } = plan;
  const summary = summariseBudget(budget, plan.brief.guestCount, committedByCategory(plan.vendors));
  const health = budgetHealth(summary);
  const lines = budget.lines
    .filter((line) => line.planned > 0)
    .sort((a, b) => b.planned - a.planned);
  const segments = segmentsOf(lines, i18n);

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
      <BudgetBar segments={segments} base={Math.max(1, summary.planned)} />
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
