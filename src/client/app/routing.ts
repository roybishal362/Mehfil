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
};

/** Sets the browser tab title as "<page> · Mehfil". */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
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
    // Wait a frame so lazily loaded pages have rendered their heading.
    const frame = requestAnimationFrame(() => {
      const target =
        (sameplan ? document.querySelector<HTMLElement>('[data-route-focus="section"]') : null) ??
        document.querySelector<HTMLElement>('[data-route-focus="page"]') ??
        document.getElementById('main');
      target?.focus({ preventScroll: sameplan });
      if (!sameplan) window.scrollTo({ top: 0 });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [location]);
}
