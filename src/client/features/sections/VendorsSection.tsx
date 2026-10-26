/**
 * The vendor checklist. Mehfil never invents vendors: each category links to a Google Maps
 * search for real ones nearby. Users record quotes here; a chosen, booked quote is counted
 * against the matching budget line automatically.
 */
import { Plus } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import type { EventPlan } from '../../../shared/schemas/plan';
import { PRIORITIES, type Priority } from '../../../shared/schemas/primitives';
import { localToday } from '../../../shared/utils/dates';
import { toast } from '../../app/feedback';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n';
import { useEdit, type Edit } from '../plan/use-edit';
import { SectionHead } from './SectionHead';
import { VendorCard } from './VendorCard';

/** Adds a vendor of the user's own kind (a mehendi artist, a dhol player…), to book by a date. */
function AddVendorForm({ plan, edit }: { plan: EventPlan; edit: Edit }) {
  const { t } = useI18n();
  const [label, setLabel] = useState('');
  const [bookBy, setBookBy] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');

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
    <form className="card add-row" onSubmit={addVendor}>
      <h3 className="add-title">{t.vendorsSection.addVendor}</h3>
      <TextField
        id="vendor-label"
        label={t.vendorsSection.vendorLabel}
        maxLength={60}
        value={label}
        onChange={setLabel}
      />
      <TextField
        id="vendor-book-by"
        label={t.vendorsSection.bookByLabel}
        type="date"
        min={localToday()}
        max={plan.brief.date}
        value={bookBy}
        onChange={setBookBy}
      />
      <SelectField
        id="vendor-priority"
        label={t.timelineSection.priority}
        value={priority}
        options={PRIORITIES}
        labelOf={(value) => t.priorities[value]}
        onChange={setPriority}
      />
      <button type="submit" className="btn btn--primary btn--sm">
        <Plus />
        {t.vendorsSection.addVendorButton}
      </button>
    </form>
  );
}

export function VendorsSection({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  const edit = useEdit(plan.id);
  const vendors = [...plan.vendors].sort((a, b) => a.bookBy.localeCompare(b.bookBy));
  return (
    <section className="ws-main" aria-labelledby="section-title">
      <SectionHead title={t.vendorsSection.title} intro={t.vendorsSection.intro} />
      {vendors.map((vendor) => (
        <VendorCard key={vendor.id} plan={plan} vendor={vendor} />
      ))}
      <AddVendorForm plan={plan} edit={edit} />
    </section>
  );
}
