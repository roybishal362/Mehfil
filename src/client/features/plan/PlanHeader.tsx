/**
 * The plan's header, dressed for its occasion: a red border and toran for a wedding, the dhak and
 * falling shiuli for Durga Puja, lights and kandils for Diwali, and so on (MoodArt). It carries
 * the greeting, the names or title, the date and place, the countdown and a diya for every part
 * of the plan that has begun. The first time a plan opens, its occasion plays a short
 * celebration moment (features/moments).
 */
import type { EventPlan } from '../../../shared/schemas/plan';
import { localToday } from '../../../shared/utils/dates';
import { usePageMood } from '../../app/mood';
import { useI18n } from '../../i18n';
import { useCountUp } from '../../lib/motion';
import { DiyaRow } from '../../motifs/Diya';
import { MoodArt } from '../../motifs/MoodArt';
import { useAiRuns } from '../../state/ai';
import { Celebration } from '../moments/Celebration';
import { countdownParts, coupleNames, partsSummary, planView } from './present';

export function PlanHeader({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const { brief } = plan;
  const view = planView(plan, localToday(), t, f);
  usePageMood(view.mood);
  const seal = countdownParts(view.countdown, t, f);
  // The days to go count up as the header first shows.
  const days = useCountUp(view.countdown.kind === 'upcoming' ? view.countdown.days : 0);
  const big = view.countdown.kind === 'upcoming' ? f.number(days) : seal.big;
  const names = brief.type === 'wedding' ? coupleNames(brief.title) : null;
  const ready = f.percent(view.score / 100);
  const tailoring = useAiRuns((state) => state.runs[plan.id]?.running ?? false);
  const place =
    brief.country && brief.country !== 'India' ? `${brief.city}, ${brief.country}` : brief.city;
  const facts = [
    place,
    t.chips.guests(f.number(brief.guestCount), brief.guestCount),
    f.money(brief.budget, brief.currency),
  ];

  return (
    <article className="planhead" data-mood={view.mood} aria-labelledby="plan-title">
      <div className="planhead-art" aria-hidden="true">
        <MoodArt mood={view.mood} />
      </div>
      <div className="planhead-copy">
        <p className="greet">
          {t.moods.greeting[view.mood]}
          {brief.subtype && view.mood !== 'wedding' && (
            <span className="greet-sub">{brief.subtype}</span>
          )}
        </p>
        <h1
          id="plan-title"
          className={!names && brief.title.length > 28 ? 'plan-name plan-name--long' : 'plan-name'}
          data-route-focus="page"
          tabIndex={-1}
        >
          {names ? (
            <>
              {names[0]} <span className="amp">&amp;</span> {names[1]}
            </>
          ) : (
            brief.title
          )}
        </h1>
        <p className="when">
          <b>
            {f.dateLong(brief.date)}
            {brief.endDate && brief.endDate !== brief.date ? ` – ${f.dateLong(brief.endDate)}` : ''}
          </b>
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </p>
      </div>
      <div className="count">
        <p className={seal.word ? 'count-num count-num--word' : 'count-num'}>
          <strong>{big}</strong> <span className="count-label">{seal.small}</span>
        </p>
        <DiyaRow
          parts={view.parts}
          label={`${t.invitation.readinessLabel(ready)}. ${t.plan.progressSummary(partsSummary(view.parts, t))}`}
        />
        <p className="count-note" aria-hidden="true">
          {tailoring ? t.invitation.tailoring : t.home.ready(ready)}
        </p>
        <Celebration planId={plan.id} mood={view.mood} />
      </div>
    </article>
  );
}
