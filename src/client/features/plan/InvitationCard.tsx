/**
 * The plan's header, designed as a printed invitation: maroon velvet, double gold borders,
 * calligraphic names, a date block, a countdown seal and the plan rangoli.
 */
import { Leaf, MapPin, Users, Wallet } from 'lucide-react';
import type { EventPlan } from '../../../shared/schemas/plan';
import { localToday } from '../../../shared/utils/dates';
import { useI18n } from '../../i18n';
import { Emblem, Ornament, Paisley, SealDisc } from '../../motifs/Ornaments';
import { Rangoli } from '../../motifs/Rangoli';
import { useAiRuns } from '../../state/ai';
import { countdownParts, coupleNames, petalsSummary, planView } from './present';

export function InvitationCard({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const { brief } = plan;
  const view = planView(plan, localToday(), t, f);
  const seal = countdownParts(view.countdown, t, f);
  const names = brief.type === 'wedding' ? coupleNames(brief.title) : null;
  const ready = f.percent(view.score / 100);
  const dietary = brief.dietary.slice(0, 2).map((need) => t.dietary[need]);
  const tailoring = useAiRuns((state) => state.runs[plan.id]?.running ?? false);

  return (
    <article className="card-invite" aria-labelledby="plan-title">
      <div className="jaal" aria-hidden="true" />
      <Emblem />
      <Paisley side="left" />
      <Paisley side="right" />
      <div className="invite-grid">
        <div className="invite-seal">
          <div
            className="seal"
            role="img"
            aria-label={t.invitation.countdownLabel(
              seal.small ? `${seal.big} ${seal.small}` : seal.big,
            )}
          >
            <SealDisc />
            <div className="seal-text" aria-hidden="true">
              <b className={seal.word ? 'word' : undefined}>{seal.big}</b>
              {seal.small && <small>{seal.small}</small>}
            </div>
          </div>
        </div>

        <div className="invite-center">
          <p className="together">{t.invitation.together[brief.type]}</p>
          <h1 id="plan-title" className="names" data-route-focus="page" tabIndex={-1}>
            {names ? (
              <>
                <span className="n foil">{names[0]}</span>
                <span className="amp">&amp;</span>
                <span className="n foil">{names[1]}</span>
              </>
            ) : (
              <span className={brief.title.length > 18 ? 'n n--long foil' : 'n foil'}>
                {brief.title}
              </span>
            )}
          </h1>
          <p className="celebration">
            {names
              ? t.invitation.couplePlanning
              : (brief.subtype ?? t.invitation.celebration[brief.type])}
          </p>
          <p>
            <span className="sr-only">{f.dateLong(brief.date)}</span>
            <span className="dateblock" aria-hidden="true">
              <span>{f.weekday(brief.date)}</span>
              <b>{f.day(brief.date)}</b>
              <span>{f.monthYear(brief.date)}</span>
            </span>
          </p>
          <p className="place">
            {brief.country && brief.country !== 'India'
              ? `${brief.city} · ${brief.country}`
              : brief.city}
          </p>
          <Ornament />
          <ul className="facts">
            <li>
              <Users />
              {t.chips.guests(f.number(brief.guestCount), brief.guestCount)}
            </li>
            <li>
              <Wallet />
              {f.money(brief.budget, brief.currency)}
            </li>
            <li>
              <MapPin />
              {t.venues[brief.venueType]}
            </li>
            {dietary.length > 0 && (
              <li>
                <Leaf />
                {f.list(dietary)}
              </li>
            )}
          </ul>
        </div>

        <div className="invite-ring">
          <Rangoli
            petals={view.petals}
            className="mini-rangoli"
            label={`${t.invitation.readinessLabel(ready)}. ${t.plan.progressSummary(petalsSummary(view.petals, t))}`}
          />
          <p className="side-caption" aria-hidden="true">
            {tailoring ? t.invitation.tailoring : t.home.ready(ready)}
          </p>
        </div>
      </div>
    </article>
  );
}
