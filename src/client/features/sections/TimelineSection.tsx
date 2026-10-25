/**
 * The timeline: tasks scheduled backwards from the event date and grouped by phase. Each task
 * can be ticked off, added to Google Calendar, or exported with every other task as .ics.
 */
import { CalendarPlus, Download, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { groupByPhase, taskState, taskStats, type Phase } from '../../../shared/domain/timeline';
import { buildIcs } from '../../../shared/export/ics';
import { googleCalendarLink } from '../../../shared/export/links';
import type { EventPlan, Task } from '../../../shared/schemas/plan';
import { PRIORITIES, type Priority } from '../../../shared/schemas/primitives';
import { addDays, diffDays, localToday } from '../../../shared/utils/dates';
import { toast } from '../../app/feedback';
import { Field } from '../../components/Field';
import { useI18n } from '../../i18n';
import { downloadText, fileSlug } from '../../lib/download';
import { useEdit } from '../plan/use-edit';
import { SectionHead } from './SectionHead';

const FILTERS = ['all', 'open', 'overdue', 'done'] as const;
type Filter = (typeof FILTERS)[number];

const PRIORITY_PILL: Readonly<Record<Priority, string>> = {
  high: 'pill--danger',
  medium: 'pill--warn',
  low: 'pill--plain',
};

function matches(task: Task, filter: Filter, today: string): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'open':
      return task.status !== 'done';
    case 'overdue':
      return taskState(task, today) === 'overdue';
    case 'done':
      return task.status === 'done';
  }
}

export function TimelineSection({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const edit = useEdit(plan.id);
  const today = localToday();
  const [filter, setFilter] = useState<Filter>('open');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const stats = taskStats(plan.tasks, today);
  const latest = addDays(plan.brief.endDate ?? plan.brief.date, 60);
  const groups = groupByPhase(
    plan.tasks.filter((task) => matches(task, filter, today)),
    plan.brief.date,
  );

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

  const exportIcs = () => {
    downloadText(
      `${fileSlug(plan.brief.title)}.ics`,
      buildIcs(plan, { now: new Date() }),
      'text/calendar;charset=utf-8',
    );
    toast(t.timelineSection.icsDone);
  };

  const dueText = (task: Task) => {
    const days = diffDays(task.dueDate, today);
    const state = taskState(task, today);
    if (state === 'done') return { text: f.dateShort(task.dueDate), pill: 'pill--plain' };
    if (state === 'overdue')
      return { text: t.overview.overdue(f.number(-days), -days), pill: 'pill--danger' };
    if (days === 0) return { text: t.overview.dueToday, pill: 'pill--warn' };
    if (state === 'due_soon')
      return { text: t.overview.dueIn(f.number(days), days), pill: 'pill--warn' };
    return { text: t.overview.dueOn(f.dateShort(task.dueDate)), pill: 'pill--ok' };
  };

  return (
    <section className="ws-main" aria-labelledby="section-title">
      <SectionHead title={t.timelineSection.title} intro={t.timelineSection.intro} art="calendar">
        <button type="button" className="btn btn--ghost btn--sm" onClick={exportIcs}>
          <Download />
          {t.timelineSection.downloadIcs}
        </button>
      </SectionHead>

      <div className="card grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="mr-auto">
            <b>{t.overview.tasksDone(f.number(stats.done), f.number(stats.total))}</b>{' '}
            {t.overview.tasksDoneSuffix}
          </p>
          <div className="filters" role="group" aria-label={t.timelineSection.filterLabel}>
            {FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={filter === option}
                onClick={() => {
                  setFilter(option);
                }}
              >
                {t.timelineSection.filters[option]}
              </button>
            ))}
          </div>
        </div>
        <div className="progress" aria-hidden="true">
          <i style={{ width: `${String(stats.total ? (stats.done / stats.total) * 100 : 0)}%` }} />
        </div>
        <p className="note">{t.timelineSection.icsHint}</p>
      </div>

      {groups.length === 0 ? (
        <p className="card empty">{t.timelineSection.empty}</p>
      ) : (
        groups.map((group) => (
          <div key={group.phase} className="card">
            <h3 className="phase-title">
              {t.timelineSection.phases[group.phase satisfies Phase]}
              <span className="pill pill--plain">{f.number(group.tasks.length)}</span>
            </h3>
            <ul className="tasks">
              {group.tasks.map((task) => {
                const due = dueText(task);
                const done = task.status === 'done';
                return (
                  <li key={task.id} className={done ? 'done' : undefined}>
                    <input
                      type="checkbox"
                      className="check"
                      checked={done}
                      aria-label={
                        done ? t.overview.markOpen(task.title) : t.overview.markDone(task.title)
                      }
                      onChange={() =>
                        edit({
                          type: 'task.update',
                          id: task.id,
                          patch: { status: done ? 'todo' : 'done' },
                        })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="t">
                        {task.title}
                        {task.source === 'ai' && (
                          <span className="pill pill--ai ml-2">
                            <Sparkles />
                            Gemini
                          </span>
                        )}
                      </p>
                      <p className="m">
                        <span className={`pill ${due.pill}`}>{due.text}</span>
                        <span className={`pill ${PRIORITY_PILL[task.priority]}`}>
                          {t.priorities[task.priority]}
                        </span>
                        {task.compressed && !done && (
                          <span
                            className="pill pill--plain"
                            title={t.timelineSection.compressedHint}
                          >
                            {t.timelineSection.compressed}
                          </span>
                        )}
                        {task.notes && <span>{task.notes}</span>}
                      </p>
                    </div>
                    <div className="row-actions">
                      <a
                        className="icon-btn"
                        href={googleCalendarLink({
                          title: task.title,
                          date: task.dueDate,
                          details: `${plan.brief.title} · Mehfil`,
                          location: plan.brief.city,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t.timelineSection.addToCalendar(task.title)}
                        title={t.timelineSection.addToCalendar(task.title)}
                      >
                        <CalendarPlus />
                      </a>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t.timelineSection.remove(task.title)}
                        onClick={() => edit({ type: 'task.remove', id: task.id })}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      <form className="card add-row" onSubmit={addTask}>
        <h3 className="add-title">{t.timelineSection.addTask}</h3>
        <Field id="task-title" label={t.timelineSection.taskTitle}>
          {(control) => (
            <input
              {...control}
              className="input"
              maxLength={120}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="task-due" label={t.timelineSection.dueDate}>
          {(control) => (
            <input
              {...control}
              type="date"
              className="input"
              min={today}
              max={latest}
              value={due}
              onChange={(event) => {
                setDue(event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="task-priority" label={t.timelineSection.priority}>
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
          {t.timelineSection.add}
        </button>
      </form>
    </section>
  );
}
