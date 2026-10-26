/**
 * The journey: planning phases strung along a fine gold cord, like beads on a thread. A phase's
 * bead fills once its tasks are done (a ring with a centre while some are still open), and a pin
 * marks the phase you are in today.
 */
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

/** A filled bead for a finished phase, a ring with a centre under way, an empty ring otherwise. */
function Bead({ fill }: { fill: number }) {
  if (fill >= 1) return <circle r="9" className="bead bead--done" />;
  if (fill > 0) {
    return (
      <>
        <circle r="9" className="bead bead--part" />
        <circle r="4" className="bead-core" />
      </>
    );
  }
  return <circle r="7" className="bead bead--off" />;
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
        <h2 id="journey-title">{t.overview.journeyTitle}</h2>
        <Link className="more" href={paths.plan(plan.id, 'timeline')}>
          {t.overview.journeyLink}
        </Link>
      </header>
      <svg viewBox="0 0 400 160" role="img" aria-label={t.overview.journeyLabel(currentLabel)}>
        <path
          className="garland-cord"
          d="M8 46 C 70 96, 130 96, 200 50 C 270 96, 330 96, 392 46"
          fill="none"
        />
        {SHOWN.map((phase, index) => {
          const [x, y] = POINTS[index] ?? [0, 0];
          return (
            <g key={phase} transform={`translate(${String(x)} ${String(y)})`}>
              <Bead fill={fills[index] ?? 0} />
              <text y={40} textAnchor="middle" className="phase-label">
                {t.overview.phases[PHASE_KEYS[phase]]}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${String(pinX)} 0)`} className="pin">
          <path className="pin-line" d={`M0 26 V${String(pinY - 22)}`} />
          <path className="pin-head" d="M0 26 C -10 12, -10 0, 0 0 C 10 0, 10 12, 0 26Z" />
          <circle className="pin-eye" cy={8} r={3.4} />
          <text
            x={pinX > 300 ? -14 : 14}
            y={12}
            className="here"
            textAnchor={pinX > 300 ? 'end' : 'start'}
          >
            {t.overview.youAreHere}
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
