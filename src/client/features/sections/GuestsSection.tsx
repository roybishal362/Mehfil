/**
 * Guests: the list, RSVPs and food preferences, with spreadsheet import and export. Names stay
 * on the device; only the invitation writer talks to Gemini, and it never sees the list.
 */
import { Download, Upload } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { summariseGuests } from '../../../shared/domain/guests';
import { guestsFromCsv, guestsToCsv } from '../../../shared/export/csv';
import type { EventPlan, Guest } from '../../../shared/schemas/plan';
import { toast } from '../../app/feedback';
import { useI18n } from '../../i18n';
import { downloadText, fileSlug } from '../../lib/download';
import { useEdit, type Edit } from '../plan/use-edit';
import { AddGuestForm } from './AddGuestForm';
import { GuestTable } from './GuestTable';
import { InvitationWriter } from './InvitationWriter';
import { SectionHead } from './SectionHead';

/** A spreadsheet of guests is a few kilobytes; anything near a megabyte is not one. */
const MAX_CSV_BYTES = 1_000_000;

/** Import from and export to a spreadsheet (CSV). */
function GuestFileActions({ plan, edit }: { plan: EventPlan; edit: Edit }) {
  const { t, f } = useI18n();

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared at once, so choosing the same file again imports it again.
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      toast(t.guestsSection.fileTooBig, { tone: 'error' });
      return;
    }
    const result = guestsFromCsv(await file.text());
    if (result.guests.length > 0 && edit({ type: 'guests.import', guests: result.guests })) {
      toast(t.guestsSection.imported(f.number(result.guests.length)));
    }
    if (result.errors.length > 0) {
      toast(t.guestsSection.importSkipped(f.number(result.errors.length)), { tone: 'error' });
    }
  };

  const exportCsv = () => {
    const name = `${fileSlug(plan.brief.title)}-guests.csv`;
    downloadText(name, guestsToCsv(plan.guests), 'text/csv;charset=utf-8');
  };

  return (
    <>
      <label className="btn btn--ghost btn--sm file-button">
        <Upload />
        {t.guestsSection.importCsv}
        <input type="file" accept=".csv,text/csv" onChange={(event) => void importCsv(event)} />
      </label>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={plan.guests.length === 0}
        onClick={exportCsv}
      >
        <Download />
        {t.guestsSection.exportCsv}
      </button>
    </>
  );
}

/** Head counts at a glance, and what happens to the names. */
function GuestSummary({ guests }: { guests: readonly Guest[] }) {
  const { t, f } = useI18n();
  const summary = summariseGuests(guests);
  const stones = [
    { key: 'people', label: t.guestsSection.people, value: summary.people },
    { key: 'yes', label: t.rsvp.yes, value: summary.confirmed },
    { key: 'maybe', label: t.rsvp.maybe, value: summary.maybe },
    { key: 'pending', label: t.rsvp.pending, value: summary.pending },
  ];
  return (
    <div className="card grid gap-3">
      <ul className="stones">
        {stones.map((stone) => (
          <li
            key={stone.key}
            className={stone.key === 'yes' && stone.value > 0 ? 'stone stone--lit' : 'stone'}
          >
            <b>{f.number(stone.value)}</b>
            <span>{stone.label}</span>
          </li>
        ))}
      </ul>
      <p className="note">{t.guestsSection.privacy}</p>
      <p className="note">{t.guestsSection.csvHint}</p>
    </div>
  );
}

export function GuestsSection({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  const edit = useEdit(plan.id);
  return (
    <section className="ws-main" aria-labelledby="section-title">
      <SectionHead title={t.guestsSection.title} intro={t.guestsSection.intro}>
        <GuestFileActions plan={plan} edit={edit} />
      </SectionHead>
      <GuestSummary guests={plan.guests} />
      <div className="card">
        {plan.guests.length === 0 ? (
          <p className="empty">{t.guestsSection.empty}</p>
        ) : (
          <GuestTable guests={plan.guests} edit={edit} />
        )}
        <AddGuestForm edit={edit} />
      </div>
      <InvitationWriter plan={plan} />
    </section>
  );
}
