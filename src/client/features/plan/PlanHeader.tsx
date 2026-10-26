/**
 * The plan's header, set like the occasion's invitation card: a double border in its colour, the
 * greeting in small capitals, the names or title, the date and place, the countdown and how far
 * the plan has come, and the occasion's photograph in the arch. The first time a plan opens, its
 * occasion plays a short celebration moment (features/moments).
 */
import type { EventBrief } from '../../../shared/schemas/brief';
import type { EventPlan } from '../../../shared/schemas/plan';
import { localToday } from '../../../shared/utils/dates';
import { usePageMood } from '../../app/mood';
import { useI18n } from '../../i18n';
import { useCountUp } from '../../lib/motion';
import { MoodArt } from '../../motifs/MoodArt';
import { archPhoto, HEADER_PHOTO_SIZES } from '../../photos';
import { Arch } from '../../photos/Arch';
import { Photo } from '../../photos/Photo';
import { useAiRuns } from '../../state/ai';
import { Celebration } from '../moments/Celebration';
import { countdownParts, coupleNames, planView } from './present';
import { ProgressLine } from './ProgressLine';

type PlanView = ReturnType<typeof planView>;

/** A wedding shows the couple's names ("Ananya & Rohan"); anything else, its title. */
function PlanTitle({ brief }: { brief: EventBrief }) {
  const names = brief.type === 'wedding' ? coupleNames(brief.title) : null;
  const long = !names && brief.title.length > 28;
  return (
    <h1
      id="plan-title"
      className={long ? 'plan-name plan-name--long' : 'plan-name'}
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
  );
}

/** The date (or dates), the place, the guests and the budget, as an invitation states them. */
function PlanFacts({ brief }: { brief: EventBrief }) {
  const { t, f } = useI18n();
  const abroad = brief.country && brief.country !== 'India';
  const lastDay = brief.endDate && brief.endDate !== brief.date ? brief.endDate : null;
  const facts = [
    abroad ? `${brief.city}, ${brief.country}` : brief.city,
    t.chips.guests(f.number(brief.guestCount), brief.guestCount),
    f.money(brief.budget, brief.currency),
  ];
  return (
    <p className="when">
      <b>
        {f.dateLong(brief.date)}
        {lastDay ? ` – ${f.dateLong(lastDay)}` : ''}
      </b>
      {facts.map((fact) => (
        <span key={fact}>{fact}</span>
      ))}
    </p>
  );
}

/** Days to go (counting up as the header first shows), how ready the plan is, and the moment. */
function Countdown({ plan, view }: { plan: EventPlan; view: PlanView }) {
  const { t, f } = useI18n();
  const { countdown } = view;
  const seal = countdownParts(countdown, t, f);
  const upcoming = countdown.kind === 'upcoming';
  const days = useCountUp(upcoming ? countdown.days : 0);
  const tailoring = useAiRuns((state) => state.runs[plan.id]?.running ?? false);
  const status = tailoring ? t.invitation.tailoring : t.home.ready(f.percent(view.score / 100));
  return (
    <div className="planhead-count">
      <p className={seal.word ? 'count-num count-num--word' : 'count-num'}>
        <strong>{upcoming ? f.number(days) : seal.big}</strong>{' '}
        <span className="count-label">{seal.small}</span>
      </p>
      <ProgressLine parts={view.parts} status={status} />
      <Celebration planId={plan.id} mood={view.mood} />
    </div>
  );
}

export function PlanHeader({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const { brief } = plan;
  const view = planView(plan, localToday(), t, f);
  usePageMood(view.mood);
  return (
    <article className="planhead" data-mood={view.mood} aria-labelledby="plan-title">
      <MoodArt mood={view.mood} />
      <div className="planhead-copy">
        <p className="greet">
          {t.moods.greeting[view.mood]}
          {brief.subtype && view.mood !== 'wedding' && (
            <span className="greet-sub">{brief.subtype}</span>
          )}
        </p>
        <PlanTitle brief={brief} />
        <PlanFacts brief={brief} />
        <Countdown plan={plan} view={view} />
      </div>
      <Arch className="planhead-arch">
        <Photo photo={archPhoto(view.mood)} sizes={HEADER_PHOTO_SIZES} priority />
      </Arch>
    </article>
  );
}
