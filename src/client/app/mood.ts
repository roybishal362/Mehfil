/**
 * Puts the open plan's mood on <html data-mood>, so the whole page (buttons, tabs, links, the
 * focus ring) takes on the occasion's colours. Leaving the plan returns to the neutral look.
 */
import { useEffect } from 'react';
import type { Mood } from '../../shared/domain/mood';

export function usePageMood(mood: Mood): void {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mood = mood;
    return () => {
      root.dataset.mood = 'neutral';
    };
  }, [mood]);
}
