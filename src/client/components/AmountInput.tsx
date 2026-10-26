/**
 * A money input that reads amounts the way people type them ("2.5 lakh", "50k", "₹1,50,000")
 * and shows them grouped for the reader's locale. Changes are committed on blur or Enter;
 * Escape cancels.
 */
import { parseAmount } from '../../shared/utils/money';
import { useI18n } from '../i18n';
import { useDraftInput } from './use-draft-input';

export interface AmountInputProps {
  id?: string;
  value: number;
  label: string;
  /** Called with a valid, changed amount. */
  onCommit: (amount: number) => void;
  /** Called when what was typed is not an amount (the field reverts). */
  onInvalid?: () => void;
  min?: number;
  className?: string;
}

export function AmountInput({
  id,
  value,
  label,
  onCommit,
  onInvalid,
  min = 0,
  className = 'input amount',
}: AmountInputProps) {
  const { f } = useI18n();
  const { draft, setDraft, commit, onKeyDown } = useDraftInput((typed) => {
    const parsed = parseAmount(typed);
    if (parsed === null || parsed < min) {
      if (typed.trim() !== '') onInvalid?.();
      return;
    }
    if (parsed !== value) onCommit(parsed);
  });

  return (
    <input
      id={id}
      className={className}
      inputMode="decimal"
      autoComplete="off"
      aria-label={label}
      value={draft ?? f.number(value)}
      onFocus={(event) => {
        // Keep the grouped text ("3,96,000"): changing it here would drop the selection, and
        // typing would then append to the old number. The parser reads grouped digits.
        setDraft(event.currentTarget.value);
        event.currentTarget.select();
      }}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}
