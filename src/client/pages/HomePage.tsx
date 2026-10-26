/**
 * The home page: a calm, neutral welcome. The arched window beside the description turns
 * through the occasions, and each occasion below it opens a plan in that festival's look.
 * The hero's parts are siblings so CSS can place the arch beside them on a wide screen and
 * under the headline on a phone.
 */
import { useDocumentTitle } from '../app/routing';
import { DescribeCard } from '../features/home/DescribeCard';
import { HowItWorks } from '../features/home/HowItWorks';
import { Occasions } from '../features/home/Occasions';
import { YourPlans } from '../features/home/YourPlans';
import { useI18n } from '../i18n';
import { MixedScript } from '../i18n/MixedScript';
import { HeroArch } from '../photos/HeroArch';

export function HomePage() {
  const { t } = useI18n();
  useDocumentTitle(t.home.title);
  const { before, em, after } = t.home.heroTitle;
  return (
    <>
      <section className="hero" aria-labelledby="home-title">
        <div className="wrap hero-in">
          <p className="kicker">{t.home.eyebrow}</p>
          <h1 id="home-title" data-route-focus="page" tabIndex={-1}>
            {before}
            <em>{em}</em>
            {after}
          </h1>
          <HeroArch />
          <p className="lede">
            {t.home.ledeBefore}
            <b>{t.home.ledeGemini}</b>
            <MixedScript text={t.home.ledeAfter} />
          </p>
          <DescribeCard />
        </div>
      </section>
      <YourPlans />
      <Occasions />
      <HowItWorks />
    </>
  );
}
