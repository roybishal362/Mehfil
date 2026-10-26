/** Adds a moment to the run sheet: the day, the time, how long it takes and who is in charge. */
import { Plus } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import type { EventPlan } from '../../../shared/schemas/plan';
import { addDays, isClockTime } from '../../../shared/utils/dates';
import { toast } from '../../app/feedback';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n';
import type { Edit } from '../plan/use-edit';

/** Up to twelve hours: longer than that is a day of its own. */
const MAX_MINUTES = 720;

const isDuration = (minutes: number) =>
  Number.isInteger(minutes) && minutes >= 0 && minutes <= MAX_MINUTES;

export function AddSlotForm({ plan, edit }: { plan: EventPlan; edit: Edit }) {
  const { t } = useI18n();
  const [day, setDay] = useState(plan.brief.date);
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');

  const addItem = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const durationMinutes = Number(minutes);
    if (!title.trim() || !isClockTime(time) || !isDuration(durationMinutes)) {
      toast(t.dayOfSection.addInvalid, { tone: 'error' });
      return;
    }
    const item = {
      day,
      time,
      durationMinutes,
      title: title.trim(),
      ...(owner.trim() ? { owner: owner.trim() } : {}),
    };
    if (edit({ type: 'schedule.add', item })) {
      setTitle('');
      setTime('');
      setOwner('');
    }
  };

  return (
    <form className="card add-row" onSubmit={addItem}>
      <h3 className="add-title">{t.dayOfSection.add}</h3>
      <TextField
        id="slot-day"
        label={t.dayOfSection.day}
        type="date"
        min={addDays(plan.brief.date, -1)}
        max={plan.brief.endDate ?? plan.brief.date}
        value={day}
        onChange={setDay}
      />
      <TextField
        id="slot-time"
        label={t.dayOfSection.time}
        type="time"
        value={time}
        onChange={setTime}
      />
      <TextField
        id="slot-minutes"
        label={t.dayOfSection.duration}
        type="number"
        min={0}
        max={MAX_MINUTES}
        step={15}
        value={minutes}
        onChange={setMinutes}
      />
      <TextField
        id="slot-title"
        label={t.dayOfSection.itemTitle}
        maxLength={100}
        value={title}
        onChange={setTitle}
      />
      <TextField
        id="slot-owner"
        label={t.dayOfSection.owner}
        extra={`(${t.common.optional})`}
        maxLength={60}
        value={owner}
        onChange={setOwner}
      />
      <button type="submit" className="btn btn--primary btn--sm">
        <Plus />
        {t.dayOfSection.addButton}
      </button>
    </form>
  );
}
