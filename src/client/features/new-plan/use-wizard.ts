/**
 * The step-by-step form's state: values, the current step, per-field problems and the error
 * summary, with focus moved the way screen-reader and keyboard users expect.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearch } from 'wouter';
import type { EventBrief } from '../../../shared/schemas/brief';
import { isEventType } from '../../../shared/schemas/primitives';
import { omitKey } from '../../../shared/utils/collections';
import { useI18n } from '../../i18n';
import { useDraft, type DraftNotice } from './draft';
import { briefFromDraft } from './intake';
import {
  STEP_COUNT,
  draftFromValues,
  validateAll,
  validateStep,
  valuesFromDraft,
  type WizardErrors,
  type WizardField,
  type WizardValues,
} from './wizard-model';

/**
 * The form's starting values, read once. A description from the home page arrives as a draft;
 * an occasion card arrives as ?type=, with the festival's name as ?subtype= for Durga Puja,
 * Ganpati and Diwali.
 */
export function useStartingValues(): { initial: WizardValues; notice: DraftNotice | null } {
  const { locale } = useI18n();
  const search = useSearch();
  const [start] = useState(() => {
    const query = new URLSearchParams(search);
    const type = query.get('type');
    const subtype = query.get('subtype')?.trim().slice(0, 60);
    const handoff = useDraft.getState();
    const initial = valuesFromDraft(handoff.draft ?? {}, {
      language: locale,
      ...(isEventType(type) ? { type } : {}),
      ...(subtype ? { subtype } : {}),
    });
    return { initial, notice: handoff.notice };
  });
  useEffect(() => {
    useDraft.getState().clear();
  }, []);
  return start;
}

/** Moving between steps takes focus to the new step's heading (not on the first render). */
function useStepFocus(step: number) {
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);
  return heading;
}

export function useWizard(initial: WizardValues, today: string) {
  const [values, setValues] = useState<WizardValues>(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<WizardErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  const stepHeading = useStepFocus(step);

  // The error summary takes focus whenever it shows new problems.
  useEffect(() => {
    if (showSummary) document.getElementById('error-summary')?.focus();
  }, [showSummary, errors]);

  /** Changes one field; its problem, if any, goes away until the next check. */
  const set = <K extends WizardField>(field: K, value: WizardValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => omitKey(current, field));
  };

  /** Checks this step and moves on, or shows what to fix. */
  const next = () => {
    const stepErrors = validateStep(step, values, today);
    setErrors(stepErrors);
    const ok = Object.keys(stepErrors).length === 0;
    setShowSummary(!ok);
    if (ok) setStep((current) => Math.min(STEP_COUNT - 1, current + 1));
  };

  const back = () => {
    setShowSummary(false);
    setStep((current) => current - 1);
  };

  /** Checks every step; returns the brief, or null after going to the first step with a problem. */
  const finish = (): EventBrief | null => {
    const result = validateAll(values, today);
    setErrors(result.errors);
    const brief = result.step < 0 ? briefFromDraft(draftFromValues(values)) : null;
    if (!brief) {
      setStep(Math.max(0, result.step));
      setShowSummary(true);
    }
    return brief;
  };

  return { values, step, errors, showSummary, stepHeading, set, next, back, finish };
}
