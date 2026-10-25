/**
 * The step-by-step form: the occasion, guests and budget, then personal touches. Each step is
 * checked before moving on; problems appear inline and in a summary that takes focus. The
 * steps themselves live in `features/new-plan`; this page owns the values, checks and focus.
 */
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useLocation, useSearch } from 'wouter';
import { EVENT_TYPES, isEventType, type AiSection } from '../../shared/schemas/primitives';
import { omitKey } from '../../shared/utils/collections';
import { localToday } from '../../shared/utils/dates';
import { announce } from '../app/feedback';
import { paths, useDocumentTitle } from '../app/routing';
import { ErrorSummary } from '../components/Field';
import { GuestsBudgetStep } from '../features/new-plan/GuestsBudgetStep';
import { OccasionStep } from '../features/new-plan/OccasionStep';
import { TouchesStep } from '../features/new-plan/TouchesStep';
import { useDraft } from '../features/new-plan/draft';
import { briefFromDraft } from '../features/new-plan/intake';
import { startPlan } from '../features/new-plan/start-plan';
import {
  STEP_COUNT,
  draftFromValues,
  validateAll,
  validateStep,
  valuesFromDraft,
  type WizardErrors,
  type WizardField,
  type WizardValues,
} from '../features/new-plan/wizard-model';
import { useI18n } from '../i18n';

export function NewPlanPage() {
  const { t, f, locale } = useI18n();
  const [, navigate] = useLocation();
  const search = useSearch();
  const today = localToday();
  useDocumentTitle(t.wizard.title);

  // A description from the home page arrives as a draft; an occasion card arrives as ?type=.
  const requestedType = new URLSearchParams(search).get('type');
  const [{ values: initialValues, notice }] = useState(() => {
    const handoff = useDraft.getState();
    return {
      values: valuesFromDraft(handoff.draft ?? {}, {
        language: locale,
        ...(isEventType(requestedType) ? { type: requestedType } : {}),
      }),
      notice: handoff.notice,
    };
  });
  useEffect(() => {
    useDraft.getState().clear();
  }, []);

  const [values, setValues] = useState<WizardValues>(initialValues);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<WizardErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Moving between steps takes focus to the new step's heading (not on the first render).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    stepHeading.current?.focus();
  }, [step]);

  useEffect(() => {
    if (showSummary) document.getElementById('error-summary')?.focus();
  }, [showSummary, errors]);

  const set = <K extends WizardField>(field: K, value: WizardValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => omitKey(current, field));
    }
  };

  const errorText = (field: WizardField) => {
    const key = errors[field];
    return key ? t.wizard.errors[key] : undefined;
  };

  const announceSection = (section: AiSection, state: 'done' | 'failed') => {
    const label = t.sections[section];
    announce(state === 'done' ? t.plan.aiSectionReady(label) : t.plan.aiSectionFailed(label));
  };

  const next = () => {
    const stepErrors = validateStep(step, values, today);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      setShowSummary(true);
      return;
    }
    setShowSummary(false);
    setStep((current) => Math.min(STEP_COUNT - 1, current + 1));
  };

  const create = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < STEP_COUNT - 1) {
      next();
      return;
    }
    const result = validateAll(values, today);
    setErrors(result.errors);
    if (result.step >= 0) {
      setStep(result.step);
      setShowSummary(true);
      return;
    }
    const brief = briefFromDraft(draftFromValues(values));
    if (!brief) {
      setStep(0);
      setShowSummary(true);
      return;
    }
    navigate(paths.plan(startPlan(brief, { onSection: announceSection })));
  };

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

          <div className="wizard-nav">
            {step > 0 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setShowSummary(false);
                  setStep((current) => current - 1);
                }}
              >
                <ArrowLeft />
                {t.common.back}
              </button>
            )}
            <div className="end">
              <button type="submit" className="btn btn--gold">
                {step < STEP_COUNT - 1 ? (
                  <>
                    {t.common.next}
                    <ArrowRight />
                  </>
                ) : (
                  <>
                    <Sparkles />
                    {t.wizard.create}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
