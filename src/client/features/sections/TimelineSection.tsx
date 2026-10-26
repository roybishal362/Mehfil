/**
 * The timeline: tasks scheduled backwards from the event date and grouped by phase. Each task
 * can be ticked off, added to Google Calendar, or exported with every other task as .ics.
 */
import { CalendarPlus, Download, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { groupByPhase, taskState, taskStats, type Phase } from '../../../shared/domain/timeline';
import { buildIcs } from '../../../shared/export/ics';
import { googleCalendarLink } from '../../../shared/export/links';
import type { EventPlan, Task } from '../../../shared/schemas/plan';
import type { Priority } from '../../../shared/schemas/primitives';
import { diffDays, localToday } from '../../../shared/utils/dates';
import { toast } from '../../app/feedback';
import { useI18n, type I18n } from '../../i18n';
import { downloadText, fileSlug } from '../../lib/download';
import { useEdit, type Edit } from '../plan/use-edit';
import { AddTaskForm } from './AddTaskForm';
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

/** When a task is due, in words, with a colour that says how urgent it is. */
function dueBadge(task: Task, today: string, { t, f }: I18n): { text: string; pill: string } {
  const days = diffDays(task.dueDate, today);
  const state = taskState(task, today);
  if (state === 'done') return { text: f.dateShort(task.dueDate), pill: 'pill--plain' };
  if (state === 'overdue') {
    return { text: t.overview.overdue(f.number(-days), -days), pill: 'pill--danger' };
  }
  if (days === 0) return { text: t.overview.dueToday, pill: 'pill--warn' };
  if (state === 'due_soon') {
    return { text: t.overview.dueIn(f.number(days), days), pill: 'pill--warn' };
  }
  return { text: t.overview.dueOn(f.dateShort(task.dueDate)), pill: 'pill--ok' };
}

interface TaskRowProps {
  task: Task;
  plan: EventPlan;
  edit: Edit;
  today: string;
}

function TaskRow({ task, plan, edit, today }: TaskRowProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const due = dueBadge(task, today, i18n);
  const done = task.status === 'done';
  const calendarLink = googleCalendarLink({
    title: task.title,
    date: task.dueDate,
    details: `${plan.brief.title} · Mehfil`,
    location: plan.brief.city,
  });
  return (
    <li className={done ? 'done' : undefined}>
      <input
        type="checkbox"
        className="check"
        checked={done}
        aria-label={done ? t.overview.markOpen(task.title) : t.overview.markDone(task.title)}
        onChange={() =>
          edit({ type: 'task.update', id: task.id, patch: { status: done ? 'todo' : 'done' } })
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
            <span className="pill pill--plain" title={t.timelineSection.compressedHint}>
              {t.timelineSection.compressed}
            </span>
          )}
          {task.notes && <span>{task.notes}</span>}
        </p>
      </div>
      <div className="row-actions">
        <a
          className="icon-btn"
          href={calendarLink}
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
}

/** How many tasks are done, and which ones to show. */
function TaskProgress({
  plan,
  today,
  filter,
  onFilter,
}: {
  plan: EventPlan;
  today: string;
  filter: Filter;
  onFilter: (filter: Filter) => void;
}) {
  const { t, f } = useI18n();
  const stats = taskStats(plan.tasks, today);
  const percent = stats.total ? (stats.done / stats.total) * 100 : 0;
  return (
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
                onFilter(option);
              }}
            >
              {t.timelineSection.filters[option]}
            </button>
          ))}
        </div>
      </div>
      <div className="progress" aria-hidden="true">
        <i style={{ width: `${String(percent)}%` }} />
      </div>
      <p className="note">{t.timelineSection.icsHint}</p>
    </div>
  );
}

export function TimelineSection({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const edit = useEdit(plan.id);
  const today = localToday();
  const [filter, setFilter] = useState<Filter>('open');
  const groups = groupByPhase(
    plan.tasks.filter((task) => matches(task, filter, today)),
    plan.brief.date,
  );

  const exportIcs = () => {
    const ics = buildIcs(plan, { now: new Date() });
    downloadText(`${fileSlug(plan.brief.title)}.ics`, ics, 'text/calendar;charset=utf-8');
    toast(t.timelineSection.icsDone);
  };

  return (
    <section className="ws-main" aria-labelledby="section-title">
      <SectionHead title={t.timelineSection.title} intro={t.timelineSection.intro}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={exportIcs}>
          <Download />
          {t.timelineSection.downloadIcs}
        </button>
      </SectionHead>
      <TaskProgress plan={plan} today={today} filter={filter} onFilter={setFilter} />
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
              {group.tasks.map((task) => (
                <TaskRow key={task.id} task={task} plan={plan} edit={edit} today={today} />
              ))}
            </ul>
          </div>
        ))
      )}
      <AddTaskForm plan={plan} edit={edit} today={today} />
    </section>
  );
}
