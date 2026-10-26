/** Adds one guest (or a family) to the list: a name, an optional group and a party size. */
import { Plus } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { toast } from '../../app/feedback';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n';
import type { Edit } from '../plan/use-edit';
import { isPartySize } from './GuestTable';

export function AddGuestForm({ edit }: { edit: Edit }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [partySize, setPartySize] = useState('1');

  const addGuest = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const size = Number(partySize);
    if (!name.trim() || !isPartySize(size)) {
      toast(t.guestsSection.addInvalid, { tone: 'error' });
      return;
    }
    const guest = {
      name: name.trim(),
      partySize: size,
      rsvp: 'pending' as const,
      ...(group.trim() ? { group: group.trim() } : {}),
    };
    // The group stays filled in: guests are usually added one family at a time.
    if (edit({ type: 'guest.add', guest })) {
      setName('');
      setPartySize('1');
    }
  };

  return (
    <form className="add-row" onSubmit={addGuest}>
      <TextField
        id="guest-name"
        label={t.guestsSection.name}
        maxLength={80}
        autoComplete="off"
        value={name}
        onChange={setName}
      />
      <TextField
        id="guest-group"
        label={t.guestsSection.group}
        extra={`(${t.common.optional})`}
        maxLength={40}
        value={group}
        onChange={setGroup}
      />
      <TextField
        id="guest-party"
        label={t.guestsSection.partySize}
        type="number"
        min={1}
        max={20}
        value={partySize}
        onChange={setPartySize}
      />
      <button type="submit" className="btn btn--primary btn--sm">
        <Plus />
        {t.guestsSection.add}
      </button>
    </form>
  );
}
