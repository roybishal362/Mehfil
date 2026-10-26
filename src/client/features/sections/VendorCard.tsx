/**
 * One vendor on the checklist: status, book-by date, Gemini's questions and red flags,
 * a Google Maps search for real vendors, and the quotes the user has collected.
 */
import { CircleCheck, ExternalLink, MapPin, Sparkles, Trash2 } from 'lucide-react';
import { Fragment } from 'react';
import { cheapestOption, committedAmount, vendorState } from '../../../shared/domain/vendors';
import { googleMapsSearchLink, vendorSearchQuery } from '../../../shared/export/links';
import type { EventPlan, Vendor } from '../../../shared/schemas/plan';
import { VENDOR_STATUSES } from '../../../shared/schemas/primitives';
import { diffDays, localToday } from '../../../shared/utils/dates';
import { useI18n, type I18n } from '../../i18n';
import { writtenIn } from '../../i18n/written-in';
import { useEdit, type Edit } from '../plan/use-edit';
import { QuoteForm } from './QuoteForm';

const STATE_PILL = {
  secured: 'pill--ok',
  overdue: 'pill--danger',
  due_soon: 'pill--warn',
  open: 'pill--plain',
} as const;

/** Booked vendors show their status; the rest show how late, or when to book by. */
function stateText(vendor: Vendor, today: string, { t, f }: I18n): string {
  const state = vendorState(vendor, today);
  if (state === 'secured') return t.vendorStatuses[vendor.status];
  if (state === 'overdue') {
    const days = diffDays(vendor.bookBy, today);
    return t.overview.overdue(f.number(-days), -days);
  }
  return t.vendorsSection.bookBy(f.dateShort(vendor.bookBy));
}

/** The status, and a Google Maps search for real vendors of this kind in the city. */
function VendorBar({ plan, vendor, edit }: { plan: EventPlan; vendor: Vendor; edit: Edit }) {
  const { t } = useI18n();
  const { type, city } = plan.brief;
  const mapsQuery = vendorSearchQuery(vendor.category, type, city, vendor.label);
  return (
    <div className="vendor-bar">
      <label className="flex items-center gap-2">
        <span className="text-muted">{t.vendorsSection.status}</span>
        <select
          className="select select--sm"
          value={vendor.status}
          onChange={(event) => {
            const status = VENDOR_STATUSES.find((value) => value === event.target.value);
            if (status) edit({ type: 'vendor.update', id: vendor.id, patch: { status } });
          }}
        >
          {VENDOR_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t.vendorStatuses[status]}
            </option>
          ))}
        </select>
      </label>
      <a
        className="btn btn--ghost btn--sm"
        href={googleMapsSearchLink(mapsQuery)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MapPin />
        {t.vendorsSection.findOnMaps}
        <span className="sr-only"> {t.vendorsSection.newTab}</span>
        <ExternalLink aria-hidden="true" />
      </a>
    </div>
  );
}

/** Gemini's advice: what to ask, what to watch out for, and a tip, in the plan's language. */
function VendorAdvice({ vendor, language }: { vendor: Vendor; language: string }) {
  const { t } = useI18n();
  const lists = [
    { title: t.vendorsSection.askThem, items: vendor.questions },
    { title: t.vendorsSection.redFlags, items: vendor.redFlags },
  ].filter((list) => list.items.length > 0);
  if (lists.length === 0 && !vendor.tip) return null;
  return (
    <details className="advice" {...writtenIn(language)}>
      <summary>{t.vendorsSection.advice}</summary>
      {lists.map((list) => (
        <Fragment key={list.title}>
          <h4>{list.title}</h4>
          <ul>
            {list.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Fragment>
      ))}
      {vendor.tip && <p className="note">{vendor.tip}</p>}
    </details>
  );
}

/** The quotes collected so far: choose one (choosing it again clears the choice) or remove. */
function QuoteList({ plan, vendor, edit }: { plan: EventPlan; vendor: Vendor; edit: Edit }) {
  const { t, f } = useI18n();
  const cheapest = cheapestOption(vendor);
  return (
    <ul className="quotes" aria-label={t.vendorsSection.quotes}>
      {vendor.options.map((option) => {
        const chosen = vendor.selectedOptionId === option.id;
        const amount =
          option.quote === undefined ? '—' : f.money(option.quote, plan.budget.currency);
        return (
          <li key={option.id} className={chosen ? 'quote quote--chosen' : 'quote'}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {option.name}
                {cheapest?.id === option.id && vendor.options.length > 1 && (
                  <span className="pill pill--ok ml-2">{t.vendorsSection.cheapest}</span>
                )}
              </p>
              <p className="text-muted text-sm">
                {amount}
                {option.phone ? ` · ${option.phone}` : ''}
              </p>
            </div>
            <button
              type="button"
              className={chosen ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
              aria-pressed={chosen}
              onClick={() =>
                edit({
                  type: 'vendor.update',
                  id: vendor.id,
                  patch: { selectedOptionId: chosen ? null : option.id },
                })
              }
            >
              {chosen ? t.vendorsSection.chosen : t.vendorsSection.choose}
              <span className="sr-only">: {option.name}</span>
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={t.vendorsSection.removeQuote(option.name)}
              onClick={() =>
                edit({ type: 'vendor.removeOption', vendorId: vendor.id, optionId: option.id })
              }
            >
              <Trash2 />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function VendorCard({ plan, vendor }: { plan: EventPlan; vendor: Vendor }) {
  const i18n = useI18n();
  const { t, f } = i18n;
  const edit = useEdit(plan.id);
  const today = localToday();
  const name = vendor.label ?? t.vendorCategories[vendor.category];
  const committed = committedAmount(vendor);
  const headingId = `vendor-${vendor.id}`;

  return (
    <article className="card vendor" aria-labelledby={headingId}>
      <header className="card-head">
        <h3 id={headingId}>{name}</h3>
        <span className={`pill ${STATE_PILL[vendorState(vendor, today)]}`}>
          {stateText(vendor, today, i18n)}
        </span>
        {vendor.priority === 'high' && <span className="pill pill--warn">{t.priorities.high}</span>}
        {vendor.source === 'ai' && (
          <span className="pill pill--ai">
            <Sparkles />
            Gemini
          </span>
        )}
      </header>
      <VendorBar plan={plan} vendor={vendor} edit={edit} />
      {committed > 0 && (
        <p className="note">
          <CircleCheck />
          {t.vendorsSection.committed(f.money(committed, plan.budget.currency))}
        </p>
      )}
      <VendorAdvice vendor={vendor} language={plan.brief.language} />
      {vendor.options.length > 0 && <QuoteList plan={plan} vendor={vendor} edit={edit} />}
      <details className="advice">
        <summary>{t.vendorsSection.addQuote}</summary>
        <QuoteForm plan={plan} vendor={vendor} />
      </details>
      <button
        type="button"
        className="btn btn--quiet mt-2"
        onClick={() => edit({ type: 'vendor.remove', id: vendor.id })}
      >
        <Trash2 />
        {t.vendorsSection.removeVendor}
        <span className="sr-only">: {name}</span>
      </button>
    </article>
  );
}
