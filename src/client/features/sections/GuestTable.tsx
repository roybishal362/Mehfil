/** The guest list as an editable table: name, party size, RSVP and food preference. */
import { Trash2 } from 'lucide-react';
import type { PlanOperationInput } from '../../../shared/schemas/operations';
import type { Guest } from '../../../shared/schemas/plan';
import { DIETARY_NEEDS, RSVP_STATUSES } from '../../../shared/schemas/primitives';
import { CommitInput } from '../../components/CommitInput';
import { useI18n } from '../../i18n';
import type { Edit } from '../plan/use-edit';

type GuestPatch = Extract<PlanOperationInput, { type: 'guest.update' }>['patch'];

/** The same limit the schema sets: a household or group, not a whole guest list. */
export const isPartySize = (size: number) => Number.isInteger(size) && size >= 1 && size <= 20;

function GuestRow({ guest, edit }: { guest: Guest; edit: Edit }) {
  const { t } = useI18n();
  const update = (patch: GuestPatch) => edit({ type: 'guest.update', id: guest.id, patch });
  return (
    <tr>
      <th scope="row">
        <CommitInput
          value={guest.name}
          label={t.guestsSection.name}
          maxLength={80}
          onCommit={(value) => update({ name: value })}
        />
        {guest.group && <span className="line-why">{guest.group}</span>}
      </th>
      <td>
        <input
          type="number"
          className="input input--inline input--narrow"
          min={1}
          max={20}
          aria-label={t.guestsSection.partySizeFor(guest.name)}
          value={guest.partySize}
          onChange={(event) => {
            const size = Number(event.target.value);
            if (isPartySize(size)) update({ partySize: size });
          }}
        />
      </td>
      <td>
        <select
          className="select select--sm"
          aria-label={t.guestsSection.rsvpFor(guest.name)}
          value={guest.rsvp}
          onChange={(event) => {
            const rsvp = RSVP_STATUSES.find((value) => value === event.target.value);
            if (rsvp) update({ rsvp });
          }}
        >
          {RSVP_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t.rsvp[value]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          className="select select--sm"
          aria-label={t.guestsSection.foodFor(guest.name)}
          value={guest.dietary ?? ''}
          onChange={(event) => {
            const dietary = DIETARY_NEEDS.find((value) => value === event.target.value);
            update(dietary ? { dietary } : { dietary: undefined });
          }}
        >
          <option value="">{t.guestsSection.noPreference}</option>
          {DIETARY_NEEDS.map((value) => (
            <option key={value} value={value}>
              {t.dietary[value]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button
          type="button"
          className="icon-btn"
          aria-label={t.guestsSection.remove(guest.name)}
          onClick={() => edit({ type: 'guest.remove', id: guest.id })}
        >
          <Trash2 />
        </button>
      </td>
    </tr>
  );
}

export function GuestTable({ guests, edit }: { guests: readonly Guest[]; edit: Edit }) {
  const { t } = useI18n();
  return (
    <div className="table-wrap">
      <table className="lines">
        <caption className="sr-only">{t.guestsSection.title}</caption>
        <thead>
          <tr>
            <th scope="col">{t.guestsSection.name}</th>
            <th scope="col">{t.guestsSection.partySize}</th>
            <th scope="col">{t.guestsSection.rsvp}</th>
            <th scope="col">{t.guestsSection.food}</th>
            <th scope="col">
              <span className="sr-only">{t.budgetSection.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {guests.map((guest) => (
            <GuestRow key={guest.id} guest={guest} edit={edit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
