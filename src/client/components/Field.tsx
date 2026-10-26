/**
 * A labelled form field. The control receives its id plus aria-describedby (hint and error)
 * and aria-invalid, so every input is announced with its label, hint and error.
 */
import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

interface ControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

export interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  /** Shown after the label, e.g. "(optional)". */
  extra?: ReactNode;
  className?: string;
  children: (control: ControlProps) => ReactNode;
}

export function Field({ id, label, hint, error, extra, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ');
  return (
    <div className={className ? `field ${className}` : 'field'}>
      <label htmlFor={id}>
        {label}
        {extra && <span className="hint"> {extra}</span>}
      </label>
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      {children({
        id,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        ...(error ? { 'aria-invalid': true as const } : {}),
      })}
      {error && (
        <p className="error" id={errorId}>
          <CircleAlert />
          {error}
        </p>
      )}
    </div>
  );
}

export interface ErrorSummaryItem {
  /** Id of the field to focus when the item is chosen. */
  fieldId: string;
  message: string;
}

/** Lists a form's problems with links to each field; it takes focus when it appears. */
export function ErrorSummary({
  title,
  items,
  id = 'error-summary',
}: {
  title: string;
  items: readonly ErrorSummaryItem[];
  id?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div
      className="error-summary"
      id={id}
      tabIndex={-1}
      role="alert"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`}>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.fieldId}>
            <a
              href={`#${item.fieldId}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(item.fieldId)?.focus();
              }}
            >
              {item.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
