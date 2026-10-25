/** Smaller overview cards: vendor pipeline, theme, risks and the AI summary. */
import { ExternalLink, Lightbulb, MapPin, ShieldAlert, Sparkles, Store } from 'lucide-react';
import { Link } from 'wouter';
import { isSecured } from '../../../shared/domain/vendors';
import { googleMapsSearchLink, vendorSearchQuery } from '../../../shared/export/links';
import type { EventPlan } from '../../../shared/schemas/plan';
import { paths } from '../../app/routing';
import { useI18n } from '../../i18n';
import { writtenIn } from '../../i18n/written-in';

const LIKELIHOOD_PILL = { low: 'pill--ok', medium: 'pill--warn', high: 'pill--danger' } as const;

export function VendorsCard({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const count = (statuses: readonly string[]) =>
    plan.vendors.filter((vendor) => statuses.includes(vendor.status)).length;
  const stones = [
    { key: 'open', value: count(['not_started', 'researching']), lit: false },
    { key: 'contacted', value: count(['contacted']), lit: false },
    { key: 'quoted', value: count(['quoted']), lit: false },
    { key: 'booked', value: count(['booked', 'paid']), lit: true },
  ] as const;
  const nextVendor = [...plan.vendors]
    .filter((vendor) => !isSecured(vendor))
    .sort((a, b) => a.bookBy.localeCompare(b.bookBy))[0];
  const nextName = nextVendor ? (nextVendor.label ?? t.vendorCategories[nextVendor.category]) : '';

  return (
    <article className="card" aria-labelledby="vendors-card-title">
      <header className="card-head">
        <span className="badge">
          <Store />
        </span>
        <h2 id="vendors-card-title">{t.overview.vendorsTitle}</h2>
        <Link className="more" href={paths.plan(plan.id, 'vendors')}>
          {t.overview.vendorsLink}
        </Link>
      </header>
      <ul className="stones">
        {stones.map((stone) => (
          <li
            key={stone.key}
            className={stone.lit && stone.value > 0 ? 'stone stone--lit' : 'stone'}
          >
            <b>{f.number(stone.value)}</b>
            <span>{t.overview.stones[stone.key]}</span>
          </li>
        ))}
      </ul>
      {nextVendor && (
        <p className="note">
          <MapPin />
          <a
            href={googleMapsSearchLink(
              vendorSearchQuery(
                nextVendor.category,
                plan.brief.type,
                plan.brief.city,
                nextVendor.label,
              ),
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.overview.findOnMaps(nextName.toLowerCase(), plan.brief.city)}
          </a>
          <ExternalLink aria-hidden="true" />
        </p>
      )}
    </article>
  );
}

export function ThemeCard({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  const theme = plan.ideas.find((idea) => idea.kind === 'theme');
  return (
    <article className="card" aria-labelledby="theme-card-title">
      <header className="card-head">
        <span className="badge">
          <Lightbulb />
        </span>
        <h2 id="theme-card-title">{t.overview.themeTitle}</h2>
        {theme?.source === 'ai' && (
          <span className="pill pill--ai">
            <Sparkles />
            Gemini
          </span>
        )}
      </header>
      {theme ? (
        <div className="mood">
          {theme.palette && theme.palette.length > 0 && (
            <div className="swatch-fan" aria-hidden="true">
              {theme.palette.slice(0, 3).map((color) => (
                <i key={color} style={{ background: color }} />
              ))}
            </div>
          )}
          <div>
            <h3 {...writtenIn(plan.brief.language)}>{theme.title}</h3>
            <p {...writtenIn(plan.brief.language)}>{theme.description}</p>
          </div>
        </div>
      ) : (
        <p className="note">{t.overview.themeWaiting}</p>
      )}
      <Link className="more mt-3 inline-block" href={paths.plan(plan.id, 'ideas')}>
        {t.sections.ideas} →
      </Link>
    </article>
  );
}

export function RisksCard({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  if (plan.risks.length === 0) return null;
  return (
    <article className="card card--wide" aria-labelledby="risks-title">
      <header className="card-head">
        <span className="badge">
          <ShieldAlert />
        </span>
        <h2 id="risks-title">{t.overview.risksTitle}</h2>
      </header>
      <ul className="tasks">
        {plan.risks.map((risk) => (
          <li key={risk.id}>
            <div>
              <p className="t" {...writtenIn(plan.brief.language)}>
                {risk.title}
              </p>
              <p className="m">
                <span className={`pill ${LIKELIHOOD_PILL[risk.likelihood]}`}>
                  {t.overview.likelihood[risk.likelihood]}
                </span>
                <span {...writtenIn(plan.brief.language)}>{risk.mitigation}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function SummaryCard({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  if (!plan.summary) return null;
  return (
    <article className="card card--wide summary-card" aria-labelledby="summary-title">
      <header className="card-head">
        <span className="badge">
          <Sparkles />
        </span>
        <h2 id="summary-title">{t.overview.summaryTitle}</h2>
        <span className="pill pill--ai">Gemini</span>
      </header>
      <p className="summary-text" {...writtenIn(plan.brief.language)}>
        {plan.summary}
      </p>
    </article>
  );
}
