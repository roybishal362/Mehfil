/** The plan page's chrome: section tabs, undo/redo and the Gemini progress banner. */
import { Check, CircleAlert, Redo2, Sparkles, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import type { EventPlan } from '../../../shared/schemas/plan';
import { AI_SECTIONS, type AiSection } from '../../../shared/schemas/primitives';
import { announce, toast } from '../../app/feedback';
import { PLAN_SECTIONS, paths, type PlanSection } from '../../app/routing';
import { useI18n, type Messages } from '../../i18n';
import { personalizePlan, useAiRuns, type SectionState } from '../../state/ai';
import { plansStore, usePlans } from '../../state/plans';

export function sectionLabel(section: PlanSection, t: Messages): string {
  return section === 'day-of' ? t.sections.dayOf : t.sections[section];
}

export function PlanTabs({ planId, current }: { planId: string; current: PlanSection }) {
  const { t } = useI18n();
  return (
    <nav className="plan-tabs" aria-label={t.sectionsNav}>
      {PLAN_SECTIONS.map((section) => (
        <Link
          key={section}
          href={paths.plan(planId, section)}
          aria-current={section === current ? 'page' : undefined}
        >
          {sectionLabel(section, t)}
        </Link>
      ))}
    </nav>
  );
}

export function UndoRedo({ planId }: { planId: string }) {
  const { t } = useI18n();
  const canUndo = usePlans((state) => (state.history[planId]?.past.length ?? 0) > 0);
  const canRedo = usePlans((state) => (state.history[planId]?.future.length ?? 0) > 0);
  return (
    <div className="plan-toolbar" role="group" aria-label={t.plan.history}>
      <span className="note mt-0 mr-auto">{t.plan.saved}</span>
      <button
        type="button"
        className="btn btn--quiet"
        disabled={!canUndo}
        onClick={() => {
          if (plansStore.getState().undo(planId)) announce(t.plan.undone);
        }}
      >
        <Undo2 />
        {t.common.undo}
      </button>
      <button
        type="button"
        className="btn btn--quiet"
        disabled={!canRedo}
        onClick={() => {
          plansStore.getState().redo(planId);
        }}
      >
        <Redo2 />
        {t.common.redo}
      </button>
    </div>
  );
}

type Shown = SectionState | 'template';

function shownState(plan: EventPlan, section: AiSection, running: SectionState | undefined): Shown {
  if (running) return running;
  const status = plan.ai.sections[section].status;
  return status === 'ai' ? 'done' : status === 'failed' ? 'failed' : 'template';
}

const STATE_PILL: Readonly<Record<Shown, string>> = {
  done: 'pill--ok',
  failed: 'pill--danger',
  pending: 'pill--plain',
  template: 'pill--plain',
};

interface SectionShown {
  section: AiSection;
  state: Shown;
}

/** While Gemini works: one pill per section, ticked off as each arrives. */
function Working({ states }: { states: readonly SectionShown[] }) {
  const { t } = useI18n();
  return (
    <div className="ai-status" role="status">
      <span className="lead">
        <span className="spinner" aria-hidden="true" />
        {t.plan.aiWorking}
      </span>
      <ul>
        {states.map(({ section, state }) => (
          <li key={section} className={`pill ${STATE_PILL[state]}`}>
            {state === 'done' && <Check />}
            {state === 'failed' && <CircleAlert />}
            {t.sections[section]}
            <span className="sr-only">
              : {t.plan.aiStateLabel[state === 'template' ? 'pending' : state]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A note and one action: retry the sections that failed, or tailor a template plan. */
function Offer({
  icon,
  note,
  action,
  primary,
  onAct,
}: {
  icon: ReactNode;
  note: string;
  action: ReactNode;
  primary: boolean;
  onAct: () => void;
}) {
  return (
    <div className="ai-status">
      <span className="lead">
        {icon}
        {note}
      </span>
      <button
        type="button"
        className={primary ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
        onClick={onAct}
      >
        {action}
      </button>
    </div>
  );
}

export function AiStatus({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  const run = useAiRuns((state) => state.runs[plan.id]);
  const states = AI_SECTIONS.map((section) => ({
    section,
    state: shownState(plan, section, run?.sections[section]),
  }));
  const failed = states.filter((entry) => entry.state === 'failed').map((entry) => entry.section);

  const retry = (sections: readonly AiSection[]) => {
    void personalizePlan(plan.id, {
      sections,
      onSection: (section, state) => {
        const label = t.sections[section];
        announce(state === 'done' ? t.plan.aiSectionReady(label) : t.plan.aiSectionFailed(label));
        if (state === 'failed') toast(t.plan.aiSectionFailed(label), { tone: 'error' });
      },
    });
  };

  if (run?.running) return <Working states={states} />;
  if (failed.length > 0) {
    return (
      <Offer
        icon={<CircleAlert className="i" />}
        note={t.plan.aiSectionFailed(failed.map((section) => t.sections[section]).join(', '))}
        action={t.plan.aiRetry}
        primary={false}
        onAct={() => {
          retry(failed);
        }}
      />
    );
  }
  if (states.every((entry) => entry.state === 'template')) {
    return (
      <Offer
        icon={<Sparkles className="i" />}
        note={t.plan.templateNote}
        action={
          <>
            <Sparkles />
            {t.plan.tailor}
          </>
        }
        primary
        onAct={() => {
          retry(AI_SECTIONS);
        }}
      />
    );
  }
  return null;
}
