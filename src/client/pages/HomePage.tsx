/**
 * The home page is a Diwali night: string lights, swaying kandils, rising sparks and a ledge of
 * diyas around the describe card and the plan rangoli.
 */
import { localToday } from '../../shared/utils/dates';
import { useDocumentTitle } from '../app/routing';
import { DescribeCard } from '../features/home/DescribeCard';
import { Occasions } from '../features/home/Occasions';
import { YourPlans } from '../features/home/YourPlans';
import { SAMPLE_PROGRESS, petalsFor, petalsSummary, planView } from '../features/plan/present';
import { useI18n } from '../i18n';
import { DiyaLedge } from '../motifs/Diya';
import { Lanterns, Sparkles, Stars, StringLights } from '../motifs/NightSky';
import { Flank } from '../motifs/Ornaments';
import { Rangoli } from '../motifs/Rangoli';
import { usePlans } from '../state/plans';

function HeroRangoli() {
  const { t, f } = useI18n();
  const latest = usePlans((state) => {
    const id = state.order[0];
    return id ? state.plans[id] : undefined;
  });
  const petals = latest
    ? planView(latest, localToday(), t, f).petals
    : petalsFor(SAMPLE_PROGRESS, t, f);
  const summary = petalsSummary(petals, t);
  const label = latest
    ? `${latest.brief.title}: ${t.plan.progressSummary(summary)}`
    : t.home.rangoliSample(summary);
  return (
    <figure className="rangoli-wrap">
      <Rangoli petals={petals} label={label} showLabels />
      <figcaption className="rangoli-caption">{t.home.rangoliCaption}</figcaption>
    </figure>
  );
}

export function HomePage() {
  const { t } = useI18n();
  useDocumentTitle(t.home.title);
  return (
    <>
      <section className="stage" aria-labelledby="home-title">
        <Stars />
        <Sparkles />
        <StringLights />
        <Lanterns />
        <div className="wrap hero">
          <div>
            <p className="eyebrow smallcaps">
              <Flank />
              {t.home.eyebrow}
              <Flank />
            </p>
            <h1 id="home-title" data-route-focus="page" tabIndex={-1}>
              {t.home.titleLead} <span className="script foil">{t.home.titleScript}</span>
            </h1>
            <p className="lede">
              {t.home.ledeBefore}
              <b>{t.home.ledeGemini}</b>
              {t.home.ledeAfter}
            </p>
            <DescribeCard />
          </div>
          <HeroRangoli />
        </div>
        <DiyaLedge />
      </section>
      <YourPlans />
      <Occasions />
    </>
  );
}
