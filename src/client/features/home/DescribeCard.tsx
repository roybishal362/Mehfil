/**
 * "Describe your celebration": free text in any of the three languages. Chips show what was
 * understood while typing; on submit Gemini reads it, and a complete brief becomes a plan
 * straight away while a partial one continues in the step-by-step form.
 */
import { Sparkles } from 'lucide-react';
import { useDeferredValue, useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { quickParse } from '../../../shared/domain/quick-parse';
import type { AiSection } from '../../../shared/schemas/primitives';
import { localToday } from '../../../shared/utils/dates';
import { announce } from '../../app/feedback';
import { paths } from '../../app/routing';
import { useI18n } from '../../i18n';
import { useDraft } from '../new-plan/draft';
import { briefFromDraft, completeDraft, readDescription } from '../new-plan/intake';
import { startPlan } from '../new-plan/start-plan';
import { UnderstoodChips } from './UnderstoodChips';

export function DescribeCard() {
  const { t, locale } = useI18n();
  const [, navigate] = useLocation();
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const controller = useRef<AbortController | null>(null);
  const today = localToday();
  const parsed = quickParse(useDeferredValue(text), today);

  // Leaving the page cancels a description that is still being read.
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  const announceSection = (section: AiSection, state: 'done' | 'failed') => {
    const label = t.sections[section];
    announce(state === 'done' ? t.plan.aiSectionReady(label) : t.plan.aiSectionFailed(label));
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) {
      setError(t.home.emptyError);
      textarea.current?.focus();
      return;
    }
    setError(null);
    setReading(true);
    controller.current = new AbortController();
    try {
      const { draft, usedFallback } = await readDescription(text, {
        today,
        locale,
        signal: controller.current.signal,
      });
      const complete = completeDraft(draft, t, locale);
      const brief = briefFromDraft(complete);
      if (brief) {
        navigate(paths.plan(startPlan(brief, { onSection: announceSection })));
      } else {
        useDraft.getState().set(complete, usedFallback ? 'fallback' : 'prefilled');
        navigate(paths.newPlan());
      }
    } catch {
      // Only a cancelled request lands here; the page is going away.
    } finally {
      setReading(false);
    }
  };

  return (
    <form className="describe" onSubmit={(event) => void submit(event)} noValidate>
      <div className="describe-label">
        <label htmlFor="describe">{t.home.describeLabel}</label>
        <small id="describe-hint">{t.home.describeHint}</small>
      </div>
      <textarea
        ref={textarea}
        id="describe"
        className="textarea"
        rows={3}
        maxLength={1500}
        value={text}
        placeholder={t.home.describePlaceholder}
        aria-describedby={error ? 'describe-error describe-hint' : 'describe-hint'}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          setText(event.target.value);
          if (error) setError(null);
        }}
      />
      <UnderstoodChips parsed={parsed} />
      {error && (
        <p className="form-error" id="describe-error" role="alert">
          {error}
        </p>
      )}
      <div className="describe-actions">
        <button className="btn btn--primary" type="submit" disabled={reading}>
          {reading ? <span className="spinner" aria-hidden="true" /> : <Sparkles />}
          {t.home.plan}
        </button>
        <Link className="link-quiet" href={paths.newPlan()}>
          {t.home.stepByStep}
        </Link>
      </div>
      <p className="status" role="status">
        {reading ? t.home.reading : ''}
      </p>
      <div className="examples">
        <span className="lbl">{t.home.tryLabel}</span>
        {t.home.examples.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => {
              setText(example.text);
              setError(null);
              textarea.current?.focus();
            }}
          >
            {example.label}
          </button>
        ))}
      </div>
    </form>
  );
}
