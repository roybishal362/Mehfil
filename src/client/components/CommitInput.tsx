/**
 * A text input for inline editing: typing is local, and the change is committed once, on blur
 * or Enter, so each edit is a single undo step. Escape cancels.
 */
import { useRef, useState, type InputHTMLAttributes } from 'react';

export interface CommitInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onBlur'
> {
  value: string;
  label: string;
  onCommit: (value: string) => void;
  /** Whether an empty value may be committed (e.g. to clear an optional field). */
  allowEmpty?: boolean;
}

export function CommitInput({
  value,
  label,
  onCommit,
  allowEmpty = false,
  className = 'input input--inline',
  ...rest
}: CommitInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape blurs the field before React applies the cancel, so blur must know to skip.
  const cancelled = useRef(false);
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (next === value || (!next && !allowEmpty)) return;
    onCommit(next);
  };
  return (
    <input
      {...rest}
      className={className}
      aria-label={label}
      value={draft ?? value}
      onFocus={() => {
        setDraft(value);
      }}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          cancelled.current = true;
          event.currentTarget.blur();
        }
      }}
    />
  );
}
