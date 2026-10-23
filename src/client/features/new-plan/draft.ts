/** Hands a partly understood description from the home page to the step-by-step form. */
import { create } from 'zustand';
import type { DraftBrief } from './intake';

export type DraftNotice = 'prefilled' | 'fallback';

interface DraftState {
  draft: DraftBrief | null;
  notice: DraftNotice | null;
  set: (draft: DraftBrief, notice: DraftNotice) => void;
  /** Forgets the draft once the form has read it. */
  clear: () => void;
}

export const useDraft = create<DraftState>()((set) => ({
  draft: null,
  notice: null,
  set: (draft, notice) => {
    set({ draft, notice });
  },
  clear: () => {
    set({ draft: null, notice: null });
  },
}));
