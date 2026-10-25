/**
 * A celebration moment: a few seconds of the occasion played over the plan when it first opens
 * (the couple circling the fire, the dhaki before the curtains part, rockets over Diwali…).
 * The art is decorative and hidden from assistive technology. Skip, a click or any key ends it
 * early (so keyboard focus never moves behind it), and focus goes back to the plan's heading
 * if it was on the moment.
 */
import { useEffect, useRef, type ComponentType } from 'react';
import { useI18n } from '../../i18n';
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

  useEffect(() => {
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
  }, [mood, onDone]);

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
