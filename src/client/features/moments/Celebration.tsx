/**
 * Plays a plan's celebration moment the first time it opens on this device, and offers
 * "Celebrate again" after that. The moment's code and styles load only when it plays.
 */
import { PartyPopper } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Mood } from '../../../shared/domain/mood';
import { useI18n } from '../../i18n';
import { hasMoment, rememberCelebrated, shouldAutoPlay } from './celebrated';

const Moment = lazy(() => import('./Moment').then((module) => ({ default: module.Moment })));

export function Celebration({ planId, mood }: { planId: string; mood: Mood }) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(() => shouldAutoPlay(planId, mood));

  useEffect(() => {
    if (playing) rememberCelebrated(planId);
  }, [playing, planId]);

  if (!hasMoment(mood)) return null;
  return (
    <>
      <button
        type="button"
        className="btn btn--quiet btn--sm celebrate-again"
        onClick={() => {
          setPlaying(true);
        }}
      >
        <PartyPopper />
        {t.moods.replay}
      </button>
      {playing &&
        // At the top level, so no part of the page (cards, the sticky Copilot) paints over it.
        createPortal(
          <Suspense fallback={null}>
            <Moment
              mood={mood}
              cheer={t.moods.cheer[mood]}
              onDone={() => {
                setPlaying(false);
              }}
            />
          </Suspense>,
          document.body,
        )}
    </>
  );
}
