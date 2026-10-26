/**
 * A text input for inline editing: typing is local, and the change is committed once, on blur
 * or Enter, so each edit is a single undo step. Escape cancels.
 */
import type { InputHTMLAttributes } from 'react';
import { useDraftInput } from './use-draft-input';

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
  const { draft, setDraft, commit, onKeyDown } = useDraftInput((typed) => {
    const next = typed.trim();
    if (next === value || (!next && !allowEmpty)) return;
    onCommit(next);
  });
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
      onKeyDown={onKeyDown}
    />
  );
}
