/**
 * A celebration moment: a few seconds of the occasion played over the plan when it first opens.
 * The occasion's photograph opens out of the arch to fill the screen while the cheer rises, with
 * its own touches: rockets over Diwali, the dhak's beat and the sari curtains for Durga Puja,
 * firelight and petals for a wedding, confetti for a birthday.
 *
 * It is decorative and hidden from assistive technology. It waits briefly for its photograph
 * and quietly skips on a slow connection. Skip, a click or any key ends it early (so keyboard
 * focus never moves behind it), and focus goes back to the plan's heading if it was on the
 * moment.
 */
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useI18n } from '../../i18n';
import { momentPhoto } from '../../photos';
import { MOMENT_DURATION, type MomentMood } from './celebrated';
import {
  BirthdayScene,
  DiwaliScene,
  DurgaScene,
  GanpatiScene,
  UtsavScene,
  WeddingScene,
} from './scenes';
import './moments.css';

const SCENES: Readonly<Record<MomentMood, ComponentType>> = {
  wedding: WeddingScene,
  durga: DurgaScene,
  diwali: DiwaliScene,
  ganpati: GanpatiScene,
  birthday: BirthdayScene,
  utsav: UtsavScene,
};

/** How long to wait for the photograph before quietly skipping the moment. */
export const PHOTO_WAIT_MS = 1500;

/** Browsers that cannot say when a photo is ready (and test environments) play at once. */
function canWaitForPhoto(): boolean {
  return (
    typeof HTMLImageElement !== 'undefined' &&
    typeof HTMLImageElement.prototype.decode === 'function'
  );
}

export interface MomentProps {
  mood: MomentMood;
  /** The occasion's cheer, shown large over the scene. */
  cheer: string;
  onDone: () => void;
}

/** Keys pressed on their own that should not end the moment. */
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

export function Moment({ mood, cheer, onDone }: MomentProps) {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(() => !canWaitForPhoto());

  // Wait for the photograph, so the arch never opens onto an empty frame.
  useEffect(() => {
    if (ready) return;
    let settled = false;
    const settle = (play: boolean) => {
      if (settled) return;
      settled = true;
      if (play) setReady(true);
      else onDone();
    };
    const image = new Image();
    image.src = momentPhoto(mood);
    image.decode().then(
      () => {
        settle(true);
      },
      () => {
        settle(false);
      },
    );
    const giveUp = window.setTimeout(() => {
      settle(false);
    }, PHOTO_WAIT_MS);
    return () => {
      settled = true;
      window.clearTimeout(giveUp);
    };
  }, [mood, onDone, ready]);

  useEffect(() => {
    if (!ready) return;
    const element = root.current;
    const finish = () => {
      if (element?.contains(document.activeElement)) {
        document.getElementById('plan-title')?.focus({ preventScroll: true });
      }
      onDone();
    };
    const timer = window.setTimeout(finish, MOMENT_DURATION[mood]);
    const onKey = (event: KeyboardEvent) => {
      if (!MODIFIERS.has(event.key)) finish();
    };
    // A click or tap anywhere ends it too.
    element?.addEventListener('click', finish);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      element?.removeEventListener('click', finish);
      document.removeEventListener('keydown', onKey);
    };
  }, [mood, onDone, ready]);

  if (!ready) return null;
  const Scene = SCENES[mood];
  return (
    <div ref={root} className={`moment moment--${mood}`}>
      <div className="moment-stage" aria-hidden="true">
        <Scene />
        <p className="moment-cheer">{cheer}</p>
      </div>
      {/* The click reaches the listener on the moment itself, which ends it. */}
      <button type="button" className="moment-skip">
        {t.moods.skip}
      </button>
    </div>
  );
}
