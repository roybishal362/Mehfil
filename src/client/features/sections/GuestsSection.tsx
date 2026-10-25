/**
 * Guests: the list, RSVPs and food preferences, with spreadsheet import and export. Names stay
 * on the device; only the invitation writer talks to Gemini, and it never sees the list.
 */
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { useState, type ChangeEvent, type SubmitEvent } from 'react';
import { summariseGuests } from '../../../shared/domain/guests';
import { guestsFromCsv, guestsToCsv } from '../../../shared/export/csv';
import type { EventPlan } from '../../../shared/schemas/plan';
import { DIETARY_NEEDS, RSVP_STATUSES } from '../../../shared/schemas/primitives';
import { toast } from '../../app/feedback';
import { CommitInput } from '../../components/CommitInput';
import { Field } from '../../components/Field';
import { useI18n } from '../../i18n';
import { downloadText, fileSlug } from '../../lib/download';
import { useEdit } from '../plan/use-edit';
import { InvitationWriter } from './InvitationWriter';
import { SectionHead } from './SectionHead';

export function GuestsSection({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const edit = useEdit(plan.id);
  const summary = summariseGuests(plan.guests);
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [partySize, setPartySize] = useState('1');

  const addGuest = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const size = Number(partySize);
    if (!name.trim() || !Number.isInteger(size) || size < 1 || size > 20) {
      toast(t.guestsSection.addInvalid, { tone: 'error' });
      return;
    }
    const guest = {
      name: name.trim(),
      partySize: size,
      rsvp: 'pending' as const,
      ...(group.trim() ? { group: group.trim() } : {}),
    };
    if (edit({ type: 'guest.add', guest })) {
      setName('');
      setPartySize('1');
    }
  };

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1_000_000) {
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

  const stones = [
    { key: 'people', label: t.guestsSection.people, value: summary.people },
    { key: 'yes', label: t.rsvp.yes, value: summary.confirmed },
    { key: 'maybe', label: t.rsvp.maybe, value: summary.maybe },
    { key: 'pending', label: t.rsvp.pending, value: summary.pending },
  ];

  return (
    <section className="ws-main" aria-labelledby="section-title">
      <SectionHead title={t.guestsSection.title} intro={t.guestsSection.intro}>
        <label className="btn btn--ghost btn--sm file-button">
          <Upload />
          {t.guestsSection.importCsv}
          <input type="file" accept=".csv,text/csv" onChange={(event) => void importCsv(event)} />
        </label>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={plan.guests.length === 0}
          onClick={() => {
            downloadText(
              `${fileSlug(plan.brief.title)}-guests.csv`,
              guestsToCsv(plan.guests),
              'text/csv;charset=utf-8',
            );
          }}
        >
          <Download />
          {t.guestsSection.exportCsv}
        </button>
      </SectionHead>

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

      <div className="card">
        {plan.guests.length === 0 ? (
          <p className="empty">{t.guestsSection.empty}</p>
        ) : (
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
                {plan.guests.map((guest) => (
                  <tr key={guest.id}>
                    <th scope="row">
                      <CommitInput
                        value={guest.name}
                        label={t.guestsSection.name}
                        maxLength={80}
                        onCommit={(value) =>
                          edit({ type: 'guest.update', id: guest.id, patch: { name: value } })
                        }
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
                          if (Number.isInteger(size) && size >= 1 && size <= 20) {
                            edit({
                              type: 'guest.update',
                              id: guest.id,
                              patch: { partySize: size },
                            });
                          }
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
                          if (rsvp) edit({ type: 'guest.update', id: guest.id, patch: { rsvp } });
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
                          const dietary = DIETARY_NEEDS.find(
                            (value) => value === event.target.value,
                          );
                          edit({
                            type: 'guest.update',
                            id: guest.id,
                            patch: dietary ? { dietary } : { dietary: undefined },
                          });
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
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form className="add-row" onSubmit={addGuest}>
          <Field id="guest-name" label={t.guestsSection.name}>
            {(control) => (
              <input
                {...control}
                className="input"
                maxLength={80}
                autoComplete="off"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            )}
          </Field>
          <Field id="guest-group" label={t.guestsSection.group} extra={`(${t.common.optional})`}>
            {(control) => (
              <input
                {...control}
                className="input"
                maxLength={40}
                value={group}
                onChange={(event) => {
                  setGroup(event.target.value);
                }}
              />
            )}
          </Field>
          <Field id="guest-party" label={t.guestsSection.partySize}>
            {(control) => (
              <input
                {...control}
                type="number"
                className="input"
                min={1}
                max={20}
                value={partySize}
                onChange={(event) => {
                  setPartySize(event.target.value);
                }}
              />
            )}
          </Field>
          <button type="submit" className="btn btn--gold btn--sm">
            <Plus />
            {t.guestsSection.add}
          </button>
        </form>
      </div>

      <InvitationWriter plan={plan} />
    </section>
  );
}
