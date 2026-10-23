/** Test helpers: render at a route, reset the stores, seed plans and fake the API. */
import { render } from '@testing-library/react';
import { LucideProvider } from 'lucide-react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { createBaselinePlan } from '../../shared/domain/baseline';
import { EventBrief, type EventBriefInput } from '../../shared/schemas/brief';
import type { EventPlan } from '../../shared/schemas/plan';
import { weddingBriefInput } from '../../shared/test/fixtures';
import { localToday } from '../../shared/utils/dates';
import { sequentialIds } from '../../shared/utils/ids';
import { Feedback, useFeedback } from '../app/feedback';
import { useRuntimeConfig } from '../app/runtime-config';
import { useTheme } from '../app/theme';
import { useCopilot } from '../features/copilot/copilot';
import { useDraft } from '../features/new-plan/draft';
import { en } from '../i18n/en';
import { useLocaleStore } from '../i18n';
import { SharedDefs } from '../motifs/svg';
import { useAiRuns } from '../state/ai';
import { plansStore } from '../state/plans';

export function resetAppState(): void {
  plansStore.setState({ plans: {}, order: [], history: {} });
  useAiRuns.setState({ runs: {} });
  useCopilot.setState({ conversations: {} });
  useFeedback.setState({ toasts: [], announcement: { id: 0, text: '' } });
  useLocaleStore.setState({ locale: 'en', messages: en });
  useRuntimeConfig.setState({ config: null, unreachable: false });
  useTheme.setState({ theme: 'night' });
  useDraft.getState().clear();
  document.documentElement.lang = 'en';
  document.documentElement.dataset.theme = 'night';
}

/** Renders inside a router at `path` (no real navigation), with icons and shared SVG defs. */
export function renderAt(ui: ReactElement, path = '/', search = '') {
  const location = memoryLocation({ path, searchPath: search, record: true });
  const result = render(
    <LucideProvider strokeWidth={1.75} className="i">
      <SharedDefs />
      <Router hook={location.hook} searchHook={location.searchHook}>
        {ui}
      </Router>
      <Feedback />
    </LucideProvider>,
  );
  return { ...result, location };
}

/** A plan dated a few months ahead of the real clock, saved in the store. */
export function seedPlan(overrides: Partial<EventBriefInput> = {}): EventPlan {
  const today = localToday();
  const year = Number(today.slice(0, 4)) + 1;
  const plan = createBaselinePlan(
    EventBrief.parse({ ...weddingBriefInput, date: `${String(year)}-02-14`, ...overrides }),
    { today, now: new Date().toISOString(), makeId: sequentialIds() },
  );
  plansStore.getState().addPlan(plan);
  return plan;
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function ndjsonResponse(events: readonly unknown[]): Response {
  return new Response(events.map((event) => JSON.stringify(event)).join('\n') + '\n', {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

export type ApiHandler = (body: unknown) => Response | Promise<Response>;

/** Replaces fetch with handlers keyed by path; records every call. */
export function mockApi(handlers: Record<string, ApiHandler>) {
  const calls: { path: string; body: unknown; headers: Headers }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.pathname
          : new URL(input.url).pathname;
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ path, body, headers: new Headers(init?.headers) });
    const handler = handlers[path];
    if (!handler) return jsonResponse({ code: 'not_found', message: 'Not found' }, 404);
    return handler(body);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
