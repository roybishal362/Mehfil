/** "Today's focus": the next tasks to tick off, each with how soon it is due. */
import { Sparkles } from 'lucide-react';
import { Art } from '../../art/Art';
import { nextTasks, taskState } from '../../../shared/domain/timeline';
import type { EventPlan, Task } from '../../../shared/schemas/plan';
import { diffDays, localToday } from '../../../shared/utils/dates';
import { toast } from '../../app/feedback';
import { useI18n, type Formatters, type Messages } from '../../i18n';
import { plansStore } from '../../state/plans';

function duePill(task: Task, today: string, t: Messages, f: Formatters) {
  const state = taskState(task, today);
  const days = diffDays(task.dueDate, today);
  if (state === 'overdue') {
    return <span className="pill pill--danger">{t.overview.overdue(f.number(-days), -days)}</span>;
  }
  if (days === 0) return <span className="pill pill--warn">{t.overview.dueToday}</span>;
  if (state === 'due_soon') {
    return <span className="pill pill--warn">{t.overview.dueIn(f.number(days), days)}</span>;
  }
  return <span className="pill pill--ok">{t.overview.dueOn(f.dateShort(task.dueDate))}</span>;
}

export function FocusCard({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const today = localToday();
  const tasks = nextTasks(plan.tasks, 4);
  const tailored = plan.ai.sections.timeline.status === 'ai';

  const complete = (task: Task) => {
    const result = plansStore
      .getState()
      .apply(plan.id, [{ type: 'task.update', id: task.id, patch: { status: 'done' } }]);
    if (!result.ok) return;
    toast(t.taskStatuses.done + ': ' + task.title, {
      action: {
        label: t.common.undo,
        run: () => {
          plansStore.getState().undo(plan.id);
        },
      },
    });
  };

  return (
    <article className="card card--wide" aria-labelledby="focus-title">
      <header className="card-head">
        <span className="badge" aria-hidden="true">
          <Art name="target" size={30} />
        </span>
        <h2 id="focus-title">{t.overview.focusTitle}</h2>
        {tailored && (
          <span className="pill pill--ai">
            <Sparkles />
            {t.overview.tailored}
          </span>
        )}
      </header>
      {tasks.length === 0 ? (
        <p className="empty">{t.overview.allClear}</p>
      ) : (
        <ul className="tasks">
          {tasks.map((task) => (
            <li key={task.id}>
              <input
                type="checkbox"
                className="check"
                checked={false}
                aria-label={t.overview.markDone(task.title)}
                onChange={() => {
                  complete(task);
                }}
              />
              <div>
                <p className="t">{task.title}</p>
                <p className="m">
                  {duePill(task, today, t, f)}
                  {task.notes && <span>{task.notes}</span>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
