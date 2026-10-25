/**
 * A plan opened from a share link: a read-only copy without personal details that anyone with
 * the link can see, without signing in, until it expires or the owner turns it off.
 */
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import type { SharedPlan } from '../../shared/export/share';
import { paths, useDocumentTitle } from '../app/routing';
import { loadSharedPlan, type SharedPlanResult } from '../cloud/shares';
import { useI18n } from '../i18n';
import { writtenIn } from '../i18n/written-in';

type LoadState = { kind: 'loading' } | { kind: 'error' } | SharedPlanResult;

export function SharedPlanPage({ params }: { params: { id?: string } }) {
  const [attempt, setAttempt] = useState(0);
  const id = params.id ?? '';
  // A new link or a retry starts a fresh load.
  return (
    <SharedPlanLoader
      key={`${id}:${String(attempt)}`}
      id={id}
      onRetry={() => {
        setAttempt((count) => count + 1);
      }}
    />
  );
}

function SharedPlanLoader({ id, onRetry }: { id: string; onRetry: () => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  useEffect(() => {
    let current = true;
    loadSharedPlan(id).then(
      (result) => {
        if (current) setState(result);
      },
      () => {
        if (current) setState({ kind: 'error' });
      },
    );
    return () => {
      current = false;
    };
  }, [id]);

  switch (state.kind) {
    case 'loading':
      return (
        <div className="wrap">
          <p className="empty mt-16" role="status">
            <span className="spinner" aria-hidden="true" />
            {t.shared.loading}
          </p>
        </div>
      );
    case 'plan':
      return <SharedPlanView plan={state.plan} />;
    case 'not_found':
      return <Message title={t.shared.notFoundTitle} text={t.shared.notFoundText} />;
    case 'unavailable':
      return <Message title={t.shared.unavailableTitle} text={t.shared.unavailableText} />;
    case 'error':
      return <Message title={t.shared.errorTitle} text={t.shared.errorText} onRetry={onRetry} />;
  }
}

function Message({ title, text, onRetry }: { title: string; text: string; onRetry?: () => void }) {
  const { t } = useI18n();
  useDocumentTitle(title);
  return (
    <div className="wrap">
      <div className="empty mt-16">
        <h1 data-route-focus="page" tabIndex={-1} className="text-4xl">
          {title}
        </h1>
        <p>{text}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {onRetry && (
            <button type="button" className="btn btn--ghost" onClick={onRetry}>
              {t.common.retry}
            </button>
          )}
          <Link className="btn btn--gold" href={paths.newPlan()}>
            {t.shared.makeYourOwn}
          </Link>
        </div>
      </div>
    </div>
  );
}

const byDate =
  <T,>(key: (item: T) => string) =>
  (a: T, b: T) =>
    key(a).localeCompare(key(b));

function SharedPlanView({ plan }: { plan: SharedPlan }) {
  const { t, f } = useI18n();
  useDocumentTitle(plan.title);
  const tasks = [...plan.tasks].sort(byDate((task) => task.dueDate));
  const vendors = [...plan.vendors].sort(byDate((vendor) => vendor.bookBy));
  const schedule = [...plan.schedule].sort(byDate((slot) => `${slot.day}T${slot.time}`));
  const { budget } = plan;

  return (
    <div className="wrap shared">
      <header className="shared-head">
        <p className="eyebrow smallcaps">{t.shared.eyebrow}</p>
        <h1 data-route-focus="page" tabIndex={-1}>
          {plan.title}
        </h1>
        <ul className="shared-facts">
          <li>
            <CalendarDays />
            {f.dateLong(plan.date)}
            {plan.endDate ? ` – ${f.dateLong(plan.endDate)}` : ''}
          </li>
          <li>
            <MapPin />
            {plan.city}
          </li>
          <li>
            <Users />
            {t.shared.guests(f.number(plan.guests.confirmed), f.number(plan.guests.expected))}
          </li>
        </ul>
        <p className="note">{t.shared.readOnly(f.date(plan.sharedAt.slice(0, 10)))}</p>
      </header>

      {plan.summary && (
        <section className="card shared-summary">
          <p {...writtenIn(plan.language)}>{plan.summary}</p>
        </section>
      )}

      <div className="shared-grid">
        {budget && (
          <section className="card" aria-labelledby="shared-budget">
            <h2 id="shared-budget">{t.shared.budgetTitle}</h2>
            <p className="shared-total tabular">{f.money(budget.total, budget.currency)}</p>
            <table className="shared-table">
              <tbody>
                {budget.lines.map((line) => (
                  <tr key={`${line.category}-${line.label ?? ''}`}>
                    <th scope="row">{line.label ?? t.budgetCategories[line.category]}</th>
                    <td className="tabular">{f.money(line.planned, budget.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {vendors.length > 0 && (
          <section className="card" aria-labelledby="shared-vendors">
            <h2 id="shared-vendors">{t.shared.vendorsTitle}</h2>
            <ul className="shared-list">
              {vendors.map((vendor) => (
                <li key={`${vendor.category}-${vendor.label ?? ''}`}>
                  <span>{vendor.label ?? t.vendorCategories[vendor.category]}</span>
                  <span
                    className={`pill ${vendor.status === 'booked' || vendor.status === 'paid' ? 'pill--ok' : 'pill--plain'}`}
                  >
                    {t.vendorStatuses[vendor.status]}
                  </span>
                  <span className="note mt-0">{t.shared.bookBy(f.dateShort(vendor.bookBy))}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {tasks.length > 0 && (
        <section className="card" aria-labelledby="shared-tasks">
          <h2 id="shared-tasks">{t.shared.tasksTitle}</h2>
          <ul className="shared-list">
            {tasks.map((task, index) => (
              <li key={`${task.dueDate}-${String(index)}`}>
                <span className={task.status === 'done' ? 'shared-done' : undefined}>
                  {task.title}
                </span>
                <span className={`pill ${task.status === 'done' ? 'pill--ok' : 'pill--plain'}`}>
                  {t.taskStatuses[task.status]}
                </span>
                <span className="note mt-0">{t.shared.due(f.dateShort(task.dueDate))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.ideas.length > 0 && (
        <section aria-labelledby="shared-ideas">
          <h2 id="shared-ideas" className="shared-section-title">
            {t.shared.ideasTitle}
          </h2>
          <ul className="shared-ideas">
            {plan.ideas.map((idea, index) => (
              <li key={`${idea.kind}-${String(index)}`} className="card">
                <p className="eyebrow smallcaps">{t.ideaKinds[idea.kind]}</p>
                <h3 {...writtenIn(plan.language)}>{idea.title}</h3>
                <p {...writtenIn(plan.language)}>{idea.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {schedule.length > 0 && (
        <section className="card" aria-labelledby="shared-schedule">
          <h2 id="shared-schedule">{t.shared.scheduleTitle}</h2>
          <ol className="shared-list">
            {schedule.map((slot, index) => (
              <li key={`${slot.day}-${slot.time}-${String(index)}`}>
                <span className="tabular shared-when">
                  {f.dateShort(slot.day)}, {f.time(slot.time)}
                </span>
                <span {...writtenIn(plan.language)}>{slot.title}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {plan.risks.length > 0 && (
        <section className="card" aria-labelledby="shared-risks">
          <h2 id="shared-risks">{t.shared.risksTitle}</h2>
          <ul className="shared-risks">
            {plan.risks.map((risk, index) => (
              <li key={`${risk.title}-${String(index)}`}>
                <b {...writtenIn(plan.language)}>{risk.title}</b>
                <span className="pill pill--plain">{t.overview.likelihood[risk.likelihood]}</span>
                <p {...writtenIn(plan.language)}>{risk.mitigation}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="shared-cta">
        <span className="note mt-0">{t.shared.madeWith}</span>
        <Link className="btn btn--gold" href={paths.newPlan()}>
          {t.shared.makeYourOwn}
        </Link>
      </p>
    </div>
  );
}
