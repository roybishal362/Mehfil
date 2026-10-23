/**
 * The journey: planning phases strung as a marigold garland. Each flower fills as its tasks are
 * done, and a pin marks the phase you are in today.
 */
import { Route } from 'lucide-react';
import { Link } from 'wouter';
import {
  PHASES,
  groupByPhase,
  nextTasks,
  phaseFor,
  taskStats,
  type Phase,
} from '../../../shared/domain/timeline';
import type { EventPlan } from '../../../shared/schemas/plan';
import { localToday } from '../../../shared/utils/dates';
import { paths } from '../../app/routing';
import { useI18n, type Messages } from '../../i18n';

/** The garland's flowers, left to right (the "after" phase is not drawn). */
const SHOWN: readonly Phase[] = PHASES.filter((phase) => phase !== 'after');
const POINTS: readonly (readonly [number, number])[] = [
  [32, 62],
  [86, 80],
  [140, 78],
  [200, 50],
  [260, 78],
  [314, 80],
  [368, 62],
];

const PHASE_KEYS: Readonly<Record<Phase, keyof Messages['overview']['phases']>> = {
  twelve_months: '12m',
  six_months: '6m',
  three_months: '3m',
  one_month: '1m',
  two_weeks: '2w',
  final_days: 'final',
  event_day: 'day',
  after: 'after',
};

function Marigold({ fill }: { fill: number }) {
  const petals = Math.round(fill * 10);
  return (
    <>
      {fill > 0 && <circle r={20} fill="#F7B500" opacity={0.22} />}
      {Array.from({ length: 10 }, (_, index) => (
        <ellipse
          key={index}
          rx={4.5}
          ry={9}
          transform={`rotate(${String(index * 36)}) translate(0 -8)`}
          className={index < petals ? 'petal-on' : fill > 0 ? 'petal-half' : 'petal-off'}
        />
      ))}
      <circle r={4.6} className={fill > 0 ? 'heart-on' : 'heart-off'} />
    </>
  );
}

export function JourneyCard({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const today = localToday();
  const groups = new Map(
    groupByPhase(plan.tasks, plan.brief.date).map((group) => [group.phase, group.tasks]),
  );
  const current = phaseFor(today, plan.brief.date);
  const currentIndex = Math.max(0, SHOWN.indexOf(current));
  const fills = SHOWN.map((phase, index) => {
    const tasks = groups.get(phase) ?? [];
    if (tasks.length === 0) return index < currentIndex ? 1 : 0;
    return tasks.filter((task) => task.status === 'done').length / tasks.length;
  });
  const stats = taskStats(plan.tasks, today);
  const next =
    nextTasks(
      plan.tasks.filter((task) => task.priority === 'high'),
      1,
    )[0] ?? nextTasks(plan.tasks, 1)[0];
  const [pinX, pinY] = POINTS[currentIndex] ?? [200, 50];
  const currentLabel = t.overview.phases[PHASE_KEYS[current]];

  return (
    <article className="card journey" aria-labelledby="journey-title">
      <header className="card-head">
        <span className="badge">
          <Route />
        </span>
        <h2 id="journey-title">{t.overview.journeyTitle}</h2>
        <Link className="more" href={paths.plan(plan.id, 'timeline')}>
          {t.overview.journeyLink}
        </Link>
      </header>
      <svg viewBox="0 0 400 160" role="img" aria-label={t.overview.journeyLabel(currentLabel)}>
        <path
          d="M8 46 C 70 96, 130 96, 200 50 C 270 96, 330 96, 392 46"
          fill="none"
          stroke="#C9A15A"
          strokeWidth={1.6}
        />
        {SHOWN.map((phase, index) => {
          const [x, y] = POINTS[index] ?? [0, 0];
          return (
            <g key={phase} transform={`translate(${String(x)} ${String(y)})`}>
              <Marigold fill={fills[index] ?? 0} />
              <text y={40} textAnchor="middle" className="phase-label">
                {t.overview.phases[PHASE_KEYS[phase]]}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${String(pinX)} 0)`}>
          <path
            d={`M0 26 V${String(pinY - 22)}`}
            stroke="#E0457B"
            strokeWidth={1.2}
            strokeDasharray="2 3"
          />
          <path d="M0 26 C -10 12, -10 0, 0 0 C 10 0, 10 12, 0 26Z" fill="#E0457B" />
          <circle cy={8} r={3.4} fill="#FFF3C9" />
          <text
            x={pinX > 300 ? -14 : 14}
            y={12}
            className="here"
            textAnchor={pinX > 300 ? 'end' : 'start'}
          >
            {t.overview.youAreHere.toUpperCase()}
          </text>
        </g>
      </svg>
      <div className="journey-sum">
        <div className="progress" aria-hidden="true">
          <i style={{ width: `${String(stats.total ? (stats.done / stats.total) * 100 : 0)}%` }} />
        </div>
        <p>
          <b>{t.overview.tasksDone(f.number(stats.done), f.number(stats.total))}</b>{' '}
          {t.overview.tasksDoneSuffix}
          {next && (
            <>
              {' · '}
              {t.overview.nextMilestone} <b>{next.title}</b>{' '}
              {t.overview.by(f.dateShort(next.dueDate))}
            </>
          )}
        </p>
      </div>
    </article>
  );
}
