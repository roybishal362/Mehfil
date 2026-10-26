/**
 * The scenes inside celebration moments. Each one is the occasion's photograph opening out of
 * the arch (moments.css), with the occasion's own touches on top: canvas rockets or confetti
 * (show.ts), the garad-sari curtains, firelight, or falling petals. Everything here is
 * decorative; the moment hides it from assistive technology.
 */
import { useEffect, useRef } from 'react';
import { momentPhoto } from '../../photos';
import type { MomentMood } from './celebrated';
import { startShow, type ShowKind } from './show';

/** The occasion's photograph, revealed through the arch as it widens to fill the screen. */
function Photograph({ mood }: { mood: MomentMood }) {
  return (
    <div className="moment-photo">
      <img src={momentPhoto(mood)} alt="" decoding="async" draggable={false} />
    </div>
  );
}

/** Runs a canvas show, after `delay` milliseconds, for as long as the scene is on screen. */
function Show({ kind, delay = 0 }: { kind: ShowKind; delay?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let stop: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      stop = startShow(element, kind);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      stop?.();
    };
  }, [kind, delay]);
  return <canvas ref={canvas} className="moment-canvas" />;
}

const PETALS = 18;

/** Petals drifting down across the scene: rose and marigold for a wedding, marigold alone. */
function Petals({ kind }: { kind: 'rose' | 'marigold' }) {
  return (
    <div className="petals">
      {Array.from({ length: PETALS }, (_, index) => {
        const rose = kind === 'rose' && index % 3 !== 0;
        return (
          <svg key={index} className="petal" viewBox="0 0 20 20" focusable="false">
            <path
              d={
                rose
                  ? 'M10 1C16 5 18 12 10 19 2 12 4 5 10 1Z'
                  : 'M10 2C14 6 15 12 10 18 5 12 6 6 10 2Z'
              }
              className={
                rose
                  ? `petal-rose petal-rose--${String(index % 2)}`
                  : `petal-marigold petal-marigold--${String(index % 2)}`
              }
            />
          </svg>
        );
      })}
    </div>
  );
}

/** The saptapadi before the sacred fire, its light flickering, with petals falling. */
export function WeddingScene() {
  return (
    <>
      <Photograph mood="wedding" />
      <div className="moment-firelight" />
      <div className="moment-scrim" />
      <Petals kind="rose" />
    </>
  );
}

/** The dhakis drum (the photo pulses to the beat), then the sari curtains close and part. */
export function DurgaScene() {
  return (
    <>
      <Photograph mood="durga" />
      <div className="moment-scrim" />
      <div className="curtain curtain--left" />
      <div className="curtain curtain--right" />
    </>
  );
}

/** Rockets burst over the lamps around the rangoli, once the arch has opened onto them. */
export function DiwaliScene() {
  return (
    <>
      <Photograph mood="diwali" />
      <div className="moment-scrim" />
      <Show kind="fireworks" delay={500} />
    </>
  );
}

/** Marigold petals fall before the lamp and the idol. */
export function GanpatiScene() {
  return (
    <>
      <Photograph mood="ganpati" />
      <div className="moment-scrim" />
      <Petals kind="marigold" />
    </>
  );
}

/** Confetti cannons fire over the candles. */
export function BirthdayScene() {
  return (
    <>
      <Photograph mood="birthday" />
      <div className="moment-scrim" />
      <Show kind="confetti" />
    </>
  );
}

/** Confetti in the colours of gulal, over a festival of colours. */
export function UtsavScene() {
  return (
    <>
      <Photograph mood="utsav" />
      <div className="moment-scrim" />
      <Show kind="confetti" />
    </>
  );
}
