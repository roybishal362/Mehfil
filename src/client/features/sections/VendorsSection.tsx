/**
 * The vendor checklist. Mehfil never invents vendors: each category links to a Google Maps
 * search for real ones nearby. Users record quotes here; a chosen, booked quote is counted
 * against the matching budget line automatically.
 */
import { Plus } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import type { EventPlan } from '../../../shared/schemas/plan';
import { PRIORITIES, type Priority } from '../../../shared/schemas/primitives';
import { addDays, localToday } from '../../../shared/utils/dates';
import { toast } from '../../app/feedback';
import { Field } from '../../components/Field';
import { useI18n } from '../../i18n';
import { useEdit } from '../plan/use-edit';
import { SectionHead } from './SectionHead';
import { VendorCard } from './VendorCard';

export function VendorsSection({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  const edit = useEdit(plan.id);
  const today = localToday();
  const [label, setLabel] = useState('');
  const [bookBy, setBookBy] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const vendors = [...plan.vendors].sort((a, b) => a.bookBy.localeCompare(b.bookBy));

  const addVendor = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!label.trim() || !bookBy) {
      toast(t.vendorsSection.addInvalid, { tone: 'error' });
      return;
    }
    if (edit({ type: 'vendor.add', vendor: { label: label.trim(), priority, bookBy } })) {
      setLabel('');
      setBookBy('');
    }
  };

  return (
    <section className="ws-main" aria-labelledby="section-title">
      <SectionHead title={t.vendorsSection.title} intro={t.vendorsSection.intro} />
      {vendors.map((vendor) => (
        <VendorCard key={vendor.id} plan={plan} vendor={vendor} />
      ))}
      <form className="card add-row" onSubmit={addVendor}>
        <h3 className="add-title">{t.vendorsSection.addVendor}</h3>
        <Field id="vendor-label" label={t.vendorsSection.vendorLabel}>
          {(control) => (
            <input
              {...control}
              className="input"
              maxLength={60}
              value={label}
              onChange={(event) => {
                setLabel(event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="vendor-book-by" label={t.vendorsSection.bookByLabel}>
          {(control) => (
            <input
              {...control}
              type="date"
              className="input"
              min={today}
              max={addDays(plan.brief.date, 0)}
              value={bookBy}
              onChange={(event) => {
                setBookBy(event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="vendor-priority" label={t.timelineSection.priority}>
          {(control) => (
            <select
              {...control}
              className="select"
              value={priority}
              onChange={(event) => {
                const next = PRIORITIES.find((value) => value === event.target.value);
                if (next) setPriority(next);
              }}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {t.priorities[value]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <button type="submit" className="btn btn--primary btn--sm">
          <Plus />
          {t.vendorsSection.addVendorButton}
        </button>
      </form>
    </section>
  );
}
