/**
 * A plan opened from a share link: a read-only copy without personal details that anyone with
 * the link can see, without signing in, until it expires or the owner turns it off.
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { moodFor } from '../../shared/domain/mood';
import type { SharedPlan } from '../../shared/export/share';
import { usePageMood } from '../app/mood';
import { paths, useDocumentTitle } from '../app/routing';
import { loadSharedPlan, type SharedPlanResult } from '../cloud/shares';
import {
  SharedBudget,
  SharedHeader,
  SharedIdeas,
  SharedRisks,
  SharedSchedule,
  SharedTasks,
  SharedVendors,
} from '../features/shared/SharedPlanSections';
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
          <Link className="btn btn--primary" href={paths.newPlan()}>
            {t.shared.makeYourOwn}
          </Link>
        </div>
      </div>
    </div>
  );
}

function SharedPlanView({ plan }: { plan: SharedPlan }) {
  const { t } = useI18n();
  useDocumentTitle(plan.title);
  // Family opening a shared link see the plan in its occasion's colours too.
  const mood = moodFor({ type: plan.type, title: plan.title });
  usePageMood(mood);

  return (
    <div className="wrap shared">
      <SharedHeader plan={plan} mood={mood} />
      {plan.summary && (
        <section className="card shared-summary">
          <p {...writtenIn(plan.language)}>{plan.summary}</p>
        </section>
      )}
      <div className="shared-grid">
        {plan.budget && <SharedBudget budget={plan.budget} />}
        {plan.vendors.length > 0 && <SharedVendors vendors={plan.vendors} />}
      </div>
      {plan.tasks.length > 0 && <SharedTasks tasks={plan.tasks} />}
      {plan.ideas.length > 0 && <SharedIdeas plan={plan} />}
      {plan.schedule.length > 0 && <SharedSchedule plan={plan} />}
      {plan.risks.length > 0 && <SharedRisks plan={plan} />}
      <p className="shared-cta">
        <span className="note mt-0">{t.shared.madeWith}</span>
        <Link className="btn btn--primary" href={paths.newPlan()}>
          {t.shared.makeYourOwn}
        </Link>
      </p>
    </div>
  );
}
