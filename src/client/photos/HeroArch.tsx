/**
 * The home page's centrepiece: an arched window that turns slowly through the occasions Mehfil
 * plans (a wedding, Durga Puja, Diwali, Ganpati, a birthday), each photo drifting a little
 * closer as it arrives, with a diya's flame in a medallion beside it.
 *
 * Only the first photo is in the prerendered page, fetched first; the others mount once the
 * page has loaded, and only when motion is welcome. A Pause button stops them (WCAG 2.2.2).
 * The window is one labelled picture; the captions repeat what the page already says.
 */
import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Mood } from '../../shared/domain/mood';
import { useI18n, type Messages } from '../i18n';
import { useAfterLoad } from '../lib/after-load';
import { motionAllowed } from '../lib/motion';
import { Arch } from './Arch';
import { archPhoto, FLAME } from '.';
import { Photo } from './Photo';

type Festival = keyof Messages['home']['festivals'];

const SLIDES: readonly { mood: Exclude<Mood, 'neutral' | 'utsav'>; festival: Festival }[] = [
  { mood: 'wedding', festival: 'wedding' },
  { mood: 'durga', festival: 'durga' },
  { mood: 'diwali', festival: 'diwali' },
  { mood: 'ganpati', festival: 'ganpati' },
  { mood: 'birthday', festival: 'birthday' },
];

/** How long each photo stays before the next fades in over it. */
export const SLIDE_MS = 5000;
/** On a phone the arch is about 62% of the screen, so it picks the 480-pixel file. */
const SIZES = '(max-width: 860px) 62vw, 430px';

interface Turn {
  current: number;
  /** The photo underneath, still solid while the current one fades in over it. */
  previous: number | null;
}

function slideClass(index: number, turn: Turn): string {
  if (index === turn.current) return 'hero-slide is-current';
  if (index === turn.previous) return 'hero-slide is-previous';
  return 'hero-slide';
}

export function HeroArch() {
  const { t } = useI18n();
  // False on the server and until the page has loaded, so hydration matches the prerender.
  const moving = useAfterLoad() && motionAllowed();
  const [paused, setPaused] = useState(false);
  const [turn, setTurn] = useState<Turn>({ current: 0, previous: null });

  useEffect(() => {
    if (!moving || paused) return;
    const timer = window.setInterval(() => {
      setTurn(({ current }) => ({ current: (current + 1) % SLIDES.length, previous: current }));
    }, SLIDE_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [moving, paused]);

  const slides = moving ? SLIDES : SLIDES.slice(0, 1);
  return (
    <figure className="hero-arch">
      <div className="hero-window" role="img" aria-label={t.home.plateLabel}>
        <Arch className="hero-frame">
          {slides.map(({ mood }, index) => (
            <span key={mood} className={slideClass(index, turn)}>
              <Photo photo={archPhoto(mood)} sizes={SIZES} priority={index === 0} />
            </span>
          ))}
        </Arch>
        <img
          className="hero-medallion"
          src={FLAME}
          width={160}
          height={160}
          alt=""
          decoding="async"
          draggable={false}
        />
      </div>
      <figcaption className="hero-caption" aria-hidden="true">
        {slides.map(({ mood, festival }, index) => (
          <span key={mood} className={index === turn.current ? 'is-current' : undefined}>
            <b>{t.moods.cheer[mood]}</b>
            <i>{t.home.festivals[festival].text}</i>
          </span>
        ))}
      </figcaption>
      {moving && (
        <button
          type="button"
          className="hero-pause"
          aria-pressed={paused}
          onClick={() => {
            setPaused((value) => !value);
          }}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          <span className="sr-only">{t.home.pausePhotos}</span>
        </button>
      )}
    </figure>
  );
}
