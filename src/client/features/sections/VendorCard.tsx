/**
 * One vendor on the checklist: status, book-by date, Gemini's questions and red flags,
 * a Google Maps search for real vendors, and the quotes the user has collected.
 */
import { CircleCheck, ExternalLink, MapPin, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { cheapestOption, committedAmount, vendorState } from '../../../shared/domain/vendors';
import { googleMapsSearchLink, vendorSearchQuery } from '../../../shared/export/links';
import type { EventPlan, Vendor } from '../../../shared/schemas/plan';
import { VENDOR_STATUSES } from '../../../shared/schemas/primitives';
import { diffDays, localToday } from '../../../shared/utils/dates';
import { parseAmount } from '../../../shared/utils/money';
import { toast } from '../../app/feedback';
import { Field } from '../../components/Field';
import { useI18n } from '../../i18n';
import { writtenIn } from '../../i18n/written-in';
import { useEdit } from '../plan/use-edit';

const STATE_PILL = {
  secured: 'pill--ok',
  overdue: 'pill--danger',
  due_soon: 'pill--warn',
  open: 'pill--plain',
} as const;

function QuoteForm({ plan, vendor }: { plan: EventPlan; vendor: Vendor }) {
  const { t } = useI18n();
  const edit = useEdit(plan.id);
  const [name, setName] = useState('');
  const [quote, setQuote] = useState('');
  const [phone, setPhone] = useState('');
  const prefix = `quote-${vendor.id}`;
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = quote.trim() ? parseAmount(quote) : null;
    if (!name.trim() || (quote.trim() && amount === null)) {
      toast(t.vendorsSection.quoteInvalid, { tone: 'error' });
      return;
    }
    const option = {
      name: name.trim(),
      ...(amount !== null ? { quote: amount } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    };
    if (edit({ type: 'vendor.addOption', vendorId: vendor.id, option })) {
      setName('');
      setQuote('');
      setPhone('');
    }
  };
  return (
    <form className="add-row" onSubmit={submit}>
      <Field id={`${prefix}-name`} label={t.vendorsSection.vendorName}>
        {(control) => (
          <input
            {...control}
            className="input"
            maxLength={80}
            autoComplete="organization"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        )}
      </Field>
      <Field id={`${prefix}-amount`} label={t.vendorsSection.quote}>
        {(control) => (
          <input
            {...control}
            className="input"
            inputMode="decimal"
            value={quote}
            onChange={(event) => {
              setQuote(event.target.value);
            }}
          />
        )}
      </Field>
      <Field id={`${prefix}-phone`} label={t.vendorsSection.phone} extra={`(${t.common.optional})`}>
        {(control) => (
          <input
            {...control}
            className="input"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
            }}
          />
        )}
      </Field>
      <button type="submit" className="btn btn--ghost btn--sm">
        <Plus />
        {t.vendorsSection.addQuote}
      </button>
    </form>
  );
}

export function VendorCard({ plan, vendor }: { plan: EventPlan; vendor: Vendor }) {
  const { t, f } = useI18n();
  const edit = useEdit(plan.id);
  const today = localToday();
  const name = vendor.label ?? t.vendorCategories[vendor.category];
  const state = vendorState(vendor, today);
  const days = diffDays(vendor.bookBy, today);
  const stateText =
    state === 'secured'
      ? t.vendorStatuses[vendor.status]
      : state === 'overdue'
        ? t.overview.overdue(f.number(-days), -days)
        : t.vendorsSection.bookBy(f.dateShort(vendor.bookBy));
  const cheapest = cheapestOption(vendor);
  const committed = committedAmount(vendor);
  const mapsQuery = vendorSearchQuery(
    vendor.category,
    plan.brief.type,
    plan.brief.city,
    vendor.label,
  );
  const headingId = `vendor-${vendor.id}`;

  return (
    <article className="card vendor" aria-labelledby={headingId}>
      <header className="card-head">
        <h3 id={headingId}>{name}</h3>
        <span className={`pill ${STATE_PILL[state]}`}>{stateText}</span>
        {vendor.priority === 'high' && <span className="pill pill--warn">{t.priorities.high}</span>}
        {vendor.source === 'ai' && (
          <span className="pill pill--ai">
            <Sparkles />
            Gemini
          </span>
        )}
      </header>

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

      {committed > 0 && (
        <p className="note">
          <CircleCheck />
          {t.vendorsSection.committed(f.money(committed, plan.budget.currency))}
        </p>
      )}

      {(vendor.questions.length > 0 || vendor.redFlags.length > 0 || vendor.tip) && (
        <details className="advice" {...writtenIn(plan.brief.language)}>
          <summary>{t.vendorsSection.advice}</summary>
          {vendor.questions.length > 0 && (
            <>
              <h4>{t.vendorsSection.askThem}</h4>
              <ul>
                {vendor.questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </>
          )}
          {vendor.redFlags.length > 0 && (
            <>
              <h4>{t.vendorsSection.redFlags}</h4>
              <ul>
                {vendor.redFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </>
          )}
          {vendor.tip && <p className="note">{vendor.tip}</p>}
        </details>
      )}

      {vendor.options.length > 0 && (
        <ul className="quotes" aria-label={t.vendorsSection.quotes}>
          {vendor.options.map((option) => {
            const chosen = vendor.selectedOptionId === option.id;
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
                    {option.quote !== undefined ? f.money(option.quote, plan.budget.currency) : '—'}
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
      )}

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
