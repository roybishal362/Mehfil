/**
 * Typing that commits once. What is typed stays a local draft until blur or Enter hands it to
 * `onCommit`, so each edit is a single undo step; Escape throws the draft away.
 */
import { useRef, useState, type KeyboardEvent } from 'react';

export function useDraftInput(onCommit: (typed: string) => void) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape blurs the field before React applies the cancel, so blur must know to skip.
  const cancelled = useRef(false);

  const commit = () => {
    setDraft(null);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (draft !== null) onCommit(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      cancelled.current = true;
      event.currentTarget.blur();
    }
  };

  return { draft, setDraft, commit, onKeyDown };
}
