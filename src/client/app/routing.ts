/** Paths, page titles and focus handling for client-side navigation. */
import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { APP_NAME } from '../../shared/meta';

export const PLAN_SECTIONS = [
  'overview',
  'budget',
  'timeline',
  'vendors',
  'ideas',
  'guests',
  'day-of',
] as const;
export type PlanSection = (typeof PLAN_SECTIONS)[number];

export function isPlanSection(value: string | undefined): value is PlanSection {
  return value !== undefined && (PLAN_SECTIONS as readonly string[]).includes(value);
}

export const paths = {
  home: '/',
  newPlan: (type?: string) => (type ? `/new?type=${encodeURIComponent(type)}` : '/new'),
  plan: (id: string, section: PlanSection = 'overview') =>
    section === 'overview' ? `/plan/${id}` : `/plan/${id}/${section}`,
  /** A read-only shared plan. */
  shared: (shareId: string) => `/s/${shareId}`,
};

/** Sets the browser tab title as "<page> · Mehfil". */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}

/** How long to wait for a lazily loaded page's heading: about two seconds. */
const HEADING_WAIT_FRAMES = 120;

/**
 * The first matching element that is actually shown. While the next page's code loads, React
 * keeps the previous page mounted but hidden, and its heading must not be picked.
 */
function visibleTarget(selector: string): HTMLElement | null {
  const shown = (element: HTMLElement) =>
    typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;
  return [...document.querySelectorAll<HTMLElement>(selector)].find(shown) ?? null;
}

/** The /plan/<id> part of a path, used to tell a section change from a page change. */
function planPrefix(path: string): string | null {
  return /^\/plan\/[^/]+/.exec(path)?.[0] ?? null;
}

/**
 * After client-side navigation, moves focus to the new content so keyboard and screen-reader
 * users start reading there: the section heading when only the plan section changed,
 * otherwise the page heading. The first page load keeps the browser's default focus.
 */
export function useRouteFocus(): void {
  const [location] = useLocation();
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = location;
    if (before === null || before === location) return;
    const sameplan = planPrefix(before) !== null && planPrefix(before) === planPrefix(location);
    let frame = 0;
    let waited = 0;
    const moveFocus = () => {
      const heading =
        (sameplan ? visibleTarget('[data-route-focus="section"]') : null) ??
        visibleTarget('[data-route-focus="page"]');
      // A lazily loaded page renders its heading once its code has arrived: keep checking
      // each frame for a while before settling for the main region.
      if (!heading && waited < HEADING_WAIT_FRAMES) {
        waited += 1;
        frame = requestAnimationFrame(moveFocus);
        return;
      }
      (heading ?? document.getElementById('main'))?.focus({ preventScroll: sameplan });
      if (!sameplan) window.scrollTo({ top: 0 });
    };
    frame = requestAnimationFrame(moveFocus);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [location]);
}
