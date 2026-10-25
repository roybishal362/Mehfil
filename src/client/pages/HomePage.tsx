/**
 * The home page: a calm, neutral welcome. Each occasion below it opens a plan that takes on its
 * festival's look, and the plate beside the description cycles through them.
 */
import { useDocumentTitle } from '../app/routing';
import { DescribeCard } from '../features/home/DescribeCard';
import { HowItWorks } from '../features/home/HowItWorks';
import { Occasions } from '../features/home/Occasions';
import { YourPlans } from '../features/home/YourPlans';
import { useI18n } from '../i18n';
import { MixedScript } from '../i18n/MixedScript';
import { CelebrationPlate } from '../motifs/CelebrationPlate';

export function HomePage() {
  const { t } = useI18n();
  useDocumentTitle(t.home.title);
  const { before, em, after } = t.home.heroTitle;
  return (
    <>
      <section className="hero" aria-labelledby="home-title">
        <div className="wrap hero-in">
          <div className="hero-copy">
            <p className="kicker">{t.home.eyebrow}</p>
            <h1 id="home-title" data-route-focus="page" tabIndex={-1}>
              {before}
              <em>{em}</em>
              {after}
            </h1>
            <p className="lede">
              {t.home.ledeBefore}
              <b>{t.home.ledeGemini}</b>
              <MixedScript text={t.home.ledeAfter} />
            </p>
            <DescribeCard />
          </div>
          <CelebrationPlate />
        </div>
      </section>
      <YourPlans />
      <Occasions />
      <HowItWorks />
    </>
  );
}
