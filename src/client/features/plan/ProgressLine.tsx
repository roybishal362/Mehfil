/**
 * How far along a plan is: one thin segment per part (budget, timeline, vendors, guests, ideas,
 * the day itself), filled once that part has begun, with the count and readiness in words
 * beside them. The segments are decoration; the words carry the meaning, and screen readers
 * also hear each part's own progress.
 */
import { useI18n } from '../../i18n';
import { partsSummary, type PlanPart } from './present';

export interface ProgressLineProps {
  parts: readonly PlanPart[];
  /** Readiness in words ("50% ready"), or what is happening now ("Tailoring your plan…"). */
  status: string;
  className?: string;
}

export function ProgressLine({ parts, status, className = '' }: ProgressLineProps) {
  const { t, f } = useI18n();
  const begun = parts.filter((part) => part.value > 0).length;
  return (
    <div className={`progress-line ${className}`}>
      <span className="progress-segments" aria-hidden="true">
        {parts.map((part) => (
          <i key={part.key} className={part.value > 0 ? 'is-begun' : undefined} />
        ))}
      </span>
      <span className="progress-text">
        {t.plan.partsBegun(f.number(begun), f.number(parts.length))} · {status}
      </span>
      <span className="sr-only">{t.plan.progressSummary(partsSummary(parts, t))}</span>
    </div>
  );
}
