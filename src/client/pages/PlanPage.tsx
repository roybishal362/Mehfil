/**
 * A plan: the invitation header, section tabs, the section itself and the Copilot beside it.
 * Each section has its own URL (/plan/<id>/budget …) so it can be bookmarked and shared.
 */
import { Link } from 'wouter';
import { isPlanSection, paths, useDocumentTitle, type PlanSection } from '../app/routing';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { CopilotPanel } from '../features/copilot/CopilotPanel';
import { Overview } from '../features/overview/Overview';
import { InvitationCard } from '../features/plan/InvitationCard';
import { AiStatus, PlanTabs, UndoRedo, sectionLabel } from '../features/plan/PlanChrome';
import { BudgetSection } from '../features/sections/BudgetSection';
import { DayOfSection } from '../features/sections/DayOfSection';
import { GuestsSection } from '../features/sections/GuestsSection';
import { IdeasSection } from '../features/sections/IdeasSection';
import { TimelineSection } from '../features/sections/TimelineSection';
import { VendorsSection } from '../features/sections/VendorsSection';
import { useI18n } from '../i18n';
import { usePlan } from '../state/plans';
import type { EventPlan } from '../../shared/schemas/plan';

function SectionView({ section, plan }: { section: PlanSection; plan: EventPlan }) {
  switch (section) {
    case 'overview':
      return <Overview plan={plan} />;
    case 'budget':
      return <BudgetSection plan={plan} />;
    case 'timeline':
      return <TimelineSection plan={plan} />;
    case 'vendors':
      return <VendorsSection plan={plan} />;
    case 'ideas':
      return <IdeasSection plan={plan} />;
    case 'guests':
      return <GuestsSection plan={plan} />;
    case 'day-of':
      return <DayOfSection plan={plan} />;
  }
}

export function PlanPage({ params }: { params: { id?: string; section?: string } }) {
  const { t } = useI18n();
  const plan = usePlan(params.id);
  const section: PlanSection = isPlanSection(params.section) ? params.section : 'overview';
  useDocumentTitle(
    plan ? `${sectionLabel(section, t)} · ${plan.brief.title}` : t.plan.notFoundTitle,
  );

  if (!plan) {
    return (
      <div className="wrap">
        <div className="empty mt-16">
          <h1 data-route-focus="page" tabIndex={-1} className="text-4xl">
            {t.plan.notFoundTitle}
          </h1>
          <p>{t.plan.notFoundText}</p>
          <Link className="btn btn--gold mt-4" href={paths.home}>
            {t.plan.backHome}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <InvitationCard plan={plan} />
      <UndoRedo planId={plan.id} />
      <PlanTabs planId={plan.id} current={section} />
      <div className="mb-6">
        <AiStatus plan={plan} />
      </div>
      <div className="ws-body">
        <div className="ws-main">
          <ErrorBoundary
            key={section}
            fallback={(reset) => (
              <div className="notice notice--danger" role="alert">
                <p>{t.copilot.error}</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
                  {t.common.retry}
                </button>
              </div>
            )}
          >
            <SectionView section={section} plan={plan} />
          </ErrorBoundary>
        </div>
        <CopilotPanel plan={plan} />
      </div>
    </div>
  );
}
