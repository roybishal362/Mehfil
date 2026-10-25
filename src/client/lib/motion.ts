/**
 * Motion that is more than decoration (page cross-fades, counting numbers, celebration
 * moments) runs only when the browser can tell us motion is welcome: never without
 * matchMedia (tests, old browsers), never for people who ask for reduced motion.
 */
import { useEffect, useRef, useState } from 'react';

export function motionAllowed(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Ease-out cubic: fast at first, settling gently on the final value. */
function easeOut(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/**
 * A number that counts to `target` over `duration` milliseconds: up from zero when it first
 * shows, and from where it was when `target` changes. Without motion it is simply `target`.
 */
export function useCountUp(target: number, duration = 900): number {
  const [animate] = useState(motionAllowed);
  const [shown, setShown] = useState<number | null>(animate ? 0 : null);
  const from = useRef(0);

  useEffect(() => {
    if (!animate) return;
    const begin = from.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const value = Math.round(begin + (target - begin) * easeOut(progress));
      from.current = value;
      // Once finished, hand over to `target` itself.
      setShown(progress < 1 ? value : null);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [animate, duration, target]);

  return shown ?? target;
}
