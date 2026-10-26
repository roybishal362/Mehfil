/**
 * "Describe your celebration": free text in any of the three languages. Chips show what was
 * understood while typing; on submit Gemini reads it, and a complete brief becomes a plan
 * straight away while a partial one continues in the step-by-step form.
 */
import { Sparkles } from 'lucide-react';
import { useDeferredValue, useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { quickParse } from '../../../shared/domain/quick-parse';
import { localToday } from '../../../shared/utils/dates';
import { paths } from '../../app/routing';
import { useI18n } from '../../i18n';
import { useDraft } from '../new-plan/draft';
import { briefFromDraft, completeDraft, readDescription } from '../new-plan/intake';
import { useStartPlan } from '../new-plan/start-plan';
import { UnderstoodChips } from './UnderstoodChips';

/** Reads a description with Gemini, then opens the plan, or the form when details are missing. */
function useReadDescription() {
  const { t, locale } = useI18n();
  const [, navigate] = useLocation();
  const start = useStartPlan();
  const [reading, setReading] = useState(false);
  const controller = useRef<AbortController | null>(null);

  // Leaving the page cancels a description that is still being read.
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  const read = async (text: string, today: string) => {
    setReading(true);
    controller.current = new AbortController();
    try {
      const { signal } = controller.current;
      const { draft, usedFallback } = await readDescription(text, { today, locale, signal });
      const complete = completeDraft(draft, t, locale);
      const brief = briefFromDraft(complete);
      if (brief) {
        navigate(paths.plan(start(brief)));
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

  return { reading, read };
}

/** Sample descriptions to try, one tap each. */
function Examples({ onPick }: { onPick: (text: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="examples">
      <span className="lbl">{t.home.tryLabel}</span>
      {t.home.examples.map((example) => (
        <button
          key={example.label}
          type="button"
          onClick={() => {
            onPick(example.text);
          }}
        >
          {example.label}
        </button>
      ))}
    </div>
  );
}

export function DescribeCard() {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const today = localToday();
  const parsed = quickParse(useDeferredValue(text), today);
  const { reading, read } = useReadDescription();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) {
      setError(t.home.emptyError);
      textarea.current?.focus();
      return;
    }
    setError(null);
    void read(text, today);
  };

  const pickExample = (example: string) => {
    setText(example);
    setError(null);
    textarea.current?.focus();
  };

  return (
    <form className="describe" onSubmit={submit} noValidate>
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
      <Examples onPick={pickExample} />
    </form>
  );
}
