/**
 * The step-by-step form: the occasion, guests and budget, then personal touches. Each step is
 * checked before moving on; problems appear inline and in a summary that takes focus. The
 * steps live in `features/new-plan`, and the form's state in its `useWizard` hook.
 */
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useLocation } from 'wouter';
import { EVENT_TYPES } from '../../shared/schemas/primitives';
import { localToday } from '../../shared/utils/dates';
import { paths, useDocumentTitle } from '../app/routing';
import { ErrorSummary } from '../components/Field';
import { GuestsBudgetStep } from '../features/new-plan/GuestsBudgetStep';
import { OccasionStep } from '../features/new-plan/OccasionStep';
import { TouchesStep } from '../features/new-plan/TouchesStep';
import { useStartPlan } from '../features/new-plan/start-plan';
import { useStartingValues, useWizard } from '../features/new-plan/use-wizard';
import { STEP_COUNT, type WizardField } from '../features/new-plan/wizard-model';
import { useI18n } from '../i18n';

function StepList({ step }: { step: number }) {
  const { t } = useI18n();
  return (
    <ol className="steps" aria-label={t.wizard.stepsLabel}>
      {t.wizard.steps.map((label, index) => (
        <li
          key={label}
          className={index < step ? 'done' : undefined}
          aria-current={index === step ? 'step' : undefined}
        >
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

/** Back (after the first step), and Next or Create. */
function WizardNav({ step, onBack }: { step: number; onBack: () => void }) {
  const { t } = useI18n();
  const last = step === STEP_COUNT - 1;
  return (
    <div className="wizard-nav">
      {step > 0 && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          <ArrowLeft />
          {t.common.back}
        </button>
      )}
      <div className="end">
        <button type="submit" className="btn btn--primary">
          {last ? (
            <>
              <Sparkles />
              {t.wizard.create}
            </>
          ) : (
            <>
              {t.common.next}
              <ArrowRight />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function NewPlanPage() {
  const { t, f } = useI18n();
  const [, navigate] = useLocation();
  const today = localToday();
  useDocumentTitle(t.wizard.title);
  const start = useStartPlan();
  const { initial, notice } = useStartingValues();
  const { values, step, errors, showSummary, stepHeading, set, next, back, finish } = useWizard(
    initial,
    today,
  );

  const errorText = (field: WizardField) => {
    const key = errors[field];
    return key ? t.wizard.errors[key] : undefined;
  };

  const create = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < STEP_COUNT - 1) {
      next();
      return;
    }
    const brief = finish();
    if (brief) navigate(paths.plan(start(brief)));
  };

  // The occasion is a group of radio buttons: its summary link goes to the first one.
  const summaryItems = Object.entries(errors).map(([field, key]) => ({
    fieldId: field === 'type' ? `type-${EVENT_TYPES[0]}` : field,
    message: t.wizard.errors[key],
  }));
  const stepProps = { values, set, errorText };

  return (
    <div className="wrap">
      <div className="wizard">
        <div className="wizard-head">
          <h1 data-route-focus="page" tabIndex={-1}>
            {t.wizard.title}
          </h1>
          <p>{t.wizard.intro}</p>
        </div>
        <StepList step={step} />
        {notice && step === 0 && (
          <p className="notice" role="status">
            <Sparkles className="i" />
            {notice === 'fallback' ? t.home.aiFallback : t.wizard.prefilled}
          </p>
        )}
        <form className="card wizard-card" onSubmit={create} noValidate>
          {showSummary && <ErrorSummary title={t.wizard.errorsTitle} items={summaryItems} />}
          <h2 ref={stepHeading} tabIndex={-1}>
            <span className="sr-only">
              {t.wizard.stepOf(f.number(step + 1), f.number(STEP_COUNT))}:{' '}
            </span>
            {t.wizard.steps[step]}
          </h2>
          {step === 0 && <OccasionStep {...stepProps} />}
          {step === 1 && <GuestsBudgetStep {...stepProps} />}
          {step === 2 && <TouchesStep {...stepProps} />}
          <WizardNav step={step} onBack={back} />
        </form>
      </div>
    </div>
  );
}
