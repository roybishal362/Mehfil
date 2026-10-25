/**
 * Page changes cross-fade with the View Transitions API, where the browser has it and motion
 * is welcome. Wouter calls this around every in-app navigation (links and navigate()); the
 * new page must be rendered synchronously inside the transition, hence flushSync. The fade
 * itself is CSS (base.css).
 */
import { flushSync } from 'react-dom';
import type { AroundNavHandler } from 'wouter';
import { motionAllowed } from '../lib/motion';

export const aroundNav: AroundNavHandler = (navigate, to, options) => {
  if (typeof document.startViewTransition !== 'function' || !motionAllowed()) {
    navigate(to, options);
    return;
  }
  document.startViewTransition(() => {
    flushSync(() => {
      navigate(to, options);
    });
  });
};
