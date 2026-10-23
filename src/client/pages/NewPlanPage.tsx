/**
 * The step-by-step form: the occasion, guests and budget, then personal touches. Each step is
 * checked before moving on; problems appear inline and in a summary that takes focus.
 */
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useLocation, useSearch } from 'wouter';
import {
  CURRENCIES,
  DIETARY_NEEDS,
  EVENT_TYPES,
  OUTPUT_LANGUAGES,
  VENUE_TYPES,
  isEventType,
  type AiSection,
} from '../../shared/schemas/primitives';
import { omitKey } from '../../shared/utils/collections';
import { addDays, localToday } from '../../shared/utils/dates';
import { parseAmount } from '../../shared/utils/money';
import { announce } from '../app/feedback';
import { paths, useDocumentTitle } from '../app/routing';
import { useTheme } from '../app/theme';
import { ErrorSummary, Field } from '../components/Field';
import { useDraft } from '../features/new-plan/draft';
import { briefFromDraft } from '../features/new-plan/intake';
import { startPlan } from '../features/new-plan/start-plan';
import {
  LANGUAGE_ENDONYMS,
  STEP_COUNT,
  STYLE_KEYS,
  draftFromValues,
  validateAll,
  validateStep,
  valuesFromDraft,
  type WizardErrors,
  type WizardField,
  type WizardValues,
} from '../features/new-plan/wizard-model';
import { useI18n } from '../i18n';
import { OccasionIcon } from '../motifs/OccasionIcon';

function currencyLabel(code: string): string {
  const symbol = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: code,
    currencyDisplay: 'narrowSymbol',
  })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value;
  return symbol && symbol !== code ? `${code} (${symbol})` : code;
}

export function NewPlanPage() {
  const { t, f, locale } = useI18n();
  const [, navigate] = useLocation();
  const search = useSearch();
  const day = useTheme((state) => state.theme === 'day');
  const today = localToday();
  useDocumentTitle(t.wizard.title);

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

  const toggle = <K extends 'styles' | 'dietary'>(field: K, item: WizardValues[K][number]) => {
    const list = values[field] as readonly string[];
    const next = list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
    set(field, next as WizardValues[K]);
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
  const parsedBudget = parseAmount(values.budget);

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

          {step === 0 && (
            <>
              <fieldset
                className="type-picker"
                aria-describedby={errors.type ? 'type-error' : undefined}
              >
                <legend>{t.wizard.type}</legend>
                {EVENT_TYPES.map((type) => (
                  <label key={type} className="type-option">
                    <input
                      type="radio"
                      name="type"
                      id={`type-${type}`}
                      value={type}
                      checked={values.type === type}
                      onChange={() => {
                        set('type', type);
                      }}
                    />
                    <span>
                      <OccasionIcon type={type} day={day} />
                      {t.home.occasions[type].title}
                    </span>
                  </label>
                ))}
                {errors.type && (
                  <p className="error field" id="type-error">
                    {t.wizard.errors[errors.type]}
                  </p>
                )}
              </fieldset>
              <Field
                id="title"
                label={t.wizard.titleLabel}
                hint={t.wizard.titleHint}
                error={errorText('title')}
              >
                {(control) => (
                  <input
                    {...control}
                    className="input"
                    maxLength={80}
                    autoComplete="off"
                    value={values.title}
                    onChange={(event) => {
                      set('title', event.target.value);
                    }}
                  />
                )}
              </Field>
              <div className="fields-2">
                <Field id="date" label={t.wizard.date} error={errorText('date')}>
                  {(control) => (
                    <input
                      {...control}
                      type="date"
                      className="input"
                      min={today}
                      max={addDays(today, 3 * 365)}
                      value={values.date}
                      onChange={(event) => {
                        set('date', event.target.value);
                      }}
                    />
                  )}
                </Field>
                <Field
                  id="endDate"
                  label={t.wizard.endDate}
                  extra={`(${t.common.optional})`}
                  hint={t.wizard.endDateHint}
                  error={errorText('endDate')}
                >
                  {(control) => (
                    <input
                      {...control}
                      type="date"
                      className="input"
                      min={values.date || today}
                      value={values.endDate}
                      onChange={(event) => {
                        set('endDate', event.target.value);
                      }}
                    />
                  )}
                </Field>
                <Field id="city" label={t.wizard.city} error={errorText('city')}>
                  {(control) => (
                    <input
                      {...control}
                      className="input"
                      maxLength={80}
                      autoComplete="address-level2"
                      value={values.city}
                      onChange={(event) => {
                        set('city', event.target.value);
                      }}
                    />
                  )}
                </Field>
                <Field id="startTime" label={t.wizard.startTime} extra={`(${t.common.optional})`}>
                  {(control) => (
                    <input
                      {...control}
                      type="time"
                      className="input"
                      value={values.startTime}
                      onChange={(event) => {
                        set('startTime', event.target.value);
                      }}
                    />
                  )}
                </Field>
                <Field id="venueType" label={t.wizard.venueType}>
                  {(control) => (
                    <select
                      {...control}
                      className="select"
                      value={values.venueType}
                      onChange={(event) => {
                        const venue = VENUE_TYPES.find((option) => option === event.target.value);
                        if (venue) set('venueType', venue);
                      }}
                    >
                      {VENUE_TYPES.map((venue) => (
                        <option key={venue} value={venue}>
                          {t.venues[venue]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field
                  id="subtype"
                  label={t.wizard.subtype}
                  extra={`(${t.common.optional})`}
                  hint={t.wizard.subtypeHint}
                >
                  {(control) => (
                    <input
                      {...control}
                      className="input"
                      maxLength={60}
                      value={values.subtype}
                      onChange={(event) => {
                        set('subtype', event.target.value);
                      }}
                    />
                  )}
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="fields-2">
              <Field id="guestCount" label={t.wizard.guestCount} error={errorText('guestCount')}>
                {(control) => (
                  <input
                    {...control}
                    type="number"
                    inputMode="numeric"
                    className="input"
                    min={1}
                    max={5000}
                    value={values.guestCount}
                    onChange={(event) => {
                      set('guestCount', event.target.value);
                    }}
                  />
                )}
              </Field>
              <Field
                id="budget"
                label={t.wizard.budget}
                hint={
                  parsedBudget !== null
                    ? `${t.wizard.budgetHint} = ${f.money(parsedBudget, values.currency)}`
                    : t.wizard.budgetHint
                }
                error={errorText('budget')}
              >
                {(control) => (
                  <input
                    {...control}
                    className="input"
                    inputMode="decimal"
                    autoComplete="off"
                    value={values.budget}
                    onChange={(event) => {
                      set('budget', event.target.value);
                    }}
                  />
                )}
              </Field>
              <Field id="currency" label={t.wizard.currency}>
                {(control) => (
                  <select
                    {...control}
                    className="select"
                    value={values.currency}
                    onChange={(event) => {
                      const currency = CURRENCIES.find((code) => code === event.target.value);
                      if (currency) set('currency', currency);
                    }}
                  >
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {currencyLabel(code)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          )}

          {step === 2 && (
            <>
              <fieldset className="field options">
                <legend className="label">{t.wizard.stylesLegend}</legend>
                {STYLE_KEYS.map((style) => (
                  <label key={style} className="option">
                    <input
                      type="checkbox"
                      checked={values.styles.includes(style)}
                      onChange={() => {
                        toggle('styles', style);
                      }}
                    />
                    <span>{t.styles[style]}</span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="field options">
                <legend className="label">{t.wizard.dietaryLegend}</legend>
                {DIETARY_NEEDS.map((need) => (
                  <label key={need} className="option">
                    <input
                      type="checkbox"
                      checked={values.dietary.includes(need)}
                      onChange={() => {
                        toggle('dietary', need);
                      }}
                    />
                    <span>{t.dietary[need]}</span>
                  </label>
                ))}
              </fieldset>
              <Field
                id="traditions"
                label={t.wizard.traditions}
                extra={`(${t.common.optional})`}
                hint={t.wizard.traditionsHint}
              >
                {(control) => (
                  <input
                    {...control}
                    className="input"
                    maxLength={200}
                    value={values.traditions}
                    onChange={(event) => {
                      set('traditions', event.target.value);
                    }}
                  />
                )}
              </Field>
              <div className="fields-2">
                <Field
                  id="accessibility"
                  label={t.wizard.accessibility}
                  extra={`(${t.common.optional})`}
                  hint={t.wizard.accessibilityHint}
                >
                  {(control) => (
                    <input
                      {...control}
                      className="input"
                      maxLength={200}
                      value={values.accessibility}
                      onChange={(event) => {
                        set('accessibility', event.target.value);
                      }}
                    />
                  )}
                </Field>
                <Field id="language" label={t.wizard.language}>
                  {(control) => (
                    <select
                      {...control}
                      className="select"
                      value={values.language}
                      onChange={(event) => {
                        const language = OUTPUT_LANGUAGES.find(
                          (code) => code === event.target.value,
                        );
                        if (language) set('language', language);
                      }}
                    >
                      {OUTPUT_LANGUAGES.map((code) => (
                        <option key={code} value={code} lang={code}>
                          {LANGUAGE_ENDONYMS[code]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
              <Field id="notes" label={t.wizard.notes} extra={`(${t.common.optional})`}>
                {(control) => (
                  <textarea
                    {...control}
                    className="textarea"
                    maxLength={500}
                    rows={3}
                    value={values.notes}
                    onChange={(event) => {
                      set('notes', event.target.value);
                    }}
                  />
                )}
              </Field>
            </>
          )}

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
