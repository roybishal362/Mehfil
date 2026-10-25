/** The plan page's chrome: section tabs, undo/redo and the Gemini progress banner. */
import { Check, CircleAlert, Redo2, Sparkles, Undo2 } from 'lucide-react';
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

export function AiStatus({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  const run = useAiRuns((state) => state.runs[plan.id]);
  const states = AI_SECTIONS.map((section) => ({
    section,
    state: shownState(plan, section, run?.sections[section]),
  }));
  const failed = states.filter((entry) => entry.state === 'failed').map((entry) => entry.section);
  const untouched = states.every((entry) => entry.state === 'template');

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

  if (run?.running) {
    return (
      <div className="ai-status" role="status">
        <span className="lead">
          <span className="spinner" aria-hidden="true" />
          {t.plan.aiWorking}
        </span>
        <ul>
          {states.map(({ section, state }) => (
            <li
              key={section}
              className={`pill ${state === 'done' ? 'pill--ok' : state === 'failed' ? 'pill--danger' : 'pill--plain'}`}
            >
              {state === 'done' ? <Check /> : state === 'failed' ? <CircleAlert /> : null}
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
  if (failed.length > 0) {
    return (
      <div className="ai-status">
        <span className="lead">
          <CircleAlert className="i" />
          {t.plan.aiSectionFailed(failed.map((section) => t.sections[section]).join(', '))}
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            retry(failed);
          }}
        >
          {t.plan.aiRetry}
        </button>
      </div>
    );
  }
  if (untouched) {
    return (
      <div className="ai-status">
        <span className="lead">
          <Sparkles className="i" />
          {t.plan.templateNote}
        </span>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => {
            retry(AI_SECTIONS);
          }}
        >
          <Sparkles />
          {t.plan.tailor}
        </button>
      </div>
    );
  }
  return null;
}
