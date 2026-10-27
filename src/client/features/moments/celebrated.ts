/**
 * Which occasions open with a celebration moment, how long each runs, and whether a plan has
 * already had its moment on this device. A moment plays once per plan; "Celebrate again"
 * replays it. Nothing plays by itself for people who ask for reduced motion.
 */
import type { Mood } from '../../../shared/domain/mood';
import { motionAllowed } from '../../lib/motion';
import { browserStorage, readJson, writeText } from '../../lib/storage';

export type MomentMood = Exclude<Mood, 'neutral'>;

/** Milliseconds; moments.css times each scene's animation to the same length. */
export const MOMENT_DURATION: Readonly<Record<MomentMood, number>> = {
  wedding: 4000,
  durga: 4200,
  diwali: 3600,
  ganpati: 3400,
  birthday: 3400,
  utsav: 3000,
};

export function hasMoment(mood: Mood): mood is MomentMood {
  return mood !== 'neutral';
}

const STORAGE_KEY = 'mehfil:celebrated';
/** Enough to remember every plan a person is likely to keep; the oldest fall off. */
const REMEMBERED = 60;

function read(storage: Storage | null): string[] {
  const value = readJson(STORAGE_KEY, storage);
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

export function wasCelebrated(planId: string, storage = browserStorage()): boolean {
  return read(storage).includes(planId);
}

export function rememberCelebrated(planId: string, storage = browserStorage()): void {
  const ids = [planId, ...read(storage).filter((id) => id !== planId)].slice(0, REMEMBERED);
  // Without storage the moment may play again next time, which is harmless.
  writeText(STORAGE_KEY, JSON.stringify(ids), storage);
}

/** Plays by itself only on a plan's first opening, and only when motion is welcome. */
export function shouldAutoPlay(planId: string, mood: Mood): boolean {
  return hasMoment(mood) && motionAllowed() && !wasCelebrated(planId);
}
