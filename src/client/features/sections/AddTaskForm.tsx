/** Adds a task to the timeline, due between today and two months after the event. */
import { Plus } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import type { EventPlan } from '../../../shared/schemas/plan';
import { PRIORITIES, type Priority } from '../../../shared/schemas/primitives';
import { addDays } from '../../../shared/utils/dates';
import { toast } from '../../app/feedback';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n';
import type { Edit } from '../plan/use-edit';

export function AddTaskForm({ plan, edit, today }: { plan: EventPlan; edit: Edit; today: string }) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  // Thank-you notes and settling bills come after the event, so the window runs past it.
  const latest = addDays(plan.brief.endDate ?? plan.brief.date, 60);

  const addTask = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !due || due < today || due > latest) {
      toast(t.timelineSection.addInvalid, { tone: 'error' });
      return;
    }
    if (edit({ type: 'task.add', task: { title: title.trim(), dueDate: due, priority } })) {
      setTitle('');
      setDue('');
    }
  };

  return (
    <form className="card add-row" onSubmit={addTask}>
      <h3 className="add-title">{t.timelineSection.addTask}</h3>
      <TextField
        id="task-title"
        label={t.timelineSection.taskTitle}
        maxLength={120}
        value={title}
        onChange={setTitle}
      />
      <TextField
        id="task-due"
        label={t.timelineSection.dueDate}
        type="date"
        min={today}
        max={latest}
        value={due}
        onChange={setDue}
      />
      <SelectField
        id="task-priority"
        label={t.timelineSection.priority}
        value={priority}
        options={PRIORITIES}
        labelOf={(value) => t.priorities[value]}
        onChange={setPriority}
      />
      <button type="submit" className="btn btn--primary btn--sm">
        <Plus />
        {t.timelineSection.add}
      </button>
    </form>
  );
}
